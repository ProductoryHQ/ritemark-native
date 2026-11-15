# Excel preview and save: the study (15 November 2026)

For Sprint 158 and issue #711. This is a read-only study of the code plus experiments in a scratch folder. The prototype scripts are copied into [prototype/](prototype/), one folder per experiment. SheetJS is loaded from `SHEETJS_PATH` or `xlsx`. Line numbers are as of `main` at `cb99ddca`, relative to `extensions/ritemark/`.

**Not verified:**
- No output was opened in Excel, Numbers or LibreOffice.
- Ritemark and dev instances were not launched.
- Speeds are from Node 22.21.1 on arm64, not from the webview's Chromium.
- ChatGPT's and Claude's previews were not looked at.
- The CSS rendering was not viewed in a browser.

## Recommendation

- **Don't adopt ExcelJS.**
- **Save in the extension host by changing only the edited cells' XML**, and keep every other part of the file byte for byte.
- **Read the preview in the webview with a small reader of our own**, with numfmt (MIT) for number formats.
- **SheetJS stays** for `.xls` and as a fallback.

The surgical save kept every feature tested. ExcelJS dropped charts, changed a real Mac Excel file's default font, and failed to open some valid files. Everything is extension-tier.

## Code read

- **`src/excelEditorProvider.ts`:**
  - `isEditable` 48–50;
  - `handleContentChanged` 180–196, with the notice text at 192–194;
  - `saveCustomDocument` 200–203, `backupCustomDocument` 239–257, `sendExcelData` 307–322.
- **`src/excelDocument.ts`:** holds one buffer; `update()` replaces it.
- **`webview/src/components/SpreadsheetViewer.tsx`:**
  - `MAX_DISPLAY_ROWS` 10,000 (33);
  - `extractSheet` 47–85;
  - `XLSX.read` 185–189;
  - `serializeWorkbook` 383–394, which runs a full `XLSX.write` on every cell commit;
  - `handleExcelCellChange` 405–438;
  - add row and column 440–476;
  - the `DataTable` call 620–633;
  - sheet tabs 641–660.
- **`webview/src/App.tsx`:** `handleExcelChange` 547–550, `isXlsxEditable` 822, `onChange` routing 831.
- **CSV:** shares the viewer and `DataTable` (Papa parsing, the `namedColumns` path).
- **`webview/src/components/DataTable.tsx`:**
  - fixed `ROW_HEIGHT` 32 (94) and the virtualizer (96–101);
  - every column clamped to `minWidth:120` / `maxWidth:400` (346, 646);
  - cells truncated to one line (776–780).
- **Reusable for xlsx:** `src/officePreview/officePackageCheck.ts`: `readZipDirectory` 78, `entryDataRange` 161, `readZipEntry` 176, `checkOfficePackage` 222.
- **Font aliases:** `webview/src/components/viewers/docx/officeFonts.ts`: `installOfficeFontAliases` 74, `installFontFallbacks` 93.
- **Shared host and webview code is an existing pattern:** `App.tsx:53-54` imports `../../src/editorSync/state`.

## Test files

- **`rich.xlsx`** (openpyxl 3.1.5):
  - fills: rgb, theme with tint, indexed;
  - fonts, borders, alignment, wrap, indent, rotation, rich text;
  - widths and heights, a hidden row and column, a merge, frozen panes;
  - conditional formatting: cellIs, colour scale, data bar with its x14 twin;
  - a drop-down list, a comment, two hyperlinks, a defined name, an image, a chart, a table;
  - a hidden sheet, a tab colour, page setup and print titles.
- **`rich-excelish.xlsx`:** the same file reshaped the way Excel writes it: shared strings, cached formula results, calcChain, `xdr:`-prefixed drawings, Excel part names, comments as rich runs, an x14 extLst, custom document properties.
- **`excel-authored.xlsx`:** a copy of the real Mac Excel file `docs/development/sprints/sprint-81-excel-editing/test-workbook.xlsx`.
- There is no Excel-made file with heavy formatting or charts yet. Jarmo's real-world set is a fixture still to come.

## One edit (Budget!A3) and save, `rich-excelish.xlsx`

openpyxl compared each saved file with the original, feature by feature.

