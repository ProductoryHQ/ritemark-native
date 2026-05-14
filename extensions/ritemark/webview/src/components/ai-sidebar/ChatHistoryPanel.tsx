/**
 * ChatHistoryPanel — Slide-out panel showing saved conversations.
 *
 * Features:
 * - Date grouping (Today, Yesterday, This Week, Older)
 * - Click to resume conversation
 * - Delete button with confirmation
 */

import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { useAISidebarStore } from './store';
import type { SavedConversationV2 } from './chatHistoryStorage';

// ── Date Grouping ──────────────────────────────────────────────────────

type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'older';

function getDateGroup(timestamp: number): DateGroup {
  const now = new Date();
  const date = new Date(timestamp);

  // Reset time to start of day for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate.getTime() === today.getTime()) return 'today';
  if (itemDate.getTime() === yesterday.getTime()) return 'yesterday';
  if (itemDate.getTime() >= weekAgo.getTime()) return 'thisWeek';
  return 'older';
}

function groupConversations(
  conversations: SavedConversationV2[]
): Record<DateGroup, SavedConversationV2[]> {
  const groups: Record<DateGroup, SavedConversationV2[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  for (const conv of conversations) {
    const group = getDateGroup(conv.updatedAt);
    groups[group].push(conv);
  }

  return groups;
}

const groupLabels: Record<DateGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  older: 'Older',
};

// ── Conversation Item ──────────────────────────────────────────────────

interface ConversationItemProps {
  conversation: SavedConversationV2;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ConversationItem({ conversation, isActive, onSelect, onDelete }: ConversationItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Reset confirmation after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={`group w-full px-3 py-2 flex items-start gap-2 text-left cursor-pointer hover:bg-[var(--r-surface-soft)] ${
        isActive
          ? 'bg-[var(--r-accent-soft)] text-[var(--r-accent-deep)]'
          : ''
      }`}
    >
      <Icon
        name="clock-counter-clockwise"
        size={16}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{conversation.title}</div>
        <div className="text-xs text-[var(--r-ink-muted)] truncate">
          {formatTime(conversation.updatedAt)}
        </div>
      </div>
      <button
        onClick={handleDelete}
        className={`
          shrink-0 p-1 rounded transition-colors
          ${confirmDelete
            ? 'bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-inputValidation-errorForeground)]'
            : 'opacity-0 group-hover:opacity-100 hover:bg-[var(--r-surface-soft)]'
          }
        `}
        title={confirmDelete ? 'Click again to confirm delete' : 'Delete conversation'}
      >
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <Icon name="clock-counter-clockwise" size={20} className="mb-4 opacity-30" />
      <p className="text-[13px] text-[var(--r-ink-muted)]">
        No conversations yet
      </p>
      <p className="text-[11px] text-[var(--r-ink-muted)] mt-1">
        Your chat history will appear here
      </p>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────

export function ChatHistoryPanel() {
  const savedConversations = useAISidebarStore((s) => s.savedConversations);
  const currentConversationId = useAISidebarStore((s) => s.currentConversationId);
  const loadSavedConversation = useAISidebarStore((s) => s.loadSavedConversation);
  const deleteSavedConversation = useAISidebarStore((s) => s.deleteSavedConversation);
  const toggleHistoryPanel = useAISidebarStore((s) => s.toggleHistoryPanel);

  const grouped = groupConversations(savedConversations);
  const hasConversations = savedConversations.length > 0;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[var(--vscode-sideBar-background)] animate-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--r-hairline)]">
        <div className="flex items-center gap-2">
          <Icon name="clock-counter-clockwise" size={16} />
          <span className="text-[13px] font-medium">Chat History</span>
        </div>
        <button
          onClick={toggleHistoryPanel}
          className="p-1 rounded hover:bg-[var(--r-surface-soft)]"
          title="Close"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {!hasConversations ? (
          <EmptyState />
        ) : (
          <>
            {(['today', 'yesterday', 'thisWeek', 'older'] as DateGroup[]).map((group) => {
              if (grouped[group].length === 0) return null;
              return (
                <div key={group} className="mb-3">
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--r-ink-muted)]">
                    {groupLabels[group]}
                  </div>
                  {grouped[group].map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={conv.id === currentConversationId}
                      onSelect={() => loadSavedConversation(conv.id)}
                      onDelete={() => deleteSavedConversation(conv.id)}
                    />
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
