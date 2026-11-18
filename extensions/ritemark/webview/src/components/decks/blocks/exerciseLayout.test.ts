/**
 * Sprint 163 PR 5: an exercise's layout (the decks README, "An exercise's layout"). One ordinary Columns block with no
 * title above it: the left column holds the title as its heading and then the Steps, the right one the Tabs block and
 * the material's Button right under it. Its title lives in the left column, and still names the slide in the strip,
 * the page's Contents, the Agenda and the presenter view; the pill draws above the title; the file goes through the
 * deck and the slide editor byte for byte. Also the Button's narrow card (it stacks under 420 slide units). Run with
 * `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { blockTitleOf, parseDeck, slideDataOf } from '../../../../../src/decks/deckFormat'
import { agendaOf, blockSlideHtml, blockStepsTagOf } from '../../../../../src/decks/blocks/slideRenderer'
import { publicDeck } from '../../../../../src/decks/page/publicDeck'
import { wallDataOf } from '../../../../../src/decks/present/presentProtocol'
import { BUILT_IN_THEME } from '../../../../../src/decks/deckTheme'
import { loadSlide as load, saveSlide as save } from './slideEditorHarness'
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser } from '@tiptap/pm/model'
import { canonicalMarkdownProjection } from '../../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../../src/editorSync/frontMatter'
import { createEditorSchemaExtensions, markdownToEditorHTML } from '../../../utils/editorMarkdown'
import { editorMarkdown } from '../../../utils/markdownFidelity'
import { DeckSlide } from '../handout/deckSchema'
import { DeckDrawnHeadings } from '../handout/drawnHeadings'

const EXERCISE = `:::: columns
::: {.column width="35%"}
# A long report, in steps

::: {.steps tag="Exercise · 1 / 2"}
1. Open a new chat and add one long report.
2. Go through the four prompts in order.
:::
:::

::: {.column width="65%"}
::: {.panel-tabset}
## 1 · Plan

\`\`\`
Give me a plan for [the report's three questions].
\`\`\`

## 2 · Collect

\`\`\`
For each question, collect the figures and their pages.
\`\`\`
:::

**No report of your own?** Use the sample. [Open the sample](https://example.sharepoint.com/sites/training/report.pdf){.button}
:::
::::`

const DECK = `---
deck: 2
handout: text
---

\`\`\`slide
---
id: s1
section: true
---
:::: columns
::: column
# Working with long reports
:::

::: column
Three hours, two exercises.
:::
::::
\`\`\`

## Working with long reports

\`\`\`\`slide
---
id: s2
---
${EXERCISE}
\`\`\`\`

## A long report, in steps

Bring a report of your own.
`

// The title is the left column's heading, never a tab's name.
assert.equal(blockTitleOf(EXERCISE), 'A long report, in steps')

// The deck reads it as the slide's title (the strip's label and the go-to box), and gives the file back as written.
const parsed = parseDeck(DECK)
assert.equal(parsed.slides.length, 2)
const data = parsed.slides.map(block => slideDataOf(block.kind, block.body))
assert.equal(data[1].title, 'A long report, in steps', 'the strip names the slide by its left column\'s heading')
assert.equal(data[1].markdown, EXERCISE)

// The page's Contents: the shown slide's title, and the slide is an exercise (its Steps are in the column).
const page = publicDeck(DECK, { folderName: 'Training', deckName: 'Reports', theme: BUILT_IN_THEME })
assert.equal(page.slides[1].data.title, 'A long report, in steps', 'Contents names it')
assert.equal(blockStepsTagOf(page.slides[1].data.markdown ?? ''), 'Exercise · 1 / 2', 'Contents marks it an exercise')

// The Agenda: a section slide whose title is a column's heading is listed by it.
assert.deepEqual(agendaOf(parsed.slides.map((block, index) => ({ kind: block.kind, data: data[index] }))).map(entry => entry.title), ['Working with long reports'])

// The presenter view and the wall: the slide's title goes with it.
assert.equal(wallDataOf(data[1]).title, 'A long report, in steps')

// The slide draws no title above the columns, and the pill stands in the Steps right after the column's heading, which
// slide.css lifts above the heading.
{
  const html = blockSlideHtml(EXERCISE)
  assert.ok(html.trimStart().startsWith('<div class="blk-columns"'), 'nothing above the columns')
  assert.match(html, /<div class="blk-column"><h1[^>]*>A long report, in steps<\/h1>\n?<div class="blk-steps"><span class="blk-pill">Exercise · 1 \/ 2<\/span>/)
  const css = readFileSync(new URL('../slide/slide.css', import.meta.url), 'utf8')
  assert.ok(css.includes('> .blk-column:has(> :is(h1, h3):first-child + .blk-steps > .blk-pill:not([hidden])) { position: relative;'), 'the column makes room for the pill')
  assert.ok(css.includes('> .blk-column > :is(h1, h3):first-child + .blk-steps > .blk-pill:not([hidden]) { position: absolute;'), 'the pill sits at the column\'s top')
  assert.ok(css.includes('.blk-column > h1:first-child:has(+ .blk-steps) { font-size: 1.58em; }'), 'the title at the prototype\'s 38 units')
  assert.ok(css.includes('.blk-column > h1:first-child + .blk-steps { font-size: .75em; }'), 'the steps at its 18 units')
  // A narrow Button card stacks: its own container, the words at the full width under 420 units (390 + 30 padding).
  assert.ok(css.includes('container: blk-button / inline-size'))
  assert.ok(css.includes('@container blk-button (width < 390px) { .deck-sl.is-blocks .blk-button > .blk-button-words { flex-basis: 100%; } }'))
  assert.ok(css.includes('.deck-sl.is-blocks .blk-button { display: flex; flex-wrap: wrap; align-items: center; gap: calc(10px * var(--fit, 1)) calc(16px * var(--fit, 1));'), 'wraps, 10 units under the words')
  assert.ok(css.includes('.blk-box > .blk-button, .deck-sl.is-blocks .blk-box > .blk-inner > .blk-button { align-self: stretch; }'), 'a card in a box keeps its width')
  assert.ok(css.includes('.blk-columns:not([data-valign="middle"], [data-valign="bottom"]) > .blk-column'), 'Middle and Bottom keep the pill in its flow')
}

// The slide editor gives it back byte for byte, and again on a second open.
{
  const out = save(load(EXERCISE))
  assert.equal(out, EXERCISE, 'byte for byte through the slide editor')
  assert.equal(save(load(out)), out, 'stable on a second open')
  const kinds: string[] = []
  load(EXERCISE).descendants(node => { if (node.type.name === 'slideDiv' || node.type.name === 'tabsBlock') kinds.push(node.type.name === 'tabsBlock' ? 'tabs' : String(node.attrs.class)) })
  assert.deepEqual(kinds, ['columns', 'column', 'steps', 'column', 'tabs'])
}

// The whole deck, opened in the deck view's handout and saved untouched, keeps every byte.
{
  const schema = getSchema(createEditorSchemaExtensions({ commentCallouts: true, deck: [DeckSlide, DeckDrawnHeadings] }))
  const body = createDocument(`<body>${markdownToEditorHTML(canonicalMarkdownProjection(splitFrontMatter(DECK).content))}</body>`).body as unknown as HTMLElement
  const split = splitFrontMatter(DECK)
  const doc = PMDOMParser.fromSchema(schema).parse(body, { preserveWhitespace: 'full' })
  assert.equal(joinFrontMatter(JSON.parse(JSON.stringify(split.properties)), editorMarkdown(doc), DECK), DECK, 'the deck, byte for byte')
}

console.log('exerciseLayout: the left column\'s title names the slide everywhere; the file and the editor keep every byte')
