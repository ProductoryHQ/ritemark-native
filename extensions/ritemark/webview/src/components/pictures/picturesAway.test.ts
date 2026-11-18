/**
 * Pictures with ChatGPT while the slide is left (Jarmo's test of #800, 18 November: "Change this picture with ChatGPT"
 * was lost when he moved to another slide). The slide's editor hands its request on as it goes (`picturesAway.ts`);
 * the host's answer then lands the picture on that slide and picture in the deck (`putSlidePicture`), as one undo
 * step, whichever slide is showing; back on the slide its strip is as if he had stayed. A place gone when the picture
 * comes (the slide deleted, the picture replaced by hand) changes nothing in the deck.
 *
 * Run: npx tsx webview/src/components/pictures/picturesAway.test.ts
 */
import assert from 'node:assert/strict'
import { getSchema } from '@tiptap/core'
import { EditorState, type Transaction } from '@tiptap/pm/state'
import { history, undo } from '@tiptap/pm/history'
import { createEditorSchemaExtensions } from '../../utils/editorMarkdown'
import { installTestDocument } from '../../utils/markdownFidelity'
import { DeckSlide } from '../decks/handout/deckSchema'
import { slidesOf } from '../decks/deckDocument'
import { loadSlide, saveSlide } from '../decks/blocks/slideEditorHarness'
import { pictureNthAt, picturePosOf, putSlidePicture, type SlideDocKit, type SlidePictureTarget } from '../decks/blocks/slidePictureSwap'
import { madeDescription, type PictureAsk, type PicturePlaceRef } from './chatgptPictureState'
import { PicturesAway, type AwayLanding } from './picturesAway'

installTestDocument()

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

const schema = getSchema(createEditorSchemaExtensions({ deck: [DeckSlide] }))
const block = (body: string) => schema.nodes.deckSlide.create({ kind: '', body, notes: null })
const WORDS = '---\nid: s1\n---\n# Where agents work\n\n![The old harbour](images/old.png)\n\nIn the cloud\n\n![](images/old.png)'
const SIDE = '---\nid: s2\npicture: right\nimage: images/side.png\nalt: A desk\n---\n# Two tools'
const EMPTY_SIDE = '---\nid: s3\npicture: left\n---\n# A new place'

/** A deck of three slides, with the handout's history, as the deck view holds it. */
function deck(): { state: EditorState; dispatch: (tr: Transaction) => void } {
  const doc = schema.node('doc', null, [block(WORDS), block(SIDE), block(EMPTY_SIDE)])
  const holder = { state: EditorState.create({ doc, plugins: [history()] }), dispatch: (tr: Transaction) => { holder.state = holder.state.apply(tr) } }
  return holder
}
const bodyOf = (state: EditorState, id: string) => slidesOf(state.doc).find(entry => entry.data.id === id)?.node.attrs.body as string | undefined
const kit: SlideDocKit = { load: loadSlide, save: saveSlide }
const described = (asked: string) => (currentAlt: string) => madeDescription(currentAlt, asked)

/**
 * What the slide editor's `away.land` does with the deck it belongs to: the picture into the deck, an undo step of its
 * own, and the strip's Undo.
 */
function landOn(holder: ReturnType<typeof deck>, slideId: string, place: PicturePlaceRef, asked: string) {
  return (made: { path: string; url: string }): AwayLanding | null => {
    const target: SlidePictureTarget = place.kind === 'side'
      ? { slide: { id: slideId, index: 0 }, side: true, path: place.path ?? '' }
      : { slide: { id: slideId, index: 0 }, side: false, path: place.path ?? '', nth: place.nth ?? 0 }
    const put = putSlidePicture(holder.state, target, { picture: { ...made, describe: described(asked) } }, kit)
    if (!put) return null
    holder.dispatch(put.tr)
    const landed = holder.state.doc
    const madeTarget: SlidePictureTarget = place.kind === 'side' ? { ...target, path: made.path } as SlidePictureTarget : { slide: target.slide, side: false, path: made.path, nth: put.nth }
    return {
      place: place.kind === 'side' ? { kind: 'side', path: made.path } : { kind: 'flow', pos: 0, path: made.path, nth: put.nth },
      undo: () => {
        if (holder.state.doc === landed) { undo(holder.state, holder.dispatch); return }
        const back = putSlidePicture(holder.state, madeTarget, { restore: put.before }, kit)
        if (back) holder.dispatch(back.tr)
      },
    }
  }
}

