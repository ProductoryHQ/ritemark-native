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
const { AcpRuntime, AcpSession } = require('./AcpRuntime') as typeof import('./AcpRuntime');
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
  prompt: async (_sessionId: string, _text: string) => {
    calls.push('prompt');
    return { stopReason: 'end_turn', usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 } };
  },
  setModel: async (_sessionId: string, _model: string) => { calls.push('setModel'); },
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

  console.log('\nAll 8 AcpRuntime tests passed!');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