| Feature | Today (SheetJS 0.20.3) | ExcelJS 4.4.0 | xlsx-populate 1.21.0 | Surgical prototype |
|---|---|---|---|---|
| Fills: rgb, theme with tint | lost | kept | kept | kept |
| Fonts: bold, italic, size, colour, strike, indexed colour | lost | kept | kept | kept |
| Borders: thin, medium (theme), dashed (indexed), double | lost | kept | kept | kept |
| Alignment, wrap, indent, rotation | lost | kept | kept | kept |
| Rich-text cell | flattened | kept | changed | kept |
| Widths, heights, hidden row and column, merges, number formats, formulas | kept | kept | kept, but every cached formula result deleted | kept |
| Frozen panes, tab colour, page setup, gridlines off | lost | kept | kept | kept |
| Conditional formatting | lost | kept (rewritten) | kept | kept byte for byte |
| Drop-down list | lost | kept, with a duplicate overlapping range | kept | kept |
| Comment | kept | kept, author becomes "Author" | kept | kept |
| Image | lost | kept, with an anchor the schema doesn't allow (openpyxl can no longer read the drawing) | kept | kept |
| Chart | lost | **lost** | kept | kept |
| Table (ListObject) | lost | kept | kept | kept |
| Custom document properties | kept | lost | kept | kept |
| Parts byte-identical, of 23 | 1 | 2 | 10 | **21** |
| File size (original 13,590 B) | 30,064 B (stored, not compressed) | 14,692 B | 13,545 B | 13,806 B |

On #711's own file (`styled.xlsx`), today's save loses A1's fill, A1's bold and A3's top border. ExcelJS and the surgical save keep all three; the surgical save changes one part.

xlsx-js-style 1.2.0 (Apache-2.0) loses the same things as SheetJS today.

## ExcelJS on the real Mac Excel file (one value edit)

- 11 of 13 parts rewritten.
- The workbook's default font size went from 12 to 11, which changes every unstyled cell. In a separate test an Aptos Narrow default came out as Calibri, because ExcelJS writes its own default font (`styles-xform.js:116-118`). Whether `scheme="minor"` hides this in Excel is not verified.
- `baseColWidth="10"` dropped, so default column widths change.
- `ignoredErrors` dropped on all three sheets; the calcFeatures extLst, `codeName` and calcChain dropped; `defaultTableStyle` changed.

The surgical save changed 2 parts: the sheet, and `workbook.xml` for the recalculation flag.

## ExcelJS can't open some valid files

It throws a `TypeError`, because it matches element prefixes and part paths literally, on:
- openpyxl files with an image or chart (unprefixed DrawingML);
- openpyxl's comment part (`xl/comments/comment1.xml`);
- an `x:`-prefixed sheet, as the Open XML SDK writes.

SheetJS and the surgical writer read all three. ExcelJS's last stable release is 4.4.0 (October 2023), with the repo last pushed in January 2025 and 830 open issues.

## The surgical save prototype (`prototype/04-surgical/surgical.cjs`)

- **Finding cells.** It finds the cell by scanning the text, with any namespace prefix. Rows and cells without an `r` attribute get explicit positions first.
- **Writing a cell.** It replaces or inserts only the cell element and keeps its `s` (style). A new cell takes the row's style (`customFormat`) or the column's. A cleared cell keeps its style.
- **Strings.** They go into sharedStrings when that part exists, otherwise inline, escaped, including `_xHHHH_`.
- **Dimension.** `<dimension>` grows when an edit lands outside it.
- **Formulas.**
  - When the cell that anchors a shared formula is overwritten, every dependent gets its own translated formula. The translator passed 7 of 7 cases: absolute refs, quoted sheet names, string literals, structured refs, whole rows and columns, defined names.
  - Edits inside multi-cell array formulas and data tables are refused.
- **Recalculation.**
  - `fullCalcOnLoad="1"` is set on any edit, inserting `calcPr` in schema order if needed.
  - calcChain, with its relationship and content-type override, is deleted only when a formula cell is overwritten.
- **Fuzz test** (`prototype/09-surgical-robustness/fuzz.cjs`, seeded random edits, read back with SheetJS). No cell except the edited ones changed. The runs:

  | File | Edits |
  |---|---|
  | `rich-excelish` | 200 |
  | `rich` (inline strings) | 200 |
  | the Excel-authored file | 100 |
  | an `x:`-prefixed sheet | 100 |
  | rows and cells without `r` | 60 |
  | the 50,000-row file (1,000,020 cells compared) | 300 |

  The first run found a bug with cells that have no `r` (an insert shifted the neighbours). The prototype now fixes it.
- **Read-back.** ExcelJS, SheetJS and openpyxl all read every surgical output back without error.
- **Raw-copy writer.** `prototype/04-surgical/zipRewrite.cjs` (`node:zlib`) left 18 of 22 entries identical down to the local header and compressed bytes. `unzip -t` reports no errors.

## 50,000 rows × 20 columns (a 7.64 MB file, 40 MB of sheet XML)

