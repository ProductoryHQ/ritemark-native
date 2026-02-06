# Existing Patterns Analysis

## Custom Editor Architecture

Ritemark Native uses the VS Code Custom Editor API to provide specialized viewers/editors for different file types. There are two patterns in use:

### Pattern 1: CustomReadonlyEditorProvider (Read-only)
**Example:** ExcelEditorProvider (`src/excelEditorProvider.ts`)

**Key characteristics:**
- Implements `vscode.CustomReadonlyEditorProvider<ExcelDocument>`
- Opens binary files asynchronously with `openCustomDocument()`
- Sends Base64-encoded content to webview ONCE
- Webview handles parsing and caching client-side
- No edit tracking or save operations
- File watching for external changes with refresh capability

**Registration in package.json:**
```json
{
  "viewType": "ritemark.excelViewer",
  "displayName": "Excel Preview",
  "selector": [
    {"filenamePattern": "*.xlsx"},
    {"filenamePattern": "*.xls"}
  ],
  "priority": "exclusive"
}
```

**Flow:**
1. Extension reads binary file → Buffer
2. Convert to Base64
3. Send to webview via `postMessage({ type: 'load', content: base64, encoding: 'base64' })`
4. Webview parses using library (xlsx.js)
5. Renders in React component

### Pattern 2: CustomTextEditorProvider (Editable)
**Example:** RitemarkEditorProvider (`src/ritemarkEditor.ts`)

**Key characteristics:**
- Implements `vscode.CustomTextEditorProvider`
- Works with `vscode.TextDocument` for text files (markdown, CSV)
- Supports editing with `document.getText()` and edit tracking
- Handles both binary (Excel) and text (CSV, Markdown) files
- Front-matter parsing for markdown
- Image path transformation for webview URIs

**Registration in package.json:**
```json
{
  "viewType": "ritemark.editor",
  "displayName": "Ritemark",
  "selector": [
    {"filenamePattern": "*.md"},
    {"filenamePattern": "*.markdown"},
    {"filenamePattern": "*.csv"}
  ],
  "priority": "exclusive"
}
```

## Webview Architecture

**Single Bundle Pattern:**
- All custom editors share one webview bundle: `media/webview.js` (~900KB)
- Built with Vite from `webview/` directory
- React app with routing based on `fileType` prop

**Routing in App.tsx:**
```typescript
type FileType = 'markdown' | 'csv' | 'xlsx'

// Route to SpreadsheetViewer for CSV/Excel files
if (fileType === 'csv' || fileType === 'xlsx') {
  return <SpreadsheetViewer ... />
}

// Default: Markdown editor
return <Editor ... />
```

**Message Protocol:**
- Extension → Webview: `webview.postMessage({ type, ...data })`
- Webview → Extension: `sendToExtension(type, data)` (bridge.ts)
- Standard messages:
  - `ready` - webview mounted, ready for content
  - `load` - send file content
  - `contentChanged` - user edited content
  - `refresh` - reload from disk
  - `fileChanged` - external file change notification

## Existing CSV/Excel Implementation

### Current CSV Editing Capabilities
**Location:** `webview/src/components/DataTable.tsx`

**Features:**
- Click cell to edit (single-line input)
- Enter to save, Escape to cancel
- Virtual scrolling for large datasets (10,000 row limit)
- Row expansion on click (shows multi-line content)
- Read-only mode for Excel files

**Limitations (identified for sprint):**
- No sort functionality
- No add/delete row or column operations
- Cell editing is single-line input (no textarea for multi-line)
- Row expansion is click-to-toggle, not inline editing

### CSV Data Flow
1. Extension sends CSV string to webview
2. `SpreadsheetViewer.tsx` parses with PapaParse
3. Stores parsed data in React state
4. `DataTable.tsx` renders with TanStack Table + Virtual
5. On cell edit: Update state → serialize to CSV → send to extension

### Excel (XLSX) Data Flow
1. Extension reads binary file → Base64
2. Sends to webview with `encoding: 'base64'`
3. `SpreadsheetViewer.tsx` parses with xlsx.js
4. Caches workbook client-side for multi-sheet support
5. Sheet selector for workbooks with multiple sheets
6. Read-only (no editing)

## Extension Registration

All custom editors registered in `src/extension.ts`:

```typescript
// Markdown/CSV custom editor (editable)
context.subscriptions.push(
  RitemarkEditorProvider.register(context, unifiedViewProvider)
);

// Excel viewer (read-only)
context.subscriptions.push(
  ExcelEditorProvider.register(context)
);
```

And declared in `package.json` under `contributes.customEditors`.

## Key Files for Reference

| File | Purpose |
|------|---------|
| `src/excelEditorProvider.ts` | Read-only binary file pattern |
| `src/ritemarkEditor.ts` | Editable text file pattern |
| `webview/src/App.tsx` | Routing logic based on fileType |
| `webview/src/components/SpreadsheetViewer.tsx` | CSV/Excel viewer component |
| `webview/src/components/DataTable.tsx` | Table rendering with editing |
| `package.json` | Custom editor declarations |

## Implications for Sprint 32

### PDF Preview
- **Pattern:** CustomReadonlyEditorProvider (like ExcelEditorProvider)
- **Binary file** → Base64 encoding
- **New provider:** `PdfEditorProvider` (read-only)
- **Webview:** New component or route in App.tsx

### DOCX Preview
- **Pattern:** CustomReadonlyEditorProvider (like ExcelEditorProvider)
- **Binary file** → Base64 or text encoding (depends on library)
- **New provider:** `DocxEditorProvider` (read-only)
- **Webview:** New component or route in App.tsx

### CSV Editing Improvements
- **Pattern:** Enhance existing RitemarkEditorProvider flow
- **No new provider needed** - already handles CSV
- **Changes in:** DataTable.tsx and SpreadsheetViewer.tsx
- **Operations:** Sort, add/delete rows/columns, multi-line cell editing
