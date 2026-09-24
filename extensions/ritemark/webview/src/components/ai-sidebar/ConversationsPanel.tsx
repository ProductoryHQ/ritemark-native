import { useMemo } from 'react';
import type { ConversationSummaryV1 } from '../../../../src/conversations/types';
import { Icon } from '../ui/Icon';
import { ConversationBubbleIcon } from './ConversationBubbleIcon';
import { useConversationDialogs } from './ConversationDialogs';
import { ConversationTooltip } from './ConversationTooltip';
import { conversationPinState, conversationStatusLabel, type ConversationPinState } from './conversationActionsModel';
import { useAISidebarStore } from './store';

function relativeTime(value: string): string {
  const timestamp = Date.parse(value);
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function lifecycleCopy(summary: ConversationSummaryV1): string {
  return conversationStatusLabel(summary) ?? relativeTime(summary.lastActivityAt);
}

interface ConversationRowProps {
  summary: ConversationSummaryV1;
  pin: ConversationPinState;
  current: boolean;
  onOpen: () => void;
  onRename: () => void;
  onPin: () => void;
  onDelete: () => void;
}

function ConversationRow({
  summary,
  pin,
  current,
  onOpen,
  onRename,
  onPin,
  onDelete,
}: ConversationRowProps) {
  const renameLabel = `Rename ${summary.title}`;
  const deleteLabel = `Delete ${summary.title}`;
  return (
    <div className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 ${current ? 'bg-[var(--r-accent-soft)]' : 'hover:bg-[var(--r-surface-soft)]'}`}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${summary.title}`}
        className="absolute inset-0 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]"
      />
      <ConversationBubbleIcon identityColorSlot={summary.identityColorSlot} />
      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-[var(--r-ink-strong)]">{summary.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--r-ink-muted)]">
          <span>{lifecycleCopy(summary)}</span>
          {current && <><span aria-hidden="true">·</span><span>Current</span></>}
        </div>
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-1 opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100">
        <ConversationTooltip label={renameLabel}>
          <button type="button" onClick={onRename} aria-label={renameLabel} className="flex h-7 w-7 items-center justify-center rounded-[7px] hover:bg-[var(--r-surface)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]">
            <Icon name="pencil-simple" size={14} />
          </button>
        </ConversationTooltip>
        <ConversationTooltip label={pin.label}>
          <button type="button" onClick={() => { if (!pin.atCapacity) onPin(); }} aria-label={pin.label} aria-disabled={pin.atCapacity || undefined} className={`flex h-7 w-7 items-center justify-center rounded-[7px] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)] ${pin.atCapacity ? 'cursor-not-allowed opacity-50' : 'hover:bg-[var(--r-surface)]'}`}>
            <Icon name={pin.icon} size={14} />
          </button>
        </ConversationTooltip>
        <ConversationTooltip label={deleteLabel}>
          <button type="button" onClick={onDelete} aria-label={deleteLabel} className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--r-ink-muted)] hover:bg-[var(--r-surface)] hover:text-[var(--r-error)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]">
            <Icon name="trash" size={14} tone="inherit" />
          </button>
        </ConversationTooltip>
      </div>
    </div>
  );
}

function EarlierConversationRow({
  summary,
  onMove,
  onDelete,
}: {
  summary: ConversationSummaryV1;
  onMove: () => void;
  onDelete: () => void;
}) {
  const moveLabel = `Move ${summary.title} to this project`;
  const deleteLabel = `Delete ${summary.title}`;
  return (
    <div className="group flex items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-[var(--r-surface-soft)]">
      <ConversationBubbleIcon identityColorSlot={summary.identityColorSlot} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-[var(--r-ink-strong)]">{summary.title}</div>
        <div className="mt-0.5 text-[11px] text-[var(--r-ink-muted)]">Project unknown</div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100">
        <ConversationTooltip label={moveLabel}>
          <button type="button" onClick={onMove} aria-label={moveLabel} className="flex h-7 w-7 items-center justify-center rounded-[7px] hover:bg-[var(--r-surface)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]">
            <Icon name="folder-open" size={14} />
          </button>
        </ConversationTooltip>
        <ConversationTooltip label={deleteLabel}>
          <button type="button" onClick={onDelete} aria-label={deleteLabel} className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--r-ink-muted)] hover:bg-[var(--r-surface)] hover:text-[var(--r-error)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]">
            <Icon name="trash" size={14} tone="inherit" />
          </button>
        </ConversationTooltip>
      </div>
    </div>
  );
}

