#!/usr/bin/env node
// Sprint 124 R1: generate the Word preview corpus.
//
//   node generate-corpus.mjs            -> fixtures/*.docx (committed)
//   node generate-corpus.mjs --large    -> only fixtures/f5-oversized.docx (~80 MB, not committed)
//
// Uses the extension's own `docx` and `jszip` packages, so the corpus needs no
// new dependency. Run `npm ci` in extensions/ritemark first. Output is
// deterministic apart from the timestamps `docx` writes into docProps.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../../../../..')
const require = createRequire(path.join(repoRoot, 'extensions/ritemark/package.json'))
const d = require('docx')
const JSZip = require('jszip')

const out = path.join(here, 'fixtures')
fs.mkdirSync(out, { recursive: true })

// ---------------------------------------------------------------- text

const SENTENCES = [
  'The harbour office opens at seven, and the first ferry leaves as soon as the pilot has signed the manifest.',
  'Every shipment carries a paper copy of its route, because the radio link fails more often than anyone admits.',
  'In winter the northern channel freezes, so the schedule moves two hours later and the crews rotate every week.',
  'A good report states what was measured, how it was measured, and what the numbers do not show.',
  'The warehouse keeps a running count of pallets, which the night shift reconciles against the dock log.',
  'When the forecast changes, the dispatcher calls each captain in turn and notes the time of every call.',
  'Most delays come from paperwork rather than weather, which is why the new form has only eleven fields.',
  'The committee agreed to review the tariff each spring and to publish the result in both languages.',
]
function para(n, offset = 0) {
  const parts = []
  for (let i = 0; i < n; i++) parts.push(SENTENCES[(i + offset) % SENTENCES.length])
  return parts.join(' ')
}

