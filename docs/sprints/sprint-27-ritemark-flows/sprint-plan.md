# Sprint 27: RiteMark Flows - Phase 1 MVP

## Goal
Implement a lightweight node-based automation system for RiteMark Native, enabling users to create visual workflows that combine AI (LLM, image generation) with file operations. Phase 1 delivers core infrastructure and basic execution.

## Feature Flag Check
- [x] Does this sprint need a feature flag?
  - Platform-specific? **No** - Works on all platforms (darwin, win32, linux)
  - Experimental? **Yes** - New major feature, requires testing before stable release
  - Large download? **No** - React Flow UI adds ~50KB to webview bundle
  - Premium? **No** - Core feature for all users
  - Kill-switch? **Yes** - New feature should be easily disableable if issues arise
  - **Decision: YES - Feature flag required**
    - Flag ID: `ritemark-flows`
    - Status: `experimental` (default OFF, requires user opt-in)
    - Setting: `ritemark.experimental.ritemarkFlows`

## Success Criteria
- [ ] Feature flag gates all Flows functionality
- [ ] Flows sidebar panel appears when feature is enabled
- [ ] Users can create and save flows to `.flows/*.flow.json`
- [ ] FlowExecutor can run simple Input → LLM → Save flows
- [ ] Flow execution is sequential and reports progress
- [ ] All features work in both dev and production builds
- [ ] React Flow UI renders correctly in VS Code webview theme

## Deliverables
| Deliverable | Description |
|-------------|-------------|
| Feature flag | `ritemark-flows` flag with experimental status, setting in package.json |
| FlowStorage service | CRUD operations for `.flows/*.flow.json` files |
| FlowExecutor service | Sequential node execution engine (extension-side) |
| FlowsViewProvider | Sidebar webview provider (similar to UnifiedViewProvider) |
| FlowsPanel (webview) | React component listing flows with Run/Edit buttons |
| RunFlowModal (webview) | Input collection and execution progress UI |
| React Flow dependencies | Add `reactflow`, `@xyflow/react`, `zustand` to webview/package.json |
| Node executors | LLMNodeExecutor (uses existing OpenAI service) |
| Flow JSON schema | Define flow definition format with validation |

## Implementation Checklist

### Phase 1.1: Feature Flag Setup
- [ ] Add `'ritemark-flows'` to `FlagId` union type in `flags.ts`
- [ ] Define feature flag in `FLAGS` registry:
  ```typescript
  'ritemark-flows': {
    id: 'ritemark-flows',
    label: 'RiteMark Flows',
    description: 'Visual automation workflows with AI and file operations',
    status: 'experimental',
    platforms: ['darwin', 'win32', 'linux'],
  }
  ```
- [ ] Add experimental setting to `package.json`:
  ```json
  "ritemark.experimental.ritemarkFlows": {
    "type": "boolean",
    "default": false,
    "description": "Enable RiteMark Flows (experimental) - Visual automation workflows"
  }
  ```
- [ ] Test flag evaluation logic (`isEnabled('ritemark-flows')` returns correct values)

### Phase 1.2: Extension Infrastructure
**Pattern:** Follow UnifiedViewProvider structure

**Files to create:**
```
extensions/ritemark/src/flows/
├── FlowStorage.ts         # CRUD for .flow.json files
├── FlowExecutor.ts        # Sequential execution engine
├── FlowsViewProvider.ts   # Webview view provider
├── types.ts               # Flow, Node, Edge type definitions
└── nodes/
    └── LLMNodeExecutor.ts # LLM node execution (reuses openaiService)
```

**Implementation:**
- [ ] Create `types.ts` with Flow JSON schema:
  ```typescript
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
  ```

- [ ] Create `FlowStorage.ts`:
  - [ ] `ensureFlowsDirectory()` - Create `.flows/` if not exists
  - [ ] `listFlows()` - Read all `*.flow.json` files
  - [ ] `loadFlow(id: string)` - Read and parse single flow
  - [ ] `saveFlow(flow: Flow)` - Write flow JSON with pretty formatting
  - [ ] `deleteFlow(id: string)` - Remove flow file
  - [ ] Handle errors gracefully (file not found, invalid JSON, etc.)

- [ ] Create `FlowExecutor.ts`:
  - [ ] `executeFlow(flow: Flow, inputs: Record<string, unknown>)` - Main entry point
  - [ ] `getExecutionOrder(nodes, edges)` - Topological sort
  - [ ] `executeNode(node, context)` - Dispatch to node executors
  - [ ] `buildContext(inputs)` - Create execution context
  - [ ] Progress callbacks: `onProgress(step, total, currentNode)`
  - [ ] Error handling: Stop on first error, return partial results

- [ ] Create `nodes/LLMNodeExecutor.ts`:
  - [ ] Import existing `generateCompletion` from `ai/openaiService`
  - [ ] Extract prompt template variables (e.g., `{{inputs.topic}}`)
  - [ ] Replace variables with context values
  - [ ] Call LLM API
  - [ ] Return response text
  - [ ] Handle API errors (rate limit, invalid key, etc.)

