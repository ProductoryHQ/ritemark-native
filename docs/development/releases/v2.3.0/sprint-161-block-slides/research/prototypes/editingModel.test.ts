/**
 * Sprint 161 spike: the editing model, headless (ProseMirror states, no view).
 *
 *  A. "Atom plus string body": the slide stays an atom in the handout's (outer) editor with its Markdown body as an
 *     attribute. The stage's (inner) editor parses the body; each inner change serializes the slide and writes it with
 *     `setNodeMarkup` on the outer editor, whose history is the undo. An outer change (undo, a host revision) reaches the
 *     inner editor as a minimal diff of the re-parsed body, so its selection is mapped, not reset.
 *  B. ProseMirror's footnote pattern: the slide's blocks are real content of the outer node; inner steps are forwarded
 *     into the outer document by offset; outer changes reach the inner editor as a minimal diff.
 *
 * Measured: undo and redo of typing, the caret after undo, a host revision arriving while typing (in another column,
 * and in the paragraph being typed in), and the cost per keystroke on a full slide. Run with `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { Schema, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state'
import { history, undo, redo, undoDepth } from '@tiptap/pm/history'
import { StepMap } from '@tiptap/pm/transform'
import { schema as innerSchema, load, save } from './fencedDiv.roundtrip.harness'

const FULL_SLIDE = `# What the pilot taught us
## Six weeks, two teams

:::: columns

::: column
### Copilot
- People trusted the drafts more after a week of checking them
- The shared inbox took 40 minutes instead of two hours
- Policies changed twice, so the files must be kept current
- Two replies went out unchecked, both in the first three days
:::

::: column
### Cursor
- Answers were best when the question was one sentence
- Longer prompts did not help; clearer files did
- Teams wanted their own assistant, not one for everyone
- The weekly review took 15 minutes and caught most mistakes
:::

::::

::: {.steps tag="Harjutus"}
1. Open the file
2. Ask the question
3. Check the answer
:::

| Team | Weeks | Saved |
| --- | --- | --- |
| Inbox | 6 | 40 min |
| Policies | 6 | 2 h |`

assert.equal(save(load(FULL_SLIDE)), FULL_SLIDE, 'the full slide round-trips (precondition)')

/** The position just after the first occurrence of `text` in a document. */
function after(doc: PMNode, text: string): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found >= 0 || !node.isText) return
    const at = node.text!.indexOf(text)
    if (at >= 0) found = pos + at + text.length
  })
  assert.ok(found >= 0, `"${text}" not found`)
  return found
}

/** Apply `next`'s content to `state` as one minimal replacement: the inner editor's reload, which maps the selection. */
function diffInto(state: EditorState, next: PMNode): EditorState {
  const start = state.doc.content.findDiffStart(next.content)
  if (start === null) return state
  const end = state.doc.content.findDiffEnd(next.content)!
  let endA = end.a
  let endB = end.b
  const overlap = start - Math.min(endA, endB)
  if (overlap > 0) { endA += overlap; endB += overlap }
  return state.apply(state.tr.replace(start, endA, next.slice(start, endB)).setMeta('addToHistory', false))
}

const time = (fn: () => void, runs: number): number => {
  const t0 = performance.now()
  for (let i = 0; i < runs; i += 1) fn()
  return (performance.now() - t0) / runs
}

// -------------------------------------------------------------------------------------------------------------------
// A. Atom plus string body
// -------------------------------------------------------------------------------------------------------------------
const outerSchemaA = new Schema({
  nodes: innerSchema.spec.nodes.addToEnd('slideA', { group: 'block', atom: true, attrs: { body: { default: '' } } }),
  marks: innerSchema.spec.marks,
})

function modelA() {
  const handout = (text: string) => outerSchemaA.node('paragraph', null, outerSchemaA.text(text))
  let outer = EditorState.create({ doc: outerSchemaA.node('doc', null, [handout('Before'), outerSchemaA.node('slideA', { body: FULL_SLIDE }), handout('After')]), plugins: [history()] })
  const slidePos = () => { let p = -1; outer.doc.forEach((n, pos) => { if (n.type.name === 'slideA') p = pos }); return p }
  const bodyOf = () => outer.doc.nodeAt(slidePos())!.attrs.body as string
  let inner = EditorState.create({ doc: load(bodyOf()) })
  let serializeMs = 0
  const typeKey = (ch: string) => {
    inner = inner.apply(inner.tr.insertText(ch))
    const t0 = performance.now()
    const body = save(inner.doc)
    serializeMs += performance.now() - t0
    const pos = slidePos()
    outer = outer.apply(outer.tr.setNodeMarkup(pos, undefined, { body }))
  }
  /** An outer change reaches the inner editor: re-parse the body and apply the difference. */
  const sync = () => { inner = diffInto(inner, load(bodyOf())) }
  return {
    get inner() { return inner }, set inner(s) { inner = s },
    get outer() { return outer }, set outer(s) { outer = s },
    typeKey, sync, bodyOf, slidePos, serialize: () => serializeMs,
    undo: () => undo(outer, tr => { outer = outer.apply(tr) }),
    redo: () => redo(outer, tr => { outer = outer.apply(tr) }),
  }
}