// ---------------------------------------------------------------- images

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
/** A deterministic RGB PNG: a two-colour grid with a diagonal band, so misplaced or scaled images show. */
function png(width, height, [r1, g1, b1], [r2, g2, b2]) {
  const rows = []
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3)
    for (let x = 0; x < width; x++) {
      const band = Math.abs(x * height - y * width) < width * 6
      const cell = (Math.floor(x / 25) + Math.floor(y / 25)) % 2 === 0
      const [r, g, b] = band ? [30, 30, 30] : cell ? [r1, g1, b1] : [r2, g2, b2]
      row.set([r, g, b], 1 + x * 3)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------------------------------------------------------- helpers

const STYLES = { default: { document: { run: { font: 'Calibri', size: 22 } } } }
const H = (text, level) => new d.Paragraph({ text, heading: level })
const P = (text, opts = {}) => new d.Paragraph({ children: [new d.TextRun(text)], spacing: { after: 120 }, ...opts })
const pageBreak = () => new d.Paragraph({ children: [new d.PageBreak()] })
const pageNumberFooter = () =>
  new d.Footer({
    children: [
      new d.Paragraph({
        alignment: d.AlignmentType.CENTER,
        children: [new d.TextRun({ children: ['Page ', d.PageNumber.CURRENT, ' of ', d.PageNumber.TOTAL_PAGES] })],
      }),
    ],
  })

async function write(name, doc, post) {
  let buf = await d.Packer.toBuffer(doc)
  if (post) buf = await post(buf)
  fs.writeFileSync(path.join(out, name), buf)
  console.log(`${name}  ${buf.length} bytes`)
}

// ---------------------------------------------------------------- fixtures

const fixtures = []

// 01 — styles and flowing text across several pages with no manual break.
fixtures.push(['01-headings-styles.docx', new d.Document({
  styles: STYLES,
  sections: [{
    children: [
      new d.Paragraph({ text: 'Harbour Operations Review', heading: d.HeadingLevel.TITLE }),
      H('1. Summary', d.HeadingLevel.HEADING_1),
      new d.Paragraph({
        spacing: { after: 120 },
        children: [
          new d.TextRun('This paragraph mixes '),
          new d.TextRun({ text: 'bold', bold: true }),
          new d.TextRun(', '),
          new d.TextRun({ text: 'italic', italics: true }),
          new d.TextRun(', '),
          new d.TextRun({ text: 'underlined', underline: {} }),
          new d.TextRun(', '),
          new d.TextRun({ text: 'coloured', color: 'C0392B' }),
          new d.TextRun(', '),
          new d.TextRun({ text: 'highlighted', highlight: 'yellow' }),
          new d.TextRun(' and '),
          new d.TextRun({ text: 'struck', strike: true }),
          new d.TextRun(' text. '),
          new d.TextRun(para(3)),
        ],
      }),
      P(para(6, 1), { alignment: d.AlignmentType.JUSTIFIED }),
      P('A centred line.', { alignment: d.AlignmentType.CENTER }),
      P('A right-aligned line.', { alignment: d.AlignmentType.RIGHT }),
      P(para(4, 2), { indent: { left: 720, right: 720 } }),
      H('1.1 Method', d.HeadingLevel.HEADING_2),
      ...Array.from({ length: 6 }, (_, i) => P(para(7, i))),
      H('1.1.1 Detail', d.HeadingLevel.HEADING_3),
      ...Array.from({ length: 8 }, (_, i) => P(para(8, i + 3))),
      H('2. Findings', d.HeadingLevel.HEADING_1),
      ...Array.from({ length: 10 }, (_, i) => P(para(6, i + 5))),
    ],
  }],
})])

// 02 — bullets and numbering, three levels, with a restart.
const numbering = {
  config: [
    {
      reference: 'steps',
      levels: [
        { level: 0, format: d.LevelFormat.DECIMAL, text: '%1.', alignment: d.AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: d.LevelFormat.LOWER_LETTER, text: '%2)', alignment: d.AlignmentType.START, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        { level: 2, format: d.LevelFormat.LOWER_ROMAN, text: '%3.', alignment: d.AlignmentType.START, style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
      ],
    },
  ],
}
const num = (text, level, instance = 0) => new d.Paragraph({ text, numbering: { reference: 'steps', level, instance } })
const bul = (text, level) => new d.Paragraph({ text, bullet: { level } })
fixtures.push(['02-lists.docx', new d.Document({
  styles: STYLES,
  numbering,
  sections: [{
    children: [
      H('Checklist', d.HeadingLevel.HEADING_1),
      bul('Confirm the pilot is on board', 0),
      bul('Check the manifest against the dock log', 0),
      bul('Pallets counted by the night shift', 1),
      bul('Damaged pallets set aside', 2),
      bul('Missing pallets reported', 2),
      bul('Containers sealed', 1),
      bul('Sign the departure form', 0),
      H('Procedure', d.HeadingLevel.HEADING_1),
      num('Open the harbour office', 0),
      num('Read the overnight log', 1),
      num('Note every call from the dispatcher', 2),
      num('Note every weather warning', 2),
      num('Check the ferry schedule', 1),
      num('Brief the crews', 0),
      num('Assign the northern channel', 1),
      num('Release the first ferry', 0),
      H('A second list that starts again at 1', d.HeadingLevel.HEADING_2),
      num('Close the office', 0, 1),
      num('File the day report', 0, 1),
      P(para(3)),
    ],
  }],
})])

// 03 — tables: shading, merged cells, a long table with a repeated header row.
const cell = (text, opts = {}) => new d.TableCell({ children: [new d.Paragraph(text)], ...opts })
const shaded = (text, opts = {}) => cell(text, { shading: { fill: 'D9E2F3', type: d.ShadingType.CLEAR, color: 'auto' }, ...opts })
fixtures.push(['03-tables.docx', new d.Document({
  styles: STYLES,
  sections: [{
    children: [
      H('Tables', d.HeadingLevel.HEADING_1),
      P('A table with merged cells and shading:'),
      new d.Table({
        width: { size: 100, type: d.WidthType.PERCENTAGE },
        rows: [
          new d.TableRow({ tableHeader: true, children: [shaded('Route', { rowSpan: 2 }), shaded('Winter', { columnSpan: 2 }), shaded('Summer', { columnSpan: 2 })] }),
          new d.TableRow({ children: [shaded('Days'), shaded('Crew'), shaded('Days'), shaded('Crew')] }),
          new d.TableRow({ children: [cell('Northern channel'), cell('5'), cell('4'), cell('7'), cell('6')] }),
          new d.TableRow({ children: [cell('Island loop'), cell('3', { columnSpan: 2 }), cell('6'), cell('5')] }),
          new d.TableRow({ children: [cell('Southern pier'), cell('closed', { columnSpan: 4, shading: { fill: 'F4CCCC', type: d.ShadingType.CLEAR, color: 'auto' } })] }),
        ],
      }),
      P(''),
      P('A long table whose header row repeats on each page:'),
      new d.Table({
        width: { size: 100, type: d.WidthType.PERCENTAGE },
        rows: [
          new d.TableRow({ tableHeader: true, children: [shaded('#'), shaded('Vessel'), shaded('Arrived'), shaded('Cargo'), shaded('Notes')] }),
          ...Array.from({ length: 70 }, (_, i) => new d.TableRow({
            children: [
              cell(String(i + 1)),
              cell(['Aurora', 'Kestrel', 'Meridian', 'Northwind', 'Saga'][i % 5]),
              cell(`${String(1 + (i % 28)).padStart(2, '0')}.09.2026`),
              cell(['timber', 'grain', 'containers', 'fuel', 'mixed'][i % 5]),
              cell(i % 4 === 0 ? SENTENCES[i % SENTENCES.length] : ''),
            ],
          })),
        ],
      }),
    ],
  }],
})])

// 04 — inline, floating and in-table images.
const imgBlue = png(400, 240, [70, 130, 200], [200, 225, 245])
const imgGreen = png(240, 240, [60, 160, 90], [210, 240, 215])
const imgOrange = png(320, 160, [230, 140, 40], [250, 225, 190])
fixtures.push(['04-images.docx', new d.Document({
  styles: STYLES,
  sections: [{
    children: [
      H('Images', d.HeadingLevel.HEADING_1),
      P('An inline image on its own line:'),
      new d.Paragraph({ children: [new d.ImageRun({ data: imgBlue, transformation: { width: 400, height: 240 } })] }),
      P('An image floating to the right, with text wrapping around it:'),
      new d.Paragraph({
        children: [
          new d.ImageRun({
            data: imgGreen,
            transformation: { width: 160, height: 160 },
            floating: {
              horizontalPosition: { relative: d.HorizontalPositionRelativeFrom.MARGIN, align: d.HorizontalPositionAlign.RIGHT },
              verticalPosition: { relative: d.VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
              wrap: { type: d.TextWrappingType.SQUARE, side: d.TextWrappingSide.BOTH_SIDES },
              margins: { left: 114300, right: 114300, top: 0, bottom: 0 },
            },
          }),
          new d.TextRun(para(8)),
        ],
      }),
      P(para(5, 2)),
      P('An image inside a table cell:'),
      new d.Table({
        width: { size: 100, type: d.WidthType.PERCENTAGE },
        rows: [new d.TableRow({
          children: [
            new d.TableCell({ children: [new d.Paragraph({ children: [new d.ImageRun({ data: imgOrange, transformation: { width: 240, height: 120 } })] })] }),
            cell(para(2, 4)),
          ],
        })],
      }),
    ],
  }],
})])

// 05 — headers and footers: a different first page, page numbers, manual breaks.
fixtures.push(['05-headers-footers.docx', new d.Document({
  styles: STYLES,
  sections: [{
    properties: { titlePage: true },
    headers: {
      first: new d.Header({ children: [new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.TextRun({ text: 'COVER — first-page header', bold: true })] })] }),
      default: new d.Header({ children: [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, children: [new d.TextRun({ text: 'Harbour Operations Review — running header', italics: true })] })] }),
    },
    footers: { first: new d.Footer({ children: [new d.Paragraph('First-page footer')] }), default: pageNumberFooter() },
    children: [
      new d.Paragraph({ text: 'Cover page', heading: d.HeadingLevel.TITLE }),
      P(para(3)),
      pageBreak(),
      H('Chapter one', d.HeadingLevel.HEADING_1),
      P(para(10, 1)),
      pageBreak(),
      H('Chapter two', d.HeadingLevel.HEADING_1),
      P(para(10, 2)),
      pageBreak(),
      H('Chapter three', d.HeadingLevel.HEADING_1),
      P(para(10, 3)),
    ],
  }],
})])

