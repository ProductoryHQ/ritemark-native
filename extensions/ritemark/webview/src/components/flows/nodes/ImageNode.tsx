/**
 * Image Node Component
 *
 * Represents an image generation node. Its Model row names the model a run uses, as the step's panel does
 * (`imageStepModel`, Sprint 144): it used to name one fixed model per provider ("GPT Image 1.5", "Nano Banana Pro")
 * whatever the step had saved.
 */

import { memo, useSyncExternalStore } from 'react';
import { BaseNode, NodeField } from './BaseNode';
import type { ImageNodeData } from '../stores/flowEditorStore';
import { useFlowEditorStore } from '../stores/flowEditorStore';
import { getDefaultImageModel, imageStepModel, offeredImageModels, subscribeImageModels } from '../../../config/modelConfig';

interface ImageNodeProps {
  id: string;
  data: ImageNodeData;
  selected?: boolean;
}

function ImageNodeComponent({ id, data, selected }: ImageNodeProps) {
  const executionStep = useFlowEditorStore((state) => state.executionOrder.get(id));
  const provider = data.provider || 'openai';
  const snapshot = () => offeredImageModels(provider);
  const offered = useSyncExternalStore(subscribeImageModels, snapshot, snapshot);
  const model = imageStepModel(data.model, getDefaultImageModel(provider), offered);

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
      <NodeField label="Model" value={model.label} />
      <NodeField label="Prompt" value={truncateText(data.prompt) || 'No prompt'} />
      <NodeField label="Size" value={`${data.size || '1024x1024'} · ${data.quality || 'standard'}`} />
    </BaseNode>
  );
}

export const ImageNode = memo(ImageNodeComponent);