export function ConversationsPanel() {
  const summaries = useAISidebarStore((state) => state.hostConversations);
  const earlier = useAISidebarStore((state) => state.earlierConversations);
  const pinnedIds = useAISidebarStore((state) => state.pinnedConversationIds);
  const activeId = useAISidebarStore((state) => state.activeConversationId);
  const open = useAISidebarStore((state) => state.loadSavedConversation);
  const switchConversation = useAISidebarStore((state) => state.switchConversation);
  const openConversations = useAISidebarStore((state) => state.conversations);
  const pin = useAISidebarStore((state) => state.pinConversation);
  const unpin = useAISidebarStore((state) => state.unpinConversation);
  const moveEarlier = useAISidebarStore((state) => state.moveEarlierConversation);
  const toggle = useAISidebarStore((state) => state.toggleHistoryPanel);
  const notice = useAISidebarStore((state) => state.conversationStoreNotice);
  const { requestRename, requestDelete, dialogs } = useConversationDialogs();

  const ordered = useMemo(
    () => [...summaries].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt) || a.conversationId.localeCompare(b.conversationId)),
    [summaries],
  );
  const pinned = ordered.filter((summary) => pinnedIds.includes(summary.conversationId));
  const activeRecent = ordered.filter((summary) => !pinnedIds.includes(summary.conversationId));

  const renderRows = (rows: ConversationSummaryV1[]) => rows.map((summary) => {
    const pinState = conversationPinState(summary.conversationId, summary.title, pinnedIds);
    return (
      <ConversationRow
        key={summary.conversationId}
        summary={summary}
        pin={pinState}
        current={summary.conversationId === activeId}
        onOpen={() => openConversations[summary.conversationId] ? switchConversation(summary.conversationId) : open(summary.conversationId)}
        onRename={() => requestRename(summary)}
        onPin={() => pinState.pinned ? unpin(summary.conversationId) : pin(summary.conversationId)}
        onDelete={() => requestDelete(summary)}
      />
    );
  });

  const renderEarlierRows = () => earlier.map((summary) => (
    <EarlierConversationRow
      key={summary.conversationId}
      summary={summary}
      onMove={() => moveEarlier(summary.conversationId)}
      onDelete={() => requestDelete(summary, true)}
    />
  ));

  return (
    <section className="absolute inset-y-0 left-0 right-[56px] z-50 flex flex-col bg-[var(--r-surface)]" aria-label="All conversations">
      <div className="flex items-center justify-between border-b border-[var(--r-hairline)] px-4 py-3">
        <div><h2 className="m-0 text-[14px] font-semibold">Conversations</h2><p className="m-0 mt-0.5 text-[11px] text-[var(--r-ink-muted)]">Saved in this project</p></div>
        <button type="button" onClick={toggle} aria-label="Close conversations" className="flex h-8 w-8 items-center justify-center rounded-[8px] hover:bg-[var(--r-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]"><Icon name="x" size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {notice && <div role="status" className="mx-2 mb-3 flex items-start gap-2 rounded-lg border border-[var(--r-hairline)] bg-[var(--r-surface)] px-3 py-2 text-[12px] leading-[1.45] text-[var(--r-ink-strong)] shadow-[0_1px_2px_rgba(30,27,75,0.04)]"><span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--r-warning-soft)] text-[var(--r-warning)]"><Icon name="warning" size={12} tone="inherit" /></span><span className="min-w-0 flex-1">{notice}</span></div>}
        {ordered.length === 0 && !notice && <div className="flex h-full flex-col items-center justify-center px-6 text-center text-[12px] text-[var(--r-ink-muted)]"><Icon name="chat-circle" size={20} className="mb-3 opacity-50" /><div>No conversations yet</div><div className="mt-1 text-[11px]">Start a conversation and it will appear here.</div></div>}
        {pinned.length > 0 && <div className="mb-4"><div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--r-ink-muted)]">Pinned</div>{renderRows(pinned)}</div>}
        {activeRecent.length > 0 && <div className="mb-4"><div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--r-ink-muted)]">Active &amp; recent</div>{renderRows(activeRecent)}</div>}
        {earlier.length > 0 && <div><div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--r-ink-muted)]">Project unknown</div>{renderEarlierRows()}</div>}
      </div>
      {dialogs}
    </section>
  );
}
