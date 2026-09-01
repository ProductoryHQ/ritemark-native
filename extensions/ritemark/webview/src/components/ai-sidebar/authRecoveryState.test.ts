import assert from 'node:assert/strict';
import { vscode } from '../../lib/vscode';
import { useAISidebarStore } from './store';
import type { SetupStatus } from './types';

const initialState = useAISidebarStore.getState();
const readyStatus: SetupStatus = {
  cliInstalled: true,
  runnable: true,
  authenticated: true,
  authMethod: 'claude-oauth',
  state: 'ready',
  diagnostics: [],
  repairAction: null,
  error: null,
};

function resetStore(): void {
  useAISidebarStore.setState(initialState, true);
}

function testBrowserCallbackCompletesInlineRecovery(): void {
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = () => undefined;
  try {
    useAISidebarStore.getState().startLogin('turn-auth');
    assert.equal(useAISidebarStore.getState().claudeLoginState, 'pending');
    assert.equal(useAISidebarStore.getState().claudeLoginTurnId, 'turn-auth');
    assert.equal(useAISidebarStore.getState().setupInProgress, true);

    useAISidebarStore.getState().handleExtensionMessage({
      type: 'agent-setup:complete',
      status: readyStatus,
    });

    assert.equal(useAISidebarStore.getState().claudeLoginState, 'success');
    assert.equal(useAISidebarStore.getState().setupInProgress, false);
    assert.equal(useAISidebarStore.getState().setupError, null);
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testPollingRefreshCompletesInlineRecovery(): void {
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = () => undefined;
  try {
    useAISidebarStore.getState().startLogin('turn-polled-auth');
    useAISidebarStore.getState().handleExtensionMessage({
      type: 'agent:config',
      agenticEnabled: true,
      selectedAgent: 'claude-code',
      selectedModel: 'claude-sonnet-5',
      agents: [],
      models: [],
      setupStatus: readyStatus,
    });

    assert.equal(
      useAISidebarStore.getState().claudeLoginState,
      'success',
      'the host polling path must finish the same recovery card as the browser callback',
    );
    assert.equal(useAISidebarStore.getState().setupInProgress, false);
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testSetupOriginatedReadyLoginDoesNotStoreAFalseError(): void {
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = () => undefined;
  try {
    useAISidebarStore.getState().startLogin();
    assert.equal(useAISidebarStore.getState().claudeLoginTurnId, null);

    useAISidebarStore.getState().handleExtensionMessage({
      type: 'agent-setup:complete',
      status: readyStatus,
    });

    assert.equal(useAISidebarStore.getState().claudeLoginState, 'idle');
    assert.equal(useAISidebarStore.getState().setupInProgress, false);
    assert.equal(useAISidebarStore.getState().setupError, null);
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testSetupOriginatedPollingRefreshAlsoReturnsToIdle(): void {
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = () => undefined;
  try {
    useAISidebarStore.getState().startLogin();
    useAISidebarStore.getState().handleExtensionMessage({
      type: 'agent:config',
      agenticEnabled: true,
      selectedAgent: 'claude-code',
      selectedModel: 'claude-sonnet-5',
      agents: [],
      models: [],
      setupStatus: readyStatus,
    });

    assert.equal(useAISidebarStore.getState().claudeLoginState, 'idle');
    assert.equal(useAISidebarStore.getState().claudeLoginTurnId, null);
    assert.equal(useAISidebarStore.getState().setupError, null);
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testFailedLoginStaysRecoverable(): void {
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = () => undefined;
  try {
    useAISidebarStore.getState().startLogin('turn-failed-auth');
    useAISidebarStore.getState().handleExtensionMessage({
      type: 'agent-setup:error',
      error: 'Claude sign-in was cancelled. You can try again when ready.',
    });

    assert.equal(useAISidebarStore.getState().claudeLoginState, 'error');
    assert.equal(useAISidebarStore.getState().setupInProgress, false);
    assert.equal(
      useAISidebarStore.getState().setupError,
      'Claude sign-in was cancelled. You can try again when ready.',
    );
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testLateReadyRefreshRecoversAnErroredLogin(): void {
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = () => undefined;
  try {
    useAISidebarStore.getState().startLogin('turn-late-auth');
    useAISidebarStore.getState().handleExtensionMessage({
      type: 'agent-setup:error',
      error: 'Claude sign-in timed out. You can try again when ready.',
    });
    assert.equal(useAISidebarStore.getState().claudeLoginState, 'error');

    useAISidebarStore.getState().handleExtensionMessage({
      type: 'agent:config',
      agenticEnabled: true,
      selectedAgent: 'claude-code',
      selectedModel: 'claude-sonnet-5',
      agents: [],
      models: [],
      setupStatus: readyStatus,
    });

    assert.equal(
      useAISidebarStore.getState().claudeLoginState,
      'success',
      'a later authoritative ready status must win over a timeout/error callback',
    );
    assert.equal(useAISidebarStore.getState().setupError, null);
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testSuccessAcknowledgementDismissesOnlyItsTurn(): void {
  try {
    useAISidebarStore.setState({
      claudeLoginState: 'success',
      claudeLoginTurnId: 'turn-auth',
      dismissedAuthRecoveryTurnIds: ['older-turn'],
    });

    useAISidebarStore.getState().dismissAuthRecovery('turn-auth');

    assert.equal(useAISidebarStore.getState().claudeLoginState, 'idle');
    assert.equal(useAISidebarStore.getState().claudeLoginTurnId, null);
    assert.deepEqual(
      useAISidebarStore.getState().dismissedAuthRecoveryTurnIds,
      ['older-turn', 'turn-auth'],
    );
  } finally {
    resetStore();
  }
}

function main(): void {
  testBrowserCallbackCompletesInlineRecovery();
  testPollingRefreshCompletesInlineRecovery();
  testSetupOriginatedReadyLoginDoesNotStoreAFalseError();
  testSetupOriginatedPollingRefreshAlsoReturnsToIdle();
  testFailedLoginStaysRecoverable();
  testLateReadyRefreshRecoversAnErroredLogin();
  testSuccessAcknowledgementDismissesOnlyItsTurn();
  console.log('Claude auth recovery state tests passed.');
}

main();
