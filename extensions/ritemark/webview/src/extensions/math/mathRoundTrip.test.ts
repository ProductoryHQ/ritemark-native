/**
 * Sprint 138 (#481, R2): math is written back as it was. Run with `npx tsx <this file>`.
 *
 * Drives the editor's own pipeline (`utils/editorMarkdown.ts`): on load
 * `markdownToEditorHTML`, then TipTap's own parse (its whitespace pass and
 * `preserveWhitespace: 'full'`, as `createNodeFromContent` does); on save
 * `getHTML()` and `editorHTMLToMarkdown`. The DOM is domino, Turndown's own.
 *
 * Before Sprint 138 a save doubled every backslash in a formula, dropped the
 * backslash of `\{`, `\,` and `\%`, escaped `_` and turned `\(x\)` into `(x)`
 * (research/today.md), so one edited word rewrote every equation in a file.
 */
import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDocument } from '@mixmark-io/domino'
import { getSchema, getTextBetween, getTextSerializersFromSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, DOMSerializer, type Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { isEquationNodeSelection } from './mathNodes'
import { openAndSave } from '../../utils/markdownFidelity'
import {
  createEditorSchemaExtensions,
  editorHTMLToMarkdown,
  editorMarked,
  markdownToEditorHTML,
} from '../../utils/editorMarkdown'

// The load and save helpers build their temporary DOM with `document`. Every
// browser's NodeList has `forEach`; domino's does not.
const hostDocument = createDocument('<!doctype html><html><body></body></html>')
const nodeListPrototype = Object.getPrototypeOf(hostDocument.querySelectorAll('p')) as { forEach?: unknown }
nodeListPrototype.forEach ??= Array.prototype.forEach
// A browser's classList is iterable (the code block's parse rule spreads it).
const tokenListPrototype = Object.getPrototypeOf(hostDocument.body.classList) as Record<symbol, unknown>
tokenListPrototype[Symbol.iterator] ??= Array.prototype[Symbol.iterator]
;(globalThis as { document?: unknown }).document = hostDocument

const here = path.dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => fs.readFileSync(path.join(here, 'fixtures', name), 'utf8')

const schema = getSchema(createEditorSchemaExtensions())

/** TipTap's `elementFromString` drops the newline-only text `marked` puts between tags. */
function removeWhitespaces(node: Node): Node {
  for (let index = node.childNodes.length - 1; index >= 0; index--) {
    const child = node.childNodes[index]
    if (child.nodeType === 3 && child.nodeValue && /^(\n\s\s|\n)$/.test(child.nodeValue)) node.removeChild(child)
    else if (child.nodeType === 1) removeWhitespaces(child)
  }
  return node
}

function fromHTML(html: string): PMNode {
  const body = createDocument(`<!doctype html><html><body>${html}</body></html>`).body
  return PMDOMParser.fromSchema(schema).parse(removeWhitespaces(body), { preserveWhitespace: 'full' })
}

const load = (markdown: string): PMNode => fromHTML(markdownToEditorHTML(markdown))

function getHTML(doc: PMNode): string {
  const document = createDocument()
  const container = document.createElement('div')
  container.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(doc.content, { document }))
  return container.innerHTML
}

const save = (doc: PMNode): string => editorHTMLToMarkdown(getHTML(doc))

/** The editor never carries the file's trailing newline; the host keeps it. */
const projection = (markdown: string) => markdown.replace(/\n+$/, '')

/** Every equation in a Markdown text, as `marked` reads it, in order. */
function equations(markdown: string): string[] {
  const found: string[] = []
  const walk = (tokens: unknown[]) => {
    for (const token of tokens as Array<Record<string, unknown>>) {
      if (token.type === 'mathInline' || token.type === 'mathBlock') found.push(String(token.raw).replace(/\n$/, ''))
      for (const key of ['tokens', 'items', 'header', 'rows'] as const) {
        const value = token[key]
        if (Array.isArray(value)) walk(value.flat() as unknown[])
      }
      if (Array.isArray((token as { cells?: unknown[] }).cells)) walk(((token as { cells: unknown[] }).cells).flat())
    }
  }
  walk(editorMarked.lexer(markdown))
  return found
}

function nodesOf(doc: PMNode, name: string): PMNode[] {
  const found: PMNode[] = []
  doc.descendants(node => {
    if (node.type.name === name) found.push(node)
  })
  return found
}

