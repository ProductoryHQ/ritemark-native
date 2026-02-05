# Sprint 32: PDF, DOCX Preview & CSV Editing

## Goal

Add read-only viewers for PDF and DOCX files, and enhance CSV editing with sort and add row.

**Design principle:** PDF and DOCX viewers are part of the **Text Editor** feature family — they must feel like natural extensions of the Ritemark writing experience, not separate tools. Document content renders faithfully as-is. All new UI chrome uses **shadcn/ui patterns** from day one.

## Scope (Revised After Review)

An independent review identified critical blockers and over-engineering. Scope has been cut to achievable targets. See `research/06-review-findings.md` for full analysis.

### In Scope

| Feature | Description |
|---------|-------------|
| PDF Viewer | Read-only preview with page nav, zoom, text selection |
| DOCX Viewer | Read-only preview with faithful visual rendering |
| CSV Sort | Click column headers to sort asc/desc |
| CSV Add Row | Toolbar button to append rows |

### Deferred to Follow-Up Sprint

| Feature | Reason |
|---------|--------|
| CSV column operations | Complex edge cases (delete all, rename) |
| CSV context menus | Needs @radix-ui/react-context-menu, may conflict with VS Code context menu |
| CSV multi-line cells | Keyboard handling complexity (Enter vs Shift+Enter) |
| CSV delete row | Edge cases need careful design |

### Key Dependency Changes

| Original | Changed To | Why |
|----------|-----------|-----|
| mammoth | **docx-preview** | mammoth strips visual formatting; docx-preview preserves fonts, colors, alignment |
| pdfjs-dist (raw) | **react-pdf** (or pdfjs-dist) | react-pdf wraps PDF.js with React components, handles worker config |

## Feature Flag Check

**Decision:** NO flags needed. Ship all features enabled by default.

## Success Criteria

- [ ] PDF files open in Ritemark with page navigation, zoom, and text selection
- [ ] DOCX files open in Ritemark with faithful visual rendering (fonts, colors, layout preserved)
- [ ] CSV files support column sorting (click header to sort)
- [ ] CSV files support adding rows via toolbar button
- [ ] All features work in both dev and production builds
- [ ] Webview bundle size stays under 5MB
- [ ] No regressions in existing markdown/CSV/Excel functionality

## Implementation Checklist

### Phase 1: Research ✓ COMPLETED

- [x] Analyze existing custom editor patterns
- [x] Research PDF viewing libraries
- [x] Research DOCX viewing libraries
- [x] Analyze current CSV editing implementation
- [x] Document dependency requirements and bundle size impact
- [x] Design technical architecture
- [x] Evaluate feature flag needs (none needed)
- [x] UX/UI design for all viewers (see `research/05-ux-design.md`)
- [x] Independent review (see `research/06-review-findings.md`)
- [x] Web research: how existing VS Code PDF/DOCX extensions solve CSP/worker issues

### Phase 2: PDF.js Proof of Concept (BLOCKER)

**This must succeed before any other implementation work.**

- [ ] Install react-pdf (or pdfjs-dist) in webview
- [ ] Create minimal PDF rendering test in webview
- [ ] Solve worker loading: copy `pdf.worker.min.mjs` to `media/`, pass URI from extension
- [ ] Configure CSP: add `worker-src ${webview.cspSource} blob:;` to provider
- [ ] Verify PDF renders in the webview without CSP errors
- [ ] If react-pdf doesn't work in webview, fall back to raw pdfjs-dist
- [ ] If worker loading fails, test `GlobalWorkerOptions.workerSrc = ''` (main thread fallback)
- [ ] Document what worked and what didn't

### Phase 3: Dependencies & shadcn/ui Setup

- [ ] Install chosen PDF library in webview
- [ ] Install docx-preview in webview (`npm install docx-preview`)
- [ ] Fix Tailwind theme: add missing CSS variables (`accent`, `destructive`, `secondary`, `ring`, `input`) to `index.css`
- [ ] Add missing colors to `tailwind.config.ts`
- [ ] Create `components.json` for shadcn CLI
- [ ] Add shadcn/ui components: DropdownMenu, Tooltip
- [ ] Configure PDF.js worker in Vite build (copy worker to media/)
- [ ] Test webview builds successfully
- [ ] Verify bundle size is acceptable (<5MB)

### Phase 4: PDF Preview Implementation

#### Extension Side
- [ ] Create `src/pdfDocument.ts` (document class)
- [ ] Create `src/pdfEditorProvider.ts` (CustomReadonlyEditorProvider)
  - CSP must include: `worker-src ${webview.cspSource} blob:;`
  - CSP must include: `img-src ${webview.cspSource};`
- [ ] Register provider in `src/extension.ts`
- [ ] Add custom editor declaration to `package.json` for `*.pdf`
- [ ] Pass worker URI to webview via message (using `webview.asWebviewUri()`)

