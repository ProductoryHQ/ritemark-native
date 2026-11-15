# Four synthetic, realistic workbooks for the Sprint 158 rendering spike.
# Invented names only. Formula cells get cached values afterwards (add_cached_values), as Excel would write them.
import datetime as dt, re, zipfile, shutil, os, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.styles.colors import Color
from openpyxl.formatting.rule import ColorScaleRule
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.writer.theme import theme_xml

OUT = os.path.dirname(os.path.abspath(__file__))
CACHED = {}  # file -> {sheet title -> {ref: value}}

def meta(wb, title):
    wb.properties.creator = "Ritemark test"
    wb.properties.lastModifiedBy = "Ritemark test"
    wb.properties.title = title
    wb.properties.created = dt.datetime(2026, 11, 15, 9, 0, 0)
    wb.properties.modified = dt.datetime(2026, 11, 15, 9, 0, 0)

def tcol(theme, tint=0.0):
    return Color(theme=theme, tint=tint)

def fill(theme=None, tint=0.0, rgb=None):
    c = Color(rgb=rgb) if rgb else tcol(theme, tint)
    return PatternFill(patternType="solid", fgColor=c, bgColor=Color(indexed=64))

thin = Side(style="thin", color="FF8EA9C1")
thin_dark = Side(style="thin", color="FF000000")
double = Side(style="double", color="FF000000")
medium = Side(style="medium", color=Color(theme=4))

# Office 2023+ theme (Aptos), as new Excel workbooks carry it
def office2023_theme():
    x = theme_xml
    swap = {"1F497D": "0E2841", "EEECE1": "E8E8E8", "4F81BD": "156082", "C0504D": "E97132", "9BBB59": "196B24",
            "8064A2": "0F9ED5", "4BACC6": "A02B93", "F79646": "4EA72E", "0000FF": "467886", "800080": "96607D"}
    for a, b in swap.items():
        x = x.replace(f'srgbClr val="{a}"', f'srgbClr val="{b}"')
    x = x.replace('<a:latin typeface="Cambria"', '<a:latin typeface="Aptos Display"', 1)
    x = x.replace('<a:latin typeface="Calibri"', '<a:latin typeface="Aptos Narrow"', 1)
    return x.encode() if isinstance(x, str) else x

