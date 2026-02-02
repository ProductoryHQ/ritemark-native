# Sprint 27 Phase 2: Visual Flow Editor with React Flow

## Goal
Implement a visual drag-and-drop flow editor using React Flow, enabling users to create and edit automation workflows through an intuitive canvas interface. This transforms Ritemark Flows from a manual-JSON system to a user-friendly visual tool.

## Feature Flag Check
- [x] Does this sprint need a feature flag?
  - Platform-specific? **No** - Works on all platforms
  - Experimental? **Already flagged** - Uses existing `ritemark-flows` flag from Phase 1
  - Large download? **No** - React Flow already added in Phase 1 (~52KB)
  - Premium? **No** - Core feature for all users
  - Kill-switch? **Already exists** - Phase 1 feature flag covers this
  - **Decision: NO - Reuse existing `ritemark-flows` flag**

## Success Criteria
- [ ] Visual canvas replaces "Phase 2 coming soon" message
- [ ] Users can drag nodes from palette to canvas
- [ ] Users can connect nodes with edges
- [ ] Node configuration panel shows selected node properties
- [ ] Flow editor saves changes to `.flows/*.flow.json` files
- [ ] Existing flows load correctly in visual editor
- [ ] All node types render with correct styling (Input, LLM, Image, Save)
- [ ] Canvas matches VS Code theme (dark/light mode)
- [ ] Runs in both dev and production builds

## Deliverables
| Deliverable | Description |
|-------------|-------------|
| FlowEditorModal | Full-screen modal with React Flow canvas |
| FlowCanvas | React Flow wrapper with controls and background |
| NodePalette | Left sidebar with draggable node types |
| NodeConfigPanel | Right sidebar for editing selected node properties |
| Custom node components | Input, LLM, Image, Save node types |
| Zustand store | Flow state management (nodes, edges, selected node) |
| Flow serialization | Convert React Flow state ↔ .flow.json format |
| Save/Load handlers | Extension message passing for persistence |
| Image generation nodes | Support for GPT Image 1.5 API |
| Save file nodes | Support for saving generated content to workspace |

## Implementation Checklist

### Phase 2.1: Zustand Store Setup
**Goal:** Create centralized state management for the flow editor

**Create:** `webview/src/store/flowStore.ts`

```typescript
interface FlowStore {
  // Flow metadata
  flow: Flow | null;
  isDirty: boolean;

  // Canvas state
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;

  // Actions
  setFlow: (flow: Flow) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  selectNode: (node: Node | null) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  addNode: (type: string, position: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => void;
  saveFlow: () => void;
  resetStore: () => void;
}
```

**Tasks:**
- [ ] Create `webview/src/store/` directory
- [ ] Implement `flowStore.ts` with Zustand
- [ ] Add node ID generation utility (`node_llm_${timestamp}`)
- [ ] Add edge ID generation utility (`edge_${source}_${target}`)
- [ ] Implement `isDirty` tracking on any state change
- [ ] Add default node data templates for each type

### Phase 2.2: Custom Node Components
**Goal:** Create visual node components for each node type

**Create:** `webview/src/components/flows/nodes/`

**Node types to implement:**
1. **InputNode** - Flow input collector
2. **LLMNode** - LLM prompt processor
3. **ImageNode** - Image generation (GPT Image 1.5)
4. **SaveNode** - Save output to file

