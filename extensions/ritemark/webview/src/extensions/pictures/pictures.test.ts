/**
 * One picture editor (experience 49): a picture's look kept beside its image line, read and written by both editors,
 * byte for byte, each change one undo step; an untouched picture never changes; the slide renderer and the published
 * page draw the same look.
 */
import assert from 'node:assert/strict'
import { EditorState, NodeSelection } from '@tiptap/pm/state'
import { history, undo } from '@tiptap/pm/history'
import type { Node as PMNode } from '@tiptap/pm/model'
import { editorMarkdown, openAndSave, openDocument } from '../../utils/markdownFidelity'
import { loadSlide, saveSlide } from '../../components/decks/blocks/slideEditorHarness'
import {
  CROP_PRESETS,
  cropOfRegion,
  dragRegion,
  draggedWidth,
  lookOf,
  markdownAlt,
  moveRegion,
  pictureMarkup,
  presetRegion,
  regionOf,
  sizeOf,
  withLook,
} from '../../../../src/markdown/pictureLook'
import { blockSlideHtml, blockSlideMarkup, isCoverSlide, sidePictureOf } from '../../../../src/decks/blocks/slideRenderer'
import { slideDataOf, splitBlockSlide, withBlockMarkdown, writeSlideData } from '../../../../src/decks/deckFormat'
import { BUILT_IN_THEME as DEFAULT_THEME } from '../../../../src/decks/deckTheme'
import { EMPTY_SIDE, flowToSide, sideToText } from '../../components/decks/blocks/slidePicturePlace'
import { CORNERS, cornerOf, frameBox, localBox, pictureBarPlacement, resizedWidth, screenPoint, wholeBox } from '../../components/pictures/pictureGeometry'
import { caretBeforePicture, chosenPicture, chosenPictureUnder, leavePicture, pictureEditorEnabled, removePicture, setPictureEditorEnabled, replacePicture, setPictureAlt, setPictureLook } from './pictureCommands'

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

// ---- the attribute block, read and written

check('a block is read strictly, and anything it can not read is no look', () => {
  assert.deepEqual(lookOf('{width=50% align=center crop=16:9 zoom=1.5 focus=40,30}'), { width: '50%', align: 'center', crop: '16:9', zoom: 1.5, focus: { x: 40, y: 30 } })
  assert.deepEqual(lookOf('{.caption width=260px}'), { width: '260px', caption: true })
  assert.deepEqual(lookOf('{width=50%;background:url(x)}'), {})
  assert.deepEqual(lookOf('{width=120% align=middle crop=0:0 zoom=99 focus=200,1}'), {})
  assert.deepEqual(lookOf(null), {})
})

check('withLook keeps what it does not own, and a block that already says it byte for byte', () => {
  assert.equal(withLook('{ width="50%"  foo=bar }', { width: '50%' }), '{ width="50%"  foo=bar }')
  assert.equal(withLook('{#fig .wide width=50% foo="a b"}', { width: '75%', align: 'center' }), '{#fig .wide width=75% foo="a b" align=center}')
  assert.equal(withLook('{width=50%}', {}), '')
  assert.equal(withLook('', { caption: true }), '{.caption}')
  assert.equal(withLook('{foo=bar width=50%}', {}), '{foo=bar}')
})

check('sizes: S, M, L and Full by context, and a drag snaps to them', () => {
  assert.equal(sizeOf('50%', 'document'), 'M')
  assert.equal(sizeOf('260px', 'slide'), 'M')
  assert.equal(sizeOf('50%', 'slide'), null)
  assert.equal(draggedWidth(402, 800, 'document'), '50%')
  assert.equal(draggedWidth(300, 800, 'document'), '38%')
  assert.equal(draggedWidth(395, 832, 'slide'), '400px')
  assert.equal(draggedWidth(330, 832, 'slide'), '330px')
  assert.equal(draggedWidth(5000, 832, 'slide'), '100%')
})

check('the S document bar sits 8 px beside the picture, bottom-aligned and without reserved room', () => {
  const picture = { left: 80.5, top: 140.5, width: 160, height: 100 }
  assert.deepEqual(pictureBarPlacement(260, 36, 600, false, { picture, width: 320, right: 600 }), {
    left: 248.5, top: 204.5, room: 0,
  })
})

