/**
 * Tests for AcpRuntime.
 *
 * Run: npx tsx src/acp/AcpRuntime.test.ts
 *
 * Uses private-field patching to inject a mock AcpManager so tests run
 * without spawning the OpenCode binary.
 *
 * Sprint 99: the runtime now holds `Map<conversationId, AcpSession>` over ONE
 * shared subprocess, so the single-session assertions ("cancel nulls _manager")
 * were replaced with per-session equivalents. Test 7 is the C1 regression test.
 */

// ── Minimal vscode stub ──────────────────────────────────────────────────────
// AcpRuntime pulls in BrowserToolsInjector → browserMcpServer → BrowserActionTools,
// which does `import * as vscode from 'vscode'` at module load. Pre-populate the
// require cache with a stub (same technique as CodexRuntime.test.ts) so the test
// runs outside the extension host. Without this the file could not even load.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};
const vscodeMod = {
  workspace: { getConfiguration: () => ({ get: (_key: string, def: unknown) => def }) },
  commands: { executeCommand: async () => undefined },
  window: { showErrorMessage: () => undefined },
  Uri: { parse: (s: string) => s, file: (s: string) => s },
  EventEmitter: class { event = () => {}; fire() {} dispose() {} },
};
const _originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') return '__vscode_stub__';
  return _originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__', filename: '__vscode_stub__', loaded: true,
  children: [], paths: [], exports: vscodeMod,
};

// ── Now safe to import vscode-dependent modules ──────────────────────────────
import * as assert from 'assert';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AcpRuntime, AcpSession, buildAcpPromptText } = require('./AcpRuntime') as typeof import('./AcpRuntime');
type AcpRuntime = import('./AcpRuntime').AcpRuntime;
type AcpSession = import('./AcpRuntime').AcpSession;
import type { AgentRuntime, RuntimeSessionConfig } from '../runtime/AgentRuntime';
import type { RequestPermissionRequest, WriteTextFileRequest } from '@agentclientprotocol/sdk';

// ── Mock AcpManager ──────────────────────────────────────────────────────────

const calls: string[] = [];
let sessionSeq = 0;

const mockManager = {
  isRunning: () => true,
  sessionCount: 1,
  currentSessionId: 'ses-1',
  hasSession: () => true,
  start: async () => { calls.push('start'); return `ses-${++sessionSeq}`; },
  resume: async (sessionId: string) => { calls.push(`resume:${sessionId}`); },
  prompt: async (_sessionId: string, _text: string) => {
    calls.push('prompt');
    return { stopReason: 'end_turn', usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 } };
  },
  setModel: async (_sessionId: string, _model: string) => { calls.push('setModel'); },
  getThinkingEffortCapability: () => ({
    selectable: ['low', 'medium', 'high'],
    defaultLevel: 'medium',
    source: 'runtime-live',
    supportsAppliedValue: true,
  }),
  setThinkingEffort: async (_sessionId: string, effort: string) => {
    calls.push(`setThinkingEffort:${effort}`);
    return effort === 'auto' ? 'medium' : effort;
  },
  cancel: async (_sessionId: string) => { calls.push('cancel'); },
  closeSession: (_sessionId: string) => { calls.push('closeSession'); },
  dispose: () => { calls.push('dispose'); },
};

const dummyConfig: RuntimeSessionConfig = {
  workspacePath: '/tmp/test',
  onProgress: () => {},
  onApprovalRequest: () => {},
};

