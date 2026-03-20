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

function main() {
  testStartNewConversationResetsProviderSessions();
  testClearChatResetsProviderSessions();
  testDismissedCurrentPlanKeyResetsForNewConversation();
  testDismissCurrentPlanStoresKey();
  console.log('Conversation reset tests passed.');
}

main();