# ---------------------------------------------------------------- 1. training budget (Office 2007 theme, Calibri)
def training_budget():
    wb = Workbook(); meta(wb, "Training budget 2027")
    ws = wb.active; ws.title = "Budget 2027"
    eur_acc = '_-* #,##0.00\\ "€"_-;\\-* #,##0.00\\ "€"_-;_-* "-"??\\ "€"_-;_-@_-'
    eur_var = '#,##0.00\\ "€";[Red]\\-#,##0.00\\ "€"'
    ws["A1"] = "Northwind Training — 2027 training budget"; ws["A1"].font = Font(name="Calibri", size=16, bold=True, color=tcol(3))
    ws["A2"] = "All amounts in euros, VAT excluded. Approved by the board on 4 November 2026."; ws["A2"].font = Font(name="Calibri", size=10, italic=True, color=tcol(1, 0.5))
    hdr = ["Course", "Participants", "Price per person", "Planned", "Q1", "Q2", "Q3", "Q4", "Spent so far", "Variance", "Status"]
    for i, h in enumerate(hdr, 1):
        c = ws.cell(row=4, column=i, value=h)
        c.font = Font(name="Calibri", size=11, bold=True, color=tcol(0)); c.fill = fill(4)
        c.alignment = Alignment(horizontal="center" if i > 1 else "left", vertical="center", wrap_text=True)
    ws.row_dimensions[4].height = 30
    groups = [
        ("Leadership", [("New manager programme", 12, 1450, "Booked"), ("Feedback that works", 20, 390, "Booked"), ("Strategy day for team leads", 8, 610, "Draft")]),
        ("Product and delivery", [("Product discovery in practice", 14, 720, "Booked"), ("Writing user stories", 18, 260, "Done"), ("Draft row — remove before sending", 1, 1, "Draft"), ("Facilitation basics", 10, 480, "Booked")]),
        ("Tools", [("Spreadsheets for analysts", 25, 180, "Done"), ("Working with AI agents", 30, 350, "Booked")]),
    ]
    r = 5; sub_rows = []; cached = {}
    hidden_row = None
    for gname, items in groups:
        ws.cell(row=r, column=1, value=gname)
        for c in range(1, 12):
            ws.cell(row=r, column=c).fill = fill(4, 0.7999816888943144)
            ws.cell(row=r, column=c).font = Font(name="Calibri", bold=True, color=tcol(3))
        r += 1; first = r
        for name, n, price, status in items:
            ws.cell(row=r, column=1, value=name)
            ws.cell(row=r, column=2, value=n).number_format = "0"
            ws.cell(row=r, column=3, value=price).number_format = eur_acc
            ws.cell(row=r, column=4, value=f"=B{r}*C{r}").number_format = eur_acc
            planned = n * price; cached[f"D{r}"] = planned
            q = [0.4, 0.3, 0.2, 0.1] if status != "Draft" else [0, 0, 0.5, 0.5]
            for k in range(4):
                ws.cell(row=r, column=5 + k, value=round(planned * q[k], 2)).number_format = eur_acc
            spent = round(planned * (1.08 if status == "Done" and n > 20 else 0.92 if status == "Done" else 0.35 if status == "Booked" else 0), 2)
            ws.cell(row=r, column=9, value=spent).number_format = eur_acc
            ws.cell(row=r, column=10, value=f"=D{r}-I{r}").number_format = eur_var; cached[f"J{r}"] = round(planned - spent, 2)
            st = ws.cell(row=r, column=11, value=status); st.alignment = Alignment(horizontal="center")
            if status == "Draft": st.font = Font(name="Calibri", italic=True, color=tcol(1, 0.5))
            if name.startswith("Draft row"): hidden_row = r
            r += 1
        last = r - 1
        ws.cell(row=r, column=1, value=f"{gname} total").font = Font(name="Calibri", bold=True)
        for col in "DEFGHIJ":
            c = ws[f"{col}{r}"]; c.value = f"=SUBTOTAL(9,{col}{first}:{col}{last})"
            c.number_format = eur_var if col == "J" else eur_acc; c.font = Font(name="Calibri", bold=True)
            vals = []
            for rr in range(first, last + 1):
                v = ws[f"{col}{rr}"].value
                vals.append(cached[f"{col}{rr}"] if isinstance(v, str) else v)
            cached[f"{col}{r}"] = round(sum(vals), 2)
        for c in range(1, 12): ws.cell(row=r, column=c).border = Border(top=thin)
        sub_rows.append(r); r += 2
    gt = r
    ws.cell(row=gt, column=1, value="Grand total")
    for col in "DEFGHIJ":
        c = ws[f"{col}{gt}"]; c.value = "=" + "+".join(f"{col}{s}" for s in sub_rows)
        c.number_format = eur_var if col == "J" else eur_acc
        cached[f"{col}{gt}"] = round(sum(cached[f"{col}{s}"] for s in sub_rows), 2)
    for c in range(1, 12):
        cell = ws.cell(row=gt, column=c); cell.font = Font(name="Calibri", bold=True, size=12)
        cell.fill = fill(4, 0.5999938962981048); cell.border = Border(top=thin_dark, bottom=double)
    ws.cell(row=gt + 2, column=1, value="Budget cap set by the board")
    ws.cell(row=gt + 2, column=4, value=60000).number_format = eur_acc
    ws.cell(row=gt + 3, column=1, value="Room left")
    ws.cell(row=gt + 3, column=4, value=f"=D{gt+2}-D{gt}").number_format = eur_var
    cached[f"D{gt+3}"] = round(60000 - cached[f"D{gt}"], 2)
    widths = {"A": 34, "B": 12, "C": 15, "D": 14, "E": 12.5, "F": 12.5, "G": 12.5, "H": 12.5, "I": 14, "J": 13, "K": 10}
    for k, v in widths.items(): ws.column_dimensions[k].width = v
    ws.row_dimensions[hidden_row].hidden = True
    ws.freeze_panes = "B5"
    CACHED["training-budget.xlsx"] = {ws.title: cached}
    wb.save(os.path.join(OUT, "training-budget.xlsx"))

