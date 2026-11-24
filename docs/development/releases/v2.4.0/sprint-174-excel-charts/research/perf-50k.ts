/**
 * Sprint 174 R24/R25. Extends Sprint 158's research/proof/perf-50k.ts workload
 * with whole-range rules on the same 50,000 × 20 grid and a separate scatter.
 * From extensions/ritemark, run:
 *   node --import tsx ../../docs/development/releases/v2.4.0/sprint-174-excel-charts/research/perf-50k.ts [output-directory]
 * Defaults to the system temp directory under ritemark-sprint-174. The output
 * files are synthetic, omit creator metadata, and are generated on demand.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const requireExtension = createRequire(resolve(__dirname, '../../../../../../extensions/ritemark/package.json'));
const JSZip = requireExtension('jszip') as typeof import('../../../../../../extensions/ritemark/node_modules/jszip');

const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageNs = 'http://schemas.openxmlformats.org/package/2006';
const spreadsheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const chart = 'http://schemas.openxmlformats.org/drawingml/2006/chart';

type Relationship = [id: string, type: string, target: string];
type Part = [name: string, contentType: string, xml: string];

function relationships(items: Relationship[]) {
  return `<Relationships xmlns="${packageNs}/relationships">${items.map(([id, type, target]) =>
    `<Relationship Id="${id}" Type="${office}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
}

async function writeWorkbook(file: string, sheet: string, extras: Part[], workbookRels: Relationship[], partRels: Record<string, Relationship[]> = {}) {
  const zip = new JSZip();
  const parts: Part[] = [
    ['xl/workbook.xml', 'spreadsheetml.sheet.main', `<workbook xmlns="${spreadsheet}" xmlns:r="${office}"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>`],
    ['xl/worksheets/sheet1.xml', 'spreadsheetml.worksheet', sheet],
    ...extras,
  ];
  const types = parts.map(([name, type]) =>
    `<Override PartName="/${name}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`).join('');
  zip.file('[Content_Types].xml', `<Types xmlns="${packageNs}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>${types}</Types>`);
  zip.file('_rels/.rels', relationships([['rId1', 'officeDocument', 'xl/workbook.xml']]));
  zip.file('xl/_rels/workbook.xml.rels', relationships([['rId1', 'worksheet', 'worksheets/sheet1.xml'], ...workbookRels]));
  for (const [name, xml] of Object.entries(partRels)) zip.file(name, relationships(xml));
  for (const [name, , xml] of parts) zip.file(name, xml);
  await writeFile(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`Wrote ${file}`);
}

async function writeRules(file: string) {
  const rows: string[] = [];
  const strings: string[] = [];
  for (let r = 1; r <= 50_000; r++) {
    let cells = '';
    for (let c = 0; c < 20; c++) {
      const ref = `${String.fromCharCode(65 + c)}${r}`;
      if (c % 4 === 0) {
        strings.push(`Item ${r}-${c}`);
        cells += `<c r="${ref}" t="s"><v>${strings.length - 1}</v></c>`;
      } else if (c === 19) {
        cells += `<c r="${ref}"><f>SUM(B${r}:S${r})</f><v>${r}</v></c>`;
      } else {
        cells += `<c r="${ref}"><v>${(r * 31 + c) % 9973}</v></c>`;
      }
    }
    rows.push(`<row r="${r}" spans="1:20">${cells}</row>`);
  }

  const rules = [
    '<conditionalFormatting sqref="B1:B50000"><cfRule type="colorScale" priority="1"><colorScale><cfvo type="min"/><cfvo type="max"/><color rgb="FFFF6B6B"/><color rgb="FF63BE7B"/></colorScale></cfRule></conditionalFormatting>',
    '<conditionalFormatting sqref="C1:C50000"><cfRule type="dataBar" priority="2"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FF638EC6"/></dataBar></cfRule></conditionalFormatting>',
    '<conditionalFormatting sqref="D1:D50000"><cfRule type="duplicateValues" dxfId="0" priority="3"/></conditionalFormatting>',
  ].join('');
  const sheet = `<worksheet xmlns="${spreadsheet}"><dimension ref="A1:T50000"/><sheetData>${rows.join('')}</sheetData>${rules}</worksheet>`;
  const sst = `<sst xmlns="${spreadsheet}" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`;
  const styles = `<styleSheet xmlns="${spreadsheet}">
    <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
    <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
    <borders count="1"><border/></borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    <dxfs count="1"><dxf><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf></dxfs>
  </styleSheet>`;
  await writeWorkbook(file, sheet, [
    ['xl/sharedStrings.xml', 'spreadsheetml.sharedStrings', sst],
    ['xl/styles.xml', 'spreadsheetml.styles', styles],
  ], [['rId2', 'sharedStrings', 'sharedStrings.xml'], ['rId3', 'styles', 'styles.xml']]);
}

async function writeScatter(file: string) {
  const count = 200_000;
  const rows: string[] = [];
  for (let r = 1; r <= count; r++) {
    const y = Math.round(1000 * Math.sin(r / 3000)) + r % 29;
    rows.push(`<row r="${r}"><c r="A${r}"><v>${r}</v></c><c r="B${r}"><v>${y}</v></c></row>`);
  }

  const sheet = `<worksheet xmlns="${spreadsheet}" xmlns:r="${office}"><dimension ref="A1:B${count}"/><sheetData>${rows.join('')}</sheetData><drawing r:id="rId1"/></worksheet>`;
  const anchor = (tag: string, column: number, row: number) =>
    `<xdr:${tag}><xdr:col>${column}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:${tag}>`;
  const drawingXml = `<xdr:wsDr xmlns:xdr="${drawing}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="${chart}" xmlns:r="${office}">
    <xdr:twoCellAnchor>${anchor('from', 3, 1)}${anchor('to', 15, 24)}
      <xdr:graphicFrame>
        <xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Scatter"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
        <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
        <a:graphic><a:graphicData uri="${chart}"><c:chart r:id="rId1"/></a:graphicData></a:graphic>
      </xdr:graphicFrame>
      <xdr:clientData/>
    </xdr:twoCellAnchor>
  </xdr:wsDr>`;
  const axis = (id: number, other: number, position: string) =>
    `<c:valAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="${position}"/><c:crossAx val="${other}"/><c:crosses val="autoZero"/></c:valAx>`;
  const chartXml = `<c:chartSpace xmlns:c="${chart}"><c:chart><c:plotArea>
    <c:scatterChart><c:scatterStyle val="marker"/><c:ser><c:idx val="0"/><c:order val="0"/>
      <c:xVal><c:numRef><c:f>Data!$A$1:$A$${count}</c:f></c:numRef></c:xVal>
      <c:yVal><c:numRef><c:f>Data!$B$1:$B$${count}</c:f></c:numRef></c:yVal>
    </c:ser><c:axId val="1"/><c:axId val="2"/></c:scatterChart>
    ${axis(1, 2, 'b')}${axis(2, 1, 'l')}
  </c:plotArea></c:chart></c:chartSpace>`;
  await writeWorkbook(file, sheet, [
    ['xl/drawings/drawing1.xml', 'drawing', drawingXml],
    ['xl/charts/chart1.xml', 'drawingml.chart', chartXml],
  ], [], {
    'xl/worksheets/_rels/sheet1.xml.rels': [['rId1', 'drawing', '../drawings/drawing1.xml']],
    'xl/drawings/_rels/drawing1.xml.rels': [['rId1', 'chart', '../charts/chart1.xml']],
  });
}

async function main() {
  const output = resolve(process.argv[2] ?? join(tmpdir(), 'ritemark-sprint-174'));
  await mkdir(output, { recursive: true });
  await writeRules(join(output, 'rules-50k.xlsx'));
  await writeScatter(join(output, 'scatter-200k.xlsx'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
