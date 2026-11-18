/**
 * Sprint 161 (PR 3): the blocks on the slide. The / menu's blocks, New slide below and Split slide here, a box's icon,
 * the Steps pill, a table's rows and columns, empty boxes, a converted Section slide and "This slide is full", driven
 * the way the stage drives them: the slide editor's document on its own schema and pipeline (`slideEditorHarness`), the
 * slide's sync (`SlideSync`), and the deck as the deck view's editor holds it, with its history, guard, drawn headings
 * and conversion, saved through the editor's own Markdown pipeline.
 * Run with `npx tsx webview/src/components/decks/blocks/slideCommands.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState, NodeSelection, Plugin, TextSelection, type Transaction } from '@tiptap/pm/state'
import { AGENDA_TIP, BAR_KINDS, BAR_KIND_LABEL, addItem, chosenBlockAt, deleteBlock, turnInto } from './blockBar'
import { closeHistory, history, undo } from '@tiptap/pm/history'
import { canonicalMarkdownProjection } from '../../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../../src/editorSync/frontMatter'
import { partHeadingLevel, slideDataOf, withBlockMarkdown, withPartHeading, withWrittenHandout } from '../../../../../src/decks/deckFormat'
import { convertDeckText, withStepsTag } from '../../../../../src/decks/blocks/convertDeck'
import { withFenceValue } from '../../../../../src/decks/blocks/fencedDiv'
import { blockSlideHtml, isCoverSlide, lexBlockSlide, stepsTagOf } from '../../../../../src/decks/blocks/slideRenderer'
import { parseFenceAttributes, OPEN_FENCE } from '../../../../../src/decks/blocks/fencedDiv'
import { deckDigest, publicDeck } from '../../../../../src/decks/page/publicDeck'
import { pageHtml } from '../../../../../src/decks/page/pageHtml'
import { BUILT_IN_THEME } from '../../../../../src/decks/deckTheme'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../../utils/editorMarkdown'
import { editorHTML, editorMarkdown, installTestDocument } from '../../../utils/markdownFidelity'
import { blockItems } from '../../../extensions/blockItems'
import { DeckSlide } from '../handout/deckSchema'
import { DeckDrawnHeadings, drawnHeadingsFollow } from '../handout/drawnHeadings'
import { deckGuardPlugin } from '../handout/deckGuard'
import { deckLinesPlugin } from '../handout/deckLines'
import { convertDeckInto, deckConvertPlugin } from '../handout/deckConvert'
import { derivedHeadings, insertSlide, slidesOf, starterMarkdown } from '../deckDocument'
import { loadSlide, loadSlideWithComments, saveSlide, slideSchema } from './slideEditorHarness'
import { saveSlideMarkdown, slidePlaceholderOf } from './slideEditorMarkdown'
import { SlideSync } from './slideSync'
import { SLIDE_COMMAND, SLIDE_ITEMS, agendaNode, isOwnStep, lastPillLabel, withoutEmptyLineAt, cellBelow, insertSlideBlock, pictureNode, setBlockValue, setStepsTag, slideBlockNode, splitSlideHalves, webPageNode, type SlideBlockKind } from './slideCommands'
import { splitSlide } from './slideSplit'
import { webPageAddress } from './SlideBlockTools'
import { isFullAt, nextFitStep } from './slideFit'
import { TABLE_COMMAND, alignColumn, deleteColumn, deleteRow, insertColumn, insertRow, moveColumn, moveRow, nextCellOrNewRow, sortByColumn, tableAt } from '../../../extensions/tables/tableOps'

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
const deckPlugins = () => [history(), deckGuardPlugin(), deckLinesPlugin(), drawnPlugin(), deckConvertPlugin()]

/** The deck as the deck view's editor opens it, and its save (front matter as it was). */
function openDeck(text: string) {
  const split = splitFrontMatter(text)
  const doc = PMDOMParser.fromSchema(deckSchema).parse(elementFromString(markdownToEditorHTML(canonicalMarkdownProjection(split.content))), { preserveWhitespace: 'full' })
  const properties = JSON.parse(JSON.stringify(split.properties))
  let state = EditorState.create({ doc, plugins: deckPlugins() })
  const drawn = derivedHeadings(state)
  if (drawn) state = state.apply(drawn)
  return { state, save: (next: PMNode) => joinFrontMatter(properties, editorMarkdown(next), text) }
}

/** Saved, opened again and saved: the same bytes. */
function assertStable(text: string, label: string) {
  const again = openDeck(text)
  assert.equal(again.save(again.state.doc), text, `${label}: byte-stable on the next open`)
}

const slideSave = (doc: PMNode) => saveSlideMarkdown(doc, editorHTML(doc), loadSlide)

/**
 * The stage on slide `index` of a deck: the slide editor's state, its sync, and the write SlideEditor makes (an own
 * undo step for a block, as `SLIDE_COMMAND` asks; the conversion first in a deck of today's slides).
 */
function stageOn(deck: ReturnType<typeof openDeck>, index: number) {
  let outer = deck.state
  const entry = slidesOf(outer.doc)[index]
  const markdown = slideDataOf(entry.kind, entry.node.attrs.body).markdown ?? ''
  let inner = EditorState.create({ doc: loadSlide(markdown) })
  const sync = new SlideSync(loadSlide, slideSave, markdown, inner.doc)
  const write = (ownStep: boolean) => {
    const next = sync.toWrite(inner.doc)
    if (next === null) { sync.settled(inner.doc); return }
    const tr = outer.tr
    if (ownStep) closeHistory(tr)
    convertDeckInto(tr)
    const current = slidesOf(outer.doc)[index]
    const pos = tr.mapping.map(current.pos)
    const node = tr.doc.nodeAt(pos)!
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, body: withBlockMarkdown(node.attrs.body, next) })
    sync.wrote(next, inner.doc)
    outer = outer.apply(tr)
  }
  return {
    get inner() { return inner },
    get outer() { return outer },
    set outer(state: EditorState) { outer = state },
    /** A change on the stage; written unless held (the / menu's query). */
    apply(tr: Transaction, held = false) {
      inner = inner.apply(tr)
      sync.track(tr)
      if (!held) write(isOwnStep(tr))
    },
    caretAfter(text: string) {
      let at = -1
      inner.doc.descendants((node, pos) => {
        if (at >= 0 || !node.isText) return
        const found = node.text!.indexOf(text)
        if (found >= 0) at = pos + found + text.length
      })
      assert.ok(at >= 0, text)
      inner = inner.apply(inner.tr.setSelection(TextSelection.create(inner.doc, at)))
    },
    undo() { undo(outer, tr => { outer = outer.apply(tr) }) },
    save: () => deck.save(outer.doc),
  }
}

