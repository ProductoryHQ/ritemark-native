/**
 * Tests for CodexRuntime.
 *
 * Run: npx tsx src/codex/CodexRuntime.test.ts
 *
 * Uses private-field patching to inject mock objects so tests run without
 * spawning the Codex binary. A minimal vscode stub is injected into the
 * require cache before loading CodexRuntime to satisfy the featureGate.ts
 * top-level `import * as vscode from 'vscode'` dependency.
 *
 * Sprint 99: the adapter is now `Map<conversationId, CodexSession>` over ONE
 * shared app-server, so the turn-scoped assertions moved from the runtime onto
 * the session. Tests 6–8 are the multi-thread regression tests (B1/B2/B3).
 */

// ── Minimal vscode stub ──────────────────────────────────────────────────────
// featureGate.ts does `import * as vscode from 'vscode'` at module load;
// pre-populate the require cache with a stub before any other imports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
  _cache: Record<string, unknown>;
};
const vscodeMod = {
  workspace: {
    getConfiguration: () => ({ get: (_key: string, def: unknown) => def }),
  },
};
// Patch _resolveFilename so 'vscode' resolves to a sentinel key
const _originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') return '__vscode_stub__';
  return _originalResolve(request, ...rest);
};
// Inject the stub under the sentinel key
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__',
  filename: '__vscode_stub__',
  loaded: true,
  children: [],
  paths: [],
  exports: vscodeMod,
};

// ── Now safe to import vscode-dependent modules ──────────────────────────────
import * as assert from 'assert';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CodexRuntime, CodexSession } = require('./CodexRuntime') as typeof import('./CodexRuntime');
type CodexRuntime = import('./CodexRuntime').CodexRuntime;
type CodexSession = import('./CodexRuntime').CodexSession;
import type { AgentRuntime, RuntimeSessionConfig } from '../runtime/AgentRuntime';
import type { AgentProgress } from '../agent/types';

// ── Mock CodexAppServer ──────────────────────────────────────────────────────

const calls: string[] = [];

/** Event listeners the runtime registered on the mock, so tests can fire them. */
type Listener = (params: unknown) => void;

function makeMockAppServer(threadIds: string[] = ['thread-1']) {
  const listeners = new Map<string, Listener[]>();
  let threadSeq = 0;
  return {
    listeners,
    emit(event: string, params: unknown) {
      for (const l of listeners.get(event) ?? []) l(params);
    },
    on: (event: string, listener: Listener) => {
      const list = listeners.get(event) ?? [];
      list.push(listener);
      listeners.set(event, list);
    },
    ensureInitialized: async () => { calls.push('ensureInitialized'); return {}; },
    threadStart: async (_params: unknown, _conversationId?: string) => {
      calls.push('threadStart');
      const id = threadIds[Math.min(threadSeq++, threadIds.length - 1)];
      return { thread: { id }, model: 'gpt-5' };
    },
    turnStart: async (_threadId: string, _message: string) => {
      calls.push('turnStart');
      return { turn: { id: `turn-${_threadId}`, status: 'running' } };
    },
    turnInterrupt: async (threadId: string, turnId: string) => {
      calls.push(`turnInterrupt:${threadId}:${turnId}`);
    },
    sendApprovalResponse: (_requestId: unknown, _decision: string) => {
      calls.push('sendApprovalResponse');
    },
    sendToolRequestUserInputResponse: () => { calls.push('answerQuestion'); },
    dispose: () => { calls.push('appServerDispose'); },
  };
}

const dummyConfig: RuntimeSessionConfig = {
  workspacePath: '/tmp/test',
  onProgress: () => {},
  onApprovalRequest: () => {},
};

/**
 * Build a runtime with the mock app-server installed and its event listeners
 * wired, without spawning anything.
 */
