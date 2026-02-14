/**
 * SlashCommandPopup — Autocomplete popup for / commands.
 *
 * Shows when user types `/` at the start of input, with keyboard navigation
 * and command filtering.
 *
 * Keyboard handling is driven by the parent (ChatInput) via imperative ref,
 * not by window-level listeners — this avoids event ordering races.
 */

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Trash2,
  Plus,
  History,
  Minimize2,
  HelpCircle,
  Settings,
  Square,
  DollarSign,
} from 'lucide-react';
import { type SlashCommand, filterCommands, SLASH_COMMANDS } from './slashCommands';

// Map icon names to components
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Trash2,
  Plus,
  History,
  Minimize2,
  HelpCircle,
  Settings,
  Square,
  DollarSign,
};

export interface SlashCommandPopupHandle {
  /** Returns true if the key was handled by the popup */
  handleKeyDown(e: React.KeyboardEvent): boolean;
}

interface SlashCommandPopupProps {
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export const SlashCommandPopup = forwardRef<SlashCommandPopupHandle, SlashCommandPopupProps>(
  function SlashCommandPopup({ query, onSelect, onClose, position }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Filter commands based on query
    const commands = query ? filterCommands(query) : SLASH_COMMANDS;

    // Reset selection when commands list changes
    useEffect(() => {
      setSelectedIndex(0);
    }, [commands.length]);

    // Scroll selected item into view
    useEffect(() => {
      if (listRef.current) {
        // +1 to skip the "Commands" header div
        const selectedEl = listRef.current.children[selectedIndex + 1] as HTMLElement;
        selectedEl?.scrollIntoView({ block: 'nearest' });
      }
    }, [selectedIndex]);

    // Expose keyboard handler to parent via ref
    useImperativeHandle(ref, () => ({
      handleKeyDown(e: React.KeyboardEvent): boolean {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedIndex((i) => (i + 1) % commands.length);
            return true;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedIndex((i) => (i - 1 + commands.length) % commands.length);
            return true;
          case 'Enter':
          case 'Tab':
            e.preventDefault();
            if (commands[selectedIndex]) {
              onSelect(commands[selectedIndex]);
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
    }), [commands, selectedIndex, onSelect, onClose]);

    if (commands.length === 0) {
      return (
        <div
          className="absolute z-50 bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-editorWidget-border)] rounded-md shadow-lg py-1 min-w-[240px]"
          style={{ bottom: '100%', left: position.left, marginBottom: 4 }}
        >
          <div className="px-3 py-2 text-xs text-[var(--vscode-descriptionForeground)]">
            No commands found
          </div>
        </div>
      );
    }

    return (
      <div
        className="absolute z-50 bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-editorWidget-border)] rounded-md shadow-lg py-1 min-w-[280px] max-h-[280px] overflow-y-auto"
        style={{ bottom: '100%', left: position.left, marginBottom: 4 }}
        ref={listRef}
      >
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-editorWidget-border)]">
          Commands
        </div>
        {commands.map((cmd, index) => {
          const IconComponent = ICON_MAP[cmd.icon] || HelpCircle;
          return (
            <button
              key={cmd.id}
              className={`w-full px-3 py-2 flex items-start gap-2 text-left hover:bg-[var(--vscode-list-hoverBackground)] ${
                index === selectedIndex
                  ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                  : ''
              }`}
              onClick={() => onSelect(cmd)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <IconComponent
                size={16}
                className="mt-0.5 shrink-0 text-[var(--vscode-symbolIcon-functionForeground)]"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">/{cmd.id}</span>
                <div className="text-xs text-[var(--vscode-descriptionForeground)] truncate">
                  {cmd.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }
);
