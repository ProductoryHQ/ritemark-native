/**
 * Sprint 126 (#332) — Shift+End must not escape the text block.
 *
 * The bug was that `Shift+End` selected from the caret to the end of the
 * DOCUMENT, so the next Delete wiped every block below the caret. The browser is
 * what produced that head position; the clamp is what makes it harmless. These
 * tests feed the clamp the exact head the browser produced — the end of the
 * document — against a real ProseMirror document built from the editor's own
 * schema, and assert on the text a person would actually have selected.
 *
 * No DOM is needed: the clamp is a pure function over ProseMirror positions.
 * The visual-line half of the feature (`Selection.modify`) is DOM-only and is
 * covered by the dev-build hand check recorded in the sprint's QA evidence.
 *
 * Run with `npx tsx webview/src/extensions/selectionBoundary.test.ts`.
 */
import assert from 'node:assert/strict'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import { TextSelection } from '@tiptap/pm/state'
import { keydownHandler } from '@tiptap/pm/keymap'
import type { Node as PMNode } from '@tiptap/pm/model'
import {
  clampHeadToTextblock,
  textblockBounds,
  textblockHead,
} from './SelectionBoundaryKeys'

const schema = getSchema([
  StarterKit.configure({ bulletList: false, orderedList: false, listItem: false }),
  BulletList,
  ListItem,
  OrderedList,
])

const { doc: docNode, paragraph, heading, orderedList, listItem, codeBlock } = schema.nodes

/** Jarmo's repro document: `# Reopen check` / `Start here.` / a paragraph / a list. */
function reproDoc(): PMNode {
  return docNode.create(null, [
    heading.create({ level: 1 }, schema.text('Reopen check')),
    paragraph.create(null, schema.text('Start here.')),
    paragraph.create(null, schema.text('A second paragraph.')),
    orderedList.create(null, [
      listItem.create(null, paragraph.create(null, schema.text('one'))),
      listItem.create(null, paragraph.create(null, schema.text('two'))),
    ]),
  ])
}

/** The position just inside the start of the Nth top-level block. */
function startOfBlock(doc: PMNode, index: number): number {
  let pos = 0
  doc.forEach((_node, offset, i) => {
    if (i === index) {
      pos = offset + 1
    }
  })
  return pos
}

/** What a person would end up having selected. */
function selectedText(doc: PMNode, anchor: number, head: number): string {
  return doc.textBetween(Math.min(anchor, head), Math.max(anchor, head), '\n')
}

// --- the bug itself -------------------------------------------------------

{
  const doc = reproDoc()
  const anchor = startOfBlock(doc, 1) // start of "Start here."
  const browserHead = doc.content.size // what Chrome's Shift+End actually produced

  assert.equal(
    selectedText(doc, anchor, browserHead),
    'Start here.\nA second paragraph.\none\ntwo',
    'precondition: the unclamped head really does select the rest of the document',
  )

  const head = clampHeadToTextblock(doc, anchor, browserHead)
  assert.equal(head, anchor + 'Start here.'.length)
  assert.equal(
    selectedText(doc, anchor, head!),
    'Start here.',
    'Shift+End selects the current paragraph and nothing below it',
  )
}

// Shift+Home is the same bug pointing the other way.
{
  const doc = reproDoc()
  const anchor = startOfBlock(doc, 2) + 'A second'.length // mid "A second paragraph."
  const head = clampHeadToTextblock(doc, anchor, 0) // browser: start of document

  assert.equal(head, startOfBlock(doc, 2))
  assert.equal(
    selectedText(doc, anchor, head!),
    'A second',
    'Shift+Home selects back to the paragraph start, not the document start',
  )
}

// --- the visual-line case the clamp must NOT interfere with ---------------

{
  const doc = reproDoc()
  const anchor = startOfBlock(doc, 2)
  // A wrapped paragraph's first visual line ends inside the block. The browser
  // reports that position and the clamp has to leave it exactly alone.
  const visualLineEnd = anchor + 'A second'.length

  assert.equal(
    clampHeadToTextblock(doc, anchor, visualLineEnd),
    visualLineEnd,
    'a head inside the text block passes through untouched',
  )
}

// --- idempotence ----------------------------------------------------------

{
  const doc = reproDoc()
  const anchor = startOfBlock(doc, 1)
  const once = clampHeadToTextblock(doc, anchor, doc.content.size)!
  const twice = clampHeadToTextblock(doc, anchor, once)!
  assert.equal(twice, once, 'pressing Shift+End again does not grow the selection')
}

