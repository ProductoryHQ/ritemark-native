/**
 * Flow Executor
 *
 * Sequential execution engine for flows.
 * Processes nodes in topological order based on edges.
 */

import type {
  Flow,
  FlowNode,
  ExecutionContext,
  ExecutionResult,
  ExecutionProgress,
} from './types';
import { executeLLMNode } from './nodes/LLMNodeExecutor';
import { executeImageNode } from './nodes/ImageNodeExecutor';
import { executeSaveFileNode } from './nodes/SaveFileNodeExecutor';
import { executeClaudeCodeNode } from './nodes/ClaudeCodeNodeExecutor';

/**
 * Progress callback
 */
type ProgressCallback = (progress: ExecutionProgress) => void;

/**
 * Perform topological sort to determine execution order
 */
function getExecutionOrder(nodes: FlowNode[], edges: { source: string; target: string }[]): string[] {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize graph
  for (const node of nodes) {
    graph.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  // Build adjacency list and in-degree count
  for (const edge of edges) {
    const targets = graph.get(edge.source) || [];
    targets.push(edge.target);
    graph.set(edge.source, targets);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Find nodes with no incoming edges (start nodes)
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  // Kahn's algorithm for topological sort
  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    const neighbors = graph.get(current) || [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycles
  if (order.length !== nodes.length) {
    throw new Error('Flow contains cycles or unreachable nodes');
  }

  return order;
}

/**
 * Execute a single node based on its type
 */
async function executeNode(
  node: FlowNode,
  context: ExecutionContext,
  abortSignal?: AbortSignal
): Promise<unknown> {
  switch (node.type) {
    case 'trigger':
      // Trigger node provides inputs to the flow
      return context.inputs;

    case 'llm-prompt':
      return await executeLLMNode(node, context);

    case 'image-prompt':
      return await executeImageNode(node, context);

    case 'save-file':
      return await executeSaveFileNode(node, context);

    case 'claude-code':
      return await executeClaudeCodeNode(node, context, abortSignal);

    default:
      throw new Error(`Unknown node type: ${(node as FlowNode).type}`);
  }
}

/**
 * Execute a flow with given inputs
 */
export async function executeFlow(
  flow: Flow,
  inputs: Record<string, unknown>,
  workspacePath: string,
  onProgress?: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<ExecutionResult> {
  // Validate required inputs
  for (const input of flow.inputs) {
    if (input.required && !inputs[input.id]) {
      return {
        success: false,
        outputs: {},
        error: `Required input missing: ${input.label}`,
      };
    }
  }

  // Build input labels map (label -> value)
  const inputLabels = new Map<string, string>();
  const triggerNode = flow.nodes.find(n => n.type === 'trigger');
  if (triggerNode) {
    const triggerInputs = (triggerNode.data as { inputs?: Array<{ id: string; label: string }> }).inputs || [];
    for (const input of triggerInputs) {
      const value = inputs[input.label] ?? inputs[input.id];
      if (value !== undefined) {
        inputLabels.set(input.label, String(value));
      }
    }
  }

  // Build node labels map (label -> nodeId)
  const nodeLabels = new Map<string, string>();
  for (const node of flow.nodes) {
    const label = (node.data as { label?: string }).label;
    if (label) {
      nodeLabels.set(label, node.id);
    }
  }

  // Build execution context
  const context: ExecutionContext = {
    inputs,
    outputs: new Map(),
    workspacePath,
    inputLabels,
    nodeLabels,
  };

  try {
    // Determine execution order
    const order = getExecutionOrder(flow.nodes, flow.edges);

    // Execute nodes sequentially
    for (let i = 0; i < order.length; i++) {
      // Check for abort
      if (abortSignal?.aborted) {
        return {
          success: false,
          outputs: Object.fromEntries(context.outputs),
          error: 'Execution cancelled',
        };
      }

      const nodeId = order[i];
      const node = flow.nodes.find((n) => n.id === nodeId);

      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      // Report progress
      if (onProgress) {
        onProgress({
          step: i + 1,
          total: order.length,
          currentNode: nodeId,
          currentNodeLabel: (node.data as { label?: string }).label || node.type,
        });
      }

      // Execute node
      const output = await executeNode(node, context, abortSignal);
      context.outputs.set(nodeId, output);
    }

    return {
      success: true,
      outputs: Object.fromEntries(context.outputs),
    };
  } catch (err) {
    console.error('[FlowExecutor] Execution failed:', err);
    return {
      success: false,
      outputs: Object.fromEntries(context.outputs),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
