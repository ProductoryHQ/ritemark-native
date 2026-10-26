/**
 * Sprint 138 (#481, R8–R10): equations in the export HTML. Run with `npx tsx <this file>`.
 * The typesetting and drawing are injected, as in mermaidExport.test.ts.
 */
import { strict as assert } from 'node:assert'
import { prepareMathForExport, type MathExportRenderer } from './mathExport'

const calls: string[] = []
const renderer: MathExportRenderer = {
  prepare: async () => 'ready',
  check: latex => {
    if (latex.includes('\\fracc')) throw new Error('Undefined control sequence: \\fracc')
  },
  draw: async (latex, display) => {
    calls.push(`draw:${display ? 'display' : 'inline'}:${latex}`)
    return { png: 'data:image/png;base64,AAAA', width: 20.123, height: 14, depth: 3.5 }
  },
  mathml: latex => `<math><mi>${latex.length}</mi></math>`,
}

const html = '<p>Mean <span data-math="inline" data-latex="\\bar{x} &gt; 0" data-delimiter="$">$\\bar{x} &gt; 0$</span> and '
  + '<span data-math="inline" data-latex="\\fracc{a}" data-delimiter="$">$\\fracc{a}$</span>.</p>'
  + '<div data-math="block" data-latex="&#10;E = mc^2&#10;" data-open="$$" data-close="$$">$$\nE = mc^2\n$$</div>'
  + '<p>ChatGPT <span data-math="inline" data-latex="y" data-delimiter="\\[">\\[y\\]</span> and a price $5.</p>'
  + '<div data-math="block" data-latex="" data-open="$$" data-close="$$">$$$$</div>'

async function main(): Promise<void> {
  // ---- PDF: pictures with their size, typos as their source ----
  const pdf = await prepareMathForExport(html, 'pdf', renderer)
  assert.match(pdf, /<span data-math="inline" data-latex="\\bar\{x\} &gt; 0" data-source="\$\\bar\{x\} &gt; 0\$" data-display="false" data-status="ok" data-width="20.12" data-height="14" data-depth="3.5"><img data-math-image="" src="data:image\/png;base64,AAAA" alt="\\bar\{x\} &gt; 0"><\/span>/)
  assert.match(pdf, /<span data-math="inline" data-latex="\\fracc\{a\}" data-source="\$\\fracc\{a\}\$" data-display="false" data-status="error">\$\\fracc\{a\}\$<\/span>/, 'a typo keeps its source as text')
  assert.match(pdf, /<div data-math="block" data-latex="\nE = mc\^2\n" data-source="\$\$\nE = mc\^2\n\$\$" data-display="true" data-status="ok"/, 'a block, display')
  assert.match(pdf, /data-latex="y" data-source="\\\[y\\\]" data-display="true"/, '\\[…\\] written in a paragraph is display math')
  assert.ok(!pdf.includes('data-mathml'), 'no MathML for the PDF')
  assert.ok(pdf.includes('and a price $5.'), 'prose is untouched')
  assert.ok(!pdf.includes('data-latex=""'), 'an empty equation is left out')
  assert.deepEqual(calls, ['draw:inline:\\bar{x} > 0', 'draw:display:\nE = mc^2\n', 'draw:display:y'], 'each good equation drawn once, typos never')

  // ---- Word: MathML too ----
  const word = await prepareMathForExport(html, 'word', renderer)
  assert.match(word, /data-mathml="&lt;math&gt;&lt;mi&gt;11&lt;\/mi&gt;&lt;\/math&gt;"/, 'MathML for Word, escaped in its attribute')

  // ---- without KaTeX's stylesheet: no pictures, but typos still told apart ----
  const plain = await prepareMathForExport(html, 'word', { ...renderer, prepare: async () => 'unavailable' })
  assert.ok(!plain.includes('data-math-image'), 'no pictures without the stylesheet')
  assert.match(plain, /data-latex="\\bar\{x\} &gt; 0"[^>]*data-status="ok"[^>]*data-mathml=/, 'Word still gets MathML')

  // ---- a picture that fails: the equation stays ok, without one ----
  const failing = await prepareMathForExport(html, 'pdf', { ...renderer, draw: async () => { throw new Error('canvas') } })
  assert.match(failing, /data-status="ok">\$\\bar\{x\} &gt; 0\$<\/span>/)

  // ---- a document without math is returned as it was ----
  assert.equal(await prepareMathForExport('<p>No math, $5.</p>', 'pdf', renderer), '<p>No math, $5.</p>')

  console.log('mathExport: all assertions passed')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
