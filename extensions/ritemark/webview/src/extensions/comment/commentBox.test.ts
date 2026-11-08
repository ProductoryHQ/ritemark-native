/**
 * #687 — one comment box at a time.
 *
 * `startComment` is the one door for every new empty comment (the bubble menu's
 * Comment and ⌘/). It reads the box the margin rail registered in the comment
 * extension's storage and decides: no box, open the new one; a clean box, close
 * it the way Cancel does and open the new one in ONE transaction; a box with
 * unsaved words, bring it forward and change nothing.
 *
 * Runs against a REAL ProseMirror schema built from the real extensions (no
 * DOM), with a fake editor that records every dispatched transaction, as
 * `commentIds.test.ts` does. History is on, so "one undo brings back the old
 * empty comment" is checked by undoing, not assumed.
 *
 * Run with `npx tsx webview/src/extensions/comment/commentBox.test.ts`.
 */
import assert from 'node:assert/strict'
import { getSchema, type Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state'
import { history, undo } from '@tiptap/pm/history'
import type { Node as PMNode } from '@tiptap/pm/model'
import { CommentMark } from './CommentMark'
import {
  CommentNode,
  composerIsDirty,
  decideNewBox,
  startComment,
  yieldOpenBox,
  type CommentNodeStorage,
  type OpenCommentBox,
} from './CommentNode'

const schema = getSchema([StarterKit, Link, CommentMark, CommentNode])
const commentMark = schema.marks.commentMark
const link = schema.marks.link

const UUID = /^[0-9a-fA-F-]{36}$|^c-[a-z0-9]+-[a-z0-9]+$/
const OLD = '11111111-1111-4111-8111-111111111111'
const SAVED = '22222222-2222-4222-8222-222222222222'

/** A fake editor exposing what `startComment` and `yieldOpenBox` use. */
function fakeEditor(doc: PMNode, select: (doc: PMNode) => TextSelection, openBox: OpenCommentBox | null) {
  let state = EditorState.create({ schema, doc, selection: select(doc), plugins: [history()] })
  const transactions: Transaction[] = []
  const storage: CommentNodeStorage = { openBox, openRequest: null }
  const editor = {
    get state() {
      return state
    },
    storage: { commentNode: storage },
    view: {
      dispatch(tr: Transaction) {
        transactions.push(tr)
        state = state.apply(tr)
      },
    },
  } as unknown as Editor
  return {
    editor,
    transactions,
    storage,
    state: () => state,
    undo: () =>
      undo(state, (tr) => {
        state = state.apply(tr)
      }),
  }
}

/** A registered box with counters for its two callbacks. */
function openBox(fields: Omit<OpenCommentBox, 'bringForward' | 'close'>) {
  const calls = { bringForward: 0, close: 0 }
  const box: OpenCommentBox = {
    ...fields,
    bringForward: () => {
      calls.bringForward++
    },
    close: () => {
      calls.close++
    },
  }
  return { box, calls }
}

const para = (...content: PMNode[]) => schema.node('paragraph', null, content)
const commented = (text: string, attrs: { id: string | null; note: string }, linked = false) =>
  schema.text(text, [
    commentMark.create({ id: attrs.id, note: attrs.note, agentAlias: null }),
    ...(linked ? [link.create({ href: 'https://example.invalid/reference' })] : []),
  ])

/** The document range of the first occurrence of `needle` inside one text node. */
function rangeOf(doc: PMNode, needle: string): { from: number; to: number } {
  let found: { from: number; to: number } | null = null
  doc.descendants((node, pos) => {
    if (found || !node.isText) return
    const at = node.text!.indexOf(needle)
    if (at >= 0) found = { from: pos + at, to: pos + at + needle.length }
  })
  assert.ok(found, `"${needle}" is in the document`)
  return found
}

/** Every comment mark fragment as `id|note`, in document order. */
function markFragments(doc: PMNode): string[] {
  const out: string[] = []
  doc.descendants((node) => {
    if (!node.isText) return
    const m = node.marks.find((mk) => mk.type === commentMark)
    if (m) out.push(`${m.attrs.id}|${m.attrs.note}`)
  })
  return out
}

/** The comment mark on every character of a range, or null where one is missing. */
function marksOver(doc: PMNode, from: number, to: number): Array<{ id: string; note: string } | null> {
  const out: Array<{ id: string; note: string } | null> = []
  doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return
    const m = node.marks.find((mk) => mk.type === commentMark)
    out.push(m ? { id: m.attrs.id as string, note: m.attrs.note as string } : null)
  })
  return out
}