const changeAsk = (place: PicturePlaceRef): PictureAsk => ({ place, mode: 'change', suggestion: '', source: 'images/old.png', words: 'Where agents work', name: 'Where agents work' })

check('a slide left while ChatGPT changes its picture: the picture lands on that slide and that picture in the deck', () => {
  const holder = deck()
  const away = new PicturesAway()
  // The second picture of the words, the one asked for, as the slide editor hands it on when the slide goes.
  const words = loadSlide('# Where agents work\n\n![The old harbour](images/old.png)\n\nIn the cloud\n\n![](images/old.png)')
  let second = -1
  words.descendants((node, pos) => { if (node.type.name === 'image') second = pos })
  assert.deepEqual(pictureNthAt(words, second), { id: 'images/old.png', nth: 1 })
  const place: PicturePlaceRef = { kind: 'flow', pos: second, path: 'images/old.png', nth: 1 }
  away.hand({ requestId: 'r1', key: 'id:s1', ask: changeAsk(place), description: 'At night', land: landOn(holder, 's1', place, 'At night') })
  const before = holder.state.doc
  // Another slide is showing when the host's answer comes.
  assert.equal(away.status({ requestId: 'r1', state: 'made', path: 'images/where-agents-work.png', url: 'vscode-resource://images/where-agents-work.png' }), true)
  const body = bodyOf(holder.state, 's1')!
  assert.match(body, /!\[The old harbour\]\(images\/old\.png\)/, 'the first picture stays')
  assert.match(body, /!\[At night\]\(images\/where-agents-work\.png\)/, 'the second is ChatGPT\'s, described with the words asked')
  assert.equal(bodyOf(holder.state, 's2'), SIDE, 'no other slide changes')
  // One ⌘Z puts the old picture back.
  undo(holder.state, holder.dispatch)
  assert.ok(holder.state.doc.eq(before), 'one undo: the deck as it was')
})

check('back on the slide: "making" with Cancel while it is made, then the picture comes as if he had stayed', () => {
  const holder = deck()
  const away = new PicturesAway()
  const place: PicturePlaceRef = { kind: 'flow', pos: 3, path: 'images/old.png', nth: 0 }
  away.hand({ requestId: 'r2', key: 'id:s1', ask: changeAsk(place), description: 'At night', land: landOn(holder, 's1', place, 'At night') })
  // The slide is back: its editor finds the picture in its words again.
  const words = loadSlide(WORDS.split('---\n')[2])
  const resumed = away.take('id:s1', found => (found.kind === 'flow' && found.path ? { kind: 'flow', pos: picturePosOf(words, found.path, found.nth ?? 0)!, path: found.path } : null))
  assert.equal(resumed?.phase, 'making')
  assert.equal(resumed?.phase === 'making' && resumed.requestId, 'r2', 'the strip waits for the same request (its Cancel stops it)')
  assert.equal(away.heldFor('id:s1'), 0, 'the slide\'s editor answers it now')
  assert.equal(away.status({ requestId: 'r2', state: 'made', path: 'images/x.png', url: 'u' }), false, 'not landed twice')
  assert.equal(bodyOf(holder.state, 's1'), WORDS, 'the editor shown places it itself')
})

check('the side picture changed while away: done line on return, its Undo puts the old one back even after other edits', () => {
  const holder = deck()
  const away = new PicturesAway()
  const place: PicturePlaceRef = { kind: 'side', path: 'images/side.png' }
  away.hand({ requestId: 'r3', key: 'id:s2', ask: { ...changeAsk(place), source: 'images/side.png' }, description: 'A desk at dawn', land: landOn(holder, 's2', place, 'A desk at dawn') })
  away.status({ requestId: 'r3', state: 'made', path: 'images/two-tools.png', url: 'u' })
  assert.match(bodyOf(holder.state, 's2')!, /image: images\/two-tools\.png/)
  assert.match(bodyOf(holder.state, 's2')!, /alt: A desk\n/, 'the description the person wrote stays (#800)')
  // Words typed on another slide after the picture came.
  const s3 = slidesOf(holder.state.doc).find(entry => entry.data.id === 's3')!
  holder.dispatch(holder.state.tr.setNodeMarkup(s3.pos, undefined, { ...s3.node.attrs, body: s3.node.attrs.body + '\n\nTyped after' }))
  const resumed = away.take('id:s2', found => found)
  assert.equal(resumed?.phase, 'done', 'back on the slide: "ChatGPT changed the picture…" with Undo and Try another')
  assert.ok(resumed?.phase === 'done' && resumed.undo)
  if (resumed?.phase === 'done') resumed.undo!()
  assert.equal(bodyOf(holder.state, 's2'), SIDE, 'the old picture is back, with its description')
  assert.match(bodyOf(holder.state, 's3')!, /Typed after/, 'the words typed after it stay')
})

