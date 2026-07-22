/**
 * Sprint 99 (R5 / E1–E3) — multi-conversation store tests.
 *
 * The Phase 1 gate: two conversations coexist in the store and inbound messages
 * land in the right one. The load-bearing rule is that a message for an UNKNOWN
 * conversation is dropped, never misrouted onto whatever the user happens to be
 * looking at.
 *
 * Run with: npx tsx webview/src/components/ai-sidebar/conversationRouting.test.ts
 */
import assert from 'node:assert/strict';
import { useAISidebarStore, hydrateConversations, selectActiveConversation } from './store';
import { createConversationState, type ConversationState } from './conversationState';
import { resetConversationRoutingWarnings } from './conversationRouting';
import { vscode } from '../../lib/vscode';
import type { AgentConversationTurn, CodexConversationTurn } from './types';

const initialState = useAISidebarStore.getState();

function resetStore(): void {
  useAISidebarStore.setState(initialState, true);
  resetConversationRoutingWarnings();
}

function makeAgentTurn(overrides: Partial<AgentConversationTurn> = {}): AgentConversationTurn {
  return {
    id: 'agent-turn',
    userPrompt: 'Do the task',
    activities: [],
    isRunning: true,
    isPlan: false,
    planHandled: false,
    timestamp: 1,
    ...overrides,
  };
}

function makeCodexTurn(overrides: Partial<CodexConversationTurn> = {}): CodexConversationTurn {
  return {
    id: 'codex-turn',
    userPrompt: 'Do the task',
    streamingText: '',
    activities: [],
    planText: '',
    planSteps: [],
    planHandled: false,
    isRunning: true,
    timestamp: 1,
    executionContinuation: false,
    requiresPlanReview: false,
    ...overrides,
  };
}

/** Two open threads: "A" is active, "B" runs in the background. */
function seedTwoConversations(
  a: Partial<ConversationState> = {},
  b: Partial<ConversationState> = {},
): { a: ConversationState; b: ConversationState } {
  const convA = createConversationState('conv-a', a);
  const convB = createConversationState('conv-b', b);
  hydrateConversations([convA, convB], convA.id);
  return { a: convA, b: convB };
}

function silenceConsoleWarn(): { warnings: string[]; restore: () => void } {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
  return { warnings, restore: () => { console.warn = original; } };
}

function capturePostedMessages(): { posted: Array<Record<string, unknown>>; restore: () => void } {
  const posted: Array<Record<string, unknown>> = [];
  const original = vscode.postMessage;
  vscode.postMessage = (message: unknown) => { posted.push(message as Record<string, unknown>); };
  return { posted, restore: () => { vscode.postMessage = original; } };
}

// ── E1: two conversations coexist ───────────────────────────────────────────

function testTwoConversationsHoldIndependentRunningState() {
  try {
    seedTwoConversations(
      { agentConversation: [makeAgentTurn({ id: 'a-1', isRunning: true })] },
      { agentConversation: [makeAgentTurn({ id: 'b-1', isRunning: false })] },
    );

    const state = useAISidebarStore.getState();
    assert.equal(Object.keys(state.conversations).length, 2, 'both threads are open');
    assert.equal(state.conversations['conv-a'].agentConversation[0].isRunning, true);
    assert.equal(state.conversations['conv-b'].agentConversation[0].isRunning, false);
    // The flat mirror shows the ACTIVE thread only.
    assert.equal(
      selectActiveConversation(state).agentConversation[0].id,
      'a-1',
      'the active-conversation selector reads the active thread',
    );
  } finally {
    resetStore();
  }
}

function testSwitchingIsNonDestructiveAndDoesNotResetSessions() {
  const { posted, restore } = capturePostedMessages();
  try {
    seedTwoConversations(
      { agentConversation: [makeAgentTurn({ id: 'a-1', isRunning: true })] },
      { agentConversation: [makeAgentTurn({ id: 'b-1', isRunning: true })] },
    );

    useAISidebarStore.getState().switchConversation('conv-b');

    const state = useAISidebarStore.getState();
    assert.equal(state.activeConversationId, 'conv-b');
    assert.equal(
      selectActiveConversation(state).agentConversation[0].id,
      'b-1',
      'the active-conversation selector follows the newly active thread',
    );
    assert.equal(
      state.conversations['conv-a'].agentConversation[0].isRunning,
      true,
      'switching away must leave the other thread running (Sprint 99 E4)'
    );
    assert.ok(
      !posted.some((m) => m.type === 'conversation:reset'),
      'switching must never post conversation:reset'
    );
  } finally {
    restore();
    resetStore();
  }
}

function testListOpenConversationsIsCreationOrdered() {
  try {
    const first = createConversationState('conv-first', { createdAt: 10 });
    const second = createConversationState('conv-second', { createdAt: 20 });
    hydrateConversations([second, first], first.id);

    assert.deepEqual(
      useAISidebarStore.getState().listOpenConversations(),
      ['conv-first', 'conv-second'],
      'open threads list in creation order regardless of map insertion order'
    );
  } finally {
    resetStore();
  }
}