/** The document's blocks, a margin note shown as `[note id|note]`. */
function blocks(doc: PMNode): string[] {
  const out: string[] = []
  doc.forEach((node) => {
    out.push(node.type.name === 'commentNode' ? `[note ${node.attrs.id}|${node.attrs.note}]` : node.textContent)
  })
  return out
}

// ── The clean/dirty decision ─────────────────────────────────────────────────
{
  const newBox = (text: string) =>
    openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'mark', dirty: composerIsDirty(text, '') }).box
  const editBox = (text: string) =>
    openBox({
      key: `c:${SAVED}`,
      commentId: SAVED,
      kind: 'edit',
      anchor: 'mark',
      dirty: composerIsDirty(text, 'Check the figures'),
    }).box

  assert.equal(decideNewBox(null), 'open', 'no box: the new one opens')
  assert.equal(decideNewBox(newBox('')), 'replace', 'an empty new box is clean: it closes')
  assert.equal(decideNewBox(newBox('  \n\t ')), 'replace', 'a box of only spaces is clean')
  assert.equal(decideNewBox(editBox(' Check the figures ')), 'replace', 'an Edit with its text unchanged is clean')
  assert.equal(decideNewBox(newBox('Tighten this')), 'bring-forward', 'typed words in a new box are kept')
  assert.equal(
    decideNewBox(editBox('Check the figures twice')),
    'bring-forward',
    'an Edit with changed text is kept',
  )
}

// ── Anchored: a clean empty box A, and a new comment on B ────────────────────
// A is a link-split comment that also runs into a second paragraph, so its id
// marks three fragments: every one of them must lose the mark.
const anchoredDoc = () =>
  schema.node('doc', null, [
    para(schema.text('Alpha '), commented('first ', { id: OLD, note: '' }), commented('linked words', { id: OLD, note: '' }, true)),
    para(commented('and its second paragraph', { id: OLD, note: '' })),
    para(schema.text('Pick this phrase here.')),
  ])
const selectPhrase = (doc: PMNode) => {
  const r = rangeOf(doc, 'this phrase')
  return TextSelection.create(doc, r.from, r.to)
}

{
  const doc = anchoredDoc()
  const { box, calls } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'mark', dirty: false })
  const t = fakeEditor(doc, selectPhrase, box)
  const phrase = rangeOf(doc, 'this phrase')

  assert.equal(startComment(t.editor), true, 'the new comment is made')
  assert.equal(t.transactions.length, 1, 'closing A and making B is ONE transaction')
  const after = t.state().doc
  assert.equal(
    markFragments(after).some((f) => f.startsWith(`${OLD}|`)),
    false,
    "A's mark is gone from every range: the link split and the second paragraph too",
  )
  assert.equal(after.textContent, doc.textContent, "A's text stays: only its mark goes")
  const onPhrase = marksOver(after, phrase.from, phrase.to)
  const newId = t.storage.openRequest
  assert.ok(newId && UUID.test(newId) && newId !== OLD, 'B gets a new id, and its box is asked for by that id')
  assert.deepEqual(onPhrase, [{ id: newId, note: '' }], 'B has an empty comment mark over exactly its text')
  assert.equal(t.state().selection.from, phrase.from, 'the selection is kept on B')
  assert.equal(t.state().selection.to, phrase.to, 'the selection is kept on B')
  assert.equal(calls.close, 1, "A's box closes in the rail")
  assert.equal(calls.bringForward, 0)

  assert.equal(t.undo(), true)
  assert.deepEqual(
    markFragments(t.state().doc),
    [`${OLD}|`, `${OLD}|`, `${OLD}|`],
    'one undo brings back the old empty comment on all its ranges, and B is gone',
  )
}

