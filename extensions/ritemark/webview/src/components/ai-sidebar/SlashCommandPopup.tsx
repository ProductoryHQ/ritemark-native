/**
 * SlashCommandPopup — Autocomplete popup for / commands.
 *
 * Shows when user types `/` at the start of input, with keyboard navigation
 * and command filtering.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Languages,
  Pencil,
  Maximize2,
  CheckCircle,
  HelpCircle,
  List,
  Minimize2,
} from 'lucide-react';
import { type SlashCommand, filterCommands, SLASH_COMMANDS } from './slashCommands';

// Map icon names to components
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  FileText,
  Languages,
  Pencil,
  Maximize2,
  CheckCircle,
  HelpCircle,
  List,
  Minimize2,
};

interface SlashCommandPopupProps {
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function SlashCommandPopup({
  query,
  onSelect,
  onClose,
  position,
}: SlashCommandPopupProps) {
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
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % commands.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + commands.length) % commands.length);
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (commands[selectedIndex]) {
            onSelect(commands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [commands, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (commands.length === 0) {
    return (
      <div
        className="absolute z-50 bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-editorWidget-border)] rounded-md shadow-lg py-1 min-w-[240px]"
        style={{ top: position.top, left: position.left }}
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
      style={{ top: position.top, left: position.left }}
      ref={listRef}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-editorWidget-border)]">
        Commands
      </div>
      {commands.map((cmd, index) => {
        const IconComponent = ICON_MAP[cmd.icon] || FileText;
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
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">/{cmd.name.toLowerCase()}</span>
                {cmd.usage && cmd.usage !== `/${cmd.name.toLowerCase()}` && (
                  <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                    {cmd.usage}
                  </span>
                )}
              </div>
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
