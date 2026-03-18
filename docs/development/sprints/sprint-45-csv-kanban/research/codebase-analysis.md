# Research: CSV Kanban View — Codebase Analysis

## Sprint 45 — Phase 1 Research

---

## 1. Existing CSV Editor Architecture

### Entry Point
`App.tsx` routes CSV/XLSX files to `SpreadsheetViewer` when `fileType === 'csv' || 'xlsx'`. The viewer receives:
- `content: string` — raw file content
- `filename: string`
- `fileType: 'csv' | 'xlsx'`
- `onChange?: (content: string) => void` — write-back for CSV (undefined for XLSX, making it read-only)

### SpreadsheetViewer (`webview/src/components/SpreadsheetViewer.tsx`)
The orchestrating component. Responsibilities:
- Parses CSV with PapaParse (`header: true`, `skipEmptyLines: true`)
- Maintains `parsedData: { columns: string[], rows: Record<string, unknown>[] }`
- Handles conflict detection, file-change badges, refresh, external app launch
- Serializes rows back to CSV on every cell edit (`Papa.unparse`)
- Currently renders: `SpreadsheetToolbar` + status bar + `DataTable`

### DataTable (`webview/src/components/DataTable.tsx`)
The table view. Key features:
- `@tanstack/react-table` for column definitions and sorting
- `@tanstack/react-virtual` for row virtualization (handles 10,000 rows)
- Inline cell editing with textarea overlay (Google Sheets style)
- Column rename/delete via menu
- Row insert/delete with confirmation
- Keyboard navigation (arrows, Tab, Enter, F2)

### SpreadsheetToolbar (`webview/src/components/header/SpreadsheetToolbar.tsx`)
Current toolbar has: filename display, refresh badge button, "Open in Excel/Numbers" split button.

### Communication Pattern
- Extension → Webview: `load`, `excelStatus`, `showConflictDialog`, `confirmDiscard`, `fileChanged`, `fileDeleted`
- Webview → Extension: `ready`, `contentChanged`, `refresh`, `confirmRefresh`, `cancelRefresh`, `checkExcel`, `openInExternalApp`
- CSV changes go through: cell edit → `handleCellChange` → `Papa.unparse` → `onChange(csvString)` → `sendToExtension('contentChanged', { content })`

---

## 2. Available Dependencies

Already in `webview/package.json` — no new installs needed for the core kanban:

| Package | Use in Kanban |
|---------|--------------|
| `papaparse` | Already parsing CSV; CSVY frontmatter = strip `---` block before parse |
| `@tanstack/react-table` | Already used; can reuse types |
| `lucide-react` | Icons (KanbanSquare, List, GripVertical, etc.) |
| `tailwindcss` | Styling kanban cards/columns |
| `zustand` | State management if needed for filter state |
| `@radix-ui/react-select` | Filter dropdowns |
| `@radix-ui/react-tooltip` | Card tooltips |

**No drag-and-drop library is currently included.** Options to evaluate:
- **Native HTML5 drag and drop** — zero-dependency, sufficient for kanban card-to-column DnD
- **`@dnd-kit/core`** — lightweight, accessible, pointer + keyboard support (~10KB). Recommended.
- `react-beautiful-dnd` — heavier, less maintained (skip)

`@dnd-kit/core` is **not** in the current `package.json`. It would need to be added.

---

## 3. CSVY Frontmatter Format

