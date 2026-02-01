# React Flow UI Research

## Official Resources

- **Main site:** https://reactflow.dev/
- **UI Components:** https://reactflow.dev/ui
- **Workflow Editor Template:** https://reactflow.dev/ui/templates/workflow-editor
- **Docs:** https://reactflow.dev/api-reference
- **GitHub:** https://github.com/xyflow/xyflow

## Key Features (2026 Update)

**React Flow 12.x** (latest as of Jan 2026):
- React 19 compatible
- Tailwind CSS 4 support
- TypeScript first-class support
- MIT licensed
- ~50KB gzipped

**React Flow UI** (component library):
- Built on shadcn/ui (Radix UI + Tailwind)
- Dark mode support (VS Code compatible)
- Workflow Editor template includes:
  - Zustand state management
  - Drag-drop sidebar (node palette)
  - Sequential runner pattern
  - ELKjs auto-layout integration
  - Node configuration panel

## Core Packages

```json
{
  "reactflow": "^12.3.5",          // Core library
  "@xyflow/react": "^12.3.5",      // React bindings
  "zustand": "^5.0.2",             // State management (lightweight)
  "elkjs": "^0.9.3"                // Auto-layout (optional)
}
```

**Total bundle impact:** ~150KB gzipped (with all features)

## Basic Usage Pattern

```tsx
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Input' } },
  { id: '2', position: { x: 200, y: 100 }, data: { label: 'LLM' } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2' },
];

function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

## Custom Node Types

```tsx
import { Handle, Position } from '@xyflow/react';

function LLMNode({ data }: { data: { label: string; model: string } }) {
  return (
    <div className="px-4 py-2 rounded-lg border bg-white dark:bg-gray-800">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4" />
        <span className="font-medium">{data.label}</span>
      </div>
      <div className="text-xs text-gray-500">{data.model}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  llm: LLMNode,
  input: InputNode,
  image: ImageNode,
  save: SaveNode,
};

<ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} />
```

## Sequential Execution Pattern

From Workflow Editor template:

```typescript
interface ExecutionContext {
  inputs: Record<string, unknown>;
  outputs: Map<string, unknown>;
}

async function executeFlow(
  nodes: Node[],
  edges: Edge[],
  inputs: Record<string, unknown>
): Promise<ExecutionContext> {
  const context: ExecutionContext = {
    inputs,
    outputs: new Map(),
  };

  // Topological sort to get execution order
  const order = getExecutionOrder(nodes, edges);

  for (const nodeId of order) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;

    // Execute node with context
    const result = await executeNode(node, context);
    context.outputs.set(nodeId, result);
  }

  return context;
}
```

## Drag & Drop Pattern

```tsx
const onDragOver = useCallback((event: React.DragEvent) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}, []);

const onDrop = useCallback(
  (event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: { label: `${type} node` },
    };

    setNodes((nds) => nds.concat(newNode));
  },
  [reactFlowInstance]
);

// Sidebar palette
<div
  draggable
  onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'llm')}
>
  Drag to add LLM node
</div>

// Canvas
<ReactFlow onDragOver={onDragOver} onDrop={onDrop} />
```

## State Management with Zustand

```typescript
import { create } from 'zustand';

interface FlowStore {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  selectNode: (node: Node | null) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
}

export const useFlowStore = create<FlowStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  selectNode: (node) => set({ selectedNode: node }),
  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),
}));
```

## VS Code Theme Integration

React Flow supports CSS variables for theming:

```css
/* Tailwind config */
.dark .react-flow__node {
  background: var(--vscode-editor-background);
  border-color: var(--vscode-panel-border);
  color: var(--vscode-foreground);
}

.dark .react-flow__edge-path {
  stroke: var(--vscode-panel-border);
}

.dark .react-flow__controls button {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
```

## ELKjs Auto-Layout (Optional)

```typescript
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

async function autoLayout(nodes: Node[], edges: Edge[]) {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '80',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: 200,
      height: 100,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layout = await elk.layout(graph);

  // Update node positions from layout
  return nodes.map((n) => {
    const node = layout.children?.find((c) => c.id === n.id);
    return {
      ...n,
      position: { x: node?.x || 0, y: node?.y || 0 },
    };
  });
}
```

## Workflow Editor Template Structure

From https://reactflow.dev/ui/templates/workflow-editor:

```
src/
├── components/
│   ├── FlowCanvas.tsx       # Main React Flow wrapper
│   ├── NodePalette.tsx      # Drag source sidebar
│   ├── NodeConfigPanel.tsx  # Right sidebar config
│   └── nodes/
│       ├── InputNode.tsx
│       ├── ProcessNode.tsx
│       └── OutputNode.tsx
├── store/
│   └── flowStore.ts         # Zustand store
└── utils/
    ├── executor.ts          # Sequential runner
    └── validation.ts        # Flow validation
```

## Performance Optimization

```tsx
import { memo } from 'react';

// Memoize custom nodes
const LLMNode = memo(({ data }: NodeProps) => {
  // ... node implementation
});

// Use React Flow's optimization hooks
const onNodesChange = useCallback(
  (changes: NodeChange[]) => applyNodeChanges(changes, nodes),
  [nodes]
);

// Limit re-renders with nodesDraggable, nodesConnectable
<ReactFlow
  nodesDraggable={!isExecuting}
  nodesConnectable={!isExecuting}
/>
```

## Key Decisions for RiteMark Flows

1. **Use Workflow Editor template as reference** - Don't reinvent the wheel
2. **Zustand for state** - Lightweight, no Provider hell
3. **Custom node types** - Input, LLM, Image, Save (4 total)
4. **Defer ELKjs** - Add in Phase 2 if needed (users can manually arrange)
5. **Dark mode first** - Match VS Code theme
6. **Lazy load editor** - Keep main bundle small, load React Flow on demand

## Bundle Size Analysis

```
reactflow: 45KB
@xyflow/react: 5KB
zustand: 2KB
elkjs (if added): 95KB
---
Total (without elkjs): ~52KB
Total (with elkjs): ~147KB
```

Recommendation: Ship without elkjs for MVP, add later if users request auto-layout.

## Known Limitations

1. **No built-in persistence** - We need to implement save/load ourselves (not a problem, we're using .flow.json)
2. **No undo/redo** - Template doesn't include it (out of scope for v1)
3. **No collaborative editing** - Single-user only (matches our local-first approach)
4. **Mobile support limited** - Not relevant for VS Code extension

## Integration with VS Code Webview

React Flow expects a container with defined dimensions:

```tsx
// FlowsPanel.tsx
export function FlowsPanel() {
  return (
    <div className="w-full h-screen">
      <ReactFlow nodes={nodes} edges={edges}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

**VS Code webview CSS:**
```css
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#root {
  width: 100vw;
  height: 100vh;
}
```

## Next Steps

1. Add dependencies to `webview/package.json`
2. Create basic FlowCanvas component
3. Test React Flow rendering in VS Code webview
4. Implement custom node types
5. Add Zustand store for flow state
6. Implement sequential executor (extension-side)