# ---------------------------------------------------------------- 2. Estonian timesheet (Office 2023 theme, Aptos Narrow)
def timesheet():
    wb = Workbook(); wb.loaded_theme = office2023_theme(); meta(wb, "Tööajatabel november 2026")
    ws = wb.active; ws.title = "November 2026"
    F = lambda **k: Font(name="Aptos Narrow", scheme="minor", **k)
    ws.merge_cells("A1:H1"); ws["A1"] = "Tööajatabel — november 2026"
    ws["A1"].font = Font(name="Aptos Display", scheme="major", size=18, bold=True, color=tcol(3))
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center"); ws.row_dimensions[1].height = 30
    ws["A2"] = "Töötaja:"; ws["B2"] = "Mari Maasikas"; ws["E2"] = "Ettevõte:"; ws["F2"] = "Northwind Koolitus OÜ"
    for c in ("A2", "E2"): ws[c].font = F(bold=True)
    hdr = ["Kuupäev", "Päev", "Algus", "Lõpp", "Paus", "Kestus", "Projekt", "Märkused", "Nädal", "Minutid"]
    for i, h in enumerate(hdr, 1):
        c = ws.cell(row=4, column=i, value=h); c.font = F(bold=True, color=tcol(0)); c.fill = fill(4)
        c.alignment = Alignment(horizontal="left" if i in (7, 8) else "center", vertical="center")
        c.border = Border(bottom=Side(style="medium", color=Color(theme=3)))
    days = ["E", "T", "K", "N", "R", "L", "P"]
    projects = ["Kliendikoolitus", "Sisekoolitus", "Müük", "Arendus"]
    notes = {3: "Koolitus Tartus, sõit edasi-tagasi rongiga, materjalid prinditud kohapeal.",
             9: "Kliendiga kohtumine venis, järgmine samm: pakkumine reedeks.",
             12: "Puhkus — asendaja vastab kirjadele.",
             17: "Uue kursuse kava ja harjutuste mustand; ülevaatus järgmisel nädalal koos meeskonnaga, et kõik osad oleksid enne detsembrit valmis.",
             24: "Sõit Pärnusse"}
    r = 5; cached = {}; first = r; total_min = 0; cancelled_row = None
    for d in range(1, 31):
        day = dt.date(2026, 11, d); wd = day.weekday()
        if wd >= 5 and d not in (14,):
            continue
        ws.cell(row=r, column=1, value=day).number_format = "dd.mm.yyyy"
        ws.cell(row=r, column=2, value=days[wd]).alignment = Alignment(horizontal="center")
        if d == 12:
            start = end = None; brk = 0
        else:
            start = dt.time(8 + (d % 3), 30 if d % 2 else 0); end = dt.time(16 + (d % 4), 15 if d % 2 else 45); brk = 30 if d % 5 else 45
        if start:
            ws.cell(row=r, column=3, value=start).number_format = "hh:mm"
            ws.cell(row=r, column=4, value=end).number_format = "hh:mm"
            ws.cell(row=r, column=5, value=dt.time(0, brk)).number_format = "[h]:mm"
            mins = (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute) - brk
            ws.cell(row=r, column=6, value=f"=D{r}-C{r}-E{r}").number_format = "[h]:mm"; cached[f"F{r}"] = mins / 1440
            ws.cell(row=r, column=7, value=projects[d % 4])
            ws.cell(row=r, column=10, value=f"=F{r}*1440").number_format = "0"; cached[f"J{r}"] = mins
            total_min += mins if d != 26 else 0
        else:
            ws.cell(row=r, column=7, value="Puhkus")
            for c in range(1, 9): ws.cell(row=r, column=c).fill = fill(rgb="FFFFF2CC")
        ws.cell(row=r, column=9, value=f"=ISOWEEKNUM(A{r})"); cached[f"I{r}"] = day.isocalendar()[1]
        if d in notes:
            n = ws.cell(row=r, column=8, value=notes[d]); n.alignment = Alignment(wrap_text=True, vertical="top")
        if wd == 5:
            for c in range(1, 9): ws.cell(row=r, column=c).fill = fill(2, -0.0999786370433668)
            ws.cell(row=r, column=8, value="Laupäev: messi ettevalmistus")
        for c in range(1, 9):
            cell = ws.cell(row=r, column=c)
            if cell.font is None or not cell.font.b: cell.font = F()
            if c != 8 or d not in notes: cell.alignment = Alignment(horizontal=cell.alignment.horizontal, vertical="top", wrap_text=cell.alignment.wrap_text)
        if d == 26: cancelled_row = r
        r += 1
    last = r - 1
    ws.cell(row=r, column=1, value="Kokku").font = F(bold=True)
    ws.cell(row=r, column=6, value=f"=SUM(F{first}:F{last})-F{cancelled_row}").number_format = "[h]:mm"; cached[f"F{r}"] = total_min / 1440
    ws.cell(row=r, column=6).font = F(bold=True)
    ws.cell(row=r, column=10, value=f"=SUM(J{first}:J{last})").number_format = "0"; cached[f"J{r}"] = total_min
    for c in range(1, 9): ws.cell(row=r, column=c).border = Border(top=Side(style="thin", color=Color(theme=1)), bottom=double)
    ws.cell(row=r + 2, column=1, value="Allkiri ja kuupäev: ____________________   Kinnitanud: ____________________").font = F(italic=True, color=tcol(1, 0.35))
    widths = {"A": 11.5, "B": 5.5, "C": 7, "D": 7, "E": 7, "F": 8, "G": 16, "H": 46, "I": 7, "J": 8}
    for k, v in widths.items(): ws.column_dimensions[k].width = v
    ws.column_dimensions["I"].hidden = True; ws.column_dimensions["J"].hidden = True
    ws.row_dimensions[cancelled_row].hidden = True
    ws.row_dimensions[last - 2].height = 48  # one explicit height for a wrapped note; the rest are left to the reader
    ws.freeze_panes = "A5"
    CACHED["estonian-timesheet.xlsx"] = {ws.title: cached}
    wb.save(os.path.join(OUT, "estonian-timesheet.xlsx"))

