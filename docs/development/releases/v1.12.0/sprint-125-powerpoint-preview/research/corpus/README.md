# Sprint 125 PowerPoint corpus

Synthetic decks for measuring the PowerPoint preview against PowerPoint itself.
Nothing here comes from a real document. The spike that first used them is
[../renderer-spike.md](../renderer-spike.md).

## Decks

Written by `gen-fixtures.py` (python-pptx 1.0.2; `pip install python-pptx`), 16:9
(13.333 × 7.5 in, 1280 × 720 px at 96 dpi). Archive timestamps are pinned, so a rerun
is byte-identical. A research script: nothing ships from it.

| Fixture | Tests |
|---|---|
| `01-title-bullets` | Title slide, five bullet levels, mixed runs, numbered lists (`1.` and `a)`), alignment, an overflowing body, Two Content |
| `02-tables` | Built-in table style (header, banding), merges, cell fills; custom column widths and wrapped cells |
| `03-images` | PNG native and stretched, transparent PNG, crops (PNG and JPEG), a full-bleed picture with text over it |
| `04-shapes-groups` | 10 presets, dashes, a 45° gradient, rotation, flip, no-fill outline, connectors with arrowheads, nested and rotated groups |
| `05-charts` | Clustered column with data labels, horizontal bar, line with markers, pie with `0%` labels, doughnut |
| `06-fonts` | Theme fonts Aptos Display / Aptos; explicit Calibri, Calibri Light, Aptos, Arial, Helvetica Neue, Times New Roman, Georgia, Courier New, and a font installed nowhere |
| `07-notes` | Three slides with speaker notes |
| `08-long-40-slides` | 40 slides cycling chart, bullets, table, shapes and picture |
| `09-layouts-backgrounds` | Section Header, Comparison, Content with Caption; solid, gradient and dark backgrounds; a hyperlink |

`ppt-themed.sh` (macOS, Microsoft PowerPoint) makes `ppt/11-powerpoint-themed.pptx`:
PowerPoint opens deck 01, applies its built-in **Berlin** design theme and saves it, so
the backgrounds, decorations, fonts and colours all come from PowerPoint. It has no
generated form. Jarmo has no deck of his own; this one stands in for a real deck.

`gen-heavy.py` writes `fixtures-cost/10-media-heavy-40.pptx` (40 slides, a distinct
full-HD JPEG on each, 8 MB). It is for cost only, has no ground truth and is not
committed.

## Failure fixtures

| Fixture | What it is |
|---|---|
| `f1-not-a-zip.pptx` | A text file with a `.pptx` name |
| `f2-truncated.pptx` | The first half of `01` |
| `f3-decompression-bomb.pptx` | A valid deck whose `slide1.xml` inflates to 512 MiB of whitespace; 0.55 MB on disk |
| `f4-bomb-lying-size.pptx` | `f3`, declaring that part as 4 KiB in the local header and the central directory |
| `f5-password-protected.pptx` | `01` saved by PowerPoint with the open password `ritemark` (`ppt-password.sh`): an encrypted OOXML file, which is CFB, not ZIP |
| `f6-docx-bomb-lying-size.docx` | The same lie in a Word file, built from Sprint 124's Word-saved fixture 01 (`word/document.xml`) |

## PowerPoint ground truth

`ppt-ground-truth.sh [names]` (macOS, Microsoft PowerPoint): PowerPoint opens each
`fixtures/NN-*.pptx`, exports `ppt/NN-*.pdf` and re-saves it as `ppt/NN-*.pptx` — the
form a deck has after PowerPoint saved it. `pdftoppm -r 96` writes `ppt/png/` (not
committed; rerun the script). `ppt-close.sh` closes, by name and without saving, only
the corpus presentations.

Word and PowerPoint write the saving user's name into every file they save. `scrub-metadata.py` replaces it with "Ritemark corpus" in `docProps/core.xml` and changes nothing else; `ppt-ground-truth.sh` and `ppt-themed.sh` run it on what PowerPoint saves. Never run it on a failure fixture that lies about its sizes.

PowerPoint's `open` often never answers the Apple Event, so the script sends it
without waiting and polls for the presentation by name.

## Capturing the preview

`capture-preview.mjs <office-preview.js> <out-dir> <deck.pptx>…` renders each deck with
the built Office bundle in headless Chromium (behind a stub `acquireVsCodeApi`, with
VS Code's webview image defaults) and saves every slide at 100 %, 1280 × 720 — the size
of `pdftoppm -r 96` of PowerPoint's PDF. It also records when the first slide was
drawn and how many slides were drawn at once.

## Comparing

`compare.py <ppt-png-dir> <out-dir> <label>=<capture-dir> … [--sheets]` scores each
renderer's slides against PowerPoint's: slide counts, and the mean grey-level
difference at 200 px (`diff`, as in Sprint 124) and 640 px wide (`diff640`, more
sensitive to where text sits). With `--sheets` it writes a side-by-side JPEG per deck.
Needs Pillow.

Sprint 125's results are in [results/](./results/): the comparison tables
(`compare-sprint125-*.json`), the captures' timings (`capture-sprint125-*.json`) and
side-by-side sheets (`sheet-sprint125-*.jpg`, PowerPoint left). The spike's are in
[../spike-results/](../spike-results/).
