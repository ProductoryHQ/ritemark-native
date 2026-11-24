# Chart reader proof

The table records the parsed models from the 21 synthetic chart parts and the two existing workbooks. Ranges list the series title, categories or X values, and values or Y values, in that order. Each line break starts a new series. An unsupported model reports its kind and has no parsed series. The file's drawing card still supplies the preview in this PR.

Regenerate the rows from `extensions/ritemark` with `node --import tsx webview/src/components/excel/readChart.test.ts --proof`. The Excel-made fixtures and render comparison are pending.

| Fixture | Parsed kind | Series | Parsed title | Parsed series ranges | Excel's render |
| --- | --- | ---: | --- | --- | --- |
| `synthetic-area-3d.xml` | area | 1 | Area 3d | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-area-stacked.xml` | area | 1 | Area stacked | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-area.xml` | area | 1 | Area | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-bar-3d.xml` | bar | 1 | Bar 3d | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-bar-clustered.xml` | bar | 1 | Bar clustered | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-bar-percent.xml` | bar | 1 | Bar percent | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-bar-stacked.xml` | bar | 1 | Bar stacked | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-chartex.xml` | chartex | 0 | — | — | |
| `synthetic-column-3d.xml` | column | 1 | Column 3d | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-column-clustered.xml` | column | 1 | Column clustered | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-column-percent.xml` | column | 1 | Column percent | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-column-stacked.xml` | column | 1 | Column stacked | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-combo.xml` | combo | 2 | Combo | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4`<br>`'Sample Sheet'!$C$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$C$2:$C$4` | |
| `synthetic-doughnut.xml` | doughnut | 1 | Doughnut | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-line-3d.xml` | line | 1 | Line 3d | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-line-markers.xml` | line | 1 | Line markers | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-line.xml` | line | 1 | Line | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-pie-3d.xml` | pie | 1 | Pie 3d | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-pie.xml` | pie | 1 | Pie | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$A$2:$A$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-scatter.xml` | scatter | 1 | Scatter | `'Sample Sheet'!$B$1`, `'Sample Sheet'!$D$2:$D$4`, `'Sample Sheet'!$B$2:$B$4` | |
| `synthetic-unknown.xml` | radarChart | 0 | — | — | |
| `rich.xlsx` | column | 1 | Spend | `'Budget'!B2`, `'Budget'!$A$3:$A$10`, `'Budget'!$B$3:$B$10` | |
| `rich-excelish.xlsx` | column | 1 | Spend | `'Budget'!B2`, `'Budget'!$A$3:$A$10`, `'Budget'!$B$3:$B$10` | |
