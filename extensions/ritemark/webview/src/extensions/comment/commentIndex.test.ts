/**
 * Sprint 105 (#164) R1 — comment index tests over a fake minimal doc.
 * Sprint 117 (R2/R3) — standalone notes carry a stable id, and prompt building
 * has left this module for the host.
 */
import assert from 'node:assert/strict'
import * as commentIndex from './commentIndex'
import { collectDocumentComments, summarizeComments, type MinimalNode } from './commentIndex'

type FakeSpec =
  | { kind: 'text'; text: string; pos: number; mark?: { id?: string | null; note: string } }
  | { kind: 'node'; note: string; pos: number; id?: string | null }

function fakeDoc(specs: FakeSpec[]): MinimalNode {
  const entries = specs.map((s) => {
    if (s.kind === 'node') {
      return {
        node: {
          isText: false, type: { name: 'commentNode' }, attrs: { note: s.note, id: s.id ?? null },
          marks: [], nodeSize: 1,
        } as unknown as MinimalNode,
        pos: s.pos,
      }
    }
    return {
      node: {
        isText: true, text: s.text, type: { name: 'text' },
        attrs: {},
        marks: s.mark ? [{ type: { name: 'commentMark' }, attrs: { id: s.mark.id ?? null, note: s.mark.note } }] : [],
        nodeSize: s.text.length,
      } as unknown as MinimalNode,
      pos: s.pos,
    }
  })
  return {
    isText: false, type: { name: 'doc' }, attrs: {}, marks: [], nodeSize: 0,
    descendants(cb) { for (const e of entries) cb(e.node, e.pos) },
    textBetween(from, to) {
      const e = entries.find((x) => x.pos === from)
      return e && 'text' in (e.node as { text?: string }) ? String((e.node as { text?: string }).text ?? '').slice(0, to - from) : ''
    },
  } as MinimalNode
}

// Multi-block fragments sharing one id count ONCE; anchored text joins fragments.
{
  const doc = fakeDoc([
    { kind: 'text', text: 'first half', pos: 10, mark: { id: 'c-1', note: '@claude tighten this' } },
    { kind: 'text', text: 'second half', pos: 40, mark: { id: 'c-1', note: '@claude tighten this' } },
    { kind: 'text', text: 'other passage', pos: 80, mark: { id: 'c-2', note: 'plain observation' } },
    { kind: 'node', note: '@codex: add a summary section', pos: 120 },
  ])
  const comments = collectDocumentComments(doc)
  assert.equal(comments.length, 3, 'fragments with one id collapse to one comment')
  assert.deepEqual(comments.map((c) => c.key), ['c:c-1', 'c:c-2', 'n:120'], 'document order kept')
  assert.equal(comments[0].anchoredText, 'first half second half')
  assert.equal(comments[0].alias, 'claude')
  assert.equal(comments[0].instruction, 'tighten this')
  assert.equal(comments[1].alias, null, 'plain note is unassigned')
  assert.equal(comments[2].alias, 'codex')

  const sum = summarizeComments(comments)
  assert.equal(sum.total, 3)
  assert.equal(sum.assigned, 2)
  assert.equal(sum.unassigned, 1)
  assert.deepEqual(sum.byAgent.map((g) => [g.alias, g.comments.length]), [['claude', 1], ['codex', 1]])
}

// Id-less legacy marks: ADJACENT ranges merge (one comment split by formatting);
// separated same-text comments stay distinct.
{
  const doc = fakeDoc([
    { kind: 'text', text: 'bold', pos: 5, mark: { note: 'legacy note' } },
    { kind: 'text', text: ' tail', pos: 9, mark: { note: 'legacy note' } },     // adjacent → same comment
    { kind: 'text', text: 'again', pos: 50, mark: { note: 'legacy note' } },    // separate → distinct
  ])
  const comments = collectDocumentComments(doc)
  assert.equal(comments.length, 2, 'adjacent legacy fragments merge; distant duplicate text stays separate')
}

