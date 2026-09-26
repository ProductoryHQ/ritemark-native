# Sprint 125 Tasks

Checklist for [sprint-plan.md](./sprint-plan.md). Tick `[x]` only with a commit
on this branch behind it.

> **Gate:** passed — plan approved 2026-09-24.

## Phase 0: Audit and renderer spike (done)

- [x] Record what a `.pptx` does today, what Sprint 124 left to reuse, the host check's declared-size gap, the Windows app check, licences and ground-truth tooling, in `research/current-state-audit.md`. *(2026-09-24)*
- [x] Renderer spike: `@aiden0z/pptx-renderer` 1.3.0 against `pptx-preview` 1.0.7, measured against PowerPoint 16.113 on nine decks and five failure fixtures, in `research/renderer-spike.md` with its results in `research/spike-results/`. *(2026-09-24)*

## Phase 1: Corpus and ground truth (R1)

- [x] `research/corpus/`: the generator (`gen-fixtures.py`, `gen-heavy.py`), the nine decks and the 40-photo deck (generated, not committed), with a README of what each one tests.
- [x] PowerPoint ground truth: re-saved decks and PDFs (`ppt-ground-truth.sh`), PNG pages via `pdftoppm`.
- [x] Failure fixtures: not a ZIP, truncated, password-protected, bomb, lying bomb; and a lying bomb as `.docx` (`f6`).
- [x] A capture tool for the Office bundle's PowerPoint path (`capture-preview.mjs`); `compare.py` reused for scores and sheets.

## Phase 2: Safe failure (R5)

- [x] `officePackageCheck.ts`: inflate each part in the host capped at its declared size + 1 byte (`verifyDeclaredSizes`); refuse a part that yields more or less. Tests against both lying bombs.
- [x] PowerPoint's kinds in the check and its messages: password-protected, legacy format, not a PowerPoint file, damaged, too large, too complex.
- [x] Prove the Word case: `main`'s check passes `f6`, and the Word webview then inflates it (106 → 759 MB) and shows JSZip's text; now it is refused before the webview sees it.

## Phase 3: Provider, bundle and flag (R3, R7)

- [x] One provider for both formats instead of a second copy: `officePreview/officePreviewProvider.ts` (`WORD_FORMAT`, `POWERPOINT_FORMAT`; moved from `docxEditorProvider.ts` / `docxDocument.ts`), `ritemark.pptxViewer` registered in `extension.ts` and `package.json`.
- [x] `powerpoint-preview` flag (experimental, default on, setting `ritemark.features.powerpoint-preview`) and the off state with **Open in PowerPoint**.
- [x] External app: PowerPoint → Keynote (Mac) → default; a `powerpnt.exe` check on Windows.
- [x] `OfficePreviewApp` gains the `pptx` branch; the renderer and ECharts join `office-preview.js` (1.32 → 2.47 MB).
- [x] Links: web links go through the host (`openLink` → `vscode.env.openExternal`); other schemes do nothing; nothing is fetched.
- [x] Third-party notices next to the bundle: `media/office-preview.NOTICES.txt`, written at build time from the packages the bundle contains; in the extension-update file list and the bundled-extension check.

## Phase 4: Renderer fixes and viewer (R2, R4)

- [x] Chart XML pre-pass (`varyColors`, empty title at PowerPoint's 14 pt bold) with tests.
- [x] Fonts: Office aliases on slides, a sans fallback for missing families (`installFontFallbacks`), a pinned slide font and line height.
- [x] Chart animation off (`registerPreprocessor`).
- [x] `PPTXViewer`: stacked slides, *Slide N of M*, zoom menu with **Fit slide**, find bar over slide text and notes, **Open in PowerPoint**.
- [x] Speaker notes under each slide, and in search.
- [x] Only slides within 1.5 viewports are drawn, for every deck (see the sprint plan's decision of 2026-09-25).
- [x] `fileChanged` re-renders on the same slide; `fileDeleted` shows the notice.

## Phase 5: Honest limits (R6)

- [x] Unsupported-content scan (audio, video, embedded objects) and a one-line notice.
- [x] User docs: the PowerPoint preview in `docs/user/features/previews.md`.

## Phase 6: RunDev validation (R1–R8)

- [x] The corpus in a dev build: slide counts, sheets and scores recorded in `qa-evidence.md`.
- [x] Every control, keyboard path, link and failure fixture driven live, in the light and dark themes and a narrow pane.
- [x] Open time and memory for 5, 40 and 40-photo decks; no regression in the Word, PDF and Markdown views.
- [x] A deck styled by PowerPoint with its Berlin theme (`ppt-themed.sh` → `ppt/11-powerpoint-themed.pptx`; Jarmo has no deck of his own). Diff 1.02, the closest in the corpus.

## Phase 7: QA and closeout

- [x] `npm test` and `./scripts/validate-qa.sh`, results recorded.
- [x] `docs/CHANGELOG.md`, `docs/releases/v1.12.0/release-notes.md`, and the v1.12.0 test checklist (with a Windows line).
- [x] `docs/development/architecture.md`: the PowerPoint path through the Office bundle; `CLAUDE.md`'s layout map.
- [x] QA review finding: personal metadata in saved Office files scrubbed (`scrub-metadata.py`) — this sprint's PowerPoint copies, Sprint 124's Word copies and Sprint 81's test workbook; the ground-truth scripts scrub from now on.
- [x] ~~Upstream issues for the renderer defects we accept.~~ *(Drafted in `research/upstream-report.md`. Decided 2026-09-25: not posted. Jarmo: "upstream'i ära postita". The draft stays as a record of the accepted defects.)*
- [x] Release-plan tracker row, PR [#350](https://github.com/ProductoryHQ/ritemark-native/pull/350); [#285](https://github.com/ProductoryHQ/ritemark-native/issues/285) closes with the merge.
