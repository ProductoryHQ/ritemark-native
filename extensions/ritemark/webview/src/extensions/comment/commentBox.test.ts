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
import { AllSelection, EditorState, TextSelection, type Selection, type Transaction } from '@tiptap/pm/state'
import { history, undo } from '@tiptap/pm/history'
import type { Node as PMNode } from '@tiptap/pm/model'
import { CommentMark } from './CommentMark'
import {
  CommentNode,
  composerIsDirty,
  decideNewBox,
  leastScrollDelta,
  liftCommentLine,
  nextRailBox,
  startComment,
  yieldOpenBox,
  type ComposeCandidate,
  type CommentNodeStorage,
  type OpenCommentBox,
} from './CommentNode'

const schema = getSchema([StarterKit, Link, CommentMark, CommentNode])
const commentMark = schema.marks.commentMark
const link = schema.marks.link

const UUID = /^[0-9a-fA-F-]{36}$|^c-[a-z0-9]+-[a-z0-9]+$/
const OLD = '11111111-1111-4111-8111-111111111111'
const SAVED = '22222222-2222-4222-8222-222222222222'
const LATER = '33333333-3333-4333-8333-333333333333'

/** The id of the new comment whose box the door asked the rail to open. */
function boxRequestId(storage: CommentNodeStorage): string {
  const request = storage.openRequest
  assert.ok(request && request.as === 'box' && request.key.startsWith('c:'), 'a new box is asked for by its id')
  return request.key.slice(2)
}

/** A fake editor exposing what the door (`startComment`, `liftCommentLine`, `yieldOpenBox`) uses. */
function fakeEditor(doc: PMNode, select: (doc: PMNode) => Selection, openBox: OpenCommentBox | null) {
  let state = EditorState.create({ schema, doc, selection: select(doc), plugins: [history()] })
  const transactions: Transaction[] = []
  const woken = { count: 0 }
  const toolbarHidden = { count: 0 }
  const storage: CommentNodeStorage = {
    openBox,
    openRequest: null,
    notifyRail: () => {
      woken.count++
    },
    hideToolbar: () => {
      toolbarHidden.count++
    },
  }
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
    woken,
    toolbarHidden,
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
  const newId = boxRequestId(t.storage)
  assert.ok(UUID.test(newId) && newId !== OLD, 'B gets a new id, and its box is asked for by that id')
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
  const newId = boxRequestId(t.storage)
  assert.ok(UUID.test(newId) && newId !== OLD, 'the new note has a new id')
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
  assert.deepEqual(marksOver(t.state().doc, phrase.from, phrase.to), [{ id: boxRequestId(t.storage), note: '' }])
  assert.equal(markFragments(t.state().doc).filter((f) => f.startsWith(`${OLD}|`)).length, 3, 'nothing else is touched')
}
{
  const empty = schema.node('doc', null, [para(schema.text('Only text.')), para()])
  const t = fakeEditor(empty, (doc) => TextSelection.create(doc, doc.content.size - 1), null)
  assert.equal(startComment(t.editor), true)
  assert.deepEqual(
    blocks(t.state().doc),
    ['Only text.', `[note ${boxRequestId(t.storage)}|]`],
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
    [`${SAVED}|Check the figures`, `${boxRequestId(t.storage)}|`],
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
  assert.deepEqual(markFragments(t.state().doc), [`${boxRequestId(t.storage)}|`], 'the id-less empty mark is removed')

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
  assert.equal(yieldOpenBox(t.editor, `c:${SAVED}`), `c:${SAVED}`, 'a clean box gives way, and an id key stays')
  assert.equal(t.transactions.length, 1, 'its empty note is removed, as Cancel removes it')
  assert.deepEqual(blocks(t.state().doc), ['Intro.', 'Body text here.'])
  assert.equal(clean.calls.close, 1)

  const dirty = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: true })
  const d = fakeEditor(noteDoc(), cursorBeforeText, dirty.box)
  assert.equal(yieldOpenBox(d.editor, `c:${SAVED}`), null, 'a dirty box does not give way')
  assert.equal(d.transactions.length, 0)
  assert.equal(dirty.calls.bringForward, 1, 'it comes forward instead')

  const edit = openBox({ key: `c:${SAVED}`, commentId: SAVED, kind: 'edit', anchor: 'mark', dirty: false })
  const e = fakeEditor(noteDoc(), cursorBeforeText, edit.box)
  assert.equal(yieldOpenBox(e.editor, 'm:3-9'), 'm:3-9', 'a clean Edit gives way, with no transaction to move a key')
  assert.equal(e.transactions.length, 0, 'in the rail’s state only')
  assert.equal(edit.calls.close, 1)

  const none = fakeEditor(noteDoc(), cursorBeforeText, null)
  assert.equal(yieldOpenBox(none.editor, 'n:4'), 'n:4', 'with no box, anything may open')
  assert.equal(none.transactions.length, 0)
}