check('the S bar reserves room below a narrow table cell picture, even near the viewport edges', () => {
  const barHeight = 36
  for (const bottom of [24.5, 280, 584]) {
    const picture = { left: 80, top: bottom - 24, width: 60, height: 24 }
    const { left, top, room } = pictureBarPlacement(bottom, barHeight, 600, false, { picture, width: 320, right: 320 })
    assert.equal(left, undefined)
    assert.equal(top, Math.round(bottom + 10))
    assert.equal(room, 47)
    assert.ok(top + barHeight <= bottom + room, 'the bar clears even a next block with no margin')
  }
})

check('the S bar in a deep list item uses the remaining row width after indentation and alignment', () => {
  const picture = { left: 260, top: 180, width: 120, height: 100 }
  assert.deepEqual(pictureBarPlacement(280, 36, 600, false, { picture, width: 320, right: 708 }), {
    left: 388, top: 244, room: 0,
  })
  assert.deepEqual(pictureBarPlacement(280, 36, 600, false, { picture, width: 320, right: 707 }), { top: 290, room: 47 })
  assert.deepEqual(pictureBarPlacement(280, 36, 600, false, {
    picture: { ...picture, left: 588 }, width: 320, right: 708,
  }), { top: 290, room: 47 })
})

check('the M bar keeps its gap and its viewport fallback', () => {
  assert.deepEqual(pictureBarPlacement(280, 36, 600, false), { top: 290, room: 0 })
  assert.deepEqual(pictureBarPlacement(584, 36, 600, false), { top: 538, room: 0 })
})

check('crop: a region and its look are the same frame, presets keep their names', () => {
  const aspect = 3 / 2
  for (const region of [{ x: 0.1, y: 0.2, w: 0.5, h: 0.4 }, { x: 0, y: 0.25, w: 1, h: 0.5 }, { x: 0.3, y: 0, w: 0.4, h: 1 }]) {
    const look = cropOfRegion(region, aspect)
    const back = regionOf(look, aspect)
    for (const key of ['x', 'y', 'w', 'h'] as const) assert.ok(Math.abs(back[key] - region[key]) < 0.003, `${key}: ${back[key]} vs ${region[key]}`)
  }
  assert.deepEqual(cropOfRegion({ x: 0, y: 0, w: 1, h: 1 }, aspect), {})
  const wide = presetRegion('16:9', aspect)
  assert.equal(cropOfRegion(wide, aspect).crop, '16:9')
  assert.equal(cropOfRegion(presetRegion('1:1', aspect), aspect).crop, '1:1')
  assert.equal(CROP_PRESETS[0].label, 'Original')
  // A frame never leaves the picture, and a shape held stays held.
  const moved = moveRegion({ x: 0.5, y: 0.5, w: 0.4, h: 0.4 }, 0.5, -0.9)
  assert.deepEqual(moved, { x: 0.6, y: 0, w: 0.4, h: 0.4 })
  const held = dragRegion(presetRegion('1:1', aspect), 'se', -0.1, 0, 1, aspect)
  assert.ok(Math.abs((held.w / held.h) * aspect - 1) < 1e-9)
})

check('pictureMarkup: a bare picture is untouched; a sized one gets its style; a crop gets its frame', () => {
  const img = '<img src="a.png" alt="A">'
  assert.equal(pictureMarkup(img, {}), img)
  assert.equal(pictureMarkup(img, { width: '50%' }), '<img style="width:50%;max-width:100%" src="a.png" alt="A">')
  const framed = pictureMarkup(img, { crop: '16:9', caption: true }, { caption: 'A' })
  assert.match(framed, /^<span class="pic has-caption" style="display:block;width:fit-content;max-width:100%"><span class="pic-box" style="display:block;position:relative;overflow:hidden;aspect-ratio:1.7778"><img style="[^"]*object-fit:cover[^"]*" src="a.png" alt="A"><\/span><span class="pic-cap">A<\/span><\/span>$/)
})

// ---- the Text editor: load, save and the commands

function docState(markdown: string): EditorState {
  return EditorState.create({ doc: openDocument(markdown).doc, plugins: [history()] })
}
function firstPicture(doc: PMNode): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === 'image') found = pos
  })
  assert.ok(found >= 0, 'a picture')
  return found
}
function chooseFirst(state: EditorState): EditorState {
  return state.apply(state.tr.setSelection(NodeSelection.create(state.doc, firstPicture(state.doc))))
}

