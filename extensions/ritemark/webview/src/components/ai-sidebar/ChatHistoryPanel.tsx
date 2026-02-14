/**
 * ChatHistoryPanel — Slide-out panel showing saved conversations.
 *
 * Features:
 * - Date grouping (Today, Yesterday, This Week, Older)
 * - Click to resume conversation
 * - Delete button with confirmation
 * - New Chat button at top
 */

import { useState } from 'react';
import { MessageSquarePlus, Trash2, Bot, Sparkles, X, History } from 'lucide-react';
import { useAISidebarStore } from './store';
import type { SavedConversation } from './chatHistoryStorage';
import type { AgentId } from './types';

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
  conversations: SavedConversation[]
): Record<DateGroup, SavedConversation[]> {
  const groups: Record<DateGroup, SavedConversation[]> = {
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

// ── Agent Badge ────────────────────────────────────────────────────────

function AgentBadge({ agentId }: { agentId: AgentId }) {
  if (agentId === 'claude-code') {
    return (
      <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
        <Bot size={10} />
        <span>Code</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
      <Sparkles size={10} />
      <span>Agent</span>
    </span>
  );
}

// ── Conversation Item ──────────────────────────────────────────────────

interface ConversationItemProps {
  conversation: SavedConversation;
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
      className={`
        group flex items-start gap-2 p-2 rounded cursor-pointer
        transition-colors duration-100
        ${isActive
          ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
          : 'hover:bg-[var(--vscode-list-hoverBackground)]'
        }
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium truncate flex-1">
            {conversation.title}
          </span>
          <AgentBadge agentId={conversation.agentId} />
        </div>
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
          {formatTime(conversation.updatedAt)}
        </span>
      </div>
      <button
        onClick={handleDelete}
        className={`
          shrink-0 p-1 rounded transition-colors
          ${confirmDelete
            ? 'bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-inputValidation-errorForeground)]'
            : 'opacity-0 group-hover:opacity-100 hover:bg-[var(--vscode-toolbar-hoverBackground)]'
          }
        `}
        title={confirmDelete ? 'Click again to confirm delete' : 'Delete conversation'}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <History size={48} className="mb-4 opacity-30" />
      <p className="text-[13px] text-[var(--vscode-descriptionForeground)]">
        No conversations yet
      </p>
      <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mt-1">
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
  const startNewConversation = useAISidebarStore((s) => s.startNewConversation);
  const toggleHistoryPanel = useAISidebarStore((s) => s.toggleHistoryPanel);

  const grouped = groupConversations(savedConversations);
  const hasConversations = savedConversations.length > 0;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[var(--vscode-sideBar-background)] animate-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vscode-panel-border)]">
        <div className="flex items-center gap-2">
          <History size={16} />
          <span className="text-[13px] font-medium">Chat History</span>
        </div>
        <button
          onClick={toggleHistoryPanel}
          className="p-1 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-2 py-2 border-b border-[var(--vscode-panel-border)]">
        <button
          onClick={startNewConversation}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded text-[12px] font-medium bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] transition-colors"
        >
          <MessageSquarePlus size={14} />
          New Chat
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
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">
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
