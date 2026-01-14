# Spreadsheets

> View and edit CSV files. Preview Excel spreadsheets without leaving RiteMark.

RiteMark handles spreadsheet files directly - edit CSV files inline or preview Excel files with multi-sheet support.

---

## What You Can Do

### CSV Files
- **View as spreadsheet** - See data in rows and columns
- **Edit cells inline** - Click to edit, changes save automatically
- **Handle large files** - Virtual scrolling for up to 10,000 rows

### Excel Files
- **Preview spreadsheets** - View .xlsx and .xls files
- **Switch sheets** - Tab-based sheet navigation
- **Open in external app** - One-click open in Excel or Numbers

---

## CSV Editing

### Opening a CSV

Double-click any `.csv` file in the explorer. It opens in spreadsheet view instead of raw text.

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

RiteMark handles large CSV files efficiently:
- **Virtual scrolling** - Only visible rows are rendered
- **Row limit** - Up to 10,000 rows displayed
- **Size warning** - Files over 5MB show a warning before loading

If your file exceeds limits:
- Consider splitting into smaller files
- Use a dedicated spreadsheet app for very large data

---

## Excel Preview

### Opening Excel Files

Double-click any `.xlsx` or `.xls` file. It opens in read-only preview mode.

### Multi-Sheet Support

Excel workbooks with multiple sheets show tabs at the top:
- Click a tab to switch sheets
- Current sheet is highlighted
- Sheet data loads instantly (cached locally)

### Limitations

Excel files are **read-only** in RiteMark:
- You can view but not edit
- Use the toolbar to open in Excel or Numbers for editing

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
| `.xlsx` | Preview | Read-only, multi-sheet |
| `.xls` | Preview | Read-only, multi-sheet |

### CSV Format Notes

- **Encoding:** UTF-8
- **Delimiter:** Comma (standard CSV)
- **Headers:** First row treated as column headers

### Excel Format Notes

- **Formulas:** Not evaluated (shows stored values)
- **Formatting:** Not preserved (data only)
- **Charts:** Not displayed

---

## Tips

- **Quick edits** - For simple CSV changes, edit directly in RiteMark
- **Complex work** - For formulas or formatting, open in Excel
- **Large datasets** - If you hit the 10K row limit, use a dedicated tool
- **Data integrity** - CSV saves exactly what you see (no hidden formatting)

---

## Use Cases

| Task | Recommended |
|------|-------------|
| Quick CSV data entry | RiteMark |
| Viewing Excel reports | RiteMark |
| Complex spreadsheet work | Excel/Numbers via toolbar |
| Large data analysis | Dedicated spreadsheet app |

---

## Related

- [Core Editor](editor.md) - Markdown editing
- [Export](export.md) - Export markdown documents
