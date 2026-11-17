/**
 * The block's bar (experience 46, 17 November): Turn into, Boxes' Width, Style and alignment, Columns' count, split and
 * frame 23's tools, Add and Delete, the ⋮ drag, Tab across items, and the handles at the smallest stage. Driven the way
 * the stage drives them: the slide editor's document on its own pipeline (`slideEditorHarness`), the slide's sync, and
 * the deck as the deck view's editor holds it, with its history, saved through the editor's own Markdown pipeline.
 * Run with `npx tsx webview/src/components/decks/blocks/blockBar.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState, Plugin, TextSelection, type Transaction } from '@tiptap/pm/state'
import { closeHistory, history, undo } from '@tiptap/pm/history'
import { canonicalMarkdownProjection } from '../../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../../src/editorSync/frontMatter'
import { slideDataOf, withBlockMarkdown } from '../../../../../src/decks/deckFormat'
import { BOX_AUTO_MIN, BOX_GAP, boxesLookOf, columnWidthOf, columnsAlignOf, parseFenceAttributes } from '../../../../../src/decks/blocks/fencedDiv'
import { blockSlideHtml } from '../../../../../src/decks/blocks/slideRenderer'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../../utils/editorMarkdown'
import { editorMarkdown, installTestDocument } from '../../../utils/markdownFidelity'
import { DeckSlide } from '../handout/deckSchema'
import { DeckDrawnHeadings, drawnHeadingsFollow } from '../handout/drawnHeadings'
import { deckGuardPlugin } from '../handout/deckGuard'
import { deckLinesPlugin } from '../handout/deckLines'
import { convertDeckInto, deckConvertPlugin } from '../handout/deckConvert'
import { derivedHeadings, slidesOf } from '../deckDocument'
import { loadSlide, loadSlideWithComments, saveSlide } from './slideEditorHarness'
import { saveSlideMarkdown } from './slideEditorMarkdown'
import { editorHTML } from '../../../utils/markdownFidelity'
import { SlideSync } from './slideSync'
import { SLIDE_COMMAND, setBlockValue } from './slideCommands'
import {
  BAR_KINDS, HANDLE_SIZE, addItem, chosenBlockAt, columnCount, columnIndexAt, columnShares, deleteBlock, dropGaps, gripSpot, moveBlock, nearestGap, plusSpot, removeColumn,
  setColumnCount, setColumnSplit, slideDelta, snapSplit, splitPlace, tabAcross, turnInto, type BarKind,
} from './blockBar'

installTestDocument()
ensureCommentMarkedPipeline()
const deckSchema = getSchema(createEditorSchemaExtensions({ commentCallouts: true, deck: [DeckSlide, DeckDrawnHeadings] }))

function elementFromString(html: string): HTMLElement {
  const body = createDocument(`<body>${html}</body>`).body as unknown as HTMLElement
  const strip = (node: HTMLElement) => {
    for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
      const child = node.childNodes[index]
      if (child.nodeType === 3 && child.nodeValue && /^(\n\s\s|\n)$/.test(child.nodeValue)) node.removeChild(child)
      else if (child.nodeType === 1) strip(child as HTMLElement)
    }
  }
  strip(body)
  return body
}

const drawnPlugin = () => new Plugin({ appendTransaction: (transactions, _old, next) => drawnHeadingsFollow(transactions, next) })

function openDeck(text: string) {
  const split = splitFrontMatter(text)
  const doc = PMDOMParser.fromSchema(deckSchema).parse(elementFromString(markdownToEditorHTML(canonicalMarkdownProjection(split.content))), { preserveWhitespace: 'full' })
  const properties = JSON.parse(JSON.stringify(split.properties))
  let state = EditorState.create({ doc, plugins: [history(), deckGuardPlugin(), deckLinesPlugin(), drawnPlugin(), deckConvertPlugin()] })
  const drawn = derivedHeadings(state)
  if (drawn) state = state.apply(drawn)
  return { state, save: (next: PMNode) => joinFrontMatter(properties, editorMarkdown(next), text) }
}

const slideSave = (doc: PMNode) => saveSlideMarkdown(doc, editorHTML(doc), loadSlide)

/** The stage on slide `index`: SlideEditor's write (an undo step of its own for a bar command). */
function stageOn(deck: ReturnType<typeof openDeck>, index: number) {
  let outer = deck.state
  const entry = slidesOf(outer.doc)[index]
  const markdown = slideDataOf(entry.kind, entry.node.attrs.body).markdown ?? ''
  let inner = EditorState.create({ doc: loadSlide(markdown) })
  const sync = new SlideSync(loadSlide, slideSave, markdown, inner.doc)
  return {
    get inner() { return inner },
    apply(tr: Transaction | null) {
      assert.ok(tr, 'the bar made a change')
      assert.equal(tr.getMeta(SLIDE_COMMAND), true, 'a bar change is an undo step of its own')
      inner = inner.apply(tr)
      sync.track(tr)
      const next = sync.toWrite(inner.doc)
      if (next === null) { sync.settled(inner.doc); return }
      const step = outer.tr
      closeHistory(step)
      convertDeckInto(step)
      const pos = step.mapping.map(slidesOf(outer.doc)[index].pos)
      const node = step.doc.nodeAt(pos)!
      step.setNodeMarkup(pos, undefined, { ...node.attrs, body: withBlockMarkdown(node.attrs.body, next) })
      sync.wrote(next, inner.doc)
      outer = outer.apply(step)
    },
    type(text: string) {
      const tr = inner.tr.insertText(text)
      inner = inner.apply(tr)
      sync.track(tr)
      const next = sync.toWrite(inner.doc)!
      const step = outer.tr
      const pos = slidesOf(outer.doc)[index].pos
      const node = step.doc.nodeAt(pos)!
      step.setNodeMarkup(pos, undefined, { ...node.attrs, body: withBlockMarkdown(node.attrs.body, next) })
      sync.wrote(next, inner.doc)
      outer = outer.apply(step)
    },
    caretIn(text: string) { inner = inner.apply(inner.tr.setSelection(caretAt(inner.doc, text))) },
    undo() { undo(outer, tr => { outer = outer.apply(tr) }) },
    save: () => deck.save(outer.doc),
  }
}