// -------------------------------------------------------------------------------------------------------------------
// B. The footnote pattern
// -------------------------------------------------------------------------------------------------------------------
const outerSchemaB = new Schema({
  nodes: innerSchema.spec.nodes.addToEnd('slideB', { group: 'block', atom: true, content: 'block+' }),
  marks: innerSchema.spec.marks,
})
function modelB() {
  const handout = (text: string) => outerSchemaB.node('paragraph', null, outerSchemaB.text(text))
  const parsed = load(FULL_SLIDE)
  const content = outerSchemaB.nodeFromJSON(parsed.toJSON()).content
  let outer = EditorState.create({ doc: outerSchemaB.node('doc', null, [handout('Before'), outerSchemaB.node('slideB', null, content), handout('After')]), plugins: [history()] })
  const slidePos = () => { let p = -1; outer.doc.forEach((n, pos) => { if (n.type.name === 'slideB') p = pos }); return p }
  const innerDocOf = () => outerSchemaB.node('doc', null, outer.doc.nodeAt(slidePos())!.content)
  let inner = EditorState.create({ doc: innerDocOf() })
  const typeKey = (ch: string) => {
    const tr = inner.tr.insertText(ch)
    inner = inner.apply(tr)
    const offset = StepMap.offset(slidePos() + 1)
    const outerTr = outer.tr
    for (const step of tr.steps) outerTr.step(step.map(offset)!)
    outer = outer.apply(outerTr)
  }
  const sync = () => { inner = diffInto(inner, innerDocOf()) }
  const bodyOf = () => save(innerSchema.nodeFromJSON(innerDocOf().toJSON()))
  return {
    get inner() { return inner }, set inner(s) { inner = s },
    get outer() { return outer }, set outer(s) { outer = s },
    typeKey, sync, bodyOf, slidePos,
    undo: () => undo(outer, tr => { outer = outer.apply(tr) }),
    redo: () => redo(outer, tr => { outer = outer.apply(tr) }),
  }
}

type Model = ReturnType<typeof modelA> | ReturnType<typeof modelB>

function scenario(name: string, make: () => Model) {
  const report: string[] = [`--- ${name}`]

  // Undo and redo of a typed word, and the caret after the undo.
  {
    const m = make()
    const caret = after(m.inner.doc, 'one sentence')
    m.inner = m.inner.apply(m.inner.tr.setSelection(TextSelection.create(m.inner.doc, caret)))
    for (const ch of ' and short') m.typeKey(ch)
    const typed = m.bodyOf()
    assert.ok(typed.includes('one sentence and short'))
    const depth = undoDepth(m.outer)
    m.undo(); m.sync()
    const undone = m.bodyOf() === FULL_SLIDE
    const caretAfterUndo = m.inner.selection.from
    m.redo(); m.sync()
    const redone = m.bodyOf() === typed
    report.push(`typing " and short" makes ${depth} undo step(s); one undo restores the slide: ${undone}; redo restores it: ${redone}`)
    report.push(`caret after undo: ${caretAfterUndo === caret ? 'where the typing started' : `moved (${caretAfterUndo} vs ${caret})`}; after redo: ${m.inner.selection.from === caret + ' and short'.length ? 'after the redone words' : m.inner.selection.from}`)
  }

  // A host revision (an AI edit) lands while typing: in the other column, then in the paragraph being typed in.
  for (const [where, from, to] of [
    ['another column', 'Policies changed twice', 'Policies changed three times'],
    ['the same paragraph, before the caret', 'Answers were best', 'Replies were best'],
  ] as const) {
    const m = make()
    const caret = after(m.inner.doc, 'one sentence')
    m.inner = m.inner.apply(m.inner.tr.setSelection(TextSelection.create(m.inner.doc, caret)))
    for (const ch of ' and') m.typeKey(ch)
    // The host's merged text arrives: the person's typing plus the AI's change. The outer editor applies it as its
    // smallest replacement (Editor.tsx's structural apply, `documentReplacement`).
    const merged = m.bodyOf().replace(from, to)
    const nextOuter = (() => {
      if ('serialize' in m) {
        const doc = m.outer.doc
        const pos = m.slidePos()
        return m.outer.apply(m.outer.tr.setNodeMarkup(pos, undefined, { body: merged }).setMeta('addToHistory', false))
      }
      const doc = m.outer.doc
      const pos = m.slidePos()
      const node = doc.nodeAt(pos)!
      const content = outerSchemaB.nodeFromJSON(load(merged).toJSON()).content
      const next = doc.type.create(null, doc.content.replaceChild(doc.content.findIndex(pos).index, node.type.create(null, content)))
      const start = doc.content.findDiffStart(next.content)!
      const end = doc.content.findDiffEnd(next.content)!
      return m.outer.apply(m.outer.tr.replace(start, end.a, next.slice(start, end.b)).setMeta('addToHistory', false))
    })()
    m.outer = nextOuter
    m.sync()
    for (const ch of ' clear') m.typeKey(ch)
    const body = m.bodyOf()
    report.push(`AI edit in ${where}: both kept: ${body.includes(to) && body.includes('one sentence and clear')}`)
  }

  // Cost per keystroke on a full slide.
  {
    const m = make()
    const caret = after(m.inner.doc, 'caught most mistakes')
    m.inner = m.inner.apply(m.inner.tr.setSelection(TextSelection.create(m.inner.doc, caret)))
    const text = ' and the review got shorter each week'.repeat(3)
    const t0 = performance.now()
    for (const ch of text) m.typeKey(ch)
    const perKey = (performance.now() - t0) / text.length
    const serialize = 'serialize' in m ? (m.serialize() / text.length) : 0
    report.push(`per keystroke: ${perKey.toFixed(2)} ms (of which serializing the slide: ${serialize.toFixed(2)} ms), ${text.length} keys`)
    const parse = time(() => load(m.bodyOf()), 50)
    report.push(`re-parse of the full slide body (A's cost on every outer change: undo, host revision): ${parse.toFixed(2)} ms`)
  }
  console.log(report.join('\n'))
}

scenario('A. atom plus string body', modelA)
scenario('B. footnote pattern', modelB)