const DECK = [
  '---', 'deck: 2', 'handout: text', '---', '',
  '```slide', '---', 'id: a1', '---', '# Where assistants help', '', 'Three jobs every week', '```', '',
  '## Where assistants help', '', 'Ask who has done one.', '',
  '```slide', '---', 'id: b2', '---', '# What the pilot taught us', '', 'One', '', 'Two', '', 'Three', '```', '',
  '## What the pilot taught us', '', 'Six weeks.', '',
].join('\n')

// ---- The menu (frame 22): its groups and shortcuts; the Text editor's own menu is unchanged.
{
  assert.deepEqual(SLIDE_ITEMS.map(item => `${item.group}: ${item.title}${item.shortcut ? ` ${item.shortcut}` : ''}`), [
    'Text: Title #', 'Text: Heading ##', 'Text: Bullet list -', 'Text: Numbered list 1.', 'Text: Code block ```',
    'Blocks: Columns', 'Blocks: Boxes', 'Blocks: Steps', 'Blocks: Table', 'Blocks: Agenda',
    'Media: Picture', 'Media: Web page',
    'Slides: New slide below', 'Slides: Split slide here ***',
  ])
  assert.ok(blockItems.every(item => item.group === undefined && item.shortcut === undefined), "the Text editor's items have no groups")
}

// ---- Every / insertion: where the / was, one undo step that gives the file back as it was before the /, and
// byte-stable on the next open. The / and its query are never written (the menu holds them).
const EXPECTED: Record<SlideBlockKind, string> = {
  columns: ':::: columns\n::: column\n:::\n\n::: column\n:::\n::::',
  boxes: ':::: boxes\n::: box\n:::\n\n::: box\n:::\n\n::: box\n:::\n::::',
  steps: '::: steps\n1.\n:::',
  table: '|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |',
}
for (const kind of ['columns', 'boxes', 'steps', 'table'] as SlideBlockKind[]) {
  const deck = openDeck(DECK)
  const stage = stageOn(deck, 0)
  stage.caretAfter('Three jobs every week')
  // Enter, then `/col` typed: an empty line under the words, the menu's query on it (held, never written).
  stage.apply(stage.inner.tr.split(stage.inner.selection.from))
  const before = stage.save()
  assert.equal(before, DECK, 'an empty line writes nothing')
  const from = stage.inner.selection.from
  stage.apply(stage.inner.tr.insertText('/col'), true)
  // The menu's choice: the query out, the block in, one transaction marked as a block.
  const tr = stage.inner.tr.delete(from, from + 4)
  insertSlideBlock(tr, from, slideBlockNode(stage.inner.schema, kind))
  assert.equal(tr.getMeta(SLIDE_COMMAND), true)
  stage.apply(tr)
  const saved = stage.save()
  const markdown = slideDataOf('', slidesOf(stage.outer.doc)[0].node.attrs.body).markdown!
  assert.ok(!saved.includes('/col'), `${kind}: the query never reaches the file`)
  if (kind === 'table') {
    // A valid GFM table: three columns, a header and two rows, read back as a table by the slide's own reader.
    const table = lexBlockSlide(markdown).find(token => token.type === 'table') as { header: unknown[]; rows: unknown[][] } | undefined
    assert.ok(table && table.header.length === 3 && table.rows.length === 2, `${kind}: ${markdown}`)
  } else {
    assert.equal(markdown, `# Where assistants help\n\nThree jobs every week\n\n${EXPECTED[kind]}`, kind)
  }
  assert.equal(saveSlide(loadSlide(markdown)), markdown, `${kind}: the slide's Markdown reads back as written`)
  assertStable(saved, kind)
  stage.undo()
  assert.equal(stage.save(), DECK, `${kind}: one Undo gives the file back`)
}

// Text items and the typing before a block: the block is its own undo step, the words typed before it stay.
{
  const deck = openDeck(DECK)
  const stage = stageOn(deck, 0)
  stage.caretAfter('Three jobs every week')
  stage.apply(stage.inner.tr.insertText(' or two'))
  const typed = stage.save()
  assert.ok(typed.includes('Three jobs every week or two'))
  stage.apply(stage.inner.tr.split(stage.inner.selection.from))
  const from = stage.inner.selection.from
  stage.apply(stage.inner.tr.insertText('/ti'), true)
  // Title (#): the line as an H1, as the menu's chain sets it.
  const tr = stage.inner.tr.delete(from, from + 3).insertText('Next', from).setBlockType(from, from, stage.inner.schema.nodes.heading, { level: 1 }).setMeta(SLIDE_COMMAND, true)
  stage.apply(tr)
  assert.ok(stage.save().includes('Three jobs every week or two\n\n# Next'), stage.save())
  assertStable(stage.save(), 'Title')
  stage.undo()
  assert.equal(stage.save(), typed, 'one Undo takes the Title back and keeps the words typed before it')
}

