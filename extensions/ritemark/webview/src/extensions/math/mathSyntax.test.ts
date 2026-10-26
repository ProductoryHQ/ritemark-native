/**
 * Sprint 138 (#481, R1): what counts as math. Run with `npx tsx <this file>`.
 *
 * The "not math" list comes first: a dollar amount turned into an equation
 * would rewrite someone's prose, which is worse than a formula left as text.
 */
import { strict as assert } from 'node:assert'
import {
  escapeLiteralDollars,
  inlineMathSource,
  literalMathPairs,
  nextMathStart,
  normalizeInlineLatex,
  scanBlockMath,
  scanInlineMath,
} from './mathSyntax'

/** Every inline equation in a line, scanning left to right as `marked` does. */
function equationsIn(line: string): string[] {
  const found: string[] = []
  let at = 0
  while (at < line.length) {
    const next = nextMathStart(line.slice(at))
    if (next === undefined) break
    at += next
    if (line.startsWith('\\$', at)) {
      at += 2
      continue
    }
    const match = scanInlineMath(line, at)
    if (match) {
      found.push(match.raw)
      at += match.raw.length
    } else {
      at += 1
    }
  }
  return found
}

// ---- not math ----
for (const prose of [
  'The licence costs $5 and the support $10 a month.',
  'between $20,000 and $30,000 a year',
  'Set $HOME and $PATH before you start.',
  'A lone $ sign.',
  'A $ 5 with a space after the dollar.',
  'Ten dollars is $10, twenty is $20 and thirty is $30.',
  'It costs $5.',
  'An empty pair $$ means nothing.',
  'Two lines $a\n\nb$ with a blank line between.',
  '$ x$ opens on a space.',
  '$x $ closes on a space.',
  'Escaped: \\$x\\$ stays literal.',
  // Ritemark 2.0.1 saved literal brackets as `\[` and `\]`: in running text
  // they are brackets, not ChatGPT's display math.
  'See \\[1\\] and \\[draft\\].',
  '\\[1\\] Smith, J. (2020). A reference.',
  'Tick \\[x\\] when done.',
  'ChatGPT \\[ y = mx + b \\] in a sentence',
]) {
  assert.deepEqual(equationsIn(prose), [], `not math: ${JSON.stringify(prose)}`)
}

// The closing dollar must not be followed by a digit.
assert.equal(scanInlineMath('$5 and 10$5', 0), null, 'a closer followed by a digit does not close')

// ---- math ----
const cases: [string, string[]][] = [
  ['The mean $\\bar{x}$ here.', ['$\\bar{x}$']],
  ['$a$ and $b$', ['$a$', '$b$']],
  ['$x$.', ['$x$']],
  ['Set $\\{x \\mid x > 0\\}$.', ['$\\{x \\mid x > 0\\}$']],
  ['A price inside: $5\\$$ is fine.', ['$5\\$$']],
  ['Display in a line $$x = 1$$ here.', ['$$x = 1$$']],
  ['Display with spaces $$ x $$.', ['$$ x $$']],
  ['Over lines $$\nx = 1\n$$ done', ['$$\nx = 1\n$$']],
  ['ChatGPT \\(x^2\\) inline', ['\\(x^2\\)']],
  ['\\[ y = mx + b \\]', ['\\[ y = mx + b \\]']],
  ['The line is:\n\\[\ny = mx + b\n\\]\nwhere m is the slope.', ['\\[\ny = mx + b\n\\]']],
  ['Inline over a soft break $a +\nb$.', ['$a +\nb$']],
  ['Escaped dollar inside $a\\$b$ stays inside.', ['$a\\$b$']],
  ['Stars $a*b*c$ and underscores $a_1$', ['$a*b*c$', '$a_1$']],
  ['$a $b$ is one: the second dollar follows a space', ['$a $b$']],
]
for (const [line, expected] of cases) {
  assert.deepEqual(equationsIn(line), expected, `math in ${JSON.stringify(line)}`)
}

{
  const match = scanInlineMath('$\\bar{x}$', 0)
  assert.deepEqual(match, { delimiter: '$', latex: '\\bar{x}', raw: '$\\bar{x}$' })
  assert.equal(scanInlineMath('\\(a\\)', 0)?.latex, 'a')
  assert.equal(scanInlineMath('\\[ a \\]', 0)?.latex, ' a ', 'display LaTeX keeps its spaces')
  assert.equal(scanInlineMath('\\(a \\\\)', 0), null, 'an escaped backslash does not close \\(')
}

// ---- blocks ----
{
  assert.deepEqual(scanBlockMath('$$\nx = 1\n$$\n\nNext'), { open: '$$', close: '$$', latex: '\nx = 1\n', raw: '$$\nx = 1\n$$' })
  assert.deepEqual(scanBlockMath('$$x$$'), { open: '$$', close: '$$', latex: 'x', raw: '$$x$$' })
  assert.deepEqual(scanBlockMath('\\[\ny\n\\]'), { open: '\\[', close: '\\]', latex: '\ny\n', raw: '\\[\ny\n\\]' })
  assert.equal(scanBlockMath('$$x$$ and text'), null, 'text after the closer keeps it in its paragraph')
  assert.equal(scanBlockMath('$$\nx\n$$\nThe next line'), null, 'a line right after it keeps it in its paragraph')
  assert.equal(scanBlockMath('$$\nx\n\ny\n$$'), null, 'no blank line inside a block')
  assert.equal(scanBlockMath('$$\n\n$$'), null, 'an empty block is not math')
  assert.equal(scanBlockMath('Text $$x$$'), null, 'a block opens a line')
}

// ---- the save path's escaper ----
{
  assert.equal(escapeLiteralDollars('$x$'), '\\$x\\$', 'typed math-looking text is escaped')
  assert.equal(escapeLiteralDollars('costs $5 and $10'), 'costs $5 and $10', 'prices stay as typed')
  assert.equal(escapeLiteralDollars('$HOME'), '$HOME')
  assert.equal(escapeLiteralDollars('$$x$$'), '\\$\\$x\\$\\$', 'both dollars of a display pair')
  assert.equal(escapeLiteralDollars('\\$x$'), '\\$x$', 'an escaped dollar is left alone, and the other cannot pair')
  assert.equal(escapeLiteralDollars('$a $b$ c$'), '\\$a $b\\$ c$', 'left to right, as marked reads it')
  assert.deepEqual(literalMathPairs('a $x$ b'), [{ index: 2, length: 1 }, { index: 4, length: 1 }])
}

// ---- an edited inline equation ----
{
  assert.equal(normalizeInlineLatex(' a + $b ', '$'), 'a + \\$b', 'trimmed, and a bare dollar escaped')
  assert.equal(inlineMathSource(normalizeInlineLatex(' a + $b ', '$'), '$'), '$a + \\$b$')
  assert.equal(normalizeInlineLatex(' a ', '$$'), ' a ', 'display math keeps its spaces')
  assert.equal(normalizeInlineLatex('a\\$', '$'), 'a\\$', 'an escaped dollar stays escaped')
  assert.equal(inlineMathSource('x', '\\('), '\\(x\\)')
}

console.log('mathSyntax: all assertions passed')
