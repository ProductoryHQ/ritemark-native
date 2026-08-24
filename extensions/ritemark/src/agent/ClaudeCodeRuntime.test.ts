/**
 * Tests for ClaudeCodeRuntime.
 *
 * Run: npx tsx src/agent/ClaudeCodeRuntime.test.ts
 *
 * Uses private-field patching to inject a mock AgentSession so tests run
 * without spawning the actual Claude Code binary.
 */

import * as assert from 'assert';
import { ClaudeCodeRuntime, ClaudeCodeSession } from './ClaudeCodeRuntime';
import type { AgentRuntime, RuntimeSessionConfig } from '../runtime/AgentRuntime';

// ── Mock AgentSession ────────────────────────────────────────────────────────

const calls: string[] = [];
const capturedEfforts: string[] = [];

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
    thinkingEffort?: string;
    onThinkingEffortApplied?: (effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max') => void;
  }) => {
    calls.push('sendMessage');
    capturedEfforts.push(opts.thinkingEffort ?? 'auto');
    opts.onThinkingEffortApplied?.();
    opts.onProgress?.({ type: 'done', message: 'ok', timestamp: Date.now() });
    return { text: 'ok', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null } };
  },
  interrupt: () => { calls.push('interrupt'); },
  close: () => { calls.push('close'); },
  setApprovalMode: (_mode: string) => {},
  answerPlanApproval: (_toolUseId: string, _approved: boolean): boolean => false,
  answerToolApproval: (_toolUseId: string, _approved: boolean): boolean => false,
  answerQuestion: (_toolUseId: string, _answers: Record<string, string>): boolean => false,
};

/**
 * Build a ClaudeCodeSession without touching the real SDK.
 *
 * Sprint 99: per-conversation state moved from the runtime onto the session, so
 * the tests inject into a session rather than into the adapter.
 */
function makeSession(conversationId: string, session: unknown = mockSession): ClaudeCodeSession {
  const instance = Object.create(ClaudeCodeSession.prototype) as ClaudeCodeSession;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = instance as any;
  raw.conversationId = conversationId;
  raw.agentId = 'claude-code';
  raw._session = session;
  raw._config = dummyConfig;
  raw._pendingQuestions = new Map();
  return instance;
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

  // Test 2: cancel() interrupts only this session
  {
    calls.length = 0;
    const session = makeSession('conv-1');
    await session.cancel();
    assert.ok(calls.includes('interrupt'), 'cancel() must call session.interrupt()');
    console.log('✓ Test 2: cancel() interrupts the underlying AgentSession');
  }

  // Test 3: dispose() closes the session and clears its pending questions
  {
    calls.length = 0;
    const session = makeSession('conv-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session as any)._pendingQuestions.set('q1', {
      toolUseId: 'q1',
      questions: [{ header: 'h', question: 'q', options: [{ label: 'yes', description: '' }], multiSelect: false }],
    });
    session.dispose();
    assert.ok(calls.includes('close'), 'dispose() must call session.close()');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.strictEqual((session as any)._pendingQuestions.size, 0, 'dispose() must clear pending questions');
    console.log('✓ Test 3: dispose() closes the session and clears pending questions');
  }

  // Test 4: respondToApproval() routes plan approval to answerPlanApproval()
  {
    let planApprovalToolUseId: string | null = null;
    let planApprovalDecision: boolean | null = null;
    const session = makeSession('conv-1', {
      ...mockSession,
      answerPlanApproval: (toolUseId: string, approved: boolean): boolean => {
        planApprovalToolUseId = toolUseId;
        planApprovalDecision = approved;
        return true; // signal handled
      },
    });
    session.respondToApproval('plan-123', true, false);
    assert.strictEqual(planApprovalToolUseId, 'plan-123', 'respondToApproval must pass requestId as toolUseId');
    assert.strictEqual(planApprovalDecision, true, 'respondToApproval must pass approved flag');
    console.log('✓ Test 4: respondToApproval() routes plan approval correctly');
  }

  // Test 5: two conversations get INDEPENDENT sessions.
  // This is the whole point of Sprint 99 — disposing one must not disturb the
  // other, and neither may be handed the other's underlying AgentSession.
  {
    const runtime = new ClaudeCodeRuntime();
    const closedBy: string[] = [];
    const sessionA = makeSession('conv-a', { ...mockSession, close: () => closedBy.push('a') });
    const sessionB = makeSession('conv-b', { ...mockSession, close: () => closedBy.push('b') });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = (runtime as any)._sessions as Map<string, ClaudeCodeSession>;
    sessions.set('conv-a', sessionA);
    sessions.set('conv-b', sessionB);

    assert.notStrictEqual(runtime.getSession('conv-a'), runtime.getSession('conv-b'),
      'each conversation must get its own session');

    runtime.disposeSession('conv-a');
    assert.deepStrictEqual(closedBy, ['a'], 'disposing conv-a must not close conv-b');
    assert.strictEqual(runtime.getSession('conv-a'), undefined, 'conv-a must be gone');
    assert.ok(runtime.getSession('conv-b'), 'conv-b must still be live');

    runtime.dispose();
    assert.deepStrictEqual(closedBy, ['a', 'b'], 'runtime dispose must close remaining sessions');
    console.log('✓ Test 5: conversations hold independent sessions');
  }

  // Test 6: an SDK result error remains a failed turn at the runtime boundary.
  {
    let completedError: string | undefined;
    const session = makeSession('conv-error', {
      ...mockSession,
      sendMessage: async () => ({
        text: '',
        filesModified: [],
        metrics: { durationMs: 0, costUsd: null, model: null },
        error: 'resume rejected',
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session as any)._config = {
      ...dummyConfig,
      onComplete: (result: { error?: string }) => { completedError = result.error; },
    };
    await session.prompt({ prompt: 'Continue safely' });
    assert.strictEqual(completedError, 'resume rejected');
    console.log('✓ Test 6: SDK result errors remain failed turns');
  }

  // Sprint 112: the immutable turn effort reaches AgentSession and applied
  // evidence is surfaced through the shared runtime callback.
  {
    capturedEfforts.length = 0;
    const applied: Array<{ requested: string; applied?: string }> = [];
    const session = makeSession('conv-effort');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session as any)._config = {
      ...dummyConfig,
      onThinkingEffortApplied: (result: { requested: string; applied?: string }) => applied.push(result),
    };
    const advertised = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
    for (const effort of advertised) {
      await session.prompt({ prompt: `Use ${effort}`, thinkingEffort: effort });
    }
    assert.deepStrictEqual(capturedEfforts, advertised);
    assert.deepStrictEqual(applied, advertised.map((requested) => ({ requested, adjusted: false })));
    console.log('✓ Test 7: every advertised Claude effort reaches the SDK without inventing an applied value');
  }

  console.log('\nAll 7 ClaudeCodeRuntime tests passed!');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
