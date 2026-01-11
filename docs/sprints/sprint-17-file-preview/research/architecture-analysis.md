# Architecture Analysis - File Preview

## Current RiteMark Architecture

### Extension Structure
- **Entry:** `extension.ts` activates the extension
- **Provider:** `RiteMarkEditorProvider` implements `CustomTextEditorProvider`
- **Registration:** `vscode.window.registerCustomEditorProvider('ritemark.editor', ...)`
- **Webview:** React + Vite + TipTap editor loaded from `media/webview.js` (~900KB)

### File Type Registration (package.json)
```json
"customEditors": [{
  "viewType": "ritemark.editor",
  "displayName": "RiteMark",
  "selector": [
    {"filenamePattern": "*.md"},
    {"filenamePattern": "*.markdown"}
  ],
  "priority": "default"
}]
```

### Communication Bridge
- **Extension → Webview:** `webview.postMessage({type, ...})`
- **Webview → Extension:** `onDidReceiveMessage(message => {...})`
- **Message types:**
  - `ready` - webview loaded
  - `load` - send content to editor
  - `contentChanged` - editor updated
  - `saveImage` - paste image handler
  - `selectionChanged` - forward to AI panel
  - `wordCountChanged` - update status bar

## File Preview Requirements

### Target Formats
1. **CSV** (Comma-separated values)
   - Simple text format
   - Parser: PapaParse (~16KB, MIT)
   - Priority: HIGH (easy win)

2. **Excel** (.xlsx, .xls)
   - Binary format (requires parsing)
   - Parser: SheetJS/xlsx (~400KB, Apache 2.0)
   - Priority: HIGH (high user value)

### Proposed Solutions

#### Option A: Multi-Purpose Editor (RECOMMENDED)
**Approach:** Single viewType with conditional rendering

**Pros:**
- Reuse existing infrastructure (bridge, styles, status bar)
- Single webview bundle
- Easy to extend with more formats
- Shared utilities (error handling, loading states)

**Cons:**
- Slightly larger bundle size
- App.tsx needs file type detection

**Implementation:**
```typescript
// App.tsx
const fileExtension = getFileExtension(filename);

if (['.xlsx', '.xls'].includes(fileExtension)) {
  return <SpreadsheetViewer />;
} else if (fileExtension === '.csv') {
  return <CSVViewer />;
} else {
  return <Editor />; // TipTap markdown editor
}
```

**package.json:**
```json
"customEditors": [{
  "viewType": "ritemark.editor",
  "selector": [
    {"filenamePattern": "*.md"},
    {"filenamePattern": "*.markdown"},
    {"filenamePattern": "*.csv"},
    {"filenamePattern": "*.xlsx"},
    {"filenamePattern": "*.xls"}
  ]
}]
```

#### Option B: Separate Editor Provider
**Approach:** New `SpreadsheetEditorProvider` class

**Pros:**
- Clean separation of concerns
- Smaller initial bundle for markdown editing

**Cons:**
- Duplicate infrastructure (bridge, error handling)
- Two bundles to maintain or complex bundler config
- More registration boilerplate

#### Option C: Read-Only Preview
**Approach:** `CustomReadonlyEditorProvider` (VS Code pattern)

**Pros:**
- Simpler implementation (no save handling)
- Clear UX expectation (read-only badge)

**Cons:**
- Cannot add editing in future
- Less useful for CSV (users may want to edit)

### Recommendation: Option A

**Rationale:**
1. **Infrastructure reuse** - We already have message passing, error handling, styles
2. **Extensibility** - Easy to add JSON, YAML, etc. in future sprints
3. **Bundle efficiency** - Tree-shaking will remove unused code per file type
4. **UX consistency** - Same editor chrome for all file types

## Technical Decisions

### Parsers

**CSV: PapaParse**
- Size: ~16KB minified
- License: MIT
- Features: Streaming, worker support, type detection
- Battle-tested: 11k+ GitHub stars

**Excel: SheetJS (xlsx)**
- Size: ~400KB minified
- License: Apache 2.0
- Features: Read .xlsx, .xls, .xlsm, .ods
- Industry standard: 34k+ GitHub stars

### Display Component

**TanStack Table + TanStack Virtual**
- Headless table library (no styles, full control)
- Virtual scrolling for large datasets (10k+ rows)
- License: MIT
- Size: Table (~50KB) + Virtual (~10KB)

**Why not react-spreadsheet?**
- Good for small datasets
- No virtualization (performance issues >1000 rows)
- Excel files can be 100k+ rows

**Why not Univer?**
- Full Excel clone (charts, formulas, etc.)
- ~2MB+ bundle size
- Overkill for read-only preview

### Scope Definition

**Phase 1 (This Sprint):**
- [x] CSV read-only preview
- [x] Excel (.xlsx, .xls) read-only preview
- [x] Virtual scrolling (handle large files)
- [x] Basic table display with headers
- [x] Search/filter (nice-to-have)

**Phase 2 (Future):**
- [ ] Edit support (CSV only initially)
- [ ] Formula evaluation (Excel)
- [ ] Chart rendering (Excel)
- [ ] Export to other formats

## Implementation Strategy

### 1. Update package.json
Add CSV and Excel to selector

### 2. Install Dependencies
```bash
npm install --save xlsx papaparse @tanstack/react-table @tanstack/react-virtual
npm install --save-dev @types/papaparse
```

### 3. Webview Changes

**New Components:**
- `SpreadsheetViewer.tsx` - Excel viewer
- `CSVViewer.tsx` - CSV viewer (may reuse SpreadsheetViewer)
- `DataTable.tsx` - Shared table component with TanStack

**Modified Components:**
- `App.tsx` - Add file type routing
- `bridge.ts` - Add message types for spreadsheet data

### 4. Extension Changes

**Modified Files:**
- `RiteMarkEditorProvider.ts`:
  - Detect file type in `resolveCustomTextEditor`
  - For CSV/Excel: send raw file content
  - For Markdown: keep existing flow

**Message Flow:**
```
Extension loads file
  ↓
Detect .csv or .xlsx extension
  ↓
Send {type: 'load', fileType: 'csv', content: rawContent}
  ↓
Webview routes to SpreadsheetViewer
  ↓
Parse with PapaParse/SheetJS
  ↓
Render with TanStack Table
```

### 5. Bundle Size Impact

**Current:** ~900KB (webview.js)
**After changes:**
- PapaParse: +16KB
- SheetJS: +400KB
- TanStack Table: +50KB
- TanStack Virtual: +10KB
- Component code: +20KB

**Estimated total:** ~1.4MB

**Mitigation:**
- Vite tree-shaking will help
- Consider code-splitting in future (load parsers on demand)
- Still acceptable for desktop app

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large Excel files crash webview | HIGH | Virtual scrolling, row limit warning |
| Bundle size too large | MEDIUM | Tree-shaking, future code-splitting |
| Excel format incompatibility | MEDIUM | SheetJS handles most formats |
| User expects editing | LOW | Add in Phase 2 |

## References

**VS Code Extension Examples:**
- gc-excelviewer: Uses Wijmo FlexGrid (commercial)
- GrapeCity: Custom table implementation

**Libraries:**
- PapaParse: https://www.papaparse.com/
- SheetJS: https://sheetjs.com/
- TanStack Table: https://tanstack.com/table/latest
- TanStack Virtual: https://tanstack.com/virtual/latest