check('make a new picture for an empty place on a slide left meanwhile', () => {
  const holder = deck()
  const away = new PicturesAway()
  const place: PicturePlaceRef = { kind: 'side', path: '' }
  away.hand({ requestId: 'r4', key: 'id:s3', ask: { place, mode: 'new', suggestion: 'A new place' }, description: 'A quiet lake', land: landOn(holder, 's3', place, 'A quiet lake') })
  away.status({ requestId: 'r4', state: 'made', path: 'images/a-new-place.png', url: 'u' })
  assert.match(bodyOf(holder.state, 's3')!, /image: images\/a-new-place\.png/)
  assert.match(bodyOf(holder.state, 's3')!, /alt: A quiet lake/)
  const resumed = away.take('id:s3', found => found)
  assert.equal(resumed?.phase, 'done')
  undo(holder.state, holder.dispatch)
  assert.equal(bodyOf(holder.state, 's3'), EMPTY_SIDE, 'one ⌘Z: the empty place again')
})

check('the place gone when the picture comes: the deck stays as it is (the file stays in images/)', () => {
  // The slide deleted meanwhile.
  const holder = deck()
  const away = new PicturesAway()
  const side: PicturePlaceRef = { kind: 'side', path: 'images/side.png' }
  away.hand({ requestId: 'r5', key: 'id:s2', ask: changeAsk(side), description: 'x', land: landOn(holder, 's2', side, 'x') })
  const s2 = slidesOf(holder.state.doc).find(entry => entry.data.id === 's2')!
  holder.dispatch(holder.state.tr.delete(s2.pos, s2.pos + s2.node.nodeSize))
  const left = holder.state.doc
  assert.equal(away.status({ requestId: 'r5', state: 'made', path: 'images/x.png', url: 'u' }), true)
  assert.ok(holder.state.doc.eq(left), 'nothing written')
  assert.equal(away.take('id:s2', found => found), null, 'nothing to show when the slide is back')

  // The picture replaced by hand meanwhile (another file in its place).
  const other = deck()
  const flow: PicturePlaceRef = { kind: 'flow', pos: 0, path: 'images/old.png', nth: 1 }
  away.hand({ requestId: 'r6', key: 'id:s1', ask: changeAsk(flow), description: 'x', land: landOn(other, 's1', flow, 'x') })
  const s1 = slidesOf(other.state.doc).find(entry => entry.data.id === 's1')!
  const replaced = WORDS.replace(/!\[\]\(images\/old\.png\)/, '![](images/chosen.png)')
  other.dispatch(other.state.tr.setNodeMarkup(s1.pos, undefined, { ...s1.node.attrs, body: replaced }))
  const chosen = other.state.doc
  away.status({ requestId: 'r6', state: 'made', path: 'images/x.png', url: 'u' })
  assert.ok(other.state.doc.eq(chosen), 'the picture chosen by hand stays')
  assert.equal(bodyOf(other.state, 's1'), replaced)
})

check('a failure while away is shown when the slide is back; a cancel is forgotten', () => {
  const holder = deck()
  const away = new PicturesAway()
  const side: PicturePlaceRef = { kind: 'side', path: 'images/side.png' }
  away.hand({ requestId: 'r7', key: 'id:s2', ask: changeAsk(side), description: 'x', land: landOn(holder, 's2', side, 'x') })
  away.status({ requestId: 'r7', state: 'failed', problem: 'ChatGPT couldn\'t make the picture. Try again.' })
  const failed = away.take('id:s2', found => found)
  assert.equal(failed?.phase, 'failed')
  away.hand({ requestId: 'r8', key: 'id:s2', ask: changeAsk(side), description: 'x', land: landOn(holder, 's2', side, 'x') })
  away.status({ requestId: 'r8', state: 'cancelled' })
  assert.equal(away.take('id:s2', found => found), null)
  assert.equal(away.status({ requestId: 'other', state: 'made', path: 'a', url: 'b' }), false, 'another editor\'s answer is not this one\'s')
})

if (failures) {
  console.error(`${failures} failing`)
  process.exit(1)
}
console.log('picturesAway: all checks passed')
