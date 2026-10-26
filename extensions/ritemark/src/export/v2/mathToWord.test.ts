/**
 * Sprint 138 (#481, R9): equations in Word. Run with `npx tsx <this file>`.
 *
 * Runs the 40-formula corpus of audit A4 through KaTeX's MathML (the webview's
 * copy, as the export makes it), the real `mathml2omml` and our wrapper, and
 * checks each result is OMML docx accepts, with the converter's known slips
 * fixed. A converter upgrade that breaks a formula fails here.
 */
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Document, ImageRun, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { parse, type HTMLElement } from 'node-html-parser';
import { MATH_CORPUS } from './fixtures/mathCorpus';
import {
  loadMathConverter,
  mathToWordChild,
  mathmlToOmml,
  ommlToParagraphChild,
  readExportMath,
  type MathmlConverter,
} from './mathToWord';

const requireFromWebview = createRequire(path.resolve(__dirname, '../../../webview/package.json'));
const katex = requireFromWebview('katex') as {
  renderToString(latex: string, options: Record<string, unknown>): string;
};

function katexMathml(latex: string, display: boolean): string {
  const html = katex.renderToString(latex, { output: 'mathml', displayMode: display, throwOnError: true, trust: false, strict: 'ignore' });
  const match = /<math[\s\S]*<\/math>/.exec(html);
  assert.ok(match, `KaTeX writes MathML for ${latex}`);
  return match[0];
}