const DOC = '# Notes\n\nBefore.\n\n![A team at work](images/team.jpg)\n\nAfter.\n'

check('an untouched picture, with or without a block, is written back byte for byte', () => {
  for (const text of [
    DOC,
    '# Notes\n\n![A](images/a.png){width=50%}\n\nAfter.\n',
    '# Notes\n\n![A](images/a.png){ width="50%"  .caption   foo=bar }\n',
  ]) assert.equal(openAndSave(text), text)
  // A block on the next line is words, not the picture's.
  assert.equal(openAndSave('![a](a.png)\n{width=50%}\n'), '![a](a.png)\n\n{width=50%}\n')
  // Braces after a picture that are no block stay words (the editor puts a picture on a line of its own, as before).
  assert.equal(openAndSave('![a](a.png){not a block}\n'), '![a](a.png)\n\n{not a block}\n')
})

check('size, align, crop and the description each round-trip as one undo step', () => {
  const steps: [string, (state: EditorState, pos: number) => ReturnType<typeof setPictureLook>, string][] = [
    ['size', (state, pos) => setPictureLook(state, pos, { width: '50%' }), '![A team at work](images/team.jpg){width=50%}'],
    ['align', (state, pos) => setPictureLook(state, pos, { align: 'center' }), '![A team at work](images/team.jpg){align=center}'],
    ['crop', (state, pos) => setPictureLook(state, pos, { crop: '16:9', zoom: 1.25, focus: { x: 40, y: 30 } }), '![A team at work](images/team.jpg){crop=16:9 zoom=1.25 focus=40,30}'],
    ['caption', (state, pos) => setPictureLook(state, pos, { caption: true }), '![A team at work](images/team.jpg){.caption}'],
    ['description', (state, pos) => setPictureAlt(state, pos, 'The team, at the whiteboard'), '![The team, at the whiteboard](images/team.jpg)'],
  ]
  for (const [name, make, line] of steps) {
    let state = chooseFirst(docState(DOC))
    const tr = make(state, firstPicture(state.doc))
    assert.ok(tr, name)
    state = state.apply(tr!)
    assert.equal(editorMarkdown(state.doc), DOC.replace('![A team at work](images/team.jpg)', line).replace(/\n$/, ''), name)
    // Read back: the same picture, the same look.
    assert.equal(openAndSave(`${editorMarkdown(state.doc)}\n`), `${editorMarkdown(state.doc)}\n`, `${name} reads back`)
    assert.ok(chosenPicture(state), `${name} keeps the picture chosen`)
    // One Undo takes it back, byte for byte.
    let undone = state
    undo(undone, tr => { undone = undone.apply(tr) })
    assert.equal(`${editorMarkdown(undone.doc)}\n`, DOC, `${name} undoes in one step`)
  }
})

check('a change that says what the block says already writes nothing', () => {
  const state = chooseFirst(docState('![A](a.png){width=50%}\n'))
  assert.equal(setPictureLook(state, firstPicture(state.doc), { width: '50%' }), null)
})

check('Remove takes the picture out (one undo brings it back)', () => {
  let state = chooseFirst(docState('Before.\n\n![A](images/a.png){width=50% crop=1:1}\n\nAfter.\n'))
  const removed = state.apply(removePicture(state, firstPicture(state.doc))!)
  assert.equal(editorMarkdown(removed.doc), 'Before.\n\nAfter.')
  let back = removed
  undo(back, tr => { back = back.apply(tr) })
  assert.equal(editorMarkdown(back.doc), 'Before.\n\n![A](images/a.png){width=50% crop=1:1}\n\nAfter.')
})

check('Replace (or a double click) keeps size, alignment and place; crop, focus and description start fresh; one Undo', () => {
  const before = 'Before.\n\n![The old one](images/a.png){.caption width=50% align=center crop=1:1 zoom=1.5 focus=30,40 foo=bar}\n\nAfter.'
  let state = chooseFirst(docState(`${before}\n`))
  state = state.apply(replacePicture(state, firstPicture(state.doc), { src: 'images/b.png', title: 'images/b.png' })!)
  assert.equal(editorMarkdown(state.doc), 'Before.\n\n![](images/b.png){width=50% align=center foo=bar}\n\nAfter.')
  assert.ok(chosenPicture(state), 'the new picture stays chosen')
  let back = state
  undo(back, tr => { back = back.apply(tr) })
  assert.equal(editorMarkdown(back.doc), before, 'one Undo brings the old picture back with all its settings')
})

