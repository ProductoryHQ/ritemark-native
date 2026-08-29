import { useMemo, useState } from 'react';
import type { ConversationSummaryV1 } from '../../../../src/conversations/types';
import {
  Dialog,
  DialogBody,
  DialogButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Icon } from '../ui/Icon';
import { ConversationBubbleIcon } from './ConversationBubbleIcon';
import { ConversationTooltip } from './ConversationTooltip';
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
  if (summary.lifecycle.state === 'working') return 'Working';
  if (summary.lifecycle.state === 'needs-user') return 'Needs you';
  if (summary.lifecycle.state === 'interrupted') return 'Interrupted';
  return relativeTime(summary.lastActivityAt);
}

interface ConversationRowProps {
  summary: ConversationSummaryV1;
  pinned: boolean;
  current: boolean;
  onOpen: () => void;
  onRename: () => void;
  onPin: () => void;
  pinDisabled: boolean;
  onDelete: () => void;
}

interface DeleteTarget {
  summary: ConversationSummaryV1;
  recovery: boolean;
}

// Radix portals into the full webview, which also contains the permanent 56px rail.
// Offset by half the rail and reserve 16px margins inside the conversation pane.
const CONVERSATION_DIALOG_LAYOUT = 'left-[calc(50%_-_28px)] w-[calc(100%_-_88px)] max-w-[320px]';