// ── An id-less comment below the closed box keeps its key (Codex P2 on #689) ──
// Comments written before Sprint 117 have no id, so the rail keys them by
// position. Removing the empty margin note above moves that position; the key
// yieldOpenBox hands back must name the same comment in the new document.
{
  const legacyDoc = () =>
    schema.node('doc', null, [
      para(schema.text('Intro.')),
      schema.node('commentNode', { id: OLD, note: '', agentAlias: null }),
      para(schema.text('Body '), commented('legacy words', { id: null, note: 'An old note' }), schema.text(' here.')),
      schema.node('commentNode', { id: null, note: 'An old margin note', agentAlias: null }),
    ])
  const keysOf = (doc: PMNode) => {
    const r = rangeOf(doc, 'legacy words')
    let notePos = -1
    doc.descendants((node, pos) => {
      if (node.type.name === 'commentNode' && node.attrs.note) notePos = pos
    })
    return { mark: `m:${r.from}-${r.to}`, note: `n:${notePos}` }
  }
  const before = keysOf(legacyDoc())
  const clean = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: false })
  const atIntro = (doc: PMNode) => TextSelection.create(doc, 1)
  const t = fakeEditor(legacyDoc(), atIntro, clean.box)
  const markKey = yieldOpenBox(t.editor, before.mark)
  const after = keysOf(t.state().doc)
  assert.notEqual(after.mark, before.mark, 'the removal moved the id-less comment')
  assert.equal(markKey, after.mark, 'the anchored comment is asked for at its new place')

  const n = fakeEditor(legacyDoc(), atIntro, openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: false }).box)
  assert.equal(yieldOpenBox(n.editor, before.note), keysOf(n.state().doc).note, 'so is the id-less margin note')
}

// ── Mixed kinds: a margin-note box gives way to an anchored comment ──────────
// The note sits before the selection, so the selection must be mapped through
// its deletion to keep covering the same words.
{
  const doc = noteDoc()
  const { box, calls } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: false })
  const t = fakeEditor(doc, (d) => TextSelection.create(d, rangeOf(d, 'text').from, rangeOf(d, 'text').to), box)
  assert.equal(startComment(t.editor), true)
  assert.equal(t.transactions.length, 1, 'one transaction')
  assert.deepEqual(blocks(t.state().doc), ['Intro.', 'Body text here.'], 'the empty note is gone')
  const word = rangeOf(t.state().doc, 'text')
  assert.deepEqual(marksOver(t.state().doc, word.from, word.to), [{ id: boxRequestId(t.storage), note: '' }])
  assert.equal(t.state().selection.from, word.from, 'the selection still covers the same words')
  assert.equal(t.state().selection.to, word.to)
  assert.equal(calls.close, 1)
}

// ── Mixed kinds: an anchored box gives way to a margin note ──────────────────
{
  const doc = anchoredDoc()
  const { box, calls } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'mark', dirty: false })
  const t = fakeEditor(doc, (d) => TextSelection.create(d, rangeOf(d, 'this phrase').from), box)
  assert.equal(startComment(t.editor), true)
  assert.equal(t.transactions.length, 1, 'one transaction')
  assert.deepEqual(markFragments(t.state().doc), [], "the empty anchored comment's mark is gone everywhere")
  assert.deepEqual(
    blocks(t.state().doc),
    ['Alpha first linked words', 'and its second paragraph', 'Pick ', `[note ${boxRequestId(t.storage)}|]`, 'this phrase here.'],
    'the new empty note sits at the cursor',
  )
  assert.equal(calls.close, 1)
}