// The Web page item: a link to the page on its own line; the address only http(s).
{
  const stage = stageOn(openDeck(DECK), 0)
  stage.caretAfter('Three jobs every week')
  stage.apply(stage.inner.tr.split(stage.inner.selection.from))
  const at = stage.inner.selection.from
  stage.apply(insertSlideBlock(stage.inner.tr, at, webPageNode(stage.inner.schema, 'https://example.com/guide')))
  assert.ok(stage.save().includes('Three jobs every week\n\n[https://example.com/guide](https://example.com/guide)\n```'), stage.save())
  assertStable(stage.save(), 'web page')
  stage.undo()
  assert.equal(stage.save(), DECK)
  assert.equal(webPageAddress('example.com/a'), 'https://example.com/a')
  assert.equal(webPageAddress('http://example.com'), 'http://example.com')
  for (const refused of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 'two words', '']) assert.equal(webPageAddress(refused), null, refused)
}

// The Picture item: the saved picture where the / was, written as its path beside the deck (never the webview's URI).
{
  const stage = stageOn(openDeck(DECK), 0)
  stage.caretAfter('Three jobs every week')
  stage.apply(stage.inner.tr.split(stage.inner.selection.from))
  const at = stage.inner.selection.from
  stage.apply(insertSlideBlock(stage.inner.tr, at, pictureNode(stage.inner.schema, 'images/chart.png', 'https://file+.vscode-resource.vscode-cdn.net/x/images/chart.png')))
  const saved = stage.save()
  assert.ok(saved.includes('Three jobs every week\n\n![](images/chart.png)\n```'), saved)
  assert.ok(!saved.includes('vscode-resource'))
  assertStable(saved, 'picture')
}

// ---- Review of #769: a block chosen in a table cell goes after the table (a Markdown cell holds one line), and one
// chosen on an empty title goes after it (the title stays); a host and its port is a web address.
{
  const inTable = EditorState.create({ doc: loadSlide('# Plan\n\n| A | B |\n| --- | --- |\n|  | x |') })
  let cell = -1
  inTable.doc.descendants((node, pos) => { if (cell < 0 && node.type.name === 'tableCell') cell = pos + 2; return cell < 0 })
  for (const kind of ['boxes', 'table'] as SlideBlockKind[]) {
    const tr = insertSlideBlock(inTable.tr, cell, slideBlockNode(inTable.schema, kind))
    const saved = slideSave(tr.doc)
    assert.ok(saved.startsWith('# Plan\n\n| A | B |\n| --- | --- |\n| | x |\n\n'), `${kind} after the table: ${saved}`)
    assert.equal(lexBlockSlide(saved).filter(token => token.type === 'table').length, kind === 'table' ? 2 : 1)
  }
  const titled = EditorState.create({ doc: loadSlide('') })
  const emptyTitle = titled.doc.type.schema.nodes.doc.create(null, [titled.schema.nodes.heading.create({ level: 1 })])
  const state = EditorState.create({ doc: emptyTitle })
  const tr = insertSlideBlock(state.tr, 1, slideBlockNode(state.schema, 'boxes'))
  assert.equal(tr.doc.firstChild?.type.name, 'heading', 'the empty title stays')
  assert.equal(tr.doc.child(1).type.name, 'slideDiv', 'the block under it')
  // A brace in a typed pill can't end the {…} block: the block stays a block.
  const braced = withFenceValue('::: steps', 'tag', 'a}b')!
  assert.equal(braced, '::: {.steps tag="a｝b"}')
  assert.equal(OPEN_FENCE.test(braced), true)
  assert.equal(webPageAddress('localhost:3000'), 'https://localhost:3000')
  assert.equal(webPageAddress('example.com:8080/x'), 'https://example.com:8080/x')
  assert.equal(webPageAddress('mailto:a@b.com'), null, 'no credentials in a page address')
  assert.equal(webPageAddress('https://user:pw@example.com'), null)
}

// ---- Codex on #769: a row Enter adds, a split and a new slide are undo steps of their own, never joined to the typing
// just before them on the same slide.
{
  const table = EditorState.create({ doc: loadSlide('# Plan\n\n| A | B |\n| --- | --- |\n| x | y |') })
  let last = -1
  table.doc.descendants((node, pos) => { if (node.isText && node.text === 'y') last = pos + 1; return true })
  const down = cellBelow(table.apply(table.tr.setSelection(TextSelection.create(table.doc, last))))!
  assert.equal(down.getMeta(SLIDE_COMMAND), true, 'a new row is its own step')
  const deck = openDeck(DECK)
  const entry = slidesOf(deck.state.doc)[1]
  const typed = deck.state.apply(deck.state.tr.setNodeMarkup(entry.pos, undefined, { ...entry.node.attrs, body: entry.node.attrs.body.replace('Three', 'Three!') }))
  for (const op of ['split', 'new'] as const) {
    const tr = op === 'split'
      ? splitSlide(typed, 1, '# What the pilot taught us\n\nOne', 'Two\n\nThree!', () => 0.4, true)!
      : insertSlide(typed, 2, '', () => 0.4, true)!
    const after = typed.apply(tr)
    let undone = after
    undo(after, back => { undone = after.apply(back) })
    assert.equal(deck.save(undone.doc), deck.save(typed.doc), `${op}: one Undo takes only it back; the typing stays`)
  }
}

// ---- Split slide here from the menu on the empty line (or list item) the / stood on: that line is in neither half
// (the final app run left an empty `-` at the first half's end).
{
  const listed = EditorState.create({ doc: loadSlide('# T\n\n- a\n- b\n-\n- c') })
  let at = -1
  listed.doc.descendants((node, pos) => { if (node.type.name === 'listItem' && node.textContent === '' && at < 0) at = pos + 2; return true })
  const cut = withoutEmptyLineAt(listed, at)
  const halves = splitSlideHalves(cut.state, cut.pos)
  assert.equal(slideSave(halves.before), '# T\n\n- a\n- b')
  assert.equal(slideSave(halves.after), '- c')
  const lined = EditorState.create({ doc: loadSlide('# T\n\nOne\n\nTwo') })
  const withEmpty = lined.apply(lined.tr.split(lined.doc.child(1).nodeSize + lined.doc.child(0).nodeSize - 1))
  let empty = -1
  withEmpty.doc.forEach((node, pos) => { if (node.type.name === 'paragraph' && !node.textContent) empty = pos + 1 })
  const top = withoutEmptyLineAt(withEmpty, empty)
  const parts = splitSlideHalves(top.state, top.pos)
  assert.equal(slideSave(parts.before), '# T\n\nOne')
  assert.equal(slideSave(parts.after), 'Two')
  assert.equal(withoutEmptyLineAt(lined, 3).state, lined, 'a line with words stays')
}

