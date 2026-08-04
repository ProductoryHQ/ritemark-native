/**
 * Sprint 103 R7 (#161) — activity-state derivation tests, plus the R8
 * two-axis policy migration (policyOf).
 */
import assert from 'node:assert/strict';
import { deriveActivityState, presentActivityState, formatSeconds } from './activityState';
import { createConversationState, policyOf } from './conversationState';
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
assert.match(presentActivityState('done', { activeSeconds: 92 })!.label, /1m 32s/);
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

console.log('activityState + policyOf tests passed.');
