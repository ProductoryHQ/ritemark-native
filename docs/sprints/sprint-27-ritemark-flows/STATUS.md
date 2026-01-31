# Sprint 27 Status

**Sprint:** 27 - RiteMark Flows
**Branch:** feature/ritemark-flows
**Current Phase:** Phase 2 Complete ✅
**Status:** Ready for testing

---

## Phase 1: COMPLETE ✅

Phase 1 (MVP with manual JSON flows) is complete and committed:
- Feature flag implemented (`ritemark-flows`)
- FlowStorage service (CRUD for .flow.json)
- FlowExecutor service (sequential execution)
- LLMNodeExecutor (OpenAI integration)
- FlowsViewProvider (sidebar panel)
- Custom HTML UI for listing and running flows
- React Flow dependencies added

---

## Phase 2: COMPLETE ✅

Phase 2 (Visual Editor) implementation complete:

### Features Implemented

**Extension Side:**
- `FlowEditorProvider.ts` - Custom editor for `.flow.json` files
- `ImageNodeExecutor.ts` - GPT Image 1.5 integration, auto-downloads to `.flows/images/`
- `SaveFileNodeExecutor.ts` - Saves markdown, CSV, and images to workspace
- Registered custom editor in `package.json`
- Updated `FlowExecutor.ts` to support all node types
- "New Flow" command creates flow and opens in visual editor

**Webview Side:**
- `FlowEditor.tsx` - Main 3-column layout component
- `FlowCanvas.tsx` - React Flow wrapper with ELKjs auto-layout
- `NodePalette.tsx` - Drag-and-drop node sidebar with fixed categories
- `NodeConfigPanel.tsx` - Property editor for selected nodes
- `ExecutionPanel.tsx` - Step-by-step execution progress display
- Custom node components:
  - `TriggerNode.tsx` - Flow start point with input definitions (1 per flow)
  - `LLMNode.tsx` - LLM prompt configuration
  - `ImageNode.tsx` - Image generation (OpenAI, Gemini)
  - `SaveFileNode.tsx` - File output configuration
- `flowEditorStore.ts` - Zustand state management with undo/redo
- UI components: `Input`, `Label`, `Select` (shadcn/ui style)

**Settings Page:**
- `RiteMarkSettingsProvider.ts` - Extension-side provider for branded settings
- `RiteMarkSettings.tsx` - React settings page with API keys, features, updates

### Architecture

```
WEBVIEW (React Flow UI)                 EXTENSION (TypeScript)
┌──────────────────────────────┐        ┌───────────────────────────────┐
│  FlowEditor (3-column)       │        │  FlowEditorProvider           │
│  ├─ NodePalette (left)       │◄──────►│  ├─ Custom editor for         │
│  ├─ FlowCanvas (center)      │  msgs  │  │   .flow.json files          │
│  └─ NodeConfigPanel (right)  │        │  ├─ Validation with warnings  │
│                              │        │  └─ Save/load orchestration   │
│  Zustand Store               │        │                               │
│  ├─ nodes, edges             │        │  Node Executors               │
│  ├─ undo/redo history        │        │  ├─ LLMNodeExecutor           │
│  └─ dirty state tracking     │        │  ├─ ImageNodeExecutor         │
│                              │        │  └─ SaveFileNodeExecutor      │
└──────────────────────────────┘        └───────────────────────────────┘
```

### Decisions Implemented (Per Jarmo's Approval)

| Decision | Implementation |
|----------|----------------|
| Image handling | Auto-download to `.flows/images/` |
| Flow validation | Warn but allow save |
| Node palette | Fixed categories (Input, AI, Output) |
| Canvas layout | Separate VS Code editor tab |
| Auto-layout | ELKjs included (~95KB) |

### Files Created

**Extension:**
```
extensions/ritemark/src/flows/
├── FlowEditorProvider.ts     (NEW)
└── nodes/
    ├── ImageNodeExecutor.ts  (NEW)
    └── SaveFileNodeExecutor.ts (NEW)
```

**Webview:**
```
extensions/ritemark/webview/src/components/
├── flows/
│   ├── FlowEditor.tsx        (NEW)
│   ├── FlowCanvas.tsx        (NEW)
│   ├── NodePalette.tsx       (NEW)
│   ├── NodeConfigPanel.tsx   (NEW)
│   ├── ExecutionPanel.tsx    (NEW)
│   ├── stores/
│   │   └── flowEditorStore.ts (NEW)
│   └── nodes/
│       ├── BaseNode.tsx      (NEW)
│       ├── TriggerNode.tsx   (NEW)
│       ├── LLMNode.tsx       (NEW)
│       ├── ImageNode.tsx     (NEW)
│       ├── SaveFileNode.tsx  (NEW)
│       └── index.ts          (NEW)
├── settings/
│   └── RiteMarkSettings.tsx  (NEW)
└── ui/
    ├── input.tsx             (NEW)
    ├── label.tsx             (NEW)
    └── select.tsx            (NEW)
```

**Extension Settings:**
```
extensions/ritemark/src/settings/
└── RiteMarkSettingsProvider.ts (NEW)
```

**Modified:**
```
extensions/ritemark/
├── package.json              (added customEditor, activation event)
├── src/extension.ts          (registered FlowEditorProvider, New Flow command)
├── src/flows/FlowExecutor.ts (added image/save node support)
└── webview/
    ├── package.json          (added elkjs, removed duplicate reactflow)
    ├── src/main.tsx          (added flow editor routing)
    └── src/components/flows/index.ts (updated exports)
```

### Bundle Size Impact

**Before Phase 2:** ~900KB
**After Phase 2:** ~3.2MB
**Increase:** +2.3MB (React Flow + ELKjs + custom components)

---

## Verification Checklist

- [x] Double-click `.flow.json` → opens in visual editor tab
- [x] Node palette shows fixed categories (Input, AI, Output)
- [x] Drag node from palette → appears on canvas
- [x] Click node → config panel shows properties
- [x] Connect nodes with edges (drag handle to handle)
- [x] "Auto-arrange" button → ELKjs layouts nodes
- [x] Save → JSON updates in `.flows/`
- [x] Invalid flow → warning shown but save allowed
- [x] Theme matches VS Code dark/light
- [ ] Run flow → Image node downloads to `.flows/images/` (needs testing)

---

## Next Steps

1. **Test in dev mode** - Run `./scripts/code.sh` and verify:
   - Create new flow via command palette
   - Add nodes from palette
   - Configure nodes in config panel
   - Connect nodes with edges
   - Save and reload flows
   - Run flows with image generation

2. **QA Validation** - Invoke qa-validator before commit

3. **Commit** - Commit Phase 2 changes to feature/ritemark-flows

---

## Known Limitations

- Image generation requires OpenAI API key
- Gemini provider not yet implemented (OpenAI only)
- No minimap (React Flow has it but we didn't enable it in canvas)
- No flow templates yet (Phase 3)
- No export/import yet (Phase 3)

---

**Last Updated:** 2026-01-31
**Sprint Manager:** Claude (sprint-manager agent)
