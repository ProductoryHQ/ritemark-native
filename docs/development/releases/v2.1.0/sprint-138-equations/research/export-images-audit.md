# Audit A3: equation pictures for the PDF and Google Docs

Run on 26 October 2026 on a dev instance of the sprint branch. The question: are KaTeX's equations, drawn to pictures in the webview, sharp, on their baselines and in KaTeX's fonts, and fast enough?

**Result: plan A works.** Plan B (MathJax 4 from draw.io's copy) is not needed.

## How a picture is made (`webview/src/lib/mathExport.ts`)

1. KaTeX typesets the equation off screen at the export size: the PDF's 11 pt body times the drawing's ratios (1.08 inline, 1.08 × 1.18 display).
2. The box is measured: across, KaTeX's box and its parts; up and down, the parts' struts, which are the formula's TeX height and depth. A zero-size probe beside it gives the baseline, so the depth below the baseline is exact.
3. The same markup goes into an SVG `foreignObject` with only the faces it uses as `data:` URLs, and is drawn into a canvas at 4×.
4. The export HTML gets the picture with its width, height and depth, plus KaTeX's MathML for Word.

## What was seen

| Check | Result |
|---|---|
| Sharpness | sharp at 300 dpi and at 200% in Preview; strokes and the fraction bars hold |
| Baselines | inline equations sit on the text's baseline, subscripts hang below it; table cells' first lines align |
| Fonts | KaTeX's own faces in every picture (Computer Modern shapes, not a system serif) |
| Clipping | none: accents, subscripts, `\sqrt` and fractions whole |
| 220 equations (`math200.md`) | prepared in about 2.05 s, under the plan's bar of 100 in 3 s; the PDF is 1.38 MB |
| A typo | its source in Courier in the PDF, and counted in the message |

**One fix made during the audit.** The first measurement took the height from KaTeX's outer box, which is a line box at KaTeX's line height and taller than the formula. Every PDF line holding an inline equation opened up by about 2 pt, and a table cell with an equation sat lower than its neighbours. The height now comes from the struts; lines with and without math are spaced alike. Evidence: `qa-evidence/09-pdf-page.png` and `10-pdf-table-and-list.png`.

## Not run

- Windows: the same webview code; checked with the Windows session's S33.
- Google Docs with a real account (A5).
