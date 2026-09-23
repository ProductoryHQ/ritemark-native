# Sprint 124: Word preview fidelity

Track: Full, audit-first — requirements R1–R7 below are the contract; the renderer
change has its own evidence checkpoint<br>
Release tier: **shell** — the asset boundary adds a second webview bundle that
`build-prod.sh` and the shell staging scripts must know (Phase 0 §6)

**Status:** Planning — waiting for Jarmo's approval. No code before it.<br>
**Branch:** `sprint-124-word-preview-fidelity`<br>
**Issue:** [#284](https://github.com/ProductoryHQ/ritemark-native/issues/284)<br>
**Worktree:** `.claude/worktrees/sprint-124-word-preview-fidelity`, branched from main `4070ffc6`<br>
**Release:** [v1.12.0](../release-plan.md) · analysis: [Office preview](../research/office-preview-analysis.md)

## Goal

A Word document opens as a set of pages you can move through, zoom, fit and
search, drawn as close to Word as a browser can manage. It says plainly what it
cannot show, and it always offers a way to open the document elsewhere.

## Phase 0 — done

[research/current-state-audit.md](./research/current-state-audit.md). In short:

- The viewer has no page position, zoom, fit or search. **Open in Word** is hidden
  when Word is missing, so a Mac without Word has no way out. External edits and
  deletions are ignored.
- **Page breaking is not pagination.** `docx-preview` starts a page only at manual
  breaks, section changes and — if we turn it on — the page markers Word saves.
  Today that is off, so most documents render as one tall page. Turned on, a
  document Word saved gets pages close to Word's. Documents from other tools keep
  long pages; fixing that means re-implementing Word's layout, which is out of
  scope.
- The Word code is only ~0.55 MB of the 8.9 MB shared bundle. The boundary's real
  gain: a Word tab loads ~1 MB instead of 8.9 MB, and Sprint 125 gets a home for
  its renderer. Mermaid is ~47 % of the bundle; that is
  [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107)'s work, not
  this sprint's.
- Word is installed here and can produce the ground truth. The extension's
  existing `docx` package can generate the fixtures, so the corpus needs **no new
  dependency**.

## Requirements

### R1: A corpus with Word ground truth

- About ten generated fixtures (script committed, `.docx` committed), each
  targeting one area:
  - headings and styles
  - multi-level lists
  - tables (merged cells, shading)
  - inline and floating images
  - headers and footers (different first page, page numbers)
  - footnotes and endnotes
  - a portrait → landscape section
  - fonts (common and embedded)
  - a long document (50+ pages)
  - a document with content the preview cannot draw (an equation, a chart)
- Each fixture in two forms: **as generated** (no Word page markers) and
  **re-saved by Word** (with them).
- Word exports each to PDF, which becomes PNG pages.
- The comparison records the page count and a per-page difference score, plus a
  side-by-side sheet a person can judge.
- Failure fixtures: a renamed non-ZIP file, a truncated file, a password-protected
  document, and an oversized archive.

### R2: The renderer, chosen on evidence

- Measure today's setup (0.3.7, markers ignored) against 0.4.1 with Word's page
  markers honoured, and each option on its own.
- Adopt a change only if the corpus is equal or better everywhere that matters
  and nothing regresses.
- **Checkpoint:** Jarmo sees the side-by-side and the recommendation before the
  dependency changes.

### R3: The Word preview gets its own bundle

- A second build produces `media/office-preview.js`. The Word provider loads it.
  `docx-preview`, Mammoth and `jszip` leave `webview.js`.
- The pre-commit hook, the extension-update file list, the preflight and
  bundled-extension checks, and `build-prod.sh` / `build-prod-windows.sh` /
  `stage-extension-for-shell-build.sh` all know the new file.
- Sprint 125 reuses this boundary.

### R4: Viewer controls

One toolbar, with shadcn Buttons, a tooltip on each, and single-line labels:

- **page N of M** with previous / next;
- **zoom** out / in with the percentage, plus **fit width** and **fit page**;
- **search**: Cmd/Ctrl+F, a count, Enter / Shift+Enter, Escape. Matches are
  highlighted without rewriting the document's DOM (CSS highlights);
- **Refresh**;
- **Open externally**, always present: Word if installed, else Pages on macOS,
  else the system default;
- **Save as Markdown**, unchanged.

The document also follows external edits (re-render, keeping the page) and
deletion (a clear notice).

### R5: Safe failure

The host checks size and the ZIP's directory before sending anything. Too large,
too many entries, an implausible compression ratio, not a Word file, or
password-protected each gets its own plain message with **Open externally**. A
render failure says what happened and offers **Try again** and **Open
externally**. Nothing hangs on a loading screen.

### R6: Honest limits

If the document contains things the preview cannot draw (charts, SmartArt,
embedded objects and whatever the corpus shows missing), a one-line notice says
so and points to Open externally. The known limits — pagination, fonts, the rest
— are written up in the user docs. Nothing in the UI claims Word-identical pages.

### R7: Isolation and cost

The rendered document is not restyled by the webview's own CSS; if the corpus
shows leakage, it renders into a shadow root. Open time and memory are measured
for a small and a 50-page document. The Markdown editor, PDF, spreadsheet,
transcription and AI views work as before, and `webview.js` no longer contains the
Word renderer.

## Proposed: the PDF viewer adopts the same toolbar

The PDF viewer has only page and zoom, with the same hand-rolled buttons. It would
take the shared toolbar with the controls it can support now — page, zoom, fit
and Save as Markdown — so both previews look and behave alike. **PDF search** is a
separate follow-up issue.

## Out of scope

- Editing DOCX; legacy `.doc` (the existing message stays).
- Computing page breaks ourselves (re-implementing Word's layout).
- LibreOffice conversion. It is not installed here, and Word is the ground truth.
  The research item from #284 moves to a follow-up issue.
- Cloud conversion; bundling or requiring any office suite.
- Lazy-loading Mermaid and the rest of #107.
- Windows golden screenshots. There is no Windows machine here; the Windows gate
  gets a checklist line with three fixtures instead.

## Definition of Done

- [ ] The corpus, its generator and the Word ground truth are committed, with the comparison results.
- [ ] The renderer decision is recorded with evidence and was shown to Jarmo before the dependency changed.
- [ ] Ordinary Word-saved documents show stable page boundaries, fonts, images, tables, lists, headers and footers within the documented limits.
- [ ] The toolbar gives page position, zoom, fit width / fit page, search, refresh, Open externally and Save as Markdown, with a tooltip on every button.
- [ ] External edits re-render; deletion shows a notice.
- [ ] Each failure fixture ends in a specific message with a way out; nothing hangs.
- [ ] Content the preview cannot draw is announced; limits are documented.
- [ ] The Word renderer is absent from `webview.js`; a Word tab loads `office-preview.js`; the release tooling ships and checks both.
- [ ] Other webviews show no regression; open time and memory are recorded.
- [ ] `npm test`, `./scripts/validate-qa.sh`, and RunDev validation of the corpus in a dev build pass.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-23 | Spike 0.4.1, not 0.4.0 | 0.4.1 adds only a page-break fix on top of 0.4.0; both are Apache-2.0 |
| 2026-09-23 | Generate the corpus with the existing `docx` package; Word supplies the ground truth | No new dependency; Word is installed here, LibreOffice is not |

## Planning Approval

- [ ] Jarmo approves this sprint plan.
- [x] GitHub issue exists. ([#284](https://github.com/ProductoryHQ/ritemark-native/issues/284))
- [x] Worktree and branch created. (`sprint-124-word-preview-fidelity`, from main `4070ffc6`)
