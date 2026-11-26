/**
 * Pictures with ChatGPT in the editor: the request the bar sends, the host's answers moving the field and the strip
 * (ready, sign-in, made, failed, Cancel), the strip's words, and the made picture placed as one undo step, with Try
 * another a second one (⌘Z back to the first, then to the old picture).
 *
 * Run: npx tsx webview/src/components/pictures/chatgptPicture.test.ts
 */
import assert from 'node:assert/strict'
import { EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state'
import { history, undo } from '@tiptap/pm/history'
import type { Node as PMNode } from '@tiptap/pm/model'
import { editorMarkdown, openDocument } from '../../utils/markdownFidelity'
import { chosenPicture, replacePicture, replacePictureKeepingCaret } from '../../extensions/pictures/pictureCommands'
import { imagePathOf } from '../../extensions/pictures/PictureNode'
import { madeDescription, pictureKey } from './chatgptPictureState'
import { doneWords, followPicture, makeMessage, phaseAfterStatus, sentWords, type MakerPhase, type PictureAsk } from './chatgptPictureState'

let failures = 0
const same = (path: string) => (attrs: Record<string, unknown>) => imagePathOf(attrs) === path
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
  assert.deepEqual(phaseAfterStatus(checking, { requestId: 'c1', state: 'failed', problem: 'API key.' }, 'c1'), { phase: 'failed', ask, description: '', problem: 'API key.' }, 'a check that fails says why, with nothing to try again')
  const making: MakerPhase = { phase: 'making', ask, description: 'At night', requestId: 'm1' }
  assert.deepEqual(phaseAfterStatus(making, { requestId: 'm1', state: 'made', path: 'images/a.png', url: 'vscode-webview://a' }, null), { phase: 'done', ask: { ...ask, place: { kind: 'flow', pos: 4, path: 'images/a.png' } }, description: 'At night' }, 'the place now follows the made picture')
  assert.deepEqual(phaseAfterStatus(making, { requestId: 'm1', state: 'failed', problem: 'No.' }, null), { phase: 'failed', ask, description: 'At night', problem: 'No.' })
  assert.deepEqual(phaseAfterStatus(making, { requestId: 'm1', state: 'cancelled' }, null), { phase: 'idle' }, 'Cancel closes it')
  assert.deepEqual(phaseAfterStatus(making, { requestId: 'm1', state: 'sign-in' }, null), { phase: 'sign-in', ask })
  assert.equal(phaseAfterStatus(making, { requestId: 'm0', state: 'made', path: 'p', url: 'u' }, null), undefined, 'a cancelled request\'s late picture is ignored')
  assert.equal(phaseAfterStatus({ phase: 'idle' }, { requestId: 'm1', state: 'made', path: 'p', url: 'u' }, null), undefined, 'after Cancel nothing is placed')
})

check('the strip\'s words (experience 46 and 49)', () => {
  assert.equal(doneWords('new'), 'ChatGPT made the picture. It\'s in images/.')
  assert.equal(doneWords('change'), 'ChatGPT changed the picture. The old one is still in images/.')
  assert.equal(doneWords('new', 'Kickoff files'), "ChatGPT made the picture. It's in Kickoff files.")
  assert.equal(doneWords('change', 'Kickoff files'), 'ChatGPT changed the picture. The new one is in Kickoff files.')
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
  assert.equal(followPicture(typed.doc, typed.mapping, pos, same('images/agents.png')), pos + 6)
  // The slide's sync writes the picture's block again (the made picture coming back from the deck): still the place.
  const $pos = state.doc.resolve(pos)
  const block = $pos.depth > 0 ? { from: $pos.before($pos.depth), to: $pos.after($pos.depth) } : { from: pos, to: pos + state.doc.nodeAt(pos)!.nodeSize }
  const rewritten = state.tr.replaceWith(block.from, block.to, state.doc.slice(block.from, block.to).content)
  assert.equal(followPicture(rewritten.doc, rewritten.mapping, pos, same('images/agents.png')), pos)
  assert.equal(followPicture(rewritten.doc, rewritten.mapping, pos, same('images/other.png')), null, 'another picture in the place is not this one')
  // The picture deleted: its place is gone, and a request for it stops.
  const node = state.doc.nodeAt(pos)!
  const deleted = state.tr.delete(pos, pos + node.nodeSize)
  assert.equal(followPicture(deleted.doc, deleted.mapping, pos, same('images/agents.png')), null)
  // Deleted, with the next paragraph's picture moving up into its place: still gone (review of #800).
  const two = EditorState.create({ doc: openDocument('![A](images/a.png)\n\n![B](images/b.png)\n').doc })
  const first = firstPicture(two.doc)
  const $first = two.doc.resolve(first)
  const firstBlock = $first.depth > 0 ? { from: $first.before($first.depth), to: $first.after($first.depth) } : { from: first, to: first + two.doc.nodeAt(first)!.nodeSize }
  const gone = two.tr.delete(firstBlock.from, firstBlock.to)
  assert.equal(gone.doc.nodeAt(first)?.type.name, 'image', 'B moved up into the place')
  assert.equal(followPicture(gone.doc, gone.mapping, first, same('images/a.png')), null)
  state = state.apply(typed)
})

