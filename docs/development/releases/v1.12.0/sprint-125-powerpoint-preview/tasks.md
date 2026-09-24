# Sprint 125 Tasks

Checklist for [sprint-plan.md](./sprint-plan.md). Tick `[x]` only with a commit
on this branch behind it.

> **Gate:** closed — waiting for Jarmo's approval of the plan.

## Phase 0: Audit and renderer spike (done)

- [x] Record what a `.pptx` does today, what Sprint 124 left to reuse, the host check's declared-size gap, the Windows app check, licences and ground-truth tooling, in `research/current-state-audit.md`. *(2026-09-24)*
- [x] Renderer spike: `@aiden0z/pptx-renderer` 1.3.0 against `pptx-preview` 1.0.7, measured against PowerPoint 16.113 on nine decks and five failure fixtures, in `research/renderer-spike.md` with its results in `research/spike-results/`. *(2026-09-24)*

## Phase 1: Corpus and ground truth (R1)

- [ ] `research/corpus/`: the generator (`gen-fixtures.py`, `gen-heavy.py`), the nine decks and the 40-photo deck, with a README of what each one tests.
- [ ] PowerPoint ground truth: re-saved decks and PDFs (`ppt-ground-truth.sh`), PNG pages via `pdftoppm`.
- [ ] Failure fixtures: not a ZIP, truncated, password-protected, bomb, lying bomb; and a lying bomb as `.docx`.
- [ ] A capture tool for the Office bundle's PowerPoint path; `compare.py` reused for scores and sheets.

## Phase 2: Safe failure (R5)

- [ ] `officePackageCheck.ts`: inflate each part in the host with `maxOutputLength` and a running total; refuse a part that lies about its size. Tests against both lying bombs.
- [ ] PowerPoint's kinds in the check and its messages: password-protected, legacy `.ppt`, not a PowerPoint file, damaged, too large, too complex.
- [ ] Prove the Word case: the `.docx` lying bomb is refused before the webview sees it.

## Phase 3: Provider, bundle and flag (R3, R7)

- [ ] `pptxEditorProvider.ts` (read-only, default for `*.pptx`), registered in `extension.ts` and `package.json`.
- [ ] `powerpoint-preview` flag (experimental, default on) and the off state with **Open in PowerPoint**.
- [ ] External app: PowerPoint → Keynote (Mac) → default; a `powerpnt.exe` check on Windows.
- [ ] `OfficePreviewApp` gains the `pptx` branch; the renderer and ECharts join `office-preview.js`.
- [ ] Links: web links go through the host; other schemes do nothing; nothing is fetched.
- [ ] Third-party notices file next to the bundle.

## Phase 4: Renderer fixes and viewer (R2, R4)

- [ ] Chart XML pre-pass (`varyColors`, empty title) with tests.
- [ ] Fonts: Office aliases on slides, a sans fallback for missing families, a pinned container font and line height.
- [ ] Chart animation off.
- [ ] `PPTXViewer`: stacked slides, *Slide N of M*, zoom menu with **Fit slide**, find bar over slide text, **Open in PowerPoint**.
- [ ] Speaker notes, as decided.
- [ ] Windowing above a measured slide count.
- [ ] `fileChanged` re-renders on the same slide; `fileDeleted` shows the notice.

## Phase 5: Honest limits (R6)

- [ ] Unsupported-content scan (audio, video, embedded objects, whatever the corpus shows) and a one-line notice.
- [ ] User docs: the PowerPoint preview in `docs/user/features/previews.md`.

## Phase 6: RunDev validation (R1–R8)

- [ ] The corpus in a dev build: slide counts, sheets and scores recorded in `qa-evidence.md`.
- [ ] Every control, keyboard path, link and failure fixture driven live, in the light and dark themes and a narrow pane.
- [ ] Open time and memory for 5, 40 and 40-photo decks; no regression in the Word, PDF and Markdown views.
- [ ] Jarmo's own deck, checked locally only.

## Phase 7: QA and closeout

- [ ] `npm test` and `./scripts/validate-qa.sh`, results recorded.
- [ ] `docs/CHANGELOG.md`, `docs/releases/v1.12.0/release-notes.md`, and the v1.12.0 test checklist (with a Windows line).
- [ ] `docs/development/architecture.md`: the PowerPoint path through the Office bundle.
- [ ] Upstream issues for the renderer defects we accept.
- [ ] Release-plan tracker row, PR; close [#285](https://github.com/ProductoryHQ/ritemark-native/issues/285).