**Shared node structure:**
```tsx
interface NodeData {
  label: string;
  [key: string]: unknown;
}

function CustomNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div className={cn(
      "px-4 py-3 rounded-lg border-2",
      "bg-white dark:bg-gray-800",
      selected ? "border-blue-500" : "border-gray-300 dark:border-gray-600"
    )}>
      <Handle type="target" position={Position.Left} />

      {/* Node icon and label */}
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="font-medium text-sm">{data.label}</span>
      </div>

      {/* Node-specific content */}
      <div className="text-xs text-gray-500">
        {/* Display key properties */}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

**Tasks:**
- [ ] Create `nodes/InputNode.tsx`
  - Icon: FileInput from lucide-react
  - Color: Blue border
  - Display: Input variable name
  - Data: `{ label: string, inputId: string, type: 'text' | 'file' }`

- [ ] Create `nodes/LLMNode.tsx`
  - Icon: Bot from lucide-react
  - Color: Purple border
  - Display: Model name, prompt preview (first 50 chars)
  - Data: `{ label: string, model: string, systemPrompt: string, userPrompt: string }`

- [ ] Create `nodes/ImageNode.tsx`
  - Icon: Image from lucide-react
  - Color: Green border
  - Display: Image model (default: gpt-image-1.5)
  - Data: `{ label: string, model: string, prompt: string, size: '1024x1024' | '1536x1536' }`

- [ ] Create `nodes/SaveNode.tsx`
  - Icon: Save from lucide-react
  - Color: Orange border
  - Display: File path template
  - Data: `{ label: string, path: string, format: 'text' | 'markdown' | 'json' }`

- [ ] Create `nodes/index.ts` exporting all node types
- [ ] Create `nodeTypes.ts` mapping type string to component
- [ ] Add memo() to all nodes for performance

### Phase 2.3: Node Palette Sidebar
**Goal:** Drag source for adding new nodes to canvas

**Create:** `webview/src/components/flows/NodePalette.tsx`

**UI Structure:**
```
┌─────────────────┐
│   Node Palette  │
├─────────────────┤
│ Core            │
│  [Input]        │
│                 │
│ AI              │
│  [LLM Prompt]   │
│  [Image Gen]    │
│                 │
│ Output          │
│  [Save File]    │
└─────────────────┘
```

**Tasks:**
- [ ] Create `NodePalette.tsx` component
- [ ] Group nodes by category (Core, AI, Output)
- [ ] Make each item draggable with `draggable` attribute
- [ ] Set `onDragStart` to transfer node type: `e.dataTransfer.setData('application/reactflow', 'llm-prompt')`
- [ ] Style with VS Code theme variables
- [ ] Add hover effects and tooltips
- [ ] Use lucide-react icons matching node types

### Phase 2.4: Node Configuration Panel
**Goal:** Edit selected node properties in right sidebar

**Create:** `webview/src/components/flows/NodeConfigPanel.tsx`

**UI Structure:**
```
┌─────────────────────┐
│  Node Configuration │
├─────────────────────┤
│ Label               │
│ [_____________]     │
│                     │
│ {Node-specific      │
│  properties based   │
│  on type}           │
│                     │
│ [Delete Node]       │
└─────────────────────┘
```

**Tasks:**
- [ ] Create `NodeConfigPanel.tsx` component
- [ ] Show "No node selected" when `selectedNode === null`
- [ ] Display node type and label input
- [ ] Render type-specific form fields:
  - **Input:** Variable name, type (text/file), required checkbox
  - **LLM:** Model dropdown, system prompt textarea, user prompt textarea
  - **Image:** Model dropdown, prompt textarea, size selector
  - **Save:** File path input (with variable interpolation hint), format dropdown
- [ ] Use Radix UI components (Label, Input, Select, Textarea from shadcn/ui)
- [ ] Debounce updates (300ms) to avoid excessive re-renders
- [ ] Add "Delete Node" button at bottom
- [ ] Show variable reference helper: `Use {{inputs.varName}} or {{nodeId}}`

### Phase 2.5: Flow Canvas Component
**Goal:** Main React Flow canvas with drag-drop and connection handling

**Create:** `webview/src/components/flows/FlowCanvas.tsx`

**Tasks:**
- [ ] Create `FlowCanvas.tsx` component
- [ ] Import React Flow: `import { ReactFlow, Background, Controls, Panel } from '@xyflow/react'`
- [ ] Import CSS: `import '@xyflow/react/dist/style.css'`
- [ ] Connect to Zustand store: `const { nodes, edges, setNodes, setEdges, selectNode, addNode } = useFlowStore()`
- [ ] Implement `useNodesState` and `useEdgesState` hooks
- [ ] Handle `onNodesChange` (drag, select, delete)
- [ ] Handle `onEdgesChange` (connect, delete)
- [ ] Handle `onConnect` (validate connections, prevent cycles)
- [ ] Handle `onDragOver` and `onDrop` for palette drops
- [ ] Implement `onNodeClick` to update selected node
- [ ] Add keyboard shortcuts:
  - [ ] Delete key: Delete selected node/edge
  - [ ] Cmd/Ctrl+S: Save flow
  - [ ] Cmd/Ctrl+Z: Future undo (Phase 3)
- [ ] Add React Flow components:
  - [ ] `<Background variant="dots" />`
  - [ ] `<Controls />`
  - [ ] `<Panel position="top-left">Flow name</Panel>`
- [ ] Set `fitView` on initial render
- [ ] Disable nodes/edges during flow execution (read-only mode)

### Phase 2.6: Flow Editor Modal
**Goal:** Full-screen modal container for the visual editor

**Create:** `webview/src/components/flows/FlowEditorModal.tsx`

**UI Layout:**
```
┌─────────────────────────────────────────────────┐
│  [Flow Name]                    [Save] [Cancel] │
├──────┬─────────────────────────────────┬────────┤
│      │                                 │        │
│ Node │      FlowCanvas                 │ Config │
│Palett│      (React Flow)               │ Panel  │
│  e   │                                 │        │
│      │                                 │        │
│      │                                 │        │
└──────┴─────────────────────────────────┴────────┘
```

**Tasks:**
- [ ] Create `FlowEditorModal.tsx` component
- [ ] Accept props: `{ flowId?: string, onClose: () => void }`
- [ ] Use Radix Dialog for full-screen modal
- [ ] Render 3-column layout:
  - Left (200px): NodePalette
  - Center (flex-1): FlowCanvas
  - Right (300px): NodeConfigPanel
- [ ] Add top toolbar:
  - Flow name (editable input)
  - Save button (sends `flow:save` message to extension)
  - Cancel button (confirms if dirty, then closes)
- [ ] Load flow on mount if `flowId` provided
- [ ] Initialize Zustand store with flow data
- [ ] Send `flow:load` message to extension
- [ ] Handle `flow:loaded` message response
- [ ] Reset store on unmount
- [ ] Warn if closing with unsaved changes

### Phase 2.7: Extension Message Handlers
**Goal:** Add flow editor support to FlowsViewProvider

**Update:** `src/flows/FlowsViewProvider.ts`

**New message types:**
- `{ type: 'flow:create' }` → Create new empty flow, return ID
- `{ type: 'flow:load', id: string }` → Load flow, return Flow object
- `{ type: 'flow:save', flow: Flow }` → Save flow to disk
- `{ type: 'flow:editor:open', id?: string }` → Signal to open editor modal

**Tasks:**
- [ ] Add `handleCreateFlow()` method
  - Generate new flow ID: `flow_${Date.now()}`
  - Create empty flow with metadata
  - Save to `.flows/`
  - Return flow object to webview

- [ ] Add `handleSaveFlow()` method
  - Validate flow structure
  - Update `modified` timestamp
  - Write to `.flows/${flow.id}.flow.json`
  - Send success/error response

- [ ] Update custom HTML UI to send `flow:editor:open` on "New Flow" and "Edit" buttons
- [ ] Add WebviewPanel support for editor (or reuse sidebar with conditional rendering)

### Phase 2.8: Flow Serialization Utilities
**Goal:** Convert between React Flow state and .flow.json format

**Create:** `webview/src/utils/flowSerializer.ts`

**Functions:**
```typescript
// React Flow Node → Flow JSON Node
function serializeNode(node: Node): FlowNode {
  return {
    id: node.id,
    type: node.type as FlowNode['type'],
    position: node.position,
    data: node.data,
  };
}

