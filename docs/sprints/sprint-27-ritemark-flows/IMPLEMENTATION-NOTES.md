# Ritemark Flows - Implementation Notes

## Current State (Phase 2 Complete)

Visual flow editor with drag-drop canvas, node configuration, and execution.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VS Code Extension                            │
│  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │
│  │ FlowEditorProvider  │◄──►│ FlowExecutor                        │ │
│  │ (Custom Editor)     │    │ ├─ LLMNodeExecutor (OpenAI)         │ │
│  │                     │    │ ├─ ImageNodeExecutor (GPT Image)    │ │
│  │ Handles:            │    │ └─ SaveFileNodeExecutor             │ │
│  │ - .flow.json files  │    └─────────────────────────────────────┘ │
│  │ - Webview messaging │                                            │
│  │ - Flow validation   │    ┌─────────────────────────────────────┐ │
│  │ - Execution         │    │ FlowsViewProvider (Sidebar)         │ │
│  └─────────────────────┘    │ - Lists flows                       │ │
│           ▲                 │ - Run/Edit/Delete buttons           │ │
│           │ postMessage     └─────────────────────────────────────┘ │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Webview (React)                              ││
│  │  ┌────────────┐  ┌────────────────┐  ┌───────────────────────┐ ││
│  │  │NodePalette │  │  FlowCanvas    │  │ NodeConfigPanel /     │ ││
│  │  │            │  │  (React Flow)  │  │ ExecutionPanel        │ ││
│  │  │ - Start    │  │                │  │                       │ ││
│  │  │ - AI       │  │  Nodes:        │  │ Shows:                │ ││
│  │  │ - Output   │  │  - Trigger     │  │ - Node properties     │ ││
│  │  │            │  │  - LLM         │  │ - Execution progress  │ ││
│  │  │            │  │  - Image       │  │ - Results             │ ││
│  │  │            │  │  - SaveFile    │  │                       │ ││
│  │  └────────────┘  └────────────────┘  └───────────────────────┘ ││
│  │                           │                                     ││
│  │                  ┌────────▼────────┐                            ││
│  │                  │ flowEditorStore │                            ││
│  │                  │ (Zustand)       │                            ││
│  │                  └─────────────────┘                            ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

### Extension (TypeScript)
```
extensions/ritemark/src/flows/
├── types.ts                    # Flow, FlowNode, FlowInput interfaces
├── FlowStorage.ts              # CRUD for .ritemark/flows/*.flow.json
├── FlowExecutor.ts             # Topological sort + sequential execution
├── FlowEditorProvider.ts       # Custom editor for visual canvas
├── FlowsViewProvider.ts        # Sidebar panel (own Activity Bar tab)
└── nodes/
    ├── LLMNodeExecutor.ts      # OpenAI chat completion
    ├── ImageNodeExecutor.ts    # GPT Image 1.5 (auto-download)
    └── SaveFileNodeExecutor.ts # Write to workspace
```

### Webview (React)
```
webview/src/components/flows/
├── FlowEditor.tsx              # Main 3-column layout
├── FlowCanvas.tsx              # React Flow + ELKjs auto-layout
├── NodePalette.tsx             # Draggable node templates
├── NodeConfigPanel.tsx         # Property editors per node type
├── ExecutionPanel.tsx          # Run inputs + progress + results
├── nodes/
│   ├── TriggerNode.tsx         # Blue - flow inputs (1 per flow)
│   ├── LLMNode.tsx             # Purple - text generation
│   ├── ImageNode.tsx           # Green - image generation
│   ├── SaveFileNode.tsx        # Orange - file output
│   ├── BaseNode.tsx            # Shared styling
│   └── index.ts                # nodeTypes export
└── stores/
    └── flowEditorStore.ts      # Zustand state management
```

---

## Node Types

| Type | Color | Purpose | Has Target | Has Source |
|------|-------|---------|------------|------------|
| Trigger | Blue | Flow start, defines inputs | No | Yes |
| LLM Prompt | Purple | OpenAI text generation | Yes | Yes |
| Image Generation | Green | GPT Image 1.5 / Gemini | Yes | Yes |
| Save File | Orange | Write output to workspace | Yes | No |

---

## Data Flow

### 1. Flow JSON Structure

**Storage:** `.ritemark/flows/<sanitized-name>-<shortId>.flow.json`
**Example:** `.ritemark/flows/blog-post-outline-x4k9.flow.json`

