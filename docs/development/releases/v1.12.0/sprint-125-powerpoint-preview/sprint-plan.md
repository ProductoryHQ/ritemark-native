# Sprint 125: PowerPoint preview

Track: Full, audit-first — requirements R1–R8 below are the contract; the renderer
was chosen by a spike before planning, and this plan's approval is its checkpoint<br>
Release tier: **extension** — PowerPoint joins the Office bundle Sprint 124 built
(`media/office-preview.js`), which every release script already knows; no
shell-tier path changes (v1.12.0 is a full-app release regardless)

**Status:** In review — implemented and RunDev-validated 2026-09-25.<br>
**Branch:** `sprint-125-powerpoint-preview`<br>
**Issue:** [#285](https://github.com/ProductoryHQ/ritemark-native/issues/285)<br>
**Worktree:** `.claude/worktrees/sprint-125-powerpoint-preview`, branched from main `9940d086`<br>
**Release:** [v1.12.0](../release-plan.md) · analysis: [Office preview](../research/office-preview-analysis.md)

## Goal

A PowerPoint deck opens in Ritemark as its slides, drawn on the user's computer,
read-only and close to PowerPoint. It says plainly what it cannot show, and it
always offers a way to open the deck in PowerPoint.

## Phase 0 — done

[research/current-state-audit.md](./research/current-state-audit.md) and
[research/renderer-spike.md](./research/renderer-spike.md). In short:

- **Today a `.pptx` is unusable:** VS Code's text editor refuses it as binary, and
  **Open Anyway** shows raw bytes. Nothing offers PowerPoint.
- **Sprint 124 built most of what this needs:** the Office bundle, the read-only
  provider pattern, the toolbar, the find bar and document search, zoom and fit, and
  the Office font aliases. PowerPoint is mostly a new branch through them.
- **Renderer: `@aiden0z/pptx-renderer` 1.3.0, pinned.** Measured against
  PowerPoint 16.113 on nine decks:
  - text, bullets, tables, pictures, shapes, groups, layouts and backgrounds come
    close to PowerPoint; most visible differences are fonts;
  - charts are drawn but approximate. Two defects mislead: a multi-series chart
    PowerPoint has saved is coloured by category, not by series, and a chart's
    automatic title is missing. A small XML pass before rendering fixes both;
  - a 40-slide deck renders in 124 ms with a 6 MB heap;
  - no eval, workers, WASM or network; it runs under the Word preview's CSP.

  `pptx-preview` is rejected: its charts are empty, it loses table styles, bullets
  and every font, it keeps 1 GB after a bomb, and its source is closed.
- **The ZIP check needs a real inflate.** The renderer's ZIP limits are off by
  default, and a file that lies about its sizes gets past them *and* past Sprint
  124's host check, which reads only declared sizes. The same very likely holds for
  Word files. A bounded inflate in the host closes it for both.
- **Two gaps outside the renderer:** on Windows, `isAppInstalled` answers `true` for
  any app but Excel and Word, so the button would say "Open in PowerPoint" without
  PowerPoint; and the extension ships no third-party notices file, which ECharts'
  Apache-2.0 NOTICE and the MPL-2.0 font decompressor inside the renderer require.

## Requirements

### R1: A corpus with PowerPoint ground truth

- The spike's generator (`python-pptx`, a research script only) and its nine decks,
  committed with a README of what each one tests:
  - title and bullets
  - tables
  - images and crops
  - shapes and groups
  - charts
  - fonts
  - speaker notes
  - a 40-slide deck
  - layouts and backgrounds
- Each deck in two forms: **as generated** and **re-saved by PowerPoint**, with
  PowerPoint's PDF export as ground truth.
- The comparison records the slide count and a per-slide difference score, plus a
  side-by-side sheet a person can judge. Sprint 124's `compare.py` is reused.
- Failure fixtures: not a ZIP, truncated, password-protected, a decompression bomb,
  and a bomb that lies about its size — plus the same lying bomb as a `.docx`.

### R2: The renderer, with its known fixes

- `@aiden0z/pptx-renderer` 1.3.0, pinned, called with `pdfjs: false`, ZIP limits
  on, an `AbortSignal` when the tab closes mid-load, and `destroy()` on dispose.
- A pure, tested XML pass before rendering:
  - `varyColors` off on bar, line and area charts with more than one series;
  - the series name written into an empty chart title.
- Fonts:
  - Sprint 124's Office aliases (88 %) apply to slides as well;
  - a family installed nowhere gets a sans fallback instead of Times;
  - the slide container pins its font and line height, so the webview's own CSS
    does not leak in.
- Chart animation is off, so charts do not replay on every scroll.

### R3: A PowerPoint tab in the Office bundle

- `ritemark.pptxViewer`, a read-only custom editor for `*.pptx`, the default for
  that pattern, built like the Word provider. It loads `office-preview.js`, which
  gains a `pptx` branch.
- A `powerpoint-preview` feature flag, on by default (experimental), as a real kill
  switch. When it is off, the tab says the preview is turned off and offers **Open
  in PowerPoint**.
- A third-party notices file ships next to the bundle: ECharts' NOTICE,
  `mtx-decompressor`'s MPL-2.0 notice and source link, and the rest of the new
  dependencies.

### R4: Viewer — the Sprint 124 toolbar

- *Slide 3 of 24*, − [Fit width ▾] +, the magnifier and **Open in PowerPoint**.
  - The zoom menu says **Fit slide** instead of **Fit page**.
  - PowerPoint, else Keynote on a Mac, else the system default. On Windows the
    PowerPoint check is real.
- The slides stack vertically and scroll, like the pages of a Word document.
- The deck follows edits saved in another app, keeping the slide; a deleted or moved
  file shows the same notice as Word.
- Search (Cmd/Ctrl+F or the magnifier) opens the shared find bar over slide text.
- Speaker notes: see decision 2 below.
- A large deck does not put every slide in the DOM at once. Slides render eagerly up
  to a threshold set by measurement; above it, only those near the view.

### R5: Safe failure

- The host check first **inflates each part itself** with a size cap and a running
  total. A part that lies about its size is refused before any byte reaches the
  webview. This hardening covers Word files as well.
- Too large, password-protected, an old `.ppt`, not a PowerPoint file, damaged, or
  too complex each get their own plain message, with **Try again** and **Open in
  PowerPoint**. The renderer's or JSZip's own text is never shown.

### R6: Honest limits

- A one-line notice when a deck holds what the preview does not draw: audio and
  video, embedded objects, and whatever the corpus shows missing.
- The user docs say what differs from PowerPoint: fonts, approximate charts, no
  animations or transitions.

### R7: Links

- A link on a slide opens only through the host. A web link opens in the browser
  the way any link in Ritemark does. Other schemes do nothing.
- Nothing is fetched on the deck's behalf: no linked media and no remote images.

### R8: Isolation and cost

- Open time and memory are measured in a dev build for a 5-slide deck, the 40-slide
  deck and a 40-photo deck.
- The Word, PDF and Markdown previews work as before. `webview.js` does not change.
- `office-preview.js` grows by about 1.1 MB (ECharts is most of it); the new size is
  recorded.

## Decisions for Jarmo

1. **Scrolling slides instead of a thumbnail strip.** Issue #285 lists thumbnails
   and previous / next. After the Word toolbar review, the proposal is to treat a
   deck like a document someone sent. The slides scroll, *Slide 3 of 24* shows
   where you are, and there is no thumbnail rail and no arrows. A thumbnail rail can
   follow if you miss it.
2. **Speaker notes.** Neither library reads them. They take a small reader of our
   own. The proposal: show each slide's notes under it, in quiet text, and include
   them in search. A deck without notes looks the same as without the feature.
3. **One Office bundle.** PowerPoint joins `office-preview.js`, so a Word tab also
   loads ECharts, about 2.4 MB instead of 1.3 MB. That is still a third of the
   editor bundle, and it needs no new release tooling. A separate bundle is possible
   but means another round of shell-tier script changes.
4. **A real deck.** A PowerPoint file of yours, checked locally only and never in the
   repository, as with the Word template.

## Out of scope

- Editing; legacy `.ppt` (a plain message, as for `.doc`).
- Save as Markdown for decks.
- Playing animations, transitions, audio or video; slideshow mode.
- Fixing the renderer's approximate chart details (pie label formats, legend
  overlap, axis scale), text inside non-rectangular shapes, and hyperlink colour.
  These are not patched here. An upstream report was drafted
  (`research/upstream-report.md`), but on 2026-09-25 Jarmo decided not to post it.
