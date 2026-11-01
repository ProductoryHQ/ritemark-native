/**
 * Flow Canvas Component
 *
 * React Flow wrapper with custom node types, edge styling,
 * drag-drop support, and ELKjs auto-layout.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesInitialized,
  useReactFlow,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { nodeTypes } from './nodes';
import { useFlowEditorStore } from './stores/flowEditorStore';

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
  onNodeSelect?: () => void;
}

/** a small flow at 100%, as drawn; a larger one shrinks to fit */
const FIT_OPTIONS = { padding: 0.2, maxZoom: 1 };
/** experience 31: the flow starts 56 below the canvas's top edge */
const FIT_TOP = 56;

/**
 * Fits the flow to the canvas as experience 31 draws it: centred across, at the top rather than in the middle, so a
 * flow reads from its first step down. React Flow's own fit sets the zoom and the centre; this moves the flow up.
 */
function useFitFlow() {
  const { fitView, getNodes, getNodesBounds, getViewport, setViewport } = useReactFlow();
  return useCallback(async () => {
    await fitView(FIT_OPTIONS);
    const nodes = getNodes();
    if (nodes.length === 0) {
      return;
    }
    const { x, zoom } = getViewport();
    await setViewport({ x, y: FIT_TOP - getNodesBounds(nodes).y * zoom, zoom });
  }, [fitView, getNodes, getNodesBounds, getViewport, setViewport]);
}

/**
 * Auto-arrange (ELKjs): lays the steps out top to bottom and fits the view. Ritemark 2.0 (experience 31): the desk's
 * bar runs it, so it needs the ReactFlowProvider that FlowEditor puts round the bar and the canvas.
 */
export function useFlowAutoArrange() {
  const fitFlow = useFitFlow();
  const nodes = useFlowEditorStore((state) => state.nodes);
  const edges = useFlowEditorStore((state) => state.edges);
  const setNodes = useFlowEditorStore((state) => state.setNodes);
  const markDirty = useFlowEditorStore((state) => state.markDirty);
  const saveToHistory = useFlowEditorStore((state) => state.saveToHistory);

  return useCallback(async () => {
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
        // Sprint 145 R4 (review round 2): the new layout is an edit, so it is saved, and undo brings the old one back.
        // A click on a step used to write it by accident; a click is a look now.
        markDirty();
        saveToHistory();

        // Fit view after layout with a small delay
        setTimeout(() => {
          void fitFlow();
        }, 50);
      }
    } catch (error) {
      console.error('Auto-layout failed:', error);
    }
  }, [nodes, edges, setNodes, markDirty, saveToHistory, fitFlow]);
}


export function FlowCanvas({ onNodeSelect }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const fitFlow = useFitFlow();

  // Ritemark 2.0: the canvas narrows when a step's settings open beside it, so the flow stays fitted to it until
  // the person pans or zooms (then their view is theirs)
  const fittedRef = useRef(true);
  // a press on the empty canvas also starts a "move", so only a view that really changed counts
  const moveStartRef = useRef<Viewport | null>(null);
  const onMoveStart = useCallback((event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    moveStartRef.current = event ? viewport : null;
  }, []);
  const onMoveEnd = useCallback((event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    const start = moveStartRef.current;
    moveStartRef.current = null;
    if (event && start && (start.x !== viewport.x || start.y !== viewport.y || start.zoom !== viewport.zoom)) {
      fittedRef.current = false;
    }
  }, []);
  useEffect(() => {
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) {
      return;
    }
    let width = wrapper.clientWidth;
    const observer = new ResizeObserver(() => {
      if (Math.abs(wrapper.clientWidth - width) > 1 && fittedRef.current) {
        // after React Flow has measured the new size itself
        requestAnimationFrame(() => requestAnimationFrame(() => void fitFlow()));
      }
      width = wrapper.clientWidth;
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [fitFlow]);

  const nodes = useFlowEditorStore((state) => state.nodes);

  // The first fit, once the flow has loaded and React Flow has measured its steps; the canvas shows only after it,
  // so the flow never jumps. A flow with no steps shows at once (React Flow never reports zero nodes as measured).
  const flowLoaded = useFlowEditorStore((state) => state.flowId !== '');
  const nodesInitialized = useNodesInitialized();
  const placingRef = useRef(false);
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    if (placingRef.current || !flowLoaded) {
      return;
    }
    if (nodes.length === 0) {
      placingRef.current = true;
      setPlaced(true);
      return;
    }
    if (!nodesInitialized) {
      return;
    }
    placingRef.current = true;
    void fitFlow().then(() => setPlaced(true));
  }, [flowLoaded, nodesInitialized, nodes.length, fitFlow]);
  const onFitView = useCallback(() => {
    fittedRef.current = true;
    void fitFlow();
  }, [fitFlow]);
  const edges = useFlowEditorStore((state) => state.edges);
  const onNodesChange = useFlowEditorStore((state) => state.onNodesChange);
  const onEdgesChange = useFlowEditorStore((state) => state.onEdgesChange);
  const onConnect = useFlowEditorStore((state) => state.onConnect);
  const addNode = useFlowEditorStore((state) => state.addNode);
  const selectNode = useFlowEditorStore((state) => state.selectNode);

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

  return (
    <div ref={reactFlowWrapper} className="rm-flow-canvas relative h-full flex-1 border-x border-t border-[var(--r-hairline)]">
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
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        fitViewOptions={FIT_OPTIONS}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: {
            stroke: 'var(--r-hairline-strong)', /* kit: .edge, 2 in the strong hairline */
            strokeWidth: 2,
          },
        }}
        style={{
          background: 'var(--r-surface)',
          opacity: placed ? 1 : 0,
        }}
      >
        <Background
          color="var(--r-hairline-strong)" /* kit: .canvas, a dot every 20 */
          gap={20}
          size={1}
        />
        {/* The zoom controls, one 28-wide stack at the bottom left (index.css, .rm-flow-canvas) */}
        <Controls position="bottom-left" onFitView={onFitView} />
      </ReactFlow>

      {/* Note: VS Code's tab shows dirty indicator (dot), no need for custom badge */}

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-[var(--r-ink-muted)]">
            <p className="mb-2 text-[15px] font-semibold text-[var(--r-ink-strong)]">Empty flow</p>
            <p className="text-[13px]">Drag steps from the left to get started</p>
          </div>
        </div>
      )}
    </div>
  );
}
