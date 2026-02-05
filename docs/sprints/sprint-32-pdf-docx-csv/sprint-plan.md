# Sprint 32: PDF, DOCX Preview & CSV Editing

## Goal

Add read-only viewers for PDF and DOCX files, and enhance CSV editing with sort, add/delete operations, and multi-line cell editing.

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - Platform-specific? **NO** (works on all platforms)
  - Experimental? **NO** (standard file viewing/editing)
  - Large download? **NO** (libraries bundled in webview)
  - Premium? **NO**
  - Kill-switch? **NO** (low risk features)

**Decision:** NO flags needed. Ship all features enabled by default.

**Reasoning:** See `research/04-feature-flags-analysis.md` for detailed analysis.

## Success Criteria

- [ ] PDF files open in Ritemark with page navigation and zoom controls
- [ ] DOCX files open in Ritemark with formatted text rendering
- [ ] CSV files support column sorting (click header to sort)
- [ ] CSV files support add/delete rows
- [ ] CSV files support add/delete columns
- [ ] CSV cells can be edited with multi-line text
- [ ] All features work in both dev and production builds
- [ ] Webview bundle size stays under 5MB
- [ ] No regressions in existing markdown/CSV/Excel functionality

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| PDF Viewer | Read-only PDF preview with navigation and zoom |
| DOCX Viewer | Read-only Word document preview with formatting |
| CSV Sort | Click column headers to sort data |
| CSV Row Operations | Add and delete rows via toolbar |
| CSV Column Operations | Add and delete columns via toolbar |
| CSV Multi-line Editing | Double-click cell for multi-line edit dialog |
| Documentation | Update WISHLIST.md (mark completed items) |
| Tests | Manual testing checklist completed |

## Implementation Checklist

### Phase 1: Research ✓ COMPLETED
- [x] Analyze existing custom editor patterns (ExcelEditorProvider, RitemarkEditorProvider)
- [x] Research PDF viewing libraries (pdfjs-dist selected)
- [x] Research DOCX viewing libraries (mammoth selected)
- [x] Analyze current CSV editing implementation
- [x] Document dependency requirements and bundle size impact
- [x] Design technical architecture (follows existing patterns)
- [x] Evaluate feature flag needs (none needed)

### Phase 2: Dependencies & Setup
- [ ] Install pdfjs-dist in webview (`npm install pdfjs-dist`)
- [ ] Install mammoth in webview (`npm install mammoth`)
- [ ] Configure PDF.js worker in Vite build
- [ ] Test webview builds successfully
- [ ] Verify bundle size is acceptable (<5MB)

### Phase 3: PDF Preview Implementation

#### Extension Side
- [ ] Create `src/pdfDocument.ts` (document class)
- [ ] Create `src/pdfEditorProvider.ts` (custom editor provider)
- [ ] Register provider in `src/extension.ts`
- [ ] Add custom editor declaration to `package.json`

#### Webview Side
- [ ] Create `webview/src/components/PdfViewer.tsx`
- [ ] Implement PDF loading with pdfjs-dist
- [ ] Add page navigation controls (prev/next/jump)
- [ ] Add zoom controls (fit width/fit page/custom zoom)
- [ ] Add toolbar with refresh and download buttons
- [ ] Add routing in `App.tsx` for 'pdf' fileType
- [ ] Add file change notification support

#### Testing
- [ ] Test small PDF (1 page)
- [ ] Test large PDF (100+ pages)
- [ ] Test page navigation
- [ ] Test zoom controls
- [ ] Test file change notification + refresh
- [ ] Test corrupted PDF error handling
- [ ] Test external file changes

### Phase 4: DOCX Preview Implementation

#### Extension Side
- [ ] Create `src/docxDocument.ts` (document class)
- [ ] Create `src/docxEditorProvider.ts` (custom editor provider)
- [ ] Register provider in `src/extension.ts`
- [ ] Add custom editor declaration to `package.json`

#### Webview Side
- [ ] Create `webview/src/components/DocxViewer.tsx`
- [ ] Implement DOCX to HTML conversion with mammoth
- [ ] Add styled document container (white background, max-width, margins)
- [ ] Add toolbar with refresh and download buttons
- [ ] Add routing in `App.tsx` for 'docx' fileType
- [ ] Add file change notification support
- [ ] Add error handling for .doc files (show "only .docx supported" message)

#### Testing
- [ ] Test simple DOCX (text only)
- [ ] Test complex DOCX (images, tables, formatting)
- [ ] Test .doc file (should show error)
- [ ] Test file change notification + refresh
- [ ] Test corrupted DOCX error handling
- [ ] Test external file changes

