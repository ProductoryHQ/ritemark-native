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
