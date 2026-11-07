/**
 * Sprint 155: where a comment's task goes — the document's own chat.
 *
 * Replaces decision D5 (Sprint 117: always the chat open on the AI's sheet),
 * which let a task about one document land in a chat about another. The rules,
 * in order (experience 45, `product/design/experience/experiences/chatdoc`):
 *
 *   1. the chat that last changed that document;
 *   2. otherwise the open chat, but only if it hasn't changed another document;
 *   3. otherwise a new chat, named from the comment.
 *
 * A chat holding a comment's task for a document, waiting or working, counts as
 * having changed it, as its newest change: a second comment, or a batch, joins
 * the first one's chat. Only files that still exist count, so a chat whose
 * changed file was deleted or moved is treated as if it had not changed it.
 *
 * Pure: the host gathers the facts (`UnifiedViewProvider`), and the controller
 * asks this one function at preview and at send, so the caption and the send
 * cannot disagree.
 */

import { samePath } from '../utils/pathIdentity';

export interface DestinationChatFacts {
  conversationId: string;
  /** Files the chat's finished turns changed, newest first (the conversation summary's `changedFiles`). */
  changedFiles?: ReadonlyArray<{ path: string; changedAt: string }>;
}

/** A comment's task that is waiting or working, and the document it is for. */
export interface PendingTaskFact {
  conversationId: string;
  /** The task's document, in the same form as `document` (a file path). */
  document: string;
  /** When the task was accepted. */
  at: string;
}

export type DestinationChoice =
  | { rule: 'changed'; conversationId: string; changedAt: string }
  | { rule: 'open'; conversationId: string }
  | { rule: 'new' };

export function pickCommentTaskDestination(input: {
  /** The comment's document, as a file path. */
  document: string;
  chats: readonly DestinationChatFacts[];
  pending: readonly PendingTaskFact[];
  openConversationId: string | null;
  exists: (file: string) => boolean;
  samePath?: (a: string, b: string) => boolean;
}): DestinationChoice {
  const same = input.samePath ?? ((a: string, b: string) => samePath(a, b));
  const changes = new Map<string, Array<{ path: string; changedAt: string }>>();
  const add = (conversationId: string, path: string, changedAt: string) => {
    const list = changes.get(conversationId) ?? [];
    list.push({ path, changedAt });
    changes.set(conversationId, list);
  };
  for (const chat of input.chats) {
    for (const entry of chat.changedFiles ?? []) {
      if (same(entry.path, input.document) || input.exists(entry.path)) add(chat.conversationId, entry.path, entry.changedAt);
    }
  }
  // A waiting or working task is its chat's newest change, whatever the clock says.
  const newestOf = (conversationId: string) => (changes.get(conversationId) ?? [])
    .reduce((max, entry) => (entry.changedAt > max ? entry.changedAt : max), '');
  for (const task of input.pending) {
    const newest = newestOf(task.conversationId);
    add(task.conversationId, task.document, task.at > newest ? task.at : `${newest}~`);
  }

  // 1. The chat that last changed the document.
  let best: { conversationId: string; changedAt: string } | null = null;
  for (const [conversationId, list] of changes) {
    for (const entry of list) {
      if (!same(entry.path, input.document)) continue;
      if (!best || entry.changedAt > best.changedAt) best = { conversationId, changedAt: entry.changedAt };
    }
  }
  if (best) return { rule: 'changed', ...best };

  // 2. The open chat, if it hasn't changed another document.
  if (input.openConversationId && !(changes.get(input.openConversationId)?.length)) {
    return { rule: 'open', conversationId: input.openConversationId };
  }

  // 3. A new chat.
  return { rule: 'new' };
}

/** A new chat's name has at most this many of the comment's words. */
export const COMMENT_CHAT_NAME_WORDS = 6;

/**
 * A new chat's name, from the comment's own words: without the "@claude" (or
 * any other @mention), up to six words, first letter capitalised. Empty when
 * the comment has no words; the chat then reads "New conversation" as today.
 */
export function chatNameFromComment(text: string): string {
  const words = text
    // the mention and the punctuation that follows it ("@opencode, list …")
    .replace(/(^|\s)@[A-Za-z][\w-]*[.,;:!?…]*/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.,;:!?…–—-]+\s*/u, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, COMMENT_CHAT_NAME_WORDS);
  if (!words.length) return '';
  const name = words.join(' ').replace(/[\s.,;:!?…–—-]+$/u, '');
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
}