# ---------------------------------------------------------------- 3. project plan
def project_plan():
    wb = Workbook(); wb.loaded_theme = office2023_theme(); meta(wb, "Website relaunch plan")
    ws = wb.active; ws.title = "Plan"
    F = lambda **k: Font(name="Aptos Narrow", scheme="minor", **k)
    ws.merge_cells("A1:G1"); ws["A1"] = "Contoso Bikes — website relaunch plan"; ws["A1"].font = Font(name="Aptos Display", scheme="major", size=15, bold=True, color=tcol(4, -0.25))
    ws["H1"] = "Status date:"; ws["H1"].font = F(italic=True); ws["L1"] = dt.date(2026, 11, 16); ws["L1"].number_format = "d mmm yyyy"
    hdr = ["Task", "Phase", "Owner", "Start", "End", "Days", "Done"]
    week0 = dt.date(2026, 11, 2)
    weeks = [week0 + dt.timedelta(weeks=i) for i in range(14)]
    for i, h in enumerate(hdr, 1):
        c = ws.cell(row=3, column=i, value=h); c.font = F(bold=True, color=tcol(0)); c.fill = fill(3)
        c.alignment = Alignment(horizontal="left" if i <= 3 else "center", vertical="center")
    for k, w in enumerate(weeks):
        c = ws.cell(row=3, column=8 + k, value=w); c.number_format = "d mmm"; c.font = F(bold=True, size=9, color=tcol(0)); c.fill = fill(3)
        c.alignment = Alignment(horizontal="center", vertical="center", text_rotation=90)
    ws.row_dimensions[3].height = 42
    phases = [
        ("Discovery", 5, [("Stakeholder interviews", "Anna", 0, 2, 1.0), ("Analytics review", "Jonas", 1, 2, 1.0), ("Content inventory", "Lea", 1, 3, 0.8)]),
        ("Design", 6, [("Information architecture", "Lea", 3, 2, 0.6), ("Wireframes", "Anna", 4, 3, 0.35), ("Visual design", "Kai", 5, 4, 0.1), ("Usability test round 1", "Anna", 7, 1, 0)]),
        ("Build", 7, [("Front-end templates", "Jonas", 7, 4, 0), ("CMS migration", "Kai", 8, 3, 0), ("Accessibility check", "Lea", 10, 1, 0)]),
        ("Launch", 9, [("Content freeze", "Anna", 11, 1, 0), ("Go-live and monitoring", "Jonas", 12, 2, 0)]),
    ]
    r = 4; band = 0; cached = {}
    for pname, theme_ix, tasks in phases:
        top = r
        for name, owner, w, dur, done in tasks:
            start = weeks[w]; end = weeks[w] + dt.timedelta(days=7 * dur - 3)
            ws.cell(row=r, column=1, value=name); ws.cell(row=r, column=3, value=owner)
            ws.cell(row=r, column=4, value=start).number_format = "dd.mm.yyyy"
            ws.cell(row=r, column=5, value=end).number_format = "dd.mm.yyyy"
            ws.cell(row=r, column=6, value=f"=NETWORKDAYS(D{r},E{r})"); cached[f"F{r}"] = dur * 5 - 1
            ws.cell(row=r, column=7, value=done).number_format = "0%"
            alt = fill(1, 0.9499893185216834) if band % 2 else None
            for c in range(1, 8 + len(weeks)):
                cell = ws.cell(row=r, column=c)
                if c != 2: cell.font = F()
                if alt and c != 2: cell.fill = alt
                if c >= 8:
                    k = c - 8
                    if w <= k < w + dur:
                        doneweeks = round(dur * done)
                        cell.fill = fill(theme_ix, -0.25 if k - w < doneweeks else 0.4)
                    cell.border = Border(left=Side(style="hair", color="FFBFBFBF"))
            ws.cell(row=r, column=4).alignment = ws.cell(row=r, column=5).alignment = Alignment(horizontal="center")
            ws.cell(row=r, column=7).alignment = Alignment(horizontal="center")
            band += 1; r += 1
        ws.merge_cells(start_row=top, start_column=2, end_row=r - 1, end_column=2)
        pc = ws.cell(row=top, column=2, value=pname); pc.fill = fill(theme_ix, 0.5999938962981048)
        pc.font = F(bold=True, color=tcol(theme_ix, -0.499984740745262)); pc.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        for rr in range(top, r):
            for c in range(1, 8 + len(weeks)):
                cell = ws.cell(row=rr, column=c)
                b = cell.border
                cell.border = Border(left=b.left, right=b.right, top=b.top, bottom=Side(style="thin", color=Color(theme=4)) if rr == r - 1 else b.bottom)
    ws.cell(row=r + 1, column=1, value="Overall progress").font = F(bold=True)
    ws.cell(row=r + 1, column=7, value=f"=AVERAGE(G4:G{r-1})").number_format = "0.0%"
    ws.cell(row=r + 1, column=7).font = F(bold=True); ws.cell(row=r + 1, column=7).alignment = Alignment(horizontal="center")
    allv = [t[4] for p in phases for t in p[2]]; cached[f"G{r+1}"] = sum(allv) / len(allv)
    ws.column_dimensions["A"].width = 30; ws.column_dimensions["B"].width = 11; ws.column_dimensions["C"].width = 9
    ws.column_dimensions["D"].width = 11; ws.column_dimensions["E"].width = 11; ws.column_dimensions["F"].width = 6; ws.column_dimensions["G"].width = 7
    for k in range(len(weeks)):
        ws.column_dimensions[ws.cell(row=1, column=8 + k).column_letter].width = 4.2
    ws.freeze_panes = "B4"
    ms = wb.create_sheet("Milestones"); ms.sheet_properties.tabColor = "E97132"
    ms["A1"] = "Milestones"; ms["A1"].font = Font(name="Aptos Display", scheme="major", size=14, bold=True)
    rows = [("Kick-off", dt.date(2026, 11, 2), "Done"), ("Design sign-off", dt.date(2026, 12, 18), "At risk"), ("Content freeze", dt.date(2027, 1, 18), "Planned"), ("Go-live", dt.date(2027, 2, 1), "Planned")]
    for i, h in enumerate(["Milestone", "Date", "Status"], 1):
        c = ms.cell(row=3, column=i, value=h); c.font = F(bold=True); c.border = Border(bottom=medium)
    for i, (n, d, s) in enumerate(rows, 4):
        ms.cell(row=i, column=1, value=n).font = F(); ms.cell(row=i, column=2, value=d).number_format = "dd.mm.yyyy"
        c = ms.cell(row=i, column=3, value=s); c.font = F(bold=s == "At risk", color="FFC00000" if s == "At risk" else None)
    ms.column_dimensions["A"].width = 22; ms.column_dimensions["B"].width = 12; ms.column_dimensions["C"].width = 10
    ms.sheet_view.showGridLines = False
    lk = wb.create_sheet("Lookups"); lk.sheet_state = "hidden"
    for i, (p, t) in enumerate([("Discovery", 5), ("Design", 6), ("Build", 7), ("Launch", 9)], 1):
        lk.cell(row=i, column=1, value=p); lk.cell(row=i, column=2, value=t)
    CACHED["project-plan.xlsx"] = {ws.title: cached}
    wb.save(os.path.join(OUT, "project-plan.xlsx"))

