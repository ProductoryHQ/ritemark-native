import assert from 'node:assert/strict';
import { useAISidebarStore } from './store';
import { vscode } from '../../lib/vscode';
import type { CodexConversationTurn } from './types';

const initialState = useAISidebarStore.getState();

function resetStore(): void {
  useAISidebarStore.setState(initialState, true);
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

function testStartNewConversationResetsProviderSessions() {
  const posted: unknown[] = [];
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = (message: unknown) => {
    posted.push(message);
  };

  try {
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
      selectedAgent: 'codex',
      codexConversation: [makeCodexTurn()],
      currentConversationId: null,
    });

    useAISidebarStore.getState().startNewConversation();

    assert.equal(useAISidebarStore.getState().codexConversation.length, 0);
    assert.ok(
      posted.some(
        (message) =>
          typeof message === 'object'
          && message !== null
          && 'type' in message
          && message.type === 'conversation:reset'
      ),
      'starting a new conversation must reset provider sessions in the extension'
    );
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testClearChatResetsProviderSessions() {
  const posted: unknown[] = [];
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = (message: unknown) => {
    posted.push(message);
  };

  try {
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
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
    assert.ok(
      posted.some(
        (message) =>
          typeof message === 'object'
          && message !== null
          && 'type' in message
          && message.type === 'conversation:reset'
      ),
      'clearing chat must reset provider sessions in the extension'
    );
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testDismissedCurrentPlanKeyResetsForNewConversation() {
  try {
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
      dismissedCurrentPlanKey: 'plan-turn-1',
      codexConversation: [makeCodexTurn()],
      currentConversationId: 'conv-1',
    });

    useAISidebarStore.getState().startNewConversation();

    assert.equal(
      useAISidebarStore.getState().dismissedCurrentPlanKey,
      null,
      'starting a new conversation must clear dismissed current plan state'
    );
  } finally {
    resetStore();
  }
}

function testDismissedCurrentPlanKeyResetsForClearChatMessage() {
  try {
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
      dismissedCurrentPlanKey: 'plan-turn-1',
      codexConversation: [makeCodexTurn()],
      currentConversationId: 'conv-1',
    });

    useAISidebarStore.getState().handleExtensionMessage({ type: 'clear-chat' });

    assert.equal(
      useAISidebarStore.getState().dismissedCurrentPlanKey,
      null,
      'extension-driven clear-chat must clear dismissed current plan state'
    );
  } finally {
    resetStore();
  }
}

function testDismissCurrentPlanStoresKey() {
  try {
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
      dismissedCurrentPlanKey: null,
    });

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

// #135: a "new chat" (extension-driven clear-chat) must reset currentConversationId,
// otherwise the next session reuses the old id and overwrites the previous entry in
// history — collapsing multiple sessions into one.
function testNewChatResetsConversationIdSoSessionsDoNotCollapse() {
  try {
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
      currentConversationId: 'conv-1',
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

    assert.equal(
      useAISidebarStore.getState().currentConversationId,
      null,
      'new chat must reset currentConversationId so the next session gets a fresh id (#135)'
    );
  } finally {
    resetStore();
  }
}

// #135: /clear must also reset the id — otherwise a new message after clearing
// reuses the cleared conversation's id and overwrites it.
function testClearChatResetsConversationId() {
  try {
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
      currentConversationId: 'conv-1',
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

    assert.equal(
      useAISidebarStore.getState().currentConversationId,
      null,
      '/clear must reset currentConversationId (#135)'
    );
  } finally {
    resetStore();
  }
}

function main() {
  testStartNewConversationResetsProviderSessions();
  testClearChatResetsProviderSessions();
  testDismissedCurrentPlanKeyResetsForNewConversation();
  testDismissedCurrentPlanKeyResetsForClearChatMessage();
  testDismissCurrentPlanStoresKey();
  testNewChatResetsConversationIdSoSessionsDoNotCollapse();
  testClearChatResetsConversationId();
  console.log('Conversation reset tests passed.');
}

main();
