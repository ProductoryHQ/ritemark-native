/**
 * Experience 46, items 8 and 15: several pictures dropped on the strip make a Picture slide each, and Copy as picture.
 * Driven as the deck view's editor runs a drop: the deck's schema, the history, the guard, the lines and the drawn
 * headings, the file saved through the editor's own Markdown pipeline, and the host's own picture writer.
 * Run with `npx tsx webview/src/components/decks/stripPictures.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser } from '@tiptap/pm/model'
import { EditorState, Plugin, type Transaction } from '@tiptap/pm/state'
import { history, undo, undoDepth } from '@tiptap/pm/history'
import { canonicalMarkdownProjection } from '../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../src/editorSync/frontMatter'
import { writeImageRelativeTo } from '../../../../src/utils/imageWriter'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../utils/editorMarkdown'
import { editorMarkdown, installTestDocument } from '../../utils/markdownFidelity'
import { DeckSlide } from './handout/deckSchema'
import { DeckDrawnHeadings, drawnHeadingsFollow } from './handout/drawnHeadings'
import { deckGuardPlugin } from './handout/deckGuard'
import { deckLinesPlugin } from './handout/deckLines'
import { deckConvertPlugin } from './handout/deckConvert'
import { derivedHeadings, sealHistory, slidesOf } from './deckDocument'
import { STRIP_PICTURES_MIN, draggedPictureCount, dropPlaceNow, droppedPictures, insertPictureSlides, newSlideIds, pictureTitleOf } from './stripPictures'
import { slideMenuItems } from './slideMenuItems'
import { COPY_FAILED_NOTE, PICTURE_HEIGHT, PICTURE_WIDTH, copiedNote, customProperties, familiesOf, matchableSelector, slidePictureSvg } from './slidePictureSvg'

installTestDocument()
ensureCommentMarkedPipeline()
const schema = getSchema(createEditorSchemaExtensions({ commentCallouts: true, deck: [DeckSlide, DeckDrawnHeadings] }))

function elementFromString(html: string): HTMLElement {
  const body = createDocument(`<body>${html}</body>`).body as unknown as HTMLElement
  const strip = (node: HTMLElement) => {
    for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
      const child = node.childNodes[index]
      if (child.nodeType === 3 && child.nodeValue && /^(\n\s\s|\n)$/.test(child.nodeValue)) node.removeChild(child)
      else if (child.nodeType === 1) strip(child as HTMLElement)
    }
  }
  strip(body)
  return body
}

const drawnPlugin = () => new Plugin({ appendTransaction: (transactions, _old, next) => drawnHeadingsFollow(transactions, next) })

/** The deck as the deck view's editor opens it, its dispatch, its Undo and its save. */
function openDeck(text: string) {
  const split = splitFrontMatter(text)
  const doc = PMDOMParser.fromSchema(schema).parse(elementFromString(markdownToEditorHTML(canonicalMarkdownProjection(split.content))), { preserveWhitespace: 'full' })
  const properties = JSON.parse(JSON.stringify(split.properties))
  const textHandout = split.properties.handout === 'text'
  let state = EditorState.create({ doc, plugins: [history(), deckGuardPlugin(), deckLinesPlugin(), drawnPlugin(), deckConvertPlugin()] })
  const drawn = derivedHeadings(state, textHandout)
  if (drawn) state = state.apply(drawn)
  return {
    get state() { return state },
    textHandout,
    /** The deck view's `dispatchStep`: the transaction, then the step sealed. */
    step(tr: Transaction | null) {
      if (!tr) return false
      state = state.apply(tr)
      state = state.apply(sealHistory(state))
      return true
    },
    save: () => joinFrontMatter(properties, editorMarkdown(state.doc), text),
    undo() { return undo(state, tr => { state = state.apply(tr) }) },
  }
}