function nodePositions(doc: PMNode, name: string): number[] {
  const found: number[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === name) found.push(pos)
  })
  return found
}

// ---- the fixtures, byte for byte, as whole files ----
// Through the editor's own load and save, and through what the host does with
// the file's text (Sprint 137's `openAndSave`): every line comes back, the
// list lines, soft breaks and quotes around the math included.
for (const name of ['forms.md', 'prose-dollars.md', 'edge-cases.md', 'analyst-report.md', 'lists.md']) {
  const source = fixture(name)
  const doc = load(source)
  const saved = save(doc)

  assert.deepEqual(equations(saved), equations(source), `${name}: every equation is written back exactly`)
  assert.equal(save(load(saved)), saved, `${name}: a second save changes nothing`)
  assert.equal(saved, projection(source), `${name}: the editor writes the whole file back`)
  assert.equal(openAndSave(source), source, `${name}: open and save give the file back byte for byte`)
}

// ---- an equation that opens a list item stays in its item ----
// `listItem` is `paragraph block*`: an equation block can't open an item, so
// there it is display math in the item's paragraph. Each list keeps its items.
{
  const cases: [string, string, number][] = [
    ['- $$E = mc^2$$\n- $$F = ma$$', 'listItem', 2],
    ['1. $$x = 1$$\n2. $$x = 2$$', 'listItem', 2],
    ['1. \\[x^2 + y^2 = r^2\\]', 'listItem', 1],
    ['- [ ] $$x$$\n- [x] done', 'taskItem', 2],
    ['- outer\n  - $$x$$', 'listItem', 2],
    ['1. one\n   1. \\[y\\]\n2. two', 'listItem', 3],
    ['> - $$x$$\n> - text', 'listItem', 2],
  ]
  for (const [source, item, items] of cases) {
    const doc = load(source)
    assert.equal(nodesOf(doc, item).length, items, `${JSON.stringify(source)}: every item is kept`)
    assert.equal(nodesOf(doc, 'mathBlock').length, 0, `${JSON.stringify(source)}: no block lifted out of an item`)
    assert.ok(nodesOf(doc, 'mathInline').length >= 1, `${JSON.stringify(source)}: the equation is in the item`)
    assert.equal(openAndSave(`${source}\n`), `${source}\n`, `${JSON.stringify(source)}: byte for byte`)
  }
  // An equation block after an item's first paragraph is a block in the item.
  const later = load('- The law:\n\n  $$\n  E = mc^2\n  $$')
  assert.equal(nodesOf(later, 'mathBlock').length, 1, 'a block later in an item stays a block')
  assert.equal(nodesOf(later, 'bulletList').length, 1)
}

// ---- the report: every equation becomes a node; prices and `\$` stay text ----
{
  const doc = load(fixture('analyst-report.md'))
  assert.equal(nodesOf(doc, 'mathBlock').length, 2, 'two equation blocks')
  assert.equal(nodesOf(doc, 'mathInline').length, 13, 'thirteen inline equations, the table and the list included')
  assert.equal(nodesOf(doc, 'literalDollar').length, 2, 'the two escaped prices')
  assert.ok(doc.textContent.includes('$12,000 per warehouse'), 'an escaped price reads as a price')
}

// ---- prose dollars never become math ----
{
  const doc = load(fixture('prose-dollars.md'))
  assert.equal(nodesOf(doc, 'mathInline').length + nodesOf(doc, 'mathBlock').length, 0, 'no equations in prose')
}

// ---- `\[…\]`: display math on its own lines, brackets in running text ----
{
  // Ritemark 2.0.1 saved literal brackets escaped; they open as brackets.
  const saved201 = 'See \\[1\\] and \\[draft\\].\n\n\\[1\\] Smith, J. (2020).'
  const doc = load(saved201)
  assert.equal(nodesOf(doc, 'mathInline').length + nodesOf(doc, 'mathBlock').length, 0, '2.0.1 brackets are not math')
  assert.ok(doc.textContent.includes('See [1] and [draft].'), 'they read as brackets')
  // ChatGPT's display math on lines of its own inside a paragraph is math.
  const chatgpt = 'The line is:\n\\[\ny = mx + b\n\\]\nwhere m is the slope.'
  const answer = load(chatgpt)
  assert.deepEqual(nodesOf(answer, 'mathInline').map(node => node.attrs.latex), ['\ny = mx + b\n'], 'display math between lines')
  assert.equal(save(answer), chatgpt, 'and it saves as written')
}

