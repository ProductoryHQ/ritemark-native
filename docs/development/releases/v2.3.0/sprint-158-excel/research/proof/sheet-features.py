# Sprint 158 proof: count a workbook's formatting with openpyxl, sheet by sheet, to compare two saves of one file.
# python3 sheet-features.py <original.xlsx> <saved.xlsx> [cell]
import sys, warnings
warnings.filterwarnings("ignore")
import openpyxl

CELL = sys.argv[3] if len(sys.argv) > 3 else "B6"

def count(path):
    wb = openpyxl.load_workbook(path)
    out = {}
    for ws in wb.worksheets:
        fills = bold = borders = 0
        for row in ws.iter_rows():
            for c in row:
                if c.fill and c.fill.fill_type: fills += 1
                if c.font and c.font.b: bold += 1
                b = c.border
                if b and any(s is not None and s.style for s in (b.left, b.right, b.top, b.bottom)): borders += 1
        out[ws.title] = {
            "state": ws.sheet_state, "filled cells": fills, "bold cells": bold, "bordered cells": borders,
            "freeze": ws.freeze_panes, "merges": len(ws.merged_cells.ranges),
            "custom widths": sum(1 for d in ws.column_dimensions.values() if d.customWidth),
            "hidden rows": sum(1 for d in ws.row_dimensions.values() if d.hidden),
            "hidden columns": sum(1 for d in ws.column_dimensions.values() if d.hidden),
            "images": len(ws._images), "charts": len(ws._charts),
            "conditional formats": sum(len(r.rules) for r in ws.conditional_formatting),
            CELL: ws[CELL].value,
        }
    return out

a, b = count(sys.argv[1]), count(sys.argv[2])
for sheet in a:
    for k, v in a[sheet].items():
        w = b.get(sheet, {}).get(k)
        print(f"{'SAME' if v == w else 'DIFF'}  {sheet} / {k}: {v}" + ("" if v == w else f"  =>  {w}"))