// React Flow Edge → Flow JSON Edge
function serializeEdge(edge: Edge): FlowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
  };
}

// Flow JSON → React Flow nodes/edges
function deserializeFlow(flow: Flow): {
  nodes: Node[];
  edges: Edge[];
} {
  return {
    nodes: flow.nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    edges: flow.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
  };
}
```

**Tasks:**
- [ ] Create `webview/src/utils/` directory
- [ ] Implement serialization utilities
- [ ] Add flow validation (check for cycles, disconnected nodes)
- [ ] Add input inference (detect which nodes reference `{{inputs.x}}`)
- [ ] Use in FlowEditorModal for save/load

### Phase 2.9: Image Generation Node Executor
**Goal:** Extend FlowExecutor to support image generation nodes

**Update:** `src/flows/FlowExecutor.ts`
**Create:** `src/flows/nodes/ImageNodeExecutor.ts`

**Tasks:**
- [ ] Create `ImageNodeExecutor.ts`
- [ ] Import OpenAI SDK (already in dependencies)
- [ ] Implement `executeImageNode(node, context)`:
  - Extract prompt from `node.data.prompt`
  - Interpolate variables: `{{inputs.x}}`, `{{nodeId}}`
  - Call OpenAI Images API:
    ```typescript
    const response = await openai.images.generate({
      model: node.data.model || 'gpt-image-1.5',
      prompt: interpolatedPrompt,
      n: 1,
      size: node.data.size || '1024x1024',
    });
    ```
  - Return image URL
  - Handle errors (rate limit, invalid prompt, API key missing)
- [ ] Register in FlowExecutor's node executor map
- [ ] Add progress reporting

### Phase 2.10: Save File Node Executor
**Goal:** Extend FlowExecutor to support saving files

**Create:** `src/flows/nodes/SaveNodeExecutor.ts`

**Tasks:**
- [ ] Create `SaveNodeExecutor.ts`
- [ ] Implement `executeSaveNode(node, context)`:
  - Extract file path from `node.data.path`
  - Interpolate variables: `{{inputs.x}}`, `{{nodeId}}`
  - Get content from previous node output (source edge)
  - Resolve path relative to workspace root
  - Ensure parent directories exist
  - Write file with correct format (text/markdown/json)
  - Return saved file path
- [ ] Register in FlowExecutor
- [ ] Add error handling (permission denied, disk full, invalid path)

### Phase 2.11: Update FlowsPanel Integration
**Goal:** Connect FlowsPanel to new visual editor

**Update:** `webview/src/components/flows/FlowsPanel.tsx`

**Tasks:**
- [ ] Add "Edit" button to each flow card
- [ ] Add "New Flow" button at top of panel
- [ ] Remove "Phase 2 coming soon" message from empty state
- [ ] Update empty state to suggest creating first flow
- [ ] Add state for editor modal: `const [editorFlowId, setEditorFlowId] = useState<string | null>(null)`
- [ ] Conditionally render FlowEditorModal:
  ```tsx
  {editorFlowId && (
    <FlowEditorModal
      flowId={editorFlowId}
      onClose={() => setEditorFlowId(null)}
    />
  )}
  ```
- [ ] Update "New Flow" command handler in extension to send `flow:create` message

### Phase 2.12: VS Code Theme Integration
**Goal:** Ensure React Flow matches VS Code dark/light theme

**Create:** `webview/src/styles/reactflow-vscode-theme.css`

**Tasks:**
- [ ] Create CSS file with VS Code variable overrides
- [ ] Style React Flow components:
  ```css
  .react-flow {
    background: var(--vscode-editor-background);
  }

  .react-flow__node {
    color: var(--vscode-foreground);
  }

  .react-flow__edge-path {
    stroke: var(--vscode-panel-border);
  }

  .react-flow__controls button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-border);
  }

  .react-flow__background {
    background: var(--vscode-editor-background);
  }
  ```
- [ ] Import in FlowCanvas component
- [ ] Test in both light and dark VS Code themes

### Phase 2.13: Testing & Validation
**Goal:** Verify all functionality works in dev and production

**Test scenarios:**

**Basic editor operations:**
- [ ] Create new flow
- [ ] Drag nodes from palette to canvas
- [ ] Connect nodes with edges
- [ ] Delete nodes and edges
- [ ] Edit node properties in config panel
- [ ] Save flow to disk
- [ ] Load existing flow
- [ ] Cancel with unsaved changes (shows warning)

**Node types:**
- [ ] Input node: Configure text/file input
- [ ] LLM node: Set model, prompts, see preview
- [ ] Image node: Set model, size, prompt
- [ ] Save node: Set path template, format

**Flow execution:**
- [ ] Create flow: Input → LLM → Save
- [ ] Run from FlowsPanel
- [ ] Verify LLM output appears
- [ ] Verify file is saved to workspace
- [ ] Create flow: Input → Image
- [ ] Verify image URL is returned

**Edge cases:**
- [ ] Circular dependency detection (should show error)
- [ ] Disconnected nodes (should warn or skip)
- [ ] Missing inputs (should show validation error before run)
- [ ] Invalid variable references (should show error during run)

**Production build:**
- [ ] Build webview: `cd webview && npm run build`
- [ ] Compile extension: `cd .. && npm run compile`
- [ ] Invoke vscode-expert for production build
- [ ] Test all scenarios in built app

### Phase 2.14: Documentation
**Goal:** Document the visual editor for users and future maintainers

**Tasks:**
- [ ] Update `docs/features/flows.md`:
  - Add visual editor section
  - Explain node types and properties
  - Show screenshot of editor (if possible)
  - Document variable interpolation syntax
  - Add example workflows

- [ ] Create `docs/sprints/sprint-27-ritemark-flows/notes/phase-2-implementation.md`:
  - Document technical decisions
  - Explain React Flow integration
  - Note any deviations from plan
  - List known limitations

- [ ] Update sprint plan checklist (mark completed tasks)
- [ ] Update STATUS.md to Phase 2 Complete

## Status
**Current Phase:** 2 (Plan - Phase 2)
**Approval Required:** Yes - Cannot proceed to Phase 3 (Development) without Jarmo's approval

## Approval
- [ ] Jarmo approved this Phase 2 sprint plan

---

## Technical Decisions

### React Flow vs. Custom Canvas
**Decision:** Use React Flow UI with Workflow Editor template as reference

**Rationale:**
- Proven library with 20K+ GitHub stars
- Built-in drag-drop, connection validation, pan/zoom
- Workflow Editor template provides exact pattern we need
- shadcn/ui integration matches our planned migration
- 52KB bundle impact acceptable for major feature

### State Management: Zustand vs. Redux
**Decision:** Zustand

**Rationale:**
- Lightweight (2KB vs 15KB for Redux)
- No Provider wrapper needed
- Simple API, minimal boilerplate
- Recommended by React Flow docs
- Already added in Phase 1

### Node Configuration: Inline vs. Sidebar Panel
**Decision:** Right sidebar panel (like OpenAI Agent Builder)

**Rationale:**
- More space for complex properties (LLM prompts, image settings)
- Doesn't clutter canvas
- Matches user's reference image
- Separates viewing (canvas) from editing (panel)

### Save Strategy: Auto-save vs. Manual Save
**Decision:** Manual save with dirty state tracking

**Rationale:**
- User control over when changes persist
- Avoids confusing auto-save race conditions
- Clear "unsaved changes" warning on close
- Matches VS Code file editing patterns

### Image Node Output: URL vs. Base64 vs. File
**Decision:** Return URL, optionally download in Save node

**Rationale:**
- GPT Image API returns URL by default
- Faster (no large base64 strings in memory)
- User can choose to save with Save node
- Temporary URLs valid for 1 hour (sufficient for workflow)

### Flow Validation: Editor-time vs. Run-time
**Decision:** Basic validation at editor-time (cycles, disconnected), full validation at run-time

**Rationale:**
- Editor validation prevents obvious errors
- Run-time validation handles dynamic issues (missing API keys, variable errors)
- Doesn't block creative exploration in editor

---

## Dependencies Impact

**No new dependencies** - All required packages added in Phase 1:
- reactflow: 45KB
- @xyflow/react: 5KB
- zustand: 2KB
- **Total: 52KB** (already accounted for)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| React Flow theme mismatch | Medium | Create VS Code CSS theme overrides, test both modes |
| Complex node config UI | Medium | Use shadcn/ui components, follow Radix patterns |
| Flow serialization bugs | High | Comprehensive tests, validate with existing Phase 1 flows |
| Image API errors | Medium | Clear error messages, retry logic, API key validation |
| File save permission errors | Medium | Pre-validate paths, show clear errors, suggest fixes |
| Canvas performance with many nodes | Low | React Flow handles 100s of nodes, memo() optimizations |

---

## Out of Scope (Future Phases)

Deferred to Phase 3+:
- Undo/redo functionality
- Auto-layout with ELKjs
- Flow templates library
- Flow export/import (share flows)
- Collaborative editing
- Flow versioning/history
- Custom node types (plugins)
- Keyboard shortcuts beyond delete/save
- Flow debugging (step-through execution)
- Node search/filter in palette

Phase 2 focuses on:
- ✅ Visual canvas with drag-drop
- ✅ Node configuration panel
- ✅ All 4 node types working
- ✅ Image generation integration
- ✅ File save functionality
- ✅ Clean, themeable UI

---

## Success Metrics

**Definition of Done:**
1. User can create a complete flow visually (no JSON editing)
2. Flow saves correctly and loads in visual editor
3. Visual editor matches VS Code theme
4. All node types (Input, LLM, Image, Save) work end-to-end
5. Tests pass in dev and production builds
6. Documentation is complete
7. qa-validator passes all checks

**User Experience Benchmark:**
- Flow creation should feel as intuitive as OpenAI Agent Builder (reference image)
- Node palette is discoverable and self-explanatory
- Configuration panel updates are immediate (debounced but responsive)
- No canvas jank or performance issues with 10-20 nodes

---

## Reference Image Analysis

From user-provided OpenAI Agent Builder screenshot:

**Layout:**
- Left sidebar: Node palette with categories (Core, Tools, Logic, Data)
- Center: Large canvas with nodes and connections
- Right sidebar: Node configuration panel
- Bottom: Zoom controls and pan buttons

**Node styling:**
- Different colors per category (blue, green, purple, orange)
- Icons on left side of node
- Node label prominent
- Subtle borders, rounded corners
- Handles on left/right for connections

**Edges:**
- Smooth bezier curves
- Arrows indicating direction
- If/else branching with multiple outputs (future: conditional nodes)

**Canvas:**
- Dot grid background
- Pan/zoom controls bottom-right
- Minimap (optional, can defer)

**Matched in our design:**
- 3-column layout (palette, canvas, config)
- Color-coded node types
- Icons from lucide-react
- Radix Dialog for full-screen editor
- React Flow controls and background

**Deferred:**
- Minimap (Phase 3)
- Conditional branching (Phase 3+)
- Advanced edge styling (custom edge types)

---

## Phase 2 File Structure

**New files created:**
```
webview/src/
├── store/
│   └── flowStore.ts                    # Zustand state
├── components/flows/
│   ├── FlowEditorModal.tsx             # Full-screen editor
│   ├── FlowCanvas.tsx                  # React Flow wrapper
│   ├── NodePalette.tsx                 # Drag source sidebar
│   ├── NodeConfigPanel.tsx             # Right sidebar config
│   └── nodes/
│       ├── InputNode.tsx               # Input node component
│       ├── LLMNode.tsx                 # LLM node component
│       ├── ImageNode.tsx               # Image node component
│       ├── SaveNode.tsx                # Save node component
│       ├── nodeTypes.ts                # Type → Component mapping
│       └── index.ts                    # Exports
├── utils/
│   └── flowSerializer.ts               # Flow ↔ React Flow conversion
└── styles/
    └── reactflow-vscode-theme.css      # VS Code theme integration