#### Webview Side
- [ ] Create `webview/src/components/viewers/PDFViewer.tsx`
- [ ] Implement continuous-scroll PDF rendering with lazy page loading
- [ ] Include PDF.js **text layer** for text selection and copy
- [ ] Create `webview/src/components/header/PDFToolbar.tsx` (shared toolbar pattern)
  - Filename (left), page nav input (center-right), zoom dropdown (right), refresh (rightmost)
- [ ] Implement zoom: DropdownMenu with 50%-200%, Fit Width, Fit Page (shadcn DropdownMenu)
- [ ] Page styling: shadow, border, white background, centered
- [ ] Add routing in `App.tsx` for 'pdf' fileType
- [ ] Add file change notification support
- [ ] Loading state: Progress component + "Loading {filename}..."
- [ ] Error state: Alert component with retry button
- [ ] Large file warning (>10MB)

#### Testing
- [ ] Test small PDF (1 page)
- [ ] Test large PDF (100+ pages)
- [ ] Test page navigation
- [ ] Test zoom controls
- [ ] Test text selection and copy
- [ ] Test file change notification + refresh
- [ ] Test corrupted PDF error handling

### Phase 5: DOCX Preview Implementation

#### Extension Side
- [ ] Create `src/docxDocument.ts` (document class)
- [ ] Create `src/docxEditorProvider.ts` (CustomReadonlyEditorProvider)
  - CSP must include: `style-src ${webview.cspSource} 'unsafe-inline';` (docx-preview generates inline styles)
  - CSP must include: `img-src ${webview.cspSource} data:;` (base64 images via useBase64URL)
  - CSP must include: `font-src ${webview.cspSource} data:;` (embedded fonts)
- [ ] Register provider in `src/extension.ts`
- [ ] Add custom editor declaration to `package.json` for `*.docx`

#### Webview Side
- [ ] Create `webview/src/components/viewers/DOCXViewer.tsx`
- [ ] Implement rendering with `docx-preview`'s `renderAsync()`
  - Options: `{ useBase64URL: true, inWrapper: true }` (base64 required for VS Code webview)
- [ ] Render content faithfully — docx-preview preserves fonts, colors, alignment
- [ ] Minimal container styling (max-width, centered, overflow handling only)
- [ ] Create `webview/src/components/header/DOCXToolbar.tsx` (filename + "Open in Word" + refresh)
- [ ] Add routing in `App.tsx` for 'docx' fileType
- [ ] Add file change notification support
- [ ] Add error handling for .doc files (show "only .docx supported" message)
- [ ] Loading/error states using shadcn Progress and Alert

#### Testing
- [ ] Test simple DOCX (text only)
- [ ] Test complex DOCX (images, tables, formatting, fonts, colors)
- [ ] Test .doc file (should show error)
- [ ] Test file change notification + refresh
- [ ] Test corrupted DOCX error handling

### Phase 6: CSV Sort

- [ ] Import `getSortedRowModel` from `@tanstack/react-table` in DataTable.tsx
- [ ] Add `SortingState` to DataTable component state
- [ ] Enable `getSortedRowModel()` in table config
- [ ] Make column headers clickable (shadcn Button ghost variant)
- [ ] Add sort indicators: `ChevronUp` / `ChevronDown` / `ChevronsUpDown` (lucide-react)
- [ ] Click cycle: ascending -> descending -> unsorted
- [ ] Verify row index mapping: `onCellChange` must use original row index, not sorted visual index
- [ ] Test sorting ascending/descending/none
- [ ] Verify sorting doesn't trigger save (view-only until user edits a cell)

### Phase 7: CSV Add Row

- [ ] Add `[+ Row]` button to SpreadsheetToolbar (shadcn Button ghost)
- [ ] Implement `handleAddRow` in SpreadsheetViewer
- [ ] Create empty row with all columns set to empty string
- [ ] Append to rows array
- [ ] Serialize to CSV via PapaParse and trigger onChange
- [ ] Test adding row to empty CSV
- [ ] Test adding multiple rows in sequence

### Phase 8: Integration & Polish

- [ ] Update FileType type in App.tsx (`'markdown' | 'csv' | 'xlsx' | 'pdf' | 'docx'`)
- [ ] Verify all routing works correctly
- [ ] Test switching between file types (markdown -> pdf -> csv -> docx)
- [ ] Add error boundaries for all new components
- [ ] Verify VS Code theme colors work in all new viewers
- [ ] Test file watchers and refresh for all file types

### Phase 9: Documentation & Cleanup