```json
{
  "id": "blog-post-outline-x4k9",
  "name": "Blog Post Outline",
  "description": "Generate outline from topic",
  "version": 1,
  "created": "2026-01-31T...",
  "modified": "2026-01-31T...",
  "inputs": [
    { "id": "input-1", "type": "text", "label": "Topic", "required": true }
  ],
  "nodes": [
    { "id": "node-1", "type": "trigger", "position": {...}, "data": {...} },
    { "id": "node-2", "type": "llm-prompt", "position": {...}, "data": {...} }
  ],
  "edges": [
    { "id": "edge-1", "source": "node-1", "target": "node-2" }
  ]
}
```

### 2. Webview ↔ Extension Messages

| Message | Direction | Purpose |
|---------|-----------|---------|
| `ready` | Webview → Extension | Request flow data |
| `flow:load` | Extension → Webview | Send flow + warnings |
| `flow:save` | Webview → Extension | Autosave (500ms debounce) |
| `flow:saved` | Extension → Webview | Confirm save |
| `flow:run` | Webview → Extension | Start execution |
| `flow:stepStart` | Extension → Webview | Node starting |
| `flow:stepComplete` | Extension → Webview | Node finished + output |
| `flow:stepError` | Extension → Webview | Node failed |
| `flow:complete` | Extension → Webview | Flow finished |
| `flow:error` | Extension → Webview | Fatal error |

### 3. Execution Flow
1. User clicks "Run Flow" → ExecutionPanel shows
2. User fills inputs → clicks "Run Flow" button
3. Webview sends `flow:run` with inputs
4. Extension does topological sort for execution order
5. For each node:
   - Send `flow:stepStart`
   - Execute node (LLM call, image gen, file save)
   - Send `flow:stepComplete` with output OR `flow:stepError`
6. Send `flow:complete` when all done

---

## Key Behaviors

### Trigger Node
- **One per flow** - Adding second is silently ignored
- **Cannot be deleted** - Delete button hidden
- **Contains all flow inputs** - Add/remove within Trigger settings
- **Blue header** with lightning icon

### Autosave
- Debounced 500ms after any change
- No reload loop (webview is source of truth)
- VS Code tab shows dirty dot indicator

### Right Panel
- **Hidden** when no node selected AND not running
- **NodeConfigPanel** when node selected
- **ExecutionPanel** when running flow

### Validation (Warnings, not blocking)
- Flow has no name
- Unconnected nodes (shows node names)
- LLM node missing prompt
- Cycles detected

### Execution Errors
- Shown in ExecutionPanel with red X on failed node
- Expand to see error details
- "Run Again" button to retry

---

## Dependencies

### Extension
- OpenAI SDK (existing)

### Webview
- `@xyflow/react` - React Flow canvas
- `elkjs` - Auto-layout algorithm
- `zustand` - State management
- `@radix-ui/*` - UI primitives
- `lucide-react` - Icons

---

## Key Implementation Details

### File Naming
- **Format:** `<sanitized-name>-<shortId>.flow.json`
- **Example:** `my-blog-post-x4k9.flow.json`
- **Sanitization:** lowercase, alphanumeric + hyphens, max 30 chars
- **Short ID:** 4 random alphanumeric chars for uniqueness
- **Rename on save:** If flow name changes, file is renamed using `WorkspaceEdit.renameFile()` (flicker-free)

### Sidebar Integration
- **Own Activity Bar tab:** Flows has dedicated icon (`media/flows-icon.svg`)
- **Lucide workflow icon:** Matches design language
- **Header actions:** New Flow (+), Refresh (↻), Settings (⚙)
- **Delete confirmation:** Uses VS Code native dialog (not browser `confirm()`)

### Save File Node
- **Field order:** Label → Source → Format → Folder → Filename (input-first UX)
- **Folder picker:** VS Code folder dialog, returns relative path
- **Variable picker:** `/` button shows `{{inputs.*}}`, `{{timestamp}}`, `{{date}}`

---

## Known Limitations

1. **No variable interpolation preview** in prompts (shows raw `{Topic}` instead of value)
2. **Image providers** only OpenAI implemented (Gemini needs Google AI API key)
3. **No flow templates** yet
4. **No export/import** of flows

---

## Next Steps (Phase 3+)

- [ ] Variable interpolation preview in prompts
- [ ] More image providers (Gemini)
- [ ] Starter templates
- [ ] Flow export/import
- [ ] Conditional branching nodes
- [ ] Loop nodes
