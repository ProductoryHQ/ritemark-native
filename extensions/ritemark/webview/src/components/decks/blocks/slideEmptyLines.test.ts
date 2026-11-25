import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import type { DecorationSet } from '@tiptap/pm/view'
import { parse } from 'node-html-parser'
import { blockSlideHtml, isCoverSlide } from '../../../../../src/decks/blocks/slideRenderer'
import { BUILT_IN_THEME } from '../../../../../src/decks/deckTheme'
import { slidesOfText } from '../../../../../src/decks/deckLibraryFormat'
import { buildDeckPage, buildPrintPage } from '../../../../../src/decks/page/pageFile'
import { editorHTML, editorMarkdown, fidelitySchema, openDocument } from '../../../utils/markdownFidelity'
import { saveSlideMarkdown, SlideEmptyLines } from './slideEditorMarkdown'
import { loadSlide, saveSlide, slideSchema } from './slideEditorHarness'

const columns = ':::: columns\n\n::: column\nLeft\n:::\n\n::: column\nRight\n:::\n\n::::'
const { doc, paragraph, hardBreak } = slideSchema.nodes
const after = slideSchema.text('After')
const blank = paragraph.create()
const breakLine = paragraph.create(null, hardBreak.create())
const line = '\n\n<br>'
const saved = (before: string, count: number) => before + line.repeat(count) + '\n\nAfter'

for (const before of [columns, 'Before']) {
  const first = loadSlide(before).firstChild!
  const end = paragraph.create(null, after)
  for (const [middle, count] of [[blank, 1], [breakLine, 2], [paragraph.create(null, [hardBreak.create(), hardBreak.create()]), 3]] as const) {
    const typed = doc.create(null, [first, middle, end])
    const written = saveSlideMarkdown(typed, editorHTML(typed), loadSlide)
    assert.equal(written, saved(before, count))
    const reopened = loadSlide(written)
    assert.equal(reopened.childCount, 2 + count)
    for (let index = 1; index <= count; index++) assert.ok(reopened.child(index).type === paragraph && reopened.child(index).childCount === 0)
    assert.equal(saveSlide(reopened), written)
  }

  const leadingBreak = doc.create(null, [first, paragraph.create(null, [hardBreak.create(), after])])
  assert.equal(saveSlide(leadingBreak), saved(before, 1))
  assert.equal(saveSlide(doc.create(null, [first, blank, blank, end])), saved(before, 2))
  assert.equal(saveSlide(doc.create(null, [blank, breakLine, first, end, breakLine, blank])), before + '\n\nAfter')
}

const beforeWithBreak = paragraph.create(null, [slideSchema.text('Before'), hardBreak.create()])
assert.equal(saveSlide(doc.create(null, [beforeWithBreak, paragraph.create(null, after)])), saved('Before', 1))
assert.equal(saveSlide(doc.create(null, [beforeWithBreak, loadSlide(columns).firstChild!])), 'Before' + line + '\n\n' + columns)
assert.equal(saveSlide(doc.create(null, [paragraph.create(null, after), blank])), 'After')
assert.equal(saveSlide(doc.create(null, [paragraph.create(null, [hardBreak.create(), after, hardBreak.create()])])), 'After')
const markedAfter = after.mark([slideSchema.marks.bold.create()])
const markedBreak = hardBreak.create().mark(markedAfter.marks)
assert.equal(saveSlide(doc.create(null, [loadSlide(columns).firstChild!, paragraph.create(null, [markedBreak, markedAfter])])), columns + line + '\n\n**After**')

// Use the stage's decoration plugin with real ProseMirror positions.
const plugin = SlideEmptyLines.config.addProseMirrorPlugins!.call({} as never)[0]
const edgeDoc = doc.create(null, [
  paragraph.create(null, [hardBreak.create(), slideSchema.text('Before')]),
  paragraph.create(null, [after, hardBreak.create()]),
])
const state = EditorState.create({ doc: edgeDoc, selection: TextSelection.create(edgeDoc, 4) })
const decorations = (plugin.props.decorations!.call(plugin, state) as DecorationSet).find()
assert.deepEqual(decorations.map(({ from, to }) => [from, to]), [[1, 2], [15, 16]])

