# Sprint 124 QA evidence

2026-09-24. A dev build from this worktree (`sprint-124-word-preview-fidelity`,
CoW-cloned VS Code shell, Chromium 142, clean profile) on macOS with Word 16.113
installed. Readings come from the running webviews' DOM, driven over CDP. The
corpus is in [research/corpus/](./research/corpus/README.md); a private,
Word-saved proposal from Jarmo's company template was checked alongside it, and
nothing from it is in the repository.

## Pages against Word (the shipped `office-preview.js`)

Measured with `capture-preview.mjs` (VS Code's webview defaults included) and
`compare.py`. Full tables: `research/corpus/results/compare-sprint124-*.json`.

| Fixture | Word | before, Word-saved | now, Word-saved | now, generated |
|---|---:|---:|---:|---:|
| 01 headings & styles | 5 | 1 | **5** | 1 |
| 03 tables | 3 | 1 | 1 | 1 |
| 05 headers & footers | 4 | 4 ("Page 2 of 3" on every page) | **4, numbered 2 of 4 … 4 of 4** | 4 |
| 07 sections | 3 | 3 | 3 | **3** |
| 09 long document | 29 | 1 | **28** | 1 |
| 11 page-break-before, even/odd headers | 3 | 1 | **3** | **3** |
| Jarmo's template | — (Word's PDF not produced) | 6 | **11**, cover and page band shown | — |

The generated forms keep one long page: they carry no Word page markers (a
documented limit). 03's long table is not split at Word's markers (documented).

## Driven in the dev build

