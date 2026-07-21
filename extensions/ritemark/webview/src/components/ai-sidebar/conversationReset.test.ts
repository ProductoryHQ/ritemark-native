/**
 * Conversation reset / lifecycle tests.
 *
 * Sprint 99 (E4) CHANGED THE CONTRACT these tests encode. Before Sprint 99 a
 * "new chat" wiped the live conversation and fired `conversation:reset` at every
 * provider. That teardown is exactly what made parallel chats impossible, so:
 *
 *   - `startNewConversation()` now opens an ADDITIONAL thread and must NOT reset
 *     any provider session (spec R10 + R5).
 *   - `clearChat()` ("/clear") still resets — it genuinely throws a conversation
 *     away — but it targets ONE conversation, carrying its `conversationId`.
 *
 * The #135 invariant (a new session must not overwrite the previous one in
 * History) is unchanged and still asserted; it is expressed as "the id changed"
 * rather than "the id became null", because a thread now gets its storage id at
 * creation instead of at first save.
 *
 * Run with: npx tsx webview/src/components/ai-sidebar/conversationReset.test.ts
 */
import assert from 'node:assert/strict';
import { useAISidebarStore, hydrateConversations } from './store';
import { createConversationState, type ConversationState } from './conversationState';
import { vscode } from '../../lib/vscode';
import type { CodexConversationTurn } from './types';

const initialState = useAISidebarStore.getState();

function resetStore(): void {
  useAISidebarStore.setState(initialState, true);
}

function seedActiveConversation(partial: Partial<ConversationState> = {}): string {
  const conversation = createConversationState('conv-1', partial);
  hydrateConversations([conversation], conversation.id);
  return conversation.id;
}

function capturePostedMessages(): { posted: unknown[]; restore: () => void } {
  const posted: unknown[] = [];
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = (message: unknown) => {
    posted.push(message);
  };
  return { posted, restore: () => { vscode.postMessage = originalPostMessage; } };
}

function hasResetMessage(posted: unknown[]): boolean {
  return posted.some(
    (message) =>
      typeof message === 'object'
      && message !== null
      && 'type' in message
      && message.type === 'conversation:reset'
  );
}

function makeCodexTurn(): CodexConversationTurn {
  return {
    id: 'turn-1',
    userPrompt: 'Plan the task',
    streamingText: '',
    activities: [],
    planText: '',
    planSteps: [],
    planHandled: false,
    isRunning: true,
    timestamp: 1,
    executionContinuation: false,
    requiresPlanReview: false,
  };
}

// Sprint 99 E4: this assertion is INVERTED from its pre-Sprint-99 form. Starting
// a new thread must not tear down the thread the user was on — that thread keeps
// streaming in the background.
function testStartNewConversationDoesNotResetProviderSessions() {
  const { posted, restore } = capturePostedMessages();

  try {
    const firstId = seedActiveConversation({
      selectedAgent: 'codex',
      codexConversation: [makeCodexTurn()],
    });

    useAISidebarStore.getState().startNewConversation();

    const state = useAISidebarStore.getState();
    assert.ok(
      !hasResetMessage(posted),
      'starting a new conversation must NOT reset provider sessions — switching is a view change (Sprint 99 E4)'
    );
    assert.notEqual(state.activeConversationId, firstId, 'a new thread must become active');
    assert.equal(
      state.codexConversation.length,
      0,
      'the newly opened thread starts empty'
    );
    assert.ok(state.conversations[firstId], 'the previous thread must still be open');
    assert.equal(
      state.conversations[firstId].codexConversation.length,
      1,
      'the previous thread must keep its running turn'
    );
  } finally {
    restore();
    resetStore();
  }
}

// /clear is a genuine "throw this away", so it keeps the reset — but it must
// target exactly one conversation, never every provider.
function testClearChatResetsOnlyItsOwnProviderSession() {
  const { posted, restore } = capturePostedMessages();

  try {
    const clearedId = seedActiveConversation({
      selectedAgent: 'claude-code',
      agentConversation: [{
        id: 'agent-turn-1',
        userPrompt: 'Do the task',
        activities: [],
        isRunning: true,
        isPlan: false,
        planHandled: false,
        timestamp: 1,
      }],
    });

    useAISidebarStore.getState().clearChat();

    assert.equal(useAISidebarStore.getState().agentConversation.length, 0);
    const resets = posted.filter(
      (m): m is { type: string; conversationId?: string } =>
        typeof m === 'object' && m !== null && 'type' in m && (m as { type: string }).type === 'conversation:reset'
    );
    assert.equal(resets.length, 1, 'clearing chat must reset exactly one conversation');
    assert.equal(
      resets[0].conversationId,
      clearedId,
      'the reset must carry the id of the conversation being cleared (Sprint 99 E4)'
    );
  } finally {
    restore();
    resetStore();
  }
}