check('a picture that comes back while the person types elsewhere never takes the caret (the next key keeps it)', () => {
  const text = 'Before.\n\n![Three agents](images/agents.png)\n\nAfter.\n'
  let state = EditorState.create({ doc: openDocument(text).doc, plugins: [history()] })
  const pos = firstPicture(state.doc)
  // The caret in "After.", where the person types on.
  const after = state.doc.content.size - 2
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, after)))
  state = state.apply(replacePictureKeepingCaret(state, pos, { src: 'vscode-webview://made', title: './images/made.png' })!)
  assert.equal(chosenPicture(state), null, 'the made picture is not chosen')
  assert.equal(state.selection.from, after, 'the caret stayed')
  state = state.apply(state.tr.insertText('x'))
  assert.match(editorMarkdown(state.doc), /!\[\]\(\.\/images\/made\.png\)/, 'the next key kept the picture')
  // Still chosen (the person waited on it): the made one is chosen, as Replace picture… does.
  let waited = EditorState.create({ doc: openDocument(text).doc })
  waited = waited.apply(waited.tr.setSelection(NodeSelection.create(waited.doc, pos)))
  waited = waited.apply(replacePictureKeepingCaret(waited, pos, { src: 'u', title: './images/made.png' })!)
  assert.equal(chosenPicture(waited)?.pos, pos)
})

check('a made picture is described by the words asked, unless the person wrote their own (#800)', () => {
  assert.equal(madeDescription('', 'The quay at night'), 'The quay at night', 'no description: the words asked')
  assert.equal(madeDescription('  ', 'Two lines\nof words'), 'Two lines of words', 'one line, always')
  assert.equal(madeDescription('Our crane crew at work', 'The quay at night'), 'Our crane crew at work', 'the person\'s own words stay')
  // Change this picture…: ChatGPT's own words (the request that made it) are replaced; the person's stay.
  assert.equal(madeDescription('The quay at night', 'Busier, with a ship', 'The quay at night'), 'Busier, with a ship')
  assert.equal(madeDescription('The quay at night, edited', 'Busier, with a ship', 'The quay at night'), 'The quay at night, edited')
  assert.equal(pictureKey('./images/a.png'), pictureKey('images/a.png'))
})

check('the description goes in with the made picture, in the same undo step', () => {
  const text = 'Before.\n\n![](images/agents.png){width=50%}\n\nAfter.\n'
  let state = EditorState.create({ doc: openDocument(text).doc, plugins: [history()] })
  const pos = firstPicture(state.doc)
  state = state.apply(replacePictureKeepingCaret(state, pos, { src: 'u', title: './images/the-quay-at-night.png' }, 'The quay at night')!)
  assert.equal(editorMarkdown(state.doc), 'Before.\n\n![The quay at night](./images/the-quay-at-night.png){width=50%}\n\nAfter.')
  undo(state, tr => { state = state.apply(tr) })
  assert.equal(editorMarkdown(state.doc), 'Before.\n\n![](images/agents.png){width=50%}\n\nAfter.', 'one Undo takes both back')
})

if (failures) {
  console.error(`chatgpt pictures: ${failures} failed`)
  process.exit(1)
}
console.log('chatgpt pictures: all assertions passed')