- LibreOffice or cloud conversion.
- Windows golden screenshots. The Windows gate gets a checklist line.

## Definition of Done

- [x] The corpus, its generator, PowerPoint's ground truth and the comparison results are committed.
- [x] The chart pre-pass and font handling are in, with tests; the spike's defects 1, 2, 7, 8, 9 and 13 are fixed or shown absent in the dev build.
- [x] A `.pptx` opens in its own read-only tab from `office-preview.js`, behind a default-on `powerpoint-preview` flag with a truthful off state.
- [x] The toolbar gives slide position, zoom and fit, search and Open in PowerPoint, with a tooltip on every button, one line in a narrow pane.
- [x] External edits re-render on the same slide; deletion shows a notice.
- [x] Every failure fixture, the lying bomb included, ends in a specific message before the webview sees the bytes, for `.pptx` and `.docx`.
- [x] Unsupported content is announced; links open only through the host; limits are documented.
- [x] Third-party notices ship with the bundle.
- [x] Open time and memory are recorded; Word, PDF and Markdown show no regression.
- [x] `npm test`, `./scripts/validate-qa.sh`, and RunDev validation of the corpus in a dev build pass.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-24 | Sprint 125 follows Sprint 124 directly, and the renderer spike ran alongside it | Jarmo: "jah, järjest" (recorded in Sprint 124) |
| 2026-09-24 | Candidate is `@aiden0z/pptx-renderer` 1.3.0, not the 1.2.4 the release plan named on 2026-09-13; 1.3.0 is the current release and is what the spike measured | Spike |
| 2026-09-24 | The corpus generator stays Python (`python-pptx`), as a research script only | No maintained PPTX writer for Node; nothing ships |
| 2026-09-24 | Decisions 1–3 accepted as proposed: slides scroll with *Slide N of M* and no thumbnail rail or arrows; speaker notes under each slide and in search; PowerPoint joins `office-preview.js` | Jarmo: "yldiselt sobib" |
| 2026-09-24 | No real deck is available (decision 4). In its place, a deck authored in PowerPoint itself from one of its built-in design themes joins the corpus, so at least one fixture is PowerPoint-made rather than generated | Jarmo: "mul endal PPTd pole" |
| 2026-09-25 | One Office preview provider for Word and PowerPoint (`officePreview/officePreviewProvider.ts`), configured per format, instead of a copy of the Word provider | The two differ only in view type, part folder, wording, apps and flag; one copy keeps the pre-check, file watching and CSP in one place |
| 2026-09-25 | Every deck draws only the slides within 1.5 viewports, not "all up to a measured count" (R4) | A 5-slide deck is drawn whole anyway; one path, and the chart canvases of a long deck never all exist at once (a 40-slide deck: at most 5–8 drawn) |
| 2026-09-25 | Search counts matches in the deck's own text and highlights the words in the slides that are drawn | Slides far from the view are not drawn, so the drawn text cannot be counted; master and layout text (repeated footers) is left out of both |

## Planning Approval

- [x] Jarmo approves this sprint plan and decisions 1–4. *("yldiselt sobib. mul endal PPTd pole", 2026-09-24)*
- [x] GitHub issue exists. ([#285](https://github.com/ProductoryHQ/ritemark-native/issues/285))
- [x] Worktree and branch created. (`sprint-125-powerpoint-preview`, from main `9940d086`)
