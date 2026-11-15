# Sprint 158 PR 1 proof: the fault, then the fix (15 November 2026)

PR 1 writes people's files, so REVIEW.md's High tier asks for the fault shown first and then shown fixed, with the measurements kept here.

## One edit and a save, file by file

`save-compare.ts` makes the same edit two ways. The first is 2.2's way: SheetJS reads the workbook with `cellStyles`, writes the cell, and writes the whole workbook again, as `SpreadsheetViewer` did on every cell commit. The second is PR 1's way, `applyCellEdits` in the host. `../prototype/00-pytools/features.py` (openpyxl) then compares each saved file with the original, feature by feature.

| File | Edit | 2.2 save | PR 1 save |
| --- | --- | --- | --- |
| `rich-excelish.xlsx` (23 parts) | Budget!A3 = "Rent (edited)" | 30,064 B, 0 parts byte-identical; 25 features lost | 13,606 B, 21 parts byte-identical (the sheet and the shared strings changed); only A3 differs |
| `training-budget.xlsx` (the spike's, 9 parts) | Budget 2027!B6 = 14 | 27,120 B, 0 parts byte-identical | 7,327 B, 8 parts byte-identical (the sheet changed) |

What the 2.2 save lost in `rich-excelish.xlsx`, as openpyxl reads it:
- A1's fill, bold, size, colour and alignment;
- A2's theme fill with tint, italic and medium border;
- A3's and B11's borders, and B11's fill;
- A11's indexed colour and underline;
- A13's wrap, B14's indent, C14's rotation, D14's strike and font;
- the rich text in A14;
- frozen panes, the three conditional formats, the drop-down list, the picture, the chart;
- the tab colour, page setup, the table "Orders", and Data's gridlines setting.

The PR 1 save changes only A3's value. The other 39 features read the same.

Reproduce, from `extensions/ritemark`:

```bash
npx tsx ../../docs/development/releases/v2.3.0/sprint-158-excel/research/proof/save-compare.ts src/excel/fixtures/rich-excelish.xlsx Budget A3 "Rent (edited)" /tmp/s158
```

```bash
python3 ../../docs/development/releases/v2.3.0/sprint-158-excel/research/prototype/00-pytools/features.py src/excel/fixtures/rich-excelish.xlsx /tmp/s158/rich-excelish--pr1-save.xlsx
```

## 50,000 rows × 20 columns (`perf-50k.ts`)

The sheet holds 35 MB of XML in a 5.2 MB file, with shared strings and a formula in every row. Node 22 on Apple Silicon, one run:

| Step | Time |
| --- | --- |
| The first edit's check (reads the sheet once for array formulas, tables, shared formulas) | 97 ms |
| A later edit's check | 0.1 ms |
| Save, 2 edits (one overwrites a formula), with the read-back | 1,091 ms |
| Save, 21 edits, with the read-back | 2,297 ms |

2.2 took about 4 s for this file on every cell commit (the study). Ritemark saves automatically one second after an edit (`files.autoSave: afterDelay`), so on a sheet this size a person typing gets a save, about a second of the extension host's time, every second. PR 4 makes the save one pass over the sheet and measures it again. The save's cost grows by about 60 ms an edit on a sheet this size, because each edit copies the sheet's text once. That is fine for the edits a person makes by hand. PR 4, which looks at performance on a 50,000-row sheet, can make it one pass if needed.

## PR 4: the same sheet after the performance pass

Profiling the save (`node --cpu-prof`) showed three costs that grew with the sheet rather than the edits. One was the search for `</sheetData>`, which ran forward over 35 MB on every edit. Another was the walk to an edited row from the sheet's top. The third was the read-back's character loop. A fourth cost, in the save and in the preview's reader, was `attr`, which compiled a new regular expression on every call.

| Step, 50,000 × 20 | PR 1 | PR 4 |
| --- | --- | --- |
| Save, 2 edits, read-back included | 1,092 ms | 918 ms |
| Save, 21 edits, read-back included | 2,297 ms | 1,251 ms |
| The preview's reader (`read-50k.ts`, Node) | 1,872 ms | 1,275 ms |
| Laying the sheet out (`buildLayout`) | | 4 ms |

What is left is fixed: inflating, re-deflating and reading back 35 MB of XML, about 0.9 s, much of it on the extension host's thread. Ritemark saves one second after an edit, so on a sheet this size the host is busy for about a second after each pause in typing. That is acceptable for a 50,000-row sheet. Moving the save into a worker thread is the next step if a real workbook shows it hurts.

In a dev instance (`pr4-big-open.png`, `pr4-big-scrolled.png`), the 5.2 MB workbook opens straight into the sheet grid. A jump anywhere in it takes about 33 ms for two frames (median and 90th percentile alike), with about 1,240 elements in the page.

**The 10,000-row cap:** the sheet grid draws every row, since it draws only what is in view. The cap and its "showing first 10,000 rows" note stay for the table that CSV, `.xls` and the SheetJS fallback use.

## PR 4: widths and fonts against Excel for Mac

With Arial standing in for Calibri, the training budget's totals E9 and E23:G23 showed `####`, where Excel for Mac shows the numbers (`reference/excel-training-budget.jpg` in the Experience lead's folder). There were two causes, and measuring found a third.

