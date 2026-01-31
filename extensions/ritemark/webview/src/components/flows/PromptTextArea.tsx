/**
 * Prompt TextArea with Slash Commands
 *
 * Type / to insert variables from:
 * - Trigger inputs
 * - Connected upstream nodes
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { useFlowEditorStore } from './stores/flowEditorStore';
import type { TriggerNodeData } from './stores/flowEditorStore';

interface PromptTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  nodeId: string; // Current node to find connected inputs
}

interface VariableOption {
  type: 'input' | 'node';
  id: string;
  label: string;
  description?: string;
}

export function PromptTextArea({
  value,
  onChange,
  placeholder,
  className,
  nodeId,
}: PromptTextAreaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [slashStart, setSlashStart] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get available variables from store
  const nodes = useFlowEditorStore((state) => state.nodes);
  const edges = useFlowEditorStore((state) => state.edges);

  // Build list of available variables
  const getAvailableVariables = useCallback((): VariableOption[] => {
    const variables: VariableOption[] = [];

    // Find trigger node for inputs
    const triggerNode = nodes.find((n) => n.type === 'triggerNode');
    if (triggerNode) {
      const triggerData = triggerNode.data as TriggerNodeData;
      for (const input of triggerData.inputs || []) {
        variables.push({
          type: 'input',
          id: input.id,
          label: input.label,
          description: `Input: ${input.type}`,
        });
      }
    }

    // Find upstream connected nodes (nodes that connect TO this node)
    const upstreamNodeIds = edges
      .filter((e) => e.target === nodeId)
      .map((e) => e.source);

    for (const upstreamId of upstreamNodeIds) {
      const upstreamNode = nodes.find((n) => n.id === upstreamId);
      if (upstreamNode && upstreamNode.type !== 'triggerNode') {
        const label = (upstreamNode.data as { label?: string }).label || upstreamId;
        variables.push({
          type: 'node',
          id: upstreamId,
          label: label,
          description: 'Previous node output',
        });
      }
    }

    return variables;
  }, [nodes, edges, nodeId]);

  // Filter variables based on search
  const filteredVariables = React.useMemo(() => {
    const all = getAvailableVariables();
    if (!searchText) return all;
    const lower = searchText.toLowerCase();
    return all.filter(
      (v) =>
        v.label.toLowerCase().includes(lower) ||
        v.description?.toLowerCase().includes(lower)
    );
  }, [getAvailableVariables, searchText]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredVariables.length]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    onChange(newValue);

    // Check if we just typed /
    if (slashStart === null) {
      // Look for / before cursor
      const textBeforeCursor = newValue.slice(0, cursorPos);
      const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

      if (lastSlashIndex !== -1) {
        // Check if / is at start or after whitespace
        const charBefore = lastSlashIndex > 0 ? newValue[lastSlashIndex - 1] : ' ';
        if (charBefore === ' ' || charBefore === '\n' || lastSlashIndex === 0) {
          setSlashStart(lastSlashIndex);
          setSearchText(textBeforeCursor.slice(lastSlashIndex + 1));
          setShowDropdown(true);
          updateDropdownPosition();
          return;
        }
      }
    } else {
      // Already in slash command mode
      const textAfterSlash = newValue.slice(slashStart + 1, cursorPos);

      // Check if slash was deleted or space added
      if (
        newValue[slashStart] !== '/' ||
        textAfterSlash.includes(' ') ||
        textAfterSlash.includes('\n')
      ) {
        closeDropdown();
      } else {
        setSearchText(textAfterSlash);
      }
    }
  };

  // Update dropdown position near cursor
  const updateDropdownPosition = () => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const rect = textarea.getBoundingClientRect();

    // Approximate position (could be improved with a hidden mirror element)
    setDropdownPosition({
      top: rect.height + 4,
      left: 0,
    });
  };

  // Close dropdown
  const closeDropdown = () => {
    setShowDropdown(false);
    setSlashStart(null);
    setSearchText('');
    setSelectedIndex(0);
  };

  // Insert selected variable
  const insertVariable = (variable: VariableOption) => {
    if (slashStart === null || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;

    // Build the variable syntax
    const varSyntax =
      variable.type === 'input'
        ? `{${variable.label}}`
        : `{${variable.label}}`;

    // Replace /search with variable
    const before = value.slice(0, slashStart);
    const after = value.slice(cursorPos);
    const newValue = before + varSyntax + after;

    onChange(newValue);
    closeDropdown();

    // Set cursor after inserted variable
    setTimeout(() => {
      const newPos = slashStart + varSyntax.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) =>
          i < filteredVariables.length - 1 ? i + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) =>
          i > 0 ? i - 1 : filteredVariables.length - 1
        );
        break;

      case 'Enter':
      case 'Tab':
        if (filteredVariables.length > 0) {
          e.preventDefault();
          insertVariable(filteredVariables[selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'w-full min-h-[80px] px-3 py-2 text-sm rounded',
          'bg-[var(--vscode-input-background)]',
          'text-[var(--vscode-input-foreground)]',
          'border border-[var(--vscode-input-border)]',
          'focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]',
          'placeholder:text-[var(--vscode-input-placeholderForeground)]',
          'resize-y',
          className
        )}
      />

      {/* Slash command dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full max-h-[200px] overflow-y-auto rounded-md border bg-[var(--vscode-dropdown-background)] border-[var(--vscode-dropdown-border)] shadow-lg"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        >
          {filteredVariables.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[var(--vscode-descriptionForeground)]">
              No variables available
            </div>
          ) : (
            <div className="py-1">
              {filteredVariables.map((variable, index) => (
                <button
                  key={`${variable.type}-${variable.id}`}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm flex items-center justify-between',
                    'hover:bg-[var(--vscode-list-hoverBackground)]',
                    index === selectedIndex &&
                      'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                  )}
                  onClick={() => insertVariable(variable)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="font-medium">{variable.label}</span>
                  <span className="text-xs text-[var(--vscode-descriptionForeground)]">
                    {variable.description}
                  </span>
                </button>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
