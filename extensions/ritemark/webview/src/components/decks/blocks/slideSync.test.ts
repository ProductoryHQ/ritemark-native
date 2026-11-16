/**
 * Sprint 161 (PR 2): the slide editor on the stage and the slide's node stay one slide (`SlideSync`, the spike's
 * "atom plus string body"), and the fit keeps its step as the words change (`slideFit.ts`). The stage's editor is a
 * ProseMirror state on the slide editor's own schema and pipeline (`slideEditorHarness.ts`); the handout's editor is
 * an outer state holding the slide as an atom with its Markdown, whose history is the undo.
 * Run with `npx tsx webview/src/components/decks/blocks/slideSync.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { Schema, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { history, undo, redo } from '@tiptap/pm/history'
import { loadSlide, saveSlide, slideSchema } from './slideEditorHarness'
import { SLIDE_SYNC, SlideSync } from './slideSync'
import { nextFitStep, type FitMeasure } from './slideFit'
import { editorHTML } from '../../../utils/markdownFidelity'
import { saveSlideMarkdown } from './slideEditorMarkdown'

const SLIDE = `# What the pilot taught us
## Six weeks, two teams

:::: columns

::: column
### Copilot
- People trusted the drafts more after a week
- Policies changed twice
:::

::: column
### Cursor
- Answers were best when the question was one sentence
- Clearer files helped
:::

::::

::: {.steps tag="Harjutus"}
1. Open the file
2. Ask the question
:::`

/** The stage's save, as SlideEditor makes it: escaped `:::` lines only when they would read back as blocks. */
const save = (doc: PMNode) => saveSlideMarkdown(doc, editorHTML(doc), loadSlide)

/** The position right after the first `text` in a document. */
function after(doc: PMNode, text: string): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found >= 0 || !node.isText) return
    const at = node.text!.indexOf(text)
    if (at >= 0) found = pos + at + text.length
  })
  assert.ok(found >= 0, text)
  return found
}

/** The handout's editor: the slide as an atom with its Markdown, and the history. */
const outerSchema = new Schema({ nodes: { doc: { content: 'block+' }, text: {}, paragraph: { group: 'block', content: 'text*' }, slide: { group: 'block', atom: true, attrs: { body: { default: '' } } } } })

function model(markdown: string) {
  let outer = EditorState.create({ doc: outerSchema.node('doc', null, [outerSchema.node('paragraph', null, outerSchema.text('Before')), outerSchema.node('slide', { body: markdown })]), plugins: [history()] })
  const body = () => outer.doc.child(1).attrs.body as string
  let inner = EditorState.create({ doc: loadSlide(markdown) })
  const sync = new SlideSync(loadSlide, save, markdown, inner.doc)
  /** One key on the stage: the stage's change, and its write to the node when there is one. */
  const type = (text: string, composing = false) => {
    const tr = inner.tr.insertText(text)
    inner = inner.apply(tr)
    sync.track(tr)
    // While an input method composes, the stage writes nothing (SlideEditor's onUpdate).
    if (composing) return
    writeNow()
  }
  const writeNow = () => {
    const write = sync.toWrite(inner.doc)
    if (write === null) { sync.settled(inner.doc); return }
    outer = outer.apply(outer.tr.setNodeMarkup(outer.doc.child(0).nodeSize, undefined, { body: write }))
    sync.wrote(write, inner.doc)
  }
  /** The node's Markdown reaches the stage (React's effect on the slide's body). */
  const reach = (composing = false) => {
    const tr = sync.incoming(body(), inner, composing)
    if (tr) {
      assert.equal(tr.getMeta(SLIDE_SYNC), true)
      inner = inner.apply(tr)
    }
    return !!tr
  }
  return {
    get inner() { return inner }, set inner(state) { inner = state },
    get outer() { return outer }, set outer(state) { outer = state },
    sync, body, type, reach, writeNow,
    undo: () => undo(outer, tr => { outer = outer.apply(tr) }),
    redo: () => redo(outer, tr => { outer = outer.apply(tr) }),
  }
}