1. **No inlined font loaded in the Excel view.** Its content security policy had no `font-src data:`, so the bundled faces failed (`document.fonts` reported `error` for every one, Sofia Sans too). The view now allows inlined fonts, as the other views do.
2. **The fonts.** Calibri and Cambria are now drawn by Latin subsets of their metric twins, Carlito and Caladea (SIL OFL). The subsets are renamed Ritemark Grid Sans and Ritemark Grid Serif, as the licence asks (`make-grid-fonts.py`, `fetch-grid-fonts.sh`; `branding/ATTRIBUTION.md`). Carlito's digit is 1,038 of 2,048 units, the same as Calibri's.
3. **The widths.** Excel for Mac counts a column in points, with the widest digit rounded up (Calibri 11 and Aptos Narrow 11: 6 pt), and pads no default column to a multiple of 8. A column is about 14% wider there than in Excel for Windows. Measured from Excel's window, in points:

| Workbook | Column (characters) | Excel for Mac | Ritemark on a Mac |
| --- | --- | --- | --- |
| Budget (Calibri) | A (34), B (12), D (14), E (12.5), K (10), default | 204, 72, 84, 75, 60, 53 | the same |
| Timesheet (Aptos Narrow) | A (11.5), B (5.5), G (16), H (46) | 68, 33, 97, 275 | 69, 33, 96, 276 |

The grid follows the Excel of the computer it runs on: on Windows it keeps Windows' widths (E is 87 px, and the 12-point bold totals show `####` there).

**The inset and `_-`:** measured the same way (ink edge to gridline, in points), text in Excel starts 2.5–3.5 pt from the cell's left edge and Ritemark's started 2.25–2.6 pt in at 2 px. The inset is now 3 px on a Mac; Windows keeps 2 px, because its 64 px default column holds eight Calibri digits only at 2. A format's `_-` now leaves a gap as wide as "-" instead of a space. On the right of an accounting cell, Excel's gap is 6.5 pt and Ritemark's is now about 4.9 pt. The 1.6 pt left over is close to what a downscaled JPEG can resolve, so it is reported here, not tuned.

Shots: `pr4-budget.png`, `pr4-budget-totals.png` (every total in full), `pr4-timesheet.png` ("8:15" clear of "Müük"). PR 3's fix found on the way: `pr3-frozen-scrolled-before.png` and `pr3-frozen-scrolled.png`.

## In the app

The screenshots of the same edit and save in a dev instance, before and after, are attached to PR 1.
