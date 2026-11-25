# Sprint 174 fixtures: Excel-made charts and colour rules

**Status (25 November 2026, Experience lead):** all nine workbooks are made and every sheet has Excel's render. For ritemark-native Sprint 174, PR 0 part B (`tasks.md`), PR 1 and on. Everything in the files is made up: Harbour Logistics' depots, drivers and numbers.

## How they were made

1. `make/make_base.py` writes each workbook's data and colour rules with XlsxWriter, which writes rule XML the way Excel does (x14 data bars included).
2. `make/build_one.sh` opens it in Excel for Mac 16.115 in the background, and `make/add_charts.applescript` has Excel apply the Office 2013 - 2022 theme (Calibri, the blue, orange, grey and gold accents most received workbooks carry) and add every chart: a chart object, its source, its type, then chart style 201, the style a chart inserted from Excel's ribbon gets. Excel then saves the file in place, so every part of every file, rules and theme included, is Excel's own serialization.
3. `make/scrub.py` takes the saving person's name and folder out (`docProps/core.xml`'s creator and last modified by, `xl/workbook.xml`'s `x15ac:absPath`, an external link's absolute path) and changes no other part's bytes. Run it on any file Excel saves again.
4. `make/capture.sh` opens each file again in the background, shows every sheet at 100 % scrolled to A1 in a 1400 × 900 point window, captures that window alone, closes the file unsaved and checks its hash is unchanged.

The references are in `reference/`, one PNG per sheet, named `<file>--<n>-<sheet>.png`, 2800 × 1800 pixels (2×). They show Excel's whole window, ribbon included; crop to the grid when comparing.

## The files

| File | Sheets | Scenarios | Notes |
| --- | --- | --- | --- |
| `charts-all-kinds.xlsx` | Clustered column, Stacked column, 100% stacked column, Bar, Stacked bar, 100% stacked bar, Line, Line with markers, Area, Stacked area, Pie, Doughnut, Scatter, Combo | 1, 2, 12, 38 | Area has no title (12). Pie has data labels. Combo: columns with a line on a second axis. The scatter is one series, Minutes late against Distance (column A as x), remade on 25 November. |
| `charts-axis-zero.xlsx` | Close values, Spread values | #1043 follow-up | Each sheet has a clustered column and a clustered bar chart. Excel uses 920–1,010 for values 951–1,000 and 0–1,200 for values 610–1,000. |
| `charts-colours.xlsx` | Theme tints, Set colours, Automatic, Labels and axes | 3, 4 | Theme tints: eight series, so Excel's cycle runs past the six accents into tinted ones (`schemeClr` with `lumMod`/`lumOff`), and series 1 set to accent 6 by hand. Set colours: three RGB fills. Automatic: no series carries a colour (no `spPr`), as Excel keeps it. Labels and axes: data labels, axis titles, a percent axis, the legend on top. |
| `charts-3d.xlsx` | 3-D column, 3-D bar, 3-D line, 3-D pie | 5 | |
| `charts-out-of-scope.xlsx` | Out of scope, More kinds | 13 | Out of scope: a column chart that draws, beside a waterfall, a treemap, a radar, a bubble and a sunburst (13). More kinds: a histogram, a funnel, a box and whisker, a stock (high, low, close) and a surface. The six newer kinds are chartex parts (`xl/charts/chartEx1…6.xml`; the histogram's layout is `clusteredColumn` with binning, as Excel writes it); Excel's scripting can't create them, so each came from Excel's own Insert > Chart menu on the chosen cells (`make/chartex.applescript` chose the cells, placed each chart and set its title). Maps need Bing's service and are left out. Extra references: `--01b` (the lower charts), `--02b` and `--02c` (More kinds' charts to the right and below). |
| `chart-sheet.xlsx` | Revenue trend (a chart sheet), Data, Lost source | 7, 8, 9 | Revenue trend reads Data's Revenue column, which is formulas (7). Lost source's chart read `old-data.xlsx`, a workbook left out of the set, so it has only Excel's cached values and Excel asks about the link when it opens (8). Excel itself can't make the drawn-from-cache case by deleting a sheet: it recalculates the chart to `#REF!` at once. |
| `rules-all-kinds.xlsx` | Cell value, Text and blanks, Top and average, Dates, Scales, Data bars, Other cells, Priority | 17 to 25, 27 to 30, 33, 34 | Cell value: greater than 1000 in red (22), between, equal, not between, not equal, less than with a border. Dates: last 7 days and seven more periods over 3 to 26 November 2026; the references were taken on 24 November. Scales: red-yellow-green (17), a percentile 50 midpoint with a number 100 maximum (18), a range with text and blanks (19), a hidden row 9 inside a scale (34). Data bars: gradient with negatives (20), solid with a border and bar only (21). Other cells: greater than `$B$1` (23), `=$D3="Late"` over A3:F20 (24), `COUNTIF` duplicates (25). Priority: stop if true (29), a fill rule above a bold rule (30). |
| `rules-format-colour.xlsx` | Format colour | (the Development manager's question, 25 November) | A number format's own colour against a rule's font colour, five cells: Excel shows the rule's font colour over the format's `[Red]` or `[Blue]` (B2 and B5 green, B4 purple); a rule that sets only a fill leaves the format's red text on its fill (B3); with no rule the format's red stands (B6). |
| `rules-icons-unreadable.xlsx` | Icon sets, Unreadable formula | 26, 31 | Traffic lights and arrows beside a value rule that draws (31); an `INDIRECT` rule beside one that draws (26). |

The 50,000-row workbook and the 200,000-point scatter are PR 0 part A's generator, not made here.
