/**
 * Sprint 122 (#282) — the conversation you are in, named, with its actions.
 *
 * Until now the active conversation was named only in the rail's hover
 * tooltip. This header names it above the transcript and offers the same three
 * actions as History — rename, pin or unpin, delete — through the same code:
 * `conversationPinState` for the five-pin limit and its wording, and
 * `useConversationDialogs` for the very dialogs History opens.
 *
 * The actions sit behind one ⋮ button (Jarmo, 2026-09-23), so the title keeps
 * the width. A conversation the host has not saved yet has no summary, so
 * there is nothing to rename, pin or delete: the header shows its provisional
 * title and no menu. A long title truncates on screen; the heading keeps the
 * whole string, so a screen reader reads it in full, and the tooltip shows it.
 */
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/tooltip';
import { useConversationDialogs } from './ConversationDialogs';
import { conversationPinState, conversationStatusLabel } from './conversationActionsModel';
import { useAISidebarStore } from './store';
import { deriveThreadTitle, NEW_THREAD_TITLE } from './threadStatus';

export function ConversationHeader() {
  const activeId = useAISidebarStore((state) => state.activeConversationId);
  const summaries = useAISidebarStore((state) => state.hostConversations);
  const pinnedIds = useAISidebarStore((state) => state.pinnedConversationIds);
  const activeConversation = useAISidebarStore((state) =>
    state.activeConversationId ? state.conversations[state.activeConversationId] ?? null : null,
  );
  const pin = useAISidebarStore((state) => state.pinConversation);
  const unpin = useAISidebarStore((state) => state.unpinConversation);
  const { requestRename, requestDelete, dialogs } = useConversationDialogs();

  const summary = activeId ? summaries.find((item) => item.conversationId === activeId) ?? null : null;
  const title = summary?.title ?? (activeConversation ? deriveThreadTitle(activeConversation) : NEW_THREAD_TITLE);
  const status = summary ? conversationStatusLabel(summary) : null;
  const pinState = summary ? conversationPinState(summary.conversationId, title, pinnedIds) : null;
  const menuLabel = `Actions for ${title}`;

  return (
    <header
      aria-label="Current conversation"
      className="flex min-h-[40px] shrink-0 items-center gap-2 border-b border-[var(--r-hairline)] bg-[var(--vscode-sideBar-background)] py-1 pl-3 pr-1.5"
    >
      <Tooltip label={title} className="min-w-0 flex-1">
        <h2 className="m-0 min-w-0 flex-1 truncate font-ui text-[13px] font-semibold leading-[1.35] text-[var(--r-ink-strong)]">
          {title}
        </h2>
      </Tooltip>

      {status && (
        <span role="status" className="shrink-0 font-ui text-[11px] text-[var(--r-ink-muted)]">
          {status}
        </span>
      )}

      {summary && pinState && (
        <DropdownMenu modal={false}>
          <Tooltip label="Conversation actions">
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-[7px] text-[var(--r-ink-muted)]" aria-label={menuLabel}>
                <Icon name="dots-three-vertical" size={16} />
              </Button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => requestRename(summary)}>
              <Icon name="pencil-simple" size={14} />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={pinState.atCapacity}
              onSelect={() => {
                if (pinState.pinned) unpin(summary.conversationId);
                else pin(summary.conversationId);
              }}
            >
              <Icon name={pinState.icon} size={14} />
              {pinState.atCapacity ? pinState.label : pinState.action}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem tone="danger" onSelect={() => requestDelete(summary)}>
              <Icon name="trash" size={14} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {dialogs}
    </header>
  );
}
