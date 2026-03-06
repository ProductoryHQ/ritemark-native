# Sprint 34: Export V2 (HTML-Based)

## Goal

Deliver production-quality PDF and DOCX export based on editor HTML output (WYSIWYG source of truth), replacing markdown-parser-based export limitations.

Also deliver a CSV cell editing UX fix so users can see full editable content, with Excel-like active-cell behavior.

## Why This Sprint

Current export pipeline parses markdown line-by-line and cannot reliably preserve:

- complex tables
- visual parity with editor output
- syntax-highlighted code blocks
- professional page layout (headers/footers/templates)

Export V2 establishes a single HTML-first rendering pipeline for both PDF and DOCX.

## Scope

### In Scope

| Feature | Description |
| --- | --- |
| HTML source export | Export uses editor HTML (not markdown parsing) |
| PDF via HTML print | PDF rendered from HTML with print CSS |
| DOCX via HTML conversion | DOCX generated from normalized HTML |
| Table fidelity | Robust export for table structure and styling |
| Styling system | Shared export CSS + template variants |
| Header/Footer (PDF) | Page number and document metadata in print output |
| Syntax highlighting | Colorized code blocks in exports |
| Metadata mapping | title/author/date mapped from document properties |
| CSV cell editor UX fix | Replace one-line-only editing with full-text-visible editing and clear active-cell focus state |

### Out of Scope (Follow-Up)

| Feature | Reason |
| --- | --- |
| Batch folder export | Separate workflow and UX |
| Cloud template sync | Requires backend/account scope |
| Full print layout editor UI | Too large for this sprint |

## Success Criteria

- [ ] PDF export is generated from HTML pipeline (no markdown parser dependency)
- [ ] DOCX export is generated from HTML pipeline
- [ ] Complex tables export correctly in PDF and DOCX
- [ ] Code blocks preserve syntax colors in PDF and DOCX
- [ ] At least 2 export templates available (`default`, `clean`)
- [ ] PDF includes page numbers and document title in header/footer
- [ ] Existing Export UI remains backward-compatible for users
- [ ] No regressions in images, headings, lists, links, blockquotes
- [x] CSV cell edit mode shows full text while editing (not truncated one-line input)
- [x] CSV active cell has clear Excel-like focus border and keyboard navigation parity (Enter/Tab/Esc)

## Implementation Checklist

### Phase 1: Architecture & Contracts

- [ ] Define export payload contract from webview to extension (`html`, `metadata`, `templateId`)
- [ ] Keep markdown payload temporarily for fallback/compatibility during migration
- [ ] Add `ExportV2` capability flag (internal rollout switch)

### Phase 2: HTML Capture in Webview

- [ ] Add canonical HTML extraction path from TipTap editor
- [ ] Normalize HTML before export (table cleanup, link normalization, code block markup)
- [ ] Include selected template id in export command payload

### Phase 3: Shared Export HTML Pipeline

- [ ] Create shared module: `src/export/v2/htmlPipeline.ts`
- [ ] Implement sanitize + normalize steps
- [ ] Implement local image resolution and embedding strategy
- [ ] Implement shared CSS generation for templates

### Phase 4: PDF Renderer (HTML -> PDF)

- [ ] Add renderer module: `src/export/v2/pdfHtmlExporter.ts`
- [ ] Render HTML with print stylesheet and template variables
- [ ] Implement header/footer (title, date, page numbers)
- [ ] Validate multi-page content, table page breaks, code block wrapping

### Phase 5: DOCX Renderer (HTML -> DOCX)

- [ ] Add renderer module: `src/export/v2/docxHtmlExporter.ts`
- [ ] Convert normalized HTML to DOCX with style mapping
- [ ] Ensure table, heading, list, and code block style fidelity
- [ ] Map metadata (title/author/date) into DOCX properties

### Phase 6: Templates & Styling

- [ ] Add template registry (start with `default`, `clean`)
- [ ] Define per-template tokens (font stack, spacing, heading scale, code style)
- [ ] Ensure both PDF and DOCX consume same template semantics

### Phase 7: Integration

- [ ] Wire `exportPDF` and `exportWord` handlers to V2 pipeline
- [ ] Keep V1 fallback path until parity checks are complete
- [ ] Add telemetry/logging for exporter errors and fallback usage

### Phase 8: Testing & Validation

- [ ] Add fixture documents (tables, nested lists, code, images, properties)
- [ ] Add automated export smoke tests for PDF and DOCX
- [ ] Add manual QA checklist for macOS and Windows
- [ ] Verify file size/performance on large documents

### Phase 9: Documentation & Release Notes

- [ ] Update `docs/features/export.md` with V2 behavior and known limits
- [ ] Update `docs/sprints/WISHLIST.md` status for Export V2 items
- [ ] Create release summary notes for release manager/product marketer

### Phase 10: CSV Cell Editor UX Overhaul (DONE)