function testDismissedCurrentPlanKeyResetsForNewConversation() {
  try {
    seedActiveConversation({
      dismissedCurrentPlanKey: 'plan-turn-1',
      codexConversation: [makeCodexTurn()],
    });

    useAISidebarStore.getState().startNewConversation();

    assert.equal(
      useAISidebarStore.getState().dismissedCurrentPlanKey,
      null,
      'a newly opened thread must start with no dismissed plan state'
    );
  } finally {
    resetStore();
  }
}

function testDismissedCurrentPlanKeyResetsForClearChatMessage() {
  try {
    seedActiveConversation({
      dismissedCurrentPlanKey: 'plan-turn-1',
      codexConversation: [makeCodexTurn()],
    });

    useAISidebarStore.getState().handleExtensionMessage({ type: 'clear-chat' });

    assert.equal(
      useAISidebarStore.getState().dismissedCurrentPlanKey,
      null,
      'extension-driven clear-chat must leave the user on a thread with no dismissed plan state'
    );
  } finally {
    resetStore();
  }
}

function testDismissCurrentPlanStoresKey() {
  try {
    seedActiveConversation({ dismissedCurrentPlanKey: null });

    useAISidebarStore.getState().dismissCurrentPlan('approved-plan-1');

    assert.equal(
      useAISidebarStore.getState().dismissedCurrentPlanKey,
      'approved-plan-1',
      'dismissing current plan should remember the specific plan key'
    );
  } finally {
    resetStore();
  }
}

// #135: a "new chat" (extension-driven clear-chat) must land the user on a
// DIFFERENT conversation id, otherwise the next session reuses the old id and
// overwrites the previous entry in history — collapsing multiple sessions into one.
function testNewChatUsesFreshConversationIdSoSessionsDoNotCollapse() {
  try {
    const firstId = seedActiveConversation({
      agentConversation: [{
        id: 'agent-turn-1',
        userPrompt: 'First session',
        activities: [],
        isRunning: false,
        isPlan: false,
        planHandled: false,
        timestamp: 1,
      }],
    });

    useAISidebarStore.getState().handleExtensionMessage({ type: 'clear-chat' });

    const { currentConversationId } = useAISidebarStore.getState();
    assert.ok(currentConversationId, 'a thread is always active');
    assert.notEqual(
      currentConversationId,
      firstId,
      'new chat must move to a fresh conversation id so the next session does not overwrite the previous one (#135)'
    );
  } finally {
    resetStore();
  }
}

// #135: /clear must also move to a fresh id — otherwise a new message after
// clearing reuses the cleared conversation's id and overwrites it.
function testClearChatUsesFreshConversationId() {
  try {
    const firstId = seedActiveConversation({
      agentConversation: [{
        id: 'agent-turn-1',
        userPrompt: 'x',
        activities: [],
        isRunning: false,
        isPlan: false,
        planHandled: false,
        timestamp: 1,
      }],
    });

    useAISidebarStore.getState().clearChat();

    const { currentConversationId, conversations } = useAISidebarStore.getState();
    assert.notEqual(currentConversationId, firstId, '/clear must move to a fresh conversation id (#135)');
    assert.equal(
      conversations[firstId],
      undefined,
      '/clear discards the cleared thread rather than leaving it open'
    );
  } finally {
    resetStore();
  }
}

function main() {
  testStartNewConversationDoesNotResetProviderSessions();
  testClearChatResetsOnlyItsOwnProviderSession();
  testDismissedCurrentPlanKeyResetsForNewConversation();
  testDismissedCurrentPlanKeyResetsForClearChatMessage();
  testDismissCurrentPlanStoresKey();
  testNewChatUsesFreshConversationIdSoSessionsDoNotCollapse();
  testClearChatUsesFreshConversationId();
  console.log('Conversation reset tests passed.');
}

main();
