# Sprint 124 Tasks

Checklist for [sprint-plan.md](./sprint-plan.md). Tick `[x]` only with a commit
on this branch behind it.

> **Gate:** passed — plan approved 2026-09-23.

## Phase 0: Audit (done)

- [x] Record what the Word viewer, its host, the renderer and the shared bundle do today, what a second bundle touches, and what tooling exists for ground truth, in `research/current-state-audit.md`. *(2026-09-23)*

## Phase 1: Corpus and renderer evidence (R1, R2)

- [x] Fixture generator (existing `docx` package) and the ~10 fixtures from R1, committed with a README of what each one tests. *(11 fixtures; `11` added for 0.4.1's page-break-before fix)*
- [x] Word ground truth: a script re-saves each fixture in Word and exports it to PDF, then converts the PDF to PNG pages (`pdftoppm`). *(01–10 done; 11's Word copy is pending — Word stopped answering scripts after the private-template export was halted)*
- [x] Failure fixtures: renamed non-ZIP, truncated, password-protected, oversized archive. *(f1–f4 committed; f5 (~80 MB) generated with `--large`, not committed)*
- [x] Capture tool: renders each fixture with a webview bundle in headless Chromium and saves one PNG per rendered page (`capture-preview.mjs`); `compare.py` records page counts and a per-page difference and builds side-by-side sheets.
- [x] Baseline 0.3.7 as shipped; then 0.4.1; then `ignoreLastRenderedPageBreak: false` on each; also check host-CSS leakage (R7). Written up in `research/renderer-spike.md` — nine defects found, each with a fix.
- [ ] **Checkpoint:** show Jarmo the sheets and the recommendation; change the dependency only after that.

## Phase 2: Asset boundary (R3)

- [ ] Second Vite build → `media/office-preview.js`, with its own small entry that owns the `load` / `ready` handshake for Word.
- [ ] `DocxEditorProvider` loads it; `DOCXViewer` and its libraries leave `webview.js`.
- [ ] Pre-commit hook (size, raw-Tailwind, freshness, sentinel for the new file); `release-extension.sh` file list; `release-extension-preflight.sh`; `check-bundled-extension-complete.sh`.
- [ ] Shell-tier: `build-prod.sh` and `build-prod-windows.sh` clean-rebuild checks; `stage-extension-for-shell-build.sh` required files.

## Phase 3: Viewer controls (R4)

- [ ] Shared viewer toolbar (shadcn Buttons, tooltips, single-line): page N of M, previous / next, zoom − / + with %, fit width, fit page, Refresh, Open externally, Save as Markdown.
- [ ] Page tracking and fit / zoom over docx-preview's rendered pages.
- [ ] Search: Cmd/Ctrl+F, count, Enter / Shift+Enter, Escape; CSS Custom Highlight API, no DOM rewriting; pure match logic with tests.
- [ ] Open externally always available: Word → Pages → system default.
- [ ] `fileChanged` re-renders and keeps the page; `fileDeleted` shows a notice.
- [ ] The PDF viewer adopts the toolbar: page, zoom, fit, Save as Markdown. Open a follow-up issue for PDF search.

## Phase 4: Safe failure and honest limits (R5, R6)

- [ ] Host pre-check: size cap, ZIP entry count, total uncompressed size and ratio, not-a-ZIP, and password-protected (CFB container) detection; each gets its own message.
- [ ] Render failure: what happened, **Try again**, **Open externally**; no endless loading.
- [ ] Unsupported-content scan (charts, SmartArt, embedded objects, plus what the corpus shows) and a one-line notice.
- [ ] User docs: what the Word preview shows and where it differs from Word.

## Phase 5: RunDev validation (R1–R7)

- [ ] Run the corpus in a dev build: page counts, sheets, and difference scores for the chosen renderer versus the baseline, recorded in `qa-evidence.md`.
- [ ] Every control, keyboard path and failure fixture driven live.
- [ ] Open time and memory for small and 50-page documents; no regression in the Markdown, PDF, spreadsheet, transcription and AI views.

## Phase 6: QA and closeout

- [ ] `npm test` and `./scripts/validate-qa.sh`, results recorded.
- [ ] `docs/CHANGELOG.md`, `docs/releases/v1.12.0/release-notes.md`, and the v1.12.0 test checklist (with the Windows three-fixture line).
- [ ] `docs/development/architecture.md`: the Office-preview bundle and the Word viewer.
- [ ] Follow-up issues: LibreOffice research, PDF search.
- [ ] Release-plan tracker row, PR, and close [#284](https://github.com/ProductoryHQ/ritemark-native/issues/284).