const authored = '<br>Start<br>\n\n> Quote<br>\n\nEnd'
const authoredDoc = loadSlide(authored)
const authoredState = EditorState.create({ doc: authoredDoc })
const authoredEdges = (plugin.props.decorations!.call(plugin, authoredState) as DecorationSet).find()
assert.equal(authoredDoc.firstChild?.firstChild?.attrs.mdBreak, 'html')
assert.deepEqual(authoredEdges.map(({ from }) => authoredDoc.resolve(from).parent.textContent), ['Start', 'Quote'])
assert.equal(saveSlide(authoredState.tr.insertText('!', authoredDoc.content.size - 1).doc), authored + '!')
assert.match(blockSlideHtml(authored), /<p><br>Start<br><\/p>/)

const nestedCases = [
  [columns, 'Right', '.blk-column .blk-empty-line'],
  ['::: box\nBox text\n:::', 'Box text', '.blk-box .blk-empty-line'],
  ['- Item text\n- Next', 'Item text', 'li .blk-empty-line'],
  ['::: steps\n1. Step text\n:::', 'Step text', '.blk-steps li .blk-empty-line'],
  ['::: {.panel-tabset}\n## One\nPane text\n## Two\nOther\n:::', 'Pane text', '.blk-tabpane .blk-empty-line'],
  ['> Quote text', 'Quote text', 'blockquote .blk-empty-line'],
  ['## Heading text', 'Heading text', 'h2 + .blk-empty-line'],
] as const
for (const [markdown, words, selector] of nestedCases) {
  const original = loadSlide(markdown + '\n\nAfter')
  let end = -1
  original.descendants((node, pos) => {
    if (node.isTextblock && node.textContent === words) end = pos + node.nodeSize - 1
  })
  assert.ok(end > 0, markdown)
  const edited = EditorState.create({ doc: original }).tr.insert(end, hardBreak.create()).doc
  const written = saveSlideMarkdown(edited, editorHTML(edited), loadSlide)
  assert.equal(parse(blockSlideHtml(written)).querySelectorAll(selector).length, 1, written)
  assert.equal(saveSlide(loadSlide(written)), written)
}

const quoteWithLine = '> Quoted words\n> — Speaker\n>\n> <br>'
assert.equal(parse(blockSlideHtml(quoteWithLine)).querySelector('blockquote .blk-by + .blk-empty-line')?.previousElementSibling?.text, '— Speaker')
const spacerOnlyBox = '::: box\n<br>\n:::'
assert.equal(saveSlide(loadSlide(spacerOnlyBox)), spacerOnlyBox)

