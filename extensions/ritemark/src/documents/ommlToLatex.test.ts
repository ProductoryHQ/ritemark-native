/** Sprint 173 S31–S33, S36. Run with npx tsx src/documents/ommlToLatex.test.ts. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DOMParser } from '@xmldom/xmldom';
import { MATH_CORPUS } from '../export/v2/fixtures/mathCorpus';
import { loadMathConverter, mathmlToOmml } from '../export/v2/mathToWord';
import { equationMarkdown, ommlToLatex } from './ommlToLatex';

const { renderToString } = createRequire(require.resolve('../../webview/package.json'))('katex') as typeof import('../../webview/node_modules/katex');
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml').documentElement!;
const math = (inner: string) => parse(`<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${inner}</m:oMath>`);
const run = (value: string) => `<m:r><m:t>${value}</m:t></m:r>`;
const arg = (tag: string, value: string) => `<m:${tag}>${run(value)}</m:${tag}>`;
const base = arg('e', 'x');
const sub = arg('sub', 'i');
const sup = arg('sup', '2');
const frac = arg('num', 'a') + arg('den', 'b');

const samples: [string, string][] = [
  [run('α+β≤π×2−∞'), String.raw`\alpha +\beta \le \pi \times 2-\infty`],
  [run('\\{}$&amp;#%_^~'), String.raw`\backslash{}\{\}\$\&\#\%\_\text{\textasciicircum}\text{\textasciitilde}`],
  [`<m:f>${frac}</m:f>`, String.raw`\frac{a}{b}`],
  [`<m:f><m:fPr><m:type m:val="lin"/></m:fPr>${frac}</m:f>`, '{ a }/{ b }'],
  [`<m:f><m:fPr><m:type m:val="skw"/></m:fPr>${frac}</m:f>`, String.raw`{}^{a}\!\!/\!\!{}_{b}`],
  [`<m:f><m:fPr><m:type m:val="noBar"/></m:fPr>${frac}</m:f>`, String.raw`\genfrac{}{}{0pt}{}{a}{b}`],
  [`<m:sSub>${base}${sub}</m:sSub>`, 'x_{i}'],
  [`<m:sSup>${base}${sup}</m:sSup>`, 'x^{2}'],
  [`<m:sSubSup>${base}${sub}${sup}</m:sSubSup>`, 'x_{i}^{2}'],
  [`<m:sPre>${sub}${sup}${base}</m:sPre>`, '{}_{i}^{2}x'],
  [`<m:sSup>${arg('e', 'x+y')}${sup}</m:sSup>`, '{x+y}^{2}'],
  [`<m:rad>${base}</m:rad>`, String.raw`\sqrt{x}`],
  [`<m:rad>${arg('deg', '3')}${base}</m:rad>`, String.raw`\sqrt[3]{x}`],
  [`<m:rad><m:radPr><m:degHide m:val="on"/></m:radPr>${arg('deg', '3')}${base}</m:rad>`, String.raw`\sqrt{x}`],
  ...(['∑', '∏', '∫', '∮'] as const).map((symbol, i): [string, string] => [
    `<m:nary><m:naryPr><m:chr m:val="${symbol}"/></m:naryPr>${arg('sub', 'i=1')}${arg('sup', 'n')}${base}</m:nary>`,
    `\\${['sum', 'prod', 'int', 'oint'][i]}_{i=1}^{n} x`,
  ]),
  [`<m:nary><m:naryPr><m:supHide m:val="on"/></m:naryPr>${sub}${sup}${base}</m:nary>`, String.raw`\int_{i} x`],
  [`<m:d><m:dPr><m:begChr m:val="["/><m:endChr m:val=""/><m:sepChr m:val="|"/></m:dPr>${base}${arg('e', 'y')}</m:d>`, String.raw`\left[ x \middle\vert y \right.`],
  [`<m:d><m:dPr><m:sepChr m:val=";"/></m:dPr>${base}${arg('e', 'y')}</m:d>`, String.raw`\left( x;y \right)`],
  [`<m:m><m:mr>${base}${arg('e', 'y')}</m:mr><m:mr>${arg('e', '1')}${arg('e', '2')}</m:mr></m:m>`, String.raw`\begin{matrix}x & y \\ 1 & 2\end{matrix}`],
  [`<m:func>${arg('fName', 'sin')}${base}</m:func>`, String.raw`\sin x`],
  [`<m:func>${arg('fName', 'custom')}${base}</m:func>`, String.raw`\operatorname{custom} x`],
  [`<m:acc><m:accPr><m:chr m:val="⃗"/></m:accPr>${base}</m:acc>`, String.raw`\vec{x}`],
  [`<m:bar><m:barPr><m:pos m:val="top"/></m:barPr>${base}</m:bar>`, String.raw`\overline{x}`],
  [`<m:bar>${base}</m:bar>`, String.raw`\underline{x}`],
  [`<m:limLow>${base}${arg('lim', 'n')}</m:limLow>`, String.raw`\underset{n}{x}`],
  [`<m:limUpp>${base}${arg('lim', 'n')}</m:limUpp>`, String.raw`\overset{n}{x}`],
  [`<m:box>${base}</m:box>`, 'x'],
  [`<m:borderBox>${base}</m:borderBox>`, String.raw`\boxed{x}`],
  [`<m:groupChr>${base}</m:groupChr>`, String.raw`\underbrace{x}`],
  [`<m:groupChr><m:groupChrPr><m:pos m:val="top"/></m:groupChrPr>${base}</m:groupChr>`, String.raw`\overbrace{x}`],
  ['<m:eqArr><m:e>' + run('x') + '<m:r><m:rPr><m:aln/></m:rPr><m:t>=1</m:t></m:r></m:e></m:eqArr>', String.raw`\begin{aligned}x & =1\end{aligned}`],
  [`<m:eqArr>${arg('e', 'x=1')}${arg('e', 'y=2')}</m:eqArr>`, String.raw`\begin{aligned}x=1 \\ y=2\end{aligned}`],
];

for (const [xml, latex] of samples) {
  assert.deepEqual(ommlToLatex(math(xml)), { latex, display: false, approximate: false }, xml);
  assert.doesNotThrow(() => renderToString(latex, { throwOnError: true, strict: 'ignore' }), latex);
}

const unknown = ommlToLatex(math(run('left ') + '<m:unknown>' + run('right_%') + '</m:unknown>'));
assert.equal(unknown.approximate, true);
assert.equal(equationMarkdown(unknown), String.raw`$left right\_\%$`);
assert.ok(ommlToLatex(math(`<m:f><m:fPr><m:newProperty/></m:fPr>${frac}</m:f>`)).approximate);
const strictDisplay = parse('<x:oMathPara xmlns:x="http://purl.oclc.org/ooxml/officeDocument/math"><x:oMath><x:r><x:t>x</x:t></x:r></x:oMath></x:oMathPara>');
assert.equal(equationMarkdown(ommlToLatex(strictDisplay)), '$$\nx\n$$');

// Canonical LaTeX for the structure actually present in Word. The exporter
// drops TeX annotations, represents aligned math as a matrix, and represents
// the corpus binomial as a barred fraction in parentheses.
const importedCorpus = new Map([
  ['mean', String.raw`\bar{x}=\frac{1}{n}\sum_{i=1}^{n} x_{i}`],
  ['x bar inline', String.raw`\bar{x}_{1}=3.1`],
  ['sample size', String.raw`n=48`],
  ['standard deviation', String.raw`s=\sqrt{\frac{1}{n-1}\sum_{i=1}^{n} (x_{i}-\bar{x})^{2} }`],
  ['variance', String.raw`\sigma^{2}=\mathbb{E}\left[ (X-\mu )^{2} \right]`],
  ['beta hat', String.raw`\hat{\beta }`],
  ['regression', String.raw`y_{i}=\beta_{0}+\beta_{1}x_{i}+\varepsilon_{i}`],
  ['OLS slope', String.raw`\hat{\beta }_{1}=\frac{\sum (x_{i}-\bar{x})(y_{i}-\bar{y})}{\sum (x_{i}-\bar{x})^{2}}`],
  ['compound growth', String.raw`A=P{\left( 1+\frac{r}{n} \right) }^{nt}`],
  ['CAGR', String.raw`\text{CAGR}={\left( \frac{V_{\text{end}}}{V_{\text{start}}} \right) }^{1/t}-1`],
  ['NPV', String.raw`\text{NPV}=\sum_{t=0}^{T} \frac{C_{t}}{(1+r)^{t}}`],
  ['elasticity', String.raw`\varepsilon =\frac{\Delta Q/Q}{\Delta P/P}`],
  ['frac in sqrt', String.raw`\sqrt{\frac{a^{2}+b^{2}}{2}}`],
  ['cases', String.raw`f(x)=\begin{cases}x^{2} & \text{if }x\ge 0 \\ -x & \text{otherwise}\end{cases}`],
  ['pmatrix', String.raw`A=\begin{pmatrix}a & b \\ c & d\end{pmatrix}`],
  ['aligned', String.raw`\begin{matrix}y & =2x+3 \\  & =2(x+1.5)\end{matrix}`],
  ['limit', String.raw`\lim_{n\to \infty }{\left( 1+\frac{1}{n} \right) }^{n}=e`],
  ['max under', String.raw`\max_{x}f(x)`],
  ['absolute value', String.raw`\vert x-\mu \vert \le 2\sigma`],
  ['expectation', String.raw`\mathbb{E}[X]=\sum_{x} x\,p(x)`],
  ['text in math', String.raw`\text{margin}=1.96\,\frac{s}{\sqrt{n}}`],
  ['approx', String.raw`\pi \approx 3.14159`],
  ['cdot', String.raw`a\cdot b=\vert a\vert \vert b\vert \cos \theta`],
  ['percent', String.raw`5\%`],
  ['attrition', String.raw`A=\frac{\text{leavers}}{\frac{1}{2}\,(N_{\text{start}}+N_{\text{end}})}\times 100\%`],
  ['margin', String.raw`\Delta \bar{x}\pm 1.96\,\frac{s}{\sqrt{n}}=0.8\pm 0.21`],
  ['integral', String.raw`\int_{0}^{1} x^{2}\,dx =\frac{1}{3}`],
  ['normal pdf', String.raw`f(x)=\frac{1}{\sigma \sqrt{2\pi }}e^{-\frac{(x-\mu )^{2}}{2\sigma^{2}}}`],
  ['z score', String.raw`z=\frac{x-\mu }{\sigma }`],
  ['binomial', String.raw`\left( \frac{n}{k} \right) p^{k}(1-p)^{n-k}`],
  ['set builder', String.raw`\{x\mid x>0\}`],
  ['subscript superscript', String.raw`x_{i}^{2}`],
  ['greek', String.raw`\alpha +\beta =\gamma`],
  ['inequality chain', String.raw`0\le p\le 1`],
  ['product', String.raw`\prod_{i=1}^{n} (1+r_{i})-1`],
  ['derivative', String.raw`\frac{d}{dx}x^{n}=nx^{n-1}`],
  ['partial', String.raw`\frac{\partial L}{\partial \theta }`],
  ['arrow', String.raw`x\to \infty`],
  ['confidence interval', String.raw`\bar{x}\pm t_{\alpha /2,\,n-1}\frac{s}{\sqrt{n}}`],
  ['logistic', String.raw`p=\frac{1}{1+e^{-(\beta_{0}+\beta_{1}x)}}`],
]);

async function main() {
  const exporter = await loadMathConverter();
  assert.ok(exporter);
  for (const formula of MATH_CORPUS) {
    const mathml = renderToString(formula.latex, {
      output: 'mathml', displayMode: formula.display, throwOnError: true, strict: 'ignore',
    }).match(/<math[\s\S]*<\/math>/)![0];
    const result = ommlToLatex(parse(mathmlToOmml(mathml, formula.display, exporter)));
    assert.equal(result.approximate, false, formula.name);
    assert.equal(result.display, formula.display, formula.name);
    assert.doesNotThrow(() => renderToString(result.latex, { throwOnError: true, strict: 'ignore' }), formula.name);
    assert.equal(result.latex, importedCorpus.get(formula.name), formula.name);
  }
  console.log(`ommlToLatex: ${samples.length} OMML samples and ${MATH_CORPUS.length} exported formulas passed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
