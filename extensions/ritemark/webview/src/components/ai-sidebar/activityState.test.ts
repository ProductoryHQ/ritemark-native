/**
 * Sprint 103 R7 (#161) — activity-state derivation tests, plus the R8
 * two-axis policy migration (policyOf).
 */
import assert from 'node:assert/strict';
import { deriveActivityState, presentActivityState, formatSeconds } from './activityState';
import { createConversationState, policyOf } from './conversationState';
import { decodeRuntimeRetry } from './lifecycle';
import type { ConversationState } from './conversationState';
import type { AgentConversationTurn, CodexConversationTurn } from './types';

function conv(partial: Partial<ConversationState>): ConversationState {
  return { ...createConversationState('c1'), ...partial };
}

function agentTurn(partial: Partial<AgentConversationTurn>): AgentConversationTurn {
  return {
    id: 't1', conversationId: 'c1', userPrompt: 'p', activities: [], isRunning: false,
    timestamp: 1000, ...partial,
  } as AgentConversationTurn;
}

function codexTurn(partial: Partial<CodexConversationTurn>): CodexConversationTurn {
  return {
    id: 'x1', conversationId: 'c1', userPrompt: 'p', requestedPlanMode: false,
    streamingText: '', activities: [], executionContinuation: false,
    requiresPlanReview: false, planText: '', planSteps: [], planHandled: false,
    isRunning: false, timestamp: 1000, ...partial,
  } as CodexConversationTurn;
}

// idle
assert.equal(deriveActivityState(conv({})), 'idle');

// Sprint 139 (#376, Sprint 140's QA): a stop is Stopped, never Failed — live and after a restart, for all three AIs.
assert.equal(deriveActivityState(conv({ codexConversation: [codexTurn({ result: { status: 'interrupted' } })] })), 'cancelled', 'ChatGPT/OpenCode live stop');
assert.equal(deriveActivityState(conv({ codexConversation: [codexTurn({ result: { status: 'cancelled' } })] })), 'cancelled', 'ChatGPT/OpenCode restored stop (it read Failed)');
assert.equal(deriveActivityState(conv({ agentConversation: [agentTurn({ result: { text: '', filesModified: [], stopped: true } })] })), 'cancelled', 'Claude stop, live or restored');
assert.equal(
  deriveActivityState(conv({ agentConversation: [agentTurn({ result: { text: '', filesModified: [], stopped: true } })], backgroundTasks: [{ taskId: 't' }] as never })),
  'stopped-background',
);
assert.equal(deriveActivityState(conv({ codexConversation: [codexTurn({ result: { status: 'failed', error: 'x' } })] })), 'failed', 'a real failure is still Failed');

// running
assert.equal(
  deriveActivityState(conv({ agentConversation: [agentTurn({ isRunning: true })] })),
  'running',
);

// waiting states outrank running (amber beats spinner)
assert.equal(
  deriveActivityState(conv({
    agentConversation: [agentTurn({ isRunning: true, pendingPlanApproval: { toolUseId: 'tu', plan: '# p' } })],
  })),
  'plan-review',
  'R7: pending plan review is never reported as mere running',
);
assert.equal(
  deriveActivityState(conv({
    agentConversation: [agentTurn({ isRunning: true, pendingQuestion: { toolUseId: 'tq', questions: [] } as never })],
  })),
  'waiting-input',
);

// Codex: turn completed but plan review pending must NOT read as done (audit F5/F9 class)
assert.equal(
  deriveActivityState(conv({
    codexConversation: [codexTurn({ requiresPlanReview: true, planHandled: false, result: { status: 'success' } })],
  })),
  'plan-review',
  'R7: "Done" is gated on no pending cards',
);

// done / failed / cancelled
assert.equal(
  deriveActivityState(conv({
    agentConversation: [agentTurn({ result: { text: 'ok', filesModified: [], metrics: { durationMs: 1000, costUsd: null, model: null } } })],
  })),
  'done',
);
assert.equal(
  deriveActivityState(conv({
    agentConversation: [agentTurn({ result: { text: '', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null }, error: 'boom' } })],
  })),
  'failed',
);
assert.equal(
  deriveActivityState(conv({
    agentConversation: [agentTurn({ result: { text: '', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null }, error: 'Execution cancelled' } })],
  })),
  'cancelled',
);

// Live-caught regression (dev matrix 2026-08-04): a CANCELLED plan turn must
// read as cancelled, never stay "plan-review" forever.
assert.equal(
  deriveActivityState(conv({
    agentConversation: [agentTurn({
      isPlan: true, planHandled: false,
      result: { text: '', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null }, error: 'Execution cancelled' },
    })],
  })),
  'cancelled',
);
// …and an interrupted Codex plan turn must not wait for review either.
assert.equal(
  deriveActivityState(conv({
    codexConversation: [codexTurn({ requiresPlanReview: true, planHandled: false, result: { status: 'interrupted', error: 'Cancelled by user' } })],
  })),
  'cancelled',
);

// presentation: done label carries active seconds; idle renders nothing
assert.equal(presentActivityState('idle'), null);
// Sprint 139 (#376): only "Failed", for every AI; the turn's one sentence is right above it.
assert.equal(presentActivityState('failed')!.label, 'Failed');
assert.equal(presentActivityState('failed')!.tone, 'red');
assert.match(presentActivityState('done', { activeSeconds: 92 })!.label, /1m 32s/);
assert.equal(presentActivityState('done', { activeSeconds: 0 })!.label, 'Done', '#488: no "Done in 0.0s"');
assert.equal(presentActivityState('done', {})!.label, 'Done');
assert.equal(presentActivityState('plan-review')!.tone, 'amber');

// formatSeconds
assert.equal(formatSeconds(5.4), '5.4s');
assert.equal(formatSeconds(92), '1m 32s');

// ── R8 migration: policyOf ──
assert.deepEqual(
  policyOf({ runtimeId: 'claude-code', modelId: '', mode: 'plan' }),
  { autonomy: 'auto', planFirst: true },
  "legacy 'plan' → Auto + Plan chip on",
);
assert.deepEqual(
  policyOf({ runtimeId: 'claude-code', modelId: '', mode: 'ask' }),
  { autonomy: 'ask', planFirst: false },
);
assert.deepEqual(
  policyOf({ runtimeId: 'codex', modelId: '', mode: 'auto', planFirst: true }),
  { autonomy: 'auto', planFirst: true },
);

// ── Sprint 143 (#544, R3a): the waiting line takes the working line's place, in amber ──
assert.deepEqual(
  presentActivityState('running', { liveActivity: 'Thinking...', retryLine: 'ChatGPT is busy. Trying again in 7 minutes.' }),
  { icon: 'clock', tone: 'amber', label: 'ChatGPT is busy. Trying again in 7 minutes.' },
);
assert.equal(presentActivityState('running', {})?.label, 'Working…', 'when the AI tries again, the working words come back');
{
  const now = 1_000_000;
  assert.deepEqual(decodeRuntimeRetry({ busy: true, retryAt: now + 419_000, attempt: 1, of: 5 }, now), { busy: true, retryAt: now + 419_000, attempt: 1, of: 5 });
  assert.deepEqual(decodeRuntimeRetry({ busy: true, retryAt: now + 5 * 3_600_000 }, now), { busy: true }, 'a wait hours away is nonsense, not counted');
  assert.deepEqual(decodeRuntimeRetry({ busy: false, attempt: 'x' }, now), { busy: false });
  assert.equal(decodeRuntimeRetry({ attempt: 1 }, now), null);
}

console.log('activityState + policyOf tests passed.');
