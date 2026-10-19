import type { ConversationSummaryV1 } from '../../../../src/conversations/types';

export function selectRailConversationIds(
  summaries: ConversationSummaryV1[],
  pinnedIds: string[],
  currentId: string | null,
): string[] {
  const byRecency = [...summaries].sort((a, b) =>
    Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)
    || a.conversationId.localeCompare(b.conversationId));
  const valid = new Set(summaries.map((summary) => summary.conversationId));
  const active = byRecency.filter((summary) =>
    summary.lifecycle.state === 'working'
    || summary.lifecycle.state === 'needs-user');
  const protectedIds = new Set([...pinnedIds, ...active.map((summary) => summary.conversationId)]);
  const recentIdle = byRecency
    .filter((summary) => summary.lifecycle.state === 'idle' && !protectedIds.has(summary.conversationId))
    .slice(0, 3);

  // Selecting a conversation is a view change, not new activity. Keep the
  // Pinned / active / recent sequence independent of the current selection;
  // append an older current conversation only when it is otherwise absent.
  return [...new Set([
    ...pinnedIds.filter((id) => valid.has(id)),
    ...active.map((summary) => summary.conversationId),
    ...recentIdle.map((summary) => summary.conversationId),
    ...(currentId && valid.has(currentId) ? [currentId] : []),
  ])];
}

/**
 * Sprint 134 (R3): what the rail's dot says about a chat. Amber when it waits for
 * the person: a question or an approval, or a reply not yet read (Jarmo, 19
 * October: "Also unread answers"); the accent dot while it works. A chat with no
 * read marker (one from before Sprint 134) counts as read, as on Home.
 */
export type RailMark = 'needs-you' | 'unread' | 'working' | null;

export function railMarkOf(summary: Pick<ConversationSummaryV1, 'lifecycle' | 'readAt' | 'lastReplyAt'>): RailMark {
  if (summary.lifecycle.state === 'needs-user') return 'needs-you';
  if (summary.lifecycle.state === 'working') return 'working';
  if (summary.readAt && summary.lastReplyAt && summary.lastReplyAt > summary.readAt) return 'unread';
  return null;
}
