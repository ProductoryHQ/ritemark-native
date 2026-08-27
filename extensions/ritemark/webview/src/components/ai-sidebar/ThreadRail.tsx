import { useMemo } from 'react';
import { Icon } from '../ui/Icon';
import { ConversationBubbleIcon } from './ConversationBubbleIcon';
import { ConversationTooltip } from './ConversationTooltip';
import { selectRailConversationIds } from './conversationSelectors';
import { useAISidebarStore } from './store';

function statusLabel(state: string): string {
  if (state === 'needs-user') return 'Needs you';
  if (state === 'working') return 'Working';
  if (state === 'interrupted') return 'Interrupted';
  return 'Recent';
}

export function ThreadRail() {
  const summaries = useAISidebarStore((state) => state.hostConversations);
  const pinnedIds = useAISidebarStore((state) => state.pinnedConversationIds);
  const activeId = useAISidebarStore((state) => state.activeConversationId);
  const requestNew = useAISidebarStore((state) => state.requestNewThread);
  const switchConversation = useAISidebarStore((state) => state.switchConversation);
  const loadSavedConversation = useAISidebarStore((state) => state.loadSavedConversation);
  const openConversations = useAISidebarStore((state) => state.conversations);
  const togglePanel = useAISidebarStore((state) => state.toggleHistoryPanel);
  const showPanel = useAISidebarStore((state) => state.showHistoryPanel);
  const pin = useAISidebarStore((state) => state.pinConversation);
  const unpin = useAISidebarStore((state) => state.unpinConversation);

  const ids = useMemo(() => selectRailConversationIds(summaries, pinnedIds, activeId), [summaries, pinnedIds, activeId]);
  const byId = useMemo(() => new Map(summaries.map((summary) => [summary.conversationId, summary])), [summaries]);
  const pinnedRailIds = ids.filter((id) => pinnedIds.includes(id));
  const automaticRailIds = ids.filter((id) => !pinnedIds.includes(id));
  const needsYouCount = summaries.filter((summary) => summary.lifecycle.state === 'needs-user').length;
  const workingCount = summaries.filter((summary) => summary.lifecycle.state === 'working').length;
  const allConversationsLabel = needsYouCount > 0
    ? `All conversations — ${needsYouCount} need${needsYouCount === 1 ? 's' : ''} you`
    : workingCount > 0
      ? `All conversations — ${workingCount} working`
      : 'All conversations';

  const renderEntry = (id: string) => {
    const summary = byId.get(id);
    if (!summary) return null;
    const isPinned = pinnedIds.includes(id);
    const isActive = activeId === id;
    const label = `${summary.title} — ${isPinned ? 'Pinned' : statusLabel(summary.lifecycle.state)}`;
    const pinAtCapacity = !isPinned && pinnedIds.length >= 5;
    const pinLabel = pinAtCapacity
      ? 'Unpin a conversation before pinning another.'
      : `${isPinned ? 'Unpin' : 'Pin'} ${summary.title}`;
    return (
      <div key={id} className="group relative h-10 w-10 shrink-0">
        <ConversationTooltip label={label}>
          <button type="button" aria-label={label} aria-current={isActive ? 'true' : undefined} onClick={() => openConversations[id] ? switchConversation(id) : loadSavedConversation(id)} className={`flex h-10 w-10 items-center justify-center rounded-[11px] outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)] ${isActive ? 'bg-[var(--r-accent-soft)]' : 'hover:bg-[var(--r-surface-soft)]'}`}>
            <ConversationBubbleIcon identityColorSlot={summary.identityColorSlot} />
            {summary.lifecycle.state === 'needs-user' && <span className="absolute bottom-[3px] right-[3px] h-2 w-2 rounded-full bg-[var(--r-warning)] ring-2 ring-[var(--r-surface-muted)]" aria-hidden="true" />}
            {summary.lifecycle.state === 'working' && <span className="absolute bottom-[3px] right-[3px] h-2 w-2 animate-pulse rounded-full bg-[var(--r-accent)] ring-2 ring-[var(--r-surface-muted)] motion-reduce:animate-none" aria-hidden="true" />}
          </button>
        </ConversationTooltip>
        {isPinned && (
          <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center opacity-100 transition-opacity motion-reduce:transition-none group-hover:opacity-0 group-focus-within:opacity-0">
            <Icon name="push-pin" size={12} tone="active" className="scale-[0.667]" />
          </span>
        )}
        <ConversationTooltip label={pinLabel}>
          <button
            type="button"
            aria-label={pinLabel}
            aria-disabled={pinAtCapacity || undefined}
            onClick={(event) => {
              event.stopPropagation();
              if (pinAtCapacity) return;
              isPinned ? unpin(id) : pin(id);
            }}
            className={`group/pin pointer-events-none absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[var(--r-accent)] opacity-0 transition-opacity motion-reduce:transition-none focus:pointer-events-auto focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 ${pinAtCapacity ? 'cursor-not-allowed group-hover:opacity-60 group-focus-within:opacity-60 focus:opacity-60' : 'hover:text-[var(--r-accent-deep)]'}`}
          >
            <Icon name={isPinned ? 'push-pin-slash' : 'push-pin'} size={12} tone="inherit" className="scale-[0.667] transition-transform motion-reduce:transition-none group-hover/pin:scale-100 group-focus-visible/pin:scale-100" />
          </button>
        </ConversationTooltip>
      </div>
    );
  };

  return (
    <aside className="relative z-[60] w-[56px] shrink-0 border-l border-[var(--r-hairline)] bg-[var(--r-surface-muted)] px-2 py-3" aria-label="Conversations">
      <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto overflow-x-hidden pb-2">
        <ConversationTooltip label="New conversation">
          <button type="button" aria-label="New conversation" onClick={requestNew} className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[var(--r-accent)] text-white shadow-md transition-transform motion-reduce:transform-none motion-reduce:transition-none hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)] focus-visible:ring-offset-2">
            <Icon name="plus" size={16} tone="inherit" />
          </button>
        </ConversationTooltip>

        <div className="flex w-full flex-col items-center">
          <div className="flex w-full flex-col items-center gap-1">
            {pinnedRailIds.map(renderEntry)}
          </div>
          {pinnedRailIds.length > 0 && automaticRailIds.length > 0 && (
            <div aria-hidden="true" className="relative h-1 w-6 shrink-0">
              <span className="absolute inset-x-0 top-0.5 h-px bg-[var(--r-hairline-strong)]" />
            </div>
          )}
          <div className="flex w-full flex-col items-center gap-1">
            {automaticRailIds.map(renderEntry)}
          </div>
        </div>

        <ConversationTooltip label={allConversationsLabel}>
          <button type="button" aria-label={allConversationsLabel} aria-pressed={showPanel} onClick={togglePanel} className={`relative mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-[var(--r-ink-muted)] outline-none transition-colors motion-reduce:transition-none hover:text-[var(--r-ink-strong)] focus-visible:ring-2 focus-visible:ring-[var(--r-accent)] ${showPanel ? 'bg-[var(--r-accent-soft)] text-[var(--r-accent)]' : 'hover:bg-[var(--r-surface-soft)]'}`}>
            <Icon name="clock-counter-clockwise" size={16} tone="inherit" />
            {needsYouCount > 0 && <span className="absolute bottom-[3px] right-[3px] h-2 w-2 rounded-full bg-[var(--r-warning)] ring-2 ring-[var(--r-surface-muted)]" aria-hidden="true" />}
            {needsYouCount === 0 && workingCount > 0 && <span className="absolute bottom-[3px] right-[3px] h-2 w-2 animate-pulse rounded-full bg-[var(--r-accent)] ring-2 ring-[var(--r-surface-muted)] motion-reduce:animate-none" aria-hidden="true" />}
          </button>
        </ConversationTooltip>
      </div>
    </aside>
  );
}