/** A caret just after `text`'s first letter in the document. */
function caretAt(doc: PMNode, text: string): TextSelection {
  let at = -1
  doc.descendants((node, pos) => {
    if (at >= 0 || !node.isText) return
    const found = node.text!.indexOf(text)
    if (found >= 0) at = pos + found + 1
  })
  assert.ok(at >= 0, `found ${text}`)
  return TextSelection.create(doc, at)
}

/** The slide's state with the caret in `text`. */
function stateWith(markdown: string, text: string): EditorState {
  const doc = loadSlide(markdown)
  return EditorState.create({ doc, selection: caretAt(doc, text) })
}

const blockPos = (state: EditorState) => chosenBlockAt(state)!.pos
const after = (tr: Transaction | null) => { assert.ok(tr); return saveSlide(tr.doc) }
/** Saved, opened and saved again: the same bytes. */
const stable = (markdown: string, label: string) => assert.equal(saveSlide(loadSlide(markdown)), markdown, `${label}: byte-stable on the next open`)

const WORDS = ['News and notices', 'What happened in between?', 'Desktop agents', 'Chat, add-ons or Work.', 'Prompting', 'Prompt, context, skill.', 'Summary']

/** Today's agenda as a Boxes block, as the conversion writes one (frame 29). */
const AGENDA = [
  '# Today',
  '',
  ':::: boxes',
  '::: box',
  '### News and notices',
  '',
  'What happened in between?',
  ':::',
  '',
  '::: box',
  '### Desktop agents',
  '',
  'Chat, add-ons or Work.',
  ':::',
  '',
  '::: box',
  '### Prompting',
  '',
  'Prompt, context, skill.',
  ':::',
  '',
  '::: box',
  '### Summary',
  ':::',
  '::::',
].join('\n')
stable(AGENDA, 'the agenda')

