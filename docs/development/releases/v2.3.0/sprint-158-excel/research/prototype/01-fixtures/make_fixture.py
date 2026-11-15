# Builds rich.xlsx: every feature the study asks about, written by openpyxl 3.1.5
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment, Color
from openpyxl.formatting.rule import CellIsRule, ColorScaleRule, DataBarRule, FormulaRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.drawing.image import Image
from openpyxl.chart import BarChart, Reference
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont
from PIL import Image as PILImage
import datetime

out = sys.argv[1]
wb = Workbook()
ws = wb.active
ws.title = "Budget"
ws.sheet_properties.tabColor = "1072BA"

thin = Side(style="thin", color="000000")
med = Side(style="medium", color=Color(theme=5))
dash = Side(style="dashed", color=Color(indexed=10))

ws["A1"] = "Household budget 2026"
ws["A1"].font = Font(bold=True, size=14, color="FFFFFF", name="Calibri")
ws["A1"].fill = PatternFill("solid", fgColor="FFC000")
ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
ws.merge_cells("A1:D1")

hdr = ["Item", "Amount", "Share", "Due", "Paid?"]
for i, h in enumerate(hdr, start=1):
    c = ws.cell(row=2, column=i, value=h)
    c.font = Font(italic=True, color=Color(theme=1))
    c.fill = PatternFill("solid", fgColor=Color(theme=4, tint=0.3999755851924192))
    c.border = Border(left=thin, right=thin, top=thin, bottom=med)

items = [("Rent", 950), ("Food", 420.5), ("Transport", 85), ("Utilities", 130.25), ("Insurance", 60), ("Phone", 25), ("Savings", 300), ("Other", 75)]
for r, (name, amt) in enumerate(items, start=3):
    ws.cell(row=r, column=1, value=name).border = Border(top=thin)
    b = ws.cell(row=r, column=2, value=amt)
    b.number_format = '#,##0.00 "€"'
    c = ws.cell(row=r, column=3, value=f"=B{r}/SUM($B$3:$B$10)")
    c.number_format = "0.0%"
    d = ws.cell(row=r, column=4, value=datetime.date(2026, 1, r))
    d.number_format = "dd.mm.yyyy"
    ws.cell(row=r, column=5, value="Yes" if r % 2 else "No")

ws["A11"] = "Total"
ws["A11"].font = Font(bold=True, underline="single", color=Color(indexed=12))
ws["B11"] = "=SUM(B3:B10)"
ws["B11"].number_format = '#,##0.00 "€"'
ws["B11"].fill = PatternFill("solid", fgColor=Color(theme=9, tint=-0.249977111117893))
ws["B11"].border = Border(top=dash, bottom=Side(style="double"))

ws["A12"] = "Tax rate"
ws["B12"] = 0.2
ws["B12"].number_format = "0%"

ws["A13"] = "This is a long note that should wrap inside the cell so that it is readable"
ws["A13"].alignment = Alignment(wrap_text=True, vertical="top", horizontal="left")
ws.row_dimensions[13].height = 45
ws.row_dimensions[2].height = 22

rt = CellRichText(["Mixed ", TextBlock(InlineFont(b=True, color="FF0000"), "red bold"), " text"])
ws["A14"] = rt
ws["B14"] = "right"
ws["B14"].alignment = Alignment(horizontal="right", indent=1)
ws["C14"] = "rotated"
ws["C14"].alignment = Alignment(text_rotation=45)
ws["D14"] = "strike"
ws["D14"].font = Font(strike=True, size=9, name="Arial")

ws.column_dimensions["A"].width = 30
ws.column_dimensions["B"].width = 14
ws.column_dimensions["F"].hidden = True
ws["F3"] = "hidden col value"
ws.row_dimensions[12].hidden = True
ws.freeze_panes = "B3"

ws.conditional_formatting.add("B3:B10", CellIsRule(operator="greaterThan", formula=["400"], fill=PatternFill("solid", bgColor="FFC7CE"), font=Font(color="9C0006")))
ws.conditional_formatting.add("C3:C10", ColorScaleRule(start_type="min", start_color="F8696B", end_type="max", end_color="63BE7B"))
ws.conditional_formatting.add("B3:B10", DataBarRule(start_type="min", end_type="max", color="638EC6"))

dv = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("E3:E10")

ws["B3"].comment = Comment("Rent goes up in March", "Jarmo")
ws["A15"] = "Website"
ws["A15"].hyperlink = "https://example.com/budget"
ws["A15"].style = "Hyperlink"
ws["A16"] = "Go to data"
ws["A16"].hyperlink = "#Data!A1"

wb.defined_names["TaxRate"] = DefinedName("TaxRate", attr_text="Budget!$B$12")

PILImage.new("RGB", (60, 40), (200, 30, 30)).save(sys.argv[2])
img = Image(sys.argv[2])
ws.add_image(img, "H2")

chart = BarChart()
chart.title = "Spend"
chart.add_data(Reference(ws, min_col=2, min_row=2, max_row=10), titles_from_data=True)
chart.set_categories(Reference(ws, min_col=1, min_row=3, max_row=10))
ws.add_chart(chart, "H8")

ws.page_setup.orientation = "landscape"
ws.oddHeader.center.text = "Budget"
ws.print_title_rows = "1:2"

# Second sheet: a table with autofilter, no gridlines
ds = wb.create_sheet("Data")
ds.sheet_view.showGridLines = False
ds.append(["Name", "Qty", "Price"])
for i in range(1, 21):
    ds.append([f"Row {i}", i, i * 1.5])
tab = Table(displayName="Orders", ref="A1:C21")
tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium9", showRowStripes=True)
ds.add_table(tab)
ds["E1"] = "=Budget!B11*TaxRate"

hs = wb.create_sheet("Hidden")
hs["A1"] = "secret"
hs.sheet_state = "hidden"

wb.save(out)
print("wrote", out)
