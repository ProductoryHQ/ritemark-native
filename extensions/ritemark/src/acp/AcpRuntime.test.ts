/**
 * Tests for AcpRuntime.
 *
 * Run: npx tsx src/acp/AcpRuntime.test.ts
 *
 * Uses private-field patching to inject a mock AcpManager so tests run
 * without spawning the OpenCode binary.
 */

import * as assert from 'assert';
import { AcpRuntime } from './AcpRuntime';
import type { AgentRuntime, RuntimeSessionConfig } from '../runtime/AgentRuntime';

// ── Mock AcpManager ──────────────────────────────────────────────────────────

const calls: string[] = [];

const mockManager = {
  isRunning: () => true,
  currentSessionId: 'ses-1',
  start: async () => { calls.push('start'); return 'ses-1'; },
  prompt: async (_text: string) => {
    calls.push('prompt');
    return { stopReason: 'end_turn', usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 } };
  },
  setModel: async (_model: string) => { calls.push('setModel'); },
  cancel: async () => { calls.push('cancel'); },
  dispose: () => { calls.push('dispose'); },
};

function injectMocks(runtime: AcpRuntime, config?: RuntimeSessionConfig): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = runtime as any;
  r._manager = mockManager;
  r._sessionConfig = config ?? dummyConfig;
}

const dummyConfig: RuntimeSessionConfig = {
  workspacePath: '/tmp/test',
  onProgress: () => {},
  onApprovalRequest: () => {},
};

// ── Tests ────────────────────────────────────────────────────────────────────

async function run() {
  // Test 1: AcpRuntime structurally satisfies AgentRuntime
  {
    const runtime: AgentRuntime = new AcpRuntime();
    assert.strictEqual(runtime.id, 'opencode', 'id must be "opencode"');
    console.log('✓ Test 1: id is "opencode"');
  }

  // Test 2: cancel() calls manager.cancel() and nulls out _manager
  {
    const runtime = new AcpRuntime();
    calls.length = 0;
    injectMocks(runtime);
    await runtime.cancel();
    assert.ok(calls.includes('cancel'), 'cancel() must call manager.cancel()');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.strictEqual((runtime as any)._manager, null, 'cancel() must null _manager');
    console.log('✓ Test 2: cancel() calls manager.cancel() and nulls _manager');
  }

  // Test 3: dispose() calls manager.dispose()
  {
    const runtime = new AcpRuntime();
    calls.length = 0;
    injectMocks(runtime);
    runtime.dispose();
    assert.ok(calls.includes('dispose'), 'dispose() must call manager.dispose()');
    console.log('✓ Test 3: dispose() calls manager.dispose()');
  }

  // Test 4: respondToApproval() resolves a pending approval promise
  {
    const runtime = new AcpRuntime();
    injectMocks(runtime);

    let capturedApproved: boolean | null = null;
    let capturedAlwaysAllow: boolean | null = null;

    // Seed a pending approval directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._pendingApprovals.set('req-1', (result: { approved: boolean; alwaysAllow: boolean }) => {
      capturedApproved = result.approved;
      capturedAlwaysAllow = result.alwaysAllow;
    });

    runtime.respondToApproval('req-1', true, true);
    assert.strictEqual(capturedApproved, true, 'respondToApproval must pass approved');
    assert.strictEqual(capturedAlwaysAllow, true, 'respondToApproval must pass alwaysAllow');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.strictEqual((runtime as any)._pendingApprovals.size, 0, 'must remove resolved entry');
    console.log('✓ Test 4: respondToApproval() resolves pending approval');
  }

  // Test 5: dispose() rejects all pending approvals (approved=false)
  {
    const runtime = new AcpRuntime();
    injectMocks(runtime);

    const results: boolean[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._pendingApprovals.set('p1', (r: { approved: boolean }) => results.push(r.approved));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._pendingApprovals.set('p2', (r: { approved: boolean }) => results.push(r.approved));

    runtime.dispose();
    assert.strictEqual(results.length, 2, 'dispose() must resolve all pending approvals');
    assert.ok(results.every(v => v === false), 'dispose() must reject approvals with approved=false');
    console.log('✓ Test 5: dispose() rejects all pending approvals');
  }

  // Test 6: prompt() calls setModel and manager.prompt()
  {
    const runtime = new AcpRuntime();
    calls.length = 0;
    injectMocks(runtime, { ...dummyConfig, model: 'openai/gpt-4o' });
    await runtime.prompt({ prompt: 'Hello' });
    assert.ok(calls.includes('setModel'), 'prompt() must call setModel when config.model is set');
    assert.ok(calls.includes('prompt'), 'prompt() must call manager.prompt()');
    console.log('✓ Test 6: prompt() calls setModel and manager.prompt()');
  }

  console.log('\nAll 6 AcpRuntime tests passed!');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