/** Register a session on the runtime without spawning anything. */
function addSession(runtime: AcpRuntime, conversationId: string, config?: RuntimeSessionConfig): AcpSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = runtime as any;
  r._manager = mockManager;
  const acpSessionId = `ses-${++sessionSeq}`;
  const session = new AcpSession(conversationId, acpSessionId, config ?? dummyConfig, runtime);
  r._sessions.set(conversationId, session);
  r._sessionsByAcpId.set(acpSessionId, session);
  return session;
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Codex review (PR #158): disposing a session must cancel the upstream turn.
 *
 * closeSession() only drops local state, so without a cancel the remote turn
 * keeps running against a conversation nobody is watching. The approval gate
 * does hold — unroutable permissions are cancelled and unroutable writes denied
 * — but a turn executing after the user discarded its conversation is wrong on
 * its own, and burns tokens with no way to observe or stop it.
 */
async function testDisposeCancelsUpstreamTurn(): Promise<void> {
  const runtime = new AcpRuntime();
  const session = addSession(runtime, 'conv-dispose');

  calls.length = 0;
  session.dispose();
  await new Promise((r) => setImmediate(r));   // dispose fires cancel without awaiting

  assert.ok(calls.includes('cancel'), 'dispose() must cancel the session, not just forget it');
  assert.ok(
    calls.indexOf('cancel') < calls.indexOf('closeSession') || !calls.includes('closeSession'),
    'the cancel must be issued before the session is dropped',
  );
  console.log('✓ Test 9: dispose() cancels the upstream turn before forgetting the session');
}

/**
 * Sprint 100: OpenCode 1.18.4 throws "No provider available" when no model is
 * selected (1.15.13 returned a silent zero-token turn instead). The raw message
 * tells a user nothing, so it must be translated.
 */
async function testNoProviderErrorIsActionable(): Promise<void> {
  const runtime = new AcpRuntime();
  let reported: string | undefined;
  const config: RuntimeSessionConfig = {
    ...dummyConfig,
    onCodexComplete: (r) => { reported = r.error; },
  };
  const session = addSession(runtime, 'conv-nomodel', config);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (runtime as any)._manager = {
    ...mockManager,
    prompt: async () => { throw new Error('Internal error: No provider available'); },
  };

  await session.prompt({ prompt: 'hi' });

  assert.ok(reported, 'the turn must report an error');
  assert.ok(!/no provider available/i.test(reported!), 'the raw protocol message must not reach the user');
  assert.match(reported!, /model is selected/i, 'the message must say what to do about it');
  console.log('✓ Test 10: "No provider available" becomes an actionable message');
}

/**
 * A hung provider must not strand the turn forever. The ACP path had no timeout
 * of its own (Claude and Codex both do), so a non-responding model left the UI
 * at "Starting OpenCode…" with no way out but Stop. The turn must now settle as
 * an actionable error and cancel the abandoned session.
 */
async function testHungTurnTimesOut(): Promise<void> {
  const runtime = new AcpRuntime();
  let reported: { status: string; error?: string } | undefined;
  const config: RuntimeSessionConfig = {
    ...dummyConfig,
    onCodexComplete: (r) => { reported = r; },
  };
  const session = addSession(runtime, 'conv-hang', config);

  const cancelled: string[] = [];
  // A prompt that never resolves, and a cancel we can observe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (runtime as any)._manager = {
    ...mockManager,
    prompt: () => new Promise(() => { /* hangs forever */ }),
    cancel: async (sid: string) => { cancelled.push(sid); },
  };

  // timeoutMinutes is minutes; 1/60000 min = 1ms so the test does not wait 15m.
  await session.prompt({ prompt: 'hi', timeoutMinutes: 1 / 60000 });

  assert.equal(reported?.status, 'error', 'a hung turn must settle as an error, not hang');
  assert.match(reported?.error ?? '', /did not respond/i, 'the error must be actionable, not a raw hang');
  assert.equal(cancelled.length, 1, 'the abandoned upstream session must be cancelled');
  console.log('✓ Test 11: a hung OpenCode turn times out and cancels the session');
}