### Phase 5: CSV Editing - Sort Feature

- [ ] Add TanStack Table sorting state to `DataTable.tsx`
- [ ] Enable `getSortedRowModel` in table config
- [ ] Add click handler to column headers
- [ ] Add sort indicators (↑/↓) to headers
- [ ] Test sorting ascending/descending/none
- [ ] Verify sorting doesn't trigger save (view-only until edit)

### Phase 6: CSV Editing - Row Operations

#### Add Row
- [ ] Add "Add Row" button to SpreadsheetToolbar
- [ ] Implement `handleAddRow` in SpreadsheetViewer
- [ ] Create empty row with all columns
- [ ] Append to rows array
- [ ] Serialize to CSV and trigger onChange
- [ ] Test adding multiple rows

#### Delete Row
- [ ] Add delete icon to row number cell (on hover)
- [ ] Implement `handleDeleteRow` in SpreadsheetViewer
- [ ] Remove row from array
- [ ] Serialize to CSV and trigger onChange
- [ ] Test deleting first/middle/last row
- [ ] Test deleting all rows (edge case)

### Phase 7: CSV Editing - Column Operations

#### Add Column
- [ ] Add "Add Column" button to SpreadsheetToolbar
- [ ] Create dialog to prompt for column name
- [ ] Implement `handleAddColumn` in SpreadsheetViewer
- [ ] Add column to columns array
- [ ] Add empty value to all rows
- [ ] Serialize to CSV and trigger onChange
- [ ] Test adding column with various names

#### Delete Column
- [ ] Add delete icon to column header (on hover or context menu)
- [ ] Implement `handleDeleteColumn` in SpreadsheetViewer
- [ ] Remove column from columns array
- [ ] Remove column from all rows
- [ ] Serialize to CSV and trigger onChange
- [ ] Test deleting first/middle/last column
- [ ] Test deleting all columns (edge case - should show warning)

### Phase 8: CSV Editing - Multi-line Cells

- [ ] Create `EditCellDialog` component using Dialog (radix-ui)
- [ ] Add textarea with min-height and resize capability
- [ ] Add Save/Cancel buttons
- [ ] Modify `DataTable.tsx` to handle double-click (opens dialog)
- [ ] Keep single-click for row selection/expansion
- [ ] Test multi-line text editing
- [ ] Test Enter within textarea (should insert newline, not save)
- [ ] Test Escape to cancel
- [ ] Verify multi-line content saves correctly to CSV

### Phase 9: Integration & Polish

- [ ] Update FileType type in App.tsx (`'markdown' | 'csv' | 'xlsx' | 'pdf' | 'docx'`)
- [ ] Verify all routing works correctly
- [ ] Test switching between file types (markdown → pdf → csv → docx)
- [ ] Add loading states for large file conversions
- [ ] Add error boundaries for all new components
- [ ] Verify VS Code theme colors work in all new viewers
- [ ] Test file watchers and refresh for all file types

### Phase 10: Documentation & Cleanup

- [ ] Update WISHLIST.md (move completed items to "Completed" section)
- [ ] Add comments to new provider classes
- [ ] Document PDF.js worker configuration
- [ ] Create testing notes in `notes/testing-results.md`
- [ ] Clean up any debug console.log statements
- [ ] Verify no TypeScript errors
- [ ] Verify no linting errors

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bundle size too large (>5MB) | Low | Medium | Lazy load PDF.js worker, measure during Phase 2 |
| PDF.js worker config fails | Medium | High | Test worker loading early, follow PDF.js docs closely |
| Mammoth conversion slow for large DOCX | Medium | Low | Add loading spinner, show file size warning |
| CSV operations cause data loss | Low | High | Thorough testing, VS Code file history provides backup |
| .doc files not supported | High | Low | Show clear error message, guide user to convert |
| Existing CSV editing breaks | Low | High | Test existing features before adding new ones |
| Memory issues with large PDFs | Low | Medium | Lazy page rendering, warn for files >10MB |

## Technical Notes

### Bundle Size Monitoring
- Current webview.js: ~900KB
- Expected after sprint: ~3.5MB
- Components: pdfjs-dist (~2.5MB) + mammoth (~150KB)
- Acceptable for built-in app (not marketplace extension)

### PDF.js Worker
Worker file must be accessible to webview:
- Copy `pdf.worker.mjs` to `media/` during build
- Configure `GlobalWorkerOptions.workerSrc` with webview URI
- OR use inline worker (increases bundle size)