// ---- Turn into: every kind into every other, every heading and line kept; one Undo; the round trip is the same bytes.
{
  const forms = new Map<BarKind, string>([['boxes', AGENDA]])
  for (const kind of BAR_KINDS) {
    if (kind === 'boxes') continue
    const markdown = after(turnInto(stateWith(AGENDA, 'Desktop'), blockPos(stateWith(AGENDA, 'Desktop')), kind))
    for (const word of WORDS) assert.ok(markdown.includes(word), `boxes → ${kind} keeps "${word}"`)
    stable(markdown, `boxes → ${kind}`)
    forms.set(kind, markdown)
  }
  assert.ok(forms.get('steps')!.includes('::: steps\n1. News and notices\n\n   What happened in between?'), forms.get('steps'))
  assert.ok(forms.get('columns')!.startsWith('# Today\n\n:::: columns\n::: column\n### News and notices'), forms.get('columns'))
  assert.ok(forms.get('list')!.includes('- News and notices'), forms.get('list'))
  assert.ok(forms.get('numbered')!.includes('1. News and notices'), forms.get('numbered'))
  for (const from of BAR_KINDS) {
    for (const to of BAR_KINDS) {
      if (from === to) continue
      const source = forms.get(from)!
      const state = stateWith(source, 'Desktop')
      const turned = turnInto(state, blockPos(state), to)
      const markdown = after(turned)
      for (const word of WORDS) assert.ok(markdown.includes(word), `${from} → ${to} keeps "${word}"`)
      // The caret stays in its item.
      assert.equal(turned!.selection.$head.parent.textContent.startsWith('Desktop agents'), true, `${from} → ${to}: the caret in its item`)
      // And back again: the same bytes as the block it was.
      const again = stateWith(markdown, 'Desktop')
      assert.equal(after(turnInto(again, blockPos(again), from)), source, `${from} → ${to} → ${from}: the same bytes`)
    }
  }
  // Its own kind is no change.
  assert.equal(turnInto(stateWith(AGENDA, 'Desktop'), blockPos(stateWith(AGENDA, 'Desktop')), 'boxes'), null)
}

// ---- A columns block with lists and a second heading turns into Steps and back with every line.
{
  const columns = ['# Which one?', '', ':::: columns', '::: column', '### Copilot', '', '#### When the work is documents', '', 'Keep the budget small.', ':::', '', '::: column', '### Cursor', '', '- Setting up the intent', '- Preparing a sprint', ':::', '::::'].join('\n')
  stable(columns, 'columns with lists')
  const state = stateWith(columns, 'Cursor')
  const steps = after(turnInto(state, blockPos(state), 'steps'))
  for (const word of ['Copilot', 'When the work is documents', 'Keep the budget small.', 'Cursor', 'Setting up the intent', 'Preparing a sprint']) assert.ok(steps.includes(word), word)
  const back = stateWith(steps, 'Cursor')
  assert.equal(after(turnInto(back, blockPos(back), 'columns')), columns, 'columns → steps → columns: the same bytes')
}

// ---- Turn into is one Undo, and the file is as it was.
const DECK = (body: string) => ['---', 'deck: 2', 'handout: text', '---', '', '```slide', '---', 'id: a1', '---', body, '```', '', '## Today', '', 'The plan.', ''].join('\n')
{
  const text = DECK(AGENDA)
  const deck = openDeck(text)
  assert.equal(deck.save(deck.state.doc), text, 'an untouched deck is the same bytes')
  for (const kind of BAR_KINDS.filter(kind => kind !== 'boxes')) {
    const stage = stageOn(deck, 0)
    stage.caretIn('Desktop')
    stage.apply(turnInto(stage.inner, blockPos(stage.inner), kind))
    assert.notEqual(stage.save(), text)
    stage.undo()
    assert.equal(stage.save(), text, `turn into ${kind}: one Undo gives the file back`)
  }
}

