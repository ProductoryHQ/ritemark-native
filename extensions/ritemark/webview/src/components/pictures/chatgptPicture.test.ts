/**
 * Pictures with ChatGPT in the editor: the request the bar sends, the host's answers moving the field and the strip
 * (ready, sign-in, made, failed, Cancel), the strip's words, and the made picture placed as one undo step, with Try
 * another a second one (⌘Z back to the first, then to the old picture).
 *
 * Run: npx tsx webview/src/components/pictures/chatgptPicture.test.ts
 */
import assert from 'node:assert/strict'
import { EditorState, NodeSelection } from '@tiptap/pm/state'
import { history, undo } from '@tiptap/pm/history'
import type { Node as PMNode } from '@tiptap/pm/model'
import { editorMarkdown, openDocument } from '../../utils/markdownFidelity'
import { replacePicture } from '../../extensions/pictures/pictureCommands'
import { doneWords, followPicture, makeMessage, phaseAfterStatus, sentWords, type MakerPhase, type PictureAsk } from './chatgptPictureState'

let failures = 0
function check(name: string, run: () => void) {
  try {
    run()
  } catch (error) {
    failures += 1
    console.error(`FAIL ${name}`)
    console.error(error)
  }
}

const ask: PictureAsk = { place: { kind: 'flow', pos: 4 }, mode: 'change', suggestion: '', source: 'images/agents.png', words: 'Where agents work\nIn the cloud', name: 'Where agents work' }

check('the request sent to the host: the words, the slide, the picture to change', () => {
  assert.deepEqual(makeMessage(ask, 'At night', 'r1', 's-2'), { requestId: 'r1', mode: 'change', description: 'At night', words: 'Where agents work\nIn the cloud', source: 'images/agents.png', name: 'Where agents work', slideId: 's-2' })
  assert.deepEqual(makeMessage({ place: { kind: 'side' }, mode: 'new', suggestion: 'Title', source: 'images/old.png' }, 'A lake', 'r2'), { requestId: 'r2', mode: 'new', description: 'A lake' }, 'a new picture sends no picture, and a document no slide')
})

check('the host\'s answers move the field and the strip', () => {
  const checking: MakerPhase = { phase: 'checking', ask }
  assert.deepEqual(phaseAfterStatus(checking, { requestId: 'c1', state: 'ready' }, 'c1'), { phase: 'asking', ask })
  assert.deepEqual(phaseAfterStatus(checking, { requestId: 'c1', state: 'sign-in' }, 'c1'), { phase: 'sign-in', ask }, 'not signed in: the sign-in line')
  assert.equal(phaseAfterStatus(checking, { requestId: 'old', state: 'ready' }, 'c1'), undefined, 'another check\'s answer')
  const making: MakerPhase = { phase: 'making', ask, description: 'At night', requestId: 'm1' }
  assert.deepEqual(phaseAfterStatus(making, { requestId: 'm1', state: 'made', path: 'images/a.png', url: 'vscode-webview://a' }, null), { phase: 'done', ask, description: 'At night' })
  assert.deepEqual(phaseAfterStatus(making, { requestId: 'm1', state: 'failed', problem: 'No.' }, null), { phase: 'failed', ask, description: 'At night', problem: 'No.' })
  assert.deepEqual(phaseAfterStatus(making, { requestId: 'm1', state: 'cancelled' }, null), { phase: 'idle' }, 'Cancel closes it')
  assert.deepEqual(phaseAfterStatus(making, { requestId: 'm1', state: 'sign-in' }, null), { phase: 'sign-in', ask })
  assert.equal(phaseAfterStatus(making, { requestId: 'm0', state: 'made', path: 'p', url: 'u' }, null), undefined, 'a cancelled request\'s late picture is ignored')
  assert.equal(phaseAfterStatus({ phase: 'idle' }, { requestId: 'm1', state: 'made', path: 'p', url: 'u' }, null), undefined, 'after Cancel nothing is placed')
})

check('the strip\'s words (experience 46 and 49)', () => {
  assert.equal(doneWords('new'), 'ChatGPT made the picture. It\'s in images/.')
  assert.equal(doneWords('change'), 'ChatGPT changed the picture. The old one is still in images/.')
  assert.equal(sentWords({ mode: 'new', words: 'x' }), 'ChatGPT gets these words and the slide\'s words.')
  assert.equal(sentWords({ mode: 'change' }), 'ChatGPT gets these words and this picture.')
})

function firstPicture(doc: PMNode): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === 'image') found = pos
  })
  return found
}

check('made, then Try another: each one undo step; ⌘Z goes back to the first, then to the old picture', () => {
  const before = 'Before.\n\n![Three agents](images/agents.png){width=50% align=center}\n\nAfter.'
  let state = EditorState.create({ doc: openDocument(`${before}\n`).doc, plugins: [history()] })
  state = state.apply(state.tr.setSelection(NodeSelection.create(state.doc, firstPicture(state.doc))))
  const pos = firstPicture(state.doc)
  state = state.apply(replacePicture(state, pos, { src: 'vscode-webview://made-1', title: './images/at-night.png' })!)
  assert.equal(editorMarkdown(state.doc), 'Before.\n\n![](./images/at-night.png){width=50% align=center}\n\nAfter.', 'the size stays; the made picture in its place')
  state = state.apply(replacePicture(state, firstPicture(state.doc), { src: 'vscode-webview://made-2', title: './images/at-night-2.png' })!)
  assert.equal(editorMarkdown(state.doc), 'Before.\n\n![](./images/at-night-2.png){width=50% align=center}\n\nAfter.')
  undo(state, tr => { state = state.apply(tr) })
  assert.equal(editorMarkdown(state.doc), 'Before.\n\n![](./images/at-night.png){width=50% align=center}\n\nAfter.', 'one Undo: the first one')
  undo(state, tr => { state = state.apply(tr) })
  assert.equal(editorMarkdown(state.doc), before, 'and the old picture, with its description')
})

check('the place follows edits; a block written again with its picture keeps it; a deleted picture ends it', () => {
  const text = 'Before.\n\n![Three agents](images/agents.png)\n\nAfter.\n'
  let state = EditorState.create({ doc: openDocument(text).doc })
  const pos = firstPicture(state.doc)
  // Typing before the picture moves it.
  const typed = state.tr.insertText('Well. ', 1)
  assert.equal(followPicture(typed.doc, typed.mapping, pos), pos + 6)
  // The slide's sync writes the picture's block again (the made picture coming back from the deck): still the place.
  const $pos = state.doc.resolve(pos)
  const block = $pos.depth > 0 ? { from: $pos.before($pos.depth), to: $pos.after($pos.depth) } : { from: pos, to: pos + state.doc.nodeAt(pos)!.nodeSize }
  const rewritten = state.tr.replaceWith(block.from, block.to, state.doc.slice(block.from, block.to).content)
  assert.equal(followPicture(rewritten.doc, rewritten.mapping, pos), pos)
  // The picture deleted: its place is gone, and a request for it stops.
  const node = state.doc.nodeAt(pos)!
  const deleted = state.tr.delete(pos, pos + node.nodeSize)
  assert.equal(followPicture(deleted.doc, deleted.mapping, pos), null)
  state = state.apply(typed)
})

if (failures) {
  console.error(`chatgpt pictures: ${failures} failed`)
  process.exit(1)
}
console.log('chatgpt pictures: all assertions passed')
