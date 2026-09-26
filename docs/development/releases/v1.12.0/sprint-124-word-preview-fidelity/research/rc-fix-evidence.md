# v1.12.0 RC fix — Word preview pages: evidence

**Date:** 2026-09-26 · **Branch:** `fix/word-preview-pages` · **Reference:** Word for Mac's own PDF export of each file, rasterized at 96 dpi (`pdftoppm -r 96`), compared page by page with the preview's pages captured by `corpus/capture-preview.mjs` (the real `office-preview.js` bundle in headless Chromium).

## What failed

The first v1.12.0 candidate drew a Word document as pages only where Word had saved its page breaks (`w:lastRenderedPageBreak`). A document written by another program — a Google Docs export, a report made with the `docx` library — has none, so it showed as one long sheet. Jarmo's first test file did exactly that.

## What the fix does

| Area | Before | Now |
|---|---|---|
| Pages | Only Word's saved breaks | The preview lays out pages itself: draw, measure, break, draw again (two rounds). Word's saved breaks are still followed, and a page they leave overfull by more than 10 % (a table running over several pages) is laid out too |
| Paragraphs across pages | Never split | Split between lines, at least two lines on each side unless widow control is off; `keepNext` and `keepLines` kept |
| Tables across pages | Never split | Break between rows, header rows repeated, a vertically merged cell restarted, column widths kept from the first drawing |
| Line spacing | Word's "multiple" read as a multiple of the font size (15–25 % tight); missing spacing took the webview's 1.5 | A multiple of the document font's line height: a known font's, else the embedded font's own metrics |
| Empty paragraphs | 13 px tall (the webview's font), whatever their size | One line of their paragraph mark, as in Word (a 1 pt spacer is a hairline) |
| Paragraph font | The webview's 13 px font under every line (the "strut"), and for list numbers | The paragraph's first run's font |
| Embedded variable fonts | Drawn at the default weight (Regular) | Drawn at the weight the family name gives ("Sofia Sans Light" → 300), with a bold face for bold text |
| Page setup missing | One page as wide as the window | A4, or Letter in the US, Canada, Mexico and the Philippines, with Word's default margins |
| Symbol / Wingdings bullets | Boxes and letters | Unicode bullets and symbols |
| Pictures placed against the page | Placed in the flow (white strip over covers) | Placed on the page |
| Paragraph borders | Through the first line of a numbered item; broken between paragraphs; text against the bar | Left of the number; one bar through a bordered block; Word's gap (`w:space`) between bar and text |
| Footers from other programs | Empty (field code and text in one run) | Page numbers shown |

## Rules confirmed in Word itself

Each rule below was checked with a small probe document laid out by Word, not taken from the specification alone.

- **Widow and orphan control is on unless a document turns it off.** Three documents, identical but for `w:widowControl` (absent / `w:val="0"` / present): the absent and present ones move a two-line paragraph whole to the next page; only the explicit off splits it one line and one line. The specification reads the other way; Word's behaviour wins.
- **Line height comes from the font's metrics.** A training handout in Sofia Sans Light 13 pt with 1.15 spacing has a 24 px line pitch in Word: 1.15 × 1.2 (the font's ascender − descender + line gap, read from the embedded font) × 17.33 px. The preview had used 1.17 for an unknown font (23.4 px).
- **An empty paragraph is one line of its paragraph mark.** A 1 pt rule paragraph adds about 3 px in Word; the preview drew 13 px.
- **A variable font under a weighted family name is drawn at that weight.** The same handout embeds Sofia Sans as a variable font under the name "Sofia Sans Light"; Word draws it light. The preview drew it at 400, darker and wider, and broke lines earlier.

## Results

Sprint 124 corpus (11 files), pages in Word / pages in the preview, generated form and Word-saved form:

| Fixture | Word | Generated | Word-saved |
|---|---|---|---|
| 01-headings-styles | 5 | 5 | 5 |
| 02-lists | 1 | 1 | 1 |
| 03-tables | 3 | 3 | 3 |
| 04-images | 1 | 1 | 1 |
| 05-headers-footers | 4 | 4 | 4 |
| 06-footnotes | 1 | 1 | 1 |
| 07-sections-landscape | 3 | 3 | 3 |
| 08-fonts | 1 | 1 | 1 |
| 09-long-document | 29 | 28 | 28 |
| 10-unsupported-content | 1 | 1 | 1 |
| 11-break-before-even-odd | 3 | 3 | 3 |

Before the fix the generated forms were single long sheets. No fixture's pixel difference against Word grew during the fix; 02-lists went from 2.64 % to 0.76 %.

Four real documents (private, not in the repository): a 25-page training handout with a full-page cover, side bands, bordered quotes and bulleted lists in an embedded brand font; a 9-page price comparison with tables; a 9-page workshop board; a 2-page brief without page setup. All four now have Word's page count (25, 9, 9, 2). The handout's first two page breaks fall exactly where Word's do; later pages hold up to a few lines more than Word's (see below), and the count still comes out the same.

## Known differences left

- **Bulleted lines are about 2 px shorter than Word's** when the document embeds the Symbol font: Word takes the bullet's taller ascent into the line. Over a page of bullets this is a line or two.
- **Headings in a different font from the body** use the body font's line height (Space Grotesk headings are about 2 px shorter per line than in Word).
- **One document's body starts 32 px lower in Word than its margins say.** Twelve probe variants (header picture, header spacing, header distance, document grid, styles, settings, footers) show that the header pushes the body down, but not why its height is 40 px more than its one paragraph; an identical header in another document does not. Not modelled.
- Word's own 29 pages for `09-long-document` against the preview's 28 (unchanged from Sprint 124).
