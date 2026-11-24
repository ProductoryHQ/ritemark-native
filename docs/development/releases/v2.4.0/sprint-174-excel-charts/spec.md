# Sprint 174 spec: Excel charts and colour rules

The behaviour contract is experience 47, step 2 (`product/design/experience/experiences/excel/README.md`, "Step 2: charts and colour rules (2.4)", frames 9 and 10, drawn 22 November 2026). This file numbers it for tests. If they differ, the README wins and this file is corrected. Step 1 (Sprint 158, in 2.3) is the base: see the sprint plan for what it already does.

"As Excel draws it" means Excel's own render of the same file, at 100 %, is the reference. Where this spec says "the file's own colours", it means the colours the chart part, the theme and the rule's own style name, not a palette of ours.

## Charts

- **R1. In place.** A chart is drawn where its anchor puts it, at its anchor's size, covering the cells it covers, in the grid's drawing layer where today's card sits (`SheetGrid.tsx` `objects()`). It scrolls and freezes with the cells as the card does.
- **R2. First kinds.** Drawn: column and bar (clustered, stacked, 100 % stacked), line (with or without markers), pie and doughnut, scatter, area (standard and stacked), and combo (columns with a line, the line optionally on a second axis). Order of work follows the evidence: column 48 %, line 32 %, combo 10 %, pie 7 %, scatter 2 %, area 1 % of real charts.
- **R3. The file's own look.** Each chart uses its file's series colours (theme colours with tints, RGB, the automatic accent cycle when the part gives none), title, legend and its position, axis titles, axis number formats, gridlines, data labels and the plot's own order and gap width. Text uses the grid's font twin for Calibri (`GRID_SANS`) so widths match Excel.
- **R4. 3-D drawn flat.** A 3-D column, bar, pie or line chart is drawn as its flat twin, not as a card.
- **R5. Chart sheets.** A chart sheet's chart fills the sheet, and the tab keeps its chart icon.
- **R6. Out of scope kinds keep the card.** Waterfall, treemap, histogram, funnel, box and whisker, sunburst, maps, radar, stock, bubble, surface and any `cx:` (chartex) chart keep today's card ("Kept in the file. Open in Excel to see it."), at their place and size. The quiet line under the bar names them once per sheet.
- **R7. Reads the sheet as it is.** A series reads its cells from the sheet as the grid holds them. Typing a number into a cell a chart reads redraws the chart at once. A series whose cells cannot be read (another workbook, a name that does not resolve, a sheet that is gone) is drawn from the values the chart part cached. Formulas are not recalculated: a chart over formula cells moves when Excel recalculates.
- **R8. Chosen, not edited.** A click on a chart rings it in the accent, as a cell is ringed, and the formula bar says "Chart · <title> · a <kind> from <range>. Change it in Excel." (frame 10). The chart can be copied as a picture. Nothing about a chart can be changed here.
- **R9. White paper.** Charts stay on white in Ritemark Dark, as the cells do (Sprint 158 decision 1).
- **R10. Every chart has a name.** The drawn chart carries an accessible name: its title and kind, or its kind alone when it has no title.

## Colour rules

- **R11. Cell rules.** Cells matching a rule take its style: cell value (equal to, not equal to, greater, less, between, not between), contains text, begins with, ends with, blank, no blanks, errors, no errors, duplicate and unique values, top and bottom N and N %, above and below average, and dates occurring (today, yesterday, tomorrow, last 7 days, this/last/next week, month, and so on). The style is the rule's own: fill, font colour, bold, italic, underline, strike and borders from the file's differential styles.
- **R12. Colour scales.** Two- and three-colour scales colour the cells as Excel does: the minimum, midpoint and maximum by lowest, highest, number, percent, percentile or formula, with the colours blended in between.
- **R13. Data bars.** Data bars are drawn with Excel's own defaults: the file's colour, gradient or solid fill, a border when it asks, the bar's minimum and maximum lengths, the axis and a negative bar's colour for negative values, and "show bar only" (the value hidden).
- **R14. Several rules.** Rules apply by priority, as Excel does: a higher rule's fill wins over a lower one's, styles that do not clash combine, and "stop if true" stops the cells below it. Rules over several ranges and rules on several sheets are kept apart.
- **R15. A rule that reads other cells.** A rule with a formula, or one that compares against a cell ("greater than $B$1"), reads those cells as the sheet holds them, relative to the range's top-left cell as Excel does, and re-colours when one is typed over.
- **R16. A formula the preview cannot read.** When a rule's formula uses something the reader does not know (see technical-plan.md for the subset), its cells stay plain and the quiet line says so. The rest of the sheet's rules still draw.
- **R17. Icon sets are later.** Icon-set rules colour nothing. The cells show their values and the quiet line names the icon sets.
- **R18. A typed value recolours at once.** Typing into a cell a rule covers, or one that its scale, bar, rank or formula reads, recolours the cells at once.
- **R19. Hidden and text cells.** Hidden rows and columns count in a scale's range as Excel counts them. Text and blank cells are never coloured by a scale or a bar.

## The quiet line

- **R20.** The quiet line under the bar (`keptNotice` in `SpreadsheetViewer.tsx`) names only what is still kept but not drawn on the sheet: chart kinds out of scope, icon sets, rules whose formula cannot be read, and pictures and shapes as today. When nothing is left to name, the line is gone (frame 9).

## The file

- **R21. Viewing changes no byte.** Opening a workbook, drawing its charts and rules, scrolling, choosing a chart and switching sheets read the file's bytes and write nothing. The document is not marked changed, the file's modified time does not move and its hash is the same after closing as before opening.
- **R22. A save keeps charts and rules.** After one cell is edited and saved, every part of the file except the edited sheet's XML (and `workbook.xml`'s recalculation flag, as in 2.3) is byte for byte what it was, including every chart part, drawing part, their relationships, the styles part (where rules' differential styles live) and the theme. Inside the edited sheet's XML, everything outside the edited cell is the same bytes: every `conditionalFormatting` element, every `drawing` and `legacyDrawing` reference and the whole `extLst`, which carries x14 data bars.
- **R23. Nothing new is written.** Neither a chart nor a rule is ever written by Ritemark. No chart or rule is created, changed or removed by an edit, a sort (a view) or a save.

## Speed

- **R24. A very large sheet.** On a 50,000-row sheet with a colour scale, a data bar and a duplicate rule on 50,000-row ranges, the first paint, a scroll and a typed edit stay within Sprint 158 PR 4's measured budget plus the rule cost measured in PR 7. Rules are evaluated for the rows on screen; a range's lowest, highest, ranks and duplicates are computed once per sheet version, not per scroll.
- **R25. A chart over a very large range.** A series over more than 5,000 points is drawn from a thinned copy that keeps each bucket's lowest and highest, so the shape holds and the page stays smooth.
