/**
 * LLM Node Component
 *
 * Represents an LLM prompt node.
 * Executes using OpenAI or Google Gemini API with variable interpolation.
 */

import { memo } from 'react';
import { BaseNode, NodeField } from './BaseNode';
import type { LLMNodeData } from '../stores/flowEditorStore';
import { useFlowEditorStore } from '../stores/flowEditorStore';
import { getLLMModels, getDefaultLLMModel } from '../../../config/modelConfig';

interface LLMNodeProps {
  id: string;
  data: LLMNodeData;
  selected?: boolean;
}

function LLMNodeComponent({ id, data, selected }: LLMNodeProps) {
  const executionStep = useFlowEditorStore((state) => state.executionOrder.get(id));
  // Truncate long prompts for display
  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  const provider = data.provider || 'openai';
  const model = data.model || getDefaultLLMModel(provider);
  // Get model name from config, fallback to model id
  const models = getLLMModels(provider);
  const modelName = models.find(m => m.id === model)?.name || model;

  return (
    <BaseNode
      label={data.label}
      type="llmNode"
      selected={selected}
      executionStep={executionStep}
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
      <NodeField label="Settings" value={`Temp ${data.temperature ?? 0.7} · Max ${data.maxTokens ?? 2000}`} />
    </BaseNode>
  );
}

export const LLMNode = memo(LLMNodeComponent);
