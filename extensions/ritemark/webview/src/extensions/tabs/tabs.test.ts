/**
 * Sprint 163 (PR 2): the Tabs block in the editors. Run with `npx tsx webview/src/extensions/tabs/tabs.test.ts`.
 *
 *  - The file form round trip, byte for byte, through each editor's own pipeline: a Text document, a deck's handout and
 *    a block slide (the slide editor's scoped `marked` and Turndown). Each pane's blocks are ordinary nodes; a tab's
 *    name is its pane's heading line, never a heading node.
 *  - Any other `:::` line in a Text document stays text.
 *  - The band's and the bar's steps: a new block, Add, Rename, Duplicate, Move, Delete tab and ⌘Z, the block dissolving
 *    when one tab is left, Columns ⇄ Tabs and back with ⌘Z, a heading typed at the tabs' level kept one level down,
 *    and where Tabs may go.
 *  - The / menus find Tabs by its hidden words.
 */
import { strict as assert } from 'node:assert'
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state'
import { history, undo } from '@tiptap/pm/history'
import { canonicalMarkdownProjection } from '../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../src/editorSync/frontMatter'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../utils/editorMarkdown'
import { editorMarkdown, installTestDocument, openAndSave, openDocument } from '../../utils/markdownFidelity'
import { DeckSlide } from '../../components/decks/handout/deckSchema'
import { DeckDrawnHeadings } from '../../components/decks/handout/drawnHeadings'
import { loadSlide, saveSlide, slideSchema } from '../../components/decks/blocks/slideEditorHarness'
import { SLIDE_ITEMS } from '../../components/decks/blocks/slideCommands'
import { blockItems, filterSlashItems } from '../blockItems'
import { newTabsetMarkdown } from '../../../../src/decks/blocks/tabset'
import { tabNameOf } from './tabsMarkdown'
import { addTab, canHoldTabs, columnsToTabs, deleteTab, duplicateTab, flattenTabs, hasMisplacedTabs, insertTabsBlock, moveTab, paneSelection, pastedWithoutTabs, renameTab, tabsBlockNode, tabsToColumns } from './tabsCommands'
import { Slice } from '@tiptap/pm/model'

installTestDocument()
ensureCommentMarkedPipeline()

