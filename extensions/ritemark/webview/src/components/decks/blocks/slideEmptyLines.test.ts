import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { parse } from 'node-html-parser'
import { blockSlideHtml, isCoverSlide } from '../../../../../src/decks/blocks/slideRenderer'
import { BUILT_IN_THEME } from '../../../../../src/decks/deckTheme'
import { slidesOfText } from '../../../../../src/decks/deckLibraryFormat'
import { buildDeckPage, buildPrintPage } from '../../../../../src/decks/page/pageFile'
import { editorHTML, editorMarkdown, fidelitySchema, openDocument } from '../../../utils/markdownFidelity'
import { saveSlideMarkdown } from './slideEditorMarkdown'
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
  for (const [middle, count] of [[blank, 1], [breakLine, 1], [paragraph.create(null, [hardBreak.create(), hardBreak.create()]), 2]] as const) {
    const typed = doc.create(null, [first, middle, end])
    const written = saveSlideMarkdown(typed, editorHTML(typed), loadSlide)
    assert.equal(written, saved(before, count))
    const reopened = loadSlide(written)
    assert.equal(reopened.childCount, 2 + count)
    for (let index = 1; index <= count; index++) assert.ok(reopened.child(index).eq(blank))
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

const css = readFileSync(new URL('../slide/slide.css', import.meta.url), 'utf8')
assert.match(css, /\.blk-flow \{[^}]*font: 400 calc\(24px \* var\(--fit, 1\)\)\/1\.42/)
assert.match(css, /\.blk-flow > p\.blk-empty-line \{ min-height: 1lh; margin: 0; \}/)
assert.match(css, /\.blk-columns \{[^}]*margin: 0 0 calc\(12px \* var\(--fit, 1\)\)/)
assert.match(css, /\.deck-sl\.is-blocks p \{ margin: 0 0 calc\(12px \* var\(--fit, 1\)\); \}/)
for (const count of [1, 2]) {
  const written = saved(columns, count)
  const withEdges = '<br>\n\n<br>\n\n' + written + line + line
  const flow = parse(blockSlideHtml(withEdges))
  assert.equal(flow.querySelectorAll('p.blk-empty-line').length, count, 'each marker adds one line box')
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
  assert.ok(html.includes('p.blk-empty-line { min-height: 1lh; margin: 0; }'))
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

console.log('slideEmptyLines: passed')