// ---- The lead on #769: a new Columns block starts empty, each column an empty heading over an empty line ("Heading"
// over "Text" faint on the stage); none of it is written, and it reopens the same.
{
  const columns = slideBlockNode(slideSchema, 'columns')
  const shape = (node: PMNode) => { const out: string[] = []; node.descendants(child => { out.push(`${child.type.name}${child.textContent ? ':' + child.textContent : ''}`); return true }); return out.join(' ') }
  assert.equal(shape(columns), 'slideDiv heading paragraph slideDiv heading paragraph', 'two empty columns')
  const doc = slideSchema.nodes.doc.create(null, [columns])
  const saved = slideSave(doc)
  assert.equal(saved, ':::: columns\n::: column\n:::\n\n::: column\n:::\n::::', 'no placeholder words in the file')
  const reopened = loadSlide(saved)
  assert.equal(shape(reopened), shape(doc), 'it reopens the same')
  assert.equal(slideSave(reopened), saved)
  assert.equal(slidePlaceholderOf(columns.child(0).child(0), columns.child(0), false), 'Heading')
  assert.equal(slidePlaceholderOf(columns.child(0).child(1), columns.child(0), false), 'Text')
  assert.equal(slidePlaceholderOf(columns.child(0).child(1), null, true), 'Title')
  assert.equal(slidePlaceholderOf(columns.child(0).child(1), null, false), '')
  // A column with words of its own is never given the empty heading.
  assert.equal(shape(loadSlide(':::: columns\n::: column\nWords\n:::\n::::')), 'slideDiv:Words slideDiv:Words paragraph:Words text:Words', 'no empty heading added')
}

// ---- The lead on #769: a new Steps block carries the deck's last pill label, written as its own tag; with none it shows
// "Exercise" (#752's rule) and writes no tag.
{
  const deck = [
    { kind: 'exercise', tag: 'Harjutus' },
    { kind: '', markdown: '# Two\n\n::: steps\n1. A\n:::' },
    { kind: '', markdown: '# Three\n\n```\n::: {.steps tag="In code"}\n```' },
  ]
  assert.equal(lastPillLabel(deck), 'Harjutus', 'the last label written in words of its own')
  assert.equal(lastPillLabel([...deck, { kind: '', markdown: '::: {.steps tag="Ülesanne"}\n1. B\n:::' }]), 'Ülesanne')
  assert.equal(lastPillLabel([{ kind: '', markdown: '::: {.steps tag=""}\n1. B\n:::' }]), null, 'a hidden pill is no label')
  assert.equal(lastPillLabel([{ kind: 'exercise' }, { kind: '', markdown: '# No steps' }]), null)
  const schema = slideSchema
  const carried = slideSave(schema.nodes.doc.create(null, [slideBlockNode(schema, 'steps', 'Harjutus')]))
  assert.equal(carried, '::: {.steps tag="Harjutus"}\n1.\n:::')
  assert.equal(/<span class="blk-pill">([^<]*)</.exec(blockSlideHtml(carried))?.[1], 'Harjutus')
  const plain = slideSave(schema.nodes.doc.create(null, [slideBlockNode(schema, 'steps', null)]))
  assert.equal(plain, '::: steps\n1.\n:::', 'no label: no tag, the pill shows "Exercise"')
  assert.equal(/<span class="blk-pill">([^<]*)</.exec(blockSlideHtml(plain))?.[1], 'Exercise')
}

// ---- Empty boxes survive save and reopen (PR 2's gap: a new Boxes slide's boxes dropped out at its first write).
{
  const boxes = starterMarkdown('boxes')
  assert.equal(slideSave(loadSlide(boxes)), boxes, 'three empty boxes save as they were')
  const deck = openDeck(DECK)
  const made = insertSlide(deck.state, 2, 'boxes', () => 0.3, true)!
  const withSlide = { ...deck, state: deck.state.apply(made) }
  const stage = stageOn(withSlide, 2)
  // The title typed on the new slide: its first write keeps the boxes.
  stage.apply(stage.inner.tr.insert(0, stage.inner.schema.nodes.heading.create({ level: 1 }, stage.inner.schema.text('Four tools'))))
  const saved = stage.save()
  assert.ok(saved.includes('# Four tools\n\n:::: boxes\n::: box\n:::\n::: box\n:::\n::: box\n:::\n::::'), saved)
  assertStable(saved, 'empty boxes')
  const reopened = openDeck(saved)
  assert.equal((slideDataOf('', slidesOf(reopened.state.doc)[2].node.attrs.body).markdown!.match(/^::: box$/gm) ?? []).length, 3, 'three boxes after reopening')
}

