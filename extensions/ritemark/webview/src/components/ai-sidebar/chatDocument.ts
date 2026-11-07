/**
 * Sprint 155 (PR 2) — a chat's document, as the sheet shows it (experience 45):
 * the head's icon words and All chats' order by the document in front.
 *
 * The host decides which document a chat's is (the newest changed file that
 * still exists) and resolves its icon; it sends both in `chat-documents`.
 */
import type { ChatDocumentView } from '../../../../src/views/chatDocuments';

export type { ChatDocumentView };

/** "Changed Advokatuur.md", or "Changed Module 2.md and 2 more" (only files that still exist). */
export function chatDocumentTooltip(document: ChatDocumentView): string {
  return `Changed ${document.name}${document.more > 0 ? ` and ${document.more} more` : ''}`;
}

/** The icon's accessible name: the tooltip's words, then what a click does. */
export function chatDocumentLabel(document: ChatDocumentView): string {
  return `${chatDocumentTooltip(document)}. Bring it forward`;
}

/**
 * All chats: the chats whose document is the one in front first, then the rest,
 * each part in the order it had. The same list when nothing moves.
 */
export function orderByFrontDocument<T extends { conversationId: string }>(
  rows: T[],
  documents: Record<string, ChatDocumentView>,
  front: string | null,
): T[] {
  if (!front) return rows;
  const first = rows.filter((row) => documents[row.conversationId]?.path === front);
  if (first.length === 0) return rows;
  return [...first, ...rows.filter((row) => documents[row.conversationId]?.path !== front)];
}
