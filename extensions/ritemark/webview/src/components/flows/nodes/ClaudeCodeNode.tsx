/**
 * Claude Code Node Component
 *
 * Represents a Claude Code autonomous coding node.
 * Executes coding tasks via Claude Code CLI.
 */

import { memo } from 'react';
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
      type="claudeCodeNode"
      selected={selected}
      executionStep={executionStep}
    >
      <NodeField
        label="Prompt"
        value={truncateText(data.prompt) || 'No prompt'}
      />
      <NodeField label="Timeout" value={`${data.timeout || 5} minute${(data.timeout || 5) === 1 ? '' : 's'}`} />
    </BaseNode>
  );
}

export const ClaudeCodeNode = memo(ClaudeCodeNodeComponent);
