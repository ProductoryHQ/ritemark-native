/**
 * AgentMentionPopup — Autocomplete popup for @agent mentions.
 *
 * Shows when user types `@` in the chat input, with keyboard navigation
 * and fuzzy filtering.
 *
 * Keyboard handling is driven by the parent (ChatInput) via imperative ref,
 * not by window-level listeners — this avoids event ordering races.
 */

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Bot } from 'lucide-react';
import { type AgentDefinition, filterAgents, AVAILABLE_AGENTS } from './agentRegistry';

export interface AgentMentionPopupHandle {
  /** Returns true if the key was handled by the popup */
  handleKeyDown(e: React.KeyboardEvent): boolean;
}

interface AgentMentionPopupProps {
  query: string;
  onSelect: (agent: AgentDefinition) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export const AgentMentionPopup = forwardRef<AgentMentionPopupHandle, AgentMentionPopupProps>(
  function AgentMentionPopup({ query, onSelect, onClose, position }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Filter agents based on query
    const agents = query ? filterAgents(query) : AVAILABLE_AGENTS;

    // Reset selection when agents list changes
    useEffect(() => {
      setSelectedIndex(0);
    }, [agents.length]);

    // Scroll selected item into view
    useEffect(() => {
      if (listRef.current) {
        const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
        selectedEl?.scrollIntoView({ block: 'nearest' });
      }
    }, [selectedIndex]);

    // Expose keyboard handler to parent via ref
    useImperativeHandle(ref, () => ({
      handleKeyDown(e: React.KeyboardEvent): boolean {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedIndex((i) => (i + 1) % agents.length);
            return true;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedIndex((i) => (i - 1 + agents.length) % agents.length);
            return true;
          case 'Enter':
          case 'Tab':
            e.preventDefault();
            if (agents[selectedIndex]) {
              onSelect(agents[selectedIndex]);
            }
            return true;
          case 'Escape':
            e.preventDefault();
            onClose();
            return true;
          default:
            return false;
        }
      },
    }), [agents, selectedIndex, onSelect, onClose]);

    if (agents.length === 0) {
      return (
        <div
          className="absolute z-50 bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-editorWidget-border)] rounded-md shadow-lg py-1 min-w-[240px]"
          style={{ bottom: '100%', left: position.left, marginBottom: 4 }}
        >
          <div className="px-3 py-2 text-xs text-[var(--vscode-descriptionForeground)]">
            No agents found
          </div>
        </div>
      );
    }

    return (
      <div
        className="absolute z-50 bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-editorWidget-border)] rounded-md shadow-lg py-1 min-w-[280px] max-h-[240px] overflow-y-auto"
        style={{ bottom: '100%', left: position.left, marginBottom: 4 }}
        ref={listRef}
      >
        {agents.map((agent, index) => (
          <button
            key={agent.id}
            className={`w-full px-3 py-2 flex items-start gap-2 text-left hover:bg-[var(--vscode-list-hoverBackground)] ${
              index === selectedIndex
                ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                : ''
            }`}
            onClick={() => onSelect(agent)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Bot
              size={16}
              className="mt-0.5 shrink-0 text-[var(--vscode-symbolIcon-classForeground)]"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{agent.name}</div>
              <div className="text-xs text-[var(--vscode-descriptionForeground)] truncate">
                {agent.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);
