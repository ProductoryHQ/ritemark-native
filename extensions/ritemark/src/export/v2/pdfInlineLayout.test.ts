/**
 * Sprint 138 (#481, R8, R12): the PDF's inline layout. Run with `npx tsx <this file>`.
 *
 * A fake surface with fixed character widths checks wrapping, the baseline
 * of an equation, a too-wide equation, display math, faces and a cell's
 * measured height; a real pdfkit document checks the whole path draws.
 */
import { strict as assert } from 'node:assert';
import PDFDocument from 'pdfkit';
import { parse, type HTMLElement } from 'node-html-parser';
import {
  breakLines,
  collectRuns,
  layoutRuns,
  pdfkitSurface,
  standardFonts,
  type InlineRun,
  type PdfSurface,
} from './pdfInlineLayout';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

interface Draw { kind: 'text' | 'image'; value?: string; font?: string; x: number; y: number; width?: number; height?: number }

function fakeSurface(): PdfSurface & { draws: Draw[] } {
  const draws: Draw[] = [];
  return {
    draws,
    widthOf: (text, _font, size) => text.length * size * 0.5,
    ascent: (_font, size) => size * 0.7,
    descent: (_font, size) => size * 0.2,
    drawText: (value, x, baseline, font) => { draws.push({ kind: 'text', value, font, x, y: baseline }); },
    drawImage: (_image, x, y, width, height) => { draws.push({ kind: 'image', x, y, width, height }); },
    roomFor: (_height, y) => y,
  };
}

const fonts = standardFonts('Helvetica', 'Courier');
const options = { x: 0, y: 0, width: 100, fontSize: 10, fonts, color: '#222', lineGap: 2 };
const text = (value: string, face: Extract<InlineRun, { kind: 'text' }>['face'] = 'regular'): InlineRun => ({ kind: 'text', text: value, face });

// ---- wrapping: 10 pt, 5 pt a character, 100 pt wide = 20 characters a line ----
{
  const lines = breakLines([text('aaaa bbbb cccc dddd eeee ffff')], fakeSurface(), options);
  assert.equal(lines.length, 2, 'wraps at the space before the word that does not fit');
  assert.equal(lines[1].pieces[0].width, 20, 'no space at the start of the second line');
}

// ---- an inline equation sits on the baseline ----
{
  const surface = fakeSurface();
  const math: InlineRun = { kind: 'math', image: PNG, width: 30, height: 20, depth: 5, display: false };
  const end = layoutRuns([text('x = '), math, text(' ok')], surface, options);
  const image = surface.draws.find(draw => draw.kind === 'image')!;
  const word = surface.draws.find(draw => draw.kind === 'text')!;
  const baseline = word.y;
  assert.equal(baseline, 15, 'the line grows to the equation\'s height above the baseline (20 - 5)');
  assert.equal(image.y, baseline - 15, 'the picture\'s top is its height above the baseline');
  assert.equal(image.y + image.height!, baseline + 5, 'its depth hangs below the baseline');
  assert.equal(end, 15 + 5 + 2, 'line height: ascent 15, descent 5, gap 2');
}

// ---- an equation wider than the line is scaled to fit ----
{
  const surface = fakeSurface();
  layoutRuns([{ kind: 'math', image: PNG, width: 400, height: 40, depth: 10, display: false }], surface, options);
  const image = surface.draws.find(draw => draw.kind === 'image')!;
  assert.equal(image.width, 100, 'scaled to the column');
  assert.equal(image.height, 10, 'in proportion');
}

// ---- display math in a paragraph: a line of its own, centred ----
{
  const surface = fakeSurface();
  layoutRuns([text('before'), { kind: 'math', image: PNG, width: 40, height: 10, depth: 2, display: true }, text('after')], surface, options);
  const image = surface.draws.find(draw => draw.kind === 'image')!;
  assert.equal(image.x, 30, 'centred: (100 - 40) / 2');
  const words = surface.draws.filter(draw => draw.kind === 'text');
  assert.ok(words[0].y < image.y && words[1].y > image.y + image.height!, 'the text before and after are on lines of their own');
}

// ---- runs from HTML keep bold, italic, code and equations ----
{
  const html = '<p>a <strong>b <em>c</em></strong> <code>d</code> '
    + `<span data-math="inline" data-status="ok" data-width="40" data-height="16" data-depth="4" data-source="$x$"><img data-math-image="" src="data:image/png;base64,${PNG.toString('base64')}"></span>`
    + ' <span data-math="inline" data-status="error" data-source="$\\fracc{a}$">$\\fracc{a}$</span> &amp; done</p>';
  const runs = collectRuns(parse(html).firstChild as HTMLElement);
  const faces = runs.filter(run => run.kind === 'text').map(run => `${(run as { face: string }).face}:${(run as { text: string }).text}`);
  assert.deepEqual(faces, ['regular:a ', 'bold:b ', 'boldItalic:c', 'regular: ', 'code:d', 'regular: ', 'regular: ', 'code:$\\fracc{a}$', 'regular: & done']);
  const math = runs.find(run => run.kind === 'math') as Extract<InlineRun, { kind: 'math' }>;
  assert.equal(math.width, 30, '40 px is 30 pt');
  assert.equal(math.depth, 3, '4 px is 3 pt');

  const surface = fakeSurface();
  layoutRuns(runs, surface, { ...options, width: 400 });
  const fontsUsed = new Set(surface.draws.filter(draw => draw.kind === 'text').map(draw => draw.font));
  assert.ok(fontsUsed.has('Helvetica-Bold') && fontsUsed.has('Helvetica-BoldOblique') && fontsUsed.has('Courier'), 'each face draws in its font');
}

// ---- a table cell's height, measured without drawing ----
{
  const surface = fakeSurface();
  const height = layoutRuns([text('aaaa bbbb cccc dddd eeee ffff')], surface, { ...options, dryRun: true });
  assert.equal(height, 2 * (7 + 2 + 2), 'two lines');
  assert.equal(surface.draws.length, 0, 'a dry run draws nothing');
}

// ---- the real thing: pdfkit draws text and an equation picture ----
async function realPdf(): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 72, bottom: 72, left: 72, right: 72 } });
  const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(chunk as Buffer));
  const done = new Promise<void>(resolve => doc.on('end', () => resolve()));
  const surface = pdfkitSurface(doc, () => doc.page.height - 96, 72);
  const end = layoutRuns(
    [text('The mean '), { kind: 'math', image: PNG, width: 20, height: 12, depth: 3, display: false }, text(' is ', 'italic'), text('bold', 'bold')],
    surface,
    { ...options, x: 72, y: 72, width: 451, fontSize: 11, lineGap: 3 },
  );
  assert.ok(end > 72, 'the line advances');
  assert.ok(surface.ascent('Helvetica', 10) > 6 && surface.descent('Helvetica', 10) > 1, 'pdfkit\'s font metrics are read');
  doc.end();
  await done;
  const pdf = Buffer.concat(chunks).toString('latin1');
  assert.ok(pdf.includes('/Subtype /Image'), 'the equation is an image in the PDF');
  assert.ok(pdf.includes('Helvetica-Oblique') && pdf.includes('Helvetica-Bold'), 'italic and bold faces are embedded');
}

realPdf().then(() => console.log('pdfInlineLayout: all assertions passed')).catch(error => {
  console.error(error);
  process.exit(1);
});
