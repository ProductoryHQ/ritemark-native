/**
 * Flow Canvas Component
 *
 * React Flow wrapper with custom node types, edge styling,
 * drag-drop support, and ELKjs auto-layout.
 */

import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { LayoutGrid, Play } from 'lucide-react';
import { nodeTypes } from './nodes';
import { useFlowEditorStore } from './stores/flowEditorStore';
import { Button } from '../ui/button';

// ELK instance for auto-layout
const elk = new ELK();

// ELK layout options (layered algorithm for DAGs)
const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
};

interface FlowCanvasProps {
  onRunFlow?: () => void;
  onNodeSelect?: () => void;
}

function FlowCanvasInner({ onRunFlow, onNodeSelect }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const nodes = useFlowEditorStore((state) => state.nodes);
  const edges = useFlowEditorStore((state) => state.edges);
  const onNodesChange = useFlowEditorStore((state) => state.onNodesChange);
  const onEdgesChange = useFlowEditorStore((state) => state.onEdgesChange);
  const onConnect = useFlowEditorStore((state) => state.onConnect);
  const addNode = useFlowEditorStore((state) => state.addNode);
  const selectNode = useFlowEditorStore((state) => state.selectNode);
  const setNodes = useFlowEditorStore((state) => state.setNodes);

  // Handle drag over for node drop
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle node drop from palette
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      // Label is available for future use but not needed for node creation
      // const label = event.dataTransfer.getData('application/nodeLabel');

      if (!type || !reactFlowWrapper.current) {
        return;
      }

      // Get drop position in flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Add the new node
      addNode(type, position);
    },
    [screenToFlowPosition, addNode]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
      // Notify parent (exits execution mode if active)
      onNodeSelect?.();
    },
    [selectNode, onNodeSelect]
  );

  // Handle canvas click (deselect)
  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Auto-layout using ELKjs
  const onAutoLayout = useCallback(async () => {
    if (nodes.length === 0) return;

    const graph = {
      id: 'root',
      layoutOptions: elkOptions,
      children: nodes.map((node) => ({
        id: node.id,
        width: 220,
        height: 120,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })),
    };

    try {
      const layoutedGraph = await elk.layout(graph);

      if (layoutedGraph.children) {
        const layoutedNodes = nodes.map((node) => {
          const layoutedNode = layoutedGraph.children?.find(
            (n) => n.id === node.id
          );
          if (layoutedNode) {
            return {
              ...node,
              position: {
                x: layoutedNode.x || 0,
                y: layoutedNode.y || 0,
              },
            };
          }
          return node;
        });

        setNodes(layoutedNodes);

        // Fit view after layout with a small delay
        setTimeout(() => {
          fitView({ padding: 0.2 });
        }, 50);
      }
    } catch (error) {
      console.error('Auto-layout failed:', error);
    }
  }, [nodes, edges, setNodes, fitView]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: {
            stroke: 'var(--vscode-editorWidget-border)',
            strokeWidth: 2,
          },
        }}
        style={{
          background: 'var(--vscode-editor-background)',
        }}
      >
        <Background
          color="var(--vscode-panel-border)"
          gap={20}
          size={1}
        />
        <Controls
          style={{
            background: 'var(--vscode-sideBar-background)',
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '4px',
          }}
        />
      </ReactFlow>

      {/* Toolbar */}
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onAutoLayout}
          className="flex items-center gap-1.5"
        >
          <LayoutGrid size={14} />
          Auto-arrange
        </Button>
        {onRunFlow && (
          <Button
            size="sm"
            onClick={onRunFlow}
            className="flex items-center gap-1.5"
          >
            <Play size={14} />
            Run Flow
          </Button>
        )}
      </div>

      {/* Note: VS Code's tab shows dirty indicator (dot), no need for custom badge */}

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-[var(--vscode-descriptionForeground)]">
            <p className="text-lg mb-2">Empty Flow</p>
            <p className="text-sm">Drag nodes from the left panel to get started</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap with ReactFlowProvider
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