// ── A note deleted AFTER the cursor leaves the cursor where it was ────────────
{
  const doc = schema.node('doc', null, [
    para(schema.text('Body text here.')),
    schema.node('commentNode', { id: OLD, note: '', agentAlias: null }),
    para(schema.text('End.')),
  ])
  const { box } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: false })
  const t = fakeEditor(doc, cursorBeforeText, box)
  assert.equal(startComment(t.editor), true)
  assert.equal(t.transactions.length, 1)
  assert.deepEqual(blocks(t.state().doc), ['Body ', `[note ${boxRequestId(t.storage)}|]`, 'text here.', 'End.'])
}

// ── The `///` lift goes through the same door ────────────────────────────────
const liftDoc = (line: string) =>
  schema.node('doc', null, [
    para(schema.text('Intro.')),
    schema.node('commentNode', { id: OLD, note: '', agentAlias: null }),
    para(schema.text(line)),
    para(schema.text('After.')),
  ])
const cursorAtLineEnd = (line: string) => (doc: PMNode) => TextSelection.create(doc, rangeOf(doc, line).to)

{
  // A clean box: the old empty note goes in the SAME transaction as the lift.
  const { box, calls } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: false })
  const t = fakeEditor(liftDoc('///'), cursorAtLineEnd('///'), box)
  assert.equal(liftCommentLine(t.editor), true)
  assert.equal(t.transactions.length, 1, 'one transaction')
  assert.deepEqual(
    blocks(t.state().doc),
    ['Intro.', `[note ${boxRequestId(t.storage)}|]`, 'After.'],
    'the old empty note is gone, and the line became the new empty note, whose box opens',
  )
  assert.equal(calls.close, 1)
  assert.equal(t.undo(), true)
  assert.deepEqual(blocks(t.state().doc), ['Intro.', `[note ${OLD}|]`, '///', 'After.'], 'one undo restores both')
}
{
  // A dirty box: the line stays as typed, nothing else happens, the box comes forward.
  const doc = liftDoc('///')
  const { box, calls } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: true })
  const t = fakeEditor(doc, cursorAtLineEnd('///'), box)
  assert.equal(liftCommentLine(t.editor), true, 'Enter is handled: it does nothing else')
  assert.equal(t.transactions.length, 0, 'no transaction')
  assert.ok(t.state().doc.eq(doc), 'the `///` line stays as typed')
  assert.equal(calls.bringForward, 1)
  assert.equal(t.storage.openRequest, null)
}
{
  // With text, the lift makes a saved note and leaves the open box alone.
  const { box, calls } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'node', dirty: false })
  const t = fakeEditor(liftDoc('/// Check the dates'), cursorAtLineEnd('/// Check the dates'), box)
  assert.equal(liftCommentLine(t.editor), true)
  assert.equal(t.transactions.length, 1)
  const notes = blocks(t.state().doc).filter((b) => b.startsWith('[note'))
  assert.equal(notes.length, 2, 'the open box is untouched')
  assert.ok(notes[1].endsWith('|Check the dates]'), 'the line became a saved note')
  assert.equal(t.storage.openRequest, null, 'a saved note opens no box')
  assert.equal(calls.close, 0)
}
{
  // A line holding `-->` can't be a comment: it isn't lifted, and Enter works normally.
  const line = '/// keep these words --> and these'
  const doc = liftDoc(line)
  const t = fakeEditor(doc, cursorAtLineEnd(line), null)
  assert.equal(liftCommentLine(t.editor), false, 'not handled, so normal Enter runs')
  assert.equal(t.transactions.length, 0)
  assert.ok(t.state().doc.eq(doc), 'the words stay as text')
}