// ---- Boxes' Width, Style and alignment: one value each on the block's own line; none is the default; drawn alike.
{
  let state = stateWith(AGENDA, 'Desktop')
  const pos = blockPos(state)
  for (const [key, value, line] of [
    ['width', 's', ':::: {.boxes width="s"}'], ['width', 'm', ':::: {.boxes width="m"}'], ['width', 'l', ':::: {.boxes width="l"}'],
    ['fill', 'outline', ':::: {.boxes fill="outline"}'], ['fill', 'filled', ':::: {.boxes fill="filled"}'], ['align', 'center', ':::: {.boxes align="center"}'],
  ] as const) {
    const markdown = after(setBlockValue(state, pos, key, value))
    assert.equal(markdown, AGENDA.replace(':::: boxes', line), `${key}=${value} is written on the block's line only`)
    stable(markdown, `${key}=${value}`)
    const html = blockSlideHtml(markdown)
    assert.ok(html.includes(`data-${key}="${value}"`), `${key}=${value} drawn: ${html.slice(0, 200)}`)
    assert.ok(html.includes('data-count="4"'), 'the box count drawn')
    assert.deepEqual(boxesLookOf(parseFenceAttributes(line.slice(5))!)[key], value)
  }
  // Two values at once, then each back to the default: the line is as it was.
  state = state.apply(setBlockValue(state, pos, 'width', 's')!)
  state = state.apply(setBlockValue(state, pos, 'fill', 'outline')!)
  assert.ok(saveSlide(state.doc).includes(':::: {.boxes width="s" fill="outline"}'))
  state = state.apply(setBlockValue(state, pos, 'width', null)!)
  state = state.apply(setBlockValue(state, pos, 'fill', null)!)
  assert.equal(saveSlide(state.doc), AGENDA, 'Auto and the theme\'s style: the line as it was')
  // What the renderer can't read is the default, never drawn as written.
  assert.ok(!blockSlideHtml(':::: {.boxes width="x\\" onload" fill=red}\n::: box\nA\n:::\n::::').includes('data-width'), 'an unknown width is Auto')
}