// ---- code, links and comments keep their dollars ----
{
  assert.deepEqual(equations('A comment <!-- $not$ math --> in a line.'), [], 'an inline HTML comment is not math')
  assert.deepEqual(equations('<!-- $not$ math -->'), [], 'a comment block is not math')
  assert.deepEqual(equations('<https://example.com/$x$>'), [], 'an autolink is not math')
  assert.deepEqual(equations('    $indented code$'), [], 'an indented code block is not math')
}
{
  const doc = load(fixture('edge-cases.md'))
  const inline = nodesOf(doc, 'mathInline').map(node => node.attrs.latex)
  assert.ok(!inline.includes('x') || inline.filter(latex => latex === 'x').length === 1, 'only the link text\'s $x$ is math, not its address')
  assert.ok(doc.textContent.includes('$$ y $$'), 'code keeps its dollars')
  assert.ok(nodesOf(doc, 'mathBlock').length === 1, 'the quote holds an equation block')
}

// ---- typed dollars: written as typed unless they would pair up ----
const typed = (html: string) => save(fromHTML(html))
{
  assert.equal(typed('<p>It costs $5.</p>'), 'It costs $5.')
  assert.equal(typed('<p>costs $5 and $10</p>'), 'costs $5 and $10')
  assert.equal(typed('<p>$x$</p>'), '$x\\$', 'typed text that looks like math: its closer is escaped')
  assert.equal(nodesOf(load(typed('<p>$x$</p>')), 'mathInline').length, 0, 'and reopens as text')
  assert.equal(load(typed('<p>$x$</p>')).textContent, '$x$')
  assert.equal(typed('<p>$$x$$</p>'), '$$x\\$\\$')
  assert.equal(load(typed('<p>$$x$$</p>')).textContent, '$$x$$')
  assert.equal(typed('<p>$a $b$ c$</p>'), '$a $b\\$ c\\$', 'every pair broken at its closer, until nothing pairs')
  assert.equal(load(typed('<p>$a $b$ c$</p>')).textContent, '$a $b$ c$', 'and it reopens as the same text')
  assert.equal(typed('<p>from $5 to $10 ($x$)</p>'), 'from $5 to $10 (\\$x\\$)', 'typed amounts stay as typed')
  assert.equal(load(typed('<p>from $5 to $10 ($x$)</p>')).textContent, 'from $5 to $10 ($x$)', 'and it reopens as the same text')
  assert.equal(nodesOf(load(typed('<p>from $5 to $10 ($x$)</p>')), 'mathInline').length, 0, 'and nothing reopens as math')

  // A typed price before an equation would pair with the equation's own dollar.
  // Every typed sentence comes back as typed text: no equation, no character changed.
  for (const sentence of [
    'Costs $5 and the formula $x$ holds.',
    'The report cost $12,000 and covers $n=5$ stores.',
    'From $5 to $10 ($x$).',
    '$x$, $y$ and $z$.',
    'Each costs $5$ here.',
    'Mixed $a$b$ text',
    'Three prices $1, $2 and $3.',
    'Two in a row $a$$b$ and a lone $.',
    'Between $20,000 and $30,000 a year, $x$ and $$y$$.',
  ]) {
    const reopened = load(typed(`<p>${sentence}</p>`))
    assert.equal(nodesOf(reopened, 'mathInline').length, 0, `typed text stays text: ${sentence}`)
    assert.equal(reopened.textContent, sentence, `and comes back as typed: ${sentence}`)
  }

  // A typed dollar that would pair with an equation's own opener: the typed one is escaped.
  const against = typed('<p>$a<span data-math="inline" data-delimiter="$" data-latex="x">$x$</span> end</p>')
  assert.equal(against, '\\$a$x$ end', 'the equation\'s delimiters are never touched')
  assert.deepEqual(nodesOf(load(against), 'mathInline').map(node => node.attrs.latex), ['x'])

  const priced = typed('<p>costs $5 and <span data-math="inline" data-delimiter="$" data-latex="x">$x$</span> total</p>')
  assert.equal(priced, 'costs $5 and $x$ total', 'Pandoc does not pair the price with the equation: nothing to escape')
  const reopened = load(priced)
  assert.deepEqual(nodesOf(reopened, 'mathInline').map(node => node.attrs.latex), ['x'], 'one equation, the same one')
  assert.equal(reopened.textContent.startsWith('costs $5 and '), true)

  // A typed dollar right before an equation block's opener in the same line.
  const touching = typed('<p>a $<span data-math="inline" data-delimiter="$$" data-latex="y">$$y$$</span></p>')
  assert.deepEqual(nodesOf(load(touching), 'mathInline').map(node => node.attrs.latex), ['y'], 'the equation survives a dollar typed against it')

  // A typed backslash before a dollar.
  const slashed = typed('<p>a\\$b$</p>')
  assert.equal(load(slashed).textContent, 'a\\$b$', 'a typed backslash and dollars come back as typed')
  assert.equal(nodesOf(load(slashed), 'mathInline').length, 0)

  // Dollars in code and in other paragraphs do not pair across.
  assert.equal(typed('<p>$a</p><p>b$</p>'), '$a\n\nb$', 'no pairing across paragraphs')
  assert.equal(typed('<p>$a <code>b</code> c</p>'), '$a `b` c')
}

