/**
 * Conversation presentation and status logic tests.
 *
 * These cover the four rules most likely to be quietly lost in a refactor:
 *   1. auto-title truncation (Resolved Gap 1)
 *   2. amber beats spinner, and idle carries no badge (R8)
 *   3. runtime identity follows the latest real turn
 *
 * Run with: npx tsx webview/src/components/ai-sidebar/threadStatus.test.ts
 */
import assert from 'node:assert/strict';
import { createConversationState, type ConversationState } from './conversationState';
import {
  NEW_THREAD_TITLE,
  THREAD_TITLE_MAX_CHARS,
  deriveThreadStatus,
  deriveThreadTitle,
  runtimeOfConversation,
  threadTooltip,
  truncateThreadTitle,
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

// ── 4. Tooltip copy ──────────────────────────────────────────────────────

{
  assert.equal(threadTooltip('Translate memo', 'attention', false), 'Translate memo — needs you');
  assert.equal(threadTooltip('Translate memo', 'running', false), 'Translate memo — running');
  assert.equal(threadTooltip('Translate memo', 'idle', false), 'Translate memo — idle');
  assert.equal(threadTooltip('Translate memo', 'idle', true), 'Translate memo — prompt queued');
}

console.log('threadStatus.test.ts: all assertions passed');