for (const [suffix, element] of [['- one\n- two', 'ul'], ['# Heading', 'h1'], ['**Bold** words', 'p']]) {
  const markdown = 'Intro\n\n<br>\n' + suffix
  const reopened = loadSlide(markdown)
  assert.equal(reopened.childCount, 3)
  assert.ok(reopened.child(1).type === paragraph && reopened.child(1).childCount === 0)
  assert.equal(saveSlide(reopened), 'Intro\n\n<br>\n\n' + suffix)
  assert.equal(parse(blockSlideHtml(markdown)).querySelector(`.blk-empty-line + ${element}`)?.text.replace(/\s+/g, ' ').trim(),
    suffix.replace(/[-#*]/g, '').replace(/\s+/g, ' ').trim())
}

for (const markdown of ['[ ]{.label}\n\n<br>\n\nText', 'Text\n\n<br>\n\n[ ]{.label}']) {
  assert.equal(blockSlideHtml(markdown), blockSlideHtml('Text'))
  assert.ok(!saveSlide(loadSlide(markdown)).includes('<br>'))
}

const inline = loadSlide('Before<br>\n\nAfter')
const editedInline = EditorState.create({ doc: inline }).tr.insertText('!', inline.content.size - 1).doc
assert.equal(saveSlide(editedInline), 'Before<br>\n\nAfter!')
assert.equal(parse(blockSlideHtml(saveSlide(editedInline))).querySelectorAll('.blk-empty-line').length, 0)

const css = readFileSync(new URL('../slide/slide.css', import.meta.url), 'utf8')
assert.match(css, /\.blk-flow \{[^}]*font: 400 calc\(24px \* var\(--fit, 1\)\)\/1\.42/)
assert.match(css, /\.blk-flow p\.blk-empty-line \{ margin: 0; \}/)
assert.match(css, /\.blk-columns \{[^}]*margin: 0 0 calc\(12px \* var\(--fit, 1\)\)/)
assert.match(css, /\.deck-sl\.is-blocks p \{ margin: 0 0 calc\(12px \* var\(--fit, 1\)\); \}/)
for (const count of [1, 2]) {
  const written = saved(columns, count)
  const withEdges = '<br>\n\n<br>\n\n' + written + line + line
  const flow = parse(blockSlideHtml(withEdges))
  assert.equal(flow.querySelectorAll('p.blk-empty-line > br').length, count, 'each marker adds one line box')
  assert.equal(blockSlideHtml(withEdges), blockSlideHtml(written))
  assert.equal(saveSlide(loadSlide(withEdges)), written)
}
assert.equal(isCoverSlide('<br>\n\n# A title\n\n<br>'), isCoverSlide('# A title'))
assert.equal(parse(blockSlideHtml('Before\n\n```html\n<br>\n```\n\nAfter')).querySelectorAll('.blk-empty-line').length, 0)

const text = '---\ndeck: 2\n---\n\n```slide\n---\nid: s1\n---\n' + saved(columns, 2) + '\n```\n\nHandout\n\n<br>\n\nText after\n'
const edited = text.replace('After', 'AI edit')
assert.equal(slidesOfText(edited)[0].data.markdown, saved(columns, 2).replace('After', 'AI edit'))
const input = { deckPath: '/tmp/empty-lines.rtms', text: edited, theme: BUILT_IN_THEME }
const assets = { slideCss: css, fonts: [] }
const published = await buildDeckPage(input, assets)
const printed = await buildPrintPage({ ...input, print: 'slides' }, assets)
const combined = await buildPrintPage(input, assets)
for (const { html } of [published, printed, combined]) {
  const page = parse(html)
  const flow = page.querySelector('.blk-flow')!
  assert.equal(flow.innerHTML, blockSlideHtml(saved(columns, 2).replace('After', 'AI edit')))
  assert.equal(page.querySelectorAll('.blk-empty-line').length, 2, 'the handout does not get a slide spacer')
  assert.ok(html.includes('p.blk-empty-line { margin: 0; }'))
}

const textSchema = fidelitySchema()
const textP = textSchema.nodes.paragraph
const textDoc = textSchema.nodes.doc.create(null, [
  textP.create(null, [textSchema.text('Before'), textSchema.nodes.hardBreak.create()]),
  textP.create(),
  textP.create(null, textSchema.text('After')),
])
assert.equal(editorMarkdown(textDoc), 'Before\n\nAfter', 'the Text writer still drops a blank paragraph and a trailing break')
assert.equal(openDocument('Before\n\n\nAfter').doc.childCount, 2, 'ordinary Markdown blank lines remain separators')

for (const markdown of ['One paragraph.\n\nAnother paragraph.', 'Before\nAfter', 'Before\\\nAfter',
  'Before  \nAfter', '- One\n- Two\n  - Nested', '3. First\n4. Second']) {
  assert.equal(editorMarkdown(openDocument(markdown).doc), markdown)
}
const adjacent = openDocument('Before\n<br>\nAfter').doc
const adjacentWritten = editorMarkdown(adjacent)
assert.equal(adjacentWritten, 'Before\n\\\n\\\nAfter')
assert.equal(openDocument(adjacentWritten).doc.toString(), adjacent.toString())

assert.equal(editorMarkdown(openDocument('Before\n<br>After').doc), 'Before\n\\\nAfter')
const markedNeighbor = editorMarkdown(openDocument('**A<br>**\nB').doc)
assert.equal(markedNeighbor, '**A**\\\n\\\nB')

console.log('slideEmptyLines: passed')