# ---------------------------------------------------------------- 4. sales report
def sales_report():
    wb = Workbook(); meta(wb, "Sales report 2026")
    ws = wb.active; ws.title = "Sales 2026"
    ws.sheet_view.showGridLines = False
    ws["A1"] = "Fabrikam Outdoor — monthly sales, 2026"; ws["A1"].font = Font(size=14, bold=True, color=tcol(4, -0.25))
    ws["A2"] = "Report run"; ws["B2"] = dt.datetime(2026, 11, 14, 17, 5); ws["B2"].number_format = "d mmmm yyyy h:mm"
    ws["A2"].font = Font(size=9, color=tcol(1, 0.5)); ws["B2"].font = Font(size=9, color=tcol(1, 0.5)); ws["B2"].alignment = Alignment(horizontal="left")
    hdr = ["Month", "Region", "Units", "Revenue", "Growth", "Margin", "Last order"]
    for i, h in enumerate(hdr, 1):
        c = ws.cell(row=4, column=i, value=h); c.font = Font(bold=True, color=tcol(4, -0.25))
        c.border = Border(bottom=Side(style="medium", color=Color(theme=4))); c.alignment = Alignment(horizontal="left" if i <= 2 else "right")
    regions = ["North", "South", "Baltics"]
    r = 5; cached = {}
    import math
    rev_by_month = []
    for m in range(1, 11):
        mtot = 0
        for k, reg in enumerate(regions):
            units = int(1200 + 400 * math.sin(m / 2 + k) + 150 * k + 37 * m)
            price = [41.5, 38.0, 44.25][k]
            ws.cell(row=r, column=1, value=dt.date(2026, m, 1)).number_format = "mmm yyyy"
            ws.cell(row=r, column=2, value=reg)
            ws.cell(row=r, column=3, value=units).number_format = "#,##0"
            ws.cell(row=r, column=4, value=f"=C{r}*{price}").number_format = "#,##0"; cached[f"D{r}"] = units * price; mtot += units * price
            if m == 1:
                ws.cell(row=r, column=5, value="—").alignment = Alignment(horizontal="right")
            else:
                ws.cell(row=r, column=5, value=f"=D{r}/D{r-3}-1").number_format = "0.0%"; cached[f"E{r}"] = cached[f"D{r}"] / cached[f"D{r-3}"] - 1
            ws.cell(row=r, column=6, value=round(0.18 + 0.12 * math.cos(m + k * 2), 3)).number_format = "0.0%"
            ws.cell(row=r, column=7, value=dt.date(2026, m, 25 - k * 3)).number_format = "dd.mm.yyyy"
            if k == 2:
                for c in range(1, 8): ws.cell(row=r, column=c).border = Border(bottom=Side(style="thin", color="FFD9D9D9"))
            r += 1
        rev_by_month.append(mtot)
    last = r - 1
    ws.cell(row=r, column=1, value="Total"); ws.cell(row=r, column=3, value=f"=SUM(C5:C{last})").number_format = "#,##0"
    cached[f"C{r}"] = sum(ws.cell(row=i, column=3).value for i in range(5, last + 1))
    ws.cell(row=r, column=4, value=f"=SUM(D5:D{last})").number_format = "#,##0"; cached[f"D{r}"] = sum(cached[f"D{i}"] for i in range(5, last + 1))
    for c in range(1, 8):
        cell = ws.cell(row=r, column=c); cell.font = Font(bold=True); cell.border = Border(top=Side(style="thin", color=Color(theme=4)), bottom=Side(style="double", color=Color(theme=4)))
    ws.conditional_formatting.add(f"F5:F{last}", ColorScaleRule(start_type="min", start_color="FFF8696B", mid_type="percentile", mid_value=50, mid_color="FFFFEB84", end_type="max", end_color="FF63BE7B"))
    for k, v in {"A": 11, "B": 10, "C": 9, "D": 11, "E": 9, "F": 9, "G": 12}.items(): ws.column_dimensions[k].width = v
    ch = BarChart(); ch.type = "col"; ch.title = "Revenue by region"; ch.y_axis.title = "€"; ch.height = 7.5; ch.width = 15
    # the chart reads every third row per region: simpler to point at a small summary block on the right
    ws["P4"] = "Region"; ws["Q4"] = "Revenue"
    for k, reg in enumerate(regions):
        ws.cell(row=5 + k, column=16, value=reg)
        ws.cell(row=5 + k, column=17, value=f'=SUMIF(B5:B{last},P{5+k},D5:D{last})').number_format = "#,##0"
        cached[f"Q{5+k}"] = sum(cached[f"D{i}"] for i in range(5, last + 1) if ws.cell(row=i, column=2).value == reg)
    ch.add_data(Reference(ws, min_col=17, min_row=4, max_row=7), titles_from_data=True)
    ch.set_categories(Reference(ws, min_col=16, min_row=5, max_row=7))
    ws.add_chart(ch, "I4")
    cs = wb.create_chartsheet("Revenue trend")
    data = wb.create_sheet("Monthly")
    data["A1"] = "Month"; data["B1"] = "Revenue"
    for i, m in enumerate(range(1, 11), 2):
        data.cell(row=i, column=1, value=dt.date(2026, m, 1)).number_format = "mmm yy"
        data.cell(row=i, column=2, value=round(rev_by_month[i - 2])).number_format = "#,##0"
    lc = LineChart(); lc.title = "Revenue per month"
    lc.add_data(Reference(data, min_col=2, min_row=1, max_row=11), titles_from_data=True)
    lc.set_categories(Reference(data, min_col=1, min_row=2, max_row=11))
    cs.add_chart(lc)
    CACHED["sales-report.xlsx"] = {ws.title: cached}
    wb.save(os.path.join(OUT, "sales-report.xlsx"))