function ConversationRow({
  summary,
  pinned,
  current,
  onOpen,
  onRename,
  onPin,
  pinDisabled,
  onDelete,
}: ConversationRowProps) {
  const pinLabel = pinDisabled
    ? 'Unpin a conversation before pinning another.'
    : `${pinned ? 'Unpin' : 'Pin'} ${summary.title}`;
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
        <button type="button" onClick={onRename} aria-label={`Rename ${summary.title}`} className="flex h-7 w-7 items-center justify-center rounded-[7px] hover:bg-[var(--r-surface)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]">
          <Icon name="pencil-simple" size={14} />
        </button>
        <ConversationTooltip label={pinLabel}>
          <button type="button" onClick={() => { if (!pinDisabled) onPin(); }} aria-label={pinLabel} aria-disabled={pinDisabled || undefined} className={`flex h-7 w-7 items-center justify-center rounded-[7px] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)] ${pinDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[var(--r-surface)]'}`}>
            <Icon name={pinned ? 'push-pin-slash' : 'push-pin'} size={14} />
          </button>
        </ConversationTooltip>
        <button type="button" onClick={onDelete} aria-label={`Delete ${summary.title}`} className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--r-ink-muted)] hover:bg-[var(--r-surface)] hover:text-[var(--r-error)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]">
          <Icon name="trash" size={14} tone="inherit" />
        </button>
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
  return (
    <div className="group flex items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-[var(--r-surface-soft)]">
      <ConversationBubbleIcon identityColorSlot={summary.identityColorSlot} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-[var(--r-ink-strong)]">{summary.title}</div>
        <div className="mt-0.5 text-[11px] text-[var(--r-ink-muted)]">Project unknown</div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100">
        <button type="button" onClick={onMove} aria-label={`Move ${summary.title} to this project`} className="flex h-7 w-7 items-center justify-center rounded-[7px] hover:bg-[var(--r-surface)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]">
          <Icon name="folder-open" size={14} />
        </button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${summary.title}`} className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--r-ink-muted)] hover:bg-[var(--r-surface)] hover:text-[var(--r-error)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]">
          <Icon name="trash" size={14} tone="inherit" />
        </button>
      </div>
    </div>
  );
}

function RenameConversationDialog({
  target,
  title,
  onTitleChange,
  onClose,
  onSave,
}: {
  target: ConversationSummaryV1 | null;
  title: string;
  onTitleChange: (title: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={CONVERSATION_DIALOG_LAYOUT}>
        <form onSubmit={(event) => { event.preventDefault(); onSave(); }}>
          <DialogHeader><DialogTitle>Rename conversation</DialogTitle></DialogHeader>
          <DialogBody>
            <DialogDescription className="sr-only">Choose a new title for this conversation.</DialogDescription>
            <label className="block text-[12px] font-medium text-[var(--r-ink-body)]" htmlFor="conversation-title">Title</label>
            <input
              id="conversation-title"
              autoFocus
              maxLength={80}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="mt-1.5 w-full rounded-[6px] border border-[var(--r-hairline-strong)] bg-[var(--r-surface)] px-3 py-2 text-[13px] text-[var(--r-ink-strong)] outline-none focus:border-[var(--r-accent)] focus:ring-4 focus:ring-[var(--r-ring-color)]"
            />
          </DialogBody>
          <DialogFooter>
            <DialogButton type="button" variant="secondary" onClick={onClose}>Cancel</DialogButton>
            <DialogButton type="submit" disabled={!title.trim()}>Save</DialogButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConversationDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isRunning = target?.summary.lifecycle.state === 'working' || target?.summary.lifecycle.state === 'needs-user';
  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={CONVERSATION_DIALOG_LAYOUT}>
        <DialogHeader><DialogTitle>Delete conversation?</DialogTitle></DialogHeader>
        <DialogBody className="min-w-0">
          <DialogDescription className="break-words">“{target?.summary.title}” will be removed from {target?.recovery ? 'earlier conversations' : 'this project'}.</DialogDescription>
        </DialogBody>
        <DialogFooter>
          <DialogButton type="button" variant="secondary" onClick={onClose}>Cancel</DialogButton>
          <DialogButton type="button" variant="danger" onClick={onConfirm}>{isRunning ? 'Stop and delete' : 'Delete'}</DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const rename = useAISidebarStore((state) => state.renameHostConversation);
  const moveEarlier = useAISidebarStore((state) => state.moveEarlierConversation);
  const remove = useAISidebarStore((state) => state.deleteHostConversation);
  const toggle = useAISidebarStore((state) => state.toggleHistoryPanel);
  const notice = useAISidebarStore((state) => state.conversationStoreNotice);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<ConversationSummaryV1 | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const ordered = useMemo(
    () => [...summaries].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt) || a.conversationId.localeCompare(b.conversationId)),
    [summaries],
  );
  const pinned = ordered.filter((summary) => pinnedIds.includes(summary.conversationId));
  const activeRecent = ordered.filter((summary) => !pinnedIds.includes(summary.conversationId));

  const renderRows = (rows: ConversationSummaryV1[]) => rows.map((summary) => (
    <ConversationRow
      key={summary.conversationId}
      summary={summary}
      pinned={pinnedIds.includes(summary.conversationId)}
      current={summary.conversationId === activeId}
      onOpen={() => openConversations[summary.conversationId] ? switchConversation(summary.conversationId) : open(summary.conversationId)}
      onRename={() => { setRenameTarget(summary); setRenameTitle(summary.title); }}
      onPin={() => pinnedIds.includes(summary.conversationId) ? unpin(summary.conversationId) : pin(summary.conversationId)}
      pinDisabled={!pinnedIds.includes(summary.conversationId) && pinnedIds.length >= 5}
      onDelete={() => setDeleteTarget({ summary, recovery: false })}
    />
  ));

  const renderEarlierRows = () => earlier.map((summary) => (
    <EarlierConversationRow
      key={summary.conversationId}
      summary={summary}
      onMove={() => moveEarlier(summary.conversationId)}
      onDelete={() => setDeleteTarget({ summary, recovery: true })}
    />
  ));

  const saveRename = () => {
    if (!renameTarget || !renameTitle.trim()) return;
    rename(renameTarget.conversationId, renameTitle);
    setRenameTarget(null);
  };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    const isRunning = deleteTarget.summary.lifecycle.state === 'working' || deleteTarget.summary.lifecycle.state === 'needs-user';
    remove(deleteTarget.summary.conversationId, isRunning, deleteTarget.recovery);
    setDeleteTarget(null);
  };

  return (
    <section className="absolute inset-y-0 left-0 right-[56px] z-50 flex flex-col bg-[var(--r-surface)]" aria-label="All conversations">
      <div className="flex items-center justify-between border-b border-[var(--r-hairline)] px-4 py-3">
        <div><h2 className="m-0 text-[14px] font-semibold">Conversations</h2><p className="m-0 mt-0.5 text-[11px] text-[var(--r-ink-muted)]">Saved in this project</p></div>
        <button type="button" onClick={toggle} aria-label="Close conversations" className="flex h-8 w-8 items-center justify-center rounded-[8px] hover:bg-[var(--r-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]"><Icon name="x" size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {notice && <div role="status" className="mx-2 mb-3 rounded-[8px] border border-[var(--r-warning)] bg-[var(--r-warning-soft)] px-3 py-2 text-[12px]">{notice}</div>}
        {ordered.length === 0 && !notice && <div className="flex h-full flex-col items-center justify-center px-6 text-center text-[12px] text-[var(--r-ink-muted)]"><Icon name="chat-circle" size={20} className="mb-3 opacity-50" /><div>No conversations yet</div><div className="mt-1 text-[11px]">Start a conversation and it will appear here.</div></div>}
        {pinned.length > 0 && <div className="mb-4"><div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--r-ink-muted)]">Pinned</div>{renderRows(pinned)}</div>}
        {activeRecent.length > 0 && <div className="mb-4"><div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--r-ink-muted)]">Active &amp; recent</div>{renderRows(activeRecent)}</div>}
        {earlier.length > 0 && <div><div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--r-ink-muted)]">Project unknown</div>{renderEarlierRows()}</div>}
      </div>
      <RenameConversationDialog target={renameTarget} title={renameTitle} onTitleChange={setRenameTitle} onClose={() => setRenameTarget(null)} onSave={saveRename} />
      <DeleteConversationDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </section>
  );
}
