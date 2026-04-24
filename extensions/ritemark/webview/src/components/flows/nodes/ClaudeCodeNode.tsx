/**
 * Claude Code Node Component
 *
 * Represents a Claude Code autonomous coding node.
 * Executes coding tasks via Claude Code CLI.
 */

import { memo } from 'react';
import { Icon } from '../../ui/Icon';
import { BaseNode, NodeField } from './BaseNode';
import type { ClaudeCodeNodeData } from '../stores/flowEditorStore';
import { useFlowEditorStore } from '../stores/flowEditorStore';

interface ClaudeCodeNodeProps {
  id: string;
  data: ClaudeCodeNodeData;
  selected?: boolean;
}

function ClaudeCodeNodeComponent({ id, data, selected }: ClaudeCodeNodeProps) {
  const executionStep = useFlowEditorStore((state) => state.executionOrder.get(id));

  // Truncate long prompts for display
  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  return (
    <BaseNode
      label={data.label}
      icon={<Icon name="robot" size={16} />}
      selected={selected}
      headerColor="var(--vscode-charts-orange)"
      executionStep={executionStep}
    >
      <NodeField
        label="Prompt"
        value={truncateText(data.prompt) || 'No prompt'}
      />
      <div className="mt-2 text-xs text-[var(--r-ink-muted)]">
        Timeout: {data.timeout || 5} min
      </div>
    </BaseNode>
  );
}

export const ClaudeCodeNode = memo(ClaudeCodeNodeComponent);
