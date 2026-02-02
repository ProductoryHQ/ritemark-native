# Sprint 17: CSV File Preview

## Goal
Add read-only CSV preview to Ritemark Native using the existing editor infrastructure.

**Note:** Excel support deferred to Sprint 19 due to `CustomTextEditorProvider` limitations with binary files. See `docs/sprints/sprint-19-excel-preview/lessons-learned.md`.

## Success Criteria
- [x] CSV files open in Ritemark with tabular preview
- [ ] ~~Excel files (.xlsx, .xls) open with tabular preview~~ → Deferred to Sprint 19
- [x] Large files (10k+ rows) render without performance issues
- [x] File type selector in package.json includes CSV
- [x] Webview bundle remains under 2MB (actual: 1.41MB)
- [ ] Production build works on darwin-arm64

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `SpreadsheetViewer.tsx` | React component for displaying tabular data |
| `DataTable.tsx` | Shared TanStack Table component with virtualization |
| Updated `package.json` | Add CSV/Excel to customEditors selector |
| Updated `App.tsx` | File type routing logic |
| Updated `RitemarkEditorProvider.ts` | Detect file type and send appropriate content |
| Dependency updates | Install xlsx, papaparse, @tanstack/react-table, @tanstack/react-virtual |

## Implementation Checklist

### Phase 1: Setup and Dependencies
- [ ] Install npm packages (xlsx, papaparse, @tanstack/react-table, @tanstack/react-virtual)
- [ ] Update package.json customEditors selector to include *.csv, *.xlsx, *.xls
- [ ] Verify extension compiles after dependency changes

### Phase 2: Extension-Side Changes
- [ ] Modify `RitemarkEditorProvider.ts` to detect file extension
- [ ] Add file type to 'load' message payload
- [ ] Send raw file content for CSV/Excel (not parsed)
- [ ] Test with sample CSV and Excel files

### Phase 3: Webview Components
- [ ] Create `DataTable.tsx` with TanStack Table + Virtual
- [ ] Create `SpreadsheetViewer.tsx` with SheetJS integration
- [ ] Add CSV parsing with PapaParse
- [ ] Implement file type routing in `App.tsx`
- [ ] Add loading and error states

### Phase 4: Polish
- [ ] Add search/filter UI (if time permits)
- [ ] Style table to match VS Code theme
- [ ] Add row/column count in status bar
- [ ] Handle edge cases (empty files, malformed data)

### Phase 5: Testing
- [ ] Test with small CSV (< 100 rows)
- [ ] Test with large CSV (10k+ rows)
- [ ] Test with Excel workbooks (multiple sheets)
- [ ] Test with corrupted files
- [ ] Verify markdown editing still works
- [ ] Check bundle size (should be < 2MB)

### Phase 6: Build Verification
- [ ] Rebuild webview bundle
- [ ] Compile extension
- [ ] Build production app (darwin-arm64)
- [ ] Manual test in production build
- [ ] Invoke qa-validator

## Technical Approach

**Architecture:** Option A (Multi-Purpose Editor)
- Reuse existing `ritemark.editor` viewType
- Route to different components based on file extension
- Share infrastructure (bridge, styles, error handling)

**Dependencies:**
- **xlsx** (~400KB) - Excel parser
- **papaparse** (~16KB) - CSV parser
- **@tanstack/react-table** (~50KB) - Headless table
- **@tanstack/react-virtual** (~10KB) - Virtual scrolling

**Excel Binary Handling:**
- `CustomTextEditorProvider` receives TextDocument (text-based)
- Excel files are binary (ZIP format) - TextDocument corrupts them
- **Solution:** Bypass TextDocument, read file directly with `fs.readFileSync()`, Base64 encode
- SheetJS natively supports Base64 input: `XLSX.read(base64, { type: 'base64' })`

---

## Message Contract

Extension sends `load` message to webview. Payload varies by file type:

### Markdown (backwards compatible)
```typescript
{
  type: 'load',
  fileType: 'markdown',
  filename: 'readme.md',
  content: string,              // UTF-8 text
  properties?: object,          // YAML front-matter
  hasProperties?: boolean,
  imageMappings?: Record<string, string>
}
```

### CSV
```typescript
{
  type: 'load',
  fileType: 'csv',
  filename: 'data.csv',
  content: string,              // UTF-8 text (raw CSV)
  sizeBytes: number             // For large file warnings
}
```

### Excel
```typescript
{
  type: 'load',
  fileType: 'xlsx',
  filename: 'report.xlsx',
  content: string,              // Base64 encoded binary
  encoding: 'base64',
  sizeBytes: number
}
```

### Extension-Side Implementation
```typescript
// In RitemarkEditorProvider.ts
const ext = path.extname(document.uri.fsPath).toLowerCase();

if (ext === '.xlsx' || ext === '.xls') {
  // Bypass TextDocument - read binary directly
  const buffer = fs.readFileSync(document.uri.fsPath);
  webview.postMessage({
    type: 'load',
    fileType: 'xlsx',
    filename: path.basename(document.uri.fsPath),
    content: buffer.toString('base64'),
    encoding: 'base64',
    sizeBytes: buffer.length
  });
} else if (ext === '.csv') {
  webview.postMessage({
    type: 'load',
    fileType: 'csv',
    filename: path.basename(document.uri.fsPath),
    content: document.getText(),
    sizeBytes: Buffer.byteLength(document.getText(), 'utf8')
  });
} else {
  // Markdown - existing flow with added fields
  // ...
}
```

### Webview-Side Routing
```typescript
// App.tsx
const ext = filename.toLowerCase().split('.').pop();
if (ext === 'csv') return <SpreadsheetViewer parser="csv" />;
if (['xlsx', 'xls'].includes(ext)) return <SpreadsheetViewer parser="excel" />;
return <Editor />; // Default markdown editor
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Bundle size exceeds 2MB | Use Vite tree-shaking, consider code-splitting |
| Large Excel files crash webview | Virtual scrolling, add row limit warning (100k rows) |
| Excel formulas not evaluated | Document limitation, add in future sprint |
| Multi-sheet workbooks | Show sheet selector (Phase 1), default to first sheet |

## Out of Scope (Future Sprints)
- Editing CSV/Excel files
- Formula evaluation in Excel
- Chart rendering
- Conditional formatting
- Export to other formats
- JSON/YAML preview (separate sprint)

## Status
**Current Phase:** 2 (DEVELOPMENT)
**Approved:** 2025-01-11

## Approval
- [x] Jarmo approved this sprint plan (2025-01-11)

---

## Notes

### Architecture Decision
We're using Option A (single editor with routing) because:
1. Reuses 90% of existing infrastructure
2. Easy to extend with more file types
3. Single bundle (simpler deployment)
4. Consistent UX across file types

### Bundle Size Projection
- Current: ~900KB
- After Sprint 17: ~1.4MB
- Future optimization: Code-splitting per file type

### Performance Target
- < 100ms load time for 1k row CSV
- < 500ms load time for 10k row CSV
- < 2s load time for 100k row Excel
- Smooth scrolling (60fps) with virtualization