// ---- An unchanged slide writes nothing, and gives back its Markdown as written even where the editor would write it
// another way.
{
  const written = '# Title  \n\n* one\n* two\n\n::: {.box   icon="x"}\nA\n:::'
  assert.notEqual(saveSlide(loadSlide(written)), written, 'precondition: the editor would write it differently')
  const m = model(written)
  assert.equal(m.sync.markdownOf(m.inner.doc), written)
  assert.equal(m.sync.toWrite(m.inner.doc), null, 'opening the slide on the stage writes nothing')
}

// ---- Typing a word and deleting it again writes the slide back as it was, byte for byte.
{
  const m = model(SLIDE)
  m.inner = m.inner.apply(m.inner.tr.setSelection(TextSelection.create(m.inner.doc, after(m.inner.doc, 'one sentence'))))
  m.type('!')
  assert.ok(m.body().includes('one sentence!'))
  const pos = m.inner.selection.from
  m.inner = m.inner.apply(m.inner.tr.delete(pos - 1, pos))
  const write = m.sync.toWrite(m.inner.doc)
  assert.equal(write, SLIDE, 'the original string, byte for byte')
}

// ---- The stage's own write comes back as a change of the node: ignored, the stage's document untouched.
{
  const m = model(SLIDE)
  m.inner = m.inner.apply(m.inner.tr.setSelection(TextSelection.create(m.inner.doc, after(m.inner.doc, 'Clearer files helped'))))
  m.type(' a lot')
  const doc = m.inner.doc
  assert.equal(m.reach(), false, 'its own echo')
  assert.equal(m.inner.doc, doc)
}

// ---- Undo is the handout editor's: the node goes back, the stage takes it in as its smallest replacement, and the
// caret is where the typing started; Redo brings the words and the caret back.
{
  const m = model(SLIDE)
  const caret = after(m.inner.doc, 'one sentence')
  m.inner = m.inner.apply(m.inner.tr.setSelection(TextSelection.create(m.inner.doc, caret)))
  for (const char of ' and short') m.type(char)
  const typed = m.body()
  m.undo()
  assert.equal(m.body(), SLIDE, 'one undo restores the slide')
  assert.equal(m.reach(), true)
  assert.equal(m.inner.selection.from, caret, 'the caret is where the typing started')
  assert.equal(m.sync.toWrite(m.inner.doc), null, 'and nothing is written back')
  m.redo()
  m.reach()
  assert.equal(m.body(), typed)
  assert.equal(m.inner.selection.from, caret + ' and short'.length, 'after the redone words')
}

// ---- An AI's edit arriving while the person types (the host's merged revision): both are kept, and the caret stays
// with the person's words.
{
  for (const [from, to] of [['Policies changed twice', 'Policies changed three times'], ['Answers were best', 'Replies were best']] as const) {
    const m = model(SLIDE)
    m.inner = m.inner.apply(m.inner.tr.setSelection(TextSelection.create(m.inner.doc, after(m.inner.doc, 'one sentence'))))
    for (const char of ' and') m.type(char)
    // The host's revision: the person's words with the AI's change, applied to the node out of the history.
    m.outer = m.outer.apply(m.outer.tr.setNodeMarkup(m.outer.doc.child(0).nodeSize, undefined, { body: m.body().replace(from, to) }).setMeta('addToHistory', false))
    assert.equal(m.reach(), true)
    const words = save(m.inner.doc)
    assert.ok(words.includes(to) && words.includes('one sentence and'), `both kept (${to})`)
    assert.equal(m.inner.selection.from, after(m.inner.doc, 'one sentence and'), 'the caret stays after the person\'s words')
  }
}

