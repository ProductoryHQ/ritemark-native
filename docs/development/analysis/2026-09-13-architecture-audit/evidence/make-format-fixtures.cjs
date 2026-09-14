// Synthetic viewer fixtures, generated with the repository's locked libraries.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const fromExtension = createRequire(path.resolve(__dirname, '../../../../../extensions/ritemark/package.json'));
const PDFDocument = fromExtension('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, PageBreak } = fromExtension('docx');
const run = process.argv[2];
if (!run?.startsWith('/private/tmp/ritemark-audit-formats-')) throw new Error('Synthetic fixture directory required');
async function main() {
  for (const variant of ['BASE', 'EXTERNAL']) {
    const pdf = new PDFDocument({ autoFirstPage: false });
    const chunks = [];
    const finished = new Promise((resolve, reject) => { pdf.on('data', chunk => chunks.push(chunk)); pdf.on('end', resolve); pdf.on('error', reject); });
    for (let page = 1; page <= 2; page++) {
      pdf.addPage({ size: 'A4', margin: 48 });
      pdf.font('Helvetica-Bold').fontSize(24).text(`AUDIT PDF ${variant}`);
      pdf.moveDown().font('Helvetica').fontSize(12).text(`Page ${page} of 2. Local synthetic reference.`);
      pdf.moveDown().text('Alpha 42 / Beta 84');
      pdf.rect(48, 190, 250, 60).fillAndStroke('#dae8fc', '#6c8ebf');
      pdf.fillColor('#000000').fontSize(14).text('VISIBLE REFERENCE BOX', 60, 210);
    }
    pdf.end();
    await finished;
    fs.writeFileSync(path.join(run, 'variants', variant.toLowerCase() + '.pdf'), Buffer.concat(chunks));
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ text: `AUDIT DOCX ${variant}`, heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ children: [new TextRun({ text: 'Bold reference. ', bold: true }), new TextRun({ text: 'Eesti õäöü – väärtus 42.', italics: true })] }),
      new Paragraph({ text: 'First list item', bullet: { level: 0 } }),
      new Paragraph({ text: 'Second list item', bullet: { level: 0 } }),
      new Table({ rows: [['Name', 'Value'], ['Alpha', '42'], ['Beta', '84']].map(cells => new TableRow({ children: cells.map(text => new TableCell({ children: [new Paragraph(text)] })) })) }),
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ text: 'SECOND PAGE REFERENCE', heading: HeadingLevel.HEADING_2 }),
      new Paragraph('This is a preview fidelity fixture, not an editable DOCX round-trip claim.'),
    ] }] });
    fs.writeFileSync(path.join(run, 'variants', variant.toLowerCase() + '.docx'), await Packer.toBuffer(doc));
  }
  for (const ext of ['pdf', 'docx']) fs.copyFileSync(path.join(run, 'variants', 'base.' + ext), path.join(run, 'workspace', 'sample.' + ext));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