### CSV Editing UX
- Sort is view-only (doesn't save until user edits a cell)
- All operations immediately save to file via onChange
- VS Code auto-save creates file history (user can revert)
- Multi-line cells stored as escaped strings in CSV (PapaParse handles)

### DOCX Image Handling
- Mammoth converts images to base64 data URLs
- Images will be inline in HTML (increases memory usage)
- Large DOCX with many images may be slow

## Testing Checklist

### PDF Viewer
- [ ] Small PDF (1 page, <1MB)
- [ ] Medium PDF (10 pages, ~5MB)
- [ ] Large PDF (100+ pages, >10MB - should warn)
- [ ] Page navigation (first/last/middle)
- [ ] Zoom (25%, 50%, 100%, 150%, 200%, fit width, fit page)
- [ ] Refresh after external edit
- [ ] Corrupted PDF file
- [ ] Password-protected PDF (should show error)

### DOCX Viewer
- [ ] Simple DOCX (text only, <1MB)
- [ ] Formatted DOCX (bold, italic, headings, lists)
- [ ] DOCX with images
- [ ] DOCX with tables
- [ ] Large DOCX (>5MB - should warn)
- [ ] .doc file (old format - should show error)
- [ ] Refresh after external edit
- [ ] Corrupted DOCX file

### CSV Editing - Sort
- [ ] Sort text column (A-Z, Z-A)
- [ ] Sort number column (ascending, descending)
- [ ] Sort mixed content column
- [ ] Unsort (return to original order)
- [ ] Sort doesn't save file (until user edits)

### CSV Editing - Rows
- [ ] Add row to empty CSV
- [ ] Add row to existing CSV
- [ ] Add multiple rows in sequence
- [ ] Delete first row
- [ ] Delete middle row
- [ ] Delete last row
- [ ] Delete all rows (edge case)

### CSV Editing - Columns
- [ ] Add column with simple name
- [ ] Add column with name containing spaces
- [ ] Add column with name containing special chars
- [ ] Delete first column
- [ ] Delete middle column
- [ ] Delete last column
- [ ] Delete all columns (should show warning or prevent)

### CSV Editing - Multi-line
- [ ] Edit cell with single line
- [ ] Edit cell with multiple lines (press Enter in textarea)
- [ ] Save multi-line cell (Cmd+Enter or click Save)
- [ ] Cancel edit (Escape or click Cancel)
- [ ] Verify multi-line content persists after save
- [ ] Verify multi-line content displays correctly after reload

### Regression Testing
- [ ] Markdown editor still works
- [ ] Excel viewer still works
- [ ] CSV viewer (read-only Excel) still works
- [ ] Existing CSV editing (single-line) still works
- [ ] AI panel still works
- [ ] Properties dialog still works
- [ ] Export (PDF/Word) still works
- [ ] File change notifications still work

### Build Testing
- [ ] Dev mode: `yarn dev` in vscode/ (extension + webview hot reload)
- [ ] Production build: `./scripts/build-prod.sh` succeeds
- [ ] Production app opens all file types correctly
- [ ] Webview bundle exists and has reasonable size (<5MB)
- [ ] No console errors in production

## Status

**Current Phase:** 1 (RESEARCH)
**Approval Required:** Yes (Phase 2→3 gate)

## Approval

- [ ] Jarmo approved this sprint plan

---

## Research Documents

Detailed technical research completed in Phase 1:

1. **Existing Patterns** (`research/01-existing-patterns.md`)
   - Custom editor architecture analysis
   - Webview routing patterns
   - Current CSV/Excel implementation

2. **Dependency Analysis** (`research/02-dependency-analysis.md`)
   - Library selection (pdfjs-dist, mammoth)
   - Bundle size impact assessment
   - Installation and configuration requirements

3. **Technical Design** (`research/03-technical-design.md`)
   - Component architecture for PDF/DOCX viewers
   - CSV editing enhancement designs
   - Message protocols
   - Error handling strategies

4. **Feature Flags Analysis** (`research/04-feature-flags-analysis.md`)
   - Risk assessment for each feature
   - Flag requirement evaluation (conclusion: no flags needed)

## Notes

- This is an ambitious sprint with 3 major features
- Estimated effort: 2-3 days of focused development
- PDF and DOCX viewers follow proven Excel pattern
- CSV enhancements build on existing infrastructure
- All features are low-risk (read-only viewers + standard spreadsheet ops)
- No feature flags needed (see flags analysis)
- Webview bundle increase is acceptable for built-in app
