/**
 * Unit tests for AgentDaemon.
 * Run: npx tsx src/daemon/AgentDaemon.test.ts
 *
 * Tests run entirely outside VS Code — no vscode module is imported.
 * All dependencies are faked with minimal structural mocks.
 */

import * as assert from 'assert';
import { AgentDaemon } from './AgentDaemon';
import { DaemonResultStore } from './DaemonResultStore';
import type { DaemonRunResult } from './DaemonResultStore';
import { RuntimeRegistry } from '../runtime/RuntimeRegistry';
import type { AgentRuntime, RuntimeSessionConfig, UnifiedApprovalRequest } from '../runtime/AgentRuntime';
import type { AgentId } from '../agent/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockRuntime extends AgentRuntime {
  lastStartConfig: RuntimeSessionConfig | null;
}

function makeMockRuntime(
  agentId: AgentId,
  overrides: Partial<AgentRuntime> = {}
): MockRuntime {
  const mock: MockRuntime = {
    id: agentId,
    lastStartConfig: null,
    start: async (config: RuntimeSessionConfig): Promise<void> => {
      mock.lastStartConfig = config;
    },
    prompt: async (): Promise<void> => {},
    cancel: async (): Promise<void> => {},
    respondToApproval: (_requestId: string, _approved: boolean, _alwaysAllow: boolean): void => {},
    getStatus: async () => ({
      ready: true,
      authState: 'authenticated' as const,
      diagnostics: [],
    }),
    dispose: (): void => {},
    ...overrides,
  };
  return mock;
}

/** Flushes all pending microtasks so fire-and-forget async functions complete. */
async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0));
}

// ---------------------------------------------------------------------------
// Test 1: register() starts scheduling
// ---------------------------------------------------------------------------

async function testRegisterStartsScheduling(): Promise<void> {
  const runtime = makeMockRuntime('claude-code');
  const registry = new RuntimeRegistry(
    new Map<AgentId, AgentRuntime>([['claude-code', runtime]])
  );
  const daemon = new AgentDaemon(registry);

  // Not registered yet — tick should be a no-op.
  await daemon.tick(new Date(2024, 0, 1, 12, 1, 30));
  await flushMicrotasks();
  assert.strictEqual(
    runtime.lastStartConfig,
    null,
    'start() must not be called before register()'
  );

  // After register(), a tick for an every-minute cron should trigger a run.
  daemon.register('claude-code', '* * * * *', '/workspace');
  await daemon.tick(new Date(2024, 0, 1, 12, 2, 15));
  await flushMicrotasks();
  assert.notStrictEqual(
    runtime.lastStartConfig,
    null,
    'start() must be called after register() on a due tick'
  );

  daemon.dispose();
  console.log('  ✓ register() starts scheduling');
}

// ---------------------------------------------------------------------------
// Test 2: unregister() stops scheduling
// ---------------------------------------------------------------------------

async function testUnregisterStopsScheduling(): Promise<void> {
  const runtime = makeMockRuntime('claude-code');
  const registry = new RuntimeRegistry(
    new Map<AgentId, AgentRuntime>([['claude-code', runtime]])
  );
  const daemon = new AgentDaemon(registry);

  daemon.register('claude-code', '* * * * *', '/workspace');
  daemon.unregister('claude-code');

  // Tick after unregister — the entry is gone, run must not fire.
  await daemon.tick(new Date(2024, 0, 1, 12, 2, 15));
  await flushMicrotasks();
  assert.strictEqual(
    runtime.lastStartConfig,
    null,
    'start() must not be called after unregister()'
  );

  daemon.dispose();
  console.log('  ✓ unregister() stops scheduling');
}

// ---------------------------------------------------------------------------
// Test 3: headless policy blocks file-write (and shell-command) approvals
// ---------------------------------------------------------------------------

