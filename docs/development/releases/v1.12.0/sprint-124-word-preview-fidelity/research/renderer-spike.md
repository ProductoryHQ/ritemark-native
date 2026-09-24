# Sprint 124 R2 — renderer spike

2026-09-23. The corpus and tools are in [corpus/](./corpus/README.md). Each variant
is the full webview bundle built from this branch and rendered in headless
Chromium. Word 16.113 on macOS is the reference.

| Variant | Renderer | Word's page markers |
|---|---|---|
| baseline | docx-preview 0.3.7 | ignored (as shipped) |
| B | 0.3.7 | honoured |
| C | 0.4.1 | ignored |
| D | 0.4.1 | honoured |

## Pages

The **word** form of each fixture is the one Word re-saved. Word adds its saved
page markers, so this is what most real documents look like. "diff" is
`compare.py`'s coarse grey-level difference; lower means closer.

| Fixture (word form) | Word | baseline pages | D pages | baseline diff | D diff |
|---|---:|---:|---:|---:|---:|
| 01 headings & styles | 5 | **1** (5296 px tall) | **5** | 9.48 | 9.09 |
| 02 lists | 1 | 1 | 1 | 2.57 | 2.59 |
| 03 tables | 3 | 1 | 1 | 7.89 | 7.89 |
| 04 images | 1 | 1 | 1 | 9.14 | 9.14 |
| 05 headers & footers | 4 | 4 | **7** | 2.19 | 1.87 |
| 06 footnotes | 1 | 1 | 1 | 3.91 | 3.91 |
| 07 sections | 3 | 3 | 3 | 2.22 | 2.22 |
| 08 fonts | 1 | 1 | 1 | 6.88 | 6.88 |
| 09 long document | 29 | **1** (32 304 px tall) | **28** | 9.87 | 9.79 |
| 10 unsupported | 1 | 1 | 1 | 3.66 | 3.66 |

- **Honouring Word's markers is the pagination fix.** A Word-saved document goes
  from one tall sheet to Word's pages: 5 of 5 and 28 of 29.
- **0.4.1 alone changes nothing on fixtures 01–10.** C matches the baseline and D
  matches B, to the page and within 0.02 in diff.
- **Fixture 11 is where 0.4.1 wins.** 0.3.7 ignores page-break-before set on a
  paragraph and renders one page. 0.4.1 renders Word's three pages, with the even
  and odd headers alternating correctly
  ([0.3.7](./corpus/results/preview-037-11-break-before-even-odd.png),
  [0.4.1](./corpus/results/preview-041-11-break-before-even-odd.png)).

## Defects found, and their fixes

| # | Defect | Seen in | Fix (no renderer change) |
|---|---|---|---|
| 1 | **Honouring markers breaks documents that have none**: section 1 swallows section 2 (a landscape section drawn on a portrait page) | 07, generated form: 2 pages instead of 3 ([sheet](./corpus/results/sheet-markers-generated-07-sections-landscape.jpg)) | Honour markers **only when the document has them** |
| 2 | **A blank page after every manual page break**: Word stores a marker right after the break, and the renderer breaks twice | 05: 7 pages instead of 4 ([sheet](./corpus/results/sheet-041-markers-word-05-headers-footers.jpg)); the private template (below): 5 blank pages | Before rendering, drop a marker that follows a page break with no content between them |
| 3 | **Page numbers are wrong**: PAGE / NUMPAGES fields show the value Word last cached, so every page reads "Page 2 of 3" | 05 | Mark the fields before rendering and write each rendered page's own number after it |
| 4 | **The webview's CSS shrinks behind-text images to zero width** (Tailwind's `img { max-width: 100% }` inside a zero-width anchor) | The private template: its cover background and page-edge band vanish | `max-width: none` for images inside the document (R7) |
| 5 | **An empty embedded font face turns bold text into Times** | The private template: Word embedded a 0-byte "Sofia Sans Light Bold" | Drop embedded-font references whose data is empty, so the browser falls back to a synthetic bold of the regular face |
| 6 | **Office fonts are invisible outside Word on a Mac.** Calibri, Cambria and Aptos ship inside Word's app bundle, so the preview draws them in Times | 08 ([sheet](./corpus/results/sheet-baseline-word-08-fonts.jpg)) and every document using Office's default fonts | Alias them with `@font-face local()` — see Fonts |
| 7 | **Charts are not drawn** (blank space); equations come out as flattened text | 10 ([sheet](./corpus/results/sheet-041-markers-word-10-unsupported-content.jpg)) | R6 notice |
| 8 | **A long table is not split at Word's page markers** | 03: 1 page instead of 3 | Documented limit |
| 9 | **Failures show the library's raw text**, a URL included ("Can't find end of central directory : is this a zip file ? If it is, see https://…"); a password-protected file reads as "not a zip"; the 512 MB bomb spends ~2 s inflating before "Invalid string length" | f1–f4 | R5 host pre-check and specific messages |

