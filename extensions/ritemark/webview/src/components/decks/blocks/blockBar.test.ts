/**
 * The block's bar (experience 46, 17 November): Turn into, Boxes' Width, Style, Mark and alignment, Columns' count, split and
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
import { BOXES_MARKS, BOX_AUTO_MIN, BOX_GAP, MARK_LOOK, OPEN_FENCE, OWN_MARK_LOOKS, boxesLookOf, boxesMarkOf, columnTemplateOf, columnWidthOf, columnsAlignOf, parseFenceAttributes, type BoxesMark } from '../../../../../src/decks/blocks/fencedDiv'
import { blockSlideHtml } from '../../../../../src/decks/blocks/slideRenderer'
import { buttonVariants } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { BUILT_IN_THEME } from '../../../../../src/decks/deckTheme'
import { contrast, themeVars } from '../theme/themeVars'
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
import { markableBox } from './slideDivView'
import { boxForEmptyIconMenu } from './itemHandle'
import { iconMenuChoices, iconMenuStartQuery } from '../slide/iconSearch'
import { SLIDE_COMMAND, setBlockValue } from './slideCommands'
import {
  BAR_KINDS, HANDLE_SIZE, RING_LINE, addItem, barGap, barLeft, boxIconMenuReturnFocus, caretBoxIcon, chosenBlockAt, columnCount, columnIndexAt, columnShares, deleteBlock, dropGaps, gripSpot, iconSpot, isBoxIconShortcut, moveBlock, nearestGap, plusSpot, removeColumn, ringGap,
  FOLD_AT, MAX_FOLD, barLeftPastPane, REVEAL_LABEL, REVEAL_TIP, revealsOneBlock, setColumnCount, setColumnSplit, setReveal, snapSplit, splitGuideX, splitPlace, splitShares, tabAcross, turnInto, type BarKind, type BoxIconMenuCloseReason,
  MARK_LABEL, MARK_MENU_TIP, MARK_TIP, divAttributesOf, setBoxesMark,
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

// ---- A lower count takes an empty column first, wherever it stands (the Experience lead, 17 November); with none
// empty, the last column's words join the one before it. One Undo gives the file back.
{
  const columnsWith = (words: (string | null)[]) => ['# Pick one', '', ':::: columns', ...words.flatMap((word, index) => [
    ...(word === null ? ['::: column', ':::'] : ['::: column', `### ${word}`, '', `${word} words`, ':::']), ...(index < words.length - 1 ? [''] : []),
  ]), '::::'].join('\n')
  for (const [words, at, expected, label] of [
    [['A', null, 'C'], 'A', ['A', 'C'], 'the empty middle column goes'],
    [[null, 'B', 'C'], 'B', ['B', 'C'], 'the empty first column goes'],
    [['A', 'B', null], 'A', ['A', 'B'], 'the empty last column goes'],
    [['A', null, 'C', null], 'C', ['A', 'C'], '4 → 2: both empty columns go'],
  ] as const) {
    const markdown = columnsWith([...words])
    stable(markdown, label)
    const state = stateWith(markdown, at)
    const pos = blockPos(state)
    const tr = setColumnCount(state, pos, expected.length)!
    assert.equal(columnCount(tr.doc.nodeAt(pos)!), expected.length, label)
    assert.equal(after(tr), columnsWith([...expected]), `${label}: the others as they were`)
  }
  // None empty: 4 → 3 joins the last into the one before; an empty one among four goes before any words move.
  const four = columnsWith(['A', 'B', 'C', 'D'])
  const state = stateWith(four, 'A')
  const three = after(setColumnCount(state, blockPos(state), 3))
  assert.ok(three.includes('### C\n\nC words\n\n### D\n\nD words\n:::\n::::'), three)
  const mixed = columnsWith(['A', 'B', null, 'D'])
  const mixedState = stateWith(mixed, 'A')
  const two = after(setColumnCount(mixedState, blockPos(mixedState), 2))
  assert.equal(two, ['# Pick one', '', ':::: columns', '::: column', '### A', '', 'A words', ':::', '', '::: column', '### B', '', 'B words', '', '### D', '', 'D words', ':::', '::::'].join('\n'), two)
  // In the deck: 3 → 2 with the middle emptied, then one Undo, the same bytes.
  const text = DECK(columnsWith(['A', null, 'C']))
  const deck = openDeck(text)
  const stage = stageOn(deck, 0)
  stage.caretIn('A')
  stage.apply(setColumnCount(stage.inner, blockPos(stage.inner), 2))
  assert.equal((stage.save().match(/^::: column$/gm) ?? []).length, 2)
  stage.undo()
  assert.equal(stage.save(), text, '3 → 2: one Undo gives the file back')
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
    // The drop line nearest the pointer is the gap under it.
    const lines = new Map([[1, 100 * scale], [3, 300 * scale], [4, 400 * scale]])
    assert.equal(nearestGap(310 * scale, [1, 3, 4], lines), 3)
  }
}

// ---- #829: the split's guide stands in the middle of the gap the line will have, as the handle does once it lands.
// The columns laid out as slide.css draws them: `column-gap: calc(32px * var(--fit))`, each column its share of the
// room as the `fr` `columnTemplateOf` writes, or an even share. A third of the two columns' span was drawn, which is a
// sixth of the gap off the split at ⅓ and ⅔ (about 5 px at the 32 px gap).
{
  const css = readFileSync(new URL('../slide/slide.css', import.meta.url), 'utf8')
  const gapRule = /\.blk-columns \{[^}]*column-gap: calc\((\d+)px \* var\(--fit, 1\)\)/.exec(css)
  assert.ok(gapRule, 'the columns\' gap, from slide.css')
  const GAP = Number(gapRule[1])
  assert.equal(GAP, 32)
  /** The renderer's tracks for these widths: its own `fr` numbers, or even ones (no template). */
  const tracksOf = (widths: ReadonlyArray<number | null>) => {
    const template = columnTemplateOf(widths)
    return template ? [...template.matchAll(/minmax\(0, ([\d.]+)fr\)/g)].map(match => Number(match[1])) : widths.map(() => 1)
  }
  /** The columns as `measure` reads them: a block `width` slide px wide from `left`, at the stage's `scale`. */
  const drawn = (widths: ReadonlyArray<number | null>, fit: number, scale: number, left = 200, width = 832) => {
    const gap = GAP * fit * scale
    const tracks = tracksOf(widths)
    const sum = tracks.reduce((a, b) => a + b, 0)
    const room = width * scale - gap * (tracks.length - 1)
    const columns: { left: number; right: number }[] = []
    let x = left
    for (const track of tracks) { columns.push({ left: x, right: x + (track / sum) * room }); x += (track / sum) * room + gap }
    const grid = { left: columns[0].left, right: columns[columns.length - 1].right }
    /** Line `index`: its handle's x, its two columns' outer edges, the gap between them and the grid's edges. */
    return (index: number) => {
      const a = columns[index]
      const b = columns[index + 1]
      return { handle: (a.right + b.left) / 2, left: a.left, right: b.right, gap: b.left - a.right, grid }
    }
  }
  const guideOf = (line: ReturnType<ReturnType<typeof drawn>>, shares: readonly number[], index: number, snap: number) => splitGuideX(line.grid, line.gap, shares, index, snap)
  const SNAPS = [[1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔']] as const
  const EVEN2 = [null, null]
  const EVEN3 = [null, null, null]
  for (const fit of [1, 0.6]) {
    for (const scale of [0.9, 0.5]) {
      for (const [snap, name] of SNAPS) {
        const where = `fit ${fit}, scale ${scale}, ${name}`
        const written = splitShares([50, 50], 0, snap)
        assert.deepEqual(written, snap === 1 / 2 ? null : snap < 1 / 2 ? [33, 67] : [67, 33], `${where}: the shares written`)
        // Held at the split the columns have: the guide is on the handle, in the middle of the gap.
        const line = drawn(written ?? EVEN2, fit, scale)(0)
        const shares = written ?? [50, 50]
        assert.ok(Math.abs(guideOf(line, shares, 0, snap) - line.handle) < 1e-6, `${where}: the guide in the middle of the gap (${guideOf(line, shares, 0, snap).toFixed(2)} for ${line.handle.toFixed(2)})`)
        // Dragged there from an even split: the guide stands where the handle will be once it lands.
        const from = drawn(EVEN2, fit, scale)(0)
        assert.ok(Math.abs(guideOf(from, [50, 50], 0, snap) - line.handle) < 1e-6, `${where}: from an even split, where the line lands`)
        // A pointer on the guide reads its own snap.
        assert.equal(snapSplit(splitPlace(guideOf(from, [50, 50], 0, snap), from.left, from.right, from.gap)), snap, `${where}: the pointer on the guide`)
      }
      // Three columns, the second line: every column as the drop writes it (the first one's 33 too).
      for (const [snap, name] of SNAPS) {
        const evenShares = [100 / 3, 100 / 3, 100 / 3]
        const landed = drawn(splitShares(evenShares, 1, snap) ?? EVEN3, fit, scale)(1)
        const guide = guideOf(drawn(EVEN3, fit, scale)(1), evenShares, 1, snap)
        assert.ok(Math.abs(guide - landed.handle) < 1e-6, `fit ${fit}, scale ${scale}, three columns, ${name}: ${guide.toFixed(2)} for ${landed.handle.toFixed(2)}`)
      }
      // Hand-written shares that the drop rounds outside the pair too (review of #893): 20.4 % becomes 20 %, which moves
      // the pair, and the guide stands where it lands.
      for (const [snap, name] of SNAPS) {
        const handWritten = [20.4, 40.3, 39.3]
        const landed = drawn(splitShares(handWritten, 1, snap) ?? EVEN3, fit, scale)(1)
        const guide = guideOf(drawn(handWritten, fit, scale)(1), handWritten, 1, snap)
        assert.ok(Math.abs(guide - landed.handle) < 1e-6, `fit ${fit}, scale ${scale}, 20.4/40.3/39.3, ${name}: ${guide.toFixed(2)} for ${landed.handle.toFixed(2)}`)
      }
    }
  }
  // Shares that round to nothing still give a place on the slide, never NaN (review of #893).
  const tiny = drawn([0.4, 0.4, 99.2], 1, 0.9)(0)
  assert.ok(Number.isFinite(guideOf(tiny, [0.4, 0.4, 99.2], 0, 1 / 2)), 'a guide for shares that round to 0')
  // The drop writes what the guide showed: the same shares through `setColumnSplit`.
  const twoColumns = ['# Two', '', ':::: columns', '::: column', 'A', ':::', '', '::: column', 'B', ':::', '::::'].join('\n')
  const state = stateWith(twoColumns, 'A')
  for (const snap of [1 / 3, 2 / 3]) {
    const dropped = state.apply(setColumnSplit(state, blockPos(state), 0, snap)!)
    assert.deepEqual(columnShares(dropped.doc.nodeAt(blockPos(dropped))!), splitShares([50, 50], 0, snap))
  }
  // Pointed at, the split shows its line only: its class takes the ghost Button's hover fill (a light 12 px bar on the
  // slide) away at the source, through the Button's own class merge.
  const barSource = readFileSync(new URL('./SlideBlockBar.tsx', import.meta.url), 'utf8')
  const splitClass = /variant="ghost"\s+(?:\/\/[^\n]*\s+)?className="(deck-block-split[^"]*)"/.exec(barSource)
  assert.ok(splitClass, 'the split is a ghost Button')
  const classes = cn(buttonVariants({ variant: 'ghost', className: splitClass[1] })).split(/\s+/)
  assert.ok(classes.includes('hover:bg-transparent') && !classes.some(name => /^hover:bg-(?!transparent$)/.test(name)), classes.join(' '))
}

