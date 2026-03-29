/**
 * Codex Node Component
 *
 * Represents an OpenAI Codex autonomous coding node.
 * Executes coding tasks via Codex CLI app-server.
 */

import { memo } from 'react';
import { Terminal } from 'lucide-react';
import { BaseNode, NodeField } from './BaseNode';
import type { CodexNodeData } from '../stores/flowEditorStore';
import { useFlowEditorStore } from '../stores/flowEditorStore';

interface CodexNodeProps {
  id: string;
  data: CodexNodeData;
  selected?: boolean;
}

function CodexNodeComponent({ id, data, selected }: CodexNodeProps) {
  const executionStep = useFlowEditorStore((state) => state.executionOrder.get(id));

  // Truncate long prompts for display
  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  return (
    <BaseNode
      label={data.label}
      icon={<Terminal size={16} />}
      selected={selected}
      headerColor="var(--vscode-charts-purple)"
      executionStep={executionStep}
    >
      <NodeField
        label="Prompt"
        value={truncateText(data.prompt) || 'No prompt'}
      />
      {data.model && (
        <NodeField
          label="Model"
          value={data.model}
        />
      )}
      <div className="mt-2 text-xs text-[var(--vscode-descriptionForeground)]">
        Timeout: {data.timeout || 5} min
      </div>
    </BaseNode>
  );
}

export const CodexNode = memo(CodexNodeComponent);
