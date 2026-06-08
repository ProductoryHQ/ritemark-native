/**
 * Tests for CodexRuntime.
 *
 * Run: npx tsx src/codex/CodexRuntime.test.ts
 *
 * Uses private-field patching to inject mock objects so tests run without
 * spawning the Codex binary. A minimal vscode stub is injected into the
 * require cache before loading CodexRuntime to satisfy the featureGate.ts
 * top-level `import * as vscode from 'vscode'` dependency.
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
const { CodexRuntime } = require('./CodexRuntime') as { CodexRuntime: new () => import('./CodexRuntime').CodexRuntime };
import type { AgentRuntime, RuntimeSessionConfig } from '../runtime/AgentRuntime';

// ── Mock CodexAppServer ──────────────────────────────────────────────────────

const calls: string[] = [];

const mockAppServer = {
  on: (_event: string, _listener: unknown) => {},
  ensureInitialized: async () => { calls.push('ensureInitialized'); return {}; },
  threadStart: async (_params: unknown) => {
    calls.push('threadStart');
    return { thread: { id: 'thread-1' }, model: 'gpt-5' };
  },
  turnStart: async (_threadId: string, _message: string) => {
    calls.push('turnStart');
    return { turn: { id: 'turn-1', status: 'running' } };
  },
  turnInterrupt: async (_threadId: string, _turnId: string) => {
    calls.push('turnInterrupt');
  },
  sendApprovalResponse: (_requestId: unknown, _decision: string) => {
    calls.push('sendApprovalResponse');
  },
  dispose: () => { calls.push('appServerDispose'); },
};

type CodexRuntimeInstance = InstanceType<typeof CodexRuntime>;

function injectMocks(runtime: CodexRuntimeInstance): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = runtime as any;
  r._appServer = mockAppServer;
  r._auth = { isAuthenticated: () => true };
  r._threadId = 'thread-1';
  r._turnId = 'turn-1';
  r._sessionConfig = dummyConfig;
}

const dummyConfig: RuntimeSessionConfig = {
  workspacePath: '/tmp/test',
  onProgress: () => {},
  onApprovalRequest: () => {},
};

// ── Tests ────────────────────────────────────────────────────────────────────

async function run() {
  // Test 1: CodexRuntime structurally satisfies AgentRuntime
  {
    const runtime: AgentRuntime = new CodexRuntime();
    assert.strictEqual(runtime.id, 'codex', 'id must be "codex"');
    console.log('✓ Test 1: id is "codex"');
  }

  // Test 2: cancel() calls turnInterrupt() on the app server
  {
    const runtime = new CodexRuntime();
    calls.length = 0;
    injectMocks(runtime);
    await runtime.cancel();
    assert.ok(calls.includes('turnInterrupt'), 'cancel() must call turnInterrupt()');
    console.log('✓ Test 2: cancel() calls turnInterrupt()');
  }

  // Test 3: dispose() calls appServer.dispose() and clears state
  {
    const runtime = new CodexRuntime();
    calls.length = 0;
    injectMocks(runtime);
    runtime.dispose();
    assert.ok(calls.includes('appServerDispose'), 'dispose() must call appServer.dispose()');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = runtime as any;
    assert.strictEqual(r._appServer, null, 'dispose() must null _appServer');
    assert.strictEqual(r._threadId, null, 'dispose() must null _threadId');
    assert.strictEqual(r._turnId, null, 'dispose() must null _turnId');
    console.log('✓ Test 3: dispose() calls appServer.dispose() and clears state');
  }

  // Test 4: respondToApproval() calls sendApprovalResponse() with correct decision
  {
    const runtime = new CodexRuntime();
    injectMocks(runtime);
    // Seed the request id map so translation works
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._requestIdMap.set('codex-42', 42);
    let capturedId: unknown;
    let capturedDecision: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._appServer = {
      ...mockAppServer,
      sendApprovalResponse: (id: unknown, decision: string) => {
        capturedId = id;
        capturedDecision = decision;
      },
    };
    runtime.respondToApproval('codex-42', true, false);
    assert.strictEqual(capturedId, 42, 'respondToApproval must resolve to original server id');
    assert.strictEqual(capturedDecision, 'accept', 'approved=true must map to "accept"');
    console.log('✓ Test 4: respondToApproval() maps to sendApprovalResponse()');
  }

  // Test 5: respondToApproval() maps approved=false to "decline"
  {
    const runtime = new CodexRuntime();
    injectMocks(runtime);
    let capturedDecision: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._appServer = {
      ...mockAppServer,
      sendApprovalResponse: (_id: unknown, decision: string) => { capturedDecision = decision; },
    };
    runtime.respondToApproval('unknown-id', false, false);
    assert.strictEqual(capturedDecision, 'decline', 'approved=false must map to "decline"');
    console.log('✓ Test 5: respondToApproval() approved=false maps to "decline"');
  }

  console.log('\nAll 5 CodexRuntime tests passed!');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