async function testHeadlessPolicyBlocksFileWrite(): Promise<void> {
  let capturedApprovalHandler: ((req: UnifiedApprovalRequest) => void) | null = null;
  const respondCalls: Array<{ requestId: string; approved: boolean }> = [];

  const runtime = makeMockRuntime('claude-code', {
    start: async (config: RuntimeSessionConfig): Promise<void> => {
      capturedApprovalHandler = config.onApprovalRequest;
    },
    respondToApproval: (requestId: string, approved: boolean): void => {
      respondCalls.push({ requestId, approved });
    },
  });

  const registry = new RuntimeRegistry(
    new Map<AgentId, AgentRuntime>([['claude-code', runtime]])
  );
  const daemon = new AgentDaemon(registry);
  daemon.register('claude-code', '* * * * *', '/workspace');

  await daemon.tick(new Date(2024, 0, 1, 12, 3, 20));
  await flushMicrotasks();

  assert.ok(
    capturedApprovalHandler !== null,
    'onApprovalRequest callback must be wired via start()'
  );

  // file-write → rejected
  capturedApprovalHandler!({
    requestId: 'req-file-1',
    agentId: 'claude-code',
    kind: 'file-write',
    filePath: '/workspace/output.md',
  });
  assert.strictEqual(respondCalls.length, 1);
  assert.strictEqual(respondCalls[0].approved, false, 'file-write must be rejected');
  assert.strictEqual(respondCalls[0].requestId, 'req-file-1');

  // shell-command → rejected
  respondCalls.length = 0;
  capturedApprovalHandler!({
    requestId: 'req-shell-1',
    agentId: 'claude-code',
    kind: 'shell-command',
    command: 'rm -rf /tmp/foo',
  });
  assert.strictEqual(respondCalls[0].approved, false, 'shell-command must be rejected');

  // permission → rejected
  respondCalls.length = 0;
  capturedApprovalHandler!({
    requestId: 'req-perm-1',
    agentId: 'claude-code',
    kind: 'permission',
    permissionLabel: 'network-access',
  });
  assert.strictEqual(respondCalls[0].approved, false, 'permission must be rejected');

  // plan → approved (read-only intent, safe to proceed)
  respondCalls.length = 0;
  capturedApprovalHandler!({
    requestId: 'req-plan-1',
    agentId: 'claude-code',
    kind: 'plan',
    planText: 'Read the workspace and summarise.',
  });
  assert.strictEqual(respondCalls[0].approved, true, 'plan must be auto-approved');

  daemon.dispose();
  console.log('  ✓ headless policy blocks file-write / shell-command / permission; approves plan');
}

// ---------------------------------------------------------------------------
// Test 4: DaemonResultStore records and retrieves results
// ---------------------------------------------------------------------------

async function testDaemonResultStore(): Promise<void> {
  const backingStore = new Map<string, unknown>();

  // Structural mock — matches ExtensionContextLike without importing vscode.
  const fakeContext = {
    workspaceState: {
      get<T>(key: string): T | undefined {
        return backingStore.get(key) as T | undefined;
      },
      update(key: string, value: unknown): Promise<void> {
        backingStore.set(key, value);
        return Promise.resolve();
      },
    },
  };

  // DaemonResultStore accepts any object that has the right workspaceState
  // shape.  The cast is safe because the structural interface matches exactly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = new DaemonResultStore(fakeContext as any);

  // Nothing stored yet.
  assert.strictEqual(
    store.getLastRun('claude-code'),
    undefined,
    'getLastRun must return undefined before any record()'
  );

  const result: DaemonRunResult = {
    agentId: 'claude-code',
    timestamp: 1700000000000,
    summary: 'Scheduled run completed successfully',
    success: true,
  };
  store.record('claude-code', result);

  const retrieved = store.getLastRun('claude-code');
  assert.deepStrictEqual(retrieved, result, 'getLastRun must return the recorded result');

  // Different agent IDs are isolated.
  assert.strictEqual(
    store.getLastRun('codex'),
    undefined,
    'different agentId must not share results'
  );

  // Failure result is also persisted correctly.
  const failResult: DaemonRunResult = {
    agentId: 'codex',
    timestamp: 1700000001000,
    summary: 'Runtime error: connection refused',
    success: false,
  };
  store.record('codex', failResult);
  assert.deepStrictEqual(store.getLastRun('codex'), failResult);

  console.log('  ✓ DaemonResultStore records and retrieves results correctly');
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Testing AgentDaemon...');

  await testRegisterStartsScheduling();
  await testUnregisterStopsScheduling();
  await testHeadlessPolicyBlocksFileWrite();
  await testDaemonResultStore();

  console.log('\n✅ All AgentDaemon tests passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