// 06 — footnotes (the `docx` package writes no endnotes; see README).
fixtures.push(['06-footnotes.docx', new d.Document({
  styles: STYLES,
  footnotes: {
    1: { children: [new d.Paragraph('The pilot signs on paper; the digital copy follows within the hour.')] },
    2: { children: [new d.Paragraph('Counted twice: once at the dock and once at the warehouse door.')] },
    3: { children: [new d.Paragraph('The tariff review of 2025 was postponed to the following spring.')] },
  },
  sections: [{
    children: [
      H('Footnotes', d.HeadingLevel.HEADING_1),
      new d.Paragraph({ children: [new d.TextRun('The first ferry leaves when the manifest is signed'), new d.FootnoteReferenceRun(1), new d.TextRun('. ' + para(3))] }),
      new d.Paragraph({ children: [new d.TextRun('Pallets are reconciled every night'), new d.FootnoteReferenceRun(2), new d.TextRun('. ' + para(4, 2))] }),
      new d.Paragraph({ children: [new d.TextRun('The committee publishes the tariff in both languages'), new d.FootnoteReferenceRun(3), new d.TextRun('. ' + para(5, 4))] }),
    ],
  }],
})])

// 07 — sections: portrait, then a landscape section with a wide table, then portrait with wide margins.
const A4 = { width: 11906, height: 16838 }
fixtures.push(['07-sections-landscape.docx', new d.Document({
  styles: STYLES,
  sections: [
    { properties: { page: { size: A4 } }, children: [H('Portrait section', d.HeadingLevel.HEADING_1), P(para(8))] },
    {
      properties: { page: { size: { ...A4, orientation: d.PageOrientation.LANDSCAPE } } },
      children: [
        H('Landscape section', d.HeadingLevel.HEADING_1),
        new d.Table({
          width: { size: 100, type: d.WidthType.PERCENTAGE },
          rows: Array.from({ length: 6 }, (_, r) => new d.TableRow({
            children: Array.from({ length: 9 }, (_, c) => (r === 0 ? shaded(`Week ${c + 1}`) : cell(String((r * 7 + c * 3) % 40)))),
          })),
        }),
        P(para(4, 3)),
      ],
    },
    { properties: { page: { size: A4, margin: { left: 2880, right: 2880 } } }, children: [H('Portrait again, wide margins', d.HeadingLevel.HEADING_1), P(para(8, 5))] },
  ],
})])