// ---- A box's icon: the picker writes that box's opening line only.
{
  const markdown = '# Tools\n\n:::: boxes\n::: {.box icon="mail"}\n### Mail\n:::\n::: box\n### Files\n:::\n::: {#keep .box icon="globe" note="x"}\n### Web\n:::\n::::'
  let state = EditorState.create({ doc: loadSlide(markdown) })
  const boxes: number[] = []
  state.doc.descendants((node, pos) => { if (node.type.name === 'slideDiv' && String(node.attrs.open).includes('box')) boxes.push(pos); return true })
  const lines = (text: string) => text.split('\n')
  const changed = (a: string, b: string) => lines(a).filter((line, index) => line !== lines(b)[index])
  // The second box gets an icon.
  let tr = setBlockValue(state, boxes[2], 'icon', 'lightbulb')!
  state = state.apply(tr)
  let saved = slideSave(state.doc)
  assert.deepEqual(changed(saved, markdown), ['::: {.box icon="lightbulb"}'], 'only that line changes')
  // The third, with an id and another value, keeps them.
  tr = setBlockValue(state, boxes[3], 'icon', 'target')!
  state = state.apply(tr)
  saved = slideSave(state.doc)
  assert.ok(saved.includes('::: {#keep .box icon="target" note="x"}'), saved)
  // No icon: the bare form again.
  state = state.apply(setBlockValue(state, boxes[2], 'icon', null)!)
  assert.ok(slideSave(state.doc).includes('\n::: box\n### Files'), slideSave(state.doc))
  assert.equal(setBlockValue(state, boxes[1], 'icon', 'mail'), null, 'the same icon writes nothing')
  assert.equal(withFenceValue(':::: {.boxes look="steps"}', 'look', 'line'), ':::: {.boxes look="line"}', 'the colons are kept')
  assert.equal(withFenceValue('   ::: box', 'icon', 'a"b'), `   ::: {.box icon='a"b'}`, 'the indent kept; a quote in the value')
}

// ---- The Steps pill (#752's rule): a missing tag shows "Exercise", an empty one none, a written one is kept; the words
// typed in place are its tag, and words it shows already write nothing. Emptied, Settings' Label row brings it back.
{
  const pill = (markdown: string) => /<span class="blk-pill">([^<]*)<\/span>/.exec(blockSlideHtml(markdown))?.[1] ?? null
  const missing = '# Try it\n\n::: steps\n1. Open\n:::'
  const written = '# Try it\n\n::: {.steps tag="Harjutus"}\n1. Open\n:::'
  const empty = '# Try it\n\n::: {.steps tag=""}\n1. Open\n:::'
  assert.equal(pill(missing), 'Exercise')
  assert.equal(pill(written), 'Harjutus')
  assert.equal(pill(empty), null, 'an empty tag: no pill')
  for (const markdown of [missing, written, empty]) assert.equal(slideSave(loadSlide(markdown)), markdown, 'each reads back as written')

  const stepsAt = (state: EditorState) => {
    let at = -1
    state.doc.descendants((node, pos) => { if (at < 0 && node.type.name === 'slideDiv') at = pos; return at < 0 })
    return at
  }
  let state = EditorState.create({ doc: loadSlide(missing) })
  assert.equal(setStepsTag(state, stepsAt(state), 'Exercise'), null, 'the default as typed writes no tag')
  // Typed in place: other words.
  state = state.apply(setStepsTag(state, stepsAt(state), 'Harjutus 1')!)
  assert.equal(slideSave(state.doc), '# Try it\n\n::: {.steps tag="Harjutus 1"}\n1. Open\n:::')
  // Emptied: tag="" and the pill hides.
  const emptied = setStepsTag(state, stepsAt(state), '')!
  assert.notEqual(emptied.getMeta(SLIDE_COMMAND), true, 'typed in the pill: it joins the typing, not an undo step of its own')
  state = state.apply(emptied)
  const saved = slideSave(state.doc)
  assert.equal(saved, empty)
  assert.equal(pill(saved), null, 'emptying it hides the pill')
  assert.equal(stepsTagOf(parseFenceAttributes(OPEN_FENCE.exec('::: {.steps tag=""}')![2])!), '')
  // Settings' Label row brings it back.
  assert.equal(pill(withStepsTag(saved, 'Exercise')), 'Exercise')
  assert.equal(pill(withStepsTag(saved, 'Harjutus')), 'Harjutus')
}

// ---- Tables: the + bars (experience 48, in place of Settings' Add a row and Add a column) write valid Markdown
// tables; Enter goes to the cell below.
{
  const markdown = '# Plan\n\n| Who | What |\n| --- | --- |\n| Ann | Mail |'
  let state = EditorState.create({ doc: loadSlide(markdown) })
  const read = (text: string) => lexBlockSlide(text).find(token => token.type === 'table') as { header: { text: string }[]; rows: { text: string }[][] }
  let tablePos = -1
  state.doc.descendants((node, pos) => { if (node.type.name === 'table') tablePos = pos; return tablePos < 0 })
  const height = () => tableAt(state.doc, tablePos)!.node.childCount
  const width = () => tableAt(state.doc, tablePos)!.node.firstChild!.childCount
  const row = insertRow(state, tablePos, height())!
  assert.equal(row.getMeta(TABLE_COMMAND), true, 'an undo step of its own')
  state = state.apply(row)
  let saved = slideSave(state.doc)
  assert.equal(read(saved).rows.length, 2, saved)
  assert.equal(read(saved).header.length, 2)
  state = state.apply(insertColumn(state, tablePos, width())!)
  saved = slideSave(state.doc)
  const table = read(saved)
  assert.equal(table.header.length, 3, saved)
  assert.ok(table.rows.every(cells => cells.length === 3), 'every row has the new column')
  assert.equal(table.rows[0][0].text, 'Ann', 'the words stay where they were')
  assert.equal(slideSave(loadSlide(saved)), saved, 'reads back as written')
  assert.equal(insertRow(EditorState.create({ doc: loadSlide('# No table') }), 0, 1), null, 'no table there: nothing')

  // Enter in a row: the cell below, in the same column; in the last row, a new row under it.
  let at = -1
  state.doc.descendants((node, pos) => { if (node.isText && node.text === 'Mail') at = pos + 4; return at < 0 })
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, at)))
  const rowsBefore = read(slideSave(state.doc)).rows.length
  state = state.apply(cellBelow(state)!)
  assert.equal(read(slideSave(state.doc)).rows.length, rowsBefore, 'the cell below: no new row')
  const column = (current: EditorState) => current.selection.$from.index(current.selection.$from.depth - 2)
  assert.equal(column(state), 1, 'in the same column')
  state = state.apply(cellBelow(state)!)
  assert.equal(read(slideSave(state.doc)).rows.length, rowsBefore + 1, 'a new row under the last')
  assert.equal(column(state), 1)
  assert.equal(state.selection.$from.parent.textContent, '', 'the caret is in the new row')
  assert.equal(cellBelow(EditorState.create({ doc: loadSlide('# Plan') })), null, 'outside a table: Enter is the editor\'s')
}

