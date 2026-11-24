# Sprint 174 scenarios

Workbooks made in Excel (the fixture set in PR 0) or, where noted, by the openpyxl and spike scripts. Synthetic data only. Each row is a test or a manual check; every chart row's proof is Excel's own render of the same file beside ours.

| # | Given | When | Then | Spec |
|---|---|---|---|---|
| 1 | `charts-all-kinds.xlsx`, saved by Excel for Mac: one sheet per kind in scope (clustered column, stacked column, 100 % stacked, bar, line, line with markers, pie, doughnut, scatter, area, stacked area, column-and-line combo with a second axis) | It is opened | Each chart is where Excel puts it, at its size, in the file's colours, with title, legend, axes and gridlines as Excel's render shows | R1, R2, R3 |
| 2 | The same workbook, in Ritemark Dark | It is opened | The charts and cells stay on white paper | R9 |
| 3 | A column chart with theme-coloured series with tints | Opened | The colours match Excel's render, including the tinted ones | R3 |
| 4 | A chart whose series carries no colour (automatic) | Opened | Series take the theme's accents in Excel's order | R3 |
| 5 | A 3-D clustered column and a 3-D pie | Opened | Each shows as its flat twin, not as a card | R4 |
| 6 | The sales report: a chart over Q5:Q7 | A person types 9,999 into Q6 | The bar for Q6 redraws at once | R7 |
| 7 | A chart over formula cells | A person types over a cell the formulas read | The chart does not move; the line after the edit says totals update in Excel | R7 |
| 8 | A chart whose source is another workbook that isn’t there | Opened | It draws with the values Excel saved in the chart | R7 |
| 9 | A chart on a chart sheet ("Revenue trend") | The tab is chosen | The chart fills the sheet; the tab has its chart icon | R5 |
| 10 | A chart | It is clicked | The accent ring shows; the bar says "Chart · Revenue by region · a column chart from Q5:Q7. Change it in Excel." | R8 |
| 11 | A chosen chart | Copy | A picture of the chart is on the clipboard | R8 |
| 12 | A chart with no title | Opened | It draws without one; its accessible name is its kind | R10 |
| 13 | `charts-out-of-scope.xlsx`: a waterfall, a treemap, a radar and a bubble chart, with a column chart beside them | Opened | The column chart draws; the other four keep the card at their own place and size; the line names them once | R6, R20 |
| 14 | A sheet with a scatter chart of 200,000 points | Opened | It draws from a thinned copy; scrolling stays smooth; the shape matches Excel's | R25 |
| 15 | A workbook with a chart | Opened, one cell edited and saved | The saved file's chart parts, drawing parts and their relationships are identical to the original's; Excel opens it with no repair prompt and the chart is as before | R22 |
| 16 | A workbook with a chart | Opened and closed with no edit | The file's hash and modified time are unchanged; the document was never marked changed | R21 |
| 17 | The sales report's Margin column with a three-colour scale (red, yellow, green) | Opened | Its 30 cells are coloured as Excel's render shows (frame 9) | R12 |
| 18 | A two-colour scale with a midpoint of "percentile 50" and a maximum of "number 100" | Opened | The blend follows those stops, not the data's own highest | R12 |
| 19 | A scale over a range holding text and blanks | Opened | Text and blank cells are not coloured; the numbers are | R19 |
| 20 | A data bar column with positive and negative numbers, gradient fill | Opened | Bars sit either side of the axis, negative ones in the negative colour, as Excel draws them | R13 |
| 21 | A solid-fill data bar with a border and "show bar only" | Opened | The border shows and the number is hidden | R13 |
| 22 | A cell-value rule: "greater than 1000" in red fill | Opened | Cells above 1000 are red; the rest plain | R11 |
| 23 | **A rule that depends on other cells:** "greater than $B$1" over C2:C20 | B1 is changed by typing | The colours of C2:C20 change at once | R15, R18 |
| 24 | **A formula rule that depends on other cells:** `=$D2="Late"` over A2:F20, fill amber | Opened | Whole rows whose D is "Late" are amber, the formula read relative to A2 | R15 |
| 25 | A formula rule using `COUNTIF($A$2:$A$20,A2)>1` | Opened | Duplicates are coloured | R15 |
| 26 | A formula rule using a function outside the subset (for example `INDIRECT`) | Opened | Its cells stay plain; the line names "a colour rule it can't read"; the sheet's other rules still draw | R16 |
| 27 | Top 3 and bottom 10 % rules, above average, duplicate values, blanks, errors | Opened | Each colours the cells Excel's render shows | R11 |
| 28 | A "dates occurring: last 7 days" rule, with the clock set to a known day (the test injects the date) | Opened | The seven days before it are coloured | R11 |
| 29 | Two rules over the same cells, the higher one with "stop if true" | Opened | The higher rule's fill wins; the lower never colours those cells | R14 |
| 30 | A higher rule that sets a fill, a lower one that sets bold | Opened | Both apply | R14 |
| 31 | An icon-set rule | Opened | The cells show their values uncoloured; the line names the icon sets | R17 |
| 32 | A sheet with a chart of an in-scope kind and a drawn rule only | Opened | There is no quiet line | R20 |
| 33 | A cell under a colour scale | A number is typed over it | The scale's colours for the whole range are recomputed at once | R18 |
| 34 | A hidden row inside a scale's range | Opened | The hidden row still counts toward the range's lowest and highest, as in Excel | R19 |
| 35 | **A very large sheet:** 50,000 rows with a colour scale, a data bar and a duplicate rule over all of them | Opened, scrolled to the end, one cell typed | First paint, scrolling and the edit stay within the budget; the duplicate rule is not recomputed per scroll | R24 |
| 36 | The sales report | One cell edited, saved, and the saved file read back | Every `conditionalFormatting` element and the `extLst` in the sheet are identical outside the edited cell; `styles.xml` is identical | R22 |
| 37 | The save, with a sort active | Saved | Sorting is a view; no chart or rule part changes | R23 |
| 38 | `charts-all-kinds.xlsx` | It is opened in the preview and the app is closed | `shasum` of the file before and after is the same | R21 |

Map charts are out of scope because they need Bing.
