/**
 * Sprint 122 (#282) — what the conversation actions say and allow, in one place.
 *
 * History, the thread rail and the conversation header all offer pin/unpin,
 * and History and the header offer rename and delete. They used to each carry
 * their own copy of the five-pin limit and its wording; this module is the one
 * copy, so "the header behaves exactly like History" is true by construction
 * rather than by care. Pure, so it is unit-testable without React.
 */
import type { ConversationSummaryV1 } from '../../../../src/conversations/types';

/** How many conversations can be pinned at once. The store enforces it too. */
export const MAX_PINNED_CONVERSATIONS = 5;

export interface ConversationPinState {
  pinned: boolean;
  /** Pinning is refused: five others are pinned and this one is not. */
  atCapacity: boolean;
  /** Accessible name and tooltip for the pin button. */
  label: string;
  /** The verb on its own, for a menu that already names the conversation. */
  action: 'Pin' | 'Unpin';
  icon: 'push-pin' | 'push-pin-slash';
}

export function conversationPinState(
  conversationId: string,
  title: string,
  pinnedIds: readonly string[],
): ConversationPinState {
  const pinned = pinnedIds.includes(conversationId);
  const atCapacity = !pinned && pinnedIds.length >= MAX_PINNED_CONVERSATIONS;
  return {
    pinned,
    atCapacity,
    label: atCapacity ? 'Unpin a conversation before pinning another.' : `${pinned ? 'Unpin' : 'Pin'} ${title}`,
    action: pinned ? 'Unpin' : 'Pin',
    icon: pinned ? 'push-pin-slash' : 'push-pin',
  };
}

/** A turn is in flight or waiting on the user — deleting it stops it first. */
export function isConversationRunning(summary: Pick<ConversationSummaryV1, 'lifecycle'>): boolean {
  return summary.lifecycle.state === 'working' || summary.lifecycle.state === 'needs-user';
}

/** The delete dialog's confirm button: it says what will actually happen. */
export function deleteConfirmLabel(summary: Pick<ConversationSummaryV1, 'lifecycle'>): string {
  return isConversationRunning(summary) ? 'Stop and delete' : 'Delete';
}

/** Short status for a conversation that is not idle; null when there is nothing to say. */
export function conversationStatusLabel(summary: Pick<ConversationSummaryV1, 'lifecycle'>): string | null {
  switch (summary.lifecycle.state) {
    case 'working':
      return 'Working';
    case 'needs-user':
      return 'Needs you';
    case 'interrupted':
      return 'Interrupted';
    default:
      return null;
  }
}