// ── Anchored: a dirty box A, and a new comment on B ──────────────────────────
{
  const doc = anchoredDoc()
  const { box, calls } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'mark', dirty: true })
  const t = fakeEditor(doc, selectPhrase, box)
  const before = t.state().selection

  assert.equal(startComment(t.editor), true, 'handled: the open box comes forward')
  assert.equal(t.transactions.length, 0, 'no transaction')
  assert.ok(t.state().doc.eq(doc), 'the document is unchanged')
  assert.ok(t.state().selection.eq(before), 'the document selection stays as it was')
  assert.equal(calls.bringForward, 1, 'the open box is brought forward once')
  assert.equal(calls.close, 0, 'and stays open')
  assert.equal(t.storage.openRequest, null, 'no new box is asked for')
}

// ── Margin note: a clean empty note A before the cursor, and ⌘/ with no selection ──
// Deleting A shifts every later position by its size, so the new note lands in
// the right place only if the cursor was mapped through that deletion.
const noteDoc = () =>
  schema.node('doc', null, [
    para(schema.text('Intro.')),
    schema.node('commentNode', { id: OLD, note: '', agentAlias: null }),
    para(schema.text('Body text here.')),
  ])
const cursorBeforeText = (doc: PMNode) => TextSelection.create(doc, rangeOf(doc, 'text here.').from)

{
  const doc = noteDoc()
  const { box, calls } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: false })
  const t = fakeEditor(doc, cursorBeforeText, box)

  assert.equal(startComment(t.editor), true)
  assert.equal(t.transactions.length, 1, 'deleting A and inserting the new note is ONE transaction')
  const newId = t.storage.openRequest
  assert.ok(newId && UUID.test(newId) && newId !== OLD, 'the new note has a new id')
  assert.deepEqual(
    blocks(t.state().doc),
    ['Intro.', 'Body ', `[note ${newId}|]`, 'text here.'],
    'A is gone, and the new empty note sits exactly at the mapped cursor',
  )
  assert.equal(calls.close, 1)
  assert.equal(calls.bringForward, 0)

  assert.equal(t.undo(), true)
  assert.deepEqual(
    blocks(t.state().doc),
    ['Intro.', `[note ${OLD}|]`, 'Body text here.'],
    'one undo brings back the old empty note and removes the new one',
  )
}

// ── Margin note: a dirty note A, and ⌘/ with no selection ────────────────────
{
  const doc = noteDoc()
  const { box, calls } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: true })
  const t = fakeEditor(doc, cursorBeforeText, box)
  const before = t.state().selection

  assert.equal(startComment(t.editor), true)
  assert.equal(t.transactions.length, 0, 'no transaction')
  assert.ok(t.state().doc.eq(doc), 'the document is unchanged')
  assert.ok(t.state().selection.eq(before), 'the cursor stays where it was')
  assert.equal(calls.bringForward, 1, 'the open note comes forward once')
  assert.equal(t.storage.openRequest, null)
}

// ── No box: a selection gets an anchored comment, a cursor a margin note ─────
{
  const t = fakeEditor(anchoredDoc(), selectPhrase, null)
  assert.equal(startComment(t.editor), true)
  assert.equal(t.transactions.length, 1)
  const phrase = rangeOf(t.state().doc, 'this phrase')
  assert.deepEqual(marksOver(t.state().doc, phrase.from, phrase.to), [{ id: t.storage.openRequest, note: '' }])
  assert.equal(markFragments(t.state().doc).filter((f) => f.startsWith(`${OLD}|`)).length, 3, 'nothing else is touched')
}
{
  const empty = schema.node('doc', null, [para(schema.text('Only text.')), para()])
  const t = fakeEditor(empty, (doc) => TextSelection.create(doc, doc.content.size - 1), null)
  assert.equal(startComment(t.editor), true)
  assert.deepEqual(
    blocks(t.state().doc),
    ['Only text.', `[note ${t.storage.openRequest}|]`],
    'as insertContent did, the note takes an empty paragraph’s place',
  )
}