// ── A selection that touches a saved comment opens it instead (the lead's option A) ──
const savedDoc = () =>
  schema.node('doc', null, [
    para(schema.text('Start '), commented('saved words', { id: SAVED, note: 'Check the figures' }), schema.text(' tail end.')),
    para(schema.text('Pick this phrase here.')),
  ])
const select = (needleFrom: string, needleTo: string) => (doc: PMNode) =>
  TextSelection.create(doc, rangeOf(doc, needleFrom).from, rangeOf(doc, needleTo).to)

{
  // Overlap: one character in common is enough.
  const doc = savedDoc()
  const t = fakeEditor(doc, select('words', ' tail'), null)
  const before = t.state().selection
  assert.equal(startComment(t.editor), true)
  assert.equal(t.transactions.length, 0, 'no transaction')
  assert.ok(t.state().doc.eq(doc), 'the document is unchanged')
  assert.ok(t.state().selection.eq(before), 'the selection stays as it was')
  assert.deepEqual(t.storage.openRequest, { key: `c:${SAVED}`, as: 'latched' }, 'the saved comment opens latched')
  assert.equal(t.woken.count, 1, 'the rail is told, since the document did not change')
}
{
  // Meeting the highlight only at its edge isn't touching it: a new comment, as before.
  const after = fakeEditor(savedDoc(), select(' tail', ' tail'), null)
  assert.equal(startComment(after.editor), true)
  assert.equal(after.transactions.length, 1, 'starting where the highlight ends makes a new comment')
  boxRequestId(after.storage)

  const before = fakeEditor(savedDoc(), select('Start ', 'Start '), null)
  assert.equal(startComment(before.editor), true)
  assert.equal(before.transactions.length, 1, 'ending where the highlight starts makes a new comment')
  assert.deepEqual(
    markFragments(before.state().doc),
    [`${boxRequestId(before.storage)}|`, `${SAVED}|Check the figures`],
    'the saved comment keeps its note',
  )
}
{
  // ⌘A over two saved comments: the first in document order opens.
  const doc = schema.node('doc', null, [
    para(schema.text('One '), commented('first saved', { id: LATER, note: 'Earlier in the text' })),
    para(schema.text('Two '), commented('second saved', { id: SAVED, note: 'Later in the text' })),
  ])
  const t = fakeEditor(doc, (d) => new AllSelection(d), null)
  assert.equal(startComment(t.editor), true)
  assert.equal(t.transactions.length, 0)
  assert.deepEqual(t.storage.openRequest, { key: `c:${LATER}`, as: 'latched' }, 'document order, not id order')
}
{
  // A saved comment without an id is asked for by the rail's range key.
  const doc = schema.node('doc', null, [para(schema.text('Old '), commented('legacy words', { id: null, note: 'Kept' }))])
  const legacy = rangeOf(doc, 'legacy words')
  const t = fakeEditor(doc, select('words', 'words'), null)
  assert.equal(startComment(t.editor), true)
  assert.deepEqual(t.storage.openRequest, { key: `m:${legacy.from}-${legacy.to}`, as: 'latched' })
}
{
  // The one-box rule runs first: a dirty box comes forward, and nothing opens.
  const doc = savedDoc()
  const { box, calls } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'mark', dirty: true })
  const t = fakeEditor(doc, select('words', ' tail'), box)
  assert.equal(startComment(t.editor), true)
  assert.equal(t.transactions.length, 0)
  assert.equal(calls.bringForward, 1)
  assert.equal(t.storage.openRequest, null, 'the saved comment does not open')
}
{
  // A clean empty box closes in one transaction, and then the saved comment opens.
  const doc = schema.node('doc', null, [
    para(schema.text('Start '), commented('saved words', { id: SAVED, note: 'Check the figures' }), schema.text(' tail end.')),
    para(schema.text('An '), commented('empty one', { id: OLD, note: '' })),
  ])
  const { box, calls } = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'mark', dirty: false })
  const t = fakeEditor(doc, select('words', ' tail'), box)
  assert.equal(startComment(t.editor), true)
  assert.equal(t.transactions.length, 1, 'one transaction removes the empty box')
  assert.deepEqual(markFragments(t.state().doc), [`${SAVED}|Check the figures`], 'and makes no new comment')
  assert.deepEqual(t.storage.openRequest, { key: `c:${SAVED}`, as: 'latched' })
  assert.equal(calls.close, 1)
}
{
  // Unchanged: a cursor still makes a margin note, and a selection over no saved comment a new comment.
  const note = fakeEditor(savedDoc(), (d) => TextSelection.create(d, rangeOf(d, 'this phrase').from), null)
  assert.equal(startComment(note.editor), true)
  assert.ok(blocks(note.state().doc).some((b) => b === `[note ${boxRequestId(note.storage)}|]`))
  const all = fakeEditor(schema.node('doc', null, [para(schema.text('No comments at all.'))]), (d) => new AllSelection(d), null)
  assert.equal(startComment(all.editor), true)
  assert.equal(all.transactions.length, 1, '⌘A in a file with no comments makes a new comment')
  boxRequestId(all.storage)
}