- [ ] Create `FlowsViewProvider.ts`:
  - [ ] Implement `vscode.WebviewViewProvider`
  - [ ] Gate initialization with `isEnabled('ritemark-flows')`
  - [ ] Set up message handlers:
    - [ ] `ready` - Send initial flow list
    - [ ] `flow:list` - Return all flows
    - [ ] `flow:load` - Load specific flow
    - [ ] `flow:save` - Save flow to disk
    - [ ] `flow:delete` - Delete flow
    - [ ] `flow:run` - Execute flow with inputs
    - [ ] `flow:cancel` - Abort running flow
  - [ ] Use FlowStorage for persistence
  - [ ] Use FlowExecutor for running flows
  - [ ] Send progress updates to webview during execution

- [ ] Register FlowsViewProvider in `extension.ts`:
  - [ ] Check feature flag: `if (!isEnabled('ritemark-flows')) return;`
  - [ ] Instantiate provider
  - [ ] Register with `vscode.window.registerWebviewViewProvider`
  - [ ] Add to views container (see Phase 1.3)

### Phase 1.3: Package.json Updates
- [ ] Add Flows view to `contributes.views`:
  ```json
  "views": {
    "ritemark-ai": [
      {
        "type": "webview",
        "id": "ritemark.flowsView",
        "name": "Flows",
        "contextualTitle": "Flows",
        "when": "config.ritemark.experimental.ritemarkFlows"
      }
    ]
  }
  ```
- [ ] Add commands:
  ```json
  {
    "command": "ritemark.flows.new",
    "title": "Ritemark: New Flow",
    "icon": "$(add)"
  },
  {
    "command": "ritemark.flows.refresh",
    "title": "Refresh Flows",
    "icon": "$(refresh)"
  }
  ```
- [ ] Add menus (view/title for Flows panel):
  ```json
  "view/title": [
    {
      "command": "ritemark.flows.new",
      "when": "view == ritemark.flowsView",
      "group": "navigation@1"
    },
    {
      "command": "ritemark.flows.refresh",
      "when": "view == ritemark.flowsView",
      "group": "navigation@2"
    }
  ]
  ```

### Phase 1.4: Webview Dependencies
- [ ] Add to `webview/package.json` dependencies:
  ```json
  "reactflow": "^12.3.5",
  "@xyflow/react": "^12.3.5",
  "zustand": "^5.0.2"
  ```
- [ ] Run `npm install` in `extensions/ritemark/webview/`
- [ ] Verify bundle size increase is acceptable (<100KB added)

### Phase 1.5: Webview Components (Basic UI)
**Files to create:**
```
webview/src/components/flows/
├── FlowsPanel.tsx         # Main sidebar panel (flow list)
├── RunFlowModal.tsx       # Run flow with inputs + progress
├── types.ts               # Mirror extension types
└── index.ts               # Exports
```

**Implementation:**
- [ ] Create `types.ts` - Copy Flow, FlowNode, FlowEdge from extension types
- [ ] Create `FlowsPanel.tsx`:
  - [ ] Display list of flows (name, description, last run)
  - [ ] "New Flow" button (Phase 2 - just show "Coming soon" toast)
  - [ ] Per-flow actions:
    - [ ] "Run" button → Opens RunFlowModal
    - [ ] "Edit" button → Phase 2 (show toast)
    - [ ] "Delete" button → Confirm then delete
  - [ ] Empty state when no flows exist
  - [ ] Loading state while fetching flows
  - [ ] Use existing shadcn/ui components (Button, Dialog, Alert)

- [ ] Create `RunFlowModal.tsx`:
  - [ ] Display flow name and description
  - [ ] Collect inputs (text fields, file pickers)
  - [ ] Show execution progress:
    ```
    Running step 2 of 3: LLM Writer...
    [████████████░░░░] 65%
    ```
  - [ ] Handle completion:
    - Success: Show output summary
    - Error: Display error message with retry option
  - [ ] Cancel button (sends abort message to extension)
  - [ ] Use Radix Dialog, Progress components

- [ ] Integrate into webview entry point:
  - [ ] Add FlowsPanel to router/conditional rendering
  - [ ] Check feature flag state (sent from extension on init)
  - [ ] Hide UI if flag is disabled

### Phase 1.6: Message Passing & Bridge
- [ ] Define message types in `webview/src/types/bridge.ts`:
  ```typescript
  type FlowsMessage =
    | { type: 'flow:list'; flows: Flow[] }
    | { type: 'flow:loaded'; flow: Flow }
    | { type: 'flow:progress'; step: number; total: number; node: string }
    | { type: 'flow:complete'; output: Record<string, unknown> }
    | { type: 'flow:error'; error: string };
  ```

- [ ] Implement webview → extension messages:
  - [ ] `{ type: 'flow:run', id: string, inputs: Record<string, unknown> }`
  - [ ] `{ type: 'flow:cancel' }`
  - [ ] `{ type: 'flow:delete', id: string }`

- [ ] Implement extension → webview messages:
  - [ ] Send flow list on `ready`
  - [ ] Send progress updates during execution
  - [ ] Send completion/error on finish

