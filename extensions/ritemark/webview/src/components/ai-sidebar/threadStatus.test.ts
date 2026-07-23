/**
 * Sprint 99 (R6 / R8 / R11 / E6) — thread rail logic tests.
 *
 * These cover the four rules most likely to be quietly lost in a refactor:
 *   1. auto-title truncation (Resolved Gap 1)
 *   2. amber beats spinner, and idle carries no badge (R8)
 *   3. the soft cap is ADVISORY — including the case where nothing is idle
 *      to close, which must still allow the thread (Resolved Gap 2)
 *   4. a thread holding a queued prompt is not closable (Resolved Gap 4)
 *
 * Run with: npx tsx webview/src/components/ai-sidebar/threadStatus.test.ts
 */
import assert from 'node:assert/strict';
import { createConversationState, type ConversationState } from './conversationState';
import {
  NEW_THREAD_TITLE,
  SOFT_THREAD_CAP,
  THREAD_TITLE_MAX_CHARS,
  canCloseThread,
  deriveThreadStatus,
  deriveThreadTitle,
  evaluateSoftCap,
  runtimeOfConversation,
  threadTooltip,
  truncateThreadTitle,
  type CapCandidate,
} from './threadStatus';
import type { AgentConversationTurn, CodexConversationTurn } from './types';

function agentTurn(overrides: Partial<AgentConversationTurn> = {}): AgentConversationTurn {
  return {
    id: 'a1',
    userPrompt: 'Do the thing',
    activities: [],
    isRunning: false,
    isPlan: false,
    planHandled: false,
    timestamp: 1,
    ...overrides,
  };
}

function codexTurn(overrides: Partial<CodexConversationTurn> = {}): CodexConversationTurn {
  return {
    id: 'c1',
    userPrompt: 'Do the other thing',
    streamingText: '',
    activities: [],
    isRunning: false,
    timestamp: 1,
    ...overrides,
  };
}

function conversation(overrides: Partial<ConversationState> = {}): ConversationState {
  return createConversationState('conv-1', overrides);
}

// ── 1. Auto-title truncation (Resolved Gap 1) ────────────────────────────

{
  // A prompt inside the budget is used verbatim — no ellipsis, no reformatting.
  assert.equal(truncateThreadTitle('Translate memo to ET'), 'Translate memo to ET');

  // Whitespace is normalised so a multi-line prompt does not produce a title
  // with newlines in it.
  assert.equal(truncateThreadTitle('  Translate\n  memo   to ET  '), 'Translate memo to ET');

  // First sentence wins when it comes before the character budget.
  assert.equal(
    truncateThreadTitle('Review the open issues. Then suggest a sprint plan for next week.'),
    'Review the open issues…',
  );

  // Over the budget with no sentence break → cut on a WORD boundary, ellipsis.
  const long = 'Please translate the entire ERGO Baltic memorandum into Estonian and keep every inline comment intact';
  const cut = truncateThreadTitle(long);
  assert.ok(cut.endsWith('…'), 'a truncated title ends with an ellipsis');
  assert.ok(cut.length <= THREAD_TITLE_MAX_CHARS + 1, `title stays within budget, got ${cut.length}`);
  assert.ok(!cut.slice(0, -1).endsWith(' '), 'no trailing space before the ellipsis');
  // The cut must land between words, never mid-word.
  assert.ok(long.startsWith(cut.slice(0, -1)), 'the title is a prefix of the prompt');
  assert.ok(long[cut.length - 1] === ' ', 'the cut lands on a word boundary');

  // A single word longer than the budget has no boundary to break on.
  const oneWord = 'x'.repeat(120);
  assert.equal(truncateThreadTitle(oneWord).length, THREAD_TITLE_MAX_CHARS + 1);

  // Empty / whitespace-only prompts fall back rather than producing "…".
  assert.equal(truncateThreadTitle('   '), NEW_THREAD_TITLE);

  // Titles come from the FIRST prompt of the thread, across both transcripts.
  assert.equal(deriveThreadTitle(conversation()), NEW_THREAD_TITLE);
  assert.equal(
    deriveThreadTitle(conversation({
      agentConversation: [agentTurn({ userPrompt: 'Second', timestamp: 20 })],
      codexConversation: [codexTurn({ userPrompt: 'First', timestamp: 10 })],
    })),
    'First',
  );
}

