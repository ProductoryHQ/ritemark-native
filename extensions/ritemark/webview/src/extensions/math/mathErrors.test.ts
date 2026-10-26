/**
 * Sprint 138 (#481, R6): one plain sentence per typesetting error, worded as
 * experience 38 draws it. Run with `npx tsx <this file>`.
 */
import { strict as assert } from 'node:assert'
import { createRequire } from 'node:module'
import { mathErrorSentence, sentenceText } from './mathErrors'

const katex = createRequire(import.meta.url)('katex') as { renderToString(latex: string, options: object): string }

function sentenceFor(latex: string): string {
  try {
    katex.renderToString(latex, { throwOnError: true, strict: 'ignore' })
  } catch (error) {
    return sentenceText(mathErrorSentence(latex, error))
  }
  throw new Error(`${latex} typeset; expected an error`)
}

assert.equal(sentenceFor('\\fracc{s}{\\sqrt{n}}'), "Ritemark can't typeset this: \\fracc isn't a command it knows.")
assert.equal(sentenceFor('\\frac{a}{b'), "Ritemark can't typeset this: a { has no matching }.")
assert.equal(sentenceFor('\\begin{cases} a & b \\\\ c & d'), "Ritemark can't typeset this: \\begin{cases} has no \\end{cases}.")
assert.equal(sentenceFor('a^^b'), "Ritemark can't typeset this. The source is kept as it is.")

// The command is set in the code face: it is a code part.
const parts = mathErrorSentence('\\foo', { rawMessage: 'Undefined control sequence: \\foo' })
assert.deepEqual(parts.filter(part => 'code' in part), [{ code: '\\foo' }])

// Never KaTeX's own words.
for (const latex of ['\\fracc{a}', '\\frac{a}{b', 'a^^b']) {
  const sentence = sentenceFor(latex)
  assert.ok(!/katex|render|math mode|parse error/i.test(sentence), sentence)
}

console.log('mathErrors: all assertions passed')
