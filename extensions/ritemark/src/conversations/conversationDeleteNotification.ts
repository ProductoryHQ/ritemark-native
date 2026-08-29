import type { ConversationResultMessage } from './protocol';

export const CONVERSATION_DELETE_UNDO_ACTION = 'Undo';

export interface ConversationDeleteNotification {
  undoToken: string;
  title: string;
  recovery: boolean;
}

export interface ConversationDeleteNotificationPorts {
  showInformationMessage(message: string, action: string): PromiseLike<string | undefined>;
  showWarningMessage(message: string): PromiseLike<unknown>;
  restore(undoToken: string, recovery: boolean): Promise<ConversationResultMessage>;
  dismiss(undoToken: string): void | PromiseLike<unknown>;
  deliver(response: ConversationResultMessage): PromiseLike<unknown>;
}

export async function showConversationDeleteNotification(
  deletion: ConversationDeleteNotification,
  ports: ConversationDeleteNotificationPorts,
): Promise<'dismissed' | 'restored' | 'failed'> {
  let selection: string | undefined;
  try {
    selection = await ports.showInformationMessage(
      `Deleted ${deletion.title}`,
      CONVERSATION_DELETE_UNDO_ACTION,
    );
  } catch (error) {
    await ports.dismiss(deletion.undoToken);
    throw error;
  }
  if (selection !== CONVERSATION_DELETE_UNDO_ACTION) {
    await ports.dismiss(deletion.undoToken);
    return 'dismissed';
  }

  let response: ConversationResultMessage;
  try {
    response = await ports.restore(deletion.undoToken, deletion.recovery);
  } catch (error) {
    await ports.dismiss(deletion.undoToken);
    throw error;
  }
  if (!response.ok) {
    await ports.dismiss(deletion.undoToken);
    await ports.showWarningMessage(`Could not restore ${deletion.title}: ${response.error.message}`);
    return 'failed';
  }

  await ports.deliver(response);
  return 'restored';
}