// ── E2: inbound routing ─────────────────────────────────────────────────────

function testKnownConversationIdLandsInThatConversation() {
  try {
    seedTwoConversations(
      { agentConversation: [makeAgentTurn({ id: 'a-1' })] },
      { agentConversation: [makeAgentTurn({ id: 'b-1' })] },
    );

    // A background thread's result must land in the BACKGROUND thread.
    useAISidebarStore.getState().handleExtensionMessage({
      type: 'agent-result',
      conversationId: 'conv-b',
      text: 'background answer',
    });

    const state = useAISidebarStore.getState();
    assert.equal(
      state.conversations['conv-b'].agentConversation[0].result?.text,
      'background answer',
      'the result must land in the conversation it was attributed to'
    );
    assert.equal(
      state.conversations['conv-b'].agentConversation[0].isRunning,
      false,
      'the background turn is finished'
    );
    assert.equal(
      state.conversations['conv-a'].agentConversation[0].result,
      undefined,
      'the active conversation must be untouched'
    );
    assert.equal(
      state.conversations['conv-a'].agentConversation[0].isRunning,
      true,
      'the active conversation keeps running'
    );
  } finally {
    resetStore();
  }
}

function testCodexStreamingRoutesToTheAttributedConversation() {
  try {
    seedTwoConversations(
      { codexConversation: [makeCodexTurn({ id: 'a-1' })] },
      { codexConversation: [makeCodexTurn({ id: 'b-1' })] },
    );

    const store = useAISidebarStore.getState();
    store.handleExtensionMessage({ type: 'codex-streaming', conversationId: 'conv-b', delta: 'hello ' });
    store.handleExtensionMessage({ type: 'codex-streaming', conversationId: 'conv-a', delta: 'world' });
    store.handleExtensionMessage({ type: 'codex-streaming', conversationId: 'conv-b', delta: 'there' });

    const state = useAISidebarStore.getState();
    assert.equal(state.conversations['conv-b'].codexConversation[0].streamingText, 'hello there');
    assert.equal(state.conversations['conv-a'].codexConversation[0].streamingText, 'world');
  } finally {
    resetStore();
  }
}

function testUnknownConversationIdIsDroppedNotMisrouted() {
  const { warnings, restore } = silenceConsoleWarn();
  try {
    seedTwoConversations(
      { agentConversation: [makeAgentTurn({ id: 'a-1' })] },
      { agentConversation: [makeAgentTurn({ id: 'b-1' })] },
    );

    useAISidebarStore.getState().handleExtensionMessage({
      type: 'agent-result',
      conversationId: 'conv-does-not-exist',
      text: 'orphaned answer',
    });

    const state = useAISidebarStore.getState();
    assert.equal(
      state.conversations['conv-a'].agentConversation[0].result,
      undefined,
      'an unknown conversationId must NOT fall back to the active conversation (spec R5)'
    );
    assert.equal(state.conversations['conv-a'].agentConversation[0].isRunning, true);
    assert.equal(state.conversations['conv-b'].agentConversation[0].result, undefined);
    assert.ok(
      warnings.some((w) => w.includes('conv-does-not-exist') && w.includes('Dropped')),
      'dropping an unroutable message must be logged'
    );
  } finally {
    restore();
    resetStore();
  }
}

function testUnknownConversationIdIsDroppedForCodexStreamToo() {
  const { restore } = silenceConsoleWarn();
  try {
    seedTwoConversations({ codexConversation: [makeCodexTurn({ id: 'a-1' })] }, {});

    useAISidebarStore.getState().handleExtensionMessage({
      type: 'codex-streaming',
      conversationId: 'ghost',
      delta: 'should never appear',
    });

    assert.equal(
      useAISidebarStore.getState().conversations['conv-a'].codexConversation[0].streamingText,
      '',
      'a stream for an unknown conversation must not append to the active transcript'
    );
  } finally {
    restore();
    resetStore();
  }
}

// Sprint 99 Phase 1 only: the extension host is migrating in parallel, so a
// message with NO conversationId still lands on the active thread — loudly, once
// per message type. Delete this test with the fallback.
function testMissingConversationIdFallsBackToActiveWithOneWarning() {
  const { warnings, restore } = silenceConsoleWarn();
  try {
    seedTwoConversations({ codexConversation: [makeCodexTurn({ id: 'a-1' })] }, { codexConversation: [makeCodexTurn({ id: 'b-1' })] });

    const store = useAISidebarStore.getState();
    store.handleExtensionMessage({ type: 'codex-streaming', delta: 'x' });
    store.handleExtensionMessage({ type: 'codex-streaming', delta: 'y' });

    const state = useAISidebarStore.getState();
    assert.equal(state.conversations['conv-a'].codexConversation[0].streamingText, 'xy');
    assert.equal(state.conversations['conv-b'].codexConversation[0].streamingText, '');
    assert.equal(
      warnings.filter((w) => w.includes('without a conversationId')).length,
      1,
      'the un-migrated-path warning fires once per message type, not once per message'
    );
  } finally {
    restore();
    resetStore();
  }
}

