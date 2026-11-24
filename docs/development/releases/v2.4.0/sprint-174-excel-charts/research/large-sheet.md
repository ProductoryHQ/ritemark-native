# Sprint 174 PR 7 measurement and byte checks

## 50,000 rows (R24, scenario 35)

Both runs used the same generated `rules-50k.xlsx` with 1,000,000 cells, a colour scale on column B, a data bar on C and duplicate highlighting on D. Each rule covers all 50,000 rows. The baseline is pre-PR 6 main (`origin/main` at `20189175`). The comparison uses the PR 7 working tree based on `4d0ebc24`.

Times are in milliseconds. PR 7 results are medians of five alternating pairs in fresh Node 22.21.1 processes on macOS arm64.

| Step | Sprint 158 PR 4 | Before PR 6 | PR 7 |
| --- | ---: | ---: | ---: |
| Workbook read | 1,275 | 1,398.85 | 1,331.02 |
| Build sheet layout | 4 | 4.59 | 4.56 |
| Compile rules and range facts | — | — | 59.76 |
| Read through first-window preparation | — | 1,404.36 | 1,399.56 |
| Prepare the last window after a jump | — | 0.40 | 0.91 |
| Type `20000` into B50000, rebuild layout and prepare the last window | — | 4.63 | 50.85 |
| Desktop jump, two frames | ~33 | — | — |

Each window is 40 × 20 cells. The harness uses the workbook reader, sheet layout, visible rule preparation and model's typed-value parser and write. It checks that the last window reuses the compiled rules from the first window, checks paint from all three rules, and verifies that a version change recompiles and gives B50000 the scale's maximum colour. Scroll window preparation costs about 0.51 ms more and the typed edit costs about 46.22 ms more. The first-window totals include workbook read variance. The separately timed 59.76 ms compilation shows the initial rule cost.

Sprint 158 measured desktop scroll frames and separate host edit-validation and save costs. Its published numbers include a 97 ms cold validation in PR 1 and a 918 ms two-edit save with read-back in PR 4. The PR 7 typed edit measures preview work through redraw preparation. The worktree has no VS Code dev build and a standalone headless Chrome launch aborted in the sandbox, so PR 7 has no desktop paint, frame or keyboard-event timing.

To reproduce from the repository root:

```bash
mkdir -p tmp/174-baseline/extensions/ritemark/src
git archive 20189175 extensions/ritemark/webview/src/components/excel | tar -x -C tmp/174-baseline
ln -s "$PWD/extensions/ritemark/webview/node_modules" tmp/174-baseline/extensions/ritemark/webview/node_modules
ln -s "$PWD/extensions/ritemark/src/excel" tmp/174-baseline/extensions/ritemark/src/excel
research=docs/development/releases/v2.4.0/sprint-174-excel-charts/research
loader=./extensions/ritemark/node_modules/tsx/dist/loader.mjs
node --import "$loader" "$research/perf-50k.ts" tmp/174-perf
for run in 1 2 3 4 5; do
  node --import "$loader" "$research/measure-50k.ts" tmp/174-perf/rules-50k.xlsx tmp/174-baseline --before
  node --import "$loader" "$research/measure-50k.ts" tmp/174-perf/rules-50k.xlsx .
done
```

## Quiet line and icon-only cells

Scenarios 26, 31 and 32 each passed. The notice also matched on all 44 sheets in the nine available sprint workbooks and the combined chart, picture and shape case. The lead's icon-set fixture retained the original text and used the grid's base style. Moving a fixture icon set over the colour-rule range in a test confirmed that the colour rule still applies. The dedicated out-of-scope workbook is absent from the branch. The tests used an unsupported chart model for the combined notice case.

## Byte checks on the final PR 7 working tree

| Scenarios | Evidence | Result |
| --- | --- | --- |
| 15 and 36 | `chartsKeep.test.ts` saved one edit on each of nine workbooks, including the sales report. It compared chart and drawing parts and their relationships, styles, and worksheet bytes outside the edited cell, including `conditionalFormatting` and `extLst`. | Passed. Independent one-byte mutations in the chart, rule and style payloads all tripped the guard. |
| 16 and 38 | The R21 reader checks verified SHA-256 on 13 workbooks, including `charts-all-kinds.xlsx`, before and after reading, resolving chart series and evaluating rules. They also checked the fixture files' SHA-256 and modified times. | Passed. |
| 37 | Sorted the sales report through the grid's row ordering, mapped the displayed edit to its original cell, then reran the byte guard on the save. | Passed. |
| Seeded edit fuzz | `applyCellEdits.test.ts` ran 200 edits each on all nine sprint byte fixtures, plus 520 edits across five additional inputs, and checked the read-back with SheetJS and the changed package parts. | Passed with zero edits refused. |

The byte checks exercised preview readers and saves in Node. Desktop close and dirty-state checks and Excel's repair-prompt check remain unverified.

The full `test:excel` list, `securityBackports.test.ts`, `inputMode.test.ts`, both TypeScript checks and the webview build passed. The TSX CLI could not bind its sandbox IPC socket, so the test files ran through `node --import tsx`. The repository QA wrapper includes local `git push` operations in its harness tests and was skipped under the brief's no-push instruction.