// ---- Review of #773: the fixes, each failing before.
{
  // Remove a column keeps its comments (they are words), in the column that takes the caret.
  const doc = loadSlideWithComments(COLUMNS)
  const note = doc.type.schema.nodes.commentNode
  let column = -1
  doc.descendants((node, pos) => { if (column < 0 && node.type.name === 'heading' && node.textContent === 'Cursor') column = pos })
  const withNote = EditorState.create({ doc }).tr.insert(column, note.create({ note: 'Name the plan too' }))
  const state = EditorState.create({ doc: withNote.doc, selection: caretAt(withNote.doc, 'Cursor') })
  const pos = blockPos(state)
  const removed = removeColumn(state, pos, columnIndexAt(state, pos)!)!
  let notes = 0
  removed.doc.descendants(node => { if (node.type.name === 'commentNode') notes++ })
  assert.equal(notes, 1, 'Remove a column keeps its comment')
  assert.ok(!removed.doc.textContent.includes('Cursor'), 'the column itself is gone')

  // Steps with a line before its list: Turn into keeps it before the new block.
  const intro = '# S\n\n::: steps\nBefore the steps\n\n1. One\n2. Two\n:::'
  const steps = stateWith(intro, 'One')
  const boxes = after(turnInto(steps, blockPos(steps), 'boxes'))
  assert.ok(boxes.indexOf('Before the steps') < boxes.indexOf(':::: boxes'), boxes)

  // 13 boxes and more: drawn as many, in rows of boxes at least 180 px wide (no Auto rule counts them).
  const many = ['# M', '', ':::: boxes', ...Array.from({ length: 14 }, (_unused, n) => [`::: box`, `B${n}`, ':::', '']).flat(), '::::'].join('\n')
  assert.ok(blockSlideHtml(many).includes('data-count="14" data-many=""'), 'fourteen boxes are many')
  const css = readFileSync(new URL('../slide/slide.css', import.meta.url), 'utf8')
  assert.ok(css.includes('.blk-boxes[data-many]:not([data-width]) > .blk-box { flex: 1 1 180px; }'))
  // A Boxes block in a box takes the box's width on the stage too, where a box's blocks are in its `.blk-inner`.
  assert.ok(css.includes('.blk-box > .blk-inner > .blk-boxes { align-self: stretch; }'))
  // Columns aligned: a table or a picture keeps its own width.
  assert.ok(css.includes('.blk-columns[data-valign] > .blk-column > :is(table, .tableWrapper, img, .blk-pic) { align-self: flex-start; }'))

  // Borderless Outline: a filled theme's own (faint) line is not the outline's.
  const vars = themeVars(BUILT_IN_THEME, true)
  assert.equal(BUILT_IN_THEME.boxes, 'filled')
  assert.notEqual(vars.boxo, vars.boxl, 'the outline line is stronger than the filled theme\'s box line')

  // Space, not lines (17 November): a filled box is its fill only, so on white the fill reads alone (Evening's is
  // #EFF0F8), and a theme file with the older, fainter shade gets a stronger one; only an outline theme's box has an edge.
  assert.equal(vars.box, '#EFF0F8')
  assert.equal(vars.boxf, '#EFF0F8')
  assert.equal(vars.boxe, 'transparent')
  assert.equal(themeVars(BUILT_IN_THEME, false).boxe, 'transparent')
  const older = themeVars({ ...BUILT_IN_THEME, borderless: { ...BUILT_IN_THEME.borderless, box: '#F6F6FB' } }, true)
  assert.notEqual(older.box, '#F6F6FB', 'too faint to read alone')
  assert.ok(contrast(older.box, '#FFFFFF') >= 1.13 && contrast(older.box, '#FFFFFF') < 1.2, older.box)
  const outlined = themeVars({ ...BUILT_IN_THEME, boxes: 'outline' }, true)
  assert.equal(outlined.box, 'transparent')
  assert.notEqual(outlined.boxe, 'transparent', 'an outline keeps its line')
  assert.notEqual(themeVars({ ...BUILT_IN_THEME, boxes: 'outline' }, false).boxe, 'transparent')
  // On a light Card ground the fill reads alone too (review of #780): white on cream, or a faint tint on paper.
  for (const bg of ['#F5F1E8', '#FDFDFD']) {
    const light = themeVars({ ...BUILT_IN_THEME, bg, head: '#2B2B2B', text: '#333333', glow: false, card: undefined }, false)
    assert.ok(contrast(light.box, bg) >= 1.13 && light.box === light.boxf, `${bg}: ${light.box}`)
  }
  assert.ok(!/\.blk-column \{[^}]*box-shadow/.test(css) && !/\.blk-box \{[^}]*var\(--s-boxl/.test(css), 'no column line and no box hairline at rest')
}

// ---- Codex on #773: a numbered list keeps its start and `)` between Numbered and Steps, both ways, byte for byte.
{
  const numbered = '# N\n\n5) Five\n6) Six'
  stable(numbered, 'a numbered list from five')
  const state = stateWith(numbered, 'Five')
  const steps = after(turnInto(state, blockPos(state), 'steps'))
  assert.ok(steps.includes('5) Five'), steps)
  const back = stateWith(steps, 'Five')
  assert.equal(after(turnInto(back, blockPos(back), 'numbered')), numbered, 'Numbered → Steps → Numbered: the same bytes')
}

// ---- The Experience lead on #773: the bar stays in the slide's pane; the + never covers words; the bar clears it.
{
  const pane = { left: 200, right: 700 }
  assert.equal(barLeft(300, 300, pane, 1440), 300, 'under the block when it fits')
  assert.equal(barLeft(500, 300, pane, 1440), 392, 'moved left to keep 8 px from the divider')
  assert.equal(barLeft(150, 300, pane, 1440), 208, 'never past the pane\'s left edge')
  assert.equal(barLeft(300, 490, pane, 1440), null, 'wider than the pane: the group folds')
  const widthBeforeDelete = 460
  const deleteWidth = 32
  const deleteGap = 2
  const rowWidth = widthBeforeDelete + deleteWidth + deleteGap
  assert.equal(barLeft(300, widthBeforeDelete, pane, 1440), 232, 'without Delete the row fits at this fold')
  assert.equal(barLeft(300, rowWidth, pane, 1440), null, 'the complete row needs another fold')
  // Wider than the pane even folded: it stays in the window, sliding left over the strip, never off the right edge.
  assert.equal(barLeftPastPane(506, { left: 400 }, 760), 246, 'over the strip, its right end 8 px inside the window')
  assert.equal(barLeftPastPane(300, { left: 400 }, 1440), 408, 'room to the right: at the pane\'s left')
  assert.equal(barLeftPastPane(900, { left: 400 }, 760), 8, 'wider than the window: from its left edge')
  const barSource = readFileSync(new URL('./SlideBlockBar.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(barSource, /maxWidth:|flexWrap:/, 'measure the complete intrinsic row even at MAX_FOLD')
  assert.match(barSource, /\{!iconOnly && BAR_KIND_LABEL\[chosen.kind\]\}/, 'the type keeps only its icons at the last fold')
  assert.match(barSource, /\{!iconOnly && 'Add'\}/, 'Add keeps only its icon at the last fold')
  assert.match(barSource, /<Group label="Style" folded=\{fold >= FOLD_AT.style\} bare=\{iconOnly\}/)
  assert.match(barSource, /<Group label="Size" folded bare=\{iconOnly\}/)
  const list = { left: 100, top: 50, width: 400, height: 90 }
  const plus = plusSpot(list, 'list', 112)
  assert.equal(plus.left + HANDLE_SIZE / 2, 112, 'a list\'s + under its bullets')
  // The lead's follow-up: centred on the ring's bottom line (8 px off the block, the 2 px line's middle), clear of the
  // last bullet; the bar keeps its 8 px gap below the +.
  const ringLine = 140 + ringGap('list') + RING_LINE / 2
  assert.equal(plus.top + HANDLE_SIZE / 2, ringLine, 'centred on the ring\'s bottom line')
  assert.equal(plusSpot(list, 'steps', 112).top, plus.top, 'Steps the same')
  assert.equal(140 + barGap('list') - (plus.top + HANDLE_SIZE), 8, 'the bar 8 px under the +')
  assert.ok(barGap('steps') === barGap('list'), 'Steps the same')
  assert.equal(barGap('boxes'), 8)
  assert.equal(barGap('columns'), 8)
  // Boxes and Columns keep the + on the right edge's middle.
  assert.deepEqual(plusSpot(list, 'columns'), { left: 500 - HANDLE_SIZE / 2, top: 95 - HANDLE_SIZE / 2 })
  // A box's icon handle: centred on its top edge, 12 px of the slide in from its right, the handles' size.
  const icon = iconSpot({ left: 100, top: 200, width: 300, height: 120 }, 0.5)
  assert.deepEqual(icon, { left: 400 - 6 - HANDLE_SIZE, top: 200 - HANDLE_SIZE / 2 })
}

// ---- #910: the Icon control follows the caret's box and uses the shared picker.
{
  const markdown = [
    '# Outside', '', ':::: boxes', '::: {.box icon="lightbulb"}', 'Known', ':::', '',
    '::: {.box icon="trukc"}', 'Unknown', ':::', '', '::: box', 'Empty', ':::', '::::',
  ].join('\n')
  assert.equal(caretBoxIcon(stateWith(markdown, 'Outside')), null)
  for (const [text, current, glyph] of [
    ['Known', 'lightbulb', 'lightbulb'], ['Unknown', 'trukc', 'circle-dashed'], ['Empty', null, 'circle-dashed'],
  ] as const) {
    const box = caretBoxIcon(stateWith(markdown, text))
    assert.ok(box)
    assert.equal(box.current, current)
    assert.equal(box.glyph, glyph)
  }

  const state = stateWith(markdown, 'Unknown')
  const box = caretBoxIcon(state)!
  const query = iconMenuStartQuery(box.current)
  assert.equal(query, 'trukc')
  const [choice] = iconMenuChoices(query, []).icons
  assert.equal(choice.phosphor, 'truck')
  const picked = after(setBlockValue(state, box.pos, 'icon', choice.name))
  assert.equal(caretBoxIcon(stateWith(picked, 'Unknown'))?.glyph, 'truck')
  assert.equal(caretBoxIcon(stateWith(picked, 'Known'))?.glyph, 'lightbulb')

  for (const mark of BOXES_MARKS) {
    const look = MARK_LOOK[mark] ?? 'boxes'
    const marked = markdown.replace(':::: boxes', `:::: {.boxes look="${look}"}`)
    const visible = mark === 'icon' || mark === 'number'
    assert.equal(caretBoxIcon(stateWith(marked, 'Known'))?.glyph, visible ? 'lightbulb' : undefined, mark)
    assert.equal(caretBoxIcon(stateWith(marked, 'Empty'))?.current, visible ? null : undefined, mark)
  }

  const shortcut = { key: 'F10', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, defaultPrevented: false }
  assert.equal(isBoxIconShortcut(shortcut), true)
  assert.equal(isBoxIconShortcut({ ...shortcut, key: 'F9' }), false)
  assert.equal(isBoxIconShortcut({ ...shortcut, altKey: false }), false)
  for (const key of ['ctrlKey', 'metaKey', 'shiftKey', 'defaultPrevented'] as const) {
    assert.equal(isBoxIconShortcut({ ...shortcut, [key]: true }), false, key)
  }
}

// ---- #1103: Mark opens the same Radix trigger as a press on the bar's box-icon button.
{
  const markdown = [':::: {.boxes look="arrows"}', '::: box', 'First', ':::', '', '::: box', 'Second', ':::', '::::'].join('\n')
  const state = stateWith(markdown, 'Second')
  const block = chosenBlockAt(state)!
  const target = boxForEmptyIconMenu(state, block)
  assert.notEqual(target, null)
  assert.notEqual(target, boxForEmptyIconMenu(stateWith(markdown, 'First'), block))
  assert.equal(caretBoxIcon(state), null)
  const iconState = state.apply(setBoxesMark(state, block.pos, 'icon')!)
  assert.equal(caretBoxIcon(iconState)?.pos, target, 'the newly rendered button is for the same box')

  const bar = readFileSync(new URL('./SlideBlockBar.tsx', import.meta.url), 'utf8')
  const editor = readFileSync(new URL('./SlideEditor.tsx', import.meta.url), 'utf8')
  const tools = readFileSync(new URL('./SlideBlockTools.tsx', import.meta.url), 'utf8')
  assert.match(bar, /choice === 'icon' \? boxForEmptyIconMenu[\s\S]*?apply\(tr\)[\s\S]*?measure\(\)\s*setPendingIcon\(\{ blockPos: block\.pos, pos \}\)/)
  assert.match(bar, /useLayoutEffect\(\(\) => \{\s*if \(!pendingIcon\) return[\s\S]*?placed\?\.caretBox\?\.pos === pendingIcon\.pos \? iconTrigger\.current : null[\s\S]*?trigger\.dispatchEvent\(new PointerEvent\('pointerdown'/)
  assert.match(bar, /<BoxIconButton\s+box=\{placed\.caretBox\}\s+trigger=\{iconTrigger\}/)
  assert.match(bar, /<DropdownMenuTrigger asChild>\s*<Button\s+ref=\{trigger\}[^>]*aria-label="Icon"/)
  assert.match(bar, /\} else \{\s*const anchor = editor\.view\.nodeDOM\(pendingIcon\.pos\)\s*if \(anchor instanceof HTMLElement\) pickIcon\?\.\(pendingIcon\.pos, anchor, null\)/)
  assert.match(tools, /onOpenChange=\{open => \{ if \(!open\) onClose\(\) \}\}/)
  assert.match(editor, /onClose=\{\(\) => setIconPick\(null\)\}/)
}

// ---- Focus after closing the box icon menu, by opening mode and close reason.
{
  const cases: [BoxIconMenuCloseReason, 'trigger' | 'editor' | null, 'trigger' | 'editor' | null][] = [
    ['trigger', 'editor', 'trigger'],
    ['outside', null, null],
    ['escape', 'editor', 'trigger'],
    ['mouse-pick', 'editor', 'editor'],
    ['keyboard-pick', 'editor', 'trigger'],
  ]
  for (const [reason, mouseOpened, keyboardOpened] of cases) {
    assert.equal(boxIconMenuReturnFocus(false, reason), mouseOpened, `mouse-opened: ${reason}`)
    assert.equal(boxIconMenuReturnFocus(true, reason), keyboardOpened, `keyboard-opened: ${reason}`)
  }
}

// ---- The hang on changing slides: the caret's mark goes only on a box the slide draws, in the page.
{
  const element = (classes: string[], connected = true) => ({ isConnected: connected, classList: { contains: (name: string) => classes.includes(name) } })
  const box = element(['blk-box'])
  assert.equal(markableBox(box), box, 'a box is marked')
  assert.equal(markableBox(element([])), null, 'another node\'s element at a stale place is never marked')
  assert.equal(markableBox(element(['blk-box'], false)), null, 'a box no longer in the page is never marked')
  assert.equal(markableBox(null), null)
}

// ---- README item 18, Reveal: All at once · One by one. Boxes, Steps and Columns write `reveal="one"` on their own
// line; a list is wrapped in `::: incremental`, its own lines never changing. Read back byte for byte, one Undo each.
{
  const LIST = ['# Plan', '', '- Open the file', '- Ask the question', '  with a second line', '- Check the answer', '', 'After the list.'].join('\n')
  const NUMBERED = ['# Plan', '', '3) Open the file', '4) Ask the question', '5) Check the answer'].join('\n')
  const STEPS = ['# Plan', '', '::: {.steps tag="Try it"}', '1. Open the file', '2. Ask the question', ':::'].join('\n')
  const COLUMNS = ['# Plan', '', ':::: columns', '::: column', '### Before', 'Old way', ':::', '', '::: column', '### After', 'New way', ':::', '::::'].join('\n')
  const wrap = (markdown: string, list: string) => markdown.replace(list, `::: incremental\n${list}\n:::`)
  const listOf = (markdown: string) => markdown.split('\n').filter(line => /^(\s+\S|[-*]|\d+[.)])/.test(line)).join('\n')
  for (const [label, markdown, caret, oneLine] of [
    ['Boxes', AGENDA, 'Desktop', (text: string) => text.replace(':::: boxes', ':::: {.boxes reveal="one"}')],
    ['Steps', STEPS, 'Ask', (text: string) => text.replace('::: {.steps tag="Try it"}', '::: {.steps tag="Try it" reveal="one"}')],
    ['Columns', COLUMNS, 'New', (text: string) => text.replace(':::: columns', ':::: {.columns reveal="one"}')],
    ['List', LIST, 'Ask', (text: string) => wrap(text, listOf(LIST))],
    ['Numbered', NUMBERED, 'Ask', (text: string) => wrap(text, listOf(NUMBERED))],
  ] as const) {
    stable(markdown, label)
    const state = stateWith(markdown, caret)
    const block = chosenBlockAt(state)!
    assert.equal(revealsOneBlock(block), false, `${label}: All at once to begin with`)
    assert.equal(setReveal(state, block.pos, false), null, `${label}: All at once again changes nothing`)
    const one = setReveal(state, block.pos, true)
    assert.equal(one!.getMeta(SLIDE_COMMAND), true, `${label}: one undo step of its own`)
    const written = after(one)
    assert.equal(written, oneLine(markdown), `${label}: One by one is written as item 18 says`)
    stable(written, `${label} one by one`)
    // Read back: the bar sees the same kind, now One by one, with the caret where it was.
    const back = stateWith(written, caret)
    const chosen = chosenBlockAt(back)!
    assert.equal(chosen.kind, block.kind, `${label}: still a ${block.kind} to the bar`)
    assert.equal(revealsOneBlock(chosen), true, `${label}: reads back as One by one`)
    assert.equal(one!.selection.$head.parent.textContent.startsWith(caret), true, `${label}: the caret stays in its item`)
    assert.equal(setReveal(back, chosen.pos, true), null, `${label}: One by one again changes nothing`)
    // All at once writes nothing: the bytes it had.
    assert.equal(after(setReveal(back, chosen.pos, false)), markdown, `${label}: All at once gives the same bytes back`)
    // The deck: one Undo gives the file back.
    const text = DECK(markdown)
    const deck = openDeck(text)
    const stage = stageOn(deck, 0)
    stage.caretIn(caret)
    stage.apply(setReveal(stage.inner, blockPos(stage.inner), true))
    assert.equal(stage.save(), DECK(written), `${label}: the deck's file has the one change`)
    stage.undo()
    assert.equal(stage.save(), text, `${label}: one Undo gives the file back`)
  }

  // A list wrapped either way survives open and save byte for byte, as a slide and as a deck; `{reveal="one"}` is read
  // as One by one too, and All at once unwraps it.
  const written = wrap(LIST, listOf(LIST))
  const otherForm = written.replace('::: incremental', '::: {reveal="one"}')
  for (const form of [written, otherForm]) {
    stable(form, form.split('\n')[2])
    const deck = openDeck(DECK(form))
    assert.equal(deck.save(deck.state.doc), DECK(form), `${form.split('\n')[2]}: the deck opens and saves byte for byte`)
    const state = stateWith(form, 'Ask')
    const chosen = chosenBlockAt(state)!
    assert.equal(chosen.kind, 'list')
    assert.equal(revealsOneBlock(chosen), true)
    assert.equal(after(setReveal(state, chosen.pos, false)), LIST, `${form.split('\n')[2]}: All at once unwraps to the bare list`)
  }
  // The bar's control (the Experience lead, 18 November): one toggle, "One by one", pressed when on, with a tooltip; a
  // press flips it (off is All at once). It folds just after the alignment: before the Columns count and Style.
  assert.equal(REVEAL_LABEL, 'One by one')
  assert.ok(/Present/.test(REVEAL_TIP) && /one by one/.test(REVEAL_TIP), REVEAL_TIP)
  assert.ok(FOLD_AT.alignment < FOLD_AT.reveal && FOLD_AT.reveal < FOLD_AT.size && FOLD_AT.size < FOLD_AT.style, 'alignment, Reveal, Columns count, Style')
  assert.equal(FOLD_AT.reveal, FOLD_AT.alignment + 1, 'Reveal folds right after the alignment')
  // Sprint 167 PR 2: Boxes' Mark, a menu already, folds last, to its value's icon (review of #878: else the Boxes bar at
  // its last fold was a menu wider than before, and ran past a narrow pane).
  assert.ok(FOLD_AT.style < FOLD_AT.mark, 'Style, then Mark')
  assert.ok(FOLD_AT.mark < FOLD_AT.words, 'Mark, then the words')
  assert.equal(MAX_FOLD, FOLD_AT.words, 'every group can fold, then the words go')
  {
    const barSource = readFileSync(new URL('./SlideBlockBar.tsx', import.meta.url), 'utf8')
    // One by one is a lone toggle with no segment track (the Experience lead, 27 November): off has no ground.
    assert.ok(!barSource.includes('<Segment label="Reveal">'), 'One by one sits in no segment track')
    assert.match(barSource, /<Choice\s+plain\s+on=\{reveal\}\s+icon="cards-three"\s+label=\{fold >= FOLD_AT\.reveal \? undefined : REVEAL_LABEL\}\s+tip=\{REVEAL_TIP\}\s+onPick=\{\(\) => run\(act\(pos => setReveal\(editor\.state, pos, !reveal\)\)\)\}/)
    assert.ok(!barSource.includes("label: 'All at once'"), 'no second choice: off is All at once')
    for (const group of ['Style', 'Columns']) assert.ok(new RegExp(`<Group label="${group}" folded=\\{fold >= FOLD_AT\\.(style|size)\\}`).test(barSource), group)
    assert.match(barSource, /<Group label="Size" folded bare=\{iconOnly\} icon="columns" tip=/)
    assert.match(barSource, /fold < MAX_FOLD/)
  }
  // A wrapper that carries more than Reveal keeps it at All at once: only Reveal goes (review of #799).
  for (const [line, keptLine] of [['::: {.incremental #intro}', '::: {#intro}'], ['::: {.note reveal="one"}', '::: note'], ['::: {reveal="one" data-x="1"}', '::: {data-x="1"}']] as const) {
    const form = written.replace('::: incremental', line)
    const state = stateWith(form, 'Ask')
    const chosen = chosenBlockAt(state)!
    assert.equal(revealsOneBlock(chosen), true, `${line}: One by one`)
    assert.equal(after(setReveal(state, chosen.pos, false)), form.replace(line, keptLine), `${line}: the rest of its line stays`)
  }
  // A task list in the wrapper is not a list to the bar, nor revealed in Present (the renderer's own rule).
  const tasks = ['# Plan', '', '::: incremental', '- [ ] One', '- [ ] Two', ':::'].join('\n')
  stable(tasks, 'a task list in a wrapper')
  assert.equal(chosenBlockAt(stateWith(tasks, 'One')), null, 'no bar for a task list in a wrapper')
  assert.ok(!blockSlideHtml(tasks).includes('data-reveal'), 'and nothing to reveal')
  // A wrapper holding more than one list is no reveal wrapper: the bar is not for it, and it is kept as written.
  const two = ['# Plan', '', '::: incremental', '- One', '', 'Words between.', ':::'].join('\n')
  stable(two, 'a wrapper with more than a list')
  assert.equal(chosenBlockAt(stateWith(two, 'One')), null, 'a wrapper with words beside its list is no list to the bar')

  // The bar sees through the wrapper: Add puts the item in the list, Turn into carries One by one, Delete takes both.
  {
    const state = stateWith(written, 'Ask')
    const pos = blockPos(state)
    const added = after(addItem(state, pos))
    assert.equal(added, written.replace('- Check the answer\n:::', '- Check the answer\n-\n:::'), `Add: a new item inside the wrapper\n${added}`)
    const boxes = after(turnInto(state, pos, 'boxes'))
    assert.ok(boxes.includes(':::: {.boxes reveal="one"}'), `Turn into Boxes carries One by one:\n${boxes}`)
    const again = stateWith(boxes, 'Ask')
    const listAgain = after(turnInto(again, blockPos(again), 'list'))
    assert.ok(listAgain.startsWith('# Plan\n\n::: incremental\n- Open the file'), `and back to a list, still One by one:\n${listAgain}`)
    // The same list as the bare one's round trip writes (a box's second line makes a loose list), in its wrapper.
    const bareBoxes = stateWith(LIST, 'Ask')
    const bareAgain = stateWith(after(turnInto(bareBoxes, blockPos(bareBoxes), 'boxes')), 'Ask')
    const unwrapped = stateWith(listAgain, 'Ask')
    assert.equal(after(setReveal(unwrapped, blockPos(unwrapped), false)), after(turnInto(bareAgain, blockPos(bareAgain), 'list')), 'the wrapper adds nothing else')
    const numbered = after(turnInto(state, pos, 'numbered'))
    assert.ok(numbered.startsWith('# Plan\n\n::: incremental\n1. Open the file'), `List → Numbered keeps its wrapper:\n${numbered}`)
    assert.equal(after(deleteBlock(state, pos)), '# Plan\n\nAfter the list.', 'Delete takes the list and its wrapper')
    const moved = after(moveBlock(state, pos, 3))
    assert.equal(moved, `# Plan\n\nAfter the list.\n\n${written.split('\n\n').slice(1, -1).join('\n\n')}`, `the ⋮ drag moves the wrapper with its list\n${moved}`)
  }

  // Drawn as the bare list is, everywhere: the same list in a plain block of its size, its items numbered for Present.
  {
    const bare = blockSlideHtml(LIST)
    const html = blockSlideHtml(written)
    assert.ok(html.includes('<div class="blk-group" data-reveal="one"><ul>\n<li data-reveal-item="0">'), html)
    assert.equal(html.replace(/ data-reveal-item="\d+"/g, '').replace('<div class="blk-group" data-reveal="one">', '').replace('</ul>\n</div>\n', '</ul>\n'), bare, 'the same list, drawn as the bare one')
    assert.ok(!html.includes('data-reveal-hidden'), 'the editor, the strip and the page show every item')
    assert.equal(blockSlideHtml(otherForm), html, '{reveal="one"} draws the same')
  }
}

// ---- Sprint 167 PR 2 (the decks README, item C): Mark, Icon · Number · Dot · Arrow, after Filled and Outline. Each is
// a look drawn today (old decks use them); Icon is the default and writes nothing; Number is the slide's own counter.
{
  const lineOf = (open: string) => parseFenceAttributes(OPEN_FENCE.exec(open)![2])!
  // The four marks are the four looks: Icon the default look, the others exactly the looks that draw their own mark.
  assert.deepEqual(BOXES_MARKS, ['icon', 'number', 'dot', 'arrow'], "the menu's order")
  assert.deepEqual(BOXES_MARKS.map(mark => MARK_LABEL[mark]), ['Icon', 'Number', 'Dot', 'Arrow'])
  assert.equal(MARK_LOOK.icon, null, 'Icon writes no look')
  assert.deepEqual(new Set(BOXES_MARKS.map(mark => MARK_LOOK[mark]).filter(look => look !== null)), OWN_MARK_LOOKS, 'Number, Dot, Arrow are the own-mark looks')
  for (const mark of BOXES_MARKS) assert.ok(MARK_TIP[mark].length > 0, `${mark} has a tooltip`)
  assert.equal(MARK_MENU_TIP, 'Mark on every box')
  // An old deck's look reads as its Mark, by the word that draws it; none, `boxes` and a word no look draws are Icon.
  for (const [line, mark] of [
    [':::: boxes', 'icon'], [':::: {.boxes look="boxes"}', 'icon'], [':::: {.boxes look="steps"}', 'number'], [':::: {.boxes look="line"}', 'dot'],
    [':::: {.boxes look="arrows"}', 'arrow'], [':::: {.boxes look="cards"}', 'icon'], [':::: {.boxes look="Steps"}', 'icon'],
  ] as const) {
    assert.equal(boxesMarkOf(lineOf(line)), mark, line)
    const drawn = blockSlideHtml(`${line}\n::: {.box icon="lightbulb"}\n### A\n:::\n::::`)
    assert.equal(drawn.includes('class="blk-icon"'), mark === 'icon' || mark === 'number', `${line}: icon visibility`)
  }

  // Each mark round-trips: written on the block's own line only, the same bytes on the next open, read back as itself,
  // drawn as its look; the boxes keep their own icons in the file, and Icon draws them again.
  const ICONS = ['# Plan', '', ':::: boxes', '::: {.box icon="lightbulb"}', '### One', '', 'Map the inbox.', ':::', '', '::: {.box icon="target"}', '### Two', ':::', '', '::: box', '### Three', ':::', '::::'].join('\n')
  stable(ICONS, 'boxes with icons')
  const LINE: Record<BoxesMark, string> = { icon: ':::: boxes', number: ':::: {.boxes look="steps"}', dot: ':::: {.boxes look="line"}', arrow: ':::: {.boxes look="arrows"}' }
  const state = stateWith(ICONS, 'Two')
  const chosen = chosenBlockAt(state)!
  assert.equal(chosen.kind, 'boxes')
  assert.equal(boxesMarkOf(divAttributesOf(chosen.node)), 'icon', 'Icon is the default')
  assert.equal(setBoxesMark(state, chosen.pos, 'icon'), null, 'Icon on Icon: no change')
  for (const mark of BOXES_MARKS.filter(mark => mark !== 'icon')) {
    const tr = setBoxesMark(state, chosen.pos, mark)
    assert.ok(tr && tr.getMeta(SLIDE_COMMAND) === true, `${mark}: an undo step of its own`)
    const markdown = after(tr)
    assert.equal(markdown, ICONS.replace(':::: boxes', LINE[mark]), `${mark} is written on the block's line only`)
    stable(markdown, mark)
    const again = stateWith(markdown, 'Two')
    const read = chosenBlockAt(again)!
    assert.equal(boxesMarkOf(divAttributesOf(read.node)), mark, `${mark} reads back as itself`)
    assert.equal(setBoxesMark(again, read.pos, mark), null, `${mark} on ${mark}: no change`)
    assert.ok(markdown.includes('icon="lightbulb"') && markdown.includes('icon="target"'), `${mark}: each box keeps its icon in the file`)
    const html = blockSlideHtml(markdown)
    assert.ok(html.includes(`data-look="${MARK_LOOK[mark]}"`), `${mark} drawn as its look`)
    assert.equal((html.match(/class="blk-icon"/g) ?? []).length, mark === 'number' ? 2 : 0, mark)
    assert.equal((html.match(/class="blk-mark"/g) ?? []).length, mark === 'arrow' ? 3 : 0, `${mark}: an arrow on each box only under Arrow`)
    // And back to Icon: the line as it was, the icons drawn again.
    const back = after(setBoxesMark(again, read.pos, 'icon'))
    assert.equal(back, ICONS, `${mark} → Icon: the same bytes as before`)
    assert.equal((blockSlideHtml(back).match(/class="blk-icon"/g) ?? []).length, 2, "Icon draws each box's own icon again")
    // From every mark to every other, only the look changes.
    for (const other of BOXES_MARKS.filter(other => other !== mark && other !== 'icon')) {
      assert.equal(after(setBoxesMark(again, read.pos, other)), ICONS.replace(':::: boxes', LINE[other]), `${mark} → ${other}`)
    }
  }
  // With the block's other values: Mark goes beside them, and Icon takes only the look out again.
  {
    const valued = ICONS.replace(':::: boxes', ':::: {.boxes width="s" fill="outline"}')
    const valuedState = stateWith(valued, 'Two')
    const numbered = after(setBoxesMark(valuedState, blockPos(valuedState), 'number'))
    assert.ok(numbered.includes(':::: {.boxes width="s" fill="outline" look="steps"}'), numbered)
    const numberedState = stateWith(numbered, 'Two')
    assert.equal(after(setBoxesMark(numberedState, blockPos(numberedState), 'icon')), valued, 'Icon takes only the look out')
  }
  // A look written as `look="boxes"` or a word no look draws reads Icon, and keeps its line when Icon is picked.
  for (const line of [':::: {.boxes look="boxes"}', ':::: {.boxes look="cards"}']) {
    const written = ICONS.replace(':::: boxes', line)
    stable(written, line)
    const writtenState = stateWith(written, 'Two')
    assert.equal(setBoxesMark(writtenState, blockPos(writtenState), 'icon'), null, `${line}: Icon is no change`)
    assert.equal(after(setBoxesMark(writtenState, blockPos(writtenState), 'dot')), ICONS.replace(':::: boxes', ':::: {.boxes look="line"}'), `${line} → Dot`)
  }
  // Only a Boxes block has a Mark.
  {
    const steps = stateWith(['# Plan', '', '::: steps', '1. Open the file', ':::'].join('\n'), 'Open')
    assert.equal(setBoxesMark(steps, blockPos(steps), 'number'), null, 'Steps has no Mark')
  }

  // The deck: untouched, a deck with each look saves byte for byte; a Mark changes only its block's line, and one Undo
  // gives the file back.
  for (const mark of BOXES_MARKS) {
    const text = DECK(ICONS.replace(':::: boxes', LINE[mark]))
    const deck = openDeck(text)
    assert.equal(deck.save(deck.state.doc), text, `an untouched deck with ${mark} is the same bytes`)
    for (const other of BOXES_MARKS.filter(other => other !== mark)) {
      const stage = stageOn(deck, 0)
      stage.caretIn('Two')
      stage.apply(setBoxesMark(stage.inner, blockPos(stage.inner), other))
      assert.equal(stage.save(), DECK(ICONS.replace(':::: boxes', LINE[other])), `${mark} → ${other}: the block's line changes, nothing else`)
      stage.undo()
      assert.equal(stage.save(), text, `${mark} → ${other}: one Undo gives the file back`)
    }
  }

  // Number follows the boxes' order through a move, an add and a delete: it is slide.css's counter over the block's
  // boxes, never a number in the file. The rule, then the numbers as that rule draws them.
  const css = readFileSync(new URL('../slide/slide.css', import.meta.url), 'utf8')
  assert.match(css, /\.deck-sl\.is-blocks \.blk-boxes \{[^}]*counter-reset: blk-box;/, 'each Boxes block counts its own boxes from 1')
  assert.match(css, /\.deck-sl\.is-blocks \.blk-box \{ counter-increment: blk-box;/, 'every box counts')
  assert.match(css, /\.deck-sl\.is-blocks \.blk-boxes\[data-look="steps"\] > \.blk-box::before \{ content: counter\(blk-box\);/, 'Number draws the count')
  /** The numbers the rule draws: each `steps` block's boxes, in order, by their heading (or their words). */
  const numbers = (markdown: string): string[] => {
    const body = createDocument(`<body>${blockSlideHtml(markdown)}</body>`).body as unknown as HTMLElement
    const out: string[] = []
    for (const block of Array.from(body.querySelectorAll('.blk-boxes[data-look="steps"]'))) {
      Array.from(block.children).filter(child => child.classList.contains('blk-box')).forEach((box, index) => out.push(`${index + 1} ${(box.querySelector('h3')?.textContent ?? box.textContent ?? '').trim()}`))
    }
    return out
  }
  const NUMBERED = ICONS.replace(':::: boxes', LINE.number)
  assert.deepEqual(numbers(NUMBERED), ['1 One', '2 Two', '3 Three'])
  const text = DECK(NUMBERED)
  const deck = openDeck(text)
  /** The slide's Markdown in a saved deck. */
  const slideOf = (saved: string) => saved.slice(saved.indexOf('---\n', saved.indexOf('id: a1')) + 4, saved.indexOf('\n```\n'))
  assert.equal(slideOf(text), NUMBERED)
  /** The Boxes block's box at `index`, with its place in the slide's document. */
  const boxAt = (doc: PMNode, index: number) => {
    let found: { pos: number; node: PMNode } | null = null
    doc.forEach((block, offset) => {
      if (block.type.name !== 'slideDiv' || found) return
      let seen = 0
      block.forEach((box, inner) => { if (!found && box.type.name === 'slideDiv' && seen++ === index) found = { pos: offset + 1 + inner, node: box } })
    })
    assert.ok(found, `box ${index}`)
    return found as unknown as { pos: number; node: PMNode }
  }
  // A move: the first box after the second, as one step (the step a box's own Move right takes).
  {
    const stage = stageOn(deck, 0)
    stage.caretIn('Two')
    const first = boxAt(stage.inner.doc, 0)
    const second = boxAt(stage.inner.doc, 1)
    stage.apply(stage.inner.tr.insert(second.pos + second.node.nodeSize, first.node).delete(first.pos, first.pos + first.node.nodeSize).setMeta(SLIDE_COMMAND, true))
    const moved = slideOf(stage.save())
    assert.deepEqual(numbers(moved), ['1 Two', '2 One', '3 Three'], `a move: the numbers follow the order\n${moved}`)
    assert.ok(!/^\d/m.test(moved), 'no number is written in the file')
    stage.undo()
    assert.equal(stage.save(), text, 'and one Undo gives the file back')
  }
  // An add: Add's new box is the next number.
  {
    const stage = stageOn(deck, 0)
    stage.caretIn('Two')
    stage.apply(addItem(stage.inner, blockPos(stage.inner)))
    stage.type('Four')
    assert.deepEqual(numbers(slideOf(stage.save())), ['1 One', '2 Two', '3 Three', '4 Four'], 'an add: the new box is number 4')
  }
  // A delete: the boxes after it move up a number.
  {
    const stage = stageOn(deck, 0)
    stage.caretIn('Two')
    const first = boxAt(stage.inner.doc, 0)
    stage.apply(stage.inner.tr.delete(first.pos, first.pos + first.node.nodeSize).setMeta(SLIDE_COMMAND, true))
    assert.deepEqual(numbers(slideOf(stage.save())), ['1 Two', '2 Three'], 'a delete: the numbers close up')
  }

  // The bar: Mark is a menu that shows its value, right after Filled and Outline (before Size), each choice with its
  // word and icon; it is a menu already, so it never folds.
  const barSource = readFileSync(new URL('./SlideBlockBar.tsx', import.meta.url), 'utf8')
  const style = barSource.indexOf('<Group label="Style"')
  const markAt = barSource.indexOf('<Group label="Mark" tip={MARK_MENU_TIP} folded bare={fold >= FOLD_AT.mark} options={BOXES_MARKS.map(')
  const size = barSource.indexOf('<Group label="Size"')
  const boxIcon = barSource.indexOf('{boxIconButton}', markAt)
  assert.ok(style > 0 && markAt > style && boxIcon > markAt && size > boxIcon, 'Style, Mark, box icon, Size')
  assert.ok(!barSource.slice(markAt, boxIcon).includes('<Sep />'), 'Mark and box icon share a group')
  assert.match(barSource.slice(markAt, boxIcon), /pick: \(\) => pickMark\(choice\)/)
  assert.match(barSource, /const MARK_ICON: Record<BoxesMark, PhosphorIconName> = \{ icon: 'smiley', number: 'list-numbers', dot: 'record', arrow: 'arrow-right' \}/)
  // A menu's trigger says its value to a screen reader too ("Mark: Number"), as it shows it; folded to its icon, the
  // accessible name keeps the value.
  assert.match(barSource, /aria-label=\{`\$\{label\}: \$\{current\.label \?\? current\.tip\}`\}/)
  assert.match(barSource, /\{bare && triggerIcon \? null : current\.label\}/)
  assert.match(barSource, /<Tooltip label=\{tip \?\? \(bare \? `\$\{label\}: \$\{current\.label \?\? current\.tip\}` : label\)\}>/)
}

console.log('blockBar: Turn into, Width, Style, Mark, alignment, Columns, the split, Add, Delete, the drag, Tab, the handles and Reveal pass')