// ---- the slide editor

const SLIDE = '# Where agents work\n\nIn the cloud.\n\n![Three agents](images/agents.png)'

check('on a slide: size, align and crop round-trip byte for byte; untouched stays untouched', () => {
  assert.equal(saveSlide(loadSlide(SLIDE)), SLIDE)
  assert.equal(saveSlide(loadSlide(`${SLIDE}{width=260px align=center}`)), `${SLIDE}{width=260px align=center}`)
  let state = EditorState.create({ doc: loadSlide(SLIDE) })
  state = state.apply(state.tr.setSelection(NodeSelection.create(state.doc, firstPicture(state.doc))))
  for (const [change, block] of [
    [{ width: '260px' }, '{width=260px}'],
    [{ align: 'right' }, '{width=260px align=right}'],
    [{ crop: '4:3' }, '{width=260px align=right crop=4:3}'],
  ] as const) {
    const tr = setPictureLook(state, firstPicture(state.doc), change)
    assert.ok(tr)
    assert.equal(tr!.getMeta('deckSlideCommand'), true, 'a slide command: its own undo step in the deck')
    state = state.apply(tr!)
    assert.equal(saveSlide(state.doc), `${SLIDE}${block}`)
    assert.equal(saveSlide(loadSlide(saveSlide(state.doc))), `${SLIDE}${block}`)
  }
})

check('the renderer draws a slide picture with its look, still as a picture block', () => {
  const pictureUrl = (path: string) => `https://webview/${path}`
  const sized = blockSlideHtml('![A](a.png){width=260px align=center}', { pictureUrl })
  assert.match(sized, /^<img style="width:260px;max-width:100%;display:block;margin-left:auto;margin-right:auto;align-self:center;object-position:center center" class="blk-pic" src="https:\/\/webview\/a.png" alt="A">\n$/)
  const cropped = blockSlideHtml('![A](a.png){crop=1:1}', { pictureUrl })
  assert.match(cropped, /^<span class="pic blk-pic" style="display:block;width:fit-content;max-width:min\(100%, 310px\);max-height:none"><span class="pic-box"/)
  assert.ok(!cropped.includes('<p>'), 'a picture alone is a block of its own')
  assert.ok(!blockSlideHtml('Words ![A](a.png){width=50%} more', { pictureUrl }).includes('{width'), 'the block never shows as words')
  // A title over a picture is no cover slide, with or without a look.
  assert.equal(isCoverSlide('# Title\n\n![A](a.png){width=260px}'), false)
})

// ---- review of #774

check('a frame with no width is as wide as the picture; on a slide its crop never meets the height cap', () => {
  assert.match(pictureMarkup('<img src="a.png" alt="A">', { crop: '1:1' }), /^<span class="pic" style="display:block;width:fit-content;max-width:100%">/)
  const slide = pictureMarkup('<img class="blk-pic" src="a.png" alt="A">', { crop: '16:9', width: '100%' }, { frameClass: 'blk-pic' })
  assert.match(slide, /^<span class="pic blk-pic" style="display:block;width:100%;max-width:min\(100%, 551px\);max-height:none"><span class="pic-box" style="[^"]*max-height:310px"/)
})

check('a key this reader can not draw stays as written until that key is set', () => {
  assert.equal(withLook('{width=3in}', { align: 'center' }), '{width=3in align=center}')
  assert.equal(withLook('{width=3in}', { width: '50%' }), '{width=50%}')
  assert.equal(withLook('{zoom=0.5 focus=x}', { caption: true }), '{.caption zoom=0.5 focus=x}')
})

check('a description typed with a stray bracket or a last backslash never breaks its image line', () => {
  assert.equal(markdownAlt('a [b] c'), 'a [b] c', 'paired brackets, as a file has them, stay')
  assert.equal(markdownAlt('Step 1] the board'), 'Step 1\\] the board')
  assert.equal(markdownAlt('C:\\'), 'C:\\ ')
  for (const words of ['Step 1] the board', 'a [b', 'ends with \\', 'a [b] c']) {
    let state = chooseFirst(docState(DOC))
    state = state.apply(setPictureAlt(state, firstPicture(state.doc), words)!)
    const saved = `${editorMarkdown(state.doc)}\n`
    const back = openDocument(saved).doc
    assert.equal(String(back.nodeAt(firstPicture(back))?.attrs.alt).trimEnd(), words, words)
    assert.equal(openAndSave(saved), saved, `${words} reads back byte for byte`)
  }
})

