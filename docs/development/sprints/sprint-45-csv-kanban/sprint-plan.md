# Sprint 45: CSV Kanban View

## Goal

Add a kanban view mode to the existing CSV editor. CSV rows become draggable cards grouped by a status column. Configuration via CSVY frontmatter (YAML between `---` delimiters). Smart defaults so it works without any config.

## Vision Context (NOT in scope, but informs architecture)

This is Phase 1 of a composable task management stack built on existing Ritemark primitives:

| Primitive | Role | Sprint |
|-----------|------|--------|
| **CSV** | Task register — kanban view of rows | **This sprint** |
| **MD + frontmatter** | Task spec — detailed description, acceptance criteria | Future |
| **Flow** | Task procedure — executable steps to complete/verify | Future |
| **Catalog view** | Aggregator — ties registers to specs and procedures | Future |

Architecture decisions in this sprint must NOT block future MD/Flow integration. Link fields (`.md`, `.flow.json`) should already be clickable.

## Feature Flag Check

- [ ] Does this sprint need a feature flag? NO.
  Kanban is a view mode toggle within the existing CSV editor. No new file type, no breaking change.

## Success Criteria

- [ ] CSV editor has a Table ↔ Kanban view toggle
- [ ] Kanban groups rows by a configurable column (default: auto-detect `status`)
- [ ] Cards show title, subtitle, color badge, and configurable fields
- [ ] Drag-and-drop moves cards between columns, immediately writes CSV
- [ ] CSVY frontmatter (`---` YAML block) configures field mapping, column order, colors
- [ ] Smart defaults work without any frontmatter for CSVs with common column names
- [ ] Filter bar allows filtering cards by field values
- [ ] Link fields (`.md`, `.flow.json`) are clickable and open in Ritemark
- [ ] Frontmatter is preserved through edit round-trips (no data loss)
- [ ] Kanban view mode persists across tab switches (webview state)
- [ ] Only shown for editable CSV files (not XLSX, not read-only)

## Technical Foundation (from codebase analysis)

### Current Architecture

```
SpreadsheetViewer (orchestrator)
├── SpreadsheetToolbar (filename, refresh, external app)
├── DataTable (@tanstack/react-table + react-virtual)
└── Communication: contentChanged → extension host → disk
```

### Key Facts

- CSV parsing: PapaParse (`header: true`, `skipEmptyLines: true`)
- Serialization: `Papa.unparse(rows, { columns })` on every cell edit
- Extension host writes to disk on `contentChanged` — no changes needed there
- Webview state available via `vscode.setState/getState`
- All work is webview-only except one new message type (`openFile`)

### New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop (accessible, keyboard support) | ~12KB |
| `js-yaml` | Parse CSVY frontmatter YAML | ~4KB |

### Target Component Structure

```
SpreadsheetViewer (extend with viewMode state)
├── SpreadsheetToolbar (extend with Table/Kanban toggle)
├── DataTable (existing, unchanged)
└── KanbanView (NEW)
    ├── KanbanFilterBar (field value dropdowns)
    ├── KanbanColumn (per groupBy value)
    │   └── KanbanCard (per row, draggable)
    └── hooks/
        ├── useCsvyConfig.ts (parse/detect frontmatter config)
        └── useKanbanData.ts (group, sort, filter rows)
```

All new files in `webview/src/components/kanban/`.

## CSVY Frontmatter Spec

```yaml
---
view: kanban
groupBy: status
title: title
subtitle: assignee
fields: [priority, due]
colorBy: priority
link: spec
sort: priority desc
columns:
  - value: backlog
    label: Backlog
    color: "#94a3b8"
  - value: todo
    label: To Do
    color: "#e2e8f0"
  - value: in-progress
    label: In Progress
    color: "#fbbf24"
  - value: review
    label: Review
    color: "#60a5fa"
  - value: done
    label: Done
    color: "#34d399"
---
id,title,status,assignee,priority,due,spec
1,Add dark mode,in-progress,claude,high,2026-03-20,specs/dark-mode.md
```