let passed = 0
function test(name: string, run: () => void): void {
  try {
    run()
    passed += 1
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const TABS = [
  '::: {.panel-tabset}',
  '## 1 · Plan',
  '',
  'Change the parts in square brackets before you send it.',
  '',
  '```',
  'You are an analyst. I have added [the report].',
  '```',
  '',
  '## 2 · Collect',
  'Go through the chapters.',
  '',
  '- one',
  '- two',
  '',
  '## 3 · Picture',
  '',
  '![A page of the report](images/report.png)',
  '',
  ':::',
].join('\n')

const TEXT_DOCUMENT = `# Prompts for the training

Some words before the tabs.

${TABS}

## After the tabs

::: note
A Pandoc div that isn't tabs stays text.
:::
`

test('a Text document with a Tabs block opens and saves byte for byte, its other `:::` lines staying text', () => {
  assert.equal(openAndSave(TEXT_DOCUMENT), TEXT_DOCUMENT)
  const doc = openDocument(TEXT_DOCUMENT).doc
  const kinds: string[] = []
  doc.forEach(node => kinds.push(node.type.name))
  assert.deepEqual(kinds, ['heading', 'paragraph', 'tabsBlock', 'heading', 'paragraph'])
  const tabs = doc.child(2)
  assert.deepEqual(Array.from({ length: tabs.childCount }, (_unused, index) => tabNameOf(tabs.child(index).attrs.line)), ['1 · Plan', '2 · Collect', '3 · Picture'])
  assert.deepEqual(Array.from({ length: tabs.child(0).childCount }, (_unused, index) => tabs.child(0).child(index).type.name), ['paragraph', 'codeBlock'])
  assert.equal(tabs.child(2).child(0).type.name, 'image')
  let headings = 0
  doc.descendants(node => { if (node.type.name === 'heading') headings++ })
  assert.equal(headings, 2, 'a tab\'s name is never a heading node')
})

test('opening a Quarto .md that holds a tabset writes nothing: its Markdown read back is the file, byte for byte (the editor publishes a change only when they differ)', () => {
  for (const text of [`${newTabsetMarkdown()}\n`, `Words\n\n${newTabsetMarkdown(['R', 'Python'])}\n`, '::: {.panel-tabset}\n## R\n\n```r\n## not a tab\n```\n\n## Python\n\n```python\nx = 1\n```\n\n:::\n']) {
    assert.equal(openAndSave(text), text)
  }
})

// ---- A deck's handout: the editor's pipeline with the deck's nodes, as the deck view opens it.
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

function openDeck(text: string): { doc: PMNode; save: (doc: PMNode) => string } {
  const split = splitFrontMatter(text)
  const projection = canonicalMarkdownProjection(split.content)
  const doc = PMDOMParser.fromSchema(deckSchema).parse(elementFromString(markdownToEditorHTML(projection)), { preserveWhitespace: 'full' })
  const properties = JSON.parse(JSON.stringify(split.properties))
  return { doc, save: next => joinFrontMatter(properties, editorMarkdown(next), text) }
}

const DECK = `---
deck: 2
handout: text
---

\`\`\`\`slide
# Exercise

${TABS}
\`\`\`\`

## The exercise

${TABS}

\`\`\`slide
# Next
\`\`\`

## Next
`

test('a deck with Tabs in a slide and in its handout opens and saves byte for byte; the handout\'s tabs are a block, its `##` no part', () => {
  const opened = openDeck(DECK)
  assert.equal(opened.save(opened.doc), DECK)
  const kinds: string[] = []
  opened.doc.forEach(node => kinds.push(node.type.name))
  assert.deepEqual(kinds, ['deckSlide', 'heading', 'tabsBlock', 'deckSlide', 'heading'])
})

test('a block slide with Tabs (alone, after a title, in a column) loads and saves byte for byte through the slide editor', () => {
  const cases = [
    TABS,
    `# A long report, in steps\n\n${TABS}`,
    `:::: columns\n::: column\n### A long report\n\n1. Open a new chat\n2. Go through the prompts\n:::\n::: column\n${TABS}\n:::\n::::`,
    newTabsetMarkdown(),
  ]
  for (const markdown of cases) {
    const doc = loadSlide(markdown)
    assert.equal(saveSlide(doc), markdown)
    assert.equal(saveSlide(loadSlide(saveSlide(doc))), markdown, 'a second open is the same')
  }
  const inColumn = loadSlide(cases[2])
  let found = 0
  inColumn.descendants(node => { if (node.type.name === 'tabsBlock') found++ })
  assert.equal(found, 1, 'the Tabs block in the column is the Tabs node, not a plain group')
})

test('typing in a pane changes only that pane\'s lines', () => {
  const doc = loadSlide(TABS)
  let at = -1
  doc.descendants((node, pos) => { if (at < 0 && node.type.name === 'paragraph' && node.textContent === 'Go through the chapters.') at = pos + node.nodeSize - 1; return at < 0 })
  const state = EditorState.create({ schema: slideSchema, doc })
  const next = state.apply(state.tr.insertText(' Then stop.', at)).doc
  assert.equal(saveSlide(next), TABS.replace('Go through the chapters.', 'Go through the chapters. Then stop.'))
})

// ---- The band's and the bar's steps.
function stateOf(markdown: string): EditorState {
  return EditorState.create({ schema: slideSchema, doc: loadSlide(markdown), plugins: [history()] })
}
const firstTabs = (state: EditorState) => {
  let pos = -1
  state.doc.descendants((node, at) => { if (pos < 0 && node.type.name === 'tabsBlock') pos = at; return pos < 0 })
  return pos
}
const apply = (state: EditorState, tr: Transaction | null) => {
  assert.ok(tr, 'the step makes a change')
  return state.apply(tr)
}
const names = (state: EditorState) => {
  const block = state.doc.nodeAt(firstTabs(state))!
  return Array.from({ length: block.childCount }, (_unused, index) => tabNameOf(block.child(index).attrs.line))
}
const save = (state: EditorState) => saveSlide(state.doc)

test('a new block is Tab 1 and Tab 2 and writes Quarto\'s tabset', () => {
  const state = EditorState.create({ schema: slideSchema, doc: slideSchema.nodes.doc.create(null, [tabsBlockNode(slideSchema)]) })
  assert.equal(save(state), newTabsetMarkdown())
})

test('Add, Rename, Duplicate and Move write the tabs\' lines; an empty name or the same one writes nothing', () => {
  let state = stateOf(TABS)
  const pos = firstTabs(state)
  const added = addTab(state, pos)!
  assert.equal(added.index, 3)
  state = apply(state, added.tr)
  assert.deepEqual(names(state), ['1 · Plan', '2 · Collect', '3 · Picture', 'Tab 4'])
  state = apply(state, renameTab(state, pos, 3, 'Write and check'))
  assert.equal(renameTab(state, pos, 3, '   '), null)
  assert.equal(renameTab(state, pos, 3, 'Write and check'), null)
  state = apply(state, duplicateTab(state, pos, 0))
  assert.deepEqual(names(state), ['1 · Plan', '1 · Plan copy', '2 · Collect', '3 · Picture', 'Write and check'])
  state = apply(state, moveTab(state, pos, 1, 4))
  assert.deepEqual(names(state), ['1 · Plan', '2 · Collect', '3 · Picture', 'Write and check', '1 · Plan copy'])
  assert.ok(save(state).includes('## Write and check\n\n:::') === false)
  assert.ok(save(state).endsWith('## 1 · Plan copy\n\nChange the parts in square brackets before you send it.\n\n```\nYou are an analyst. I have added [the report].\n```\n\n:::'))
  assert.equal(loadSlide(save(state)).child(0).childCount, 5, 'the tabs read back as five')
})

test('Delete tab takes the tab and its pane without asking, and ⌘Z brings them back', () => {
  let state = stateOf(TABS)
  const pos = firstTabs(state)
  state = apply(state, deleteTab(state, pos, 1))
  assert.deepEqual(names(state), ['1 · Plan', '3 · Picture'])
  assert.ok(!save(state).includes('Go through the chapters.'))
  let restored: EditorState | null = null
  undo(state, tr => { restored = state.apply(tr) })
  assert.ok(restored)
  assert.equal(save(restored!), TABS)
})

test('with one tab left the block dissolves: that tab\'s blocks stay as ordinary blocks, and ⌘Z brings the block back', () => {
  let state = stateOf(`# Title\n\n${newTabsetMarkdown(['Only', 'Gone'])}`)
  const pos = firstTabs(state)
  const block = state.doc.nodeAt(pos)!
  const paneStart = pos + 2
  const typed = state.tr.insertText('Kept words', paneStart + 1)
  state = apply(state, typed.setSelection(TextSelection.create(typed.doc, 1)))
  assert.equal(block.childCount, 2)
  state = apply(state, deleteTab(state, firstTabs(state), 1))
  assert.equal(firstTabs(state), -1)
  assert.equal(save(state), '# Title\n\nKept words')
  let restored: EditorState | null = null
  undo(state, tr => { restored = state.apply(tr) })
  assert.ok(restored)
  assert.equal(names(restored!).length, 2)
})

const COLUMNS = `# Copilot or Cursor?

:::: columns
::: column
### Copilot
When the work is documents and mail
:::
::: column
### Cursor
- Setting up the intent architecture
- Preparing a sprint
:::
::::`

test('Columns ⇄ Tabs: each column a tab (its heading the name, the rest its pane) and back; ⌘Z undoes it', () => {
  let state = stateOf(COLUMNS)
  let pos = -1
  state.doc.forEach((node, offset) => { if (node.type.name === 'slideDiv') pos = offset })
  state = apply(state, columnsToTabs(state, pos))
  assert.deepEqual(names(state), ['Copilot', 'Cursor'])
  assert.equal(save(state), '# Copilot or Cursor?\n\n::: {.panel-tabset}\n## Copilot\n\nWhen the work is documents and mail\n\n## Cursor\n\n- Setting up the intent architecture\n- Preparing a sprint\n\n:::')
  let undone: EditorState | null = null
  undo(state, tr => { undone = state.apply(tr) })
  assert.equal(save(undone!), COLUMNS)
  state = apply(state, tabsToColumns(state, firstTabs(state)))
  assert.equal(save(state), '# Copilot or Cursor?\n\n:::: columns\n::: column\n### Copilot\nWhen the work is documents and mail\n:::\n\n::: column\n### Cursor\n- Setting up the intent architecture\n- Preparing a sprint\n:::\n::::')
})

test('a heading at the tabs\' level typed in a pane is kept one level down, so it never reads back as a tab', () => {
  const state = EditorState.create({ schema: slideSchema, doc: loadSlide(TABS), plugins: slideSchemaPlugins() })
  let at = -1
  state.doc.descendants((node, pos) => { if (at < 0 && node.type.name === 'paragraph' && node.textContent === 'Go through the chapters.') at = pos; return at < 0 })
  const next = state.applyTransaction(state.tr.setNodeMarkup(at, slideSchema.nodes.heading, { level: 2 })).state
  assert.ok(save(next).includes('### Go through the chapters.'))
  assert.deepEqual(names(next), ['1 · Plan', '2 · Collect', '3 · Picture'])
})

test('Tabs go anywhere a block goes, but never in another Tabs block, a box, Steps or a table cell', () => {
  const inPane = stateOf(TABS)
  assert.equal(canHoldTabs(EditorState.create({ schema: slideSchema, doc: inPane.doc, selection: TextSelection.create(inPane.doc, firstTabs(inPane) + 3) })), false)
  const top = stateOf(`# Title\n\nWords`)
  assert.equal(canHoldTabs(top), true)
  const boxes = stateOf(':::: boxes\n::: box\nA\n:::\n::::')
  assert.equal(canHoldTabs(EditorState.create({ schema: slideSchema, doc: boxes.doc, selection: TextSelection.create(boxes.doc, 3) })), false)
  const flat = flattenTabs(slideSchema, slideSchema.nodes.doc.create(null, [tabsBlockNode(slideSchema, ['A', 'B'])]).content)
  assert.deepEqual(Array.from({ length: flat.childCount }, (_unused, index) => flat.child(index).textContent), ['A', '', 'B', ''])
})

test('the / menus find Tabs by its hidden words, in the slide\'s Blocks group and in the Text editor', () => {
  for (const word of ['tab', 'tabs', 'tabset', 'sakid', 'sakk', 'vahelehed', 'Vahelehed']) {
    assert.ok(filterSlashItems(SLIDE_ITEMS, word).some(item => item.title === 'Tabs'), `the slide's menu, "${word}"`)
    assert.ok(filterSlashItems(blockItems, word).some(item => item.title === 'Tabs'), `the Text editor's menu, "${word}"`)
  }
  // "tab" starts Table's name too, which stands before Tabs in the menu; every longer word is Tabs' alone.
  for (const word of ['tabs', 'tabset', 'sakid', 'sakk', 'vahelehed']) assert.equal(filterSlashItems(SLIDE_ITEMS, word)[0]?.title, 'Tabs')
  assert.equal(SLIDE_ITEMS.find(item => item.title === 'Tabs')?.group, 'Blocks')
})

test('review: the block menu\'s + puts Tabs between top-level blocks; a pane whose first block is a picture keeps the caret in it', () => {
  const state = stateOf('# Title\n\nWords')
  const pending = {}
  const tr = insertTabsBlock(state.tr, state.doc.child(0).nodeSize, pending)
  assert.ok(tr.docChanged, 'a Tabs block is put in at a place between blocks')
  assert.ok(save(state.apply(tr)).includes('::: {.panel-tabset}'))
  const pictured = stateOf(`${'::: {.panel-tabset}'}\n## A\n\n![](images/a.png)\n\n## B\n\nWords\n:::`)
  const pos = firstTabs(pictured)
  const block = pictured.doc.nodeAt(pos)!
  const selection = paneSelection(pictured.doc, pos, 0)!
  assert.ok(selection.from > pos && selection.to < pos + 1 + block.child(0).nodeSize, 'the caret stays in the first pane')
})

test('review: a pasted Tabs block flattened where none may go is a closed slice; a nested one is found', () => {
  const doc = slideSchema.nodes.doc.create(null, [tabsBlockNode(slideSchema, ['A', 'B'])])
  const slice = pastedWithoutTabs(slideSchema, new Slice(doc.content, 3, 3))
  assert.equal(slice.openStart, 0)
  assert.equal(slice.openEnd, 0)
  assert.equal(hasMisplacedTabs(doc), false)
  const nested = slideSchema.nodes.doc.create(null, [tabsBlockNode(slideSchema, ['A', 'B'], [[tabsBlockNode(slideSchema)]])])
  assert.equal(hasMisplacedTabs(nested), true)
})

test('review: a sixth-level heading in a sixth-level Tabs block never loops the editor', () => {
  const markdown = '::: {.panel-tabset}\n###### A\n\nWords\n\n###### B\n:::'
  const state = EditorState.create({ schema: slideSchema, doc: loadSlide(markdown), plugins: slideSchemaPlugins() })
  let at = -1
  state.doc.descendants((node, pos) => { if (at < 0 && node.type.name === 'paragraph') at = pos; return at < 0 })
  const next = state.applyTransaction(state.tr.setNodeMarkup(at, slideSchema.nodes.heading, { level: 6 }))
  assert.ok(next.transactions.length < 5)
})

function slideSchemaPlugins() {
  // The Tabs block's own plugin (the heading rule), as the editors get it from the node.
  const extensions = createEditorSchemaExtensions({})
  const tabs = extensions.find(extension => extension.name === 'tabsBlock')!
  const plugins = (tabs.config.addProseMirrorPlugins as () => unknown[]).call({ name: 'tabsBlock', options: {}, storage: {}, editor: null, type: slideSchema.nodes.tabsBlock, parent: undefined })
  return plugins as never[]
}

console.log(`tabs: ${passed} passed`)
