import { useMemo, type ReactNode } from 'react';
import type { ConversationSummaryV1 } from '../../../../src/conversations/types';
import { Icon, type PhosphorIconName } from '../ui/Icon';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, MoreActionsTrigger } from '../ui/dropdown-menu';
import { ConversationBubbleIcon } from './ConversationBubbleIcon';
import { useConversationDialogs } from './ConversationDialogs';
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

// Row frame. The gap beside the icon is 12px and tightens towards 8px only in a row narrower than
// about 195px, so the longest status word still fits at the narrowest side bar.
const ROW = 'group relative flex items-start gap-[clamp(0.5rem,7%,0.75rem)] rounded-[10px] px-3 py-2.5';
// A title wraps to a second line before it is cut.
const ROW_TITLE = 'line-clamp-2 break-words text-[13px] font-medium text-[var(--r-ink-strong)]';
// The icon stands beside the title's first line (13px at 1.5), however many lines follow.
const ROW_ICON = 'h-[19.5px] items-center';
// The row's More actions (…) button: top right, level with the title's first line, shown on hover,
// keyboard focus and while its menu is open (ritemark-design: webview-ui.md § More actions menus).
const ROW_MORE = 'relative z-10 -mr-1.5 -mt-[2.25px] opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100';

interface RowAction { label: string; icon: PhosphorIconName; danger?: boolean; disabled?: boolean; run: () => void }

/** A row's actions, in its More actions menu and its right-click menu alike. */
function RowMenus({ className, title, actions, children }: { className: string; title: string; actions: RowAction[]; children: ReactNode }) {
  const safe = actions.filter((action) => !action.danger);
  const danger = actions.filter((action) => action.danger);
  const itemClass = 'gap-2 text-[13px] [&_svg]:shrink-0 [&_svg]:fill-current';
  const dangerClass = 'text-[var(--r-error)] focus:text-[var(--r-error)]';
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className={className}>
          {children}
          <DropdownMenu modal={false}>
            <MoreActionsTrigger label={`More actions for ${title}`} className={ROW_MORE} />
            <DropdownMenuContent align="end">
              {safe.map((action) => (
                <DropdownMenuItem key={action.label} disabled={action.disabled} onSelect={action.run}>
                  <Icon name={action.icon} size={14} />
                  {action.label}
                </DropdownMenuItem>
              ))}
              {danger.length > 0 && safe.length > 0 && <DropdownMenuSeparator />}
              {danger.map((action) => (
                <DropdownMenuItem key={action.label} tone="danger" onSelect={action.run}>
                  <Icon name={action.icon} size={14} />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {safe.map((action) => (
          <ContextMenuItem key={action.label} disabled={action.disabled} className={itemClass} onSelect={action.run}>
            <Icon name={action.icon} size={14} />
            {action.label}
          </ContextMenuItem>
        ))}
        {danger.length > 0 && safe.length > 0 && <ContextMenuSeparator />}
        {danger.map((action) => (
          <ContextMenuItem key={action.label} className={`${itemClass} ${dangerClass}`} onSelect={action.run}>
            <Icon name={action.icon} size={14} />
            {action.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
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

export function ConversationRow({
  summary,
  pin,
  current,
  onOpen,
  onRename,
  onPin,
  onDelete,
}: ConversationRowProps) {
  const actions: RowAction[] = [
    { label: 'Rename…', icon: 'pencil-simple', run: onRename },
    { label: pin.atCapacity ? pin.label : pin.action, icon: pin.icon as PhosphorIconName, disabled: pin.atCapacity, run: onPin },
    { label: 'Delete', icon: 'trash', danger: true, run: onDelete },
  ];
  return (
    <RowMenus className={`${ROW} ${current ? 'bg-[var(--r-accent-soft)]' : 'hover:bg-[var(--r-surface-soft)]'}`} title={summary.title} actions={actions}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${summary.title}`}
        className="absolute inset-0 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]"
      />
      <ConversationBubbleIcon identityColorSlot={summary.identityColorSlot} className={ROW_ICON} />
      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className={ROW_TITLE}>{summary.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[var(--r-ink-muted)]">
          <span className="whitespace-nowrap">{lifecycleCopy(summary)}</span>
          {current && <span className="flex items-center gap-1.5 whitespace-nowrap"><span aria-hidden="true">·</span><span>Current</span></span>}
        </div>
      </div>
    </RowMenus>
  );
}

export function EarlierConversationRow({
  summary,
  onMove,
  onDelete,
}: {
  summary: ConversationSummaryV1;
  onMove: () => void;
  onDelete: () => void;
}) {
  const actions: RowAction[] = [
    { label: 'Move to this project', icon: 'folder-open', run: onMove },
    { label: 'Delete', icon: 'trash', danger: true, run: onDelete },
  ];
  return (
    <RowMenus className={`${ROW} hover:bg-[var(--r-surface-soft)]`} title={summary.title} actions={actions}>
      <ConversationBubbleIcon identityColorSlot={summary.identityColorSlot} className={ROW_ICON} />
      <div className="min-w-0 flex-1">
        <div className={ROW_TITLE}>{summary.title}</div>
        <div className="mt-0.5 text-[11px] text-[var(--r-ink-muted)]">Project unknown</div>
      </div>
    </RowMenus>
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
      <div className="flex items-center justify-between gap-2 border-b border-[var(--r-hairline)] px-4 py-3">
        <div className="min-w-0"><h2 className="m-0 truncate text-[14px] font-semibold">Conversations</h2><p className="m-0 mt-0.5 text-[11px] text-[var(--r-ink-muted)]">Saved in this project</p></div>
        <button type="button" onClick={toggle} aria-label="Close conversations" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] hover:bg-[var(--r-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)]"><Icon name="x" size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
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
