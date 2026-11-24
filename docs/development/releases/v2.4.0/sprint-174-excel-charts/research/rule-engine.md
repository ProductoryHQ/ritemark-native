# PR 5 rule engine results

The cell addresses below are one-based. The synthetic expectations are asserted in
`ruleEngine.test.ts`, using 24 November 2026 as the current date.

| Fixture or range | Engine result |
| --- | --- |
| A2:A5 | A2 combines the amber fill, bold text and two borders. A3 takes the higher red fill and stops. A4 and A5 stay plain. |
| B2:D5 | B2 and B4 contain the text, C2 and C4 begin with it, and D2 and D4 end with it. |
| E2:H5 | E2:E4 are blank, F5 is nonblank, G2 and G5 contain errors, and H3:H5 have no errors. |
| I2:J5 | I2 and I3 are duplicates. J4 is unique. |
| K2:M5 | K2 and K3 tie for top rank, L2 and L3 tie for the bottom quarter, and M3 and M4 meet or exceed the average. |
| N2:N5 | N3 and N4 fall in the preceding seven calendar days. N2 comes just before the window and N5 is today. |
| O2:P5 and O8:P9 | O2:P2, O4:P4 and O8:P8 turn amber. The relative formula uses the top-left of each area. |
| Q2:Q5 | Q2 and Q4 match the COUNTIF expression. |
| R2:R5 | The INDIRECT rule is reported as unreadable. R3 still takes the lower bold style. |
| S2:S5 | Red, yellow and green at S2, S3 and S4. S5 holds text. |
| T2:T5 | Black, #404040 and white at T2, T3 and T4. The formula supplies the upper threshold. |
| U2:U5 | Gradient bars use an axis one-third across the cell. Their widths are one-third, one-sixth, zero and two-thirds. |
| V2:V5 | The x14 twin supplies a centred axis, solid bars, borders and a separate negative colour. The value is hidden in the result metadata. |
| W2:W5 | The engine reports the icon set. The cells have no rule style. |
| X2:X5 | X2 and X5 match the text exclusion. |
| Y2:Y5 | Black, #404040, #808080 and white. The scale clamps at its numeric maximum of 100. |
| `rich.xlsx` | B3 and B4 take the cell rule fill and B3:B10 have gradient bars. C3:C10 lack cached formula values and receive no scale fill. |
| `rich-excelish.xlsx` | B3 and B4 take the cell rule fill and B3:B10 have solid bars. C3:C10 are #63BE7B, #B88D72, #EE6F6C, #E7736D, #F26C6C, #F8696B, #CC8270 and #F06E6C. |

Comparison against Excel's render awaits `rules-all-kinds.xlsx` and
`rules-icons-unreadable.xlsx`.