// ---- The title from a file name
assert.equal(pictureTitleOf('team-photo.png'), 'Team photo', 'dashes become spaces; the first letter a capital')
assert.equal(pictureTitleOf('Q3_results_final.JPG'), 'Q3 results final', 'underscores too, any extension case')
assert.equal(pictureTitleOf('before--after__2.webp'), 'Before after 2', 'runs of them become one space')
assert.equal(pictureTitleOf('  _the-plan_ .png'), 'The plan', 'trimmed, then the capital')
assert.equal(pictureTitleOf('v1.2 notes.jpeg'), 'V1.2 notes', 'only the last extension goes')
assert.equal(pictureTitleOf('README'), 'README', 'no extension: the name as it is')
assert.equal(pictureTitleOf('Õppepäev_Tartus.png'), 'Õppepäev Tartus', 'Estonian letters stay')
assert.equal(pictureTitleOf('Õppepäev-Tartus.png'), 'Õppepäev Tartus', "macOS's decomposed name reads as the letters")
assert.equal(pictureTitleOf('Šokolaad ja žürii.png'), 'Šokolaad ja žürii')
assert.equal(pictureTitleOf('/Users/someone/shots/slide-3.png'), 'Slide 3', 'a path: its last part')
assert.equal(pictureTitleOf('.png'), '', 'nothing but an extension: no title')
// The Experience lead, 18 November: only the first letter changes, for the person's language; the rest as the name has it.
assert.equal(pictureTitleOf('results_q3-final.png'), 'Results q3 final')
assert.equal(pictureTitleOf('õppepäev-tartus.png'), 'Õppepäev tartus', 'õ becomes Õ')
assert.equal(pictureTitleOf('o\u0303ppepa\u0308ev.png'), 'Õppepäev', 'a decomposed õ too')
assert.equal(pictureTitleOf('šokolaad.png'), 'Šokolaad')
assert.equal(pictureTitleOf('iPhone-shot.png'), 'IPhone shot', 'the first letter only')
assert.equal(pictureTitleOf('team-AI-day.png'), 'Team AI day', 'the rest keeps its capitals')
assert.equal(pictureTitleOf('3-steps.png'), '3 steps', 'a digit has no capital')
assert.equal(pictureTitleOf('𝒶bc.png'), '𝒶bc', 'a letter outside the BMP stays whole')

// ---- The drop: only pictures, in the files' order; the drag over counts them
{
  const file = (name: string, type: string) => ({ name, type }) as File
  const files = [file('b.png', 'image/png'), file('notes.pdf', 'application/pdf'), file('a.jpg', 'image/jpeg')]
  assert.deepEqual(droppedPictures({ files: files as unknown as FileList }).map(picture => picture.name), ['b.png', 'a.jpg'])
  assert.deepEqual(droppedPictures(null), [])
  const items = (types: string[]) => ({ types: ['Files'], items: types.map(type => ({ kind: 'file', type })) as unknown as DataTransferItemList })
  assert.equal(draggedPictureCount(items(['image/png', 'image/jpeg', 'text/plain'])), 2)
  assert.equal(draggedPictureCount(items(['image/png'])), 1, 'one picture: under the strip\'s minimum, as before')
  assert.equal(draggedPictureCount({ types: ['text/plain'], items: [] as unknown as DataTransferItemList }), 0, 'words, not files')
  assert.equal(STRIP_PICTURES_MIN, 2)
}

const DECK = [
  '---', 'deck: 2', '---', '',
  '```slide', '---', 'id: a1', '---', '# Where assistants help', '', 'Three jobs every week', '```', '',
  'Ask who has done one.', '',
  '```slide', '---', 'id: b2', '---', '# What it taught us', '```', '',
  'Two lessons.', '',
].join('\n')