// ── A clean Edit closes in the rail only: the saved comment is not touched ───
{
  const doc = schema.node('doc', null, [
    para(commented('Saved passage', { id: SAVED, note: 'Check the figures' })),
    para(schema.text('Pick this phrase here.')),
  ])
  const { box, calls } = openBox({ key: `c:${SAVED}`, commentId: SAVED, kind: 'edit', anchor: 'mark', dirty: false })
  const t = fakeEditor(doc, selectPhrase, box)
  assert.equal(startComment(t.editor), true)
  assert.equal(t.transactions.length, 1)
  assert.deepEqual(
    markFragments(t.state().doc),
    [`${SAVED}|Check the figures`, `${t.storage.openRequest}|`],
    'the saved comment keeps its note; the new comment is made',
  )
  assert.equal(calls.close, 1, 'the Edit closes back to the saved comment')
}

// ── A box without an id is found by its range, and only if it is still empty ──
{
  const doc = schema.node('doc', null, [
    para(schema.text('Old '), commented('legacy words', { id: null, note: '' })),
    para(schema.text('Pick this phrase here.')),
  ])
  const legacy = rangeOf(doc, 'legacy words')
  const fields = { key: `m:${legacy.from}-${legacy.to}`, kind: 'new', anchor: 'mark', ...legacy } as const
  const t = fakeEditor(doc, selectPhrase, openBox({ ...fields, dirty: false }).box)
  assert.equal(startComment(t.editor), true)
  assert.deepEqual(markFragments(t.state().doc), [`${t.storage.openRequest}|`], 'the id-less empty mark is removed')

  const saved = schema.node('doc', null, [
    para(schema.text('Old '), commented('legacy words', { id: null, note: 'A saved note' })),
    para(schema.text('Pick this phrase here.')),
  ])
  const s = fakeEditor(saved, selectPhrase, openBox({ ...fields, dirty: false }).box)
  startComment(s.editor)
  assert.deepEqual(
    markFragments(s.state().doc)[0],
    'null|A saved note',
    'a comment with a note is never removed, even when a stale box points at it',
  )
}

// ── The rail's own openers (Edit, click) follow the same rule ────────────────
{
  const clean = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: false })
  const t = fakeEditor(noteDoc(), cursorBeforeText, clean.box)
  assert.equal(yieldOpenBox(t.editor), true, 'a clean box gives way')
  assert.equal(t.transactions.length, 1, 'its empty note is removed, as Cancel removes it')
  assert.deepEqual(blocks(t.state().doc), ['Intro.', 'Body text here.'])
  assert.equal(clean.calls.close, 1)

  const dirty = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: true })
  const d = fakeEditor(noteDoc(), cursorBeforeText, dirty.box)
  assert.equal(yieldOpenBox(d.editor), false, 'a dirty box does not give way')
  assert.equal(d.transactions.length, 0)
  assert.equal(dirty.calls.bringForward, 1, 'it comes forward instead')

  const edit = openBox({ key: `c:${SAVED}`, commentId: SAVED, kind: 'edit', anchor: 'mark', dirty: false })
  const e = fakeEditor(noteDoc(), cursorBeforeText, edit.box)
  assert.equal(yieldOpenBox(e.editor), true, 'a clean Edit gives way')
  assert.equal(e.transactions.length, 0, 'in the rail’s state only')
  assert.equal(edit.calls.close, 1)

  const none = fakeEditor(noteDoc(), cursorBeforeText, null)
  assert.equal(yieldOpenBox(none.editor), true, 'with no box, anything may open')
  assert.equal(none.transactions.length, 0)
}

console.log('commentBox.test.ts — all assertions passed')
