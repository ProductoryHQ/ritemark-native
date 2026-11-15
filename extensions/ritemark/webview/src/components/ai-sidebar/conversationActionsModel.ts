/**
 * Sprint 122 (#282) — what the conversation actions say and allow, in one place.
 *
 * History, the thread rail and the conversation header all offer pin/unpin,
 * and History and the header offer rename and delete. They used to each carry
 * their own copy of the five-pin limit and its wording; this module is the one
 * copy, so "the header behaves exactly like History" is true by construction
 * rather than by care. Pure, so it is unit-testable without React.
 */
import type { AgentId } from '../../../../src/agent/types';
import type { ConversationSummaryV1 } from '../../../../src/conversations/types';
import { aiName } from '../../../../src/runtime/turnFailureCopy';

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

/**
 * Sprint 139 (the Experience lead, 26 October): the chat's own header shows a
 * state only while it is live, while the AI works or waits for the person (an
 * approval or a question). A turn that ended, by an answer, a failure or a
 * stop, leaves just the title: the turn itself says what happened. The same
 * for Claude, ChatGPT and OpenCode. The chats list and the rail keep their
 * marks for a chat whose last turn failed ({@link conversationStatusLabel}).
 */
export function headerStatusLabel(summary: Pick<ConversationSummaryV1, 'lifecycle'>): string | null {
  return isConversationRunning(summary) ? conversationStatusLabel(summary) : null;
}

/**
 * Sprint 160 (#686): the AI whose usage limit stopped the chat's last turn, or
 * null. A usage limit is a `limit` failure that isn't ChatGPT's "busy" (a 429
 * that isn't a limit; its card says so). Only while the chat is interrupted by
 * that failure.
 */
export function usageLimitRuntime(summary: Pick<ConversationSummaryV1, 'lifecycle' | 'lastFailure'>): AgentId | null {
  const { lifecycle, lastFailure } = summary;
  if (lifecycle.state !== 'interrupted' || lifecycle.reason !== 'failed') return null;
  if (lastFailure?.kind !== 'limit' || lastFailure.limit === 'busy') return null;
  return lastFailure.runtimeId;
}

/** Sprint 160 (#686, the Experience lead): the chat list's and the rail's word for a usage limit. */
export const LIMIT_REACHED = 'Limit reached';

/** Sprint 160 (#686, the Experience lead): the rail's tooltip for a usage limit. */
export function usageLimitTooltip(runtimeId: AgentId): string {
  return `Stopped at ${aiName(runtimeId)}'s usage limit`;
}

/** Short status for a conversation that is not idle; null when there is nothing to say. */
export function conversationStatusLabel(summary: Pick<ConversationSummaryV1, 'lifecycle' | 'lastFailure'>): string | null {
  switch (summary.lifecycle.state) {
    case 'working':
      return 'Working';
    case 'needs-user':
      return 'Needs you';
    case 'interrupted':
      // Other failures keep "Interrupted" (Sprint 160, decision 9).
      return usageLimitRuntime(summary) ? LIMIT_REACHED : 'Interrupted';
    default:
      return null;
  }
}

/**
 * The rail's accessible name and tooltip for one chat: its title and its
 * state. Pinned says Pinned; an unread reply says New reply first. A usage
 * limit reads "Limit reached", and its tooltip says whose limit it was.
 */
export function railEntryLabels(
  summary: Pick<ConversationSummaryV1, 'title' | 'lifecycle' | 'lastFailure'>,
  options: { pinned: boolean; unread: boolean },
): { label: string; tooltip: string } {
  if (options.pinned) {
    const label = `${summary.title} — ${options.unread ? 'Pinned, new reply' : 'Pinned'}`;
    return { label, tooltip: label };
  }
  const { state } = summary.lifecycle;
  const status = state === 'needs-user' || state === 'working'
    ? conversationStatusLabel(summary)!
    : options.unread
      ? 'New reply'
      : conversationStatusLabel(summary) ?? 'Recent';
  const label = `${summary.title} — ${status}`;
  const limitRuntime = status === LIMIT_REACHED ? usageLimitRuntime(summary) : null;
  return { label, tooltip: limitRuntime ? `${summary.title} — ${usageLimitTooltip(limitRuntime)}` : label };
}