- [ ] Update WISHLIST.md (move completed items to "Completed" section)
- [ ] Document PDF.js worker configuration
- [ ] Clean up debug console.log statements
- [ ] Verify no TypeScript errors

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **PDF.js worker fails in webview CSP** | **Medium** | **BLOCKING** | **PoC in Phase 2 before any other work** |
| Bundle size too large (>5MB) | Low | Medium | Worker is separate file, not bundled in webview.js |
| docx-preview inline styles blocked by CSP | Low | High | CSP already allows `'unsafe-inline'` for styles |
| Base64 encoding large PDFs (>50MB) | Medium | Medium | Warn at 10MB, consider chunked transfer later |
| CSV sort breaks cell editing index | Medium | High | Verify TanStack Table preserves original row indices |
| .doc files not supported | High | Low | Clear error message |

## Technical Notes

### Bundle Size Monitoring
- Current webview.js: ~900KB
- PDF.js worker: separate file (~1.5MB), NOT in bundle
- docx-preview: ~400KB added to bundle
- Expected bundle: ~1.3-1.5MB (much better than original 3.5MB estimate)

### PDF.js Worker Strategy
Worker loaded as separate file via `webview.asWebviewUri()`:
1. Copy `pdf.worker.min.mjs` to `media/` during build
2. Extension passes worker URI to webview via postMessage
3. Webview sets `GlobalWorkerOptions.workerSrc = workerUri`
4. CSP: `worker-src ${webview.cspSource} blob:;`

Reference: [vscode-pdf](https://github.com/tomoki1207/vscode-pdfviewer), [Modern PDF Preview](https://github.com/chocolatedesue/vscode-pdf)

### DOCX Rendering with docx-preview
- `renderAsync(data, container, styleContainer, { useBase64URL: true })`
- `useBase64URL: true` required because VS Code webview restricts blob: URLs
- CSP needs: `img-src data:`, `font-src data:`, `style-src 'unsafe-inline'`

Reference: [AdamRaichu Docx Renderer](https://github.com/AdamRaichu/vscode-docx-viewer) uses same approach

### CSV Sort Row Index Safety
- TanStack Table's `getSortedRowModel` preserves original `row.index` values
- `onCellChange(rowIndex, ...)` must use `row.index` (original), not visual position
- Must verify this during implementation

## Testing Checklist

### PDF Viewer
- [ ] Small PDF (1 page, <1MB)
- [ ] Medium PDF (10 pages, ~5MB)
- [ ] Large PDF (100+ pages, >10MB - should warn)
- [ ] Page navigation (first/last/middle)
- [ ] Zoom (50%, 75%, 100%, 125%, 150%, 200%, fit width, fit page)
- [ ] Text selection and copy
- [ ] Refresh after external edit
- [ ] Corrupted PDF file
- [ ] Password-protected PDF (should show error)

### DOCX Viewer
- [ ] Simple DOCX (text only)
- [ ] Formatted DOCX (bold, italic, headings, lists, colors, fonts)
- [ ] DOCX with images
- [ ] DOCX with tables (column widths preserved)
- [ ] DOCX with alignment (centered, right-aligned text)
- [ ] Large DOCX (>5MB - should warn)
- [ ] .doc file (old format - should show error)
- [ ] Refresh after external edit
- [ ] Corrupted DOCX file

### CSV Sort
- [ ] Sort text column (A-Z, Z-A)
- [ ] Sort number column (ascending, descending)
- [ ] Sort mixed content column
- [ ] Unsort (return to original order)
- [ ] Sort doesn't save file (until user edits)
- [ ] Cell editing works correctly while sorted (correct row updated)

### CSV Add Row
- [ ] Add row to empty CSV
- [ ] Add row to existing CSV
- [ ] Add multiple rows in sequence
- [ ] Added row saves correctly to file

### Regression Testing
- [ ] Markdown editor still works
- [ ] Excel viewer still works
- [ ] Existing CSV editing (single-line) still works
- [ ] AI panel still works
- [ ] Properties dialog still works
- [ ] Export (PDF/Word) still works
- [ ] File change notifications still work

### Build Testing
- [ ] Dev mode works
- [ ] Production build succeeds
- [ ] Production app opens all file types correctly
- [ ] Webview bundle has reasonable size (<5MB)
- [ ] No console errors in production

## Status

**Current Phase:** 1 (RESEARCH) - complete
**Approval Required:** Yes (Phase 2->3 gate)

## Approval

- [ ] Jarmo approved this sprint plan

---

## Research Documents

1. **Existing Patterns** (`research/01-existing-patterns.md`)
2. **Dependency Analysis** (`research/02-dependency-analysis.md`)
3. **Technical Design** (`research/03-technical-design.md`)
4. **Feature Flags Analysis** (`research/04-feature-flags-analysis.md`)
5. **UX Design** (`research/05-ux-design.md`)
6. **Review Findings** (`research/06-review-findings.md`)
   - Independent review: critical gaps, over-engineering, suboptimal patterns
   - Web research: how existing VS Code PDF/DOCX extensions handle CSP/worker
   - Dependency change: mammoth -> docx-preview
   - Scope reduction to achievable targets
