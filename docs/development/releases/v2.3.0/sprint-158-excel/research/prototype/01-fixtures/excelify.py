# Turns openpyxl's rich.xlsx into an Excel-shaped file: shared strings, cached formula values,
# calcChain, mc:Ignorable x14ac attributes, an x14 data-bar extLst and a custom docProps part.
import sys, zipfile, re, html
src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
parts = {n: zin.read(n) for n in zin.namelist()}
sst, index = [], {}
def sidx(xml_is):
    if xml_is not in index:
        index[xml_is] = len(sst); sst.append(xml_is)
    return index[xml_is]
amounts = [950, 420.5, 85, 130.25, 60, 25, 300, 75]
total = sum(amounts)
cached = {f"C{r}": amounts[r-3]/total for r in range(3, 11)}
cached["B11"] = total
calc = []
for n in sorted(p for p in parts if re.match(r"xl/worksheets/sheet\d+\.xml$", p)):
    x = parts[n].decode()
    sheet_id = int(re.search(r"sheet(\d+)", n).group(1))
    def repl(m):
        attrs, inner = m.group(1), m.group(2)
        k = sidx(inner)
        attrs = attrs.replace('t="inlineStr"', 't="s"')
        return f"<c{attrs}><v>{k}</v></c>"
    x = re.sub(r'<c([^>]*t="inlineStr"[^>]*)><is>(.*?)</is></c>', repl, x)
    def fv(m):
        ref = m.group(1)
        v = cached.get(ref) if sheet_id == 1 else (total*0.2 if ref == "E1" else None)
        calc.append((ref, sheet_id))
        return f'<c r="{ref}"{m.group(2)}><f>{m.group(3)}</f><v>{"" if v is None else repr(v)}</v></c>'
    x = re.sub(r'<c r="([A-Z]+\d+)"([^>]*)><f>(.*?)</f><v\s*/?>(?:</v>)?</c>', fv, x)
    x = x.replace('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"', 1)
    x = re.sub(r'<row r="(\d+)"', r'<row r="\1" x14ac:dyDescent="0.2"', x)
    if sheet_id == 1:
        ext = ('<extLst><ext uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main">'
               '<x14:conditionalFormattings><x14:conditionalFormatting xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">'
               '<x14:cfRule type="dataBar" id="{11111111-2222-3333-4444-555555555555}"><x14:dataBar minLength="0" maxLength="100" gradient="0">'
               '<x14:cfvo type="autoMin"/><x14:cfvo type="autoMax"/><x14:negativeFillColor rgb="FFFF0000"/><x14:axisColor rgb="FF000000"/></x14:dataBar></x14:cfRule>'
               '<xm:sqref>B3:B10</xm:sqref></x14:conditionalFormatting></x14:conditionalFormattings></ext></extLst>')
        # Excel 2010+ shape: the 2007 dataBar rule points at its x14 twin by id
        x = x.replace('<color rgb="00638EC6"/></dataBar></cfRule>',
            '<color rgb="00638EC6"/></dataBar><extLst><ext uri="{B025F937-C7B1-47D3-B67F-A62EFF666E3E}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:id>{11111111-2222-3333-4444-555555555555}</x14:id></ext></extLst></cfRule>', 1)
        x = x.replace("</worksheet>", ext + "</worksheet>")
    parts[n] = x.encode()
# Excel writes drawings with the xdr: prefix and relative relationship targets
for n in list(parts):
    if re.match(r"xl/drawings/drawing\d+\.xml$", n):
        x = parts[n].decode()
        x = re.sub(r"<(/?)([A-Za-z]+)([\s/>])", r"<\1xdr:\2\3", x)
        x = x.replace('<xdr:wsDr xmlns="', '<xdr:wsDr xmlns:xdr="', 1)
        parts[n] = x.encode()
    if n.endswith(".rels"):
        x = parts[n].decode()
        if n.startswith("xl/worksheets/_rels/") or n.startswith("xl/drawings/_rels/"):
            x = x.replace('Target="/xl/', 'Target="../')
        elif n == "xl/_rels/workbook.xml.rels":
            x = x.replace('Target="/xl/', 'Target="')
        parts[n] = x.encode()
# Excel's own part names for comments and their VML (ExcelJS looks them up literally)
moves = {"xl/comments/comment1.xml": "xl/comments1.xml", "xl/drawings/commentsDrawing1.vml": "xl/drawings/vmlDrawing1.vml"}
for old, new in moves.items():
    if old in parts:
        parts[new] = parts.pop(old)
        for n in list(parts):
            if n.endswith(".rels") or n == "[Content_Types].xml":
                x = parts[n].decode()
                x = x.replace("../comments/comment1.xml", "../comments1.xml").replace("/xl/comments/comment1.xml", "/xl/comments1.xml")
                x = x.replace("commentsDrawing1.vml", "vmlDrawing1.vml")
                parts[n] = x.encode()
# Excel writes comment text as rich runs
if "xl/comments1.xml" in parts:
    c = parts["xl/comments1.xml"].decode()
    c = re.sub(r"<text><t>(.*?)</t></text>", r'<text><r><rPr><b/><sz val="10"/><color indexed="81"/><rFont val="Tahoma"/><family val="2"/></rPr><t>Jarmo:</t></r><r><rPr><sz val="10"/><color indexed="81"/><rFont val="Tahoma"/><family val="2"/></rPr><t xml:space="preserve"> \1</t></r></text>', c)
    parts["xl/comments1.xml"] = c.encode()
sst_xml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="%d" uniqueCount="%d">' % (len(sst), len(sst))
           + "".join(f"<si>{s}</si>" for s in sst) + "</sst>")
parts["xl/sharedStrings.xml"] = sst_xml.encode()
cc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + "".join(f'<c r="{r}" i="{i}"/>' for r, i in calc) + "</calcChain>"
parts["xl/calcChain.xml"] = cc.encode()
rels = parts["xl/_rels/workbook.xml.rels"].decode()
rels = rels.replace("</Relationships>", '<Relationship Id="rIdSS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rIdCC" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>')
parts["xl/_rels/workbook.xml.rels"] = rels.encode()
ct = parts["[Content_Types].xml"].decode()
ct = ct.replace("</Types>", '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/><Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>')
parts["[Content_Types].xml"] = ct.encode()
parts["docProps/custom.xml"] = b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Department"><vt:lpwstr>Finance</vt:lpwstr></property></Properties>'
r = parts["_rels/.rels"].decode().replace("</Relationships>", '<Relationship Id="rIdCustom" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>')
parts["_rels/.rels"] = r.encode()
order = ["[Content_Types].xml"] + [p for p in parts if p != "[Content_Types].xml"]
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
    for p in order: z.writestr(p, parts[p])
print("wrote", dst, len(sst), "shared strings,", len(calc), "formula cells")
