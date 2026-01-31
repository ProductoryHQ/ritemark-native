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
  context: ExecutionContext
): Promise<unknown> {
  switch (node.type) {
    case 'input':
      // Input nodes don't execute - their values come from context.inputs
      return null;

    case 'llm-prompt':
      return await executeLLMNode(node, context);

    case 'image-prompt':
      throw new Error('Image nodes not yet implemented (Phase 2)');

    case 'save-file':
      throw new Error('Save file nodes not yet implemented (Phase 2)');

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
  console.log('[FlowExecutor] Starting execution:', flow.name);

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

  // Build execution context
  const context: ExecutionContext = {
    inputs,
    outputs: new Map(),
    workspacePath,
  };

  try {
    // Determine execution order
    const order = getExecutionOrder(flow.nodes, flow.edges);
    console.log('[FlowExecutor] Execution order:', order);

    // Execute nodes sequentially
    for (let i = 0; i < order.length; i++) {
      // Check for abort
      if (abortSignal?.aborted) {
        console.log('[FlowExecutor] Execution aborted');
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

      console.log(`[FlowExecutor] Executing node ${i + 1}/${order.length}:`, nodeId);

      // Execute node
      const output = await executeNode(node, context);
      context.outputs.set(nodeId, output);

      console.log('[FlowExecutor] Node output:', output);
    }

    // Success
    console.log('[FlowExecutor] Execution complete');
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