def add_cached_values(fname):
    """openpyxl writes formulas without results; add <v> the way Excel saves them."""
    path = os.path.join(OUT, fname); tmp = path + ".tmp"
    zin = zipfile.ZipFile(path); zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
    wbx = zin.read("xl/workbook.xml").decode(); rels = zin.read("xl/_rels/workbook.xml.rels").decode()
    sheet_paths = {}
    for m in re.finditer(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', wbx):
        t = re.search(r'Id="%s"[^>]*Target="([^"]+)"' % m.group(2), rels) or re.search(r'Target="([^"]+)"[^>]*Id="%s"' % m.group(2), rels)
        sheet_paths["xl/" + t.group(1).lstrip("/").replace("xl/", "")] = m.group(1)
    for item in zin.infolist():
        data = zin.read(item.filename)
        title = sheet_paths.get(item.filename)
        if title and title in CACHED[fname]:
            vals = CACHED[fname][title]; x = data.decode()
            def fv(m):
                ref = m.group(1)
                if ref not in vals: return m.group(0)
                return f'<c r="{ref}"{m.group(2)}><f>{m.group(3)}</f><v>{repr(float(vals[ref]))}</v></c>'
            x = re.sub(r'<c r="([A-Z]+\d+)"([^>]*)><f>(.*?)</f>(?:<v\s*/>|<v>\s*</v>|)</c>', fv, x)
            data = x.encode()
        zout.writestr(item, data)
    zout.close(); zin.close(); shutil.move(tmp, path)

if __name__ == "__main__":
    training_budget(); timesheet(); project_plan(); sales_report()
    for f in CACHED: add_cached_values(f)
    print("ok", list(CACHED))