// ---- Experience 48: the table's handles on a slide in a deck. Each change, made after typing on the slide, is written to
// the deck as an undo step of its own (`isOwnStep`): one Undo takes it back and keeps the typing; the deck reads back
// byte for byte.
{
  const TABLE_DECK = [
    '---', 'deck: 1', 'handout: text', '---', '',
    '```slide', '---', 'id: t1', '---', '# Chat, add-in or Work', '', '| Tool | Files |', '| --- | :-- |', '| Work | The folder |', '| Chat | Uploaded |', '```', '',
    '## Chat, add-in or Work', '', 'Compare them.', '',
  ].join('\n')
  const ops: [string, (state: EditorState, pos: number) => Transaction | null][] = [
    ['the right + bar', (state, pos) => insertColumn(state, pos, 2, 0)],
    ['the bottom + bar', (state, pos) => insertRow(state, pos, 3, 0)],
    ['Move down', (state, pos) => moveRow(state, pos, 1, 2)],
    ['Move right', (state, pos) => moveColumn(state, pos, 0, 1)],
    ['Align right', (state, pos) => alignColumn(state, pos, 0, 'right')],
    ['Sort A to Z', (state, pos) => sortByColumn(state, pos, 0, 'asc')],
    ['Delete column', (state, pos) => deleteColumn(state, pos, 1)],
    ['Delete row', (state, pos) => deleteRow(state, pos, 1)],
    ['Insert above the header', (state, pos) => insertRow(state, pos, 0, 0)],
    ['Tab in the last cell', state => nextCellOrNewRow(state)],
  ]
  for (const [label, make] of ops) {
    const stage = stageOn(openDeck(TABLE_DECK), 0)
    stage.caretAfter('Uploaded')
    stage.apply(stage.inner.tr.insertText(' file'))
    const typed = stage.save()
    let tablePos = -1
    stage.inner.doc.descendants((node, pos) => { if (node.type.name === 'table') tablePos = pos; return tablePos < 0 })
    const tr = make(stage.inner, tablePos)!
    assert.ok(tr && isOwnStep(tr), `${label}: an undo step of its own`)
    stage.apply(tr)
    const saved = stage.save()
    assert.notEqual(saved, typed, `${label}: a change`)
    const markdown = slideDataOf('', slidesOf(stage.outer.doc)[0].node.attrs.body).markdown!
    const table = lexBlockSlide(markdown).find(token => token.type === 'table') as { header: unknown[]; rows: unknown[][] } | undefined
    assert.ok(table && table.rows.every(row => row.length === table.header.length), `${label}: a valid table\n${markdown}`)
    assertStable(saved, label)
    stage.undo()
    assert.equal(stage.save(), typed, `${label}: one Undo takes it back and keeps the words typed before it`)
  }
}

// ---- Split slide here: the words before the caret stay, the rest is a new slide below; one Undo gives the slide back
// whole; byte-stable. At the end of a line the line stays whole; in the middle of a line, the line is split.
{
  const deck = openDeck(DECK)
  const stage = stageOn(deck, 1)
  stage.caretAfter('One')
  const halves = splitSlideHalves(stage.inner, stage.inner.selection.from)
  const before = slideSave(halves.before)
  const after = slideSave(halves.after)
  assert.equal(before, '# What the pilot taught us\n\nOne')
  assert.equal(after, 'Two\n\nThree')
  const tr = splitSlide(deck.state, 1, before, after, () => 0.7, true)!
  const split = deck.state.apply(tr)
  const saved = deck.save(split.doc)
  const slides = slidesOf(split.doc)
  assert.equal(slides.length, 3)
  assert.equal(slideDataOf('', slides[1].node.attrs.body).markdown, before)
  assert.equal(slideDataOf('', slides[2].node.attrs.body).markdown, after)
  assert.equal(slideDataOf('', slides[1].node.attrs.body).id, 'b2', 'the slide keeps its id')
  assert.ok(saved.includes('Six weeks.\n\n```slide\n---\nid: '), 'the new slide after the part, its handout kept with the first half')
  assertStable(saved, 'split')
  let undone = split
  undo(split, back => { undone = split.apply(back) })
  assert.equal(deck.save(undone.doc), DECK, 'one Undo')

  // In the middle of a line.
  const middle = EditorState.create({ doc: loadSlide('# T\n\nOne Two') })
  let pos = -1
  middle.doc.descendants((node, at) => { if (node.isText && node.text === 'One Two') pos = at + 4; return pos < 0 })
  const cut = splitSlideHalves(middle, pos)
  assert.equal(slideSave(cut.before), '# T\n\nOne')
  assert.equal(slideSave(cut.after), 'Two')
  // In a list: the list in two.
  const list = EditorState.create({ doc: loadSlide('# T\n\n1. a\n2. b\n3. c') })
  list.doc.descendants((node, at) => { if (node.isText && node.text === 'b') pos = at + 1; return true })
  const lists = splitSlideHalves(list, pos)
  assert.equal(slideSave(lists.before), '# T\n\n1. a\n2. b')
  assert.equal(slideSave(lists.after), '1. c')
  // At the start of the title: everything goes; at the very end: an empty new slide.
  const start = splitSlideHalves(middle, 1)
  assert.equal(slideSave(start.before), '')
  assert.equal(slideSave(start.after), '# T\n\nOne Two')
  assert.equal(slideSave(splitSlideHalves(middle, middle.doc.content.size - 1).after), '')
  // A comment on the block after the cut goes with it.
  const noted = EditorState.create({ doc: loadSlideWithComments('# T\n\nOne\n\n<!-- {id:11111111-1111-4111-8111-111111111111} on two -->\n\nTwo') })
  noted.doc.descendants((node, at) => { if (node.isText && node.text === 'One') pos = at + 3; return true })
  const withNote = splitSlideHalves(noted, pos)
  assert.equal(withNote.before.lastChild?.type.name, 'paragraph', 'the note left the first half')
  assert.equal(withNote.after.firstChild?.type.name, 'commentNode', 'and opens the second, on its block')
}