// ---- an edited equation keeps its form ----
{
  const doc = load('$$\n\\int_0^1 x^2 \\, dx\n$$')
  const [block] = nodesOf(doc, 'mathBlock')
  const edited = doc.type.create(null, [block.type.create({ ...block.attrs, latex: block.attrs.latex.replace('x^2', 'x^3') })])
  assert.equal(save(edited), '$$\n\\int_0^1 x^3 \\, dx\n$$', 'a block stays on its own lines')

  const emptied = doc.type.create(null, [block.type.create({ ...block.attrs, latex: '' }), schema.nodes.paragraph.create(null, schema.text('after'))])
  assert.equal(save(emptied), 'after', 'an emptied block is gone from the file')
}

// ---- the AI, comments and the clipboard see the source ----
{
  const doc = load('The slope $\\hat{\\beta}$ and \\$5.\n\n$$\nE = mc^2\n$$')
  assert.equal(doc.textBetween(0, doc.content.size, '\n'), 'The slope $\\hat{\\beta}$ and $5.\n$$\nE = mc^2\n$$', 'textBetween gives the source')
  const clipboard = getTextBetween(doc, { from: 0, to: doc.content.size }, { blockSeparator: '\n', textSerializers: getTextSerializersFromSchema(schema) })
  assert.ok(clipboard.includes('$\\hat{\\beta}$') && clipboard.includes('$$\nE = mc^2\n$$'), 'clipboard text carries the source')
  // The word count passes ' ' for leaves: an equation is not a word.
  assert.equal(doc.textBetween(0, doc.content.size, ' ', ' ').trim().split(/\s+/).length, 4)

  // A click or Enter opens an equation by selecting its node: that is the
  // cursor's place, not "selected text" for the AI. A drag or Shift-arrow
  // selection over the same equation is, and carries its source.
  const inlinePos = nodePositions(doc, 'mathInline')[0]
  const blockPos = nodePositions(doc, 'mathBlock')[0]
  assert.ok(isEquationNodeSelection(NodeSelection.create(doc, inlinePos)), 'an opened inline equation is not a text selection')
  assert.ok(isEquationNodeSelection(NodeSelection.create(doc, blockPos)), 'an opened block is not a text selection')
  const dragged = TextSelection.create(doc, inlinePos - 4, inlinePos + 1)
  assert.ok(!isEquationNodeSelection(dragged), 'a dragged selection is')
  assert.equal(doc.textBetween(dragged.from, dragged.to, ' '), 'ope $\\hat{\\beta}$', 'and carries the source with its delimiters')
  assert.ok(!isEquationNodeSelection(TextSelection.create(doc, 1, 4)), 'a selection of text alone is not an equation')
}

// ---- a document without math saves as it did ----
{
  const plain = 'Plain text with a ~tilde and a [link](https://example.com).\n\n**Bold** and *italic*.'
  assert.equal(save(load(plain)), plain)
}

console.log('mathRoundTrip: all assertions passed')
