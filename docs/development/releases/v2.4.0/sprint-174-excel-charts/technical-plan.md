# Sprint 174 technical plan

Release tier: **extension**. Nothing here touches a shell-tier path (`CLAUDE.md`): no patch, no `vscode`, no `product.json`, no binaries, no workflow, no build script. All new code is webview code under `extensions/ritemark/webview/src/components/excel/` that `media/webview.js` carries, which an extension release ships. No esbuild external is added (the host bundle is not touched). If a PR finds it must touch the host, `ExcelDocument`, `excelEditorProvider.ts` or `src/excel/applyCellEdits.ts`, it stops and the plan is revised: those paths write a person's file, which `REVIEW.md` rates High.

## What step 1 already gives (reused as it is)

- **The reader.** `readWorkbook.ts` opens the package with JSZip (already a webview dependency) and already finds each sheet's drawing: `readDrawings(zip, drawingPath)` returns a `DrawingModel` (`what: 'chart' | 'image' | 'shape'`, `title`, `anchor`) for every chart, from its `xdr:` anchors and the drawing's relationships; `chartTitle(xml)` reads a title; `readChartSheet` handles chart sheets; `layout.conditionalFormats` counts `conditionalFormatting` elements and nothing more. The helpers `text(zip, path)` and `rels(zip, path)` open parts.
- **Colours.** `excelStyles.ts`: `readTheme`, `applyTint`, `colorOf(tag, ctx)`, `colorContext`, `fontOf`, `readStyles`. These already turn `<a:schemeClr val="accent1"><a:lumMod …/>` style tags into CSS colours for cells; charts and rule styles use the same functions.
- **Numbers.** `numberFormat.ts` `formatCellValue(value, code, date1904)` for axis labels and data labels; `codeOf(model, s)` for a cell's format.
- **Placement.** `SheetGrid.tsx` `objects(kind, place)` already positions each drawing from `X` and `Y` (column and row offsets) and decides which frozen region draws it (`reaches`). Charts replace the card's contents there; the position code is untouched. `sheetLayout.ts` `buildLayout` already extends the sheet to the drawing's end cell.
- **Fonts.** `GRID_SANS`, `GRID_SERIF`, `fontCss`, `fontShorthand` and the bundled Carlito and Caladea subsets.
- **The card.** `sg-object` stays as the fallback for kinds out of scope, with its text and tooltip.
- **The quiet line.** `keptNotice(layout)` in `SpreadsheetViewer.tsx` (line 76) counts `drawings` and `conditionalFormats`. It changes from "everything is kept" to "what is still not drawn" (R20). The chart sheet's card (line 647, "The preview doesn't draw charts yet.") is replaced only for chart kinds in scope.
- **The save and its guards.** `src/excel/applyCellEdits.ts`, `xlsxPackage.ts` (raw copy of untouched parts), `sheetXml.ts` and the seeded fuzz test already keep every part and every other cell. This sprint changes none of them; it adds proof that they hold for charts and rules (below).
- **The proof tools.** `docs/development/releases/v2.3.0/sprint-158-excel/research/proof/` (`drive-excel.cjs`, `perf-50k.ts`, `read-50k.ts`, `save-compare.ts`) and the spike's four fixtures; `src/excel/fixtures/rich.xlsx` and `rich-excelish.xlsx` already carry a chart, a colour scale, a cellIs rule and a data bar with its x14 twin (openpyxl, not Excel).

## New files (webview, `components/excel/`)