// Split in a deck of today's slides: the conversion and the split in one step, one Undo for both.
{
  const OLD = ['---', 'deck: 1', '---', '', '```slide points', 'id: p1', 'title: Steps', 'items:', '- heading: Sisend', '- heading: Väljund', '```', '', 'Handout.', ''].join('\n')
  const deck = openDeck(OLD)
  const tr = splitSlide(deck.state, 0, '# Steps\n\n1. Sisend', '1. Väljund', () => 0.2, false)!
  const split = deck.state.apply(tr)
  assert.deepEqual(slidesOf(split.doc).map(slide => slide.kind), ['', ''])
  let undone = split
  undo(split, back => { undone = split.apply(back) })
  assert.equal(deck.save(undone.doc), OLD, 'one Undo: the old deck, byte for byte')
}

// ---- New slide below: an empty block slide after the part; one Undo; byte-stable.
{
  const deck = openDeck(DECK)
  const below = deck.state.apply(insertSlide(deck.state, 1, '', () => 0.9, true)!)
  const saved = deck.save(below.doc)
  const slides = slidesOf(below.doc)
  assert.equal(slides.length, 3)
  assert.equal(slides[1].kind, '')
  assert.equal(slideDataOf('', slides[1].node.attrs.body).markdown, '', 'empty: its title waits for words')
  assertStable(saved, 'new slide below')
  let undone = below
  undo(below, back => { undone = below.apply(back) })
  assert.equal(deck.save(undone.doc), DECK)
}

// ---- A v1 Section slide converts to a section slide, with or without a number: title-only, `section` in its header,
// drawn big and low, its band on the page and its H1 in the handout; no number, no numeral.
{
  const v1 = (number: string | null) => ['---', 'deck: 1', '---', '',
    '```slide section', 'id: s1', ...(number ? [`number: "${number}"`] : []), 'title: Why agents?', '```', '', 'Section text.', '',
    '```slide points', 'id: p2', 'title: Next', '```', '', 'More.', ''].join('\n')
  for (const number of ['2', null]) {
    const converted = convertDeckText(withWrittenHandout(v1(number)))
    const data = slideDataOf('', /```slide\n([\s\S]*?)\n```/.exec(converted)![1])
    assert.equal(data.section, true, 'the header says section')
    assert.equal(data.markdown, number ? `${number}\n\n# Why agents?` : '# Why agents?', 'title-only, with its number when it has one')
    assert.ok(isCoverSlide(data.markdown!), 'drawn big and low')
    if (!number) assert.ok(!/<p>/.test(blockSlideHtml(data.markdown!)), 'no number: no numeral drawn')
    // The handout's H1.
    assert.ok(converted.includes('```\n\n# Why agents?\n\nSection text.'), converted)
    assert.equal(partHeadingLevel('', data), 1)
    assert.equal(withPartHeading('', data, ''), '# Why agents?', 'a part made for it opens with an H1')
    // The page: the band, with "Section" and its number or none.
    const deck = publicDeck(converted, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME })
    const html = pageHtml(deck, { slideCss: '', fonts: [] }, { digest: deckDigest(deck), pictureUrl: () => null })
    assert.equal((html.match(/<section class="part sect"/g) ?? []).length, 1, `the band (${number ?? 'no number'})`)
    assert.ok(html.includes(number ? `<div class="eyebrow">Section ${number}</div>` : '<div class="eyebrow">Section</div>'), html.slice(0, 0))
    // The deck view draws its part's heading as an H1 once converted (a deck whose handout isn't written yet).
    const view = openDeck(convertDeckText(v1(number)))
    let level = 0
    view.state.doc.forEach(node => { if (!level && node.type.name === 'heading') level = node.attrs.level })
    assert.equal(level, 1, 'the drawn heading is an H1')
  }
  assert.equal(partHeadingLevel('', { section: false }), 2)
  assert.equal(partHeadingLevel(''), 2)
}

// ---- "This slide is full" shows only at the floor: a slide that fits at a smaller step never says so.
{
  const fits = (limit: number) => (step: number) => ({ content: 1000 - step * 100, room: limit })
  const neverFits = fits(100)
  const step = nextFitStep(0, neverFits)
  assert.equal(step, 5)
  assert.equal(isFullAt(step, neverFits(step)), true, 'at the floor and still past the edge: full')
  const fitsAtThree = fits(700)
  const three = nextFitStep(0, fitsAtThree)
  assert.equal(three, 3)
  assert.equal(isFullAt(three, fitsAtThree(three)), false, 'smaller words fit: not full')
  assert.equal(isFullAt(5, { content: 500, room: 540 }), false, 'at the floor but fitting: not full')
}

// ---- Privacy: a converted Section slide's header mark is the only thing that goes out with it; no words, no id.
{
  const converted = convertDeckText(['```slide section', 'id: s1', 'title: Intro', 'subtitle: SECRETSUB', '```', '', 'Text.', ''].join('\n'))
  const out = JSON.stringify(publicDeck(converted, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME }))
  assert.ok(!out.includes('SECRETSUB') && !out.includes('"s1"'), out)
}

