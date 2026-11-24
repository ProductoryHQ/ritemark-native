/** Synthetic equation package used by the document reader and Save as Markdown tests. */
import { Document, Packer, Paragraph } from 'docx';
import JSZip from 'jszip';

const run = (text: string) => `<m:r><m:t>${text}</m:t></m:r>`;
const arg = (tag: string, text: string) => `<m:${tag}>${run(text)}</m:${tag}>`;
const inline = (xml: string) => `<m:oMath>${xml}</m:oMath>`;
const display = (xml: string) => `<m:oMathPara>${inline(xml)}</m:oMathPara>`;
const prose = (text: string) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;

export const WORD_EQUATION_MARKDOWN = [
  String.raw`A fraction $\frac{a}{b}$, a root $\sqrt{x}$, and a sum $\sum_{i=1}^{n}$.`,
  '$$\n' + String.raw`\begin{matrix}a & b \\ c & d\end{matrix}` + '\n$$',
  String.raw`Unknown $left right\_\%$ and $another$.`,
  '$$\ny\n$$',
].join('\n\n');

export async function wordEquationFixture(withEquations = true): Promise<Uint8Array> {
  const original = await Packer.toBuffer(new Document({
    creator: 'fixture',
    lastModifiedBy: 'fixture',
    sections: [{ children: [new Paragraph('Fixture text.')] }],
  }));
  if (!withEquations) return original;
  const zip = await JSZip.loadAsync(original);
  const part = zip.file('word/document.xml')!;
  const xml = await part.async('string');
  const paragraphs = [
    prose('A fraction ') + inline(`<m:f>${arg('num', 'a')}${arg('den', 'b')}</m:f>`)
      + prose(', a root ') + inline(`<m:rad>${arg('e', 'x')}</m:rad>`)
      + prose(', and a sum ') + inline(`<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr>${arg('sub', 'i=1')}${arg('sup', 'n')}<m:e/></m:nary>`)
      + prose('.'),
    display(`<m:m><m:mr>${arg('e', 'a')}${arg('e', 'b')}</m:mr><m:mr>${arg('e', 'c')}${arg('e', 'd')}</m:mr></m:m>`),
    prose('Unknown ') + inline(run('left ') + `<m:future>${run('right_%')}</m:future>`)
      + prose(' and ') + inline(`<m:future>${run('another')}</m:future>`) + prose('.'),
  ];
  zip.file(part.name, xml.replace(`<w:p>${prose('Fixture text.')}</w:p>`,
    () => paragraphs.map(body => `<w:p>${body}</w:p>`).join('') + display(run('y'))));
  return zip.generateAsync({ type: 'uint8array' });
}