// ── The rail's rule for which marker is its box (`nextRailBox`) ───────────────
{
  const saved: ComposeCandidate = { key: `c:${SAVED}`, note: 'Check the figures', from: 1 }
  const emptyLate: ComposeCandidate = { key: 'c:empty-late', note: '', from: 30 }
  const emptyEarly: ComposeCandidate = { key: 'n:10', note: '', nodePos: 10 }
  const markers = [saved, emptyLate, emptyEarly]

  const load = nextRailBox({ current: null, markers, request: null, firstShown: false })
  assert.equal(load.composeKey, 'n:10', 'on load, only the first empty comment in document order is a box')
  assert.equal(load.firstShown, true)

  const none = nextRailBox({ current: null, markers: [saved], request: null, firstShown: false })
  assert.deepEqual([none.composeKey, none.firstShown], [null, true], 'no empty comment, no box; the first scan is done')

  const mount = nextRailBox({ current: null, markers: [], request: null, firstShown: false })
  assert.equal(mount.firstShown, false, 'a scan with no comments yet is not the first scan')

  const closed = nextRailBox({ current: null, markers, request: null, firstShown: true })
  assert.equal(closed.composeKey, null, 'after a box closes, no other empty comment opens by itself')

  const undone = nextRailBox({ current: 'c:gone', markers, request: null, firstShown: true })
  assert.equal(undone.composeKey, null, 'after an undo takes the box away, none opens by itself, and the key clears')

  const stays = nextRailBox({ current: 'c:empty-late', markers, request: null, firstShown: true })
  assert.equal(stays.composeKey, 'c:empty-late', 'a box whose comment is still there stays open')

  const waiting = nextRailBox({ current: null, markers, request: { key: 'c:not-yet', as: 'box' }, firstShown: true })
  assert.deepEqual([waiting.composeKey, waiting.tookRequest], [null, false], 'a request waits for its marker')

  const box = nextRailBox({ current: null, markers, request: { key: 'c:empty-late', as: 'box' }, firstShown: true })
  assert.deepEqual([box.composeKey, box.latch, box.tookRequest], ['c:empty-late', null, true], 'a box request opens that box')

  const latched = nextRailBox({ current: null, markers, request: { key: `c:${SAVED}`, as: 'latched' }, firstShown: true })
  assert.deepEqual(
    [latched.composeKey, latched.latch, latched.tookRequest],
    [null, `c:${SAVED}`, true],
    'a latched request opens the saved comment, with no box',
  )
}