// ---- Small details 14: /Agenda writes one block, `::: agenda` and `:::`, where the / was, as one undo step; the
// list is never written, and the file reads back byte for byte.
{
  const deck = openDeck(DECK)
  const stage = stageOn(deck, 0)
  stage.caretAfter('Three jobs every week')
  stage.apply(stage.inner.tr.split(stage.inner.selection.from))
  const from = stage.inner.selection.from
  stage.apply(stage.inner.tr.insertText('/agen'), true)
  const tr = stage.inner.tr.delete(from, from + 5)
  insertSlideBlock(tr, from, agendaNode(stage.inner.schema))
  assert.equal(tr.getMeta(SLIDE_COMMAND), true, 'the Agenda is an undo step of its own')
  stage.apply(tr)
  const saved = stage.save()
  const markdown = slideDataOf('', slidesOf(stage.outer.doc)[0].node.attrs.body).markdown!
  assert.equal(markdown, '# Where assistants help\n\nThree jobs every week\n\n::: agenda\n:::', 'only the block\'s lines are written')
  assert.ok(!saved.includes('/agen'), 'the query never reaches the file')
  // Everything else in the file is as it was: only the block's two lines (and the blank line before them) are new.
  assert.equal(saved, DECK.replace('Three jobs every week\n```', 'Three jobs every week\n\n::: agenda\n:::\n```'))
  assert.equal(saveSlide(loadSlide(markdown)), markdown, "the slide's Markdown reads back as written")
  assertStable(saved, 'Agenda')
  stage.undo()
  assert.equal(stage.save(), DECK, 'one Undo takes the Agenda back')
}

// ---- The Agenda is one piece in the editor (18 November): chosen whole, its bar the type and Delete, never typed in;
// words written inside it by hand stay in the file, unshown, byte for byte.
{
  const text = DECK.replace('Three jobs every week\n```', 'Three jobs every week\n\n::: agenda\nWritten by hand\n:::\n```')
  const deck = openDeck(text)
  assert.equal(deck.save(deck.state.doc), text, 'opened and saved: byte for byte, the words inside it too')
  const stage = stageOn(deck, 0)
  const doc = stage.inner.doc
  assert.ok(!doc.textContent.includes('Written by hand'), 'its words are not on the stage')
  let at = -1
  doc.forEach((node, offset) => { if (node.type.name === 'slideAgenda') at = offset })
  assert.ok(at >= 0 && doc.nodeAt(at)!.isAtom, 'one piece: an atom, nothing to type in')
  const chosen = chosenBlockAt(stage.inner.apply(stage.inner.tr.setSelection(NodeSelection.create(doc, at))))
  assert.equal(chosen?.kind, 'agenda', 'the bar is for it')
  assert.equal(BAR_KIND_LABEL.agenda, 'Agenda')
  assert.equal(AGENDA_TIP, "Lists this deck's sections")
  assert.ok(!BAR_KINDS.includes('agenda'), 'nothing turns into an Agenda')
  assert.equal(turnInto(stage.inner, at, 'boxes'), null, 'and it turns into nothing')
  assert.equal(addItem(stage.inner, at), null, 'no Add')
  stage.apply(deleteBlock(stage.inner, at)!)
  assert.equal(stage.save(), DECK, 'Delete takes the block and its words, nothing else')
  stage.undo()
  assert.equal(stage.save(), text, 'one Undo brings it back as it was written')
}

// Sprint 163 PR 1: a code block on a slide. A deck that holds one (in the slide's longer fence, with a place to fill
// in) opens and saves byte for byte; / → Code block on the stage writes an ordinary fenced block, the slide's fence
// grows to hold it, and the file is stable on the next open; one Undo takes the block back.
{
  const prompt = 'Summarise [the report] for the board & stop.'
  const text = [
    '---', 'deck: 2', '---', '',
    '````slide', '---', 'id: c1', '---', '# Plan', '', '```text', prompt, '```', '````', '',
    '## Plan', '', 'Copy the prompt.', '',
  ].join('\n')
  const deck = openDeck(text)
  assert.equal(deck.save(deck.state.doc), text, 'a deck with a code block on a slide: byte for byte')
  assertStable(text, 'a code block on a slide')
  const stage = stageOn(deck, 0)
  stage.caretAfter('Plan')
  stage.apply(stage.inner.tr.insertText(' it'))
  const edited = stage.save()
  assert.equal(edited, text.replace('# Plan\n', '# Plan it\n'), 'an edit beside it changes only its own words')

  const plain = openDeck(DECK)
  const typed = stageOn(plain, 0)
  typed.caretAfter('Three jobs every week')
  typed.apply(typed.inner.tr.split(typed.inner.selection.from))
  const at = typed.inner.selection.from
  const item = SLIDE_ITEMS.find(entry => entry.nodeType === 'codeBlock')!
  assert.equal(item.title, 'Code block')
  // The menu's choice, as SlideEditor's runItem makes it: the line set as a code block, an undo step of its own.
  const tr = typed.inner.tr.setBlockType(at, at, typed.inner.schema.nodes.codeBlock).setMeta(SLIDE_COMMAND, true)
  typed.apply(tr)
  typed.apply(typed.inner.tr.insertText('Write [one line]'))
  const saved = typed.save()
  const markdown = slideDataOf('', slidesOf(typed.outer.doc)[0].node.attrs.body).markdown!
  assert.equal(markdown, '# Where assistants help\n\nThree jobs every week\n\n```\nWrite [one line]\n```', markdown)
  assert.ok(saved.includes('````slide\n---\nid: a1\n---\n# Where assistants help'), 'the slide\'s fence grows past the code block\'s')
  assertStable(saved, 'a new code block')
  assert.ok(blockSlideHtml(markdown).includes('<mark class="cb-fill">[one line]</mark>'), 'drawn with its place marked')
}

console.log('slideCommands: passed')
