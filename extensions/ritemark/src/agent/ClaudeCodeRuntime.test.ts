/**
 * Tests for ClaudeCodeRuntime.
 *
 * Run: npx tsx src/agent/ClaudeCodeRuntime.test.ts
 *
 * Uses private-field patching to inject a mock AgentSession so tests run
 * without spawning the actual Claude Code binary.
 */

import * as assert from 'assert';
import { ClaudeCodeRuntime } from './ClaudeCodeRuntime';
import type { AgentRuntime, RuntimeSessionConfig } from '../runtime/AgentRuntime';

// ── Mock AgentSession ────────────────────────────────────────────────────────

const calls: string[] = [];

const mockSession = {
  isActive: false,
  onModelsDiscovered: null as unknown,
  setMcpServers: (_servers: unknown) => {},
  setAllowedTools: (_tools: string[]) => {},
  sendMessage: async (opts: {
    prompt: string;
    onProgress?: (p: { type: string; message: string; timestamp: number }) => void;
    onPlanApproval?: (r: unknown) => void;
    onQuestion?: (q: unknown) => void;
  }) => {
    calls.push('sendMessage');
    opts.onProgress?.({ type: 'done', message: 'ok', timestamp: Date.now() });
    return { text: 'ok', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null } };
  },
  interrupt: () => { calls.push('interrupt'); },
  close: () => { calls.push('close'); },
  answerPlanApproval: (_toolUseId: string, _approved: boolean): boolean => false,
  answerQuestion: (_toolUseId: string, _answers: Record<string, string>): boolean => false,
};

function injectMockSession(runtime: ClaudeCodeRuntime): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (runtime as any)._session = mockSession;
}

function injectConfig(runtime: ClaudeCodeRuntime, config: RuntimeSessionConfig): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (runtime as any)._sessionConfig = config;
}

const dummyConfig: RuntimeSessionConfig = {
  workspacePath: '/tmp/test',
  onProgress: () => {},
  onApprovalRequest: () => {},
};

// ── Tests ────────────────────────────────────────────────────────────────────

async function run() {
  // Test 1: ClaudeCodeRuntime structurally satisfies AgentRuntime
  {
    const runtime: AgentRuntime = new ClaudeCodeRuntime();
    assert.strictEqual(runtime.id, 'claude-code', 'id must be "claude-code"');
    console.log('✓ Test 1: id is "claude-code"');
  }

  // Test 2: start() creates an AgentSession (constructor is side-effect-free)
  {
    const runtime = new ClaudeCodeRuntime();
    await runtime.start(dummyConfig);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (runtime as any)._session;
    assert.ok(session !== null, 'start() must create a session');
    session.close(); // cleanup without triggering real process start
    console.log('✓ Test 2: start() creates an AgentSession');
  }

  // Test 3: cancel() calls session.interrupt()
  {
    const runtime = new ClaudeCodeRuntime();
    calls.length = 0;
    injectMockSession(runtime);
    injectConfig(runtime, dummyConfig);
    await runtime.cancel();
    assert.ok(calls.includes('interrupt'), 'cancel() must call session.interrupt()');
    console.log('✓ Test 3: cancel() calls session.interrupt()');
  }

  // Test 4: dispose() calls session.close()
  {
    const runtime = new ClaudeCodeRuntime();
    calls.length = 0;
    injectMockSession(runtime);
    runtime.dispose();
    assert.ok(calls.includes('close'), 'dispose() must call session.close()');
    console.log('✓ Test 4: dispose() calls session.close()');
  }

  // Test 5: dispose() clears pending questions
  {
    const runtime = new ClaudeCodeRuntime();
    injectMockSession(runtime);
    injectConfig(runtime, dummyConfig);
    // Manually push a pending question
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._pendingQuestions.set('q1', {
      toolUseId: 'q1',
      questions: [{ header: 'h', question: 'q', options: [{ label: 'yes', description: '' }], multiSelect: false }],
    });
    runtime.dispose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.strictEqual((runtime as any)._pendingQuestions.size, 0, 'dispose() must clear pending questions');
    console.log('✓ Test 5: dispose() clears pending questions');
  }

  // Test 6: respondToApproval() routes plan approval to answerPlanApproval()
  {
    const runtime = new ClaudeCodeRuntime();
    let planApprovalToolUseId: string | null = null;
    let planApprovalDecision: boolean | null = null;
    const sessionWithPlanApproval = {
      ...mockSession,
      answerPlanApproval: (toolUseId: string, approved: boolean): boolean => {
        planApprovalToolUseId = toolUseId;
        planApprovalDecision = approved;
        return true; // signal handled
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (runtime as any)._session = sessionWithPlanApproval;
    injectConfig(runtime, dummyConfig);
    runtime.respondToApproval('plan-123', true, false);
    assert.strictEqual(planApprovalToolUseId, 'plan-123', 'respondToApproval must pass requestId as toolUseId');
    assert.strictEqual(planApprovalDecision, true, 'respondToApproval must pass approved flag');
    console.log('✓ Test 6: respondToApproval() routes plan approval correctly');
  }

  console.log('\nAll 6 ClaudeCodeRuntime tests passed!');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