| Check | Result |
|---|---|
| Word tab loads | `office-preview.js` only; the Word renderer is absent from `webview.js` |
| Toolbar | one line at 1088 px; page, zoom, fit, search, Save as Markdown, Open in Word, Refresh; no two controls overlap; every button has a tooltip |
| Search 05 for "harbour" | Cmd+F focuses the field; "1 of 7", 7 highlights; Enter → 2 of 7 (the header's "Harbour" too); Shift+Enter ×2 wraps to 7 of 7; the current match is in view each time; Escape clears |
| Zoom | 100 → 110 → 125 → 110 % |
| Fit width | 129 %: page and its margins exactly fill the 1088 px pane |
| Fit page | 78 %: one whole page in the 909 px pane |
| Zooming by hand after a fit | leaves fit mode, stays on the page |
| Next / previous page | 1 → 2 → 3 → 2; four quick clicks go 2 → 6 |
| External edit (09, heading changed twice while on page 6) | the new text appears, still on page 6 |
| File deleted | "This file was deleted or moved. You are looking at the last version Ritemark read." |
| f1 not a zip | "This file isn't a Word document" |
| f2 truncated | "This Word document looks damaged … Microsoft Word may be able to repair it." |
| f3 password-protected | "This Word document is password-protected … enter the password there." |
| f4 decompression bomb | "too complex to preview safely … It unpacks to 512 MB or more." — refused before anything is sent |
| f5 80 MB | "too large to preview … It is 76 MB; the preview opens files up to 50 MB." — the file is not read whole |
| Every refusal | **Try again** and **Open in Word** |
| 10 chart and equation | notice: "This document has charts and equations that the preview can't show exactly. Open in Word to see them." Dismissable |
| Open in Word | Word opened `02-lists.docx`; "Opening in Microsoft Word..." |
| Jarmo's template | 11 pages; cover image and white title text; the band on every page; bold list items in Sofia Sans |
| PDF (29 pages) | same toolbar; quick next ×3 → 3 → 6; zoom 110 %; fit width 175 %; fit page 98 %; a fresh open starts at 1 / 29 |
| Markdown file | opens in the editor as before |

The toolbar, search and page-arrow rows above describe the first toolbar, which
the redesign below replaced.

## The redesigned toolbar (R4 revised), driven 2026-09-24

Real clicks and keys through agent-browser; readings from the webview DOM.

| Check | Result |
|---|---|
| Word toolbar at 1088 px | seven controls on one line: *Page 1 of 28*, −, **100 % ▾**, +, magnifier, **Open in Word** \| ▾; every control centred at 19.5 px in the 40 px bar |
| Narrow pane (root at 480 px) | compact: *1 / 28*, the zoom label, icon-only magnifier and Open in Word; `scrollWidth` = width, still one 40 px line |
| Zoom menu | Fit width, Fit page, then 50–200 %; a check on the current one; ↓ ↓ Enter from the keyboard picks Fit page; + from there goes to 100 % |
| Split button | the arrow opens a menu with **Save as Markdown**; choosing it opens the save dialog proposing `09-long-document.md` next to the file; cancel writes nothing |
| Find bar in 09 | Cmd+F opens it with the field focused; "harbour" → 1 of 134, 134 highlights and one current; Enter → 2 of 134; Shift+Enter ×2 → 134 of 134; Escape closes it, clears the highlights and returns focus to the document |
| Magnifier | opens the find bar (pressed), a second click closes it |
| PDF (29 pages) at 1088 px and 480 px | *Page 1 of 29*, zoom controls and **Save as Markdown**; compact: *1 / 29* and the Save icon |
| Markdown editor, Cmd+F | the same find bar (now the shared `FindBarShell`): focused, a count, Enter moves, Escape closes |
| Dark theme | see the two fixes below |

Found while driving it, and fixed:

| Found | Fix |
|---|---|
| In the dark theme every drop-down and right-click menu was a white panel with near-white text: `dropdown-menu.tsx` and `context-menu.tsx` hard-coded `bg-white` (on `main` too — the AI sidebar's menus and the table of contents' menu had it) | `bg-surface`, which follows the theme |
| In the dark theme the find bar's arrows and close button were nearly invisible: the shadcn ghost buttons had no text colour of their own | `text-ink-strong`, the colour the old hand-rolled buttons used |

## Cost

| Document | Pages | Open → first page drawn | JS heap |
|---|---:|---:|---:|
| 05 | 4 | 0.9 s | 9 MB |
| 09 (Word-saved) | 28 | 0.9 s | 9 MB |
| Jarmo's template, 8.7 MB with embedded fonts | 11 | 1.6 s | 55 MB |

Times include the `code` CLI round trip and 200 ms polling. `webview.js` fell from
8.93 to 8.35 MB; `office-preview.js` is 1.27 MB (374 KB gzipped), so a Word tab
no longer loads the 8.9 MB editor bundle.

## Found while driving it, and fixed

| Found | Fix |
|---|---|
| The search field was squeezed to one letter; later its clear button covered "Save as Markdown" | a fixed field width; the empty count takes no space |
| The toolbar wrapped at 1250 px | the file name left the toolbar (the tab and breadcrumbs show it) |
| docx-preview hyphenates every document ("ad-mits"); Word does only when the document asks | `hyphens: manual` unless `w:autoHyphenation` is set |
| The page surround was nearly white | a surround mixed from the theme's ink and surface |
| **CSS `zoom` gave contradictory geometry in this Chromium** (unscaled rects, scaled scrolling), so fit ran away to 300 % / 50 % and page stepping skipped | zoom is now a transform on a stage inside a sizer; geometry is consistent |
| The transform's stacking context put images behind the text under the white page | each page is its own stacking context (`isolation: isolate`) |
| **VS Code's own webview defaults** (`img { max-height: 100% }`) flattened those images to 0 px — invisible in the headless harness, visible only in the real app | `max-height: none` next to the Tailwind `max-width` reset; the harness now carries the VS Code rule |
| Quick page clicks moved one page | steps count from the page last asked for |

## Automated

| Suite | Result |
|---|---|
| `docxXml.test.ts` | pass — markers, page fields (cached, missing, split, nested, simple), font embeds, unsupported content, hyphenation |
| `prepareDocx.test.ts` | pass |
| `viewerLayout.test.ts` | pass — zoom ladder, fits, reading page, search across nodes and not across paragraphs |
| `officePackageCheck.test.ts` | pass — against the corpus's own f1–f4, size, legacy, wrong kind, too many parts, a ZIP comment |
| `transcriptSearch.test.ts` (Sprint 123, shared helpers moved) | pass |
| webview and extension `tsc --noEmit` | clean |
| `npm test` (full) | pass (exit 0) |
| `./scripts/validate-qa.sh` | pass (exit 0); `test-stage-extension-for-shell-build.sh` now requires `office-preview.js` and refuses an extension without it |

## Not checked here

- **Windows.** Calibri and Cambria are installed there, so no alias applies; the
  toolbar, search and refusals are platform-neutral. The Windows gate gets a
  checklist line with three fixtures.
- **A Mac without Word.** The Pages / default-app fallback for Open externally was
  not exercised; Word is installed here.
- **Open in Word from the redesigned split button** was not clicked again (Word
  was to stay closed); its handler is the one driven above and did not change.
- **Word's PDF of Jarmo's template.** The scripted export of a client document was
  stopped, so its page count against Word is not measured.
- **ZIP64 packages** (over 4 GB, or over 65 535 parts): the reader handles the
  format, but no fixture exists; files that size are refused for size first.
- Endnotes, text boxes and SmartArt: the `docx` package cannot write them.