```

**Modified files:**
```
webview/src/components/flows/
├── FlowsPanel.tsx                      # Add Edit/New buttons
└── types.ts                            # Add editor message types

extensions/ritemark/src/flows/
├── FlowsViewProvider.ts                # Add editor message handlers
├── FlowExecutor.ts                     # Add image/save node support
└── nodes/
    ├── ImageNodeExecutor.ts            # NEW: Image generation
    └── SaveNodeExecutor.ts             # NEW: File saving
```

**Total new files:** 14
**Total modified files:** 4

---

## Notes

- Sprint continues on `feature/ritemark-flows` branch
- Phase 1 is already complete and tested
- React Flow dependencies already installed
- Feature flag already active in Phase 1
- Following 6-phase workflow with HARD gates
- Invoke qa-validator before any commits
- Invoke vscode-expert for production builds

---

## Questions for Jarmo

1. **Image handling:** Return URLs or auto-download images to workspace?
2. **Flow validation:** Show errors before allowing save, or allow saving invalid flows?
3. **Node palette:** Fixed categories or allow user to collapse/expand?
4. **Canvas size:** Full-screen modal or embedded in sidebar panel?
5. **Auto-layout:** Include ELKjs in Phase 2 or defer to Phase 3?

---

**Last Updated:** 2026-01-31
**Phase:** 2 (Plan - Visual Editor)
**Sprint Manager:** Claude (sprint-manager agent)