| File | What |
|---|---|
| `chartModel.ts` | Types: `ChartModel` (kind, plots, series, axes, title, legend, text styles) and `ChartKind`. |
| `readChart.ts` | Pure. Parses a chart part (`c:chartSpace`) to a `ChartModel`: `c:barChart` (`barDir`, `grouping`), `c:lineChart`, `c:areaChart`, `c:pieChart`, `c:doughnutChart`, `c:scatterChart`, the 3-D twins (`bar3DChart` and so on, read as flat), several plots in one `c:plotArea` (combo), `c:valAx`/`c:catAx`/`c:dateAx` and which axis a plot uses, series `c:tx`, `c:cat`, `c:val`, `c:xVal`, `c:yVal` (reference and cache), `c:spPr` colours through `colorOf`, `c:dLbls`, legend, title, gridlines, number formats. A `chartex` part or an unknown plot returns `{ supported: false, kind }`, so the card stays. Wired into `readDrawings`, which now keeps the parsed model on `DrawingModel`. |
| `chartSeries.ts` | `resolveSeries(model, sheets, workbook)`: turns a series' reference (`'Sheet 1'!$Q$5:$Q$7`) into values by reading the sheet's `cells` map, falling back to the part's cache (R7). Pure and the only place a typed edit reaches a chart. |
| `chartLayout.ts` | Pure geometry: axis ranges and "nice" ticks as Excel picks them, category bands, stacking, the second axis, label thinning, legend position, the 5,000-point thinning (R25). |
| `ChartView.tsx` | Draws a `ChartLayout` as one SVG, on white, in the grid's font. No library. Chosen state (accent ring) and the accessible name. |
| `chartCopy.ts` | SVG to PNG on a canvas and onto the clipboard (R8). |
| `formulaRef.ts` | A1 reference and range parser shared by chart series and rules (sheet-qualified, absolute and relative, whole columns). |
| `readRules.ts` | Pure. Parses each sheet's `conditionalFormatting` blocks: `cfRule` types `cellIs`, `containsText`, `beginsWith`, `endsWith`, `containsBlanks`, `notContainsBlanks`, `containsErrors`, `notContainsErrors`, `duplicateValues`, `uniqueValues`, `top10`, `aboveAverage`, `timePeriod`, `expression`, `colorScale`, `dataBar`, `iconSet`; priority, `stopIfTrue`, `dxfId`, `sqref`; and the x14 `extLst` data bar (axis, negative colour, gradient or solid, border). The workbook-level differential styles (`dxfs` in `styles.xml`) are added to `readStyles`. |
| `ruleFormula.ts` | A small expression reader and evaluator for rule formulas. Subset: numbers, strings, booleans, A1 refs (relative to the range's top-left cell), `+ - * / ^ & = <> < <= > >=`, `AND OR NOT IF`, `ISBLANK ISNUMBER ISTEXT ISERROR ISEVEN ISODD`, `MOD ROW COLUMN`, `LEN LEFT RIGHT MID UPPER LOWER`, `ABS`, `SUM AVERAGE MIN MAX COUNT COUNTA COUNTIF` over a range, `TODAY`, `DATE`. Anything else returns "unreadable" and R16 applies. No `eval`, no `Function`. |
| `ruleEngine.ts` | Pure. `compileRules(sheet, rules, ctx)` computes the per-range facts once per sheet version (lowest, highest, percentiles, ranks, average, duplicate set, the date window) and returns `styleAt(row, col)`: the combined dxf style, a colour-scale fill and a data bar `{ fraction, from, color, negative, gradient }`, honouring priority and stop-if-true (R14). Takes the date as an argument, so tests pin the day. |
| `cellRules.ts` | Joins `ruleEngine` to `SheetGrid`: the visible window only (R24); invalidated by an edit of any cell a rule reads (R18). |

## Changed files

- `readWorkbook.ts`: `DrawingModel` gains `chart?: ChartModel`; `SheetLayoutInfo.conditionalFormats: number` stays (the line needs it) and gains `rules: RuleSet`. `readDrawings` calls `readChart`.
- `excelStyles.ts`: reads `dxfs` (font, fill, border, number format of a differential style).
- `SheetGrid.tsx`: `objects()` renders `ChartView` for a supported chart and the card otherwise; the cell layers take `cellRules` for fills, font changes, borders and bars; the selection ring for a chart and a chart's entry in the formula bar text (R8).
- `SpreadsheetViewer.tsx`: `keptNotice` names only what is not drawn; the chart-sheet card appears only for unsupported kinds.
- `docs/development/architecture.md`: the Excel contract gains "charts and rules are drawn from the file, never written".
- `branding/ATTRIBUTION.md`: only if a dependency is added (it is not, in the recommendation).
- `docs/CHANGELOG.md` and the release-notes lines, one per PR.
- Tests beside each new file; `package.json`'s test list gains them.

## Dependencies: none new (recommended)

**Recommendation: draw charts with our own SVG, from the chart part, with no chart library.**

Why. A chart must look as Excel draws the file, which means the file's colours, order, gap widths, axis scales and text. A library draws its own defaults and each file's look has to be forced onto it, which costs more than drawing the seven kinds directly from the model (bars, lines, areas, arcs and points on a computed scale). The seven kinds are about 99 % of real charts. It adds no bundle weight to `media/webview.js`, no licence entry and no supply-chain surface.

If Jarmo prefers a library, the free candidates are uPlot (MIT; no pie or bar), Chart.js (MIT) and Apache ECharts (Apache-2.0; the largest). Each is free software, so Ritemark's rule holds, but each adds its licence line to `branding/ATTRIBUTION.md` (reaching users with the next shell release) and a bundle cost. Mermaid, which the bundle already holds, is a diagram tool and exposes no chart drawing we could reuse.

## How "viewing never changes the bytes" is proven

1. **By construction.** Every new file is a pure read of the `Uint8Array` the reader already receives; none imports the host, `ExcelDocument` or `applyCellEdits`. A test (`readWorkbook.test.ts`, extended) hashes the input before and after `readWorkbook`, `readChart` and `compileRules` on every fixture and asserts it is unchanged.
2. **On a real file.** For each fixture (scenarios 16 and 38), in a dev instance: `shasum -a 256` and the modified time before opening, after drawing every sheet and after closing; the document is never marked changed (the tab has no dot, closing asks nothing).

## How "a save keeps charts and rules" is proven

1. **The part-level test** (`src/excel/chartsKeep.test.ts`, new, tests only): for each fixture that carries a chart or a rule, apply one cell edit with `applyCellEdits`, then compare the two packages part by part. Every part except the edited sheet's XML and `workbook.xml` (the `fullCalcOnLoad` flag) must be byte identical, and the test names the chart parts, drawing parts, their `.rels`, `styles.xml` and `theme1.xml` explicitly so a regression names the part.
2. **The sheet-level test**: in the edited sheet's XML, cut out the edited `<c>` and compare the rest. Every `<conditionalFormatting>` block, the `<drawing>` and `<legacyDrawing>` elements and the whole `<extLst>` (x14 data bars) must be equal.
3. **The seeded fuzz test** from Sprint 158 is run again on the new fixtures.
4. **Excel itself**: Jarmo's gate. The saved files open in Excel with no repair prompt, the charts are there and the colours are as before (scenario 15). Numbers is not run unless Jarmo supplies a Mac with it; this is the same gap as Sprint 158's.

## The proof for the look

As in Sprint 158: the Experience lead captures each fixture in Excel for Mac at 100 % (`reference/`), and each PR's screenshot is the same file in the dev instance beside it. A baseline diff is suspects, not approval: zoom on every join. The accounting-style gap Sprint 158 left on purpose is not reopened. Windows chart text widths are not verified on a real machine; this is stated, not hidden (open question 4).

## Risks in the build

- **Automatic colours and chart styles.** Excel 2013 and later writes explicit `spPr` on each series, older files rely on `c:style`. The reader needs both; a file that gives neither takes the theme's accents in order. PR 2 covers both with fixtures from Excel and from LibreOffice, openpyxl and Google Sheets exports.
- **Axis "nice numbers".** Excel's automatic axis maximum is its own rule. PR 2 compares ticks to Excel's render on each fixture; where the file fixes min, max or unit, those win.
- **Rule formulas.** Excel evaluates a formula relative to the range's top-left cell; getting that wrong colours the wrong rows silently. Scenarios 24 and 25 are the guard, and any function outside the subset is "unreadable", never guessed.
- **Date rules** depend on today's date; the engine takes the date as an input.
- **`SheetGrid.tsx` is big and shared.** PR 2 to PR 4 touch its objects layer, PR 6 its cell layers. They do not run in parallel on the same file.

## Review tier per PR

Every PR is Standard or Light by path: `webview/src/` (not `App.tsx`, not `documentSyncReducer.ts`, not `editorValueReconciliation.ts`, not `src/editorSync/`, not `src/ritemarkEditor.ts`). A PR that changes how the sheet looks also goes to the Experience lead with its one screenshot (`REVIEW.md`). The save-keeps proof (PR 0) is tests only, so Light; if it needs a change in `src/excel/` code, that PR is re-rated High and gets `/security-review`.