// ── Opening a saved comment latched hides the formatting toolbar, once ──────
// The selection and the editor's focus stay, so nothing else would hide it. A
// new box's own focus and edit already hide it, so that path doesn't call it.
{
  const latched = fakeEditor(savedDoc(), select('words', ' tail'), null)
  startComment(latched.editor)
  assert.equal(latched.storage.openRequest?.as, 'latched')
  assert.equal(latched.toolbarHidden.count, 1, 'a saved comment opened latched hides the toolbar exactly once')

  const doc = schema.node('doc', null, [
    para(schema.text('Start '), commented('saved words', { id: SAVED, note: 'Check the figures' }), schema.text(' tail end.')),
    para(schema.text('An '), commented('empty one', { id: OLD, note: '' })),
  ])
  const clean = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'mark', dirty: false })
  const replaced = fakeEditor(doc, select('words', ' tail'), clean.box)
  startComment(replaced.editor)
  assert.equal(replaced.transactions.length, 1)
  assert.equal(replaced.toolbarHidden.count, 1, 'also when a clean box closes in the same step')

  const fresh = fakeEditor(anchoredDoc(), selectPhrase, null)
  startComment(fresh.editor)
  assert.equal(fresh.transactions.length, 1, 'a new comment is made as before')
  boxRequestId(fresh.storage)
  assert.equal(fresh.toolbarHidden.count, 0, 'a new box leaves the toolbar to its own rules')

  const note = fakeEditor(noteDoc(), cursorBeforeText, null)
  startComment(note.editor)
  assert.equal(note.toolbarHidden.count, 0, 'so does a margin note')

  const dirty = openBox({ key: `c:${OLD}`, commentId: OLD, kind: 'new', anchor: 'mark', dirty: true })
  const forward = fakeEditor(savedDoc(), select('words', ' tail'), dirty.box)
  startComment(forward.editor)
  assert.equal(forward.toolbarHidden.count, 0, 'a dirty box coming forward opens nothing, so nothing here')

  const lift = fakeEditor(liftDoc('///'), cursorAtLineEnd('///'), null)
  liftCommentLine(lift.editor)
  assert.equal(lift.toolbarHidden.count, 0, 'nor the `///` lift')
}

// ── The least scroll shows the box and the line it is about (experience 11) ──
// A view 0–600 px. Below the `wide` rail the box opens under its marker, so the
// highlighted line sits just above the box.
{
  const view = { top: 0, bottom: 600 }

  assert.equal(
    leastScrollDelta(view, { top: 300, bottom: 420 }, { top: 270, bottom: 290 }),
    0,
    'both in view: no scroll at all',
  )
  assert.equal(
    leastScrollDelta(view, { top: 640, bottom: 760 }, { top: 610, bottom: 630 }),
    160,
    'box below the view: scroll down just until the box’s bottom shows (the line is above it, in view too)',
  )
  assert.equal(
    leastScrollDelta(view, { top: 40, bottom: 160 }, { top: -30, bottom: -10 }),
    -30,
    'the line above the view with the box in it: scroll up just until the line shows',
  )
  assert.equal(
    leastScrollDelta(view, { top: -100, bottom: 20 }, { top: -130, bottom: -110 }),
    -130,
    'both above: scroll up until the line, the higher of the two, shows',
  )
  assert.equal(
    leastScrollDelta(view, { top: 700, bottom: 1250 }, { top: 60, bottom: 80 }),
    1250 - 600,
    'too tall together: the box wins, scrolled the least that shows it whole',
  )
  assert.equal(
    leastScrollDelta(view, { top: 640, bottom: 760 }, null),
    160,
    'no line found: the box alone, as `nearest`',
  )
  assert.equal(
    leastScrollDelta(view, { top: -50, bottom: 650 }, null),
    0,
    'a box that already spans the whole view does not move',
  )

  // One text line of room above the line (the Experience lead, experience 11).
  const room = 31
  assert.equal(
    leastScrollDelta(view, { top: 40, bottom: 160 }, { top: -30, bottom: -10 }, room),
    -61,
    'the line above the view: scroll up until a line of room shows above it',
  )
  assert.equal(
    leastScrollDelta(view, { top: 300, bottom: 420 }, { top: 0, bottom: 20 }, room),
    0,
    'the line already in view, flush at the top: nothing changes',
  )
  assert.equal(
    leastScrollDelta(view, { top: 30, bottom: 605 }, { top: 10, bottom: 28 }, room),
    5,
    'space is short: the room goes first and the line stays',
  )
  assert.equal(
    leastScrollDelta(view, { top: 40, bottom: 610 }, { top: -100, bottom: -80 }, room),
    10,
    'shorter still: the line goes too, and the box wins',
  )
}

console.log('commentBox.test.ts — all assertions passed')