Based on the [csvy.org spec](http://csvy.org/), CSVY files embed YAML frontmatter between `---` delimiters at the top of the CSV file:

```
---
name: tasks
title: col_title
kanban:
  groupBy: status
  columns: [backlog, todo, in-progress, review, done]
  subtitle: assignee
  colorBy: priority
---
id,title,status,assignee,priority,spec
1,Add login page,todo,Alice,high,login-spec.md
```

### Parsing Strategy
PapaParse is called with the raw file content. CSVY requires:
1. Detect `---` at the start of content
2. Extract and parse YAML block
3. Strip the frontmatter block and pass remaining CSV to PapaParse
4. Return `{ csvContent, frontmatter }` from a `parseCsvy` utility

The YAML parsing can use a lightweight inline parser (the frontmatter here is simple key-value + arrays), or we can add `js-yaml` (4KB minified). `gray-matter` is already used in the extension host (`ritemarkEditor.ts`) but is not available in the webview bundle. We would add `js-yaml` to the webview.

---

## 4. Extension Host Impact

The extension host (`RitemarkEditorProvider`) handles `contentChanged` messages and writes to disk. The kanban view does NOT need extension host changes — it operates entirely in the webview layer. When a card is dragged to a new column:
1. The kanban view mutates `rows` in state (same `parsedData` structure)
2. Serializes to CSV with `Papa.unparse`
3. Calls `onChange(csvString)` — identical to the existing cell-edit path

CSVY frontmatter must be **preserved** during serialization. `Papa.unparse` only handles the data rows; the frontmatter block must be prepended manually:
```
csvString = frontmatterBlock + '\n' + Papa.unparse(rows, { columns })
```

---

## 5. View Toggle Integration Point

The toggle (Table ↔ Kanban) belongs in `SpreadsheetToolbar`. Current toolbar architecture:
- Left: filename
- Center: spacer
- Right: refresh button + external app split button

The toggle can be added as icon buttons between filename and the spacer, or as a segmented control. This is a webview-only addition — no patch or VS Code core changes.

---

## 6. Smart Column Detection

Common column name patterns to auto-detect `groupBy`:
- Status indicators: `status`, `state`, `stage`, `phase`, `kanban`, `column`
- Title candidates: `title`, `name`, `task`, `subject`, `description`, `summary`
- Subtitle/assignee: `assignee`, `owner`, `assigned_to`, `person`, `user`
- Color/priority: `priority`, `severity`, `importance`, `urgency`, `type`, `category`

Detection logic: case-insensitive match against known column names. If none match, fall back to first column as groupBy and second column as title.

---

## 7. Link Field Detection

Fields where the value ends in `.md` or `.flow.json` should be rendered as a clickable link icon. The click handler calls `sendToExtension('openFile', { path: fieldValue })`. The extension host can handle this with `vscode.workspace.openTextDocument` + `vscode.commands.executeCommand('vscode.open', ...)`.

This is a new message type that does not currently exist but follows the same pattern as existing messages. Extension host impact: add a `case 'openFile'` handler in `ritemarkEditor.ts`.

---

## 8. Filter State

Filtering (e.g., priority=high) is purely UI state. It should not affect serialized CSV output — filtering is a view-layer concern. The filter state should live in a `useState` hook in `KanbanView` and be applied on top of `parsedData.rows`.

---

## 9. Component Structure (Proposed)

```
SpreadsheetViewer (existing, orchestrates)
├── SpreadsheetToolbar (extend with view toggle)
├── DataTable (existing, unchanged for table mode)
└── KanbanView (new)
    ├── KanbanColumn (per groupBy value)
    │   └── KanbanCard (per row)
    ├── KanbanFilterBar (field value filters)
    └── useCsvyConfig (hook: detect/parse frontmatter config)
```

All new components go in `webview/src/components/kanban/`.

---

## 10. State Management in SpreadsheetViewer

SpreadsheetViewer currently has no view mode concept. We need to add:
- `viewMode: 'table' | 'kanban'` state (persisted via VS Code webview state so it survives tab switches)
- `csvyConfig: CsvyConfig | null` state (parsed from frontmatter on load)
- Pass `csvyConfig` to `KanbanView`
- Pass `viewMode` and `setViewMode` to `SpreadsheetToolbar`

The kanban view should only be offered when `fileType === 'csv'` and `isEditable` (since drag-and-drop writes to the file). For read-only CSV or XLSX, the toggle should not appear.

---

## 11. Risks and Unknowns

| Risk | Severity | Mitigation |
|------|----------|------------|
| `@dnd-kit` not in deps | Low | Add to webview package.json; small size impact |
| `js-yaml` not in webview | Low | Add to webview package.json |
| Frontmatter round-trip corruption | Medium | Write unit tests for `parseCsvy` and `serializeCsvy` |
| Large CSV performance in kanban | Medium | Apply column grouping to only the first 1,000 rows; virtualize cards within columns |
| Link opening (openFile message) | Low | Requires 1 new message handler in extension host |
| View state lost on webview refresh | Low | Persist view mode using `vscode.setState` |
