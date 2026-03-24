/**
 * Flow Node Components
 *
 * Export all custom node types for React Flow.
 */

import { TriggerNode } from './TriggerNode';
import { LLMNode } from './LLMNode';
import { ImageNode } from './ImageNode';
import { SaveFileNode } from './SaveFileNode';
import { ClaudeCodeNode } from './ClaudeCodeNode';
import { CodexNode } from './CodexNode';

export { TriggerNode, LLMNode, ImageNode, SaveFileNode, ClaudeCodeNode, CodexNode };
export { BaseNode, NodeField } from './BaseNode';

// Node types mapping for React Flow
export const nodeTypes = {
  triggerNode: TriggerNode,
  llmNode: LLMNode,
  imageNode: ImageNode,
  saveFileNode: SaveFileNode,
  claudeCodeNode: ClaudeCodeNode,
  codexNode: CodexNode,
};
