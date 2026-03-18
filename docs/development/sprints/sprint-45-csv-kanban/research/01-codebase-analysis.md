# Sprint 45 Research: CSV Kanban View — Codebase Analysis

## Existing CSV Editor Architecture

### Component Hierarchy

```
App.tsx
  └── SpreadsheetViewer.tsx        (state manager + coordinator)
        ├── SpreadsheetToolbar.tsx  (top bar: filename, refresh, open-in-external)
        ├── ConflictDialog.tsx      (external file conflict handling)
        ├── Status bar (inline JSX)
        ├── Sheet selector (inline JSX, XLSX only)
        └── DataTable.tsx           (the actual table grid)
```

### SpreadsheetViewer.tsx

Location: `extensions/ritemark/webview/src/components/SpreadsheetViewer.tsx`

Key responsibilities:
- Owns `parsedData` state: `{ columns: string[], rows: Record<string, unknown>[] }`
- Handles CSV parsing via PapaParse, Excel via xlsx
- Owns all mutation handlers: `handleCellChange`, `handleAddRow`, `handleInsertRowAt`, `handleAddColumn`, `handleRenameColumn`, `handleDeleteColumn`, `handleDeleteRow`
- Serializes back to CSV via `Papa.unparse()` and calls `onChange(csvString)` to propagate to extension
- Manages conflict detection via `sendToExtension` / `onMessage`
- `isEditable = fileType === 'csv' && !!onChange`

No view mode state exists. Single DataTable view only.
Kanban toggle and `csvyConfig` state will be added at this level.

### SpreadsheetToolbar.tsx

Location: `extensions/ritemark/webview/src/components/header/SpreadsheetToolbar.tsx`

Currently: filename, refresh button, open-in-external split button.
View toggle (Table | Kanban) will be added as new props: `viewMode`, `onViewModeChange`, `hasKanban`.
Only visible when `fileType === 'csv'`.

### DataTable.tsx

Location: `extensions/ritemark/webview/src/components/DataTable.tsx`

- `@tanstack/react-table` v8 + `@tanstack/react-virtual` for virtualization
- Full keyboard navigation, inline cell editing, column/row management
- NOT modified by this sprint — remains the Table view unchanged

### CSV Parsing and Serialization

PapaParse with `header: true` — rows are `Record<string, unknown>[]`.

PapaParse does NOT handle CSVY frontmatter. A `---` YAML block at the top would be parsed as corrupt data rows. Required pre-processing in `SpreadsheetViewer.parseCSV`:
1. Detect `---\n` at start of content
2. Find closing `---\n`
3. Extract YAML string, parse for kanban config keys only (minimal inline parser, no new dependency)
4. Store as `csvyConfig` state
5. Pass clean CSV remainder to PapaParse

On save: re-prepend original frontmatter block verbatim before `Papa.unparse()` output.

### Extension Message Routing

CSV files are handled by `ritemarkEditor.ts`. Message switch starts at line 278.
`case 'contentChanged'`: `fileType === 'csv'` writes `message.content` directly — no front-matter handling. CSVY frontmatter is part of the file content, so the webview must include it when calling `onChange(csvString)`.

Precedent for opening files from webview: `FlowEditorProvider.ts` line 136-139 handles `flow:openFile` via `vscode.commands.executeCommand('vscode.open', uri)`. Need parallel `csv:openFile` case in `ritemarkEditor.ts`.

### Available Dependencies (webview/package.json)

Already installed:
- `@tanstack/react-table` + `@tanstack/react-virtual`
- `lucide-react`, `tailwindcss`, Radix UI
- `papaparse`, `zustand`

Needs adding:
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop (current React DnD standard, ~25KB gzip)
- No YAML parser needed — inline minimal parser for bounded CSVY config schema is sufficient

## CSVY Frontmatter Format

```csv
---
title: My Tasks
kanban:
  groupBy: status
  titleField: task
  subtitleField: assignee
  colorBy: priority
  columns: [backlog, todo, in-progress, review, done]
  fields: [priority, due_date, assignee]
  sort:
    field: priority
    order: asc
  link: [spec_file, flow_file]
---
id,task,status,priority,assignee,due_date,spec_file,flow_file
1,Build login page,todo,high,Alice,2026-04-01,tasks/login.md,tasks/login.flow.json
```

## Smart Column Detection (No Frontmatter)

Auto-detect from column names (case-insensitive):

| Config Key | Candidate names |
|------------|----------------|
| `groupBy` | `status`, `state`, `stage`, `phase`, `column` |
| `titleField` | `title`, `name`, `task`, `item`, `subject` |
| `subtitleField` | `assignee`, `owner`, `author`, `description` |
| `colorBy` | `priority`, `severity`, `type`, `label` |

If no candidates found, kanban toggle is still available but prompts to configure.

## Feature Flag Decision

Kanban view is a substantial new UI mode. Recommend `experimental` status:
- Default OFF, requires opt-in
- Kill-switch if issues arise
- Can be promoted to `stable` after testing

Flag ID: `csv-kanban-view`

## Key Integration Points for Implementation

| Area | File | Change |
|------|------|--------|
| CSVY parsing | `SpreadsheetViewer.tsx` | Pre-process frontmatter before PapaParse |
| View toggle | `SpreadsheetToolbar.tsx` | Add Table/Kanban segmented control |
| Kanban component | NEW `KanbanView.tsx` | Full kanban board with DnD |
| Config util | NEW `kanbanConfig.ts` | Frontmatter + smart defaults resolution |
| Link field opening | `ritemarkEditor.ts` | Add `csv:openFile` message case |
| Feature flag | `flags.ts` | Add `csv-kanban-view` flag |

## Risks

| Risk | Mitigation |
|------|------------|
| CSVY frontmatter breaks CSV round-trip | Frontmatter stripped before parse, re-prepended verbatim on save |
| Drag row index mismatch after filter/sort | Carry original `parsedData` row index on each card object |
| Large CSV performance in kanban | Virtualize card lists within each column |
| `@dnd-kit` adds bundle weight | ~25KB gzip — acceptable for the functionality |
