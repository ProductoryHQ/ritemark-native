/**
 * Flow Node Components
 *
 * Export all custom node types for React Flow.
 */

import { TriggerNode } from './TriggerNode';
import { LLMNode } from './LLMNode';
import { ImageNode } from './ImageNode';
import { SaveFileNode } from './SaveFileNode';

export { TriggerNode, LLMNode, ImageNode, SaveFileNode };
export { BaseNode, NodeField } from './BaseNode';

// Node types mapping for React Flow
export const nodeTypes = {
  triggerNode: TriggerNode,
  llmNode: LLMNode,
  imageNode: ImageNode,
  saveFileNode: SaveFileNode,
};