function testApprovalRequestRoutesToTheThreadThatAsked() {
  try {
    seedTwoConversations(
      { agentConversation: [makeAgentTurn({ id: 'a-1' })] },
      { agentConversation: [makeAgentTurn({ id: 'b-1' })] },
    );

    useAISidebarStore.getState().handleExtensionMessage({
      type: 'agent-approval-request',
      conversationId: 'conv-b',
      requestId: 'req-1',
      agentId: 'claude-code',
      kind: 'file-write',
      filePath: '/tmp/x.md',
    });

    const state = useAISidebarStore.getState();
    assert.equal(
      state.conversations['conv-b'].agentConversation[0].approval?.requestId,
      'req-1',
      'the approval card belongs to the thread that asked (spec R7)'
    );
    assert.equal(
      state.conversations['conv-a'].agentConversation[0].approval,
      undefined,
      'the active thread must not show another thread\'s approval'
    );
  } finally {
    resetStore();
  }
}

// ── E3: per-conversation send guards ────────────────────────────────────────

function testRunningThreadDoesNotBlockSendingInAnIdleThread() {
  const { posted, restore } = capturePostedMessages();
  try {
    // Active thread B is idle; background thread A is mid-turn.
    const convA = createConversationState('conv-a', { agentConversation: [makeAgentTurn({ id: 'a-1', isRunning: true })] });
    const convB = createConversationState('conv-b');
    hydrateConversations([convA, convB], convB.id);

    useAISidebarStore.getState().sendAgentMessage('go');

    const state = useAISidebarStore.getState();
    assert.equal(
      state.conversations['conv-b'].agentConversation.length,
      1,
      'a running thread A must not disable sending in idle thread B (Sprint 99 E3)'
    );
    const execute = posted.find((m) => m.type === 'agent-execute');
    assert.ok(execute, 'the send must reach the host');
    assert.equal(execute!.conversationId, 'conv-b', 'outbound agent-execute carries the target conversationId');
  } finally {
    restore();
    resetStore();
  }
}

function testSendIsBlockedWhileTheSameThreadIsRunning() {
  const { posted, restore } = capturePostedMessages();
  try {
    seedTwoConversations({ agentConversation: [makeAgentTurn({ id: 'a-1', isRunning: true })] }, {});

    useAISidebarStore.getState().sendAgentMessage('second prompt');

    assert.equal(
      useAISidebarStore.getState().conversations['conv-a'].agentConversation.length,
      1,
      'one thread still runs exactly one turn at a time'
    );
    assert.ok(!posted.some((m) => m.type === 'agent-execute'), 'no execute is sent for a busy thread');
  } finally {
    restore();
    resetStore();
  }
}

function testCancelTargetsOnlyTheActiveThread() {
  const { posted, restore } = capturePostedMessages();
  try {
    seedTwoConversations(
      { codexConversation: [makeCodexTurn({ id: 'a-1', isRunning: true })] },
      { codexConversation: [makeCodexTurn({ id: 'b-1', isRunning: true })] },
    );

    useAISidebarStore.getState().cancelRequest();

    const state = useAISidebarStore.getState();
    assert.equal(state.conversations['conv-a'].codexConversation[0].isRunning, false);
    assert.equal(
      state.conversations['conv-b'].codexConversation[0].isRunning,
      true,
      'cancelling one thread must leave the other running (spec R14)'
    );
    const cancel = posted.find((m) => m.type === 'agent-cancel');
    assert.ok(cancel, 'a cancel reaches the host');
    assert.equal(cancel!.conversationId, 'conv-a', 'outbound agent-cancel carries the target conversationId');
  } finally {
    restore();
    resetStore();
  }
}

// ── Turn attribution ────────────────────────────────────────────────────────

function testNewTurnsCarryTheirConversationId() {
  const { restore } = capturePostedMessages();
  try {
    seedTwoConversations({}, {});

    useAISidebarStore.getState().sendAgentMessage('hello');

    assert.equal(
      useAISidebarStore.getState().conversations['conv-a'].agentConversation[0].conversationId,
      'conv-a',
      'every turn carries a conversationId (spec R5)'
    );
  } finally {
    restore();
    resetStore();
  }
}

function main() {
  testTwoConversationsHoldIndependentRunningState();
  testSwitchingIsNonDestructiveAndDoesNotResetSessions();
  testListOpenConversationsIsCreationOrdered();
  testKnownConversationIdLandsInThatConversation();
  testCodexStreamingRoutesToTheAttributedConversation();
  testUnknownConversationIdIsDroppedNotMisrouted();
  testUnknownConversationIdIsDroppedForCodexStreamToo();
  testMissingConversationIdFallsBackToActiveWithOneWarning();
  testApprovalRequestRoutesToTheThreadThatAsked();
  testRunningThreadDoesNotBlockSendingInAnIdleThread();
  testSendIsBlockedWhileTheSameThreadIsRunning();
  testCancelTargetsOnlyTheActiveThread();
  testNewTurnsCarryTheirConversationId();
  console.log('Conversation routing tests passed.');
}

main();
