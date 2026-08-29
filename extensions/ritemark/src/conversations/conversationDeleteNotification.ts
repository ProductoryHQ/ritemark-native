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
  deliver(response: ConversationResultMessage): PromiseLike<unknown>;
}

export async function showConversationDeleteNotification(
  deletion: ConversationDeleteNotification,
  ports: ConversationDeleteNotificationPorts,
): Promise<'dismissed' | 'restored' | 'failed'> {
  const selection = await ports.showInformationMessage(
    `Deleted ${deletion.title}`,
    CONVERSATION_DELETE_UNDO_ACTION,
  );
  if (selection !== CONVERSATION_DELETE_UNDO_ACTION) return 'dismissed';

  const response = await ports.restore(deletion.undoToken, deletion.recovery);
  if (!response.ok) {
    await ports.showWarningMessage(`Could not restore ${deletion.title}: ${response.error.message}`);
    return 'failed';
  }

  await ports.deliver(response);
  return 'restored';
}