async function run() {
  // Test 1: AcpRuntime structurally satisfies AgentRuntime
  {
    const runtime: AgentRuntime = new AcpRuntime();
    assert.strictEqual(runtime.id, 'opencode', 'id must be "opencode"');
    console.log('✓ Test 1: id is "opencode"');
  }

  // Test 2: session.cancel() cancels that ACP session and drops it
  {
    const runtime = new AcpRuntime();
    calls.length = 0;
    const session = addSession(runtime, 'conv-a');
    await session.cancel();
    assert.ok(calls.includes('cancel'), 'cancel() must call manager.cancel()');
    assert.strictEqual(runtime.getSession('conv-a'), undefined, 'cancelled session is dropped');
    console.log('✓ Test 2: session.cancel() cancels and drops that session only');
  }

  // Test 3: runtime.dispose() disposes the shared manager
  {
    const runtime = new AcpRuntime();
    calls.length = 0;
    addSession(runtime, 'conv-a');
    runtime.dispose();
    assert.ok(calls.includes('dispose'), 'dispose() must call manager.dispose()');
    console.log('✓ Test 3: runtime.dispose() disposes the shared manager');
  }

  // Test 4: respondToApproval() resolves a pending approval on its own session
  {
    const runtime = new AcpRuntime();
    const session = addSession(runtime, 'conv-a');

    let capturedApproved: boolean | null = null;
    let capturedAlwaysAllow: boolean | null = null;
    session.pendingApprovals.set('req-1', (result) => {
      capturedApproved = result.approved;
      capturedAlwaysAllow = result.alwaysAllow;
    });

    session.respondToApproval('req-1', true, true);
    assert.strictEqual(capturedApproved, true, 'respondToApproval must pass approved');
    assert.strictEqual(capturedAlwaysAllow, true, 'respondToApproval must pass alwaysAllow');
    assert.strictEqual(session.pendingApprovals.size, 0, 'must remove resolved entry');
    console.log('✓ Test 4: respondToApproval() resolves pending approval');
  }

  // Test 5: disposing one session rejects only ITS pending approvals
  {
    const runtime = new AcpRuntime();
    const a = addSession(runtime, 'conv-a');
    const b = addSession(runtime, 'conv-b');

    const results: string[] = [];
    a.pendingApprovals.set('a1', (r) => results.push(`a1:${r.approved}`));
    b.pendingApprovals.set('b1', (r) => results.push(`b1:${r.approved}`));

    a.dispose();
    assert.deepStrictEqual(results, ['a1:false'], 'only the disposed session had its approvals rejected');
    assert.strictEqual(b.pendingApprovals.size, 1, "sibling's pending approval survives");
    console.log('✓ Test 5: disposing one session rejects only its own approvals');
  }

  // Test 6: prompt() calls setModel and manager.prompt()
  {
    const runtime = new AcpRuntime();
    calls.length = 0;
    const session = addSession(runtime, 'conv-a', { ...dummyConfig, model: 'openai/gpt-4o' });
    await session.prompt({ prompt: 'Hello' });
    assert.ok(calls.includes('setModel'), 'prompt() must call setModel when config.model is set');
    assert.ok(calls.includes('prompt'), 'prompt() must call manager.prompt()');
    console.log('✓ Test 6: prompt() calls setModel and manager.prompt()');
  }

  // Thinking effort is applied before the prompt, and Auto restores the live default.
  {
    const runtime = new AcpRuntime();
    calls.length = 0;
    const session = addSession(runtime, 'conv-effort');
    await session.prompt({ prompt: 'thorough', thinkingEffort: 'high' });
    await session.prompt({ prompt: 'default again', thinkingEffort: 'auto' });
    assert.ok(calls.indexOf('setThinkingEffort:high') < calls.indexOf('prompt'));
    assert.ok(calls.includes('setThinkingEffort:auto'), 'Auto restores the captured ACP default after a manual override');
    console.log('✓ Test 6b: ACP effort applies before prompt and Auto restores the live default');
  }

  // A rejected live option falls back to Auto without dropping the user prompt.
  {
    const runtime = new AcpRuntime();
    calls.length = 0;
    const applied: Array<{ requested: string; adjusted: boolean }> = [];
    const session = addSession(runtime, 'conv-effort-fallback', {
      ...dummyConfig,
      onThinkingEffortApplied: (result) => applied.push(result),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._manager = {
      ...mockManager,
      setThinkingEffort: async (_sessionId: string, effort: string) => {
        if (effort === 'high') throw new Error('option rejected');
        return 'medium';
      },
    };
    await session.prompt({ prompt: 'still send', thinkingEffort: 'high' });
    assert.ok(calls.includes('prompt'), 'effort rejection must not drop the accepted prompt');
    assert.equal(applied[0]?.adjusted, true);
    console.log('✓ Test 6c: rejected ACP effort falls back to Auto and still prompts');
  }

  // ACP remains provider-driven, but every level actually advertised by the
  // live option must be forwarded verbatim before its associated prompt.
  {
    const runtime = new AcpRuntime();
    calls.length = 0;
    const session = addSession(runtime, 'conv-effort-matrix');
    const advertised = ['low', 'medium', 'high'] as const;
    for (const effort of advertised) {
      await session.prompt({ prompt: `Use ${effort}`, thinkingEffort: effort });
    }
    assert.deepStrictEqual(
      calls.filter((call) => call.startsWith('setThinkingEffort:')),
      advertised.map((effort) => `setThinkingEffort:${effort}`),
    );
    console.log('✓ Test 6d: every live-advertised ACP effort is forwarded unchanged');
  }

  // ── Test 7: C1 REGRESSION — two sessions must not share write-approval state.
  // Before Sprint 99 `_recentlyPermissionedWrites` was a process-wide
  // Set<filePath> on the runtime: chat A approving a write to foo.md silently
  // auto-allowed chat B's write to the same path. That is a cross-chat approval
  // bypass and a release blocker.
  {
    const runtime = new AcpRuntime();
    const approvalsAskedIn: string[] = [];

    // A always approves; B always denies. If the pre-Sprint-99 bypass were
    // present, B would never be asked at all and its write would be allowed.
    const configFor = (name: string, answer: boolean): RuntimeSessionConfig => ({
      ...dummyConfig,
      approvalMode: 'ask',
      onApprovalRequest: (req) => {
        approvalsAskedIn.push(name);
        runtime.getSession(name)?.respondToApproval(req.requestId, answer, false);
      },
    });

    const a = addSession(runtime, 'conv-a', configFor('conv-a', true));
    const b = addSession(runtime, 'conv-b', configFor('conv-b', false));

    // A approves an edit to shared.md via session/request_permission.
    const permParams = {
      sessionId: a.acpSessionId,
      toolCall: { toolCallId: 't1', title: 'edit', status: 'pending', kind: 'edit', locations: [{ path: '/ws/shared.md' }] },
      options: [
        { optionId: 'once', kind: 'allow_once', name: 'Allow once' },
        { optionId: 'no', kind: 'reject_once', name: 'Reject' },
      ],
    } as unknown as RequestPermissionRequest;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ((runtime as any)._handlePermission(permParams) as Promise<unknown>);
    assert.deepStrictEqual(approvalsAskedIn, ['conv-a'], 'A was prompted for the edit permission');

    assert.ok(a.recentlyPermissionedWrites.has('/ws/shared.md'), "A's approval is recorded on A");
    assert.ok(!b.recentlyPermissionedWrites.has('/ws/shared.md'), "A's approval must NOT appear on B");

    // Now B writes the SAME path. It must be prompted, not auto-allowed.
    approvalsAskedIn.length = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bAllowed = await (runtime as any)._handleWriteApproval({
      sessionId: b.acpSessionId,
      path: '/ws/shared.md',
      content: 'hi',
    } as WriteTextFileRequest);
    assert.deepStrictEqual(approvalsAskedIn, ['conv-b'], "B must be asked — A's approval must not carry over");
    assert.strictEqual(bAllowed, false, "B's write is denied because B denied it, not auto-allowed via A");

    // And A's own follow-up write IS auto-allowed (one prompt, not two).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aAllowed = await (runtime as any)._handleWriteApproval({
      sessionId: a.acpSessionId,
      path: '/ws/shared.md',
      content: 'hi',
    } as WriteTextFileRequest);
    assert.strictEqual(aAllowed, true, "A's own follow-up write is auto-allowed (no double prompt)");
    console.log('✓ Test 7: C1 — write-approval state is per session, no cross-chat bypass');
  }

  // Test 8: an fs write for an unknown session is DENIED, never auto-allowed
  {
    const runtime = new AcpRuntime();
    addSession(runtime, 'conv-a');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allowed = await (runtime as any)._handleWriteApproval({
      sessionId: 'ses-does-not-exist',
      path: '/ws/x.md',
      content: 'x',
    } as WriteTextFileRequest);
    assert.strictEqual(allowed, false, 'unroutable write must be denied (R4: no silent writes)');
    console.log('✓ Test 8: unroutable write is denied');
  }

  await testDisposeCancelsUpstreamTurn();

  await testNoProviderErrorIsActionable();

  await testHungTurnTimesOut();

  // ACP continuation uses session/resume (never session/load) and retains the
  // provider session id as a host-only checkpoint.
  {
    const runtime = new AcpRuntime();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._manager = mockManager;
    calls.length = 0;
    const states: string[] = [];
    const checkpoints: string[] = [];
    const compatibility = {
      runtimeId: 'opencode' as const,
      scopeId: `ps1-${'b'.repeat(40)}`,
      runtimeVersion: '1.18.21',
      adapterContractVersion: 1,
      modelId: 'opencode:anthropic/claude-opus-4-1',
      compatibilityFingerprint: 'fingerprint',
    };
    const session = await runtime.createSession('conv-resume', {
      ...dummyConfig,
      continuation: {
        compatibility,
        descriptor: {
          descriptorVersion: 1,
          ...compatibility,
          nativeReference: 'ses-resume-me',
          coveredThroughEventId: 'assistant-final-2',
          capturedAt: '2026-08-23T10:00:00.000Z',
        },
      },
      onContinuationState: (state) => states.push(state.mode),
      onContinuationCheckpoint: (descriptor) => checkpoints.push(descriptor.nativeReference),
    });
    assert.strictEqual((session as AcpSession).acpSessionId, 'ses-resume-me');
    assert.ok(calls.includes('resume:ses-resume-me'));
    assert.ok(!calls.includes('start'), 'compatible resume does not mint a new ACP session');
    assert.deepStrictEqual(states, ['pending', 'native-restored']);
    assert.deepStrictEqual(checkpoints, ['ses-resume-me']);
    console.log('✓ Test 12: ACP session/resume is used without session/load');
  }

  // ── Test 9: Sprint 101 — capability context prefixed, order preserved ──
  {
    const turn = { prompt: 'rewrite this', activeFile: { path: 'notes.md' } };
    const context = 'RITEMARK CONTEXT\nYou are a markdown editor.';
    const { text } = buildAcpPromptText(turn as any, { capabilityContext: context });
    assert.ok(text.startsWith(context), 'capability context leads the prompt');
    assert.ok(text.includes('[Currently editing: notes.md]'), 'active-file preamble preserved');
    assert.ok(text.trimEnd().endsWith('rewrite this'), 'user prompt stays last');
    // Context ordering: capability context before the active-file preamble.
    assert.ok(text.indexOf(context) < text.indexOf('[Currently editing'), 'context precedes active-file block');

    // No context passed (later turns) → no prefix, prompt still composed.
    const { text: bare } = buildAcpPromptText(turn as any, {});
    assert.ok(!bare.includes('RITEMARK CONTEXT'), 'omitting context yields no prefix');
    assert.ok(bare.includes('[Currently editing: notes.md]'), 'active-file preamble still present');

    // Image attachments still counted for the BYOK conversion notice.
    const withImg = buildAcpPromptText(
      { prompt: 'x', attachments: [{ kind: 'image', name: 'a.png', data: 'zzz' }] } as any,
      {},
    );
    assert.strictEqual(withImg.imageAttachmentCount, 1, 'image attachments counted');
    console.log('✓ Test 9: buildAcpPromptText — context prefix, order, image count');
  }

  // ── Test 10: capability context injected ONCE per session ──
  {
    const session = new AcpSession('conv-once', 'ses-1', {
      ...dummyConfig,
      extraSystemPrompt: 'RITEMARK CONTEXT once',
    } as RuntimeSessionConfig, {} as AcpRuntime);
    // First turn: the flag was false → context is what buildAcpPromptText receives.
    const firstCtx = (session as any)._capabilityContextInjected ? undefined : session.config.extraSystemPrompt;
    assert.strictEqual(firstCtx, 'RITEMARK CONTEXT once', 'first turn would inject the context');
    (session as any)._capabilityContextInjected = true;
    const secondCtx = (session as any)._capabilityContextInjected ? undefined : session.config.extraSystemPrompt;
    assert.strictEqual(secondCtx, undefined, 'second turn injects nothing (once per session)');
    console.log('✓ Test 10: capability context is once-per-session');
  }

  // First provider progress/tool/final evidence advances dispatch exactly once.
  {
    let accepted = 0;
    const session = new AcpSession('conv-dispatch', 'ses-dispatch', {
      ...dummyConfig,
      onDispatchAccepted: () => { accepted += 1; },
    }, {} as AcpRuntime);
    session.markDispatchAccepted();
    session.markDispatchAccepted();
    assert.strictEqual(accepted, 1);
    console.log('✓ Test 13: ACP provider evidence accepts dispatch once');
  }

  console.log('\nAll 15 AcpRuntime tests passed!');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