### Smart Defaults (when no frontmatter)

| Field | Auto-detect logic |
|-------|------------------|
| `groupBy` | Column named `status`, `state`, `stage`, `phase` (case-insensitive) |
| `title` | First text column that isn't groupBy |
| `subtitle` | Column named `assignee`, `owner`, `assigned_to` |
| `colorBy` | Column named `priority`, `severity`, `type`, `category` |
| `link` | Any cell value ending in `.md` or `.flow.json` |
| `columns` order | Known patterns first (`backlog→todo→in-progress→review→done`), then order of first appearance |

### Frontmatter Round-Trip

- On load: split frontmatter from CSV, parse both separately
- On save: prepend original frontmatter block + `\n` + `Papa.unparse(rows)`
- Frontmatter is **never modified** by card edits (only the CSV data rows change)

## Deliverables

| # | Deliverable | Description |
|---|-------------|-------------|
| 1 | CSVY parser | `parseCsvy()` / `serializeCsvy()` utilities with frontmatter extraction |
| 2 | Smart defaults | `detectKanbanConfig()` — auto-detect field mapping from column names |
| 3 | View toggle | Table ↔ Kanban toggle in SpreadsheetToolbar |
| 4 | KanbanView | Card-based column layout grouped by status field |
| 5 | KanbanCard | Compact card with title, subtitle, color badge, expandable fields |
| 6 | Drag-and-drop | `@dnd-kit` integration — drag card → update CSV cell → write to disk |
| 7 | Filter bar | Dropdown filters by column values |
| 8 | Link fields | Clickable `.md`/`.flow.json` links + `openFile` message handler |
| 9 | State persistence | View mode survives tab switches via webview state |

## Implementation Phases

### Phase 1: Planning & UX Lock
- [ ] Sprint plan reviewed and approved by Jarmo
- [ ] Card layout and kanban UX signed off
- [ ] CSVY frontmatter format finalized

### Phase 2: Foundation (approval gate — Jarmo must approve before code)
- [ ] Add `@dnd-kit/core`, `@dnd-kit/sortable`, `js-yaml` to webview deps
- [ ] Implement `parseCsvy()` and `serializeCsvy()` utilities
- [ ] Implement `detectKanbanConfig()` smart defaults
- [ ] Add `viewMode` state to SpreadsheetViewer
- [ ] Add Table/Kanban toggle to SpreadsheetToolbar

### Phase 3: Kanban UI
- [ ] KanbanView component with column layout
- [ ] KanbanCard component (compact + expanded states)
- [ ] Color coding by priority/colorBy field
- [ ] Column ordering (explicit config → pattern matching → first appearance)

### Phase 4: Interactions
- [ ] Drag-and-drop with @dnd-kit (card → column = update cell)
- [ ] CSV write-back on drag (same path as existing cell edit)
- [ ] Filter bar with dropdown per filterable column
- [ ] Link field detection and click handler
- [ ] `openFile` message handler in extension host

### Phase 5: Polish & Validation
- [ ] Persist view mode in webview state
- [ ] Empty column handling (show placeholder)
- [ ] Error states (no groupBy column detected, no data)
- [ ] Frontmatter round-trip unit tests
- [ ] Dev smoke test: kanban view toggle
- [ ] Dev smoke test: drag and drop writes CSV
- [ ] Dev smoke test: filter cards
- [ ] Dev smoke test: click link opens file

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Frontmatter corruption on round-trip | Medium | Unit tests for parse/serialize; frontmatter stored as raw string, never re-serialized |
| Large CSV (1000+ rows) kanban perf | Medium | Virtualize cards within columns; limit to first 500 rows with "show more" |
| `@dnd-kit` bundle size impact | Low | Tree-shakeable; core + sortable ≈ 12KB gzipped |
| Column order ambiguity | Low | Explicit `columns` config overrides all; smart defaults as fallback |
| XLSX files | None | Toggle hidden for XLSX (read-only, no kanban) |
