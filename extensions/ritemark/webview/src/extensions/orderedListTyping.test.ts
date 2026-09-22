/**
 * Sprint 120 (#280) — typing, in a real document.
 *
 * `BoundedOrderedList.test.ts` checks the rule's regex. This file types
 * character by character into a real ProseMirror document built from the
 * editor's own schema, through TipTap's own input-rules plugin, and then saves
 * the result the way the editor saves it. So the assertions are about the
 * document and the file a person would end up with, not about a regex.
 *
 * No DOM is needed: the same fake-editor pattern as
 * `extensions/comment/commentIds.test.ts`.
 *
 * Run with `npx tsx webview/src/extensions/orderedListTyping.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { DOMParser as XmlDOMParser, XMLSerializer } from '@xmldom/xmldom'
import { getSchema, inputRulesPlugin, type Editor } from '@tiptap/core'
import { EditorState, type Transaction } from '@tiptap/pm/state'
import { undoInputRule } from '@tiptap/pm/inputrules'
import { DOMSerializer } from '@tiptap/pm/model'
import { Marked } from 'marked'
import StarterKit from '@tiptap/starter-kit'
import BulletList from '@tiptap/extension-bullet-list'
import ListItem from '@tiptap/extension-list-item'
import { BoundedOrderedList } from './BoundedOrderedList'
import { createTurndownService } from '../utils/turndownService'

const extensions = [
  StarterKit.configure({ bulletList: false, orderedList: false, listItem: false }),
  BulletList,
  ListItem,
  BoundedOrderedList,
]
const schema = getSchema(extensions)
const turndown = createTurndownService()
const editorMarked = new Marked({ breaks: true, gfm: true })

/** The ordered-list input rules exactly as the extension builds them. */
const rules = (
  BoundedOrderedList.config as {
    addInputRules: () => { find: RegExp; handler: unknown }[]
  }
).addInputRules.call({
  options: { itemTypeName: 'listItem', HTMLAttributes: {}, keepMarks: false, keepAttributes: false },
  type: schema.nodes.orderedList,
  editor: { getAttributes: () => ({}) },
} as never)

/**
 * Type `text` into an empty document one character at a time. Each character
 * goes through the input-rules plugin first, exactly as a keystroke does in the
 * browser; when no rule fires, the character is inserted normally.
 */
function type(text: string): EditorState {
  let state: EditorState

  const view = {
    composing: false,
    get state() {
      return state
    },
    dispatch(tr: Transaction) {
      state = state.apply(tr)
    },
  }
  const editor = {
    get state() {
      return state
    },
    view,
    extensionManager: { commands: {}, splittableMarks: [] },
  } as unknown as Editor
  const plugin = inputRulesPlugin({ editor, rules: rules as never })
  const handleTextInput = plugin.props.handleTextInput!

  // The plugin belongs in the state so Backspace (`undoInputRule`) can find the
  // rule it has to undo — the same reason the real editor keeps it there.
  state = EditorState.create({
    schema,
    doc: schema.nodes.doc.create(null, schema.nodes.paragraph.create()),
    plugins: [plugin],
  })

  for (const character of text) {
    const { from, to } = state.selection
    // `insert` is the transaction ProseMirror falls back to when no rule claims
    // the keystroke — it hands the same one to the handler.
    const insert = () => state.tr.insertText(character, from, to)
    const handled = handleTextInput.call(plugin, view as never, from, to, character, insert)
    if (!handled) {
      state = state.apply(insert())
    }
  }

  return state
}

/** The document as the editor would save it: HTML, then Markdown. */
function save(state: EditorState): string {
  const document = new XmlDOMParser().parseFromString('<div></div>', 'text/html')
  const container = document.createElement('div')
  container.appendChild(
    DOMSerializer.fromSchema(schema).serializeFragment(state.doc.content, {
      document: document as unknown as Document,
    }),
  )
  return turndown.turndown(new XMLSerializer().serializeToString(container as never))
}

/** `[nodeType, ...]` for the document's top level, with the list's start. */
function shape(state: EditorState): string[] {
  return state.doc.content.content.map(node =>
    node.type.name === 'orderedList' ? `orderedList(start=${node.attrs.start})` : node.type.name,
  )
}

const textOf = (state: EditorState): string => state.doc.textBetween(0, state.doc.content.size, '\n')

{
  // --- a year stays a sentence, all the way to the file and back
  const typed = type('2026. was a good year for lists.')
  assert.deepEqual(shape(typed), ['paragraph'], 'the paragraph is never wrapped in a list')
  assert.equal(textOf(typed), '2026. was a good year for lists.', 'every character typed is in the text')

  const saved = save(typed)
  assert.ok(saved.startsWith('2026\\.'), `the number is escaped on save, got ${JSON.stringify(saved)}`)
  assert.equal(
    (editorMarked.parse(saved) as string).includes('<ol'),
    false,
    'and it reopens as a paragraph, not a list',
  )
}

{
  // --- a deliberate marker still makes a list, and still saves as one
  for (const [marker, start] of [['1. ', 1], ['5. ', 5], ['99. ', 99]] as const) {
    const typed = type(`${marker}item`)
    assert.deepEqual(shape(typed), [`orderedList(start=${start})`], `${marker.trim()} starts a list`)
    assert.equal(textOf(typed), 'item', 'the marker itself is consumed by the rule')

    const saved = save(typed)
    assert.ok(
      new RegExp(`^${start}\\.\\s+item`).test(saved),
      `${marker.trim()} saves as a real list marker, got ${JSON.stringify(saved)}`,
    )
    assert.ok((editorMarked.parse(saved) as string).includes('<ol'), 'and reopens as a list')
  }
}

{
  // --- the boundary, in a document rather than a regex
  assert.deepEqual(shape(type('99. item')), ['orderedList(start=99)'], '99 is the last marker')
  assert.deepEqual(shape(type('100. item')), ['paragraph'], '100 is already prose')
  assert.deepEqual(shape(type('1999. item')), ['paragraph'], 'a year is prose')
}

{
  // --- Backspace right after a conversion puts the typed marker back, the way
  // it does in the editor. (TipTap's input-rules plugin carries ProseMirror's
  // `isInputRules` flag, so ProseMirror's own `undoInputRule` drives it here.)
  const converted = type('5. ')
  assert.deepEqual(shape(converted), ['orderedList(start=5)'], 'the marker converted first')

  let undone: EditorState = converted
  const handled = undoInputRule(converted, tr => {
    undone = converted.apply(tr)
  })
  assert.equal(handled, true, 'Backspace has something to undo')
  assert.deepEqual(shape(undone), ['paragraph'], 'the list is gone again')
  assert.equal(textOf(undone), '5. ', 'and the marker is back as plain text')
}

{
  // --- a number inside a sentence was never a marker and still is not
  const typed = type('In 2026. we shipped it.')
  assert.deepEqual(shape(typed), ['paragraph'])
  assert.equal(textOf(typed), 'In 2026. we shipped it.')
}

console.log('orderedListTyping.test.ts: all tests passed')