check('Comment on a document\'s first picture gets a caret before it, so its note goes there', () => {
  const state = chooseFirst(docState('![A](a.png)\n\nAfter.\n'))
  const { tr, top } = caretBeforePicture(state, firstPicture(state.doc))
  assert.equal(top, 0)
  assert.ok(tr.selection.empty, 'an empty selection: startComment places the note')
  assert.equal(tr.selection.from, 0)
  const later = chooseFirst(docState(DOC))
  const after = caretBeforePicture(later, firstPicture(later.doc))
  assert.ok(after.tr.selection.empty && after.tr.selection.from < firstPicture(later.doc))
})

check('two pictures in one paragraph stay a paragraph on a slide, as before', () => {
  const pictureUrl = (path: string) => `u/${path}`
  assert.match(blockSlideHtml('![A](a.png) ![B](b.png)', { pictureUrl }), /^<p>/)
  assert.match(blockSlideHtml('![A](a.png){width=50%} ![B](b.png)', { pictureUrl }), /^<p>/)
  assert.doesNotMatch(blockSlideHtml('![A](a.png){width=50%}', { pictureUrl }), /<p>/)
})

// ---- review of #774, round two

check('Esc leaves a picture that is the last block: a gap cursor after it, never the picture again', () => {
  const state = chooseFirst(docState('Before.\n\n![A](a.png)\n'))
  const tr = leavePicture(state)!
  assert.ok(tr.selection.empty, 'the picture is left')
  assert.equal(chosenPicture(state.apply(tr)), null)
})

check('on a slide, a captioned picture with no crop shrinks under the height cap, never cut', () => {
  const html = pictureMarkup('<img class="blk-pic" src="a.png" alt="A">', { caption: true }, { frameClass: 'blk-pic', caption: 'A' })
  assert.match(html, /<span class="pic-box" style="display:block;position:relative;overflow:hidden">/)
  assert.match(html, /<img style="display:block;width:auto;max-width:100%;max-height:310px;[^"]*height:auto"/)
})

check('a slide whose words open with ---, focus: …, --- keeps them as words', () => {
  const words = '---\nfocus: what matters this week\n---\n# Title'
  assert.equal(splitBlockSlide(words).header, null)
  assert.equal(splitBlockSlide('---\npicture: left\nfocus: 30,60\n---\n# Title').header, 'picture: left\nfocus: 30,60')
})

// ---- Codex on #774

check('a drop replaces the chosen picture only when it lands on it', () => {
  const state = chooseFirst(docState(DOC))
  const picture = { contains: (other: unknown) => other === inside } as unknown as globalThis.Node
  const inside = { nodeType: 1 } as unknown as globalThis.Node
  const outside = { nodeType: 1 } as unknown as globalThis.Node
  // The test's DOM has its own Node class: stand in for it while the check runs.
  const real = (globalThis as { Node?: unknown }).Node
  ;(globalThis as { Node?: unknown }).Node = Object
  try {
    const view = { state, nodeDOM: () => picture }
    assert.equal(chosenPictureUnder(view, inside)?.pos, firstPicture(state.doc))
    assert.equal(chosenPictureUnder(view, outside), null)
    assert.equal(chosenPictureUnder({ state: docState(DOC), nodeDOM: () => picture }, inside), null, 'no picture chosen')
  } finally {
    ;(globalThis as { Node?: unknown }).Node = real
  }
})

check('the picture-editor kill switch is on by default and can be turned off', () => {
  assert.equal(pictureEditorEnabled(), true)
  setPictureEditorEnabled(false)
  assert.equal(pictureEditorEnabled(), false)
  setPictureEditorEnabled(true)
})

// ---- Place on a slide: the same picture between the words and the slide-wide place

