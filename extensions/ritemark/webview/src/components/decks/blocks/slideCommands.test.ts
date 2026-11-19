/**
 * Sprint 161 (PR 3): the blocks on the slide. The / menu's blocks, New slide below and Split slide here, a box's icon,
 * the Label (Sprint 164 PR 3; the Steps pill it replaces), a table's rows and columns, empty boxes, a converted Section slide and "This slide is full", driven
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
import { convertDeckText } from '../../../../../src/decks/blocks/convertDeck'
import { OPEN_FENCE, withFenceValue } from '../../../../../src/decks/blocks/fencedDiv'
import { blockSlideHtml, isCoverSlide, lexBlockSlide } from '../../../../../src/decks/blocks/slideRenderer'
import { withStepsLabels } from '../../../../../src/decks/blocks/labelBlock'
import { deckDigest, publicDeck } from '../../../../../src/decks/page/publicDeck'
import { pageHtml } from '../../../../../src/decks/page/pageHtml'
import { BUILT_IN_THEME } from '../../../../../src/decks/deckTheme'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../../utils/editorMarkdown'
import { editorHTML, editorMarkdown, installTestDocument } from '../../../utils/markdownFidelity'
import { blockItems, filterSlashItems } from '../../../extensions/blockItems'
import { DeckSlide } from '../handout/deckSchema'
import { DeckDrawnHeadings, drawnHeadingsFollow } from '../handout/drawnHeadings'
import { deckGuardPlugin } from '../handout/deckGuard'
import { deckLinesPlugin } from '../handout/deckLines'
import { convertDeckInto, deckConvertPlugin } from '../handout/deckConvert'
import { derivedHeadings, insertSlide, slidesOf, starterMarkdown } from '../deckDocument'
import { loadSlide, loadSlideWithComments, saveSlide, slideSchema } from './slideEditorHarness'
import { isTitlePlace, saveSlideMarkdown, slidePlaceholderOf } from './slideEditorMarkdown'
import { labelBackspace, labelNode } from './slideLabel'
import { SlideSync } from './slideSync'
import { SLIDE_COMMAND, SLIDE_ITEMS, agendaNode, isOwnStep, withoutEmptyLineAt, cellBelow, insertSlideBlock, pictureNode, setBlockValue, slideBlockNode, slideItemsAt, splitSlideHalves, webPageNode, type SlideBlockKind } from './slideCommands'
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
  // As the stage opens it (`stageMarkdownOf`): a Steps block's old pill as its Label (Sprint 164 PR 3).
  const markdown = withStepsLabels(slideDataOf(entry.kind, entry.node.attrs.body).markdown ?? '')
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
    'Blocks: Columns', 'Blocks: Boxes', 'Blocks: Steps', 'Blocks: Table', 'Blocks: Tabs', 'Blocks: Button', 'Blocks: Agenda', 'Blocks: Label',
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

// ---- Sprint 164 PR 3 (Jarmo's yes by name, 19 November): a new Steps block comes without a Label, whatever the deck's
// earlier pills said; the rule that it took the deck's last label is gone.
{
  const schema = slideSchema
  const plain = slideSave(schema.nodes.doc.create(null, [slideBlockNode(schema, 'steps')]))
  assert.equal(plain, '::: steps\n1.\n:::', 'no tag on its line')
  assert.ok(!blockSlideHtml(plain).includes('blk-label') && !blockSlideHtml(plain).includes('blk-pill'), 'and nothing over its steps')
  // Turned into Steps from the block's bar: no Label either.
  const list = EditorState.create({ doc: loadSlide('- One\n- Two') })
  const turned = turnInto(list, 0, 'steps')!
  assert.equal(slideSave(list.apply(turned).doc), '::: steps\n1. One\n2. Two\n:::')
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

// ---- Sprint 164 PR 3 (the decks README, "Label, a block of its own"): the Label on the stage. Its file form,
// `[words]{.label}` on a line of its own, reads and writes byte for byte, in a column, a box and a tab's pane too; its
// words are plain text; an empty one shows "Label" faint only while the caret is in it, and Backspace takes it away.
{
  const label = (doc: PMNode) => {
    const found: string[] = []
    doc.descendants(node => { if (node.type.name === 'slideLabel') found.push(node.textContent); return true })
    return found
  }
  for (const markdown of [
    '[Exercise · 1 / 2]{.label}\n\n# Try it\n\n::: steps\n1. Open\n:::',
    ':::: columns\n::: column\n[Before]{.label}\n\n### Copilot\n:::\n\n::: column\n[After · 2]{.label}\n:::\n::::',
    ':::: boxes\n::: box\n[Tip]{.label}\n\nOne line\n:::\n::::',
    '# Tabs\n\n::: {.panel-tabset}\n## One\n\n[In a pane]{.label}\n\nWords\n:::',
    '[A \\[b\\] \\*c\\*]{.label}\n\n# Escaped',
    '[Kept #id]{.label #intro}\n\n# Attributes',
    '[]{.label}\n\n# Empty',
    '[Tight]{.label}\n# Under it',
  ]) {
    const doc = loadSlide(markdown)
    assert.ok(label(doc).length > 0, `a Label on the stage: ${markdown}`)
    assert.equal(slideSave(doc), markdown, `byte for byte: ${markdown}`)
    assert.equal(slideSave(loadSlide(slideSave(doc))), markdown, `stable: ${markdown}`)
  }
  assert.deepEqual(label(loadSlide('[A \\[b\\] \\*c\\*]{.label}')), ['A [b] *c*'], 'its words, escapes read')
  // Not a Label: a span inside a paragraph, a link, another class: words, as Pandoc reads them.
  for (const markdown of ['Words\n[x]{.label}', '[x](https://example.com){.label}', '[x]{.tag}', '[x] {.label}']) {
    assert.deepEqual(label(loadSlide(markdown)), [], markdown)
    assert.ok(!blockSlideHtml(markdown).includes('blk-label'), markdown)
  }
  // Typed: its words written as `[words]{.label}`, brackets and marks escaped; the attribute block as it was read.
  let state = EditorState.create({ doc: loadSlide('[Kept]{.label #intro}\n\n# T') })
  state = state.apply(state.tr.insertText(' [now] *', 5))
  assert.equal(slideSave(state.doc), '[Kept \\[now\\] \\*]{.label #intro}\n\n# T')
  assert.ok(blockSlideHtml(slideSave(state.doc)).includes('<div class="blk-label">Kept [now] *</div>'))
  // Typed back to the words it was read with: the line as written.
  state = EditorState.create({ doc: loadSlide('[Odd\\·spacing]{.label}') })
  state = state.apply(state.tr.insertText('x', 2))
  assert.equal(slideSave(state.doc), '[Oxdd\\\\·spacing]{.label}', 'new words: written fresh, a backslash before a non-ASCII mark is a backslash')
  state = state.apply(state.tr.delete(2, 3))
  assert.equal(slideSave(state.doc), '[Odd\\·spacing]{.label}', 'its own words again: its own line again')
  // Text only: no marks, no line break.
  assert.equal(slideSchema.nodes.slideLabel.spec.marks, '')
  assert.equal(slideSchema.nodes.slideLabel.spec.content, 'text*')

  // The / menu's Label: where the / was, empty, the caret in it, an undo step of its own; it shows "Label" faint only
  // while the caret is in it; its words typed are written; one Undo takes the block back.
  const deck = openDeck(DECK)
  const stage = stageOn(deck, 0)
  stage.caretAfter('Three jobs every week')
  stage.apply(stage.inner.tr.split(stage.inner.selection.from))
  const from = stage.inner.selection.from
  stage.apply(stage.inner.tr.insertText('/pill'), true)
  const tr = stage.inner.tr.delete(from, from + 5)
  insertSlideBlock(tr, from, labelNode(stage.inner.schema))
  assert.equal(isOwnStep(tr), true)
  stage.apply(tr)
  assert.equal(stage.inner.selection.$from.parent.type.name, 'slideLabel', 'the caret in the new Label')
  const empty = stage.inner.selection.$from.parent
  assert.equal(slidePlaceholderOf(empty, null, false, true), 'Label', '"Label" faint while the caret is in it')
  assert.equal(slidePlaceholderOf(empty, null, false, false), '', 'nothing while it is elsewhere')
  const added = stage.save()
  assert.ok(added.includes('Three jobs every week\n\n[]{.label}\n```'), added)
  stage.apply(stage.inner.tr.insertText('Workshop'))
  const typed = stage.save()
  assert.ok(typed.includes('Three jobs every week\n\n[Workshop]{.label}\n```'), typed)
  assertStable(typed, 'Label')
  assert.ok(pageHtml(publicDeck(typed, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME }), { slideCss: '', fonts: [] }, { digest: 'x', pictureUrl: () => null }).includes('<div class="blk-label">Workshop</div>'), 'the published page draws it on the slide')
  stage.undo()
  stage.undo()
  assert.equal(stage.save(), DECK, 'Undo takes the words, then the Label, back')

  // Backspace in an empty Label removes it: the caret to the end of the line before it, or to the next line when it was
  // first; the only block of a box leaves its empty line. Anywhere else, the editor's own Backspace.
  const caretIn = (markdown: string, nth = 0) => {
    const doc = loadSlide(markdown)
    let at = -1
    let seen = 0
    doc.descendants((node, pos) => { if (at < 0 && node.type.name === 'slideLabel' && seen++ === nth) at = pos + 1; return at < 0 })
    return EditorState.create({ doc, selection: TextSelection.create(doc, at) })
  }
  let gone = caretIn('# Title\n\n[]{.label}\n\nWords')
  gone = gone.apply(labelBackspace(gone)!)
  assert.equal(slideSave(gone.doc), '# Title\n\nWords')
  assert.equal(gone.selection.$from.parent.textContent, 'Title', 'the caret at the end of the line before it')
  assert.equal(gone.selection.$from.parentOffset, 5)
  let first = caretIn('[]{.label}\n\n# Title')
  first = first.apply(labelBackspace(first)!)
  assert.equal(slideSave(first.doc), '# Title')
  assert.equal(first.selection.$from.parent.textContent, 'Title', 'first: the caret at the start of the line after it')
  let only = caretIn(':::: boxes\n::: box\n[]{.label}\n:::\n::::')
  only = only.apply(labelBackspace(only)!)
  assert.equal(slideSave(only.doc), ':::: boxes\n::: box\n:::\n::::', 'the box keeps its empty line')
  assert.equal(labelBackspace(caretIn('[Words]{.label}')), null, 'a Label with words: the editor\'s own Backspace')

  // The title's place under a Label still says "Title".
  const titled = loadSlide('[Day 1]{.label}\n\n#\n\nWords')
  let titlePos = -1
  titled.forEach((node, offset) => { if (titlePos < 0 && node.type.name === 'heading') titlePos = offset })
  assert.ok(isTitlePlace(titled, titled.nodeAt(titlePos)!, titlePos), 'a heading with only Labels before it is the title')
  assert.ok(!isTitlePlace(loadSlide('Words\n\n# Second'), loadSlide('Words\n\n# Second').child(1), loadSlide('Words\n\n# Second').child(0).nodeSize))

  // An old Steps pill on the stage: it opens as its Label, nothing is written until the person types; the first word
  // typed writes the slide with its Label (and every other slide's pill), as one step; one Undo gives the file back.
  const OLD_PILLS = DECK
    .replace('# Where assistants help\n\nThree jobs every week', '# Where assistants help\n\n::: {.steps tag="Harjutus · 1 / 2"}\n1. Three jobs every week\n:::')
    .replace('# What the pilot taught us\n\nOne', '::: {.steps tag=""}\n1. One\n:::')
  assert.notEqual(OLD_PILLS, DECK)
  const old = openDeck(OLD_PILLS)
  const onStage = stageOn(old, 0)
  assert.deepEqual(label(onStage.inner.doc), ['Harjutus · 1 / 2'], 'the stage shows the pill as its Label')
  assert.equal(onStage.save(), OLD_PILLS, 'opened and left: byte for byte')
  onStage.caretAfter('Three jobs every week')
  onStage.apply(onStage.inner.tr.insertText('!'))
  const migrated = onStage.save()
  assert.ok(migrated.includes('[Harjutus · 1 / 2]{.label}\n\n# Where assistants help\n\n::: steps\n1. Three jobs every week!\n:::'), migrated)
  assert.ok(migrated.includes('---\nid: b2\n---\n::: steps\n1. One\n:::'), 'the emptied pill on the other slide: nothing')
  assert.ok(!migrated.includes('tag='))
  assertStable(migrated, 'migrated pills')
  onStage.undo()
  assert.equal(onStage.save(), OLD_PILLS, 'one Undo: byte for byte')

  // Slides only: a Text document and the deck's handout read the line as the words it is, and write it back as written.
  assert.ok(!deckSchema.nodes.slideLabel, 'the Text editor has no Label node')
  assert.equal(markdownToEditorHTML('[Exercise]{.label}').trim(), '<p>[Exercise]{.label}</p>')
  const handoutDeck = DECK.replace('Ask who has done one.', '[In the handout]{.label}')
  const opened = openDeck(handoutDeck)
  assert.equal(opened.save(opened.state.doc), handoutDeck, 'the handout keeps the line byte for byte')
  let literal = false
  opened.state.doc.descendants(node => { if (node.type.name === 'paragraph' && node.textContent === '[In the handout]{.label}') literal = true; return !literal })
  assert.ok(literal, 'its words, brackets and braces included, are a paragraph of the handout')

  // The / menu finds it by its hidden words, in a column, a box and a tab's pane too; the Text editor has none.
  for (const word of ['label', 'tag', 'badge', 'pill', 'eyebrow', 'silt', 'märgis', 'margis']) {
    assert.ok(filterSlashItems(SLIDE_ITEMS, word).some(item => item.title === 'Label'), `/${word} finds Label`)
  }
  assert.ok(!blockItems.some(item => item.title === 'Label' || item.nodeType === 'label'), 'the Text editor has no Label')
  const inPane = EditorState.create({ doc: loadSlide('::: {.panel-tabset}\n## One\n\nWords\n:::') })
  let paneText = -1
  inPane.doc.descendants((node, pos) => { if (paneText < 0 && node.type.name === 'paragraph') paneText = pos + 1; return paneText < 0 })
  assert.ok(slideItemsAt(inPane.apply(inPane.tr.setSelection(TextSelection.create(inPane.doc, paneText)))).some(item => item.nodeType === 'label'), 'offered in a tab\'s pane')
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

// ---- Sprint 168 PR 2 (the decks README, "Quotes, prompts and heading levels on a slide", item 2): on a slide, Code
// block on words inside a quote takes them out of it as one code block, through the slide's own code block commands
// (the bubble's `toggleCodeBlock`, the / menu's `setCodeBlock`); the Text editor's code block keeps its commands.
{
  const { SlideCodeBlock, CodeBlockWithCopyExtension } = await import('../../../extensions/CodeBlockWithCopyExtension')
  const { getExtensionField } = await import('@tiptap/core')
  type Commands = Record<'toggleCodeBlock' | 'setCodeBlock', (attributes?: Record<string, unknown>) => (props: unknown) => boolean>
  const commandsOf = (extension: typeof SlideCodeBlock): Commands =>
    (getExtensionField(extension, 'addCommands', { name: 'codeBlock', options: extension.options, storage: {}, editor: null as never, type: slideSchema.nodes.codeBlock }) as () => Commands)()
  /** A code block command run as a TipTap chain runs it: on its transaction, today's own path recorded (`toggleNode`, `setNode`). */
  const run = (extension: typeof SlideCodeBlock, name: 'toggleCodeBlock' | 'setCodeBlock', tr: Transaction, dispatch = true) => {
    const today: string[] = []
    const commands = { toggleNode: () => { today.push('toggleNode'); return true }, setNode: () => { today.push('setNode'); return true } }
    const done = commandsOf(extension)[name]()({ tr, state: null, dispatch: dispatch ? () => undefined : undefined, commands })
    return { done, today }
  }
  /** The place just before (or after) `text` on the stage. */
  const placeOf = (doc: PMNode, text: string, after = false) => {
    let at = -1
    doc.descendants((node, pos) => {
      if (at >= 0 || !node.isText) return
      const found = node.text!.indexOf(text)
      if (found >= 0) at = pos + found + (after ? text.length : 0)
    })
    assert.ok(at >= 0, text)
    return at
  }
  const quoteDeck = (slide: string[]) => [
    '---', 'deck: 2', '---', '',
    '```slide', '---', 'id: q1', '---', ...slide, '```', '',
    '## A prompt', '', 'Paste it in.', '',
  ].join('\n')
  const PROMPT_SLIDE = ['# A prompt', '', '> You are an analyst.', '>', '> Write a summary of [the report].', '>', '> Stop there.']
  const QUOTE_DECK = quoteDeck(PROMPT_SLIDE)
  const markdownOf = (stage: ReturnType<typeof stageOn>) => slideDataOf('', slidesOf(stage.outer.doc)[0].node.attrs.body).markdown!
  /** The stage on the prompt slide with `from`…`to` chosen, then the bubble's Code block. */
  const bubbleCode = (text: string, from: string, to: string | null) => {
    const deck = openDeck(text)
    assert.equal(deck.save(deck.state.doc), text, 'an untouched deck with a quote: byte for byte')
    const stage = stageOn(deck, 0)
    const doc = stage.inner.doc
    const selection = TextSelection.create(doc, placeOf(doc, from), to === null ? placeOf(doc, from) : placeOf(doc, to, true))
    const tr = stage.inner.tr.setSelection(selection)
    const { done, today } = run(SlideCodeBlock, 'toggleCodeBlock', tr)
    assert.ok(done, 'Code block ran')
    assert.deepEqual(today, [], "a quote's words never take today's path (a code block nested in the quote)")
    assert.equal(tr.getMeta(SLIDE_COMMAND), true, 'an undo step of its own')
    stage.apply(tr)
    return { deck, stage }
  }

  // The whole quote chosen: the quote goes and one code block stands in its place, its paragraphs a blank line apart.
  {
    const { stage } = bubbleCode(QUOTE_DECK, 'You are', 'Stop there.')
    const markdown = markdownOf(stage)
    assert.equal(markdown, '# A prompt\n\n```\nYou are an analyst.\n\nWrite a summary of [the report].\n\nStop there.\n```', markdown)
    assert.ok(!stage.inner.doc.toString().includes('blockquote'), 'no quote is left')
    assert.equal(saveSlide(loadSlide(markdown)), markdown, "the slide's Markdown reads back as written")
    const saved = stage.save()
    assert.ok(saved.includes('````slide\n'), "the slide's fence grows past the code block's")
    assertStable(saved, 'a quote made a code block')
    // Copy and ↗: drawn as every code block on a slide is.
    const html = blockSlideHtml(markdown)
    assert.ok(html.includes('class="cb-copy"') && html.includes('class="cb-open"'), 'Copy and ↗')
    assert.ok(!html.includes('<blockquote'), html)
    // The selection stays on the same words, now in the code block.
    const { $from, $to } = stage.inner.selection
    assert.equal($from.parent.type.name, 'codeBlock')
    assert.equal(stage.inner.doc.textBetween($from.pos, $to.pos), 'You are an analyst.\n\nWrite a summary of [the report].\n\nStop there.')
    stage.undo()
    assert.equal(stage.save(), QUOTE_DECK, 'one Undo gives the quote back exactly')
  }

  // The caret in the middle paragraph of three: that paragraph becomes the code block, the quote split around it.
  {
    const { stage } = bubbleCode(QUOTE_DECK, 'summary', null)
    const markdown = markdownOf(stage)
    assert.equal(markdown, '# A prompt\n\n> You are an analyst.\n\n```\nWrite a summary of [the report].\n```\n\n> Stop there.', markdown)
    assert.equal(saveSlide(loadSlide(markdown)), markdown, "the slide's Markdown reads back as written")
    assertStable(stage.save(), 'the middle paragraph made a code block')
    const { $from, empty } = stage.inner.selection
    assert.ok(empty && $from.parent.type.name === 'codeBlock' && $from.parent.textContent.slice(0, $from.parentOffset) === 'Write a ', 'the caret stays where it was in the words')
    stage.undo()
    assert.equal(stage.save(), QUOTE_DECK, 'one Undo gives the quote back exactly')
  }

  // Several paragraphs chosen (the first two): one code block holds them; the rest stays a quote under it.
  {
    const { stage } = bubbleCode(QUOTE_DECK, 'are an', 'Write a')
    assert.equal(markdownOf(stage), '# A prompt\n\n```\nYou are an analyst.\n\nWrite a summary of [the report].\n```\n\n> Stop there.')
    stage.undo()
    assert.equal(stage.save(), QUOTE_DECK)
  }

  // A part of the quote with no words goes with it; a quote in a quote is left too; line breaks stay lines.
  {
    const { stage } = bubbleCode(quoteDeck(['# A prompt', '', '> > You are an analyst.  ', '> > Be brief.']), 'You are', null)
    assert.equal(markdownOf(stage), '# A prompt\n\n```\nYou are an analyst.\nBe brief.\n```', 'out of both quotes, its line break a line')
    const deck = openDeck(QUOTE_DECK)
    const inner = stageOn(deck, 0)
    // An empty line typed at the quote's end (Enter after "Stop there."), then the caret back in the words.
    inner.caretAfter('Stop there.')
    inner.apply(inner.inner.tr.split(inner.inner.selection.from))
    const tr = inner.inner.tr.setSelection(TextSelection.create(inner.inner.doc, placeOf(inner.inner.doc, 'Stop')))
    assert.ok(run(SlideCodeBlock, 'toggleCodeBlock', tr).done)
    inner.apply(tr)
    assert.equal(markdownOf(inner), '# A prompt\n\n> You are an analyst.\n>\n> Write a summary of [the report].\n\n```\nStop there.\n```', 'the empty line after it goes, no empty quote is left')
  }

  // A list in the quote keeps its marks as words; a quote in a column stays in its column.
  {
    const LIST = ['# A prompt', '', '> Ask for:', '>', '> 1. risks', '> 2. costs']
    const { stage } = bubbleCode(quoteDeck(LIST), 'Ask', 'costs')
    assert.equal(markdownOf(stage), '# A prompt\n\n```\nAsk for:\n\n1. risks\n2. costs\n```')
    assert.equal(stage.inner.doc.textBetween(stage.inner.selection.from, stage.inner.selection.to), 'Ask for:\n\n1. risks\n2. costs', 'the chosen words stay chosen')
    // Only part of the list chosen (the caret in one item, or two words across items): today's path, so no item the
    // selection left out goes with it. The same for part of a quote in the quote.
    const partly = (lines: string[], from: string, to: string | null) => {
      const doc = stageOn(openDeck(quoteDeck(lines)), 0).inner
      const tr = doc.tr.setSelection(TextSelection.create(doc.doc, placeOf(doc.doc, from), to === null ? placeOf(doc.doc, from) : placeOf(doc.doc, to, true)))
      const result = run(SlideCodeBlock, 'toggleCodeBlock', tr)
      assert.ok(!tr.docChanged, `${from}…${to}: nothing moved by the slide's own step`)
      return result.today
    }
    assert.deepEqual(partly(LIST, 'risks', null), ['toggleNode'], 'the caret in one item')
    assert.deepEqual(partly(LIST, 'Ask', 'risks'), ['toggleNode'], 'the line above and one of two items')
    assert.deepEqual(partly(['# A prompt', '', '> Context first.', '>', '> > One', '> >', '> > Two'], 'Context', 'One'), ['toggleNode'], 'part of a quote in the quote')
    const columns = [':::: columns', '::: column', '> You are an analyst.', '>', '> Stop there.', ':::', '', '::: column', 'Right', ':::', '::::']
    const boxed = bubbleCode(quoteDeck(['# A prompt', '', ...columns]), 'Stop', null).stage
    assert.equal(markdownOf(boxed), ['# A prompt', '', ':::: columns', '::: column', '> You are an analyst.', '', '```', 'Stop there.', '```', ':::', '', '::: column', 'Right', ':::', '::::'].join('\n'), 'the code block stays in its column')
    boxed.undo()
    assert.equal(boxed.save(), quoteDeck(['# A prompt', '', ...columns]))
  }

  // The / menu's Code block on an empty line in the quote: the line out of the quote as an empty code block, the
  // menu's query never written, one Undo for the whole.
  {
    const deck = openDeck(QUOTE_DECK)
    const stage = stageOn(deck, 0)
    stage.caretAfter('You are an analyst.')
    stage.apply(stage.inner.tr.split(stage.inner.selection.from))
    const from = stage.inner.selection.from
    stage.apply(stage.inner.tr.insertText('/code'), true)
    // The menu's chain: the / and its query out, then setCodeBlock, marked as an undo step of its own.
    const tr = stage.inner.tr.delete(from, from + 5)
    assert.ok(run(SlideCodeBlock, 'setCodeBlock', tr).done)
    stage.apply(tr.setMeta(SLIDE_COMMAND, true))
    stage.apply(stage.inner.tr.insertText('Summarise [the report].'))
    assert.equal(markdownOf(stage), '# A prompt\n\n> You are an analyst.\n\n```\nSummarise [the report].\n```\n\n> Write a summary of [the report].\n>\n> Stop there.')
    stage.undo()
    stage.undo()
    assert.equal(stage.save(), QUOTE_DECK, 'the words typed, then the code block: the file as it was before the /')
  }

  // Unchanged: Code block outside a quote, on a code block (it toggles back), on a quote holding a picture, and as
  // TipTap's `can()` (nothing is written). The Text editor's code block takes today's path in a quote too.
  {
    const deck = openDeck(QUOTE_DECK)
    const stage = stageOn(deck, 0)
    const doc = stage.inner.doc
    const outside = stage.inner.tr.setSelection(TextSelection.create(doc, placeOf(doc, 'A prompt')))
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', outside).today, ['toggleNode'], 'outside a quote: as everywhere')
    assert.ok(!outside.docChanged)
    const inQuote = () => stage.inner.tr.setSelection(TextSelection.create(doc, placeOf(doc, 'summary')))
    const asked = inQuote()
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', asked, false), { done: true, today: [] }, 'can(): yes')
    assert.ok(!asked.docChanged, 'can() writes nothing')
    const text = inQuote()
    assert.deepEqual(run(CodeBlockWithCopyExtension as typeof SlideCodeBlock, 'toggleCodeBlock', text).today, ['toggleNode'], "the Text editor's Code block: today's path")
    assert.ok(!text.docChanged)
    const coded = bubbleCode(QUOTE_DECK, 'summary', null).stage
    const back = coded.inner.tr
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', back).today, ['toggleNode'], 'Code block on a code block toggles it back')
    // A quote holding only code, chosen whole by its block bar: toggled back too, its language kept.
    const fenced = stageOn(openDeck(quoteDeck(['# A prompt', '', '> ```text', '> Summarise it.', '> ```'])), 0)
    let fencedAt = -1
    fenced.inner.doc.forEach((node, offset) => { if (node.type.name === 'blockquote') fencedAt = offset })
    const fencedTr = fenced.inner.tr.setSelection(NodeSelection.create(fenced.inner.doc, fencedAt))
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', fencedTr).today, ['toggleNode'], 'a quote of code chosen whole: toggled back')
    assert.ok(!fencedTr.docChanged)
    // A quote holding a picture: its line alone leaves it; the whole quote chosen (its block bar) takes today's path,
    // so the picture is never dropped.
    const pictured = stageOn(openDeck(quoteDeck(['# A prompt', '', '> ![Chart](chart.png)', '>', '> Read it.'])), 0)
    const pictureDoc = pictured.inner.doc
    const line = pictured.inner.tr.setSelection(TextSelection.create(pictureDoc, placeOf(pictureDoc, 'Read')))
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', line).today, [])
    pictured.apply(line)
    assert.equal(markdownOf(pictured), '# A prompt\n\n> ![Chart](chart.png)\n\n```\nRead it.\n```')
    pictured.undo()
    let quoteAt = -1
    pictured.inner.doc.forEach((node, offset) => { if (node.type.name === 'blockquote') quoteAt = offset })
    const whole = pictured.inner.tr.setSelection(NodeSelection.create(pictured.inner.doc, quoteAt))
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', whole).today, ['toggleNode'], 'a picture in the chosen words: today\'s path')
    assert.ok(!whole.docChanged, 'nothing dropped')
    // The quote chosen whole with words only: all of it leaves.
    const chosenQuote = stageOn(openDeck(QUOTE_DECK), 0)
    let wordsAt = -1
    chosenQuote.inner.doc.forEach((node, offset) => { if (node.type.name === 'blockquote') wordsAt = offset })
    const wholeWords = chosenQuote.inner.tr.setSelection(NodeSelection.create(chosenQuote.inner.doc, wordsAt))
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', wholeWords).today, [])
    chosenQuote.apply(wholeWords)
    assert.equal(markdownOf(chosenQuote), '# A prompt\n\n```\nYou are an analyst.\n\nWrite a summary of [the report].\n\nStop there.\n```')
  }

  // The attribution stays with the quote's words (the Experience lead, 19 November), and one Undo gives it all back.
  {
    const SAID = ['# What the team said', '', '> It took ten minutes.', '>', '> Paste the report, then ask.', '>', '> — Team lead']
    // The middle paragraph made code: "— Team lead" joins the words above it, not a quote of its own under the code.
    const middle = bubbleCode(quoteDeck(SAID), 'Paste', null).stage
    assert.equal(markdownOf(middle), '# What the team said\n\n> It took ten minutes.\n>\n> — Team lead\n\n```\nPaste the report, then ask.\n```')
    middle.undo()
    assert.equal(middle.save(), quoteDeck(SAID), 'one Undo, the quote as it was')
    // With an empty line between the code and the attribution, the same.
    const spaced = stageOn(openDeck(quoteDeck(SAID)), 0)
    spaced.caretAfter('then ask.')
    spaced.apply(spaced.inner.tr.split(spaced.inner.selection.from))
    const spacedTr = spaced.inner.tr.setSelection(TextSelection.create(spaced.inner.doc, placeOf(spaced.inner.doc, 'Paste')))
    assert.ok(run(SlideCodeBlock, 'toggleCodeBlock', spacedTr).done)
    spaced.apply(spacedTr)
    assert.equal(markdownOf(spaced), '# What the team said\n\n> It took ten minutes.\n>\n> — Team lead\n\n```\nPaste the report, then ask.\n```')
    // Code from the start of the quote: the part after it keeps its words and its attribution.
    const first = bubbleCode(quoteDeck(SAID), 'took', null).stage
    assert.equal(markdownOf(first), '# What the team said\n\n```\nIt took ten minutes.\n```\n\n> Paste the report, then ask.\n>\n> — Team lead')
    first.undo()
    assert.equal(first.save(), quoteDeck(SAID))
    // Everything but the attribution made code: "— Team lead" stays, a quote of one line; nothing goes by itself.
    const allWords = bubbleCode(quoteDeck(SAID), 'It took', 'then ask.').stage
    assert.equal(markdownOf(allWords), '# What the team said\n\n```\nIt took ten minutes.\n\nPaste the report, then ask.\n```\n\n> — Team lead')
    allWords.undo()
    assert.equal(allWords.save(), quoteDeck(SAID))
    // An en dash is an attribution too, and so is a dash before a no-break space; a hyphen or no dash is not.
    const en = bubbleCode(quoteDeck(SAID.map(line => line.replace('— ', '– '))), 'Paste', null).stage
    assert.equal(markdownOf(en), '# What the team said\n\n> It took ten minutes.\n>\n> – Team lead\n\n```\nPaste the report, then ask.\n```')
    const nbsp = bubbleCode(quoteDeck(SAID.map(line => line.replace('— ', '—\u00a0'))), 'Paste', null).stage
    assert.ok(markdownOf(nbsp).includes('> It took ten minutes.\n>\n> —'), markdownOf(nbsp))
    const hyphen = bubbleCode(quoteDeck(SAID.map(line => line.replace('— ', '\\- '))), 'Paste', null).stage
    assert.equal(markdownOf(hyphen), '# What the team said\n\n> It took ten minutes.\n\n```\nPaste the report, then ask.\n```\n\n> \\- Team lead')
    const plain = bubbleCode(quoteDeck(SAID.map(line => line.replace('— ', ''))), 'Paste', null).stage
    assert.equal(markdownOf(plain), '# What the team said\n\n> It took ten minutes.\n\n```\nPaste the report, then ask.\n```\n\n> Team lead')
    // An empty line after the attribution, or between the words and the code: the attribution still goes right under
    // the words, and the empty lines around the code go.
    const trailing = stageOn(openDeck(quoteDeck(SAID)), 0)
    trailing.caretAfter('Team lead')
    trailing.apply(trailing.inner.tr.split(trailing.inner.selection.from))
    const trailingTr = trailing.inner.tr.setSelection(TextSelection.create(trailing.inner.doc, placeOf(trailing.inner.doc, 'Paste')))
    assert.ok(run(SlideCodeBlock, 'toggleCodeBlock', trailingTr).done)
    trailing.apply(trailingTr)
    assert.equal(markdownOf(trailing), '# What the team said\n\n> It took ten minutes.\n>\n> — Team lead\n\n```\nPaste the report, then ask.\n```')
    const gap = stageOn(openDeck(quoteDeck(SAID)), 0)
    gap.caretAfter('ten minutes.')
    gap.apply(gap.inner.tr.split(gap.inner.selection.from))
    const gapTr = gap.inner.tr.setSelection(TextSelection.create(gap.inner.doc, placeOf(gap.inner.doc, 'Paste')))
    assert.ok(run(SlideCodeBlock, 'toggleCodeBlock', gapTr).done)
    gap.apply(gapTr)
    assert.equal(markdownOf(gap), '# What the team said\n\n> It took ten minutes.\n>\n> — Team lead\n\n```\nPaste the report, then ask.\n```')
    gap.undo()
    gap.undo()
    assert.equal(gap.save(), quoteDeck(SAID), 'the empty line, then the code block: the quote as it was')
  }

  // Rounds two and three of the review: a code block's language stays; a list whose last item is empty still counts
  // as chosen whole; a quote of code with an empty line, chosen whole, comes out; a selection made backwards stays so.
  {
    const TEXT_CODE = ['# A prompt', '', '> Context first.', '>', '> ```text', '> Summarise it.', '> ```']
    const kept = stageOn(openDeck(quoteDeck(TEXT_CODE)), 0)
    const keptTr = kept.inner.tr.setSelection(TextSelection.create(kept.inner.doc, placeOf(kept.inner.doc, 'Context'), placeOf(kept.inner.doc, 'Summarise it.', true)))
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', keptTr).today, [])
    kept.apply(keptTr)
    assert.equal(markdownOf(kept), '# A prompt\n\n```text\nContext first.\n\nSummarise it.\n```', 'its language stays')
    const two = ['# A prompt', '', '> ```text', '> One', '> ```', '>', '> ```python', '> two()', '> ```']
    const twoStage = stageOn(openDeck(quoteDeck(two)), 0)
    const twoTr = twoStage.inner.tr.setSelection(TextSelection.create(twoStage.inner.doc, placeOf(twoStage.inner.doc, 'One'), placeOf(twoStage.inner.doc, 'two()', true)))
    // All code: toggled back, as before; and with a line of words among two languages, today's path too.
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', twoTr).today, ['toggleNode'])
    // A line of words and two languages: one code block out of the quote, with no language (neither fits both).
    const mixed = stageOn(openDeck(quoteDeck(['# A prompt', '', '> Both:', '>', ...two.slice(2)])), 0)
    const mixedTr = mixed.inner.tr.setSelection(TextSelection.create(mixed.inner.doc, placeOf(mixed.inner.doc, 'Both'), placeOf(mixed.inner.doc, 'two()', true)))
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', mixedTr).today, [])
    mixed.apply(mixedTr)
    assert.equal(markdownOf(mixed), '# A prompt\n\n```\nBoth:\n\nOne\n\ntwo()\n```')

    const listed = stageOn(openDeck(quoteDeck(['# A prompt', '', '> Ask for:', '>', '> 1. risks', '> 2. costs'])), 0)
    listed.caretAfter('costs')
    listed.apply(listed.inner.tr.split(listed.inner.selection.from, 2))
    assert.equal(markdownOf(listed).split('\n').length, 7, markdownOf(listed))
    const listedTr = listed.inner.tr.setSelection(TextSelection.create(listed.inner.doc, placeOf(listed.inner.doc, 'Ask'), placeOf(listed.inner.doc, 'costs', true)))
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', listedTr).today, [], 'an empty last item: the list still chosen whole')
    listed.apply(listedTr)
    assert.equal(markdownOf(listed), '# A prompt\n\n```\nAsk for:\n\n1. risks\n2. costs\n```', 'and no mark without words')

    const spacer = stageOn(openDeck(quoteDeck(['# A prompt', '', '> ```text', '> Summarise it.', '> ```'])), 0)
    let codeEnd = -1
    spacer.inner.doc.descendants((node, pos) => { if (node.type.name === 'codeBlock') codeEnd = pos + node.nodeSize; return true })
    spacer.apply(spacer.inner.tr.insert(codeEnd, spacer.inner.schema.nodes.paragraph.create()))
    let spacerAt = -1
    spacer.inner.doc.forEach((node, offset) => { if (node.type.name === 'blockquote') spacerAt = offset })
    const spacerTr = spacer.inner.tr.setSelection(NodeSelection.create(spacer.inner.doc, spacerAt))
    // Code and an empty line chosen whole: the code leaves the quote with its language; the empty line goes.
    assert.deepEqual(run(SlideCodeBlock, 'toggleCodeBlock', spacerTr).today, [])
    spacer.apply(spacerTr)
    assert.equal(markdownOf(spacer), '# A prompt\n\n```text\nSummarise it.\n```')

    const back = stageOn(openDeck(QUOTE_DECK), 0)
    const backTr = back.inner.tr.setSelection(TextSelection.create(back.inner.doc, placeOf(back.inner.doc, 'Write a', true), placeOf(back.inner.doc, 'You')))
    assert.ok(run(SlideCodeBlock, 'toggleCodeBlock', backTr).done)
    back.apply(backTr)
    const { anchor, head } = back.inner.selection
    assert.ok(head < anchor, 'still backwards')
    assert.equal(back.inner.doc.textBetween(head, anchor), 'You are an analyst.\n\nWrite a')
  }
}

console.log('slideCommands: passed')
