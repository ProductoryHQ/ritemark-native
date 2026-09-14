/**
 * Sprint 117 (R3 / D3) — dispatch-time stable-id upgrade.
 *
 * Runs against a REAL ProseMirror schema built from the real CommentMark /
 * CommentNode extensions (no DOM needed), with a fake editor that records every
 * dispatched transaction — so "one undoable transaction" is an assertion about
 * the actual transaction count, not a comment in the source.
 *
 * Run with `npx tsx webview/src/extensions/comment/commentIds.test.ts`.
 */
import assert from 'node:assert/strict'
import { getSchema, type Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { EditorState, type Transaction } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { CommentMark } from './CommentMark'
import { CommentNode } from './CommentNode'
import { assignMissingCommentIds } from './commentIds'
import { collectDocumentComments, type MinimalNode } from './commentIndex'

const schema = getSchema([StarterKit, Link, CommentMark, CommentNode])
const commentMark = schema.marks.commentMark
const link = schema.marks.link

/** A fake editor exposing only what `assignMissingCommentIds` uses. Applying the
 *  transaction keeps `state` current, so a second call sees the first's result. */
function fakeEditor(doc: PMNode): {
  editor: Editor
  transactions: Transaction[]
  doc: () => PMNode
} {
  let state = EditorState.create({ schema, doc })
  const transactions: Transaction[] = []
  const editor = {
    get state() {
      return state
    },
    view: {
      dispatch(tr: Transaction) {
        transactions.push(tr)
        state = state.apply(tr)
      },
    },
  } as unknown as Editor
  return { editor, transactions, doc: () => state.doc }
}

const para = (...content: PMNode[]) => schema.node('paragraph', null, content)
/** `linked` splits one comment into separate text nodes, exactly as a link inside
 *  the commented passage does in the anchored-link-split fixture. */
const commented = (text: string, attrs: { id?: string | null; note: string }, linked = false) =>
  schema.text(text, [
    commentMark.create({ id: attrs.id ?? null, note: attrs.note, agentAlias: null }),
    ...(linked ? [link.create({ href: 'https://example.invalid/reference' })] : []),
  ])

/** Every commentMark id in the document, fragment by fragment, in doc order. */
function markIds(doc: PMNode): Array<string | null> {
  const ids: Array<string | null> = []
  doc.descendants((node) => {
    if (!node.isText) return
    const m = node.marks.find((mk) => mk.type.name === 'commentMark')
    if (m) ids.push((m.attrs.id as string | null) ?? null)
  })
  return ids
}

/** The union range of every commentMark fragment — what `getMarkRange` gives the
 *  rail for a comment split by formatting. */
function markSpan(doc: PMNode): { from: number; to: number } {
  let from = Number.POSITIVE_INFINITY
  let to = 0
  doc.descendants((node, pos) => {
    if (!node.isText) return
    if (node.marks.some((mk) => mk.type.name === 'commentMark')) {
      from = Math.min(from, pos)
      to = Math.max(to, pos + node.nodeSize)
    }
  })
  return { from, to }
}

function nodeIds(doc: PMNode): Array<string | null> {
  const ids: Array<string | null> = []
  doc.descendants((node) => {
    if (node.type.name === 'commentNode') ids.push((node.attrs.id as string | null) ?? null)
  })
  return ids
}

const UUID = /^[0-9a-fA-F-]{36}$|^c-[a-z0-9]+-[a-z0-9]+$/

// ── A legacy standalone note receives a stable id before dispatch (R3) ────────
{
  const doc = schema.node('doc', null, [
    para(schema.text('Intro paragraph.')),
    schema.node('commentNode', { id: null, note: '@claude Add a short summary', agentAlias: 'claude' }),
    para(schema.text('Body paragraph.')),
  ])
  const { editor, transactions, doc: current } = fakeEditor(doc)
  const [note] = collectDocumentComments(current() as unknown as MinimalNode).filter(
    (c) => c.kind === 'node',
  )
  assert.equal(note.commentId, undefined, 'a legacy standalone note starts with no id')

  const map = assignMissingCommentIds(editor, [note.key])
  const minted = map.get(note.key)
  assert.ok(minted && UUID.test(minted), 'the note is given a stable id')
  assert.equal(transactions.length, 1, 'one transaction → one undo step')
  assert.deepEqual(nodeIds(current()), [minted], 'the id is written onto the node')
  assert.equal(
    collectDocumentComments(current() as unknown as MinimalNode).find((c) => c.kind === 'node')
      ?.commentId,
    minted,
    'the collector now reports the standalone note by id (audit F08)',
  )
}

// ── Already-identified comments are left alone; nothing is dispatched ─────────
{
  const doc = schema.node('doc', null, [
    para(schema.text('The proposal rests on '), commented('a single survey', { id: 'keep-me-1111', note: '@claude Strengthen' })),
    schema.node('commentNode', { id: 'keep-me-2222', note: 'Plain note', agentAlias: null }),
  ])
  const { editor, transactions, doc: current } = fakeEditor(doc)
  const comments = collectDocumentComments(current() as unknown as MinimalNode)
  const map = assignMissingCommentIds(
    editor,
    comments.map((c) => c.key),
  )
  assert.equal(transactions.length, 0, 'nothing to mint → the document is not touched')
  assert.equal(map.get('c:keep-me-1111'), 'keep-me-1111', 'the anchored id is returned unchanged')
  assert.equal(map.size, 2, 'every requested key is answered, existing ids included')
  assert.deepEqual(nodeIds(current()), ['keep-me-2222'], 'the standalone id is untouched')
}

// ── A multi-block mark sharing one id counts once and mints nothing ───────────
{
  const doc = schema.node('doc', null, [
    para(commented('First paragraph of the passage.', { id: 'multi-3333', note: '@codex Tighten both' })),
    para(commented('Second paragraph, same id.', { id: 'multi-3333', note: '@codex Tighten both' })),
    para(schema.text('Text after the passage.')),
  ])
  const { editor, transactions, doc: current } = fakeEditor(doc)
  const comments = collectDocumentComments(current() as unknown as MinimalNode)
  assert.equal(comments.length, 1, 'two fragments, one comment')

  const map = assignMissingCommentIds(editor, [comments[0].key])
  assert.equal(transactions.length, 0, 'an identified multi-block comment needs no upgrade')
  assert.equal(map.get('c:multi-3333'), 'multi-3333')
  assert.deepEqual(markIds(current()), ['multi-3333', 'multi-3333'], 'both fragments keep the id')
}

// ── Link/format-split legacy fragments get ONE id, written to every fragment ──
{
  const note = 'Check that this link still resolves'
  const doc = schema.node('doc', null, [
    para(
      schema.text('See '),
      commented('the ', { note }),
      commented('reference page', { note }, true), // the link split inside one comment
      commented(' for details', { note }),
      schema.text(' before publishing.'),
    ),
  ])
  const { editor, transactions, doc: current } = fakeEditor(doc)
  const comments = collectDocumentComments(current() as unknown as MinimalNode)
  assert.equal(comments.length, 1, 'adjacent id-less fragments are one comment')
  assert.equal(
    comments[0].anchoredText,
    'the  reference page  for details',
    'the anchored text spans every fragment',
  )

  // The rail asks with the FULL mark range, which is wider than the collector's
  // first-fragment range — the resolver must still find the same comment.
  const span = markSpan(current())
  const fullRange = `m:${span.from}-${span.to}`
  const map = assignMissingCommentIds(editor, [fullRange])
  const minted = map.get(fullRange)
  assert.ok(minted && UUID.test(minted), 'a full-mark-range key resolves and mints one id')
  assert.equal(transactions.length, 1, 'one transaction for the whole comment')
  assert.deepEqual(markIds(current()), [minted, minted, minted], 'every fragment carries it')
  assert.equal(
    collectDocumentComments(current() as unknown as MinimalNode).length,
    1,
    'the comment is still ONE comment after the upgrade',
  )
}

// ── Duplicate id with a different note: the LATER occurrence is re-minted ─────
{
  const dup = '66666666-6666-4666-8666-666666666666'
  const doc = schema.node('doc', null, [
    para(commented('Original sentence.', { id: dup, note: '@claude Rephrase' })),
    para(schema.text('A paragraph between them.')),
    para(commented('Pasted sentence.', { id: dup, note: '@claude Rephrase this copy differently' })),
    schema.node('commentNode', { id: dup, note: 'Standalone note reusing the id', agentAlias: null }),
  ])
  const { editor, transactions, doc: current } = fakeEditor(doc)
  const map = assignMissingCommentIds(editor, [`c:${dup}`])
  assert.equal(transactions.length, 1, 'the repair is part of the same single transaction')
  assert.equal(map.get(`c:${dup}`), dup, 'the FIRST occurrence keeps the id it is already bound to')

  const ids = [...markIds(current()), ...nodeIds(current())]
  assert.equal(ids[0], dup, 'first anchored comment unchanged')
  assert.notEqual(ids[1], dup, 'the pasted copy is re-minted')
  assert.notEqual(ids[2], dup, 'the standalone note reusing the id is re-minted')
  assert.equal(new Set(ids).size, ids.length, 'no id is shared by two different comments any more')
  assert.ok(ids.every((id) => id && UUID.test(id)), 're-minted ids have the canonical shape')
}

// ── A same-id/same-note pair is a multi-block comment, not a duplicate ────────
{
  const shared = '22222222-2222-4222-8222-222222222222'
  const doc = schema.node('doc', null, [
    para(commented('First block.', { id: shared, note: '@codex Tighten both paragraphs' })),
    para(commented('Second block.', { id: shared, note: '@codex Tighten both paragraphs' })),
  ])
  const { editor, transactions, doc: current } = fakeEditor(doc)
  assignMissingCommentIds(editor, [`c:${shared}`])
  assert.equal(transactions.length, 0, 'identical notes under one id are never treated as duplicates')
  assert.deepEqual(markIds(current()), [shared, shared])
}

// ── An unresolvable key is omitted, never answered with an invented id ────────
{
  const doc = schema.node('doc', null, [para(schema.text('No comments here.'))])
  const { editor, transactions } = fakeEditor(doc)
  const map = assignMissingCommentIds(editor, ['c:gone-9999', 'n:12', 'm:3-9', 'nonsense'])
  assert.equal(map.size, 0, 'a deleted comment yields no id')
  assert.equal(transactions.length, 0, 'and no document edit')
}

// ── Opening a document never mints: the upgrade only runs when asked ──────────
{
  const doc = schema.node('doc', null, [
    para(commented('legacy anchored text', { note: 'legacy note' })),
    schema.node('commentNode', { id: null, note: 'legacy standalone', agentAlias: null }),
  ])
  const { editor, transactions, doc: current } = fakeEditor(doc)
  // Collecting (what the badge/overview do on every doc change) mints nothing.
  collectDocumentComments(current() as unknown as MinimalNode)
  assignMissingCommentIds(editor, [])
  assert.equal(transactions.length, 0, 'no requested comments → no transaction, document stays clean')
  assert.deepEqual(markIds(current()), [null])
  assert.deepEqual(nodeIds(current()), [null])
}

console.log('commentIds.test.ts — all assertions passed')