const STYLE = { codeFont: 'Courier' };
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function main(): Promise<void> {
  const convert = await loadMathConverter();
  assert.ok(convert, 'mathml2omml loads through the run-time import');

  // ---- the corpus: every formula converts, inline and display, to clean OMML ----
  for (const formula of MATH_CORPUS) {
    for (const display of [false, true]) {
      const omml = mathmlToOmml(katexMathml(formula.latex, display), display, convert);
      const label = `${formula.name} (${display ? 'display' : 'inline'})`;
      assert.ok(omml.startsWith(display ? '<m:oMathPara ' : '<m:oMath '), `${label}: the right root`);
      assert.doesNotThrow(() => ommlToParagraphChild(omml), `${label}: docx's strict parser accepts it`);
      assert.ok(!/<m:e\/>|<m:e><\/m:e>/.test(omml), `${label}: no empty operand (Word shows a dotted box)`);
      assert.ok(!/<\/m:argPr><m:argPr>/.test(omml), `${label}: one m:argPr per argument`);
      assert.ok(!/undefined/.test(omml), `${label}: no undefined style`);
      assert.ok(!/<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<\/w:rPr><m:rPr>/.test(omml), `${label}: m:rPr before w:rPr`);
      assert.ok(!/[-]/.test(omml), `${label}: no placeholder left behind`);
    }
  }

  const inline = (latex: string) => mathmlToOmml(katexMathml(latex, false), false, convert);
  const display = (latex: string) => mathmlToOmml(katexMathml(latex, true), true, convert);

  // ---- the wrapper's fixes, one by one ----
  {
    const growth = display('A = P\\left(1 + \\frac{r}{n}\\right)^{nt}');
    assert.match(growth, /<m:d><m:dPr><m:begChr m:val="\("\/><m:endChr m:val="\)"\/><\/m:dPr><m:e>/, 'brackets around a fraction stretch');
    assert.match(display('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'), /<m:d>[\s\S]*<m:m>/, 'a matrix sits in a delimiter');
    assert.match(display('f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & \\text{otherwise} \\end{cases}'), /<m:begChr m:val="\{"\/><m:endChr m:val=""\/>/, 'cases opens with a brace only');
    assert.match(display('\\sum_{i=1}^{n} x_i'), /<m:nary>[\s\S]*<m:e><m:sSub>/, 'the summand is the sum\'s operand');
    assert.match(display('\\int_0^1 x^2 \\, dx = 1'), /<m:e>[\s\S]*dx<\/m:t><\/m:r><\/m:e><\/m:nary><m:r><m:t xml:space="preserve">=/, 'an integral\'s operand ends at the relation');
    assert.match(inline('\\lim_{n \\to \\infty} a_n'), /<m:rPr><m:sty m:val="p"\/><\/m:rPr><m:t xml:space="preserve">lim/, 'lim is upright');
    assert.match(inline('\\mathbb{E}[X]'), /𝔼/, '\\mathbb becomes the double-struck letter');
    assert.match(inline('\\mathbb{R}'), /ℝ/, 'with Unicode\'s letterlike exceptions');
    assert.match(inline('x \\text{ if } y'), /<m:t xml:space="preserve"> if <\/m:t>/, 'text keeps its spaces');
    assert.match(inline('\\lvert x \\rvert'), /\|x\|/, 'absolute value bars, not "divides"');
    assert.match(inline('\\{x \\mid x > 0\\}'), /∣/, '\\mid stays a relation');
  }

  // ---- what a paragraph gets: an equation, a picture or the source ----
  const element = (html: string) => parse(html).firstChild as HTMLElement;
  const mathml = katexMathml('\\bar{x}', false);
  const ok = element(
    `<span data-math="inline" data-latex="\\bar{x}" data-source="$\\bar{x}$" data-status="ok" data-width="12" data-height="14" data-depth="0" data-mathml="${mathml.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"><img data-math-image="" src="data:image/png;base64,${PNG_1PX.toString('base64')}"></span>`,
  );
  const read = readExportMath(ok);
  assert.ok(read, 'the export element is read');
  assert.equal(read.mathml, mathml, 'the MathML survives the attribute');
  assert.equal(read.source, '$\\bar{x}$');
  assert.equal(read.display, false);
  assert.ok(read.image && read.image.equals(PNG_1PX), 'the picture is read');

  assert.equal(mathToWordChild(read, STYLE, convert).outcome, 'equation');
  const throwing: MathmlConverter = () => { throw new Error('cannot convert'); };
  const fallback = mathToWordChild(read, STYLE, throwing);
  assert.equal(fallback.outcome, 'picture', 'a converter failure gives the picture');
  assert.ok(fallback.child instanceof ImageRun);
  assert.equal(mathToWordChild(read, STYLE, null).outcome, 'picture', 'no converter: the picture');
  const garbage: MathmlConverter = () => '<m:oMath><m:r>';
  assert.equal(mathToWordChild(read, STYLE, garbage).outcome, 'picture', 'malformed OMML: the picture');

  const typo = readExportMath(element('<span data-math="inline" data-latex="\\fracc{a}" data-source="$\\fracc{a}$" data-status="error"></span>'));
  assert.ok(typo);
  const typoChild = mathToWordChild(typo, STYLE, convert);
  assert.equal(typoChild.outcome, 'source', 'a typo is its source');
  assert.ok(typoChild.child instanceof TextRun);

  // ---- a packed document holds native equations ----
  {
    const children = [
      new Paragraph({ children: [new TextRun('The mean '), mathToWordChild(read, STYLE, convert).child, new TextRun(' here.')] }),
      new Paragraph({ children: [ommlToParagraphChild(display(MATH_CORPUS[0].latex))] }),
    ];
    const buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }));
    const xml = await (await JSZip.loadAsync(buffer)).file('word/document.xml')!.async('string');
    assert.match(xml, /<w:p>(?:(?!<\/w:p>)[\s\S])*The mean (?:(?!<\/w:p>)[\s\S])*<m:oMath\b/, 'the inline equation is in its sentence');
    assert.match(xml, /<m:oMathPara\b[\s\S]*<m:jc m:val="center"\/>/, 'the display equation is centred');
  }

  console.log(`mathToWord: all assertions passed (${MATH_CORPUS.length} formulas, inline and display)`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
