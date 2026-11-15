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

## In the app

The screenshots of the same edit and save in a dev instance, before and after, are attached to PR 1.
