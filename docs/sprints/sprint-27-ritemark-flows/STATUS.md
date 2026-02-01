# Sprint 27 Status

**Sprint:** 27 - RiteMark Flows
**Branch:** feature/ritemark-flows
**Current Phase:** Phase 2.5 Complete ✅
**Status:** Ready for QA validation and commit

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

## Phase 2.5: UI Refactoring ✅ COMPLETE

### Decisions (Jarmo Approved - 2026-02-01)

| Decision | Rationale |
|----------|-----------|
| **Flows gets own Activity Bar tab** | Flows is a major feature, deserves same visibility as Ritemark AI |
| **Hover reveal UX pattern** | Cleaner default state, matches VS Code native patterns |
| **Run button always visible** | Primary action users need quick access to |
| **Edit/Delete on hover only** | Secondary actions, reduces visual clutter |
| **Click item to open flow** | Natural interaction, matches VS Code Explorer |

### UX Pattern: Hover Reveal (Lucide Icons)

```
NORMAL STATE:                      HOVER STATE:
┌─────────────────────────┐        ┌─────────────────────────┐
│ Generate Blog Post      │        │ Generate Blog Post [✏][🗑]│
│ Creates SEO-optimized...│   →    │ Creates SEO-optimized...│
│ [▶ Run]                 │        │ [▶ Run]                 │
│ Modified: Jan 31        │        │ Modified: Jan 31        │
└─────────────────────────┘        └─────────────────────────┘
```

### Implementation Tasks

- [x] Register Flows as separate viewContainer in Activity Bar
- [x] Create Flows icon for Activity Bar (`flows-icon.svg`)
- [x] Refactor FlowsPanel with hover reveal pattern
- [x] Click anywhere to open flow
- [x] Use Lucide icons (Pencil, Trash2, Play, Plus)
- [x] Switch FlowsViewProvider to use React webview bundle

---

## Phase 2.5 Additional Features (2026-02-01)

### Storage & Naming
- **Storage location moved:** `.flows/` → `.ritemark/flows/` (cleaner workspace)
- **Readable filenames:** `my-blog-post-x4k9.flow.json` (sanitized name + short ID)
- **Auto-rename on save:** Renaming flow updates filename (flicker-free using WorkspaceEdit.renameFile)

### Sidebar UX
- **Delete button fixed:** Uses VS Code native confirmation dialog (browser `confirm()` doesn't work in webviews)
- **Auto-refresh:** Sidebar list updates after save/rename

### Save File Node UX
- **Reordered fields:** Input first (Source), output last (Folder, Filename)
- **Folder picker:** Button opens VS Code folder dialog
- **Variable picker:** `/` button shows available variables for filename

### Header Actions
- **Settings gear:** Opens RiteMark Settings page (same as AI panel)

---

## Code Cleanup ✅

Removed all debug `console.log` statements from:
- `FlowExecutor.ts` (6 logs removed)
- `LLMNodeExecutor.ts` (9 logs removed - including sensitive prompt/response logs)
- `ImageNodeExecutor.ts` (8 logs removed)
- `SaveFileNodeExecutor.ts` (2 logs removed)
- `FlowStorage.ts` (3 logs removed)
- `FlowsViewProvider.ts` (1 log removed)

Kept only `console.error` for actual error handling.

---

## Next Steps

1. ~~Complete Phase 2.5 UI refactoring~~ ✅
2. ~~Code cleanup~~ ✅
3. QA validation and commit
4. Test image generation flow end-to-end

---

## Known Limitations

- Image generation requires OpenAI API key
- Gemini provider not yet implemented (OpenAI only)
- No minimap (React Flow has it but we didn't enable it in canvas)
- No flow templates yet (Phase 3)
- No export/import yet (Phase 3)

---

**Last Updated:** 2026-02-01
**Sprint Manager:** Claude (sprint-manager agent)
