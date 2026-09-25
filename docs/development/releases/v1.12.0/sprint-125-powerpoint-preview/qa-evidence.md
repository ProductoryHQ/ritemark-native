# Sprint 125 QA evidence

2026-09-24/25. A dev build from this worktree (`sprint-125-powerpoint-preview`,
CoW-cloned VS Code shell, clean profile) on macOS with Microsoft PowerPoint 16.113
installed. Readings come from the running webviews' DOM, driven over CDP with real
clicks and keys. The corpus is in [research/corpus/](./research/corpus/README.md).
Jarmo has no deck of his own; `ppt/11-powerpoint-themed.pptx` stands in — a corpus
deck PowerPoint itself restyled with its Berlin design theme and saved.

## Slides against PowerPoint (the shipped `office-preview.js`)

Measured with `research/corpus/capture-preview.mjs` (the real bundle in headless
Chromium, VS Code's webview image defaults included) and `compare.py`. Lower is
closer; `spike` is the bare renderer as the spike ran it. Full tables:
`research/corpus/results/compare-sprint125-*.json`.

| Deck | Slides (PowerPoint = preview) | spike diff | preview diff | preview d640 |
|---|---:|---:|---:|---:|
| 01 title + bullets | 5 | 2.72 | 3.11 | 4.37 |
| 02 tables | 2 | 1.61 | **1.42** | 2.04 |
| 03 images | 3 | 1.36 | **1.25** | 1.77 |
| 04 shapes + groups | 3 | 1.48 | **1.32** | 1.88 |
| 05 charts | 3 | 4.92 | **4.72** | 5.31 |
| 06 fonts | 2 | 3.74 | **3.55** | 5.95 |
| 07 notes | 3 | 1.35 | **1.14** | 1.92 |
| 08 forty slides | 40 | 1.13 | 1.22 | 1.67 |
| 09 layouts + backgrounds | 4 | 1.71 | **1.58** | 2.01 |
| 11 PowerPoint's Berlin theme | 5 | — | **1.02** | 1.42 |

PowerPoint-saved forms; the generated forms score the same except 05 (spike 4.55,
preview 4.72: the automatic titles move the pies down). 01 and 08 are mostly Calibri
body text, now drawn in the 88 % Arial alias where the spike fell back to the system
font; the sheets show the alias wrapping lines as PowerPoint does (01's subtitle
stays on one line) — the score moves with where each line sits, not with a worse
slide.

Seen on the sheets (`results/sheet-sprint125-*.jpg`):
- **Defect 1 fixed:** 05's clustered column and bar charts are coloured by series, as
  their legends say and as PowerPoint draws them.
- **Defect 2 fixed:** the pie and doughnut carry PowerPoint's automatic title,
  "Revenue mix", at its size.
- **Defect 8 fixed:** "Ritemark Nowhere Sans" (installed nowhere) is drawn in a sans
  font, not Times.
- **Defect 9:** each slide pins `line-height: normal` and the deck's body font, so
  the webview's own font and line height no longer reach unstyled elements. Under
  the real bundle's Tailwind preflight 01 scores 3.11; the spike measured the bare
  renderer under the same preflight at 3.27. The Arial alias also changed between the
  two, so the gain is not the leak's alone.
- **Defect 13:** chart animation is off. The captures, taken about 0.2 s after a
  slide is drawn, show every bar and slice complete; the spike's charts took 1 s to
  grow in.
- Accepted as documented: pie labels as 0.46, a legend crowding axis labels, text
  clipped in a triangle and a chevron.

## Driven in the dev build

| Check | Result |
|---|---|
| `.pptx` tab | opens in the PowerPoint preview from `office-preview.js`; *Slide 1 of 5*, **Open in PowerPoint** |
| Notes (07) | three notes blocks, one under each slide, in quiet text |
| Search "notes" (07) | 9 matches counted, 9 highlighted: slide 1's title, its bullet, its notes, then slide 2…; Enter walks them in that order and *Slide N of 3* follows; Escape closes and clears |
| Zoom menu | Fit width, **Fit slide**, 50–200 %; ↓ ↓ Enter from the keyboard picks Fit slide and the whole slide fits the pane |
| A link on a slide (09, slide 3) | VS Code's prompt: "Do you want Ritemark Dev to open the external website? https://example.com/" — cancelled; the preview itself does not navigate |
| External edit (40-slide deck, read on slide 12, file replaced) | redrawn, still on *Slide 12 of 40* |
| File deleted | "This file was deleted or moved. You are looking at the last version Ritemark read." |
| Kill switch (`ritemark.features.powerpoint-preview: false`) | "The PowerPoint preview is turned off — Open it in Microsoft PowerPoint to see it.", **Try again**, **Open in PowerPoint** |
| Dark theme | toolbar, surround and notes dark and readable (notes #CBD5E1 on #0F172A); slides keep their own white |
| Narrow editor (480 px) | *1 / 3*, icon-only buttons, one 40 px line |
| Word, PDF, Markdown | *Page 1 of 4* / *Page 1 of 29* / the editor, as before |

## Failure fixtures

Renderer memory is the largest renderer process's RSS while the tab opens.

| Fixture | Message | Renderer memory |
|---|---|---|
| f1 not a ZIP | "This file isn't a presentation" | flat |
| f2 truncated | "This presentation looks damaged" | flat |
| f3 bomb (512 MiB) | "…too complex to preview safely. It unpacks to 504 MB or more." | flat |
| f4 bomb that lies about its size | "This presentation looks damaged" | 316 → 322 MB |
| f5 password | "This presentation is password-protected" | flat |
| f6 Word bomb that lies about its size | "This Word document looks damaged" | 322 → 327 MB |

Every refusal offers **Try again** and **Open in PowerPoint** (Word: **Open in Word**).

**The Word case, before this sprint.** Sprint 124's check (as on `main`) returned
`{"ok":true}` for f6. Opened in a dev build of `main`'s code, the Word webview went
from 106 MB to 759 MB inflating it and then showed JSZip's own text: *"Ritemark
couldn't draw this document — Bug : uncompressed data size mismatch"*. With the
capped inflate in the host it is refused before the webview receives a byte.

## Cost

| Deck | Open → first slide (dev build, incl. the `code` CLI) | JS heap | Slides drawn at once |
|---|---:|---:|---:|
| 01 (5 slides) | 0.71 s | 13 MB | 5 of 5 |
| 08 (40 slides, 7 charts) | 0.73 s | 21 MB | at most 5–8 of 40 |
| 10 (40 full-HD photos, 8 MB) | 1.05 s | 91 MB on open, 32 MB after scrolling end to end | at most 8 of 40 |

In headless Chromium the first slide is drawn 60–130 ms after the bytes arrive.
`office-preview.js` grows from 1.32 MB to 2.47 MB (746 KB gzipped); `webview.js` is
unchanged but for 193 bytes of toolbar options the PDF viewer shares.

## Found while driving it, and fixed

| Found | Fix |
|---|---|
| The automatic chart title was drawn tiny | the size goes on the paragraph's defaults; given on the run, the renderer drew it far smaller |
| The kill switch read "The presentation preview is turned off" | "The PowerPoint preview is turned off" |
| A `.ppt` branch in the viewer could never run (only `*.pptx` opens it) | removed |
| **QA review:** Word and PowerPoint write the saving user's name into a file they save (`cp:lastModifiedBy`), and the repository is public-facing. The PowerPoint-saved decks carried it — and so did Sprint 124's Word-saved corpus, already on `main`, and Sprint 81's test workbook | `research/corpus/scrub-metadata.py` rewrites only `docProps/core.xml` ("Ritemark corpus"); run on all 22 files, and the ground-truth scripts now run it on what PowerPoint saves. `f6` was regenerated from the scrubbed Word file so its lie survives. Scores unchanged (11: 1.02). Git history still holds the earlier copies |

## Automated

| Suite | Result |
|---|---|
| `officePackageCheck.test.ts` | pass — both corpora; both lying bombs refused in milliseconds; parts that declare more, encrypted entries, other methods, a bad local header |
| `pptxXml.test.ts` | pass — chart fixes on PowerPoint's own chart XML (idempotent), notes, fonts, part paths, unsupported content |
| `deckSearch.test.ts` | pass — master/layout text left out, paragraphs as blocks, order, the starting match |
| webview and extension `tsc --noEmit` | clean |
| `npm test` (full) | pass (exit 0) |
| `./scripts/validate-qa.sh` | pass (exit 0) |

## Not checked here

- **Windows.** The `powerpnt.exe` check is new and not exercised; the Windows gate has
  a checklist line.
- **Keynote and the default app.** PowerPoint is installed here.
- **A real-world deck.** Jarmo has none; the themed deck stands in.
- **SmartArt, equations, embedded fonts, audio, video, hidden slides, 4:3 decks.**
  python-pptx cannot write most of them; the audio/video/embedded-object notice is
  covered by unit tests only.
- **Upstream reports** for the renderer defects we accept are drafted, not filed:
  posting to the maintainer's repository needs Jarmo's go-ahead.
