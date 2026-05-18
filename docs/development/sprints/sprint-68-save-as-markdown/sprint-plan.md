# Sprint 68: Save as Markdown from DOCX / PDF Preview

## Goal

Add a "Save as Markdown" button to the DOCX and PDF viewer toolbars so users can convert open documents to `.md` files with images saved to `./images/` following Ritemark's existing paste-flow convention.

## Feature Flag Check

- [x] Does this sprint need a feature flag?
  - New user-visible conversion feature that ships both paths in one sprint. A kill-switch is warranted for the first release cycle in case edge-case PDFs trigger crashes or runaway Workers.
  - Flag ID: `saveAsMarkdownFromPreview`, status `stable`, all platforms.
  - Both toolbar buttons are gated by this flag; if the flag is disabled the buttons are not rendered.

## Success Criteria

- [x] A "Save as Markdown" button appears in the DOCXViewer toolbar (gated by `saveAsMarkdownFromPreview` flag).
- [x] A "Save as Markdown" button appears in the PDFViewer toolbar (gated by flag).
- [x] Clicking either button opens a VS Code Save As dialog defaulted to `<source-basename>.md` in the same directory as the source file.
- [x] The saved `.md` file opens immediately in the Ritemark editor after save.
- [x] Images extracted from DOCX are written to `./images/<basename>--image-N.<ext>` next to the `.md`. *(Required a follow-up fix — see commit `51c1f67` — because the extension's `writeImageRelativeTo` re-sanitizer collapsed the `--` separator. Resolved with `skipSanitize` option on the trusted save-as-markdown path.)*
- [ ] ~~Images extracted from PDF are written to the same `./images/` folder with the same naming convention.~~ **Waived (2026-05-18).** PDF image extraction not shipped (Risk 5 acknowledged in plan; getOperatorList + objs cache too fragile for first cut). Heuristic converter is text-only.
- [x] No inline base64 appears in the output markdown.
- [ ] ~~PDF conversion runs in a Web Worker for documents > 20 pages; the UI does not freeze.~~ **Waived (2026-05-18).** Shipped Risk 2 Option A (inline conversion). pdfjs's own internal worker handles rendering. No user reports of UI freeze yet; revisit only if real-world large PDFs surface a problem.
- [ ] ~~Scanned PDFs (no text layer) surface a warning toast; they do not crash.~~ **Intentionally untested (2026-05-18).** No scanned-PDF test fixture on hand; per the [intentionally-untested triage rule](../../../../.claude/memory.md), wait for a real user bug report rather than fabricate a fixture. Code path exists (`pdfToMarkdown.ts` returns empty markdown + warning; DOCXViewer short-circuits to "Nothing to save" toast).
- [ ] ~~Multi-column PDFs surface a warning toast.~~ **Intentionally untested (2026-05-18).** Same triage rule as above. Code path exists (`pdfToMarkdown.ts` bumps a column-detection warning counter when X-band clustering fires).
- [ ] ~~Toast summarises result: "Saved `brief.md` · N tables, N images, N warnings."~~ **Shipped narrower (2026-05-18).** Toast shows `"Saved <filename>"` plus the warnings list (if any). The `N tables / N images / N warnings` counts were dropped; warnings list alone is sufficient signal for the failure modes users actually care about. Plan amended; no follow-up.
- [x] Telemetry fires `feature_used: save_as_markdown` with `source: 'docx' | 'pdf'`. *(Confirmed in PostHog 2026-05-18 — 5 events visible over 90-day window from QA runs.)*
- [ ] ~~`saveAsMarkdownFromPreview` flag is registered in `flags.ts` and gating is confirmed by disabling the flag and verifying buttons disappear.~~ **Half-shipped (2026-05-18).** Flag is registered and `isEnabled()` call sites work. UI gating cannot be verified the planned way because the Settings flag-toggle UI was removed project-wide — see `project_feature_flags_no_ui.md`. Code-review of `canSaveAsMarkdown` prop threading is the substitute QA.
- [x] `writeImageRelativeTo()` helper is shared between the paste flow and the new save handler (no duplicated sanitization logic). *(Now also gains `skipSanitize` option for trusted callers — see commit `51c1f67`.)*
- [x] Extension TypeScript compiles clean. Pre-commit hook passes.

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `extensions/ritemark/src/features/flags.ts` | Add `saveAsMarkdownFromPreview` flag (stable, all platforms) |
| `extensions/ritemark/src/ritemarkEditor.ts` | Refactor `saveImage()` to extract private `writeImageRelativeTo()` helper; add `case 'saveAsMarkdown':` message route |
| `extensions/ritemark/src/export/saveAsMarkdown.ts` | New file: `saveAsMarkdownHandler()` — VS Code Save As dialog, write `.md`, write images, open in editor |
| `extensions/ritemark/webview/package.json` | Add `mammoth ^1.12.0` dependency |
| `extensions/ritemark/webview/src/components/viewers/DOCXViewer.tsx` | Add "Save as Markdown" button; wire mammoth conversion + turndown; postMessage |
| `extensions/ritemark/webview/src/components/viewers/PDFViewer.tsx` | Add "Save as Markdown" button; wire pdfToMarkdown Worker; postMessage |
| `extensions/ritemark/webview/src/conversion/pdfToMarkdown.ts` | New file: heuristic PDF text-content → Markdown converter (~300 LOC) |
| `extensions/ritemark/src/analytics/events.ts` | Extend `feature_used` payload to accept optional `source` property |
| `docxEditorProvider.ts` + `pdfEditorProvider.ts` | Add `saveAsMarkdown` message handler delegation and feature-flag propagation to webview `load` message |
| Feature flag `saveAsMarkdownFromPreview` | Flag ID, status: stable, platforms: all |

## Implementation Checklist

### Work-block 1 — Plumbing (days 1–2)

#### 1a. Feature flag
- [ ] Add `'saveAsMarkdownFromPreview'` to `FlagId` union in `extensions/ritemark/src/features/flags.ts`
- [ ] Add flag entry in `FLAGS` registry: `status: 'stable'`, `platforms: ['darwin', 'win32', 'linux']`

#### 1b. Propagate flag to webview
- [ ] Extend the `Features` interface in `extensions/ritemark/webview/src/App.tsx` with `saveAsMarkdownFromPreview: boolean`
- [ ] Add `saveAsMarkdownFromPreview: isEnabled('saveAsMarkdownFromPreview')` to the `features` object sent in `docxEditorProvider.ts` → `sendDocxData()` and `pdfEditorProvider.ts` → `sendPdfData()`
  - Note: both providers send a `load` message but currently omit `features`. They must add a `features` field mirroring the shape used by `ritemarkEditor.ts:165-168`.
- [ ] Receive `features.saveAsMarkdownFromPreview` in `App.tsx` `onMessage` handler and thread it down to both viewer components via props.

#### 1c. Extract `writeImageRelativeTo()` helper
- [ ] In `extensions/ritemark/src/ritemarkEditor.ts`, extract the directory-creation + sanitization + `fs.writeFileSync` logic out of the existing `saveImage()` method (lines 693–753) into a new private method `writeImageRelativeTo(targetDir: string, filename: string, base64: string): void`.
- [ ] `saveImage()` must still call `writeImageRelativeTo()` for all existing paste-flow paths — no behaviour change to the paste flow.
- [ ] Verify callers of `saveImage()` are unchanged (the method signature stays the same; only the internal implementation is refactored).

#### 1d. Stub extension-host message route
- [ ] In `extensions/ritemark/src/ritemarkEditor.ts` message switch (around line 444), add `case 'saveAsMarkdown':` that calls a new `saveAsMarkdownHandler()` imported from `extensions/ritemark/src/export/saveAsMarkdown.ts`.
- [ ] Create `extensions/ritemark/src/export/saveAsMarkdown.ts` with a `saveAsMarkdownHandler()` stub that returns early with a `vscode.window.showInformationMessage('[stub] saveAsMarkdown not yet implemented')` — enough to confirm the route wires up cleanly before conversion logic is added.
- [ ] Add `case 'saveAsMarkdown':` to the `docxEditorProvider.ts` and `pdfEditorProvider.ts` message handlers as well — both providers will need to handle this message from their respective webviews.

#### 1e. Telemetry: widen `feature_used` payload
- [ ] In `extensions/ritemark/src/analytics/events.ts`, extend `EventPayloads['feature_used']` to `{ feature: string; source?: string }` so callers can pass an optional `source` property without breaking existing uses.

#### 1f. Build check
- [ ] Compile the extension (`npm run compile` or equivalent) to confirm no TypeScript errors from the plumbing changes before proceeding.

---

### Work-block 2 — DOCX path (day 3)

#### 2a. Install mammoth
- [ ] Add `mammoth ^1.12.0` to `dependencies` in `extensions/ritemark/webview/package.json` (not devDependencies — it is needed at runtime).
- [ ] Run `npm install` inside `extensions/ritemark/webview/` to update `package-lock.json`.
- [ ] Confirm mammoth resolves without bundler errors: `npm run build` in the webview must succeed and the output `webview.js` size increase is noted (expected ~200 KB gzipped increase).
  - **Important:** vite is configured with `inlineDynamicImports: true` (all code ends up in the single `webview.js` IIFE). There is no lazy-loading / code-splitting available. Mammoth will be bundled unconditionally into `webview.js` even when the DOCX viewer is never opened. This is acceptable per the analysis doc (~200 KB gzipped) but must be confirmed and the final bundle size noted for the QA record.

#### 2b. DOCX conversion in DOCXViewer
- [ ] In `DOCXViewer.tsx`, add state: `isSavingMd: boolean`, `saveError: string | null`.
- [ ] Add `handleSaveAsMarkdown` callback:
  1. Set `isSavingMd = true`.
  2. Decode `content` (already base64) back to `ArrayBuffer` — reuse the same decode block already in the render effect.
  3. Call `mammoth.convertToHtml({ arrayBuffer }, { convertImage: ... })` with an image-collection hook that builds `imageList: Array<{ filename, contentType, base64 }>` and replaces each `src` with `./images/<basename>--image-N.<ext>`.
  4. Run the result through `turndownService.turndown(html)` — import a fresh `TurndownService` instance with the GFM table plugin (same configuration as `App.tsx:444`).
  5. `sendToExtension('saveAsMarkdown', { markdown, images: imageList, defaultFilename, source: 'docx', warnings })`.
  6. Set `isSavingMd = false` on completion or error.
- [ ] Add "Save as Markdown" button to the DOCXViewer toolbar, visible only when `saveAsMarkdownFromPreview === true`. Button shows a spinner while `isSavingMd`.
- [ ] Listen for `saveAsMarkdownResult` response from extension (success / error) to show toast or error state.

#### 2c. Extension-host: DOCX save handler
- [ ] Implement `saveAsMarkdownHandler()` in `extensions/ritemark/src/export/saveAsMarkdown.ts`:
  1. `vscode.window.showSaveDialog(...)` with `defaultUri` pointing to `<source-dir>/<basename>.md`.
  2. If cancelled, return.
  3. Create `images/` subdirectory if `message.images.length > 0`.
  4. Write each image using `writeImageRelativeTo()`.
  5. Write `.md` via `vscode.workspace.fs.writeFile`.
  6. Execute `vscode.commands.executeCommand('vscode.openWith', saveUri, 'ritemark.editor')`.
  7. Post `saveAsMarkdownResult: { success: true, filename }` back to webview for toast.
- [ ] Fire `trackEvent('feature_used', { feature: 'save_as_markdown', source: 'docx' })`.

---

### Work-block 3 — PDF path (days 4–5)

#### 3a. PDF heuristic converter
- [ ] Create `extensions/ritemark/webview/src/conversion/pdfToMarkdown.ts` with a pure exported function `convertPdfToMarkdown(pdfData: Uint8Array): Promise<{ markdown: string; warnings: string[]; images: ImageEntry[] }>`.
- [ ] Implement heuristic pipeline:
  - Load PDF via `pdfjs-dist` (the same `pdfjs` already imported via `react-pdf` in `PDFViewer.tsx`).
  - Per page: call `page.getTextContent()` to retrieve `items[]` with `{str, transform, fontName, height}`.
  - Cluster items by Y-position (`transform[5]`) into lines.
  - Detect headings: items whose `height` is significantly above the body-text median → emit `## ` / `### `.
  - Detect lists: items whose `str` begins with `•`, `-`, or a numeric prefix (`1.`, `2.`, etc.).
  - Detect paragraphs: merge consecutive short lines (soft-wrap detection by comparing item X-end positions to page width).
  - Detect page headers/footers: text that repeats (identical string) in the top or bottom 8% of page height across 3+ pages → strip.
  - Detect scanned PDF: if total `str` length across all pages is < 50 characters → add warning "This looks like a scanned PDF — OCR support is coming. The saved file will be empty."
  - Detect multi-column: if page items cluster into two or more distinct X-position groups with a significant gap → merge left-to-right, add warning.
  - Table detection: deferred to best-effort — detect grids by consistent X-column alignment across 3+ consecutive lines; emit a GFM table if column count is consistent, otherwise emit a fenced block with a `<!-- table: low confidence -->` comment.
  - Image extraction: use `page.getOperatorList()` + the pdfjs `objs` cache to extract raster images; collect as `{ filename, base64, contentType: 'image/png' }`.
- [ ] Estimated LOC: ~300. Keep it a pure function with no side effects so it can be moved to a Worker in the next step.

#### 3b. Web Worker for large PDFs
- [ ] Create `extensions/ritemark/webview/src/conversion/pdfToMarkdown.worker.ts` that imports `convertPdfToMarkdown` and responds to `postMessage({ pdfData })` with `postMessage({ markdown, warnings, images })`.
- [ ] In `PDFViewer.tsx`:
  - For PDFs with `numPages > 20` (or when conversion takes > 200 ms), run conversion in the Worker.
  - For smaller PDFs, run `convertPdfToMarkdown` inline (avoids Worker setup overhead for the common case).
  - Note: `vite.config.ts` uses `inlineDynamicImports: true` which prevents `new Worker(new URL('./...worker', import.meta.url))` from creating a separate chunk. The Worker file must be handled differently — use an inline Worker via `URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }))` or import the Worker as a Vite asset. This is a known complexity that must be resolved during implementation; if it cannot be resolved cleanly, run conversion inline with a progress indicator instead. Document the decision in sprint notes.

#### 3c. PDFViewer button and wiring
- [ ] Add `isSavingMd`, `saveError`, `saveWarnings` state to `PDFViewer`.
- [ ] Add `handleSaveAsMarkdown` callback that triggers Worker (or inline) conversion, then `sendToExtension('saveAsMarkdown', { markdown, images, defaultFilename, source: 'pdf', warnings })`.
- [ ] Add "Save as Markdown" button to the PDFViewer toolbar, visible only when `saveAsMarkdownFromPreview === true`. Shows spinner while converting.
- [ ] `saveAsMarkdownHandler()` already handles the file-write side; add `source: 'pdf'` telemetry path.

---

### Work-block 4 — Polish (day 5)

#### 4a. Toast / warnings UX
- [ ] Post `saveAsMarkdownResult` from extension host back to webview including `{ filename, tableCount, imageCount, warnings[] }`.
- [ ] Both viewers listen for `saveAsMarkdownResult` and display a toast: "Saved `brief.md` · N tables, N images, N warnings."
- [ ] If `warnings.length > 0`, add a "View details" affordance that expands the warning list inline (or opens a `vscode.window.showWarningMessage` from the extension host — pick the simpler path for v1).
- [ ] Recommend invoking `ux-expert` for a design pass on the toast + warning surface before finalising.

#### 4b. Telemetry
- [ ] Confirm `trackEvent('feature_used', { feature: 'save_as_markdown', source: 'docx' })` fires on DOCX save.
- [ ] Confirm `trackEvent('feature_used', { feature: 'save_as_markdown', source: 'pdf' })` fires on PDF save.

#### 4c. Final cleanup
- [ ] Remove the `vscode.window.showInformationMessage('[stub] …')` placeholder from work-block 1d.
- [ ] Remove any `console.log` debug lines added during development.
- [ ] Confirm pre-commit hook passes (extension TS compiles, webview bundle < sentinel limit, `ai-sidebar` sentinel present).

---

## Risks and Open Questions

### Risk 1 — No lazy-loading: mammoth lands in `webview.js` unconditionally

`vite.config.ts` sets `inlineDynamicImports: true` and outputs a single IIFE `webview.js`. Dynamic `import('mammoth')` will be inlined, not code-split. Mammoth's minified browser build is ~700–800 KB (~200 KB gzipped). The current bundle is ~900 KB. This is a **~22% bundle size increase that affects every file type**, not just DOCX. Acceptable per the research doc's conclusion, but the actual post-build size must be measured and recorded.

Mitigation: if the increase is unacceptable, explore tree-shaking via `import { convertToHtml } from 'mammoth/mammoth.browser'` directly. Alternatively, evaluate splitting the build so the DOCX/PDF viewer code is a separate entry point — this would require a `vite.config.ts` change and is out of scope unless the size measurement triggers a re-evaluation.

### Risk 2 — Web Worker in a single-bundle IIFE

`inlineDynamicImports: true` and the IIFE format make it impossible to use `new Worker(new URL('./...', import.meta.url))` in the normal Vite way. Options:

- Option A: Run PDF conversion inline (no Worker). For most user documents (< 100 pages) this is < 3 seconds and does not visibly freeze the UI because pdfjs already runs its own Worker for rendering. Simplest, ships fastest.
- Option B: Inline Worker using `URL.createObjectURL(new Blob([...], { type: 'text/javascript' }))` — viable but requires the Worker script to be embedded as a string constant, which is messy.
- Option C: Introduce a separate Vite build entry for the Worker (changes `vite.config.ts`). Clean but has wider implications.

Recommendation: start with Option A (inline). If QA on real large PDFs shows unacceptable freezes, implement Option C in a follow-up lightweight sprint.

### Risk 3 — `docxEditorProvider` and `pdfEditorProvider` do not currently send `features` to webview

Both providers' `load` message omit `features`. The `App.tsx` `Features` interface only handles the markdown-editor context (populated from `ritemarkEditor.ts`). The DOCX and PDF viewers currently have no mechanism to receive feature flags from the extension host.

This must be resolved in work-block 1b. The load message from each provider must be extended to include `features: { saveAsMarkdownFromPreview: boolean }`. The webview `App.tsx` `onMessage` handler must propagate this to the `DOCXViewer` and `PDFViewer` components via props.

The existing `Features` interface in `App.tsx` covers markdown-editor flags (`voiceDictation`, `markdownExport`). Adding viewer flags here creates slight coupling, but it is the established pattern and the simplest path.

### Risk 4 — `saveAsMarkdown` message route lives in wrong provider

The `saveAsMarkdown` postMessage from DOCXViewer and PDFViewer is handled by `docxEditorProvider.ts` and `pdfEditorProvider.ts`, respectively — **not** `ritemarkEditor.ts`. The analysis doc described routing through `ritemarkEditor.ts`, but that editor only handles `.md` files. The DOCX and PDF viewers are registered under separate `CustomReadonlyEditorProvider` instances. Each provider needs its own `case 'saveAsMarkdown':` handler.

The `saveAsMarkdownHandler()` function in `export/saveAsMarkdown.ts` is shared by all three, but the message wiring must happen in all three providers. The `writeImageRelativeTo()` helper is private to `ritemarkEditor.ts` — it should be moved to a standalone utility (e.g., `extensions/ritemark/src/utils/imageWriter.ts`) so `saveAsMarkdown.ts` can import it without a dependency on `ritemarkEditor.ts`.

This refactor is slightly larger than the analysis doc implied. It is included in work-block 1c/1d above.

### Risk 5 — PDF image extraction complexity

`page.getOperatorList()` + the pdfjs image cache is the canonical way to extract raster images from PDFs in pdfjs-dist. However, the API has changed between pdfjs versions; image extraction is not well-documented and may require significant trial-and-error.

Mitigation: treat PDF image extraction as a stretch goal for v1. If extraction proves fragile during implementation, ship the PDF path without image extraction and add a warning toast "Images in PDFs are not yet extracted — coming soon." This keeps the PDF text conversion shipping on schedule. Mark in sprint notes if deferred.

### Risk 6 — Turndown instance in DOCX viewer

`App.tsx:444` creates a Turndown instance for "Copy as Markdown". That instance is not exported or accessible from `DOCXViewer.tsx`. The DOCX viewer must create its own `TurndownService` instance with the same GFM plugin configuration.

Action: create a shared utility `extensions/ritemark/webview/src/utils/turndownService.ts` that exports a pre-configured singleton (or factory) — both `App.tsx` and `DOCXViewer.tsx` import from it. This avoids configuration drift between the two uses. Add this as an explicit checklist item in work-block 2b.

## Phase Ordering — Confirmation

The proposed phase split (plumbing → DOCX → PDF → polish) is correct and is preserved in the work-blocks above. One reordering vs the brief: `writeImageRelativeTo()` is moved out of `ritemarkEditor.ts` and into a standalone utility module during work-block 1c, because the `saveAsMarkdown.ts` handler (in `export/`) cannot import a private method from `ritemarkEditor.ts`. This is a small additional step but must happen in work-block 1 before work-block 2 writes image-write logic.

## Status

**Track:** Full 6-phase
**Current Phase:** 5 (QA complete, ready for sprint-end)
**Approval Required:** Yes

### Manual QA outcome (2026-05-18)

| Criterion | Result |
|-----------|--------|
| DOCX → Save as Markdown | ✓ verified (after `--image-N` fix in `51c1f67`) |
| PDF → Save as Markdown (text path) | ✓ verified |
| Telemetry `save_as_markdown` event | ✓ verified in PostHog |
| Scanned + multi-column PDF toasts | Intentionally untested — wait for user bug report |
| Feature flag gate via UI | Not testable (flag UI removed project-wide) |
| Toast wording, PDF image extraction, PDF Worker | Shipped narrower than plan; waived above |

## Approval

- [x] Jarmo approved this sprint plan