// --- the selection stays a valid, anchored TextSelection ------------------

{
  const doc = reproDoc()
  const anchor = startOfBlock(doc, 1) + 'Start '.length
  const head = clampHeadToTextblock(doc, anchor, doc.content.size)!
  const selection = TextSelection.create(doc, anchor, head)

  assert.equal(selection.anchor, anchor, 'the anchor is preserved — this extends, not replaces')
  assert.equal(selection.head, head)
  assert.equal(doc.textBetween(selection.from, selection.to), 'here.')
}

// --- block types other than paragraph -------------------------------------

{
  // A list item's paragraph is its own text block: Shift+End inside "one" must
  // not reach into "two".
  const doc = reproDoc()
  const list = startOfBlock(doc, 3)
  const anchor = list + 2 // inside the first item's paragraph
  const head = clampHeadToTextblock(doc, anchor, doc.content.size)!

  assert.equal(selectedText(doc, anchor, head), 'one', 'selection stays inside the list item')
}

{
  // A code block holds real newlines; the clamp stops at the block, and the
  // visual-line step (not exercised here) is what picks a single line inside it.
  const doc = docNode.create(null, [
    codeBlock.create(null, schema.text('const a = 1\nconst b = 2')),
    paragraph.create(null, schema.text('after')),
  ])
  const anchor = 1
  const head = clampHeadToTextblock(doc, anchor, doc.content.size)!

  assert.equal(
    selectedText(doc, anchor, head),
    'const a = 1\nconst b = 2',
    'selection cannot leave the code block',
  )
}

// --- non-textblock anchors are left alone ---------------------------------

{
  const doc = reproDoc()
  const listPos = startOfBlock(doc, 3) - 1 // the orderedList node itself, not a textblock

  assert.equal(textblockBounds(doc, listPos), null)
  assert.equal(
    clampHeadToTextblock(doc, listPos, doc.content.size),
    null,
    'no text block means no invented selection',
  )
  assert.equal(textblockHead(doc, listPos, 'forward'), null)
}

// --- the fallback used when the browser cannot report a visual line -------

{
  const doc = reproDoc()
  const anchor = startOfBlock(doc, 1) + 2
  const bounds = textblockBounds(doc, anchor)!

  assert.equal(textblockHead(doc, anchor, 'forward'), bounds.end)
  assert.equal(textblockHead(doc, anchor, 'backward'), bounds.start)
  assert.equal(
    selectedText(doc, anchor, textblockHead(doc, anchor, 'forward')!),
    'art here.',
    'without Selection.modify the fallback still cannot leave the text block',
  )
}

// --- which keystrokes the binding actually claims -------------------------

{
  // The clamp is only safe if it fires for exactly the two keys it is meant
  // for. `Shift-End` must not swallow `Shift-Mod-End` (select to end of
  // document, correct as-is) or plain `End` (correct as-is). That is a fact
  // about prosemirror-keymap's normalization, so assert it against the real
  // handler rather than trusting the naming.
  const claimed: string[] = []
  const handler = keydownHandler({
    'Shift-Home': () => {
      claimed.push('Shift-Home')
      return true
    },
    'Shift-End': () => {
      claimed.push('Shift-End')
      return true
    },
  })
  const view = { state: {}, dispatch() {} } as never
  const press = (key: string, mods: Partial<Record<'shift' | 'meta' | 'ctrl' | 'alt', boolean>> = {}) => {
    claimed.length = 0
    const handled = handler(view, {
      key,
      keyCode: 0,
      shiftKey: !!mods.shift,
      metaKey: !!mods.meta,
      ctrlKey: !!mods.ctrl,
      altKey: !!mods.alt,
    } as never)
    return { handled, claimed: claimed[0] ?? null }
  }

  assert.deepEqual(press('End', { shift: true }), { handled: true, claimed: 'Shift-End' })
  assert.deepEqual(press('Home', { shift: true }), { handled: true, claimed: 'Shift-Home' })

  for (const [label, key, mods] of [
    ['Cmd+Shift+End', 'End', { shift: true, meta: true }],
    ['Cmd+Shift+Home', 'Home', { shift: true, meta: true }],
    ['Ctrl+Shift+End', 'End', { shift: true, ctrl: true }],
    ['plain End', 'End', {}],
    ['plain Home', 'Home', {}],
  ] as const) {
    assert.deepEqual(
      press(key, mods),
      { handled: false, claimed: null },
      `${label} must be left to the browser`,
    )
  }
}

console.log('selectionBoundary.test.ts: all assertions passed')
