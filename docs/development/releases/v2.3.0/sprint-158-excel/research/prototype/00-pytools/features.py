# Independent API-level check with openpyxl: prints one line per feature for an xlsx.
import sys, json, warnings
warnings.filterwarnings("ignore")
import openpyxl
def col(c):
    if c is None: return None
    if c.type == "rgb": return "rgb:" + str(c.rgb)
    if c.type == "theme": return f"theme:{c.theme}/tint:{round(c.tint,3)}"
    if c.type == "indexed": return f"indexed:{c.indexed}"
    return str(c.type)
def dump(path):
    wb = openpyxl.load_workbook(path, rich_text=True)
    f = {}
    ws = wb["Budget"] if "Budget" in wb.sheetnames else wb.worksheets[0]
    a1 = ws["A1"]
    f["sheets"] = [(s.title, s.sheet_state) for s in wb.worksheets]
    f["A1 fill"] = col(a1.fill.fgColor) if a1.fill.fill_type else None
    f["A1 font bold/size/colour"] = (a1.font.b, a1.font.sz, col(a1.font.color))
    f["A1 align"] = (a1.alignment.horizontal, a1.alignment.vertical)
    if "Budget" in wb.sheetnames:
        f["A2 theme fill+tint"] = col(ws["A2"].fill.fgColor) if ws["A2"].fill.fill_type else None
        f["A2 italic"] = ws["A2"].font.i
        f["A2 border bottom"] = (ws["A2"].border.bottom.style, col(ws["A2"].border.bottom.color))
        f["A3 border top"] = ws["A3"].border.top.style
        f["A3 value"] = ws["A3"].value
        f["B4 value"] = ws["B4"].value
        f["B3 numFmt"] = ws["B3"].number_format
        f["C3 formula"] = ws["C3"].value
        f["B11 fill"] = col(ws["B11"].fill.fgColor) if ws["B11"].fill.fill_type else None
        f["B11 border top/bottom"] = (ws["B11"].border.top.style, ws["B11"].border.bottom.style, col(ws["B11"].border.top.color))
        f["A11 font indexed colour+underline"] = (col(ws["A11"].font.color), ws["A11"].font.u)
        f["A13 wrap/valign"] = (ws["A13"].alignment.wrap_text, ws["A13"].alignment.vertical)
        f["A14 rich text"] = repr(ws["A14"].value)[:80]
        f["B14 indent"] = (ws["B14"].alignment.horizontal, ws["B14"].alignment.indent)
        f["C14 rotation"] = ws["C14"].alignment.text_rotation
        f["D14 strike/font"] = (ws["D14"].font.strike, ws["D14"].font.name, ws["D14"].font.sz)
        f["col A width / B width"] = (ws.column_dimensions["A"].width, ws.column_dimensions["B"].width)
        f["col F hidden"] = ws.column_dimensions["F"].hidden
        f["row 13 height / row 2 height"] = (ws.row_dimensions[13].height, ws.row_dimensions[2].height)
        f["row 12 hidden"] = ws.row_dimensions[12].hidden
        f["merges"] = [str(m) for m in ws.merged_cells.ranges]
        f["freeze"] = ws.freeze_panes
        f["cond formats"] = sorted(f"{r.sqref}:{rule.type}" for r in ws.conditional_formatting for rule in r.rules)
        f["data validation"] = [(str(d.sqref), d.type, d.formula1) for d in ws.data_validations.dataValidation]
        f["comment B3"] = (ws["B3"].comment.text if ws["B3"].comment else None)
        f["hyperlink A15/A16"] = (ws["A15"].hyperlink.target if ws["A15"].hyperlink else None, (ws["A16"].hyperlink.location or ws["A16"].hyperlink.target) if ws["A16"].hyperlink else None)
        f["images"] = len(ws._images)
        f["charts"] = len(ws._charts)
        f["tab colour"] = col(ws.sheet_properties.tabColor)
        f["page orientation / header"] = (ws.page_setup.orientation, ws.oddHeader.center.text)
        f["print titles"] = ws.print_title_rows
    f["defined names"] = sorted(wb.defined_names.keys())
    if "Data" in wb.sheetnames:
        d = wb["Data"]
        f["Data table"] = list(d.tables.keys())
        f["Data gridlines"] = d.sheet_view.showGridLines
        f["Data E1"] = d["E1"].value
    f["custom doc props"] = [p.name for p in wb.custom_doc_props.props] if hasattr(wb, "custom_doc_props") else None
    return f
before, after = dump(sys.argv[1]), dump(sys.argv[2])
for k in before:
    b, a = before[k], after.get(k)
    print(("SAME   " if b == a else "DIFF   ") + k + " | " + json.dumps(b, default=str) + ("" if b == a else "  =>  " + json.dumps(a, default=str)))
