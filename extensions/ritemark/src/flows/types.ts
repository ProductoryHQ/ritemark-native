/**
 * Flow Type Definitions
 *
 * Defines the structure of flows and their components.
 */

/**
 * Flow definition stored in .flow.json files
 */
export interface Flow {
  id: string;
  name: string;
  description: string;
  version: number;
  created: string; // ISO 8601 timestamp
  modified: string; // ISO 8601 timestamp
  inputs: FlowInput[];
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/**
 * Input definitions for flow execution
 */
export interface FlowInput {
  id: string;
  type: 'text' | 'file';
  label: string;
  required: boolean;
  defaultValue?: string;
}

/**
 * Node in the flow graph
 */
export interface FlowNode {
  id: string;
  type: 'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file';
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

/**
 * Edge connecting nodes
 */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

/**
 * Execution context passed through the flow
 */
export interface ExecutionContext {
  inputs: Record<string, unknown>;
  outputs: Map<string, unknown>;
  workspacePath: string;
  /** Map of input label -> input value (for {Label} syntax) */
  inputLabels: Map<string, string>;
  /** Map of node label -> node ID (for {Label} syntax) */
  nodeLabels: Map<string, string>;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  outputs: Record<string, unknown>;
  error?: string;
}

/**
 * Progress callback data
 */
export interface ExecutionProgress {
  step: number;
  total: number;
  currentNode: string;
  currentNodeLabel?: string;
}

/**
 * Node execution function signature
 */
export type NodeExecutor = (
  node: FlowNode,
  context: ExecutionContext
) => Promise<unknown>;
