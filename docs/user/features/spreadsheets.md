# Spreadsheets

> View and edit CSV and Excel files without leaving Ritemark.

Ritemark handles spreadsheet files directly - edit CSV files inline or preview Excel files with multi-sheet support.

---

## What You Can Do

### CSV Files
- **View as spreadsheet** - See data in rows and columns
- **Edit cells inline** - Click to edit, changes save automatically
- **Handle large files** - Virtual scrolling for up to 10,000 rows

### Excel Files
- **Edit Excel files** - Basic cell editing for .xlsx (preview for .xls)
- **Switch sheets** - Tab-based sheet navigation
- **Open in external app** - One-click open in Excel or Numbers

---

## CSV Editing

### Opening a CSV

Double-click any `.csv` file in Documents. It opens in spreadsheet view instead of raw text. To start a new one, choose **Table** from the **+** at the end of the tab row, from **Start something** on Home, or from **New** in Documents.

### The Interface

| Part | Description |
|------|-------------|
| Header row | Column names (first row) |
| Row numbers | Excel-style numbers on the left |
| Cells | Data cells you can edit |
| Toolbar | File name display |

### Editing Cells

1. Click any cell
2. Type your new value
3. Press Enter to confirm (or Escape to cancel)
4. Changes save automatically

### Navigation

| Key | Action |
|-----|--------|
| Tab | Move to next cell |
| Enter | Confirm and move down |
| Escape | Cancel editing |
| Arrow keys | Move between cells |

### Large Files

Ritemark handles large CSV files efficiently:
- **Virtual scrolling** - Only visible rows are rendered
- **Row limit** - Up to 10,000 rows displayed
- **Size warning** - Files over 5MB show a warning before loading

If your file exceeds limits:
- Consider splitting into smaller files
- Use a dedicated spreadsheet app for very large data

---

## Excel Editor

### Opening Excel Files

Double-click any `.xlsx` or `.xls` file. `.xlsx` files open in an editable grid; `.xls` files open in read-only preview mode.

### Editing .xlsx Files

- Click a cell to edit its value; press Enter or click away to commit
- Edits mark the document dirty — save with Cmd+S / Ctrl+S
- An empty sheet shows an "Add a row to start editing" button
- If the file changes on disk while you have unsaved edits, a confirmation protects your changes before refreshing

### Multi-Sheet Support

Excel workbooks with multiple sheets show tabs at the top:
- Click a tab to switch sheets
- Current sheet is highlighted
- Sheet data loads instantly (cached locally)

### Charts

In .xlsx workbooks, Ritemark draws these charts in the same place and size as Excel, using the workbook's colours, titles, legends, axes and labels. Charts and cells stay on white in dark mode. A chart with its own sheet fills that sheet.

- Column and bar charts, including clustered, stacked and 100% stacked
- Line charts, with or without markers
- Pie and doughnut charts
- Scatter charts
- Area charts, including stacked and 100% stacked
- Column-and-line charts, including a line with a second axis

Ritemark draws 3-D columns, bars, lines, pies and areas flat. Waterfall, treemap, histogram, funnel, box and whisker, sunburst, map, radar, stock, bubble and surface charts appear as cards in their original places. A pie with all zero values also appears as a card. The line below the formula bar lists what the sheet keeps for Excel to show, including undrawn charts, pictures, shapes, icon sets and colour rules Ritemark can't read. The line goes away when everything on the sheet can be shown.

Click a drawn chart to choose it, or press Cmd+Option+5 on Mac or Ctrl+Alt+5 on Windows. The chart gets an outline and the formula bar shows its title, kind and source cells when available.

> Chart · Revenue by region · a column chart from Q5:Q7. Change it in Excel.

With the chart chosen, press Cmd+C on Mac or Ctrl+C on Windows to copy it as a picture. Press Esc to return to the cells.

### Colour rules

In .xlsx workbooks, Ritemark shows the workbook's cell highlights, two- and three-colour scales, and data bars. For example, you can see overdue values highlighted, numbers shaded from low to high, or positive and negative bars growing from an axis. Cells with icon sets show their values. Other colour rules on those cells still apply.

Type a new value and any charts and colour rules that use it update right away. Formula results keep their last saved values until Excel recalculates them. Viewing a workbook, switching sheets and choosing or copying a chart leave the file unchanged. Saving a cell edit keeps the workbook's charts and colour rules.

### Limitations

- Basic cell editing only: formulas, cell styles, and merged-cell layouts are not edited (untouched cells and sheets are preserved on save)
- `.xls` (legacy format) stays read-only — use the toolbar to open in Excel or Numbers
- Clearing cells does not shrink the sheet's used range (phantom empty rows/columns may remain)

---

## Spreadsheet Toolbar

When viewing CSV or Excel files, a toolbar appears at the top:

| Element | Description |
|---------|-------------|
| Filename | Shows the current file name |
| Open in... | Button to open in external app |

### Open in Excel/Numbers

The toolbar includes a split button:
- **Primary click** - Opens in Excel (if installed) or Numbers
- **Dropdown** - Choose between Excel and Numbers

This opens the actual file in the external app, not a copy.

---

## Supported Formats

| Extension | Mode | Features |
|-----------|------|----------|
| `.csv` | Edit | Full editing, auto-save |
| `.xlsx` | Edit | Basic cell editing, multiple sheets, charts and colour rules |
| `.xls` | Preview | Read-only, multi-sheet |

### CSV Format Notes

- **Encoding:** UTF-8
- **Delimiter:** Comma (standard CSV)
- **Headers:** First row treated as column headers

### Excel Format Notes

- **Formulas:** Not evaluated (shows stored values)
- **Formatting:** The .xlsx grid shows the workbook’s formatting and preserves it on save.
- **Charts and colour rules:** Available in the .xlsx grid.

---

## Tips

- **Quick edits** - For simple CSV changes, edit directly in Ritemark
- **Complex work** - For formulas or formatting, open in Excel
- **Large datasets** - If you hit the 10K row limit, use a dedicated tool
- **Data integrity** - CSV saves exactly what you see (no hidden formatting)

---

## Use Cases

| Task | Recommended |
|------|-------------|
| Quick CSV data entry | Ritemark |
| Viewing Excel reports | Ritemark |
| Complex spreadsheet work | Excel/Numbers via toolbar |
| Large data analysis | Dedicated spreadsheet app |

---

## Related

- [Core Editor](editor.md) - Markdown editing
- [Share](export.md) - Send a markdown document as PDF or Word
