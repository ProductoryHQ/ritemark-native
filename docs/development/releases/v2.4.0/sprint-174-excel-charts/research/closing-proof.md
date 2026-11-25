# Sprint 174 closing proof

One row per [scenario](../scenarios.md). Test passes cite existing coverage and use equivalent fixtures where noted. The PR 7 [test record](large-sheet.md#byte-checks-on-the-final-pr-7-working-tree) reports the Excel suite passing. PR 4 and PR 4b references use the local branch commits. No new desktop or Excel runs were made for this table.

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | All supported kinds match Excel in place | not run: the full set of final renders has no recorded pass | PR 2 compared columns, bars and lines beside Excel and addressed the differences it found (`edd793ff`). PR 3's `chartLayout.test.ts` covers pie, doughnut, area and scatter. PR 4 adds combo and secondary-axis tests in that file. The scatter recheck awaits the rebuilt workbook. |
| 2 | White charts and cells in Ritemark Dark | not run: no recorded Dark-mode window check | `chartLayout.test.ts` asserts white chart paper. PR 6 records white rule rendering in Dark (`519c8404`). |
| 3 | Theme tints | pass (test: `readChart.test.ts`, `chartLayout.test.ts`) | The Excel fixture's series fills are checked and the same fills reach the bars and legend. PR 1 compared the reader's colours with Excel in [chart-reader.md](chart-reader.md). |
| 4 | Automatic theme accents | pass (test: `readChart.test.ts`, `chartLayout.test.ts`) | The Excel fixture checks the first three accents in order and the layout draws the automatic series. |
| 5 | 3-D column and pie drawn flat | pass (test: `chartLayout.test.ts`) | The Excel column fixture produces flat bars. The pie layout and flat 3-D pie are covered, with Excel reference images recorded in [chart-reader.md](chart-reader.md). |
| 6 | Typing 9,999 redraws the bar | pass (test: `chartLayout.test.ts`) | The sales fixture checks the new bar, and the mounted-chart test checks redraw after the version bump. |
| 7 | Formula-backed chart stays put and the edit notice appears | not run: no recorded edit checks both the chart and the notice | `chartSeries.test.ts` checks that a formula cell supplies its stored value. |
| 8 | Missing external workbook uses saved chart values | pass (test: `chartLayout.test.ts`, `chartSeries.test.ts`) | The lost-source chart's bar uses a saved point, and the external-reference test verifies fallback. |
| 9 | Chart fills its own sheet and the tab keeps the icon | not run: no recorded full chart-sheet window check | `chartLayout.test.ts` checks chart-sheet recognition and layout. The Excel reference image was missing in PR 1. |
| 10 | Click selects the chart and updates the formula bar | pass (test: `chartSelection.test.tsx`) | PR 4 tests the sales chart's selected state, formula-bar text and ring. The real-keypress window check is recorded in `37d0fa3d`. |
| 11 | Copy a selected chart as a picture | pass (test: `chartCopy.test.ts`, `chartSelection.test.tsx`) | PR 4b tests the Copy key path and the PNG clipboard write with a mocked clipboard (`5fd4fdab`, `9c5d7bb5`). |
| 12 | Untitled chart has a kind-only accessible name | pass (test: `chartLayout.test.ts`) | Untitled column layout uses the name “Column chart”. |
| 13 | Unsupported charts keep their cards and the quiet line names them | not run: the dedicated out-of-scope workbook and Excel-made chartex-kind fixtures are missing | Synthetic coverage checks unsupported drawings and combined notices. |
| 14 | 200,000-point scatter matches Excel and scrolls smoothly | not run: no recorded desktop scroll or Excel shape comparison at 200,000 points | `chartLayout.test.ts` checks that thinning retains extrema. The separate scatter comparison still awaits the rebuilt workbook. |
| 15 | Cell save keeps chart parts and Excel opens it without repair | not run: Excel reopen and no-repair-prompt check await Jarmo's gate | `chartsKeep.test.ts` passed the chart, drawing and relationship byte comparisons. |
| 16 | Open and close with no hash, modified-time or dirty-state change | not run: no recorded desktop close check that covers all three assertions | `readWorkbook.test.ts` proves reader input immutability. PR 7's commit reports hash and timestamp checks. The [detailed record](large-sheet.md#byte-checks-on-the-final-pr-7-working-tree) leaves the host check open. |
| 17 | Sales Margin uses a red-yellow-green scale | not run: no recorded comparison for all 30 Margin cells | `ruleEngine.test.ts` checks sampled colours in the equivalent three-colour Excel fixture. |
| 18 | Percentile midpoint and fixed maximum | pass (test: `ruleEngine.test.ts`) | The equivalent Excel fixture uses a three-stop scale with a percentile-50 midpoint and fixed maximum of 100. True two-stop scales have no midpoint. |
| 19 | Scales leave text and blanks plain | pass (test: `ruleEngine.test.ts`) | The mixed-values Excel fixture checks both uncoloured cells and numeric fills. |
| 20 | Signed gradient data bars | pass (test: `ruleEngine.test.ts`, `cellRules.test.ts`) | Excel fixture checks negative and positive fractions, gradient paint, negative colour and axis. |
| 21 | Solid bordered data bars with values hidden | pass (test: `ruleEngine.test.ts`, `cellRules.test.ts`) | The solid bar-only fixture checks the border and hidden value. Cell paint also checks solid fill and border styling. |
| 22 | Greater-than-1000 highlight | pass (test: `ruleEngine.test.ts`) | The Excel fixture checks the matching and nonmatching cells. |
| 23 | Editing B1 recolours dependent cells | pass (test: `cellRules.test.ts`) | The threshold changes through the sheet model, invalidates the rule and changes the paint. |
| 24 | A relative Late formula colours rows | pass (test: `ruleEngine.test.ts`) | Excel fixture checks the affected row cells and competing priority. |
| 25 | COUNTIF highlights duplicates | pass (test: `ruleEngine.test.ts`) | Tests check a duplicate COUNTIF expression and the equivalent Excel fixture's conditional style. |
| 26 | Unsupported formula is named and other rules draw | pass (test: `cellRules.test.ts`) | PR 7 records the INDIRECT fixture check (`0cc6d4df`). |
| 27 | Rank, average, duplicate, blank and error highlights | pass (test: `ruleEngine.test.ts`) | Fixture assertions use expected cells from the [PR 5 Excel comparisons](rules-engine.md), recorded in `e0fec2f5`. |
| 28 | Last-seven-days rule | pass (test: `ruleEngine.test.ts`) | Injected date checks include today and the six previous days, matching the Excel reference recorded in PR 5. |
| 29 | Stop if true prevents lower rules | pass (test: `ruleEngine.test.ts`, `cellRules.test.ts`) | The higher rule supplies the fill and suppresses the lower style. |
| 30 | Higher fill and lower bold combine | pass (test: `ruleEngine.test.ts`, `cellRules.test.ts`) | The priority fixture checks both styles on the same cell. |
| 31 | Icon sets show plain values and are named | pass (test: `cellRules.test.ts`) | PR 7 covers ordinary and x14-only icon sets and a separate overlapping rule (`0cc6d4df`). |
| 32 | Fully drawn chart and rule leave no quiet line | pass (test: `cellRules.test.ts`) | PR 7 tests the combined case (`0cc6d4df`). |
| 33 | Typing recomputes the whole scale | pass (test: `ruleEngine.test.ts`, `measure-50k.ts`) | The engine checks scale calculations and the PR 7 benchmark checks the new maximum colour after an edit invalidates the range facts. |
| 34 | A hidden row counts toward scale limits | pass (test: `ruleEngine.test.ts`) | The fixture checks the hidden row and samples the resulting scale against Excel colours. |
| 35 | 50,000-row desktop paint, scroll and edit | not run: desktop frame and keyboard timing await the dev-instance check | PR 7's [model benchmark](large-sheet.md#50000-rows-r24-scenario-35) passed for window preparation, fact reuse and typed-value preparation (`0cc6d4df`). |
| 36 | Rule XML, extension data and styles survive a save | pass (test: `chartsKeep.test.ts`) | PR 7 records byte equality on the sales report and the other sprint byte fixtures. |
| 37 | A sort remains a view on save | pass (test: `chartsKeep.test.ts`) | The test maps the displayed row to its original cell and checks saved bytes. |
| 38 | Workbook hash survives opening and closing the app | not run: no recorded app-close hash check for this workbook | `readWorkbook.test.ts` checks the fixture's input buffer before and after preview reads and model evaluation. |

## Other open checks

- Rule font colour versus a number format's `[Red]` — not run: waiting for the lead's Excel file.
- Windows — not run: no Windows test-window or clipboard check is recorded.

## Closing check (25 Nov)

The qa-validator signed off with open items on `7eefb46c`.

- Scenarios marked not run in the table (1, 2, 7, 9, 13, 14, 15, 16, 17, 35, 38).
- Four follow-ups awaiting the Experience lead's Excel renders: `[Red]` against the rule font colour, the scatter recheck, chartex fixtures, chart-sheet references.
