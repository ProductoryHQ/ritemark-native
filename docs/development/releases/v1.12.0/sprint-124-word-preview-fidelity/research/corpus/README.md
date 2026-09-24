# Word preview corpus (Sprint 124 R1)

Synthetic Word documents, Word's own rendering of them, and the tools that compare
Ritemark's preview with Word. Nothing here comes from a real person's document.

## Fixtures

`fixtures/` holds the documents as `generate-corpus.mjs` writes them (the extension's
own `docx` package, so no Word page markers). `word/` holds the same documents
re-saved by Microsoft Word 16.113 on macOS, which adds Word's saved page markers,
plus Word's PDF export of each.

| Fixture | Tests |
|---|---|
| `01-headings-styles` | Title, H1–H3, bold / italic / underline / colour / highlight / strike, alignment, indentation; five pages of flowing text, no manual break |
| `02-lists` | Bullets and numbering, three levels each, a list that restarts at 1 |
| `03-tables` | Header shading, row and column spans; a 70-row table whose header repeats on each page |
| `04-images` | Inline image, an image floating right with text wrapped around it, an image in a table cell |
| `05-headers-footers` | A different first-page header and footer, running header, "Page X of Y" footer, manual page breaks |
| `06-footnotes` | Three footnotes (the `docx` package cannot write endnotes) |
| `07-sections-landscape` | Portrait → landscape (wide table) → portrait with wide margins |
| `08-fonts` | Calibri, Cambria, Aptos, Arial, Times New Roman, Georgia, Courier New, and a font installed nowhere |
| `09-long-document` | 20 chapters, 29 Word pages, lists and tables, no manual breaks |
| `10-unsupported-content` | An equation and a bar chart (the chart part is injected after packing) |
| `11-break-before-even-odd` | Page-break-before as direct formatting; different even and odd headers |
| `f1-not-a-zip` | A text file named `.docx` |
| `f2-truncated` | The first half of `01` |
| `f3-password-protected` | `01` saved by Word with the password `ritemark` |
| `f4-decompression-bomb` | A 0.5 MB archive whose `document.xml` inflates to 512 MB |
| `f5-oversized` | 80 MB of incompressible images; `node generate-corpus.mjs --large` writes only this file; not committed |

**Not covered:** embedded fonts (no redistributable TTF in the repo; Word-saved
documents with embedded fonts were checked against a private document, see the
spike write-up), endnotes, text boxes, SmartArt.

## Tools

| Step | Command |
|---|---|
| Generate | `node generate-corpus.mjs` (after `npm ci` in `extensions/ritemark`). It rewrites the committed fixtures with new timestamps; restore them with git if nothing else changed |
| Word ground truth | `bash word-ground-truth.sh` — macOS with Word; the first run asks for permission to control Word. Needs `pdftoppm` (poppler) |
| Capture a preview | `node capture-preview.mjs [--css extra.css] <bundle> <out-dir> <file.docx>...` — `media/office-preview.js` in headless Chromium (Playwright's cached shell, or Google Chrome), with VS Code's webview image defaults applied |
| Compare | `python3 compare.py word/png <capture-dir> <out-dir> --sheets` — needs Pillow |

`word/png/` is regenerated from the PDFs and is not committed.

`results/` keeps the comparison tables of each variant measured in the spike and a
few side-by-side sheets: Word on the left, the preview on the right, and a red bar
where a preview page runs past the end of Word's page.