// ---- Order and placement: between the two slides, in the files' order; the ids are new and the deck's own
{
  const deck = openDeck(DECK)
  const before = deck.save()
  assert.equal(before, DECK, 'opening writes nothing')
  const ids = newSlideIds(deck.state.doc, 3)
  assert.equal(new Set(ids).size, 3, 'three ids, none the same')
  assert.ok(ids.every(id => id !== 'a1' && id !== 'b2'), "none of the deck's own")
  const pictures = [
    { id: ids[0], title: pictureTitleOf('first-shot.png'), path: 'images/first-shot.png' },
    { id: ids[1], title: pictureTitleOf('Õppepäev_2.png'), path: 'images/Oppepaev_2.png' },
    { id: ids[2], title: pictureTitleOf('first-shot.png'), path: 'images/first-shot-2.png' },
  ]
  const depth = undoDepth(deck.state)
  assert.ok(deck.step(insertPictureSlides(deck.state, 1, pictures)))
  assert.equal(undoDepth(deck.state), depth + 1, 'one undo step')
  const slides = slidesOf(deck.state.doc)
  assert.deepEqual(slides.map(slide => slide.data.id), ['a1', ids[0], ids[1], ids[2], 'b2'], 'at the drop place, in the files\' order')
  assert.deepEqual(slides.slice(1, 4).map(slide => slide.data.markdown), [
    '# First shot\n\n![](images/first-shot.png)',
    '# Õppepäev 2\n\n![](images/Oppepaev_2.png)',
    '# First shot\n\n![](images/first-shot-2.png)',
  ], 'a Picture slide each: its title and its picture; two of the same name keep their own files')
  const saved = deck.save()
  assert.match(saved, /```slide\n---\nid: \w+\n---\n# First shot\n\n!\[\]\(images\/first-shot\.png\)\n```\n\n```slide/, 'written as block slides')
  assert.ok(saved.indexOf('Ask who has done one.') < saved.indexOf('First shot') && saved.indexOf('first-shot-2') < saved.indexOf('What it taught us'), 'between the two parts')
  // One Cmd+Z takes them all back: the same bytes.
  assert.ok(deck.undo())
  assert.equal(deck.save(), before, 'one Undo gives the deck back, byte for byte')
}

// ---- Review of #794: the drop place follows the slide it was dropped before while the pictures are saved
{
  assert.equal(dropPlaceNow(['a1', 'b2', 'c3'], 'b2', 1), 1, 'nothing moved')
  assert.equal(dropPlaceNow(['b2', 'c3'], 'b2', 1), 0, 'a slide above it deleted: still before it')
  assert.equal(dropPlaceNow(['a1', 'c3', 'b2'], 'b2', 1), 2, 'it moved down: still before it')
  assert.equal(dropPlaceNow(['a1', 'c3'], 'b2', 1), 1, 'it is gone: the place it was dropped at')
  assert.equal(dropPlaceNow(['a1'], 'b2', 5), 1, 'within the deck')
  assert.equal(dropPlaceNow(['a1', 'b2'], null, 2), 2, 'dropped at the end: the end, however long the deck is now')
  assert.equal(dropPlaceNow(['a1', undefined, 'c3'], undefined, 1), 1, 'a slide without an id: the place')
  // Two drops at once never take the same ids.
  const deck = openDeck(DECK)
  // The same random sequence for both: without the first drop's ids, the second would take the same ones.
  const sequence = () => { let n = 0; return () => ((n++ * 0.37) % 1) }
  const first = newSlideIds(deck.state.doc, 3, sequence())
  const second = newSlideIds(deck.state.doc, 3, sequence(), first)
  assert.deepEqual(newSlideIds(deck.state.doc, 3, sequence()), first, 'the sequence repeats')
  assert.equal(new Set([...first, ...second]).size, 6)
}

// ---- At the start and at the end; a gap past the end is the end
{
  const deck = openDeck(DECK)
  const [one, two] = newSlideIds(deck.state.doc, 2)
  assert.ok(deck.step(insertPictureSlides(deck.state, 0, [{ id: one, title: 'one', path: 'images/one.png' }, { id: two, title: 'two', path: 'images/two.png' }])))
  assert.deepEqual(slidesOf(deck.state.doc).map(slide => slide.data.id), [one, two, 'a1', 'b2'])
  const [three, four] = newSlideIds(deck.state.doc, 2)
  assert.ok(deck.step(insertPictureSlides(deck.state, 99, [{ id: three, title: 'three', path: 'images/three.png' }, { id: four, title: '', path: 'images/four.png' }])))
  assert.deepEqual(slidesOf(deck.state.doc).map(slide => slide.data.id), [one, two, 'a1', 'b2', three, four])
  assert.equal(slidesOf(deck.state.doc)[5].data.markdown, '![](images/four.png)', 'no title: the picture alone')
  assert.ok(deck.undo())
  assert.ok(deck.undo())
  assert.equal(deck.save(), DECK, 'each drop is its own step')
  // Nothing to insert, or an id the deck already has: nothing happens.
  assert.equal(insertPictureSlides(deck.state, 1, []), null)
  assert.equal(insertPictureSlides(deck.state, 1, [{ id: 'a1', title: 'x', path: 'images/x.png' }]), null)
}

// ---- A deck whose handout is a Text document: each part opens with its heading, the slide's title; one Undo
{
  const TEXT = DECK.replace('deck: 2\n', 'deck: 2\nhandout: text\n').replace('Ask who has done one.', '## Where assistants help\n\nAsk who has done one.').replace('Two lessons.', '## What it taught us\n\nTwo lessons.')
  const deck = openDeck(TEXT)
  assert.ok(deck.textHandout)
  const before = deck.save()
  const [one, two] = newSlideIds(deck.state.doc, 2)
  assert.ok(deck.step(insertPictureSlides(deck.state, 2, [{ id: one, title: 'Kohvipaus', path: 'images/kohvipaus.png' }, { id: two, title: 'Lõuna', path: 'images/louna.png' }], true)))
  const saved = deck.save()
  assert.match(saved, /# Kohvipaus\n\n!\[\]\(images\/kohvipaus\.png\)\n```\n\n## Kohvipaus\n\n```slide/, 'the part\'s own heading')
  assert.match(saved, /## Lõuna\n*$/, 'the last part too')
  assert.ok(deck.undo())
  assert.equal(deck.save(), before, 'one Undo, the same bytes')
}

// ---- The copy into images/: the host's writer, as a pasted picture is saved; names never clash
{
  const dir = mkdtempSync(join(tmpdir(), 'strip-pictures-'))
  try {
    const png = Buffer.from('iVBORw0KGgo=', 'base64').toString('base64')
    assert.equal(writeImageRelativeTo(dir, 'first-shot.png', png), 'first-shot.png')
    assert.equal(writeImageRelativeTo(dir, 'first-shot.png', png), 'first-shot-2.png', 'a second of the same name')
    assert.equal(writeImageRelativeTo(dir, 'Õppepäev_2.png', png), 'Oppepaev_2.png', 'a cleaned name, as paste writes it')
    assert.equal(writeImageRelativeTo(dir, 'Õppepäev_2.png', png), 'Oppepaev_2-2.png')
    assert.deepEqual(readdirSync(dir).sort(), ['Oppepaev_2-2.png', 'Oppepaev_2.png', 'first-shot-2.png', 'first-shot.png'], 'every picture kept')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ---- The deck view: the drop goes through the host's own save, and in as one step
{
  const here = join(process.cwd(), process.cwd().endsWith('webview') ? 'src/components/decks' : 'webview/src/components/decks')
  const view = readFileSync(join(here, 'DeckView.tsx'), 'utf8')
  const strip = readFileSync(join(here, 'SlideStrip.tsx'), 'utf8')
  assert.match(view, /sendToExtension\('deck\/save-image', \{ slideId: ids\[index\], dataUrl, filename: getUniqueImageFilename\(file\) \}\)/, 'saved in images/ as a dropped picture is')
  assert.match(view, /inserted = dispatchStepRef\.current\(insertPictureSlides\(target\.state, at, saved, textHandoutRef\.current\)\)/, 'one undo step')
  assert.match(view, /const at = dropPlaceNow\(slidesOf\(target\.state\.doc\)\.map\(entry => entry\.data\.id\), drop\.before, drop\.at\)/, 'before the slide it was dropped before')
  assert.match(view, /const at = dropPlaceNow\(slidesOf\(target\.state\.doc\)\.map\(entry => entry\.data\.id\), drop\.before, drop\.at\)/, 'before the slide it was dropped before')
  assert.match(strip, /if \(draggedPictureCount\(event\.dataTransfer\) < STRIP_PICTURES_MIN\) return/, 'a single picture is left as it was')
  assert.match(strip, /if \(files\.length < STRIP_PICTURES_MIN\) return\n\s+event\.preventDefault\(\)/)
}

// ---- Copy as picture: right after Add to library…, no key of its own
{
  const items = slideMenuItems({ index: 3, count: 6, skipped: false, fromLibrary: false, deleteKey: '⌫', duplicateKey: '⌘D', upKey: '⌘↑', downKey: '⌘↓' })
  const labels = items.map(item => item.label)
  assert.equal(labels.indexOf('Copy as picture'), labels.indexOf('Add to library…') + 1)
  const copy = items.find(item => item.key === 'picture')!
  assert.equal(copy.keyHint, undefined, 'no key: Cmd+C on a thumbnail copies the slide')
  assert.equal(copy.separated, undefined, 'in the second group')
  const calls: number[] = []
  copy.run({ copyPicture: (index: number) => calls.push(index) } as never)
  assert.deepEqual(calls, [3])
}

// ---- The picture: 1920 × 1080, drawn through an SVG of that size; the bar's notes
{
  assert.equal(PICTURE_WIDTH, 1920)
  assert.equal(PICTURE_HEIGHT, 1080)
  const svg = slidePictureSvg('<div class="deck-slide"></div>', '.deck-sl{color:red}</style><b>', '--vscode-x: "a"')
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1920" height="1080" viewBox="0 0 1920 1080">/)
  assert.match(svg, /<foreignObject x="0" y="0" width="1920" height="1080">/)
  assert.ok(!svg.includes('</style><b>'), 'the CSS never closes its own style element')
  assert.match(svg, /--vscode-x: &quot;a&quot;/, "the document's custom properties, quoted safely")
  assert.equal(copiedNote(4), 'Slide 4 is copied as a picture.')
  assert.equal(COPY_FAILED_NOTE, 'The slide could not be copied as a picture.')
  assert.equal(matchableSelector('.deck-sl .pts li::marker'), '.deck-sl .pts li')
  assert.equal(matchableSelector('.a:empty::before, .b:hover'), '.a:empty, .b:hover')
  // Review of #794: Tailwind's reset lists pseudo-elements alone; each stands for any element, so the list stays valid.
  assert.equal(matchableSelector('*, ::after, ::before, ::backdrop, ::file-selector-button'), '*, *, *, *, *')
  assert.equal(matchableSelector('input:placeholder-shown'), 'input:placeholder-shown', 'a pseudo-class that starts like one stays')
  assert.equal(matchableSelector(':is(h1, h2)::after, [data-x="a,b"]'), ':is(h1, h2), [data-x="a,b"]', 'commas inside brackets are no list')
  const props = ['color', '--ritemark-accent', '--vscode-font-size']
  const values: Record<string, string> = { '--ritemark-accent': ' #4338CA', '--vscode-font-size': '13px' }
  assert.equal(customProperties({ length: props.length, item: index => props[index], getPropertyValue: name => values[name] ?? '' }), '--ritemark-accent: #4338CA;--vscode-font-size: 13px;', 'only custom properties, as they resolve')
  assert.match(slidePictureSvg('', '', '--x: a<b&c;'), /--x: a&lt;b&amp;c;/, 'escaped for the attribute')
  assert.deepEqual(familiesOf('"Sofia Sans", Lora, sans-serif'), ['Sofia Sans', 'Lora', 'sans-serif'])
  // The PNG's own size is read back from the clipboard in the proof (docs/.../decks-strip-pictures/proof/).
}

console.log('stripPictures: ok')
