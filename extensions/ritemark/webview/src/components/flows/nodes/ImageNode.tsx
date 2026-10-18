/**
 * Image Node Component
 *
 * Represents an image generation node.
 * Supports GPT Image 1.5 (OpenAI) and Nano Banana Pro (Gemini).
 */

import { memo } from 'react';
import { BaseNode, NodeField } from './BaseNode';
import type { ImageNodeData } from '../stores/flowEditorStore';
import { useFlowEditorStore } from '../stores/flowEditorStore';

interface ImageNodeProps {
  id: string;
  data: ImageNodeData;
  selected?: boolean;
}

// Provider display names
const providerNames: Record<string, string> = {
  openai: 'GPT Image 1.5',
  gemini: 'Nano Banana Pro',
};

function ImageNodeComponent({ id, data, selected }: ImageNodeProps) {
  const executionStep = useFlowEditorStore((state) => state.executionOrder.get(id));

  // Truncate prompt for display
  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  return (
    <BaseNode
      label={data.label}
      type="imageNode"
      selected={selected}
      executionStep={executionStep}
    >
      <NodeField
        label="Provider"
        value={providerNames[data.provider] || data.provider}
      />
      <NodeField label="Prompt" value={truncateText(data.prompt) || 'No prompt'} />
      <NodeField label="Size" value={`${data.size || '1024x1024'} · ${data.quality || 'standard'}`} />
    </BaseNode>
  );
}

export const ImageNode = memo(ImageNodeComponent);