function makeRuntime(threadIds?: string[]) {
  const runtime = new CodexRuntime();
  const mock = makeMockAppServer(threadIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = runtime as any;
  r._appServer = mock;
  r._auth = { isAuthenticated: () => true };
  r._setupEventListeners();
  return { runtime, mock };
}

/** Open a session and drive one turn through it (creates the thread). */
async function openTurn(runtime: CodexRuntime, conversationId: string, config: RuntimeSessionConfig): Promise<CodexSession> {
  const session = new CodexSession(conversationId, config, runtime);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (runtime as any)._sessions.set(conversationId, session);
  await session.prompt({ prompt: 'go' });
  return session;
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** Cancelling must decline what this conversation left outstanding, not just interrupt the turn. */
async function testCancelDeclinesOutstandingApprovals(): Promise<void> {
  const { runtime } = makeRuntime(['thread-cancel']);
  const session = await openTurn(runtime, 'conv-cancel', dummyConfig);

  // Simulate an approval this conversation raised and is still waiting on:
  // the session tracks it AND the runtime holds the server-side request id.
  session._trackRequest('codex-77');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = runtime as any;
  r._requestIdMap.set('codex-77', 77);
  r._requestConversation.set('codex-77', 'conv-cancel');

  calls.length = 0;
  await session.cancel();

  assert.ok(
    calls.includes('sendApprovalResponse'),
    'cancel must answer the outstanding approval, not leave the app-server blocked on it',
  );
  console.log('✓ Test 10: cancel declines outstanding approvals');
}

async function run() {
  // Test 1: CodexRuntime structurally satisfies AgentRuntime
  {
    const runtime: AgentRuntime = new CodexRuntime();
    assert.strictEqual(runtime.id, 'codex', 'id must be "codex"');
    console.log('✓ Test 1: id is "codex"');
  }

  // Test 2: session.cancel() calls turnInterrupt() with ITS thread + turn
  {
    const { runtime } = makeRuntime(['thread-1']);
    calls.length = 0;
    const session = await openTurn(runtime, 'conv-a', dummyConfig);
    await session.cancel();
    assert.ok(calls.includes('turnInterrupt:thread-1:turn-thread-1'), `cancel() must interrupt its own turn, got ${calls}`);
    console.log('✓ Test 2: session.cancel() calls turnInterrupt() for its own thread');
  }

  // Test 3: runtime.dispose() disposes the app server and clears session state
  {
    const { runtime } = makeRuntime(['thread-1']);
    calls.length = 0;
    const session = await openTurn(runtime, 'conv-a', dummyConfig);
    runtime.dispose();
    assert.ok(calls.includes('appServerDispose'), 'dispose() must call appServer.dispose()');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = runtime as any;
    assert.strictEqual(r._appServer, null, 'dispose() must null _appServer');
    assert.strictEqual(r._sessions.size, 0, 'dispose() must drop every session');
    assert.strictEqual(session.threadId, null, 'dispose() must clear the session thread id');
    console.log('✓ Test 3: dispose() tears down the app server and all sessions');
  }

  // Test 4: respondToApproval() calls sendApprovalResponse() with correct decision
  {
    const { runtime } = makeRuntime();
    const session = new CodexSession('conv-a', dummyConfig, runtime);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._requestIdMap.set('codex-42', 42);
    let capturedId: unknown;
    let capturedDecision: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._appServer.sendApprovalResponse = (id: unknown, decision: string) => {
      capturedId = id;
      capturedDecision = decision;
    };
    session.respondToApproval('codex-42', true, false);
    assert.strictEqual(capturedId, 42, 'respondToApproval must resolve to original server id');
    assert.strictEqual(capturedDecision, 'accept', 'approved=true must map to "accept"');
    console.log('✓ Test 4: respondToApproval() maps to sendApprovalResponse()');
  }

  // Test 5: respondToApproval() maps approved=false to "decline"
  {
    const { runtime } = makeRuntime();
    const session = new CodexSession('conv-a', dummyConfig, runtime);
    let capturedDecision: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._appServer.sendApprovalResponse = (_id: unknown, decision: string) => { capturedDecision = decision; };
    session.respondToApproval('unknown-id', false, false);
    assert.strictEqual(capturedDecision, 'decline', 'approved=false must map to "decline"');
    console.log('✓ Test 5: respondToApproval() approved=false maps to "decline"');
  }

  // ── Test 6: B3 REGRESSION — two threads get their OWN streamed deltas.
  // `item/agentMessage/delta` did not even destructure threadId before Sprint 99;
  // every delta went to `this._sessionConfig`, i.e. whichever chat started last.
  {
    const { runtime, mock } = makeRuntime(['thread-a', 'thread-b']);
    const textA: string[] = [];
    const textB: string[] = [];
    const cfg = (sink: string[]): RuntimeSessionConfig => ({
      ...dummyConfig,
      onProgress: (p: AgentProgress) => { if (p.type === 'text') sink.push(p.message); },
    });
    const a = await openTurn(runtime, 'conv-a', cfg(textA));
    const b = await openTurn(runtime, 'conv-b', cfg(textB));
    assert.strictEqual(a.threadId, 'thread-a');
    assert.strictEqual(b.threadId, 'thread-b');

    mock.emit('item/agentMessage/delta', { threadId: 'thread-a', delta: 'alpha' });
    mock.emit('item/agentMessage/delta', { threadId: 'thread-b', delta: 'beta' });
    mock.emit('item/agentMessage/delta', { threadId: 'thread-a', delta: '-again' });

    assert.deepStrictEqual(textA, ['alpha', '-again'], `A got only its own deltas, got ${JSON.stringify(textA)}`);
    assert.deepStrictEqual(textB, ['beta'], `B got only its own deltas, got ${JSON.stringify(textB)}`);

    // An unattributable delta with several sessions live is DROPPED, not misrouted.
    mock.emit('item/agentMessage/delta', { delta: 'orphan' });
    assert.ok(!textA.includes('orphan') && !textB.includes('orphan'), 'unroutable delta is dropped, never misrouted');
    console.log('✓ Test 6: B3 — streamed deltas route by threadId, orphans dropped');
  }

  // ── Test 7: B2 REGRESSION — turn/completed clears only its own turn id.
  // `_turnId` was a shared scalar, so thread B completing wiped thread A's turn
  // id and made A's later cancel() a silent no-op (cancel needs both ids).
  {
    const { runtime, mock } = makeRuntime(['thread-a', 'thread-b']);
    const a = await openTurn(runtime, 'conv-a', dummyConfig);
    const b = await openTurn(runtime, 'conv-b', dummyConfig);

    mock.emit('turn/completed', { threadId: 'thread-b', turn: { id: 'turn-thread-b', status: 'completed', error: null } });
    assert.strictEqual(b.turnId, null, "B's own turn id is cleared by its completion");
    assert.strictEqual(a.turnId, 'turn-thread-a', "A's turn id must survive B completing");

    calls.length = 0;
    await a.cancel();
    assert.ok(calls.includes('turnInterrupt:thread-a:turn-thread-a'),
      `A's cancel must still reach the server, got ${calls}`);
    console.log('✓ Test 7: B2 — turn/completed clears only the completing thread');
  }

  // ── Test 8: B1 REGRESSION — switching approval mode in one conversation must
  // not reset another's thread. `_threadApprovalKey` and
  // `_browserToolsEnabledForThread` were adapter scalars, so chat B switching
  // Auto→Ask (or toggling browser control) nulled `_threadId` and silently
  // destroyed chat A's entire thread context. Highest-severity bug in the sprint.
  {
    const { runtime } = makeRuntime(['thread-a', 'thread-b', 'thread-b2']);
    const a = await openTurn(runtime, 'conv-a', { ...dummyConfig, codexApprovalPolicy: 'never' });
    const b = await openTurn(runtime, 'conv-b', { ...dummyConfig, codexApprovalPolicy: 'never' });
    assert.strictEqual(a.threadId, 'thread-a');
    assert.strictEqual(b.threadId, 'thread-b');

    // B switches Auto → Ask, which legitimately forces B's thread to be recreated.
    b.applyConfig({ ...dummyConfig, codexApprovalPolicy: 'untrusted' });
    await b.prompt({ prompt: 'now in ask mode' });
    assert.strictEqual(b.threadId, 'thread-b2', "B's own thread is recreated for the new approval mode");
    assert.strictEqual(a.threadId, 'thread-a', "A's thread MUST survive B's approval-mode switch");

    // Same for a browser-control toggle in B.
    b.applyConfig({ ...dummyConfig, codexApprovalPolicy: 'untrusted', onBrowserToolCall: async () => ({ text: '', success: true }) });
    await b.prompt({ prompt: 'with browser' });
    assert.strictEqual(a.threadId, 'thread-a', "A's thread MUST survive B's browser-control toggle");
    assert.strictEqual(a.getBrowserToolsEnabled(), false, "A's browser-tools state is its own");
    assert.strictEqual(b.getBrowserToolsEnabled(), true, "B's browser-tools state is its own");
    console.log('✓ Test 8: B1 — a conversation switching approval/browser mode cannot reset a sibling');
  }

  // ── Test 9: B4 — the app-server exiting fans out to EVERY conversation ──
  {
    const { runtime, mock } = makeRuntime(['thread-a', 'thread-b']);
    const exited: string[] = [];
    await openTurn(runtime, 'conv-a', { ...dummyConfig, onExit: () => exited.push('conv-a') });
    await openTurn(runtime, 'conv-b', { ...dummyConfig, onExit: () => exited.push('conv-b') });
    mock.emit('exit', undefined);
    assert.deepStrictEqual(exited.sort(), ['conv-a', 'conv-b'], 'exit must reach every conversation');
    console.log('✓ Test 9: B4 — exit fans out to all conversations');
  }

  await testCancelDeclinesOutstandingApprovals();

  console.log('\nAll 10 CodexRuntime tests passed!');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
