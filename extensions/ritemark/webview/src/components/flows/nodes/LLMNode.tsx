/**
 * LLM Node Component
 *
 * Represents an LLM prompt node.
 * Executes using OpenAI or Google Gemini API with variable interpolation.
 */

import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { BaseNode, NodeField } from './BaseNode';
import type { LLMNodeData } from '../stores/flowEditorStore';

interface LLMNodeProps {
  data: LLMNodeData;
  selected?: boolean;
}

// Short display names for models
const modelDisplayNames: Record<string, string> = {
  'gpt-4.1-mini': 'GPT-4.1 Mini',
  'gpt-4.1': 'GPT-4.1',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4o': 'GPT-4o',
  'o3-mini': 'o3-mini',
  'gemini-3-flash': 'Gemini 3 Flash',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
};

function LLMNodeComponent({ data, selected }: LLMNodeProps) {
  // Truncate long prompts for display
  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  const provider = data.provider || 'openai';
  const model = data.model || (provider === 'openai' ? 'gpt-4.1-mini' : 'gemini-3-flash');
  const modelName = modelDisplayNames[model] || model;

  return (
    <BaseNode
      label={data.label}
      icon={<Sparkles size={16} />}
      selected={selected}
      headerColor="var(--vscode-charts-purple)"
    >
      <NodeField label="Model" value={modelName} />
      {data.systemPrompt && (
        <NodeField
          label="System"
          value={truncateText(data.systemPrompt)}
        />
      )}
      <NodeField
        label="Prompt"
        value={truncateText(data.userPrompt) || 'No prompt'}
      />
      <div className="flex gap-4 mt-2 text-xs text-[var(--vscode-descriptionForeground)]">
        <span>Temp: {data.temperature ?? 0.7}</span>
        <span>Max: {data.maxTokens ?? 2000}</span>
      </div>
    </BaseNode>
  );
}

export const LLMNode = memo(LLMNodeComponent);