check('Place moves a picture to a side place and back without losing it', () => {
  const markdown = `${SLIDE.replace('![Three agents](images/agents.png)', '![Three agents](images/agents.png){crop=1:1 focus=30,60}')}`
  let state = EditorState.create({ doc: loadSlide(markdown) })
  const moved = flowToSide(state, firstPicture(state.doc), 'left', {})
  assert.ok(moved)
  assert.equal(saveSlide(moved!.doc), '# Where agents work\n\nIn the cloud.')
  assert.deepEqual(moved!.header, { picture: 'left', image: 'images/agents.png', alt: 'Three agents', focus: '30,60' })
  // Written into the slide's header, then back In text: the picture and its words come back.
  const body = writeSlideData('', `---\nid: a1\n---\n${saveSlide(moved!.doc)}`, { ...slideDataOf('', `---\nid: a1\n---\n${saveSlide(moved!.doc)}`), ...moved!.header })
  assert.equal(body, '---\nid: a1\npicture: left\nimage: images/agents.png\nalt: Three agents\nfocus: "30,60"\n---\n# Where agents work\n\nIn the cloud.')
  const data = slideDataOf('', body)
  const back = sideToText(data.markdown ?? '', data)
  assert.equal(back.markdown, '# Where agents work\n\nIn the cloud.\n\n![Three agents](images/agents.png)')
  assert.deepEqual(back.header, { picture: undefined, image: undefined, alt: undefined, focus: undefined })
  assert.equal(writeSlideData('', withBlockMarkdown(body, back.markdown!), { ...data, ...back.header }), '---\nid: a1\n---\n# Where agents work\n\nIn the cloud.\n\n![Three agents](images/agents.png)')
  // A place that holds a picture swaps with the one moved there.
  state = EditorState.create({ doc: loadSlide(SLIDE) })
  const swapped = flowToSide(state, firstPicture(state.doc), 'right', { image: 'images/old.png', alt: 'Old' })
  assert.equal(saveSlide(swapped!.doc), '# Where agents work\n\nIn the cloud.\n\n![Old](images/old.png)')
  assert.equal(swapped!.header.image, 'images/agents.png')
})

check('Remove on the side picture keeps its place empty; only Picture: None takes it away', () => {
  const body = '---\nid: a1\npicture: right\nimage: images/a.png\nalt: A\n---\n# Title'
  const removed = writeSlideData('', body, { ...slideDataOf('', body), ...EMPTY_SIDE })
  assert.equal(removed, '---\nid: a1\npicture: right\n---\n# Title')
  assert.equal(sidePictureOf(slideDataOf('', removed)), 'right')
  // The empty place is drawn, and says nothing on the page or the strip (only the stage asks for a picture).
  assert.match(blockSlideMarkup(slideDataOf('', removed), { theme: DEFAULT_THEME, borderless: false }), /<div class="photo empty"><\/div>/)
  // Its focus point draws the place's picture where it was kept in view.
  assert.match(blockSlideMarkup(slideDataOf('', `${body.replace('alt: A', 'focus: 30,60')}`), { theme: DEFAULT_THEME, borderless: false, pictureUrl: () => 'u.png' }), /background-position:30% 60%/)
})

// ---- the handles: under the pointer at any scale of the slide

check('a corner handle stays under the pointer at the smallest slide scale', () => {
  for (const scale of [0.2, 0.35, 1]) {
    const host = { left: 100, top: 50 }
    const box = { left: 40, top: 30, width: 200, height: 100 }
    for (const corner of CORNERS) {
      const start = screenPoint(cornerOf(box, corner), host, scale)
      const pointer = { x: start.x + (corner.includes('w') ? -30 : 30), y: start.y }
      const width = resizedWidth(box.width, corner, (pointer.x - start.x) / scale, 'left')
      const left = corner.includes('w') ? box.left + box.width - width : box.left
      const moved = screenPoint(cornerOf({ ...box, left, width }, corner), host, scale)
      assert.ok(Math.abs(moved.x - pointer.x) < 1e-9, `${corner} at ${scale}`)
    }
    // The whole picture in crop mode keeps the part it shows where it was.
    const region = { x: 0.2, y: 0.1, w: 0.5, h: 0.5 }
    const whole = wholeBox(box, region)
    const frame = frameBox(whole, region)
    for (const key of ['left', 'top', 'width', 'height'] as const) assert.ok(Math.abs(frame[key] - box[key]) < 1e-9)
    // A rect on the screen and back.
    const local = localBox({ left: 100 + 40 * scale, top: 50 + 30 * scale, width: 200 * scale, height: 100 * scale }, host, scale)
    for (const key of ['left', 'top', 'width', 'height'] as const) assert.ok(Math.abs(local[key] - box[key]) < 1e-9)
  }
})

if (failures) {
  console.error(`pictures: ${failures} failed`)
  process.exit(1)
}
console.log('pictures: all assertions passed')
