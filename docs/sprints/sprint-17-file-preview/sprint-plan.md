# Sprint 17: CSV and Excel File Preview

## Goal
Add read-only CSV and Excel (.xlsx, .xls) preview to RiteMark Native using the existing editor infrastructure.

## Success Criteria
- [ ] CSV files open in RiteMark with tabular preview
- [ ] Excel files (.xlsx, .xls) open with tabular preview
- [ ] Large files (10k+ rows) render without performance issues
- [ ] File type selector in package.json includes CSV and Excel
- [ ] Webview bundle remains under 2MB
- [ ] Production build works on darwin-arm64

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `SpreadsheetViewer.tsx` | React component for displaying tabular data |
| `DataTable.tsx` | Shared TanStack Table component with virtualization |
| Updated `package.json` | Add CSV/Excel to customEditors selector |
| Updated `App.tsx` | File type routing logic |
| Updated `RiteMarkEditorProvider.ts` | Detect file type and send appropriate content |
| Dependency updates | Install xlsx, papaparse, @tanstack/react-table, @tanstack/react-virtual |

## Implementation Checklist

### Phase 1: Setup and Dependencies
- [ ] Install npm packages (xlsx, papaparse, @tanstack/react-table, @tanstack/react-virtual)
- [ ] Update package.json customEditors selector to include *.csv, *.xlsx, *.xls
- [ ] Verify extension compiles after dependency changes

### Phase 2: Extension-Side Changes
- [ ] Modify `RiteMarkEditorProvider.ts` to detect file extension
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

**File Type Detection:**
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
**Current Phase:** 1 (RESEARCH - COMPLETE)
**Approval Required:** YES

## Approval
- [ ] Jarmo approved this sprint plan

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