// ---- An input method composing: a change of the node waits until the composition ends, then comes in.
{
  const m = model(SLIDE)
  m.inner = m.inner.apply(m.inner.tr.setSelection(TextSelection.create(m.inner.doc, after(m.inner.doc, 'Open the file'))))
  m.outer = m.outer.apply(m.outer.tr.setNodeMarkup(m.outer.doc.child(0).nodeSize, undefined, { body: SLIDE.replace('Ask the question', 'Ask one question') }).setMeta('addToHistory', false))
  const before = m.inner.doc
  assert.equal(m.reach(true), false, 'nothing reaches the stage mid-composition')
  assert.equal(m.inner.doc, before, 'the composed words are left alone')
  // The input method composes its word (ありがとう) a character at a time: nothing is written meanwhile.
  for (const char of 'ありがとう') m.type(char, true)
  assert.equal(m.body(), SLIDE.replace('Ask the question', 'Ask one question'), 'nothing written mid-composition')
  // It ends: the waiting change is laid over the composed word, and the two are written together.
  const tr = m.sync.compositionEnded(m.inner)
  assert.ok(tr, 'the waiting change, once the composition ended')
  m.inner = m.inner.apply(tr!)
  m.writeNow()
  const words = m.body()
  assert.ok(words.includes('Open the fileありがとう'), 'the composed word, whole')
  assert.ok(words.includes('Ask one question'), 'and the change that waited')
  assert.equal(m.inner.selection.from, after(m.inner.doc, 'ありがとう'), 'the caret after the composed word')
  // A composition with no change waiting is written when it ends.
  const n = model(SLIDE)
  n.inner = n.inner.apply(n.inner.tr.setSelection(TextSelection.create(n.inner.doc, after(n.inner.doc, 'Open the file'))))
  for (const char of '日本') n.type(char, true)
  assert.equal(n.body(), SLIDE)
  assert.equal(n.sync.compositionEnded(n.inner), null)
  n.writeNow()
  assert.ok(n.body().includes('Open the file日本'))
}

// ---- A paragraph typed as a `:::` line is written escaped, so it stays words on the next open; a stray `:::` the
// file already had stays as written.
{
  const doc = loadSlide('# T\n\nA')
  const tr = EditorState.create({ doc }).tr
  const paragraph = slideSchema.nodes.paragraph
  tr.insert(tr.doc.content.size, [paragraph.create(null, slideSchema.text('::: columns')), paragraph.create(null, slideSchema.text('Inside?')), paragraph.create(null, slideSchema.text(':::'))])
  const written = save(tr.doc)
  assert.match(written, /^\\::: columns$/m)
  assert.match(written, /^\\:::$/m)
  assert.equal(loadSlide(written).childCount, tr.doc.childCount, 'reopened: words, no block')
  const stray = '# T\n\n:::\n\nText'
  assert.equal(save(loadSlide(stray)), saveSlide(loadSlide(stray)), 'a stray ::: is no block: written as the editor writes it, unescaped')
}

// ---- The fit: down while the words overflow, up only with 3 % of the room to spare; it keeps its step as the words
// grow and shrink, and never swings back and forth.
{
  // Words whose height is `lines` lines of 40 px at full size, scaled by the step's size; 440 px of room.
  const steps = [1, 0.92, 0.84, 0.76, 0.68, 0.6]
  const measureFor = (lines: number) => (step: number): FitMeasure => ({ content: lines * 40 * steps[step], room: 440 })
  let step = 0
  const seen: number[] = []
  for (let lines = 8; lines <= 20; lines++) { step = nextFitStep(step, measureFor(lines)); seen.push(step) }
  assert.deepEqual(seen, [0, 0, 0, 0, 1, 2, 3, 4, 4, 5, 5, 5, 5], 'growing: one step at a time, down to the floor')
  for (const lines of [20, 18, 16, 15, 14, 13, 12]) step = nextFitStep(step, measureFor(lines))
  assert.equal(step, 2, 'shrinking: back up, as far as the room allows')
  // At the edge: the bigger step would fit with less than 3 % to spare, so it stays.
  const edge = (step: number): FitMeasure => ({ content: [431, 400][step] ?? 0, room: 440 })
  assert.equal(nextFitStep(1, edge, 1), 1, 'no swing at the edge')
  assert.equal(nextFitStep(nextFitStep(1, edge, 1), edge, 1), 1, 'and it stays')
  // A step measured again from its own answer never changes.
  for (let lines = 8; lines <= 20; lines++) {
    const once = nextFitStep(0, measureFor(lines))
    assert.equal(nextFitStep(once, measureFor(lines)), once, `stable at ${lines} lines`)
  }
}

console.log('slideSync: passed')
