/**
 * Sprint 105 (#164) R1 — comment index tests over a fake minimal doc.
 */
import assert from 'node:assert/strict'
import { collectDocumentComments, summarizeComments, buildAgentTaskPrompt, type MinimalNode } from './commentIndex'

type FakeSpec =
  | { kind: 'text'; text: string; pos: number; mark?: { id?: string | null; note: string } }
  | { kind: 'node'; note: string; pos: number }

function fakeDoc(specs: FakeSpec[]): MinimalNode {
  const entries = specs.map((s) => {
    if (s.kind === 'node') {
      return {
        node: {
          isText: false, type: { name: 'commentNode' }, attrs: { note: s.note },
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

// @unknown does not assign (negative case from Sprint 94 R8).
{
  const doc = fakeDoc([{ kind: 'node', note: '@somebody do a thing', pos: 3 }])
  const [c] = collectDocumentComments(doc)
  assert.equal(c.alias, null)
}

// Task prompt: ordered, ids + anchors included, dispatch-only wording.
{
  const doc = fakeDoc([
    { kind: 'text', text: 'pricing table', pos: 10, mark: { id: 'a1', note: '@claude verify the numbers' } },
    { kind: 'node', note: '@claude add sources at the end', pos: 90 },
  ])
  const comments = collectDocumentComments(doc)
  const prompt = buildAgentTaskPrompt('blog/pricing.md', comments)
  assert.match(prompt, /these 2 comments in blog\/pricing\.md/)
  assert.match(prompt, /1\. verify the numbers/)
  assert.match(prompt, /Comment id: a1/)
  assert.match(prompt, /Anchored to: "pricing table"/)
  assert.match(prompt, /2\. add sources at the end/)
  assert.match(prompt, /standalone note/)
  assert.match(prompt, /Do NOT remove or rewrite the comment markers/)
}

console.log('commentIndex tests passed.')
