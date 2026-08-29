import assert from 'node:assert/strict';
import {
  CONVERSATION_DELETE_UNDO_ACTION,
  showConversationDeleteNotification,
  type ConversationDeleteNotificationPorts,
} from './conversationDeleteNotification';
import type { ConversationResultMessage } from './protocol';

const deletion = {
  undoToken: 'undo-token',
  title: 'KUMi inspiration day ideas table',
  recovery: false,
};

const restoredResponse: ConversationResultMessage = {
  type: 'conversation/result',
  requestId: 'native-undo',
  operation: 'conversation/undo-delete',
  ok: true,
  data: { conversation: null },
};

function ports(overrides: Partial<ConversationDeleteNotificationPorts> = {}) {
  const calls = {
    information: [] as Array<[string, string]>,
    warning: [] as string[],
    restore: [] as Array<[string, boolean]>,
    dismissed: [] as string[],
    delivered: [] as ConversationResultMessage[],
  };
  const implementation: ConversationDeleteNotificationPorts = {
    showInformationMessage: async (message, action) => {
      calls.information.push([message, action]);
      return undefined;
    },
    showWarningMessage: async (message) => { calls.warning.push(message); },
    restore: async (undoToken, recovery) => {
      calls.restore.push([undoToken, recovery]);
      return restoredResponse;
    },
    dismiss: (undoToken) => { calls.dismissed.push(undoToken); },
    deliver: async (response) => { calls.delivered.push(response); },
    ...overrides,
  };
  return { calls, implementation };
}

async function run(): Promise<void> {
  {
    const test = ports();
    const outcome = await showConversationDeleteNotification(deletion, test.implementation);
    assert.equal(outcome, 'dismissed');
    assert.deepEqual(test.calls.information, [[`Deleted ${deletion.title}`, CONVERSATION_DELETE_UNDO_ACTION]]);
    assert.deepEqual(test.calls.restore, [], 'dismissing the native notification does not restore the conversation');
    assert.deepEqual(test.calls.dismissed, [deletion.undoToken], 'dismissing the notification releases its host Undo token');
    assert.deepEqual(test.calls.delivered, []);
  }

  {
    const test = ports({
      showInformationMessage: async (message, action) => {
        test.calls.information.push([message, action]);
        return CONVERSATION_DELETE_UNDO_ACTION;
      },
    });
    const outcome = await showConversationDeleteNotification(deletion, test.implementation);
    assert.equal(outcome, 'restored');
    assert.deepEqual(test.calls.restore, [[deletion.undoToken, false]]);
    assert.deepEqual(test.calls.delivered, [restoredResponse]);
    assert.deepEqual(test.calls.dismissed, [], 'a successful restore consumes its own token in ConversationStore');
    assert.deepEqual(test.calls.warning, []);
  }

  {
    const failedResponse: ConversationResultMessage = {
      type: 'conversation/result',
      requestId: 'native-undo-failed',
      operation: 'conversation/undo-delete',
      ok: false,
      error: { code: 'not-found', message: 'Undo token is unknown or expired', retryable: false },
    };
    const test = ports({
      showInformationMessage: async (message, action) => {
        test.calls.information.push([message, action]);
        return CONVERSATION_DELETE_UNDO_ACTION;
      },
      restore: async (undoToken, recovery) => {
        test.calls.restore.push([undoToken, recovery]);
        return failedResponse;
      },
    });
    const outcome = await showConversationDeleteNotification(deletion, test.implementation);
    assert.equal(outcome, 'failed');
    assert.deepEqual(test.calls.delivered, [], 'a failed restore is never projected into the webview');
    assert.deepEqual(test.calls.dismissed, [deletion.undoToken], 'a failed action cannot leave an unreachable token reserved');
    assert.deepEqual(test.calls.warning, [`Could not restore ${deletion.title}: Undo token is unknown or expired`]);
  }

  console.log('conversationDeleteNotification.test.ts: all assertions passed');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