// ---- Auto's rows: one row while every box can be 180 px, else two even rows (5 → 3 + 2); S, M, L wrap. The CSS holds
// the rule: each count's threshold and its row's width, checked against the rule written out here.
{
  const css = readFileSync(new URL('../slide/slide.css', import.meta.url), 'utf8')
  const oneRowUntil = (count: number) => count * BOX_AUTO_MIN + (count - 1) * BOX_GAP
  const perRow = (count: number) => Math.ceil(count / 2)
  for (let count = 2; count <= 12; count++) {
    const pattern = new RegExp(`@container blk-boxes \\(width < (\\d+)px\\) \\{[^@]*?\\[data-count="${count}"\\][^{]*\\{ flex-basis: calc\\(([^;]*)\\); \\}`)
    const rule = pattern.exec(css)
    assert.ok(rule, `count ${count} has its Auto rule`)
    assert.ok(Number(rule[1]) <= oneRowUntil(count), `count ${count}: two rows only below ${oneRowUntil(count)} px (rule at ${rule[1]})`)
    assert.equal(Number(rule[1]), oneRowUntil(count), `count ${count}: the threshold is ${oneRowUntil(count)} px`)
    const row = perRow(count)
    const expected = row === 1 ? '100% - .5px' : `(100% - ${(row - 1) * BOX_GAP}px) / ${row} - .5px`
    assert.equal(rule[2], expected, `count ${count}: ${row} boxes in the first row`)
  }
  // The slide's flow is 832 px wide: four boxes stay in one row (196 px each), five go 3 and 2.
  assert.ok(832 >= oneRowUntil(4) && 832 < oneRowUntil(5) && perRow(5) === 3)
  assert.ok(/\.blk-boxes\[data-width="s"\] \{ --blk-w: 180px; \}/.test(css) && /\[data-width="m"\] \{ --blk-w: 260px; \}/.test(css) && /\[data-width="l"\] \{ --blk-w: 400px; \}/.test(css))
  assert.ok(/\.blk-boxes\[data-width\] > \.blk-box \{ flex: 0 0 min\(var\(--blk-w\), 100%\); \}/.test(css), 'S, M and L keep their width, wrapping')
  assert.ok(/\.blk-boxes \{ display: flex; flex-wrap: wrap;/.test(css), 'boxes wrap')
}

// ---- Columns: the count without losing words; 3 → 2 asks nothing and the third column's words go to the last kept.
const COLUMNS = ['# Pick one', '', ':::: columns', '::: column', '### Copilot', '', 'Documents and mail', ':::', '', '::: column', '### Cursor', '', 'Building', ':::', '', '::: column', '### Codex', '', 'In the cloud', ':::', '::::'].join('\n')
stable(COLUMNS, 'three columns')
{
  let state = stateWith(COLUMNS, 'Cursor')
  const pos = blockPos(state)
  const two = setColumnCount(state, pos, 2)!
  const markdown = after(two)
  assert.equal(columnCount(two.doc.nodeAt(pos)!), 2)
  for (const word of ['Copilot', 'Documents and mail', 'Cursor', 'Building', 'Codex', 'In the cloud']) assert.ok(markdown.includes(word), `3 → 2 keeps ${word}`)
  assert.ok(markdown.includes('### Cursor\n\nBuilding\n\n### Codex\n\nIn the cloud\n:::\n::::'), `the third column's words are in the last: ${markdown}`)
  stable(markdown, '3 → 2')
  // 2 → 4: two empty columns, nothing written in them.
  state = state.apply(two)
  const four = setColumnCount(state, pos, 4)!
  assert.equal(columnCount(four.doc.nodeAt(pos)!), 4)
  assert.ok(after(four).endsWith(':::\n\n::: column\n:::\n\n::: column\n:::\n::::'), after(four))
  assert.equal(setColumnCount(state, pos, 5), null, 'four at most')
  assert.equal(setColumnCount(state, pos, 2), null, 'the count it has is no change')
}

// ---- The split: the line drags and snaps to ⅓, ½ and ⅔ of its two columns; written as each column's width.
{
  assert.deepEqual([0.05, 0.3, 0.4, 0.45, 0.55, 0.6, 0.7, 0.98].map(snapSplit), [1 / 3, 1 / 3, 1 / 3, 1 / 2, 1 / 2, 2 / 3, 2 / 3, 2 / 3])
  const twoColumns = ['# Two', '', ':::: columns', '::: column', 'A', ':::', '', '::: column', 'B', ':::', '::::'].join('\n')
  stable(twoColumns, 'two columns')
  let state = stateWith(twoColumns, 'A')
  const pos = blockPos(state)
  const third = setColumnSplit(state, pos, 0, 0.3)!
  const markdown = after(third)
  assert.ok(markdown.includes('::: {.column width="33%"}\nA') && markdown.includes('::: {.column width="67%"}\nB'), markdown)
  stable(markdown, 'a split')
  assert.ok(blockSlideHtml(markdown).includes('style="grid-template-columns: minmax(0, 33fr) minmax(0, 67fr); grid-auto-flow: row"'), blockSlideHtml(markdown))
  state = state.apply(third)
  assert.deepEqual(columnShares(state.doc.nodeAt(pos)!), [33, 67])
  // Back to a half: no width is written, the line as it was.
  assert.equal(after(setColumnSplit(state, pos, 0, 0.52)), twoColumns, 'an even split writes no width')
  // Pandoc's other forms read: a fraction, and nothing for words.
  assert.equal(columnWidthOf(parseFenceAttributes('{.column width=0.4}')!), 40)
  assert.equal(columnWidthOf(parseFenceAttributes('{.column width="wide"}')!), null)
  assert.equal(columnsAlignOf(parseFenceAttributes('{.columns valign="middle"}')!), 'middle')
  // The vertical alignment: on the block's line, drawn.
  const middle = after(setBlockValue(state, pos, 'valign', 'middle'))
  assert.ok(middle.includes('{.columns valign="middle"}') && blockSlideHtml(middle).includes('data-valign="middle"'))
}

// ---- Frame 23's tools: Add a column, Remove a column (the caret's), Delete block; each one Undo.
{
  const text = DECK(COLUMNS)
  const deck = openDeck(text)
  const run = (make: (state: EditorState, pos: number) => Transaction | null, check: (saved: string) => void, label: string) => {
    const stage = stageOn(deck, 0)
    stage.caretIn('Cursor')
    stage.apply(make(stage.inner, blockPos(stage.inner)))
    check(stage.save())
    stage.undo()
    assert.equal(stage.save(), text, `${label}: one Undo`)
  }
  run((state, pos) => addItem(state, pos), saved => assert.equal((saved.match(/^::: column$/gm) ?? []).length, 4), 'Add a column')
  run((state, pos) => removeColumn(state, pos, columnIndexAt(state, pos)!), saved => { assert.ok(!saved.includes('Cursor') && saved.includes('Codex')) }, 'Remove a column')
  run((state, pos) => deleteBlock(state, pos), saved => assert.ok(!saved.includes(':::') && saved.includes('# Pick one')), 'Delete block')
  const two = stateWith(['# Two', '', ':::: columns', '::: column', 'A', ':::', '', '::: column', 'B', ':::', '::::'].join('\n'), 'A')
  assert.equal(removeColumn(two, blockPos(two), 0), null, 'two columns stay two (Delete block is there)')
  assert.equal(columnIndexAt(stateWith(COLUMNS, 'Codex'), blockPos(stateWith(COLUMNS, 'Codex'))), 2)
}

// ---- Add and the +: one more item at the end, the caret in it, for every kind; four columns at most.
{
  for (const [kind, markdown] of [['boxes', AGENDA], ['steps', '# S\n\n::: steps\n1. One\n2. Two\n:::'], ['list', '# L\n\n- One\n- Two'], ['numbered', '# N\n\n1. One\n2. Two']] as const) {
    const state = stateWith(markdown, kind === 'boxes' ? 'News' : 'One')
    const tr = addItem(state, blockPos(state))!
    const block = chosenBlockAt(state.apply(tr))!
    assert.equal(block.kind, kind)
    assert.equal(tr.selection.$head.parent.content.size, 0, `${kind}: the caret in the new, empty item`)
  }
  const four = stateWith(['# F', '', ':::: columns', ...[1, 2, 3, 4].flatMap(n => ['::: column', `C${n}`, ':::', '']), '::::'].join('\n'), 'C1')
  assert.equal(addItem(four, blockPos(four)), null, 'a fifth column is never added')
}

// ---- Delete keeps the block's comments (they are words) where it stood.
{
  const doc = loadSlideWithComments('# T\n\n:::: boxes\n::: box\nOne\n:::\n::::\n\nAfter')
  let pos = -1
  doc.forEach((node, offset) => { if (node.type.name === 'slideDiv') pos = offset })
  const note = doc.type.schema.nodes.commentNode
  assert.ok(note, 'the comment flag is on'); {
    const withNote = EditorState.create({ doc }).tr.insert(pos + 1, note.create({ note: 'Shorter, please' }))
    const state = EditorState.create({ doc: withNote.doc })
    const tr = deleteBlock(state, pos)!
    let notes = 0
    tr.doc.descendants(node => { if (node.type.name === 'commentNode') notes++ })
    assert.equal(notes, 1, 'the comment stays')
  }
}

// ---- The ⋮ drag: a block moves within the slide, one Undo; never above the title, never off its comment.
{
  const slide = ['# Title', '', 'A line', '', '- One', '- Two', '', 'Last words'].join('\n')
  stable(slide, 'the drag slide')
  const state = stateWith(slide, 'One')
  const pos = blockPos(state)
  const index = state.doc.resolve(pos).index(0)
  const gaps = dropGaps(state.doc, index)
  assert.ok(!gaps.includes(0), 'never above the title')
  assert.ok(!gaps.includes(index) && !gaps.includes(index + 1), 'never where it is')
  assert.equal(after(moveBlock(state, pos, 1)), ['# Title', '', '- One', '- Two', '', 'A line', '', 'Last words'].join('\n'))
  assert.equal(after(moveBlock(state, pos, state.doc.childCount)), ['# Title', '', 'A line', '', 'Last words', '', '- One', '- Two'].join('\n'))
  assert.equal(moveBlock(state, pos, 0), null)
  const text = DECK(slide)
  const deck = openDeck(text)
  const stage = stageOn(deck, 0)
  stage.caretIn('One')
  stage.apply(moveBlock(stage.inner, blockPos(stage.inner), 1))
  assert.ok(stage.save().includes('# Title\n\n- One\n- Two\n\nA line'), stage.save())
  stage.undo()
  assert.equal(stage.save(), text, 'the drag: one Undo')
}

// ---- Tab and Shift+Tab across boxes and columns; the last stays; a list's, a code box's and Steps' own Tab win.
{
  let state = stateWith(AGENDA, 'News')
  const next = tabAcross(state, 1)
  assert.ok(next && next !== 'stay')
  state = state.apply(next)
  assert.equal(state.selection.$head.parent.textContent, 'Desktop agents')
  assert.equal(state.selection.$head.parentOffset, 0, 'the start of the next box')
  const back = tabAcross(state, -1)
  assert.ok(back && back !== 'stay')
  assert.equal(state.apply(back).selection.$head.parent.textContent, 'News and notices')
  assert.equal(tabAcross(stateWith(AGENDA, 'Summary'), 1), 'stay', 'the last box: Tab stays')
  assert.equal(tabAcross(stateWith(AGENDA, 'News'), -1), 'stay', 'the first box: Shift+Tab stays')
  const columns = tabAcross(stateWith(COLUMNS, 'Documents'), 1)
  assert.ok(columns && columns !== 'stay')
  assert.equal(stateWith(COLUMNS, 'Documents').apply(columns).selection.$head.parent.textContent, 'Cursor')
  assert.equal(tabAcross(stateWith('# S\n\n::: steps\n1. One\n2. Two\n:::', 'Two'), 1), null, "Steps: the list's own Tab (indent)")
  assert.equal(tabAcross(stateWith('# L\n\n- One\n- Two', 'Two'), 1), null, "a list's own Tab")
  assert.equal(tabAcross(stateWith(':::: boxes\n::: box\n- In a box\n- Two\n:::\n\n::: box\nB\n:::\n::::', 'Two'), 1), null, 'a list in a box: its own Tab')
  assert.equal(tabAcross(stateWith(':::: boxes\n::: box\n```\ncode here\n```\n:::\n\n::: box\nB\n:::\n::::', 'code'), 1), null, 'a code box: its own Tab')
  assert.equal(tabAcross(stateWith('# T\n\nA line', 'line'), 1), null, 'a line on the slide: not the bar\'s')
}

// ---- The handles at the smallest stage: the slide scales, the handles don't; a drag reads the same at any scale.
{
  const SMALLEST = 0.24
  for (const scale of [SMALLEST, 0.5, 1]) {
    // The agenda block in the frame: the flow starts 64 slide px in.
    const block = { left: 64 * scale, top: 120 * scale, width: 832 * scale, height: 200 * scale }
    const grip = gripSpot(block)
    assert.ok(grip.left >= 0 && grip.left + HANDLE_SIZE <= 960 * scale, `scale ${scale}: the ⋮ is on the slide`)
    assert.ok(grip.top === block.top, `scale ${scale}: the ⋮ at the block's top`)
    // The ⋮ is within reach of the block's corner: a pointer on it is over the block's top left.
    assert.ok(block.left - (grip.left + HANDLE_SIZE / 2) <= HANDLE_SIZE + 4, `scale ${scale}: the ⋮ beside the block`)
    const plus = plusSpot(block, 'boxes')
    assert.equal(plus.left + HANDLE_SIZE / 2, block.left + block.width, `scale ${scale}: the + centred on the right edge`)
    // The split line drawn at a third of two columns is read back as a third under the pointer.
    const left = 100 + block.left
    const right = left + 400 * scale
    const drawnAt = left + (right - left) / 3
    assert.ok(Math.abs(splitPlace(drawnAt, left, right) - 1 / 3) < 1e-9, `scale ${scale}: the split under the pointer`)
    assert.equal(slideDelta(96 * scale, scale), 96, `scale ${scale}: a drag is divided by the scale`)
    // The drop line nearest the pointer is the gap under it.
    const lines = new Map([[1, 100 * scale], [3, 300 * scale], [4, 400 * scale]])
    assert.equal(nearestGap(310 * scale, [1, 3, 4], lines), 3)
  }
}

console.log('blockBar: Turn into, Width, Style, alignment, Columns, the split, Add, Delete, the drag, Tab and the handles pass')