// Mid-sentence mentions assign too (2026-08-05 fix — Jarmo's live catch: the
// toolbar said "0 assigned" while the rail showed the @claude pill).
{
  const doc = fakeDoc([
    { kind: 'text', text: 'feedback passage', pos: 5, mark: { id: 'm1', note: 'ole hea mõtle kaasa @claude - minu arust see on ülemõtlemine' } },
  ])
  const [c] = collectDocumentComments(doc)
  assert.equal(c.alias, 'claude', 'mid-sentence @claude assigns')
  assert.match(c.instruction, /ole hea mõtle kaasa/)
  assert.doesNotMatch(c.instruction, /@claude/, 'mention stripped from the task instruction')
  const sum = summarizeComments([c])
  assert.equal(sum.assigned, 1)
}

// Cross-agent references survive in the instruction (Codex, PR #184).
{
  const doc = fakeDoc([{ kind: 'node', note: '@claude compare this with @codex notes', pos: 3 }])
  const [c] = collectDocumentComments(doc)
  assert.equal(c.alias, 'claude')
  assert.match(c.instruction, /@codex notes/, 'informational mention preserved')
  assert.doesNotMatch(c.instruction, /^@claude/, 'assignment mention stripped')
}

// @unknown does not assign (negative case from Sprint 94 R8).
{
  const doc = fakeDoc([{ kind: 'node', note: '@somebody do a thing', pos: 3 }])
  const [c] = collectDocumentComments(doc)
  assert.equal(c.alias, null)
}

// A domain that merely contains an alias never assigns (audit L-A).
{
  const doc = fakeDoc([
    { kind: 'text', text: 'A domain is not a mention.', pos: 5, mark: { id: 'dom1', note: 'mail me at team@codex.com' } },
  ])
  const [c] = collectDocumentComments(doc)
  assert.equal(c.alias, null, 'team@codex.com is an address, not an assignment')
  assert.equal(c.instruction, 'mail me at team@codex.com', 'the address survives intact in the instruction')
}

// Sprint 117 (audit F08): a standalone note reports its stable id, so dispatch
// no longer sends an empty id list for the whole `///` comment kind.
{
  const doc = fakeDoc([
    { kind: 'node', note: '@claude Add a short summary', pos: 12, id: '44444444-4444-4444-8444-444444444444' },
    { kind: 'node', note: 'Plain legacy note without an id', pos: 40 },
  ])
  const comments = collectDocumentComments(doc)
  assert.equal(comments[0].commentId, '44444444-4444-4444-8444-444444444444', 'identified standalone note reports its id')
  assert.equal(comments[0].key, 'n:12', 'the rail-facing marker key stays positional')
  assert.equal(comments[1].commentId, undefined, 'a legacy note has no id until the dispatch-time upgrade')
}

// Link-split fragments: one comment, one anchored passage (audit H-A).
{
  const doc = fakeDoc([
    { kind: 'text', text: 'the ', pos: 5, mark: { note: 'Check that this link still resolves' } },
    { kind: 'text', text: 'reference page', pos: 9, mark: { note: 'Check that this link still resolves' } },
    { kind: 'text', text: ' for details', pos: 23, mark: { note: 'Check that this link still resolves' } },
  ])
  const comments = collectDocumentComments(doc)
  assert.equal(comments.length, 1, 'a link split inside one comment is still one comment')
  assert.equal(comments[0].key, 'm:5-9', 'identity comes from the first fragment')
}

// Sprint 117 D8: prompt building moved to the host. Nothing may import it from
// here — a surface that rebuilds its own prompt is how F04–F06 happened.
assert.equal(
  (commentIndex as unknown as Record<string, unknown>).buildAgentTaskPrompt,
  undefined,
  'buildAgentTaskPrompt is gone from the webview collector',
)

console.log('commentIndex.test.ts — all assertions passed')