// 08 — fonts: common families and one that is not installed anywhere.
const FONTS = ['Calibri', 'Cambria', 'Aptos', 'Arial', 'Times New Roman', 'Georgia', 'Courier New', 'Ritemark Missing Font']
fixtures.push(['08-fonts.docx', new d.Document({
  styles: STYLES,
  sections: [{
    children: [
      H('Fonts', d.HeadingLevel.HEADING_1),
      ...FONTS.flatMap((font) => [
        new d.Paragraph({ children: [new d.TextRun({ text: font, bold: true, font })] }),
        new d.Paragraph({ spacing: { after: 200 }, children: [new d.TextRun({ text: para(2, FONTS.indexOf(font)), font, size: 24 })] }),
      ]),
    ],
  }],
})])

// 09 — a long document with no manual breaks (pagination and cost).
const longChildren = []
for (let ch = 1; ch <= 20; ch++) {
  longChildren.push(H(`Chapter ${ch}`, d.HeadingLevel.HEADING_1))
  for (let i = 0; i < 9; i++) longChildren.push(P(para(6, ch + i)))
  longChildren.push(bul('A point worth keeping', 0), bul('Another point', 0))
  if (ch % 4 === 0) {
    longChildren.push(new d.Table({
      width: { size: 100, type: d.WidthType.PERCENTAGE },
      rows: Array.from({ length: 6 }, (_, r) => new d.TableRow({ children: Array.from({ length: 4 }, (_, c) => (r === 0 ? shaded(`Col ${c + 1}`) : cell(String(r * c + ch)))) })),
    }))
  }
}
fixtures.push(['09-long-document.docx', new d.Document({ styles: STYLES, sections: [{ properties: {}, footers: { default: pageNumberFooter() }, children: longChildren }] })])

// 10 — content the preview may not draw: an equation and a chart (chart parts injected after packing).
const CHART_MARKER = 'RITEMARK-CHART-PLACEHOLDER'
fixtures.push(['10-unsupported-content.docx', new d.Document({
  styles: STYLES,
  sections: [{
    children: [
      H('Content a preview may not draw', d.HeadingLevel.HEADING_1),
      P('An equation:'),
      new d.Paragraph({
        children: [new d.Math({
          children: [
            new d.MathRun('E = '),
            new d.MathFraction({ numerator: [new d.MathRun('m')], denominator: [new d.MathRun('2')] }),
            new d.MathSuperScript({ children: [new d.MathRun('v')], superScript: [new d.MathRun('2')] }),
            new d.MathRun(' + '),
            new d.MathRadical({ children: [new d.MathRun('x')] }),
          ],
        })],
      }),
      P('A chart:'),
      new d.Paragraph({ children: [new d.TextRun(CHART_MARKER)] }),
      P(para(3)),
    ],
  }],
}), injectChart])

// 11 — the two things docx-preview 0.4.1 fixes: page-break-before as direct
// paragraph formatting, and different even and odd headers.
fixtures.push(['11-break-before-even-odd.docx', new d.Document({
  styles: STYLES,
  evenAndOddHeaderAndFooters: true,
  sections: [{
    headers: {
      default: new d.Header({ children: [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, children: [new d.TextRun('ODD-PAGE HEADER')] })] }),
      even: new d.Header({ children: [new d.Paragraph({ children: [new d.TextRun('EVEN-PAGE HEADER')] })] }),
    },
    children: [
      H('Part one', d.HeadingLevel.HEADING_1),
      P(para(4)),
      new d.Paragraph({ pageBreakBefore: true, children: [new d.TextRun({ text: 'Part two starts on a new page (page-break-before)', bold: true })] }),
      P(para(4, 2)),
      new d.Paragraph({ pageBreakBefore: true, children: [new d.TextRun({ text: 'Part three starts on a new page (page-break-before)', bold: true })] }),
      P(para(4, 4)),
    ],
  }],
})])