## Fonts

Aliasing Calibri, Calibri Light, Aptos and Aptos Display to Arial, and Cambria to
Georgia, measured on the Word-saved forms of 01 and 09. Word's page is 1122 px
tall; a longer first page means the text runs past Word's page end.

| Alias | 01 first page | 09 first page |
|---|---:|---:|
| none — Times (D) | 1292 px | 1337 px |
| Arial at 100 % | 1359 px | 1359 px |
| Arial at 92 % | 1293 px | 1313 px |
| **Arial at 88 %** | **1249 px** | **1269 px** |

The coarse diff prefers Times, because Times is narrow and covers about as much of
the page. To the eye, sans at 88 % is plainly the closer match
([Times](./corpus/results/sheet-baseline-word-08-fonts.jpg),
[alias](./corpus/results/sheet-alias88-word-08-fonts.jpg)). In every variant the lines
also look taller than Word's, and the pages still overflow. The cause is not
yet measured.

The alternative is to ship **Carlito** and **Caladea**, open-licensed fonts with
Calibri's and Cambria's exact metrics, so lines wrap where Word wraps them. They
would add roughly 0.5–1.5 MB to the Office-preview bundle, depending on
subsetting, and need a download. Not measured.

## The private template

Jarmo's own proposal template (a real, Word-saved, 8.7 MB document) was rendered
in the scratchpad only; nothing from it is in the repository. It has:
- embedded fonts;
- a full-page cover image and a page-edge band, both behind the text in the
  headers;
- numbered lists and six tables;
- 14 Word page markers and 5 manual breaks.

| Variant | Pages | What it looks like |
|---|---:|---|
| baseline | 6 | one 6054 px sheet; the cover and band missing |
| D | 16 | Word's page breaks, plus 5 blank pages (defect 2); the cover and band still missing |
| D + fix 4 | 16 | **cover and band appear**; bold list items in Times (defect 5); the blank pages remain until fix 2 |

Word's own PDF of it is still to come: the scripted export was stopped, since it
is a client document. So its page count against Word is not yet measured.

## Checkpoint (2026-09-24)

Jarmo approved recommendations 1–5 as written, with the 88 % alias and no Carlito /
Caladea. After Word was restarted, its copy of fixture 11 was made: **3 pages**, the
same as 0.4.1 renders.

## After implementation (2026-09-24)

Built as recommended, then driven in a dev build ([qa-evidence.md](../qa-evidence.md)).
The real app showed four things the headless harness had not:

- **VS Code's own webview defaults** add `img { max-height: 100% }` to Tailwind's
  `max-width`, so defect 4 needed both reset. The harness now carries the VS Code
  rule.
- **CSS `zoom` gives contradictory geometry** in this Chromium (142):
  getBoundingClientRect stays unscaled while scrolling scales. Zoom is a transform
  on a stage inside a sizer instead; each page is its own stacking context, so
  images behind the text stay above the page's white background.
- **docx-preview hyphenates every document**; Word only when the document sets
  `w:autoHyphenation`. The preview now follows the document.
- The Word-saved forms measure the same as variant D plus the fixes: 01 5/5, 05 4/4
  with correct page numbers, 07 3/3, 09 28/29, 11 3/3; the generated 07 keeps its
  3 pages.

## Recommendation

1. **Adopt docx-preview 0.4.1.** It is equal on 01–10 and better on 11. We call
   only `renderAsync`, the stable API.
2. **Honour Word's page markers when the document has them** (defect 1).
3. Add a **pre-render pass** on the document's XML for defects 2, 3 and 5, and a
   **post-render pass** for page numbers. It is pure and unit-tested, and
   independent of the renderer's internals.
4. **Scope the document's CSS** so the webview's styles cannot resize its images
   (defect 4). Take the shadow root only if the corpus shows more leakage.
5. **Fonts:** alias the Office fonts to system fonts at 88 %, now, with no new
   asset. Shipping Carlito and Caladea is Jarmo's call.
6. Defects 7–9 are R5 / R6 work as planned.