### Phase 1.7: Testing & Validation
**Create test flow manually:**
```json
// .flows/test-blog-post.flow.json
{
  "id": "test-blog-post",
  "name": "Blog Post Outline",
  "description": "Generate a blog post outline from a topic",
  "version": 1,
  "created": "2026-01-31T12:00:00Z",
  "modified": "2026-01-31T12:00:00Z",
  "inputs": [
    { "id": "topic", "type": "text", "label": "Topic", "required": true }
  ],
  "nodes": [
    {
      "id": "node_llm",
      "type": "llm-prompt",
      "position": { "x": 200, "y": 100 },
      "data": {
        "label": "Blog Writer",
        "model": "gpt-4o-mini",
        "systemPrompt": "You are a professional blog writer.",
        "userPrompt": "Create a detailed outline for: {{inputs.topic}}"
      }
    }
  ],
  "edges": []
}
```

**Test in dev mode:**
- [ ] Enable feature flag in VS Code settings
- [ ] Restart VS Code (or reload window)
- [ ] Verify Flows panel appears in AI sidebar
- [ ] Load test flow
- [ ] Run flow with topic input
- [ ] Verify LLM response appears
- [ ] Check `.flows/` directory for saved flow

**Test in production:**
- [ ] Build extension and webview
- [ ] Build production app (invoke vscode-expert)
- [ ] Verify feature flag works in built app
- [ ] Test flow execution in production build

### Phase 1.8: Documentation
- [ ] Add feature flag documentation to `.claude/skills/feature-flags/SKILL.md`
- [ ] Create user-facing docs: `docs/features/flows.md` (basic intro)
- [ ] Document flow JSON format for manual editing
- [ ] Add troubleshooting section (common errors)

## Status
**Current Phase:** 1 (Research - COMPLETE)
**Next Phase:** 2 (Plan - AWAITING APPROVAL)
**Approval Required:** Yes - Cannot proceed to Phase 3 (Development) without Jarmo's approval

## Approval
- [ ] Jarmo approved this sprint plan

---

## Research Summary

### Key Findings

**1. React Flow UI is ideal for this use case:**
- MIT licensed, production-ready
- ~50KB bundle impact (acceptable)
- Built-in shadcn/ui integration (matches our planned migration)
- Workflow Editor template provides sequential execution pattern

**2. Existing infrastructure is reusable:**
- UnifiedViewProvider pattern works for FlowsViewProvider
- OpenAI service handles LLM nodes out of the box
- File system operations are straightforward (Node.js fs/promises)
- Message passing pattern is proven

**3. Feature flag is necessary:**
- New major feature (experimental status)
- Easy kill-switch if issues arise
- User opt-in for testing phase

**4. Image generation is deferred to Phase 2:**
- GPT Image 1.5 API is straightforward to add
- Not critical for MVP (LLM + file save covers main use cases)
- Can add after validating core architecture

### Architecture Decisions

**Storage:** `.flows/*.flow.json` in workspace root
- Version-controllable
- No external database
- Pattern matches VS Code conventions

**Execution:** Sequential, extension-side
- Simplest mental model
- No race conditions
- Can parallelize later if needed

**UI Location:** Flows panel in existing AI sidebar
- Avoids clutter in activity bar
- Logical grouping with AI features
- Can split to separate container in Phase 2 if needed

**Node Types (Phase 1):** Input + LLM only
- Validates architecture
- Covers text generation use cases
- Image + Save nodes in Phase 2

### Dependencies Impact

**Webview bundle size increase:**
- reactflow: 45KB
- @xyflow/react: 5KB
- zustand: 2KB
- **Total: ~52KB** (acceptable for major feature)

**No extension dependencies added** (reuse existing OpenAI SDK)

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| React Flow theme mismatch | Medium | Use VS Code CSS variables for theming |
| Bundle size bloat | Low | Only 52KB added, lazy-load editor in Phase 2 |
| Feature flag not working | High | Test in both dev and prod before release |
| Execution errors breaking UI | Medium | Comprehensive error handling + abort controller |
| User confusion (new UX) | Medium | Clear empty state, tooltips, walkthrough in Phase 2 |

### Out of Scope (Phase 1)

Deferred to later phases:
- Visual flow editor (drag-drop canvas)
- Image generation nodes
- Save file nodes
- Flow templates
- Undo/redo
- Flow export/import
- Keyboard shortcuts
- Auto-layout (ELKjs)

Phase 1 focuses on:
- ✅ Core infrastructure
- ✅ Feature flag gating
- ✅ Basic flow execution (Input → LLM)
- ✅ Flow storage (CRUD)
- ✅ Simple UI (list + run modal)

---

## Phase 2 Preview (Future Sprint)

**Goal:** Visual editor with drag-drop

**Deliverables:**
- FlowEditorModal with React Flow canvas
- Node palette (drag to add nodes)
- Node configuration panel
- Image generation nodes
- Save file nodes
- Flow validation

**Estimated effort:** 2-3 sprints after Phase 1 validation

---

## Notes

- Sprint is on `feature/ritemark-flows` branch
- Analysis docs already committed
- Following 6-phase workflow with HARD gates
- Invoke qa-validator before any commits
- Invoke vscode-expert for production builds
