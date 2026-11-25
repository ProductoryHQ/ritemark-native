# Sprint 174: Excel charts and colour rules

Track: SDD (auto-detected: more than three user-facing requirements, a parser-heavy domain with edge cases, and a bytes-in/bytes-out guarantee on a person's file). Override with: "use plain full track".
Branch: sprint-174-excel-charts
Release tier: **extension** (no shell-tier path; no new dependency in the recommendation)
Status: **Approved 24 November 2026** through the 2.4 roadmap. Jarmo: "roadmap kinnitatud, lõikejoon ja AI-avaldamine soovituse järgi" (roadmap deck: https://claude.ai/artifact/Lsbc9YDNmC6eWXvYmaZ5H8; ritemark-dev decisions/log.md). The open questions below are settled by the Development manager by their recommendations (Jarmo, 24 Nov: sprint questions are the head of development's).

Parent release: v2.4.0 (`../release-plan.md`, row "Excel charts and colour rules"). Issue: [#971](https://github.com/ProductoryHQ/ritemark-native/issues/971). Drawing: experience 47, step 2 (`product/design/experience/experiences/excel/README.md`, frames 9 and 10, Experience lead, 22 November 2026). The issue's research is in [research/issue-971.md](research/issue-971.md).

## SDD Artifacts
- [spec.md](spec.md): the behaviour contract (R1 to R25)
- [scenarios.md](scenarios.md): examples that become the manual and test matrix
- [technical-plan.md](technical-plan.md): files reused and added, dependencies, the byte proofs
- [tasks.md](tasks.md): the PRs in order, each with its proof
- [sprint-plan.md](sprint-plan.md): this file

## Goal
A workbook shows its charts and colour rules as Excel does, and viewing or saving never changes what the file holds.

## What step 1 (Sprint 158, 2.3) already does, and what step 2 adds
**Already in 2.3.** The workbook is read with our own reader (`readWorkbook.ts`, numfmt for number formats) and drawn by the sheet grid (`SheetGrid.tsx`): widths, heights, fills, fonts, borders, merges, frozen panes, hidden things, dates as written, Carlito and Caladea twins. The save is surgical (`applyCellEdits.ts`): only the edited cells change and every other part keeps its bytes, which includes charts and conditional formatting, proven by the fuzz test. The reader already finds each chart's place, size and title, and counts the sheet's colour rules. The preview shows a chart as a card ("Kept in the file. Open in Excel to see it."), a chart sheet as a card, and draws no colour rule; a quiet line under the bar says what is kept but not drawn.

**Step 2 adds.** The chart drawn in place from its own part, in the file's own colours (seven kinds, R2); the colour rules coloured as Excel does (cell rules, scales, data bars; R11 to R19); a chart chosen and copied (R8); the quiet line shrunk to what is still not drawn (R20); proof that the 2.3 guarantee holds for charts and rules (R21 to R23). Not added: any change to the save, any edit of a chart or a rule, formula recalculation.

## Feature Flag Check
No new flag. The Excel grid sits behind the existing `excel-editing` kill switch only for editing; drawing is a part of the read-only view and stays on (HARD RULE #2). Nothing is removed: the card stays for every chart kind not drawn (HARD RULE #1).

## Pull requests
| PR | Content | Review tier |
|---|---|---|
| 0 | Fixtures made in Excel, Excel's reference renders, and the byte guards (R21, R22) | Light (docs and tests) |
| 1 | The chart reader, nothing drawn | Standard |
| 2 | Columns, bars and lines in place; chart sheet; typed values redraw | Standard, the lead's look |
| 3 | Pie, doughnut, area, scatter | Standard, the lead's look |
| 4 | Combo and second axis; chosen chart; thinning; out-of-scope cards | Standard, the lead's look |
| 4b | Copy a chosen chart as a PNG (R8) | High, plus security review |
| 5 | The rules reader and engine, nothing drawn | Standard |
| 6 | Cell rules, colour scales and data bars drawn | Standard, the lead's look |
| 7 | The quiet line, icon sets, a very large sheet | Standard |

PR 4b adds `img-src blob:` to the Excel webview policy in `excelEditorProvider.ts` for chart Copy. It is High and gets a security review. The other PRs leave that provider untouched.

## Success Criteria
- [ ] Each chart kind in R2 is drawn where Excel puts it, beside Excel's own render of the same file, and the Experience lead has accepted each look.
- [ ] The sales report's Margin scale and Revenue by region chart look as frame 9 draws them.
- [ ] Every rule kind in R11 to R13 colours the same cells as Excel's render does, including a rule that depends on other cells.
- [ ] A typed value redraws a chart and recolours a rule at once.
- [ ] A chart kind or rule outside the first cut shows what it did before, and the quiet line names it.
- [ ] Viewing changes no byte (R21) and one edit plus a save keeps every chart and rule (R22), shown by tests that fail when a part is altered, and by Excel opening the saved files with no repair prompt.
- [ ] The 50,000-row sheet stays within Sprint 158's budget.
- [ ] No new dependency (or, if Jarmo chooses one, free software with its licence in `ATTRIBUTION.md`).
- [ ] Full test chain run once on each final head; `qa-validator` signed off.

## Release notes
One line per drawn thing, in plain words, with the `release-notes` skill. For example: "A workbook's charts show where they sit, as in Excel." and "A workbook's colour rules, scales and bars colour its cells, as in Excel."

PR 2’s chart text formatting and manual layout are covered by the chart entry in the unreleased changelog. Fold that entry into the v2.4.0 release notes when they are drafted.

Fold PR 4b’s chart Copy entry from the unreleased changelog into the v2.4.0 release notes when drafted.

## Out of scope
- Editing a chart or a rule; creating either; changing a chart's kind, colours or data.
- Recalculating formulas: charts and rules read the values the file holds, plus typed values.
- Chart kinds: waterfall, treemap, histogram, funnel, box and whisker, sunburst, maps, radar, stock, bubble, surface and chartex charts (they keep the card). Real 3-D (drawn flat).
- Icon sets (0.2 % of rules): later, the cells show their values.
- Rules whose formula uses a function outside the subset.
- Pictures and shapes (still cards).
- Sparklines, pivot charts' interactivity, slicers, hover values on a chart.
- CSV, which stays as it is. `.xls` files read through SheetJS keep today's grid and show no charts or rules (the new reader is the xlsx path).
- A cloud or a viewer for charts anywhere but the Excel preview.

## Risks
- **The chart's look is a lot of small rules** (automatic colours, nice axis numbers, label placement). Mitigation: Excel's own render is the reference for every fixture; the order draws the most common kinds first.
- **A rule formula read wrongly colours the wrong cells silently.** Mitigation: a small fixed subset, "unreadable" for the rest, and scenarios that test relative references.
- **Excel-made fixtures need a person with Excel.** PR 0 needs the Experience lead's Excel for Mac; Jarmo's real-world set from 158 never arrived, so the fixtures are synthetic.
- **The Windows grid and chart text widths are unverified on a real machine** (as in 2.3).
- **Saved files in Numbers** were not run in 2.3 and are not planned here.
- **Large sheets and big series**: rules computed for the window, series thinned; the measurements are in PR 7's proof.
- **`SheetGrid.tsx` is a shared hot file**: PRs touching it merge one at a time.

## Cut line (Jarmo, 24 November)
If 2.4 runs short, drawing the colour rules in the cells (PRs 6 and 7) moves to 2.5; charts stay in 2.4.

## Open questions (settled by the recommendations, 24 November)
Each with a recommendation. Everything else the drawing already decided.

1. **A chart library, or our own drawing?** Recommendation: our own SVG drawing from the chart's own part, no library. A file's look comes from its XML, which a library's defaults would have to be bent to match; it adds nothing to the bundle or the licence list. A free library (uPlot, Chart.js, ECharts) is possible, at a bundle and licence-line cost.
2. **Who makes the Excel fixtures and references?** Recommendation: the Experience lead, in Excel for Mac as for frames 1 to 8, with synthetic data and a scrubbed creator name. A real-world set from Jarmo, free of client data, would make the proof stronger but is not waited for.
3. **Icon sets: later, as drawn, or in this sprint?** Recommendation: later, as the drawing says. They are 0.2 % of real rules and the cells show their values meanwhile.
4. **Windows?** Recommendation: check a chart and a scale on a Windows machine at Gate 2 (the chart text widths and the 2 px inset have never been looked at on Windows). The sprint does not wait for it.
5. **Hover values on a chart?** Excel shows them. The drawing has none and says nothing new on a chart. Recommendation: not in this sprint (the drawing's rule is "no new elements"); a chart has its accessible name only.
6. **If the release gets tight, which half goes first?** Recommendation: charts first. The rules reader (PR 5) and charts (PRs 1 to 4) can be built side by side, and the thesis names both, so if one half must wait, the rules' cell drawing (PR 6 and 7) waits, because a card for a chart is the more visible gap and the quiet line already says rules are kept.
7. **A sheet's data bars use Excel 2010's look (gradient by default, solid when the file says).** Recommendation: draw what the file's x14 part asks for, as Excel does. Say so if you want the simpler 2007 bar only.

## Approval
- [x] Jarmo approved this sprint plan, through the 2.4 roadmap, 24 November 2026: "roadmap kinnitatud, lõikejoon ja AI-avaldamine soovituse järgi"