// ── 2. Status derivation (R8) ────────────────────────────────────────────

{
  // Idle = no turn in flight, nothing pending. The rail shows no badge.
  assert.equal(deriveThreadStatus(conversation()), 'idle');
  assert.equal(deriveThreadStatus(conversation({ agentConversation: [agentTurn()] })), 'idle');

  // Running = a turn is in flight and nothing is blocked on the user.
  assert.equal(
    deriveThreadStatus(conversation({ agentConversation: [agentTurn({ isRunning: true })] })),
    'running',
  );
  assert.equal(
    deriveThreadStatus(conversation({ codexConversation: [codexTurn({ isRunning: true })] })),
    'running',
  );

  // AMBER OVERRIDES SPINNER. This is the sprint's trust story: a turn that is
  // technically mid-flight but waiting on the user reports attention, never
  // running — the urgent information is the blockage, not the progress.
  const runningAndBlocked = conversation({
    agentConversation: [agentTurn({
      isRunning: true,
      approval: { approvalType: 'command', requestId: 'req-1', command: 'rm -rf build' },
    })],
  });
  assert.equal(deriveThreadStatus(runningAndBlocked), 'attention');

  // Every amber source listed in design.md §5 maps to attention.
  const amberCases: Array<[string, ConversationState]> = [
    ['claude approval', conversation({ agentConversation: [agentTurn({ approval: { approvalType: 'fileChange', requestId: 'r' } })] })],
    ['claude question', conversation({ agentConversation: [agentTurn({ pendingQuestion: { questions: [] } as never })] })],
    ['claude plan review', conversation({ agentConversation: [agentTurn({ isPlan: true, planHandled: false })] })],
    ['codex approval', conversation({ codexConversation: [codexTurn({ approval: { approvalType: 'command', requestId: 2 } })] })],
    ['codex question', conversation({ codexConversation: [codexTurn({ pendingQuestion: { requestId: 3, questions: [] } })] })],
    ['codex plan review', conversation({ codexConversation: [codexTurn({ requiresPlanReview: true, planHandled: false })] })],
  ];
  for (const [label, state] of amberCases) {
    assert.equal(deriveThreadStatus(state), 'attention', `${label} must read as attention`);
  }

  // Resolving the pending item drops the thread back to running or idle.
  assert.equal(
    deriveThreadStatus(conversation({ agentConversation: [agentTurn({ isPlan: true, planHandled: true, isRunning: true })] })),
    'running',
  );
  assert.equal(
    deriveThreadStatus(conversation({ agentConversation: [agentTurn({ isPlan: true, planHandled: true })] })),
    'idle',
  );

  // Multiple pending items are still ONE signal — status is a single value, so
  // there is nowhere for a count to leak onto the rail.
  const manyPending = conversation({
    agentConversation: [
      agentTurn({ id: 'a1', approval: { approvalType: 'command', requestId: 'r1' } }),
      agentTurn({ id: 'a2', approval: { approvalType: 'command', requestId: 'r2' } }),
    ],
  });
  assert.equal(deriveThreadStatus(manyPending), 'attention');
}

// ── 3. Runtime binding (R9) ──────────────────────────────────────────────

{
  assert.equal(runtimeOfConversation(conversation()), 'claude');
  assert.equal(
    runtimeOfConversation(conversation({ pendingRuntime: { runtimeId: 'codex', modelId: '', mode: 'auto' } })),
    'codex',
  );
  assert.equal(
    runtimeOfConversation(conversation({ codexConversation: [codexTurn({ runtime: 'opencode' })] })),
    'opencode',
  );
  assert.equal(
    runtimeOfConversation(conversation({ codexConversation: [codexTurn()] })),
    'codex',
  );
}

