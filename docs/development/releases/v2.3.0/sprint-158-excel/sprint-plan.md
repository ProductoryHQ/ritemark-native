# Sprint 158: Excel looks like Excel, and a save keeps it (#711)

Track: Full (it changes the Excel editor's contract in `architecture.md`: the host saves edits instead of taking a whole workbook from the webview)<br>
Release tier: extension. No patches, no `vscode`, no `product.json`, no binaries, no new bundle and no esbuild external. numfmt is built into `media/webview.js`, which an extension release ships. `branding/ATTRIBUTION.md` gains numfmt's line; that file reaches users with the next shell release.<br>
**Status:** Approved by Jarmo on 15 November 2026, together with the mockup's six decisions ("Exceli plaan on kinnitatud"). Phase 3 starts on this branch. PR 0's early extension release still needs his own release word.<br>
**Approval:** Jarmo. On 14 November he asked for an Excel preview at ChatGPT's and Claude's level ("Ma tahaks selle ka saada ChatGPT/Claude'i eelvaadetega samale tasemele"). On 15 November he agreed that 2.3 starts now, with everything except the skip path, and that Decks goes first when the two streams compete, except for the Excel notice. He approved this plan and the mockup on 15 November ("Exceli plaan on kinnitatud").<br>
**Release:** v2.3.0. Its release plan follows the 20 November cohort read.<br>
**Branch:** `sprint-158-excel`.<br>
**Issue:** [#711](https://github.com/ProductoryHQ/ritemark-native/issues/711).<br>
**Study:** [research/2026-11-15-excel-study.md](research/2026-11-15-excel-study.md), with the prototype scripts in [research/prototype/](research/prototype/).<br>
**Rendering spike (15 November):** [research/spike/](research/spike/). It has:
- the renderer: reader, styles and layout;
- four synthetic workbooks (training budget, Estonian timesheet, project plan, sales report), which are clean for upload;
- before and after shots.

Jarmo asked to see the Experience lead's mockup before he approves this plan ("exceli puhul tahan enne näha Experience poolt tehtud mockupi!"). The mockup is drawn on the spike's real renders.

## Why

Ritemark lets a person edit an `.xlsx` file. Today one edit and a save removes cell colours, bold text, borders, frozen rows, charts, pictures, drop-down lists and conditional formatting from the whole workbook. The preview draws none of that formatting either: every column is between 120 and 400 px, every row is 32 px, and cells hold one line. The study found one more fault. Dates written day first, such as `dd.mm.yyyy` (Estonian files), show as `1/3/26` instead of `03.01.2026`.

## What a person sees after this sprint

- **A save changes only the cells they changed.** Every other part of the file stays byte for byte: colours, fonts, borders, frozen rows, charts, pictures, drop-down lists, conditional formatting, tables, comments and page setup. An edited formula cell keeps only its value, as today. Formulas that use it update when Excel opens the file.
- **The preview looks like the workbook in Excel:**
  - column widths and row heights;
  - fills, including theme colours and tints;
  - fonts (bold, italic, colour, size);
  - borders, alignment and wrapped text;
  - merged cells, frozen rows and columns, and gridlines;
  - number formats, with dates in the file's own format;
  - hidden rows, columns and sheets stay hidden, and the sheet tabs show their colours;
  - the cells sit on white paper in both themes, as the Word preview does.
- **The notice says plainly what a save does.** Until the new save ships it warns what a save removes. Afterwards it says only the edited cells change.
- **Not yet in the preview:** charts, pictures and conditional formatting are kept on save but not drawn. They are decided separately. CSV looks as it does today.

## Decided in this plan

- **No ExcelJS.** It drops charts, changed a real Mac Excel file's default font and column widths, and fails to open some valid files. Its last stable release is from October 2023.
- **A surgical save in the extension host.**
  - The webview sends each edit (`{sheet, ref, value}`) instead of a whole workbook in base64.
  - `ExcelDocument` keeps the original bytes and the list of edits. Save, Save As and backup apply the edits.
  - Before writing, the save reads every edited cell back. If anything fails, it writes nothing and the document stays unsaved.
  - The list of edits also makes undo possible later.
- **Our own reader for the preview,** in the webview, with numfmt (MIT) for number formats. SheetJS stays for `.xls` and as the fallback when the reader fails.
- **A new sheet grid next to `DataTable`, not inside it** (the rendering spike, 15 November). `DataTable` is a `<table>` with 32 px rows and columns clamped to 120–400 px. The Excel look needs a different structure:
  - absolutely positioned layers: fills and gridlines, then borders, then text, then objects;
  - row heights and column widths that vary, with a virtualizer that handles both;
  - merges drawn as an overlay;
  - four sticky regions for frozen panes.

  A static layout does not scale: 500 rows took 300 ms, and 5,000 rows took 19 s. `DataTable` stays as it is for CSV.
- **Hidden sheets, rows and columns stay hidden.** Today's viewer shows them, so a "Draft row" or a "Lookups" sheet the author hid is visible.

## PRs

| PR | What | Review tier |
| --- | --- | --- |
| 0 | A warning above the sheet from the moment it opens says what a save removes today, with Open in Excel (replaces the one-time toast at `excelEditorProvider.ts:192-194`) | Standard |
| 1 | The surgical save in the host, the list of edits, edit-only messages from the webview; the notice changes to "only the cells you edit change" | High (it writes the person's files) |
| 2 | The reader with numfmt: number formats (fixes day-first dates), hidden rows, columns and sheets, the active sheet, the SheetJS fallback | Standard |
| 3 | The Excel look in a new virtualized sheet grid beside `DataTable`: widths, heights, fills, fonts, borders, alignment, wrap, spill, merges, frozen panes, gridlines, the paper | Standard |
| 4 | Fonts: Carlito for Calibri and Caladea for Cambria (SIL OFL, metric-compatible), cell padding 2 px; performance on a 50,000-row sheet; whether to lift the 10,000-row cap | Standard |

**PR 0 can ship before the rest,** in an extension release on Jarmo's word, because it protects people's files now. The warning sits above the sheet from the moment it opens, not as a toast after the first edit (the Experience lead, frame 3): "Saving here removes this workbook's colours, bold text, borders, charts and pictures. Values and formulas stay." with the button "Open in Excel to keep them".

After PR 1 the warning goes. A quiet line on the bar after the first edit (frame 2): "Only the cells you change are saved; the rest of the workbook stays as it is. Totals that use them update when the file opens in Excel." When a formula is typed over: "Typing here replaces the formula with a value."

## Files

- **New in `src/excel/`:**
  - `xlsxPackage.ts`: zip read through `officePackageCheck`'s `readZipDirectory` and `readZipEntry`, plus the raw-copy writer.
  - `sheetXml.ts`: finding, replacing and inserting cells, and the dimension. It is pure, so the webview can share it.
  - `sharedStrings.ts`, `sharedFormula.ts`, and `applyCellEdits.ts` (calcPr, calcChain, refusals).
  - Tests beside each.
- **New in `webview/src/components/excel/`:** `readWorkbook.ts`, `excelStyles.ts`, `numberFormat.ts`, `columnWidth.ts`, and tests.
- **Changed:**
  - `src/excelDocument.ts` and `src/excelEditorProvider.ts`;
  - `webview/src/components/SpreadsheetViewer.tsx`, `DataTable.tsx` and `App.tsx` (the xlsx route only);
  - `webview/package.json` and its lockfile (numfmt), and `media/webview.js`;
  - `package.json` (the test list), `docs/development/architecture.md` (the Excel contract at line 201) and `branding/ATTRIBUTION.md`.
  - `docs/CHANGELOG.md`: each PR adds its user-facing lines under 2.3.0. `docs/releases/v2.3.0/release-notes.md` is written for the release with the release-notes skill, from those lines.
- **Next to Decks:** Sprint 157 touches `App.tsx` only after the CSV block, away from the xlsx route, and no other file here.

## Tests

- **Unit tests** (`npx tsx` with `node:assert`, in `npm test`):
  - cell XML with prefixes, missing `r`, self-closing rows, an empty `sheetData`, style inheritance and clearing;
  - shared-formula translation, with more cases than the prototype's seven;
  - calcChain and `calcPr`, the refusals, shared strings, escaping and the 32,767-character limit;
  - raw-copy bytes and data descriptors, with the output passing `checkOfficePackage`;
  - the fuzz test from the prototype, ported: no unedited cell changes, and every part outside the touched list keeps identical bytes;
  - tint vectors, the theme swap, the indexed palette, number formats (including `dd.mm.yyyy`) and pixel widths;
  - the reader's values against SheetJS's on the fixtures.
- **Fixtures:** the study's generated files. Jarmo is asked for a real-world set free of client data: files saved by Excel 365 on Windows, Excel on Mac, Google Sheets, Numbers, LibreOffice and pandas, some with pivots, sparklines, threaded comments and dynamic arrays. The saver's name in each file's metadata is scrubbed with `scrub-metadata.py`.
- **The bar for the look:** the Experience lead's captures of the same workbooks in Excel, ChatGPT and Claude. PR 3 is compared against them side by side.
- **Jarmo at the gate:**
  - every saved file opens in Excel and in Numbers with no repair prompt;
  - formulas that use an edited cell update, and charts refresh;
  - the preview matches Excel's screenshots;
  - the 50,000-row sheet in a dev instance.

## The mockup: experience 47 (the Experience lead, 15 November)

ritemark-dev `product/design/experience/experiences/excel/` (9b1c29c, 60e445e). It has eight frames, drawn by the spike's own renderer inside Ritemark's frame, and reference captures of the same four workbooks in Excel for Mac, Claude, the spike and today's grid. ChatGPT is not captured: Jarmo said to skip it. Jarmo's own page in Estonian: https://claude.ai/artifact/2XtWqq9A8M1iaqpp2cJYHr. The answers:

1. **Dark theme:** the cells stay on white paper, as the Word preview's pages do.
2. **Text that overflows** into empty neighbours is drawn as Excel does, not clipped.
3. **Sorting** stays a view, as today, under the column letter and below the frozen rows. Where merged cells run across those rows, Sort is off and its menu says why.
4. **The notices:** PR 0's warning and the line after PR 1 are given above.
5. **The frame:**
   - Excel's grey headers, with the current column letter and row number tinted;
   - Ritemark's accent ring for the selected cell and the cell being edited;
   - Excel's grey frozen-pane line;
   - the tabs under the sheet as today, with a tab colour as a strip and a chart icon on a chart sheet. Hidden sheets get no tab.
6. **Kept but not drawn:** a card at a chart's or picture's own place and size, one line on the bar per sheet saying what is kept, and a card for a chart sheet, each with Open in Excel.

**Found while drawing:**
- **Fonts.** With Arial at 88% for Calibri, the budget's grand totals showed `####` where Excel for Mac shows the numbers. Carlito (Calibri's metric twin) and Caladea (Cambria's), both SIL OFL, with 2 px of cell padding instead of 6, fit as Excel does. Aptos has no open twin. Checking against Windows Excel is still to do.
  - The two fonts are files. If they ship as files under `extensions/ritemark/`, they reach users only with a shell release, which 2.3 is expected to be. If the bundle carries them, an extension release can ship them too. PR 4 decides which.
- **Accounting formats:** `_-` pads by the width of the character after the underscore, not a full space.
- **Not a reader bug:** Excel recalculated the plan's NETWORKDAYS on open. The fixture's cached value was off.

Claude, for comparison, shows a preview only for a file it hands back. Its preview shows hidden rows, columns and sheets, clips wrapped text and doesn't rotate text. It does draw colour scales and charts, in a separate Charts tab, and that is where it is ahead of this first version.

## Risks

The full list is in the study. The three that can change the plan:

- **Excel's reaction to the surgical output is not verified yet.** The points are calcChain removal, `fullCalcOnLoad`, appended shared strings, and editing a table's header cell. PR 1 is not done until Jarmo has opened saved files in Excel with no repair prompt.
- **A wrong shared-formula translation would write wrong formulas.** The fuzz test and the translation cases are the guard, and an edit the code can't translate safely is refused.
- **Formulas that use an edited cell show their old value in the preview** until Excel recalculates the file. The notice says so.