async function injectChart(buf) {
  const zip = await JSZip.loadAsync(buf)
  const docXml = await zip.file('word/document.xml').async('string')
  const drawing =
    '<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">' +
    '<wp:extent cx="5029200" cy="2743200"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="900" name="Chart 1"/><wp:cNvGraphicFramePr/>' +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
    '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rIdChart1"/>' +
    '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
  const runRe = new RegExp(`<w:r>(?:(?!<w:r>).)*?${CHART_MARKER}.*?</w:r>`, 's')
  if (!runRe.test(docXml)) throw new Error('chart placeholder run not found')
  zip.file('word/document.xml', docXml.replace(runRe, drawing))

  const cats = ['Q1', 'Q2', 'Q3', 'Q4']
  const vals = [12, 19, 15, 23]
  const pts = (arr) => arr.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')
  zip.file('word/charts/chart1.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>' +
    '<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Orders</c:v></c:tx>' +
    `<c:cat><c:strLit><c:ptCount val="4"/>${pts(cats)}</c:strLit></c:cat>` +
    `<c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="4"/>${pts(vals)}</c:numLit></c:val>` +
    '</c:ser><c:gapWidth val="150"/><c:axId val="111"/><c:axId val="222"/></c:barChart>' +
    '<c:catAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222"/></c:catAx>' +
    '<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111"/></c:valAx>' +
    '</c:plotArea><c:plotVisOnly val="1"/></c:chart></c:chartSpace>')

  const rels = await zip.file('word/_rels/document.xml.rels').async('string')
  zip.file('word/_rels/document.xml.rels', rels.replace('</Relationships>',
    '<Relationship Id="rIdChart1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="charts/chart1.xml"/></Relationships>'))
  const types = await zip.file('[Content_Types].xml').async('string')
  zip.file('[Content_Types].xml', types.replace('</Types>',
    '<Override PartName="/word/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>'))
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

const largeOnly = process.argv.includes('--large')
if (!largeOnly) for (const [name, doc, post] of fixtures) await write(name, doc, post)

// ---------------------------------------------------------------- failure fixtures (R5)
if (!largeOnly) {

fs.writeFileSync(path.join(out, 'f1-not-a-zip.docx'), 'This is a plain text file with a .docx name.\n')
console.log('f1-not-a-zip.docx')

const first = fs.readFileSync(path.join(out, '01-headings-styles.docx'))
fs.writeFileSync(path.join(out, 'f2-truncated.docx'), first.subarray(0, Math.floor(first.length / 2)))
console.log('f2-truncated.docx')

// f3-password-protected.docx is produced by Word (word-ground-truth.sh), not here.

// A small archive whose document.xml inflates to 512 MB of spaces — a decompression bomb.
{
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml', Buffer.alloc(512 * 1024 * 1024, 0x20))
  const bomb = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })
  fs.writeFileSync(path.join(out, 'f4-decompression-bomb.docx'), bomb)
  console.log(`f4-decompression-bomb.docx  ${bomb.length} bytes`)
}

}

if (largeOnly) {
  // Genuinely large: 40 photographs' worth of noise that no compressor can shrink. Not committed.
  let seed = 0x2f6b1a3d
  const noisePng = (width, height) => {
    const rows = []
    for (let y = 0; y < height; y++) {
      const row = Buffer.alloc(1 + width * 3)
      for (let x = 1; x < row.length; x++) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5 // xorshift32, deterministic
        row[x] = seed & 0xff
      }
      rows.push(row)
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(width, 0)
    ihdr.writeUInt32BE(height, 4)
    ihdr.set([8, 2, 0, 0, 0], 8)
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 1 })),
      chunk('IEND', Buffer.alloc(0)),
    ])
  }
  const children = [H('A large document', d.HeadingLevel.HEADING_1)]
  for (let i = 0; i < 40; i++) {
    children.push(new d.Paragraph({ children: [new d.ImageRun({ data: noisePng(1000, 666), transformation: { width: 500, height: 333 } })] }))
    children.push(P(`Attachment ${i + 1}`))
  }
  await write('f5-oversized.docx', new d.Document({ styles: STYLES, sections: [{ children }] }))
}
