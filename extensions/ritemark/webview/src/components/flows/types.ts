/**
 * Flow Types (Webview Mirror)
 *
 * These types mirror the extension-side types for webview use.
 */

export interface Flow {
  id: string;
  name: string;
  description: string;
  version: number;
  created: string;
  modified: string;
  inputs: FlowInput[];
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowInput {
  id: string;
  type: 'text' | 'file';
  label: string;
  required: boolean;
  defaultValue?: string;
}

export interface FlowNode {
  id: string;
  type: 'input' | 'llm-prompt' | 'image-prompt' | 'save-file';
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

/**
 * Message types for extension ↔ webview communication
 */
export type FlowsMessage =
  | { type: 'ready' }
  | { type: 'flow:list'; flows: Flow[] }
  | { type: 'flow:loaded'; flow: Flow }
  | { type: 'flow:saved'; id: string }
  | { type: 'flow:deleted'; id: string }
  | { type: 'flow:progress'; step: number; total: number; currentNode: string; currentNodeLabel?: string }
  | { type: 'flow:complete'; outputs: Record<string, unknown> }
  | { type: 'flow:error'; error: string };

export type FlowsCommand =
  | { type: 'flow:list' }
  | { type: 'flow:load'; id: string }
  | { type: 'flow:save'; flow: Flow }
  | { type: 'flow:delete'; id: string }
  | { type: 'flow:run'; id: string; inputs: Record<string, unknown> }
  | { type: 'flow:cancel' };