// ── 4. Closing (R11 + Resolved Gap 4) ────────────────────────────────────

{
  assert.equal(canCloseThread('idle', false), true, 'an idle thread offers the close ×');
  assert.equal(canCloseThread('running', false), false, 'a running thread must not be closable');
  assert.equal(canCloseThread('attention', false), false, 'an approval-waiting thread must not be closable');
  // Resolved Gap 4: a queued prompt is unsent work the user already typed.
  // Closing would silently discard it, so the affordance is withheld.
  assert.equal(canCloseThread('idle', true), false, 'a queued prompt makes an idle thread un-closable');

  assert.equal(threadTooltip('Translate memo', 'attention', false), 'Translate memo — needs you');
  assert.equal(threadTooltip('Translate memo', 'running', false), 'Translate memo — running');
  assert.equal(threadTooltip('Translate memo', 'idle', false), 'Translate memo — idle');
  assert.equal(threadTooltip('Translate memo', 'idle', true), 'Translate memo — prompt queued');
}

// ── 5. Soft cap (R11 + Resolved Gaps 2 and 3) ────────────────────────────

{
  const candidate = (id: string, status: CapCandidate['status'], hasQueuedPrompt = false): CapCandidate =>
    ({ id, title: id, status, hasQueuedPrompt });

  // Under the cap: no prompt, no friction.
  const under = evaluateSoftCap([candidate('a', 'idle'), candidate('b', 'running')]);
  assert.equal(under.atCap, false);
  assert.deepEqual(under.closable, []);
  assert.equal(under.allowAnyway, false);

  // Exactly one below the cap is still under it.
  const justUnder = evaluateSoftCap(
    Array.from({ length: SOFT_THREAD_CAP - 1 }, (_, i) => candidate(`t${i}`, 'running')),
  );
  assert.equal(justUnder.atCap, false);

  // At the cap WITH idle threads: prompt the user, offering those to close.
  const withIdle = evaluateSoftCap([
    candidate('t0', 'running'),
    candidate('t1', 'idle'),
    candidate('t2', 'attention'),
    candidate('t3', 'idle'),
    candidate('t4', 'running'),
  ]);
  assert.equal(withIdle.atCap, true);
  assert.deepEqual(withIdle.closable.map((c) => c.id), ['t1', 't3']);
  assert.equal(withIdle.allowAnyway, false);

  // At the cap with NOTHING idle — the case the design had to resolve. The cap
  // stays advisory: we allow the thread anyway rather than telling the user
  // they cannot start work because their other work is still running.
  const nothingIdle = evaluateSoftCap([
    candidate('t0', 'running'),
    candidate('t1', 'running'),
    candidate('t2', 'attention'),
    candidate('t3', 'attention'),
    candidate('t4', 'running'),
  ]);
  assert.equal(nothingIdle.atCap, true);
  assert.deepEqual(nothingIdle.closable, []);
  assert.equal(nothingIdle.allowAnyway, true, 'the soft cap must never hard-block the user');

  // A thread holding a queued prompt is not offered as closable either.
  const queuedOnly = evaluateSoftCap([
    candidate('t0', 'running'),
    candidate('t1', 'idle', true),
    candidate('t2', 'idle', true),
    candidate('t3', 'running'),
    candidate('t4', 'attention'),
  ]);
  assert.equal(queuedOnly.atCap, true);
  assert.deepEqual(queuedOnly.closable, []);
  assert.equal(queuedOnly.allowAnyway, true);

  // Over the cap (reached via "open anyway") still evaluates as at-cap.
  const over = evaluateSoftCap(
    Array.from({ length: SOFT_THREAD_CAP + 2 }, (_, i) => candidate(`t${i}`, 'idle')),
  );
  assert.equal(over.atCap, true);
  assert.equal(over.closable.length, SOFT_THREAD_CAP + 2);
}

console.log('threadStatus.test.ts: all assertions passed');