- [x] Review current table edit component behavior in webview (`DataTable` / `SpreadsheetViewer`)
- [x] Replace one-line cell input with edit mode that preserves full text visibility
- [x] Add Excel-like active-cell border/focus styling for selected and editing cell
- [x] Add optional formula-bar style top editor (single source of truth for active cell value)
- [x] Ensure keyboard behavior is predictable: Enter commits, Esc cancels, Tab moves cell
- [x] Verify long text, multiline values, and copy/paste flows
- [ ] Add regression tests for active-cell state and value commit/cancel behavior

#### Bugs Fixed

- **In-cell editing only allowed 1 character** — Root cause: keydown event on `<textarea>` bubbled to parent `<td>`, which intercepted single-character keys and called `startEditing(cellCoord, e.key)`, resetting `editValue` to just that character each keystroke. Fix: added `if (isEditing) return` guard in td's `onKeyDown`.
- **First character selected on type-to-edit** — `useEffect` called `textarea.select()` unconditionally when editing started. Fix: added `editStartedByTyping` ref — typing places cursor at end, double-click/Enter/F2 selects all.
- **Double-click didn't enter edit mode** — After first mousedown started editing, textarea appeared and intercepted the second click (different element = no dblclick event). Fix: replaced `onDoubleClick` with `e.detail >= 2` check in `onMouseDown`.
- **Formula bar scrolled horizontally with table** — Formula bar was inside the `overflow-auto` scroll container. Fix: restructured to flex column layout — formula bar outside scroll container, table inside.
- **`[object Object]` in cell display and title** — `flexRender()` returns a React element, not a string. Fix: replaced with `getCellValue()` raw string for cell display and `title` attribute.

#### New Features Added

- **Copy-paste (Cmd+C / Cmd+V)** — Copy works on any selected cell (including read-only mode). Paste writes clipboard content into active cell via `onCellChange`.
- **Add column** — `+` button in header row (rightmost). Creates new column with auto-generated name (`Column<N>`), empty values in all rows.
- **Rename column** — Double-click column header opens inline input. Enter/blur confirms, Escape cancels. Duplicate names prevented.
- **Delete column** — Click header to select → red minus circle → Yes/No confirmation. Same UX pattern as row deletion. Last column protected from deletion.
- **Add row redesign** — Replaced large blue sticky button with subtle inline table row (faded `+` and "Add row" text, lights up on hover).

### Phase 11: QA Fixes & Polish (DONE)

Post-Codex review and manual testing fixes:

- [x] **Simplified export menu** — removed confusing Default/Clean template choices, single "Export PDF" / "Export Word" / "Copy as Markdown"
- [x] **PDF heading alignment** — fixed `doc.x` not resetting to left margin after tables, code blocks, blockquotes, lists
- [x] **PDF fonts** — changed Clean template from Times-Roman to Helvetica (matching Default)
- [x] **PDF no headers/footers** — removed automatic header (title) and footer (page numbers), removed dead `applyHeaderFooter()` code
- [x] **PDF empty pages** — removed `bufferPages: true` that caused blank pages at end
- [x] **PDF image support** — fixed images not appearing: use `title` attribute (original relative path) instead of `src` (webview URI); proper aspect-ratio scaling via `doc.openImage()`; manual `doc.y` advance after image
- [x] **Word image support** — added `ImageRun` with `getImageDimensions()` (PNG/JPEG header parsing) for proper aspect ratio
- [x] **Word no footer** — removed "Exported from Ritemark" footer
- [x] **Word HR full-width** — replaced text-character HR with `BorderStyle.SINGLE` bottom border (margin-to-margin)
- [x] **PDF heading spacing** — per-level `spaceBefore`/`spaceAfter` values (H1 gets most space, H6 least)
- [x] **PDF heading orphan protection** — `ensurePageRoom` checks heading + at least one line of following content
- [x] **PDF blockquote border** — added 2.5pt left vertical border line
- [x] **PDF HR refined** — thinner (0.5pt) with more spacing around it
- [x] **Word heading spacing** — `before`/`after` spacing values + `keepNext: true` (orphan protection)
- [x] **Word blockquote** — italic style + left border

### Phase 12: UX Fixes (DONE)

- [x] **CMD+B / CTRL+B conflict** — disabled sidebar toggle when Ritemark editor is active (keybinding override in package.json), Bold now works without toggling folder tree
- [x] **Terminal auto-open** — terminal only opens on startup if no terminal exists yet (was unconditionally creating new terminal on every window)

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| HTML/CSS parity differs between PDF and DOCX renderers | Medium | High | Shared normalized HTML + shared style token system |
| DOCX converter drops advanced styles | Medium | Medium | Explicit style mapping + fixture-based validation |
| Large docs produce slow export | Medium | Medium | Optimize image embedding and renderer options |
| Header/footer support diverges by platform | Low | Medium | Keep PDF header/footer deterministic with explicit renderer settings |
| CSV editor UX changes break existing shortcuts | Medium | Medium | Add keyboard interaction test matrix and staged rollout |

## Deliverables

- New Export V2 architecture in `extensions/ritemark/src/export/v2/*`
- Backward-compatible export commands with controlled fallback
- Improved CSV cell editing UX with full text visibility and active-cell focus behavior
- Sprint docs and release communication-ready summary
