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

- [x] PDF files open in Ritemark with page navigation, zoom, and text selection
- [x] DOCX files open in Ritemark with faithful visual rendering (fonts, colors, layout preserved)
- [x] CSV files support column sorting (click header to sort)
- [x] CSV files support adding rows via toolbar button
- [ ] All features work in both dev and production builds (needs real-device testing)
- [x] Webview bundle size stays under 5MB (~3.95MB + 1MB worker)
- [ ] No regressions in existing markdown/CSV/Excel functionality (needs real-device testing)

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

### Phase 2: PDF.js Proof of Concept (BLOCKER) ✓ COMPLETED

**This must succeed before any other implementation work.**

- [x] Install react-pdf (or pdfjs-dist) in webview
- [x] Create minimal PDF rendering test in webview
- [x] Solve worker loading: copy `pdf.worker.min.mjs` to `media/`, pass URI from extension
- [x] Configure CSP: add `worker-src ${webview.cspSource} blob:;` to provider
- [x] Verify PDF renders in the webview without CSP errors
- [x] react-pdf works in webview (no fallback needed)
- [x] Worker loading works via webview.asWebviewUri()
- [x] Document what worked and what didn't

### Phase 3: Dependencies & shadcn/ui Setup ✓ COMPLETED

- [x] Install chosen PDF library in webview (react-pdf@10.3.0)
- [x] Install docx-preview in webview
- [x] Fix Tailwind theme: add missing CSS variables (`accent`, `destructive`, `secondary`, `ring`, `input`) to `index.css`
- [x] Add missing colors to `tailwind.config.ts`
- [x] Configure PDF.js worker in Vite build (copy worker to media/)
- [x] Test webview builds successfully
- [x] Verify bundle size is acceptable (~3.95MB + 1MB worker)

### Phase 4: PDF Preview Implementation ✓ COMPLETED

#### Extension Side
- [x] Create `src/pdfDocument.ts` (document class)
- [x] Create `src/pdfEditorProvider.ts` (CustomReadonlyEditorProvider)
  - CSP includes: `worker-src ${webview.cspSource} blob:;`
  - CSP includes: `img-src ${webview.cspSource} data: blob:;`
- [x] Register provider in `src/extension.ts`
- [x] Add custom editor declaration to `package.json` for `*.pdf`
- [x] Pass worker URI to webview via message (using `webview.asWebviewUri()`)

#### Webview Side
- [x] Create `webview/src/components/viewers/PDFViewer.tsx`
- [x] Implement continuous-scroll PDF rendering
- [x] Include PDF.js **text layer** for text selection and copy
- [x] Toolbar with filename, page nav, zoom controls
- [x] Implement zoom: 50%-200% presets + Fit Width + Fit Page
- [x] Page styling: shadow, border, white background, centered
- [x] Add routing in `App.tsx` for 'pdf' fileType
- [x] Loading state with spinner
- [x] Error state with retry

#### Testing
- [ ] Needs real-device testing (PDF files of various sizes and content)

### Phase 5: DOCX Preview Implementation ✓ COMPLETED

#### Extension Side
- [x] Create `src/docxDocument.ts` (document class)
- [x] Create `src/docxEditorProvider.ts` (CustomReadonlyEditorProvider)
  - CSP includes: `style-src 'unsafe-inline';` (docx-preview generates inline styles)
  - CSP includes: `img-src data: blob:;` (base64 images via useBase64URL)
  - CSP includes: `font-src data:;` (embedded fonts)
- [x] Register provider in `src/extension.ts`
- [x] Add custom editor declaration to `package.json` for `*.docx`

#### Webview Side
- [x] Create `webview/src/components/viewers/DOCXViewer.tsx`
- [x] Implement rendering with `docx-preview`'s `renderAsync()`
  - Options: `{ useBase64URL: true, inWrapper: true }`
- [x] Render content faithfully — docx-preview preserves fonts, colors, alignment
- [x] Minimal container styling (max-width, centered, overflow handling)
- [x] Toolbar with filename, "Open in Word" button, refresh
- [x] Add routing in `App.tsx` for 'docx' fileType
- [x] Add error handling for .doc files (shows "only .docx supported" message)
- [x] Loading/error states

#### Testing
- [ ] Needs real-device testing (DOCX files with various formatting)

### Phase 6: CSV Sort ✓ COMPLETED

- [x] Import `getSortedRowModel` from `@tanstack/react-table` in DataTable.tsx
- [x] Add `SortingState` to DataTable component state
- [x] Enable `getSortedRowModel()` in table config
- [x] Make column headers clickable with sort indicators
- [x] Add sort indicators: `ChevronUp` / `ChevronDown` / `ChevronsUpDown` (lucide-react)
- [x] Click cycle: ascending -> descending -> unsorted
- [x] Row index mapping verified: `row.index` preserves original position

### Phase 7: CSV Add Row ✓ COMPLETED

- [x] Add `[+ Row]` button to SpreadsheetToolbar with Plus icon
- [x] Implement `handleAddRow` in SpreadsheetViewer
- [x] Create empty row with all columns set to empty string
- [x] Append to rows array
- [x] Serialize to CSV via PapaParse and trigger onChange

### Phase 8: Integration & Polish ✓ COMPLETED

- [x] Update FileType type in App.tsx (`'markdown' | 'csv' | 'xlsx' | 'pdf' | 'docx'`)
- [x] All routing works correctly (PDF, DOCX, CSV/XLSX, Markdown)
- [x] VS Code theme colors work in all new viewers
- [x] File watchers implemented for PDF and DOCX providers

### Phase 9: Documentation & Cleanup ✓ COMPLETED

- [x] Update WISHLIST.md (move completed items to "Completed" section)
- [x] Update sprint plan status (this document)
- [x] Webview builds clean, no TypeScript errors

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
- Final webview.js: ~3.95MB (includes react-pdf + docx-preview)
- PDF.js worker: separate file (~1MB), NOT in bundle
- Total: ~5MB (at target limit)
- Original webview.js was ~900KB before sprint

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

**Current Phase:** 9 (DOCUMENTATION) - COMPLETE
**All phases implemented.** Awaiting real-device testing by Jarmo.

## Approval

- [x] Jarmo approved this sprint plan
- [ ] Jarmo tested on real device

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