Node 22, one run each.

| Step | Time | Heap kept | Peak RSS | Output |
|---|---|---|---|---|
| SheetJS read and `sheet_to_json` (today) | 2,837 ms | 221 MB | 623 MB | |
| SheetJS read with a style layer | 3,019 ms | 251 MB | 766 MB | |
| ExcelJS load | 1,344 ms | 364 MB | 604 MB | |
| Our reader (values, style ids, every cell formatted with numfmt) | about 830–885 ms | 73 MB | 538 MB | |
| Save one edit, SheetJS (today, **on every cell commit**) | 3,970 ms | | 1,988 MB | 50.6 MB base64, about 38 MB file |
| Save, ExcelJS | 2,362 ms | | 1,615 MB | 6.37 MB |
| Save, surgical (whole file re-zipped) | 1,052 ms | | 486 MB | 6.73 MB |

## Rendering

- **Styles to CSS.** `prototype/06-render/styles.cjs` turns styles.xml and theme1.xml into one CSS class per `cellXfs` entry.
  - Theme indexes 0–3 swap to lt1, dk1, lt2 and dk2.
  - Indexed colours use the 64-colour palette, or the file's own.
  - Alpha is ignored, and "auto" colours fall back to the default.
- **Tints** are computed in HLS as ECMA-376 §18.8.19 describes.
  - They match SheetJS's resolved values exactly: 4F81BD +0.4 gives 95B3D7, and F79646 −0.25 gives E46C0A.
  - They are within one unit per channel of Excel's published palette: DCE6F2 against DBE5F1.
- **ExcelJS's model adds nothing for rendering.** It leaves theme colours and tints unresolved and does no number formatting.
- **A bug found in today's preview: dates written day first show wrong.** SheetJS's number formatter throws on `dd.mm.yyyy`, `d.m.yyyy` and `dd.mm.yy`, so the grid shows `1/3/26` for 03.01.2026. That is the date format Estonian users type. numfmt 4.1.3 (MIT, maintained) formats them correctly, and the euro, percent and accounting formats too.

## Bundle size (esbuild, minified)

| | Size |
|---|---|
| `media/webview.js` today | 8,875,941 B |
| SheetJS inside it | 496,921 B |
| ExcelJS, browser build | +948,933 B (271 KB gzip) |
| ExcelJS in the host | +1,069,203 B (`out/extension.js` is 5,831,588 B) |
| numfmt | +84,249 B |
| Our reader (prototype) | 7.6 KB |
| fflate unzip | 5.4 KB |

The host writer needs no new dependency: `node:zlib` and `officePackageCheck`.

## Other options

- **SheetJS Pro:** paid, so excluded.
- **xlsx-js-style:** loses what SheetJS loses. Out.
- **xlsx-populate:** keeps the most parts of the libraries, but deletes every formula's cached result and changes rich text; last release 2020. Out.
- **Univer, FortuneSheet/LuckyExcel, x-spreadsheet:** heavy, or they rebuild the file. Out; not tested.
- **HyperFormula:** GPL or commercial, so excluded. Formulas that depend on an edited cell keep stale values in the preview.
- **openpyxl:** Python only, used here for tests.

## Charts, images and conditional formatting, by option

| Option | On save | In the preview |
|---|---|---|
| Today (SheetJS) | removes all three | none |
| ExcelJS | removes charts, rewrites images and conditional formatting | none |
| Surgical | keeps all three byte for byte | none in the first version |

With the surgical save, a chart's cached series should refresh when Excel recalculates (not verified). Drawing images from their anchors is feasible later. Conditional formatting and charts in the preview need their own decision.

## Risks

1. Excel's reaction to the surgical output is not verified. The open points are calcChain removal, `fullCalcOnLoad`, appended or orphaned shared strings, and editing a table header (its column name in the table part).
2. Formulas that depend on an edited cell show stale values in the preview until the file is recalculated, and possibly in apps other than Excel.
3. A bug in shared-formula translation would write wrong formulas.
4. Fidelity limits:
   - pixel widths depend on font metrics, and Calibri and Aptos are missing on a Mac;
   - text that overflows into the next cell is clipped;
   - patterned fills are approximated.
5. Virtualizing with merges and frozen panes is complex. Sorting a sheet with merges needs a UX decision.
6. Dark-theme colours need the Experience lead's decision. The Word preview's white paper is the model.
7. Our reader may handle odd files worse than SheetJS. The SheetJS fallback covers that.
8. Saving a 40 MB sheet takes about 1 s in the host, so the save uses async zlib.
9. numfmt's licence notice in `webview.js` needs checking.
