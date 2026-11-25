# Conditional formatting on 50,000 rows

Measured on macOS arm64 with Node 22.21.1. The sprint's `research/perf-50k.ts` generated `rules-50k.xlsx`, with 50,000 rows, 20 columns, and a whole-column rule for each of the colour scale, data bar and duplicate fill.

| Step | Wall time |
| --- | ---: |
| Workbook read | 1,579 ms |
| Sheet layout | 4.71 ms |
| Initial rule compilation | 64.03 ms |
| First window rule preparation | 2.15 ms |
| Jump to the last window | 0.61 ms |
| Scroll across 200 windows, median / p90 | 0.23 / 0.33 ms |
| Type 20000 into B50000, recompile and prepare the last window | 52.63 ms |

Each window was 40 × 20 cells. The first pass looked up rules for text measurement. The second reused those lookups to compose the cell style and prepare bar CSS. The scroll reused the compiled rules across all 200 windows. The typed edit used the preview's normal value parser and model write, then refreshed the rule facts and checked that the edited cell reached the scale maximum.

Sprint 158 PR 4 recorded a 1,275 ms workbook read and 4 ms sheet layout in Node, and about 33 ms for two frames after a jump in the dev app. The PR 6 measurements isolate the rule work in Node. Desktop frame timing and visual comparison with Excel remain for the manager's run.
