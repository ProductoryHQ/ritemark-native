/**
 * Flow Editor Store
 *
 * Zustand store for managing React Flow state.
 * Handles nodes, edges, selection, and serialization.
 */

import { create } from 'zustand';
import {
  Node,
  Edge,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import { getDefaultLLMModel, getDefaultImageModel } from '../../../config/modelConfig';

// Flow input type (used in Trigger node)
export interface FlowInput {
  id: string;
  type: 'text' | 'file';
  label: string;
  required: boolean;
  defaultValue?: string;
}

// Node data types matching our flow types
// Using Record<string, unknown> compatible types for React Flow
export interface TriggerNodeData extends Record<string, unknown> {
  label: string;
  inputs: FlowInput[];
}

export interface LLMNodeData extends Record<string, unknown> {
  label: string;
  provider: 'openai' | 'gemini';
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface ImageNodeData extends Record<string, unknown> {
  label: string;
  provider: 'openai' | 'gemini';
  model: string;
  prompt: string;
  // Image input sources (node IDs or input labels that provide images)
  inputImages: string[];
  // Action: auto (model decides), generate (new image), edit (modify input)
  action: 'auto' | 'generate' | 'edit';
  // Input fidelity for preserving faces/logos from input images
  inputFidelity: 'low' | 'high';
  size: '1024x1024' | '1792x1024' | '1024x1792';
  quality: 'standard' | 'hd';
  style: 'natural' | 'vivid';
}

export interface SaveFileNodeData extends Record<string, unknown> {
  label: string;
  sourceNodeId: string;
  format: 'markdown' | 'csv' | 'image';
  folder: string;
  filename: string;
}

export interface ClaudeCodeNodeData extends Record<string, unknown> {
  label: string;
  prompt: string;
  timeout: number;
}

export interface CodexNodeData extends Record<string, unknown> {
  label: string;
  prompt: string;
  model: string;
  timeout: number;
}

export type FlowNodeData = TriggerNodeData | LLMNodeData | ImageNodeData | SaveFileNodeData | ClaudeCodeNodeData | CodexNodeData;

// Flow types from extension
export interface Flow {
  id: string;
  name: string;
  description: string;
  version: number;
  created: string;
  modified: string;
  inputs: FlowInput[];
  nodes: Array<{
    id: string;
    type: 'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code' | 'codex';
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
}

// Map flow node types to React Flow node types
const flowTypeToReactFlowType: Record<string, string> = {
  'trigger': 'triggerNode',
  'llm-prompt': 'llmNode',
  'image-prompt': 'imageNode',
  'save-file': 'saveFileNode',
  'claude-code': 'claudeCodeNode',
  'codex': 'codexNode',
};

const reactFlowTypeToFlowType: Record<string, string> = {
  'triggerNode': 'trigger',
  'llmNode': 'llm-prompt',
  'imageNode': 'image-prompt',
  'saveFileNode': 'save-file',
  'claudeCodeNode': 'claude-code',
  'codexNode': 'codex',
};

// Helper to escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate execution order using topological sort (Kahn's algorithm)
 * Returns Map of nodeId -> execution step (1-indexed)
 */
function calculateExecutionOrder(
  nodes: Array<{ id: string }>,
  edges: Array<{ source: string; target: string }>
): Map<string, number> {
  const order = new Map<string, number>();
  if (nodes.length === 0) return order;

  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize
  for (const node of nodes) {
    graph.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  // Build adjacency list and in-degree
  for (const edge of edges) {
    const targets = graph.get(edge.source) || [];
    targets.push(edge.target);
    graph.set(edge.source, targets);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Find start nodes (in-degree 0)
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(nodeId);
  }

  // Kahn's algorithm
  let step = 1;
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.set(current, step++);

    for (const neighbor of graph.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return order;
}

interface FlowEditorState {
  // Flow metadata
  flowId: string;
  flowName: string;
  flowDescription: string;
  flowInputs: FlowInput[];

  // React Flow state
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;

  // Editor state
  isDirty: boolean;
  validationWarnings: string[];
  workspacePath: string;

  // History for undo/redo
  history: Array<{ nodes: Node<FlowNodeData>[]; edges: Edge[] }>;
  historyIndex: number;

  // Execution order (nodeId -> step number, 1-indexed)
  executionOrder: Map<string, number>;

  // Actions
  setFlow: (flow: Flow, workspacePath: string) => void;
  setNodes: (nodes: Node<FlowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<Node<FlowNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: string, position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  setFlowName: (name: string) => void;
  setFlowDescription: (description: string) => void;
  setValidationWarnings: (warnings: string[]) => void;
  markDirty: () => void;
  markClean: () => void;
  undo: () => void;
  redo: () => void;
  toFlow: () => Flow;
  saveToHistory: () => void;
}

// Default node data by type
function getDefaultNodeData(type: string): FlowNodeData {
  switch (type) {
    case 'triggerNode':
      return {
        label: 'Trigger',
        inputs: [
          {
            id: `input-${Date.now()}`,
            type: 'text',
            label: 'Input',
            required: true,
            defaultValue: '',
          },
        ],
      };
    case 'llmNode':
      return {
        label: 'LLM Prompt',
        provider: 'openai',
        model: getDefaultLLMModel('openai'),
        systemPrompt: '',
        userPrompt: '',
        temperature: 0.7,
        maxTokens: 2000,
      };
    case 'imageNode':
      return {
        label: 'Generate Image',
        provider: 'openai',
        model: getDefaultImageModel('openai'),
        prompt: '',
        inputImages: [],
        action: 'auto',
        inputFidelity: 'low',
        size: '1024x1024',
        quality: 'standard',
        style: 'natural',
      };
    case 'saveFileNode':
      return {
        label: 'Save File',
        filename: 'output.md',
        format: 'markdown',
        sourceNodeId: '',
      };
    case 'claudeCodeNode':
      return {
        label: 'Claude Code',
        prompt: '',
        timeout: 5,
      };
    case 'codexNode':
      return {
        label: 'Codex',
        prompt: '',
        model: '',
        timeout: 5,
      };
    default:
      return { label: 'Unknown' } as FlowNodeData;
  }
}

export const useFlowEditorStore = create<FlowEditorState>((set, get) => ({
  // Initial state
  flowId: '',
  flowName: 'Untitled Flow',
  flowDescription: '',
  flowInputs: [],
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDirty: false,
  validationWarnings: [],
  workspacePath: '',
  history: [],
  historyIndex: -1,
  executionOrder: new Map(),

  // Load flow from JSON
  setFlow: (flow: Flow, workspacePath: string) => {
    const currentState = get();
    const isSameFlow = currentState.flowId === flow.id;

    // Convert flow nodes to React Flow nodes
    const nodes: Node<FlowNodeData>[] = flow.nodes.map((node) => ({
      id: node.id,
      type: flowTypeToReactFlowType[node.type] || 'inputNode',
      position: node.position,
      data: node.data as FlowNodeData,
    }));

    // Convert flow edges to React Flow edges
    const edges: Edge[] = flow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    }));

    // Preserve selection if reloading the same flow (e.g., after autosave)
    const selectedNodeId = isSameFlow
      ? currentState.selectedNodeId
      : null;

    // Calculate execution order
    const executionOrder = calculateExecutionOrder(nodes, edges);

    set({
      flowId: flow.id,
      flowName: flow.name,
      flowDescription: flow.description,
      flowInputs: flow.inputs,
      nodes,
      edges,
      selectedNodeId,
      isDirty: false,
      workspacePath,
      history: isSameFlow ? currentState.history : [{ nodes, edges }],
      historyIndex: isSameFlow ? currentState.historyIndex : 0,
      executionOrder,
    });
  },

  setNodes: (nodes) => set((state) => ({
    nodes,
    executionOrder: calculateExecutionOrder(nodes, state.edges),
  })),
  setEdges: (edges) => set((state) => ({
    edges,
    executionOrder: calculateExecutionOrder(state.nodes, edges),
  })),

  onNodesChange: (changes) => {
    set((state) => {
      const newNodes = applyNodeChanges(changes, state.nodes);
      return {
        nodes: newNodes,
        isDirty: true,
        executionOrder: calculateExecutionOrder(newNodes, state.edges),
      };
    });
  },

  onEdgesChange: (changes) => {
    set((state) => {
      const newEdges = applyEdgeChanges(changes, state.edges);
      return {
        edges: newEdges,
        isDirty: true,
        executionOrder: calculateExecutionOrder(state.nodes, newEdges),
      };
    });
  },

  onConnect: (connection) => {
    set((state) => {
      const newEdges = addEdge(
        {
          ...connection,
          id: `edge-${Date.now()}`,
        },
        state.edges
      );
      return {
        edges: newEdges,
        isDirty: true,
        executionOrder: calculateExecutionOrder(state.nodes, newEdges),
      };
    });
    // Save to history
    get().saveToHistory();
  },

  addNode: (type, position) => {
    const id = `node-${Date.now()}`;
    const data = getDefaultNodeData(type);

    set((state) => {
      // Check if trying to add a second Trigger node
      if (type === 'triggerNode') {
        const hasTrigger = state.nodes.some((n) => n.type === 'triggerNode');
        if (hasTrigger) {
          // Don't add - only one trigger allowed
          return state;
        }
      }

      const newNodes = [
        ...state.nodes,
        {
          id,
          type,
          position,
          data,
        },
      ];

      // Sync flow inputs from trigger node
      const triggerNode = newNodes.find((n) => n.type === 'triggerNode');
      const flowInputs = triggerNode
        ? (triggerNode.data as TriggerNodeData).inputs || []
        : [];

      return {
        nodes: newNodes,
        flowInputs,
        selectedNodeId: id,
        isDirty: true,
      };
    });

    get().saveToHistory();
  },

  updateNodeData: (nodeId, data) => {
    set((state) => {
      const targetNode = state.nodes.find((n) => n.id === nodeId);
      let labelChanges: Array<{ oldLabel: string; newLabel: string }> = [];

      // Check if this is a Trigger node with input label changes
      if (targetNode?.type === 'triggerNode' && data.inputs) {
        const oldInputs = (targetNode.data as TriggerNodeData).inputs || [];
        const newInputs = data.inputs as FlowInput[];

        // Find label changes by matching input IDs
        for (const newInput of newInputs) {
          const oldInput = oldInputs.find((o) => o.id === newInput.id);
          if (oldInput && oldInput.label !== newInput.label) {
            labelChanges.push({
              oldLabel: oldInput.label,
              newLabel: newInput.label,
            });
          }
        }
      }

      // Check if node label changed (for non-trigger nodes)
      if (targetNode && targetNode.type !== 'triggerNode' && data.label) {
        const oldLabel = (targetNode.data as { label?: string }).label;
        if (oldLabel && oldLabel !== data.label) {
          labelChanges.push({
            oldLabel: oldLabel,
            newLabel: data.label as string,
          });
        }
      }

      // Update all nodes
      const nodes = state.nodes.map((node) => {
        if (node.id === nodeId) {
          // Update the target node
          return {
            ...node,
            data: { ...node.data, ...data },
          };
        }

        // If there are label changes, update prompts in other nodes
        if (labelChanges.length > 0) {
          const nodeData = node.data as Record<string, unknown>;
          let updated = false;
          const newData = { ...nodeData };

          // Check LLM node prompts
          if (node.type === 'llmNode') {
            const llmData = nodeData as LLMNodeData;
            let systemPrompt = llmData.systemPrompt || '';
            let userPrompt = llmData.userPrompt || '';

            for (const { oldLabel, newLabel } of labelChanges) {
              const pattern = new RegExp(`\\{${escapeRegex(oldLabel)}\\}`, 'g');
              if (pattern.test(systemPrompt)) {
                systemPrompt = systemPrompt.replace(pattern, `{${newLabel}}`);
                updated = true;
              }
              if (pattern.test(userPrompt)) {
                userPrompt = userPrompt.replace(pattern, `{${newLabel}}`);
                updated = true;
              }
            }

            if (updated) {
              newData.systemPrompt = systemPrompt;
              newData.userPrompt = userPrompt;
            }
          }

          // Check Image node prompts
          if (node.type === 'imageNode') {
            const imageData = nodeData as ImageNodeData;
            let prompt = imageData.prompt || '';

            for (const { oldLabel, newLabel } of labelChanges) {
              const pattern = new RegExp(`\\{${escapeRegex(oldLabel)}\\}`, 'g');
              if (pattern.test(prompt)) {
                prompt = prompt.replace(pattern, `{${newLabel}}`);
                updated = true;
              }
            }

            if (updated) {
              newData.prompt = prompt;
            }
          }

          // Check Claude Code and Codex node prompts
          if (node.type === 'claudeCodeNode' || node.type === 'codexNode') {
            let prompt = (nodeData as { prompt?: string }).prompt || '';

            for (const { oldLabel, newLabel } of labelChanges) {
              const pattern = new RegExp(`\\{${escapeRegex(oldLabel)}\\}`, 'g');
              if (pattern.test(prompt)) {
                prompt = prompt.replace(pattern, `{${newLabel}}`);
                updated = true;
              }
            }

            if (updated) {
              newData.prompt = prompt;
            }
          }

          if (updated) {
            return { ...node, data: newData as FlowNodeData };
          }
        }

        return node;
      });

      // Sync flow inputs from trigger node
      const triggerNode = nodes.find((n) => n.type === 'triggerNode');
      const flowInputs = triggerNode
        ? (triggerNode.data as TriggerNodeData).inputs || []
        : [];

      return { nodes, flowInputs, isDirty: true };
    });
  },

  deleteNode: (nodeId) => {
    set((state) => {
      const node = state.nodes.find((n) => n.id === nodeId);

      // Don't allow deleting the Trigger node
      if (node?.type === 'triggerNode') {
        return state;
      }

      const nodes = state.nodes.filter((n) => n.id !== nodeId);
      const edges = state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      );

      return {
        nodes,
        edges,
        selectedNodeId:
          state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        isDirty: true,
      };
    });
    get().saveToHistory();
  },

  deleteEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
      isDirty: true,
    }));
    get().saveToHistory();
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  setFlowName: (name) => set({ flowName: name, isDirty: true }),

  setFlowDescription: (description) =>
    set({ flowDescription: description, isDirty: true }),

  setValidationWarnings: (warnings) => set({ validationWarnings: warnings }),

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  // History management for undo/redo
  saveToHistory: () => {
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({ nodes: [...state.nodes], edges: [...state.edges] });
      // Keep max 50 history items
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      return { history: newHistory, historyIndex: newHistory.length - 1 };
    });
  },

  undo: () => {
    set((state) => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        const { nodes, edges } = state.history[newIndex];
        return { nodes, edges, historyIndex: newIndex, isDirty: true };
      }
      return state;
    });
  },

  redo: () => {
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        const { nodes, edges } = state.history[newIndex];
        return { nodes, edges, historyIndex: newIndex, isDirty: true };
      }
      return state;
    });
  },

  // Convert state back to Flow JSON
  toFlow: (): Flow => {
    const state = get();
    return {
      id: state.flowId,
      name: state.flowName,
      description: state.flowDescription,
      version: 1,
      created: '', // Will be set by backend
      modified: '', // Will be set by backend
      inputs: state.flowInputs,
      nodes: state.nodes.map((node) => ({
        id: node.id,
        type: reactFlowTypeToFlowType[node.type || 'triggerNode'] as
          | 'trigger'
          | 'llm-prompt'
          | 'image-prompt'
          | 'save-file'
          | 'claude-code'
          | 'codex',
        position: node.position,
        data: node.data as Record<string, unknown>,
      })),
      edges: state.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })),
    };
  },
}));

// Selector hooks for better performance
export const useNodes = () => useFlowEditorStore((state) => state.nodes);
export const useEdges = () => useFlowEditorStore((state) => state.edges);
export const useSelectedNode = () => {
  const nodes = useFlowEditorStore((state) => state.nodes);
  const selectedNodeId = useFlowEditorStore((state) => state.selectedNodeId);
  return nodes.find((n) => n.id === selectedNodeId) || null;
};
export const useIsDirty = () => useFlowEditorStore((state) => state.isDirty);
export const useValidationWarnings = () =>
  useFlowEditorStore((state) => state.validationWarnings);
