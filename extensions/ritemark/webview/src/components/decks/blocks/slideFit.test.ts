/**
 * 17 November (Jarmo's 49-slide deck on the dev build): the strip's thumbnails didn't match the stage, words split
 * mid-word in boxes and cells, every box showed an empty "+" circle, a picture pushed the title off the slide, and a
 * moved deck's pictures vanished. One measure for every view (`fitFlow`), words never split, the place on the edited box
 * only, the picture giving way first, and a missing picture that says so.
 *
 * Run: npx tsx webview/src/components/decks/blocks/slideFit.test.ts
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { BLOCK_FIT_STEPS, blockCanvasMarkup, blockSlideHtml, isCoverSlide } from '../../../../../src/decks/blocks/slideRenderer'
import { clearStageFit, fitFlow, fitKeyOf, fitLookOf, measureFlowAt, overflowsSideways, setStageFit, stageFitFor, subscribeStageFit } from './slideFit'
import { loadSlide } from './slideEditorHarness'
import { CARET_CLASS, caretBoxPos } from './slideDivView'
import { imagePathOf, missingDecorations } from './slidePictures'

// ---- A flow laid out by a small model: words a given height and a word a given width, both scaled by `--fit`, as the
// browser lays them out (the measure reads only offsets, client and scroll sizes, and the computed style).
interface Fake { offsetTop: number; offsetHeight: number; offsetLeft: number; offsetWidth: number; clientWidth: number; scrollWidth: number; style: { display: string; position: string; marginTop: string; marginBottom: string } }
function fakeFlow(options: { room?: number; width?: number; height: (fit: number) => number; top?: (fit: number) => number; word?: (fit: number) => number; box?: number; table?: (fit: number) => number }) {
  let fit = 1
  const room = options.room ?? 460
  const width = options.width ?? 832
  const style = { display: 'block', position: 'static', marginTop: '0', marginBottom: '0' }
  const block = (): Fake => ({
    get offsetTop() { return options.top ? options.top(fit) : 0 },
    get offsetHeight() { return options.height(fit) },
    offsetLeft: 0,
    get offsetWidth() { return options.table ? options.table(fit) : width },
    clientWidth: width,
    scrollWidth: width,
    style,
  } as Fake)
  const box = { style, children: [], getBoundingClientRect: () => ({ right: 1000 }), clientWidth: options.box ?? 117, get scrollWidth() { return options.word ? Math.max(options.box ?? 117, Math.round(options.word(fit))) : options.box ?? 117 } }
  const flow = {
    clientHeight: room,
    clientWidth: width,
    offsetWidth: width,
    getBoundingClientRect: () => ({ width }),
    scrollHeight: room,
    children: [block()],
    style: { setProperty: (_name: string, value: string) => { fit = Number(value) } },
    querySelectorAll: () => (options.word ? [box] : []),
  }
  return flow as unknown as HTMLElement
}
;(globalThis as unknown as { getComputedStyle: (element: { style: object }) => object }).getComputedStyle = element => element.style

// A word wider than its box is the fit's to solve, as words past the bottom are: it steps the slide's words down until
// the word fits (17 November: "Töölauaagen|did"). Here a 168 px word in a 117 px box fits from 68 % on.
{
  const flow = fakeFlow({ height: fit => 300 * fit, word: fit => 168 * fit })
  assert.equal(overflowsSideways(flow), true, 'at 100 %, the word runs out of its box')
  const at = measureFlowAt(flow, 0)
  assert.ok(at.content > at.room + 2, 'sideways counts as more than the room')
  const { step, full } = fitFlow(flow)
  assert.equal(BLOCK_FIT_STEPS[step], 0.68, 'stepped down until the word fits')
  assert.equal(full, false)
  // A word that never fits leaves the slide at its floor, said full.
  assert.deepEqual(fitFlow(fakeFlow({ height: () => 100, word: () => 400 })), { step: BLOCK_FIT_STEPS.length - 1, full: true })
  // A table wider than the slide (its cells hold whole words) steps down too.
  const table = fitFlow(fakeFlow({ height: () => 200, table: fit => 1100 * fit }))
  assert.ok(1100 * BLOCK_FIT_STEPS[table.step] <= 833, 'the table fits the slide')
}

// A cover's title runs out past the top, where `scrollHeight` never sees it (the thumbnail's old measure, which left
// the title clipped at the thumbnail's top): the blocks' own extent does, so the step goes down.
{
  const room = 420
  const flow = fakeFlow({ room, height: fit => 560 * fit, top: fit => room - 560 * fit })
  const { step } = fitFlow(flow)
  assert.ok(560 * BLOCK_FIT_STEPS[step] <= room + 2, 'the whole title on the slide')
  assert.ok(step > 0)
}

// The stage's step is the strip's, the wall's and Publish's for the same slide in the same look (`setStageFit`).
{
  const key = fitKeyOf('# A\n\nWords', undefined, undefined, fitLookOf(false, { name: 'Evening' }))
  let told = 0
  const stop = subscribeStageFit(() => { told++ })
  assert.equal(stageFitFor(key), null, 'nothing before the stage tells it')
  setStageFit({ key, step: 3 })
  assert.equal(stageFitFor(key), 3)
  assert.equal(stageFitFor(fitKeyOf('# A\n\nWords', undefined, undefined, fitLookOf(true, { name: 'Evening' }))), null, 'another look measures for itself')
  assert.equal(stageFitFor(fitKeyOf('# B', undefined, undefined, fitLookOf(false, { name: 'Evening' }))), null, 'another slide too')
  setStageFit({ key, step: 3 })
  assert.equal(told, 1, 'told once per change')
  setStageFit(null)
  assert.equal(stageFitFor(key), null)
  // Review of #771: two stages on slides with the same words (two new empty slides). The new one tells its step before
  // the old one leaves; the old one's leaving takes away only its own.
  const oldStage = {}
  const newStage = {}
  setStageFit({ key, step: 2, owner: oldStage })
  setStageFit({ key, step: 2, owner: newStage })
  clearStageFit(oldStage)
  assert.equal(stageFitFor(key), 2, "the new stage's step stays")
  clearStageFit(newStage)
  assert.equal(stageFitFor(key), null, 'and goes with it')
  stop()
  // Both views use the one measure: the thumbnail's canvas and the stage's editor (their sources, as they need a DOM).
  const canvas = readFileSync(new URL('../slide/SlideCanvas.tsx', import.meta.url), 'utf8')
  const stage = readFileSync(new URL('./SlideEditor.tsx', import.meta.url), 'utf8')
  assert.ok(/const found = fitFlow\(flow, 0\)\.step/.test(canvas) && /stageFitFor\(key\)/.test(canvas), 'the canvas: the one measure, or the stage\'s step')
  assert.ok(!/scrollHeight > flow\.clientHeight/.test(canvas), 'not its own scrollHeight measure')
  assert.ok(/fitFlow\(flow, fresh \? 0 : fitStepRef\.current\)/.test(stage) && /editor\.on\(.update., typed\)/.test(stage) && /setStageFit\(\{ key: fitKeyRef\.current, step, owner: fitOwner\.current \}\)/.test(stage), 'the stage: the one measure, told on')
  assert.ok(/clearStageFit\(fitOwner\.current\)/.test(stage), 'the stage takes away only its own step')
  // Review of #771: a cancelled Replace picture… never takes the / menu's next picture.
  const pictureItem = stage.slice(stage.indexOf("case 'picture':"), stage.indexOf("case 'webPage':"))
  // Round two: the missing picture waits for the picker (`pendingReplace`) and is replaced only when a file is chosen
  // there; the / menu never touches a replace in flight, and a cancelled picker forgets only its own.
  assert.ok(!pictureItem.includes('replaceAt'), "the / menu's Picture leaves a replace in flight alone")
  const replaceFn = stage.slice(stage.indexOf('const replacePicture ='), stage.indexOf('const replacePicture =') + 900)
  assert.ok(replaceFn.includes('pendingReplace.current = found') && !replaceFn.includes('replaceAt.current ='), 'Replace picture… only waits')
  // Codex on #771: the same missing picture twice: each button replaces the one it stands over.
  assert.ok(replaceFn.includes('if (count++ === spot.nth) found = pos'), 'the nth picture with that path')
  assert.ok(stage.includes('const nth = side ? 0 : seen.get(path) ?? 0'), 'each place counted in the slide\'s order')
  const picker = stage.slice(stage.indexOf('const choosePicture ='), stage.indexOf('// 17 November: Replace picture… over each missing picture'))
  assert.ok(/if \(replacing\) \{\s*replaceAt\.current = pendingReplace\.current/.test(picker), 'a chosen file makes it the one replaced')
  assert.ok(/addEventListener\('cancel', \(\) => \{\s*if \(replacing\) pendingReplace\.current = null\s*else if \(slashAt !== null && pictureAt\.current === slashAt\) pictureAt\.current = null/.test(picker), 'a cancel forgets only its own')
}

// The renderer: a title over a picture is no cover slide (the picture pushed the title up and off the slide); a title
// with a line under it still is.
{
  assert.equal(isCoverSlide('# Kuidas assistent vastuse koostab\n\n![](images/tall.png)'), false, 'a title over a picture')
  assert.equal(isCoverSlide('# Title\n\nFernhollow Bank · 3 tundi'), true, 'a title with a line')
  assert.equal(isCoverSlide('2\n\n# Section'), true, 'a section with its number')
  assert.equal(isCoverSlide('![](a.png)\n\n# Title'), false, 'a picture over a title (review of #771)')
  const html = blockCanvasMarkup({ markdown: '# Kuidas assistent\n\n![](images/tall.png)' }, { step: 0, pictureUrl: () => 'u' })
  assert.ok(!html.includes('is-cover'))
}

// A picture whose file is gone says so, with its name, in the deck view; the page never says so (no `missing`).
{
  const missing = (path: string) => path === 'images/gone<1>.png'
  const html = blockSlideHtml('# A\n\n![](images/gone%3C1%3E.png)', { pictureUrl: () => null, missing })
  assert.ok(html.includes('<span class="blk-pic empty is-missing"><span class="blk-missing"><span class="blk-missing-head">Picture not found</span><span class="blk-missing-name">gone&lt;1&gt;.png</span></span></span>'), 'its name, escaped, and as a block of its own')
  assert.ok(!/<p>\s*<span class="blk-pic/.test(html), 'not inside a paragraph')
  assert.ok(blockSlideHtml('# A\n\n![](images/gone.png)', { pictureUrl: () => null }).includes('<span class="blk-pic empty"></span>'), 'without the deck view\'s list: the empty place, as on the page')
  const side = blockCanvasMarkup({ markdown: '# A', picture: 'right', image: 'images/side.png' }, { pictureUrl: () => null, missing: path => path === 'images/side.png' })
  assert.ok(side.includes('<div class="photo empty is-missing"><span class="blk-missing">') && side.includes('side.png'), "the slide's own picture too")
  // The stage: the image node names its path, and a missing one is marked for its view.
  const doc = loadSlide('# A\n\n![](images/gone.png)\n\n![](images/here.png)')
  const images: Array<Record<string, unknown>> = []
  doc.descendants(node => { if (node.type.name === 'image') images.push(node.attrs) })
  assert.deepEqual(images.map(imagePathOf), ['images/gone.png', 'images/here.png'])
  assert.equal(imagePathOf({ src: 'https://file+.vscode-resource.vscode-cdn.net/x/here.png', title: 'images/here.png' }), 'images/here.png', 'a mapped picture by its title')
  assert.equal(missingDecorations(doc, new Set(['images/gone.png'])).find().length, 1, 'only the missing one')
  assert.equal(missingDecorations(doc, new Set()).find().length, 0)
}

// The empty "+" place shows only on the box being edited: the caret's box is marked, and the CSS hides every other.
{
  const doc = loadSlide('# Today\n\n:::: boxes\n::: box\n### One\nA line.\n:::\n::: box\n### Two\nAnother.\n:::\n::::')
  let second = -1
  let seen = 0
  doc.descendants((node, pos) => {
    if (node.type.name === 'slideDiv' && String(node.attrs.open ?? '').includes('box') && !String(node.attrs.open ?? '').includes('boxes')) {
      seen++
      if (seen === 2) second = pos
    }
  })
  assert.ok(second > 0)
  let inTwo = -1
  doc.descendants((node, pos) => { if (inTwo < 0 && node.isText && node.text === 'Another.') inTwo = pos })
  const state = EditorState.create({ doc, selection: TextSelection.create(doc, inTwo + 2) })
  assert.equal(caretBoxPos(state), second, "the caret's box")
  let inTitle = -1
  doc.descendants((node, pos) => { if (inTitle < 0 && node.isText && node.text === 'Today') inTitle = pos })
  assert.equal(caretBoxPos(EditorState.create({ doc, selection: TextSelection.create(doc, inTitle + 1) })), null, 'in the title: no box')
  const css = readFileSync(new URL('../decks.css', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.ok(css.includes('.deck-sl.is-blocks.is-editing .blk-icon.is-place { display: none; }'), 'hidden on every box')
  // The lead's follow-up to #773: the place is never drawn on the slide; the caret's box shows the icon handle in the
  // handles' layer (SlideBlockBar), so the box takes no room for it.
  assert.ok(!new RegExp(`\\.blk-box\\.${CARET_CLASS} > \\.blk-icon\\.is-place \\{ display: grid`).test(css), 'never drawn on the edited box either')
  assert.ok(/\.deck-slide \.deck-block-icon \{ position: relative; min-width: 0; padding: 0; border-radius: 50%; background: var\(--r-surface\);/.test(css), 'a white handle like the +')
  const bar = readFileSync(new URL('./SlideBlockBar.tsx', import.meta.url), 'utf8')
  assert.ok(bar.includes('<Tooltip label="Add an icon"') && bar.includes('<SmilePlusGlyph />') && bar.includes("querySelector(':scope > .blk-icon.is-place')"), 'the handle: its tooltip, its glyph, only while the box has no icon')
  // Every handle's tooltip opens at the handle (the app run: the Tooltip's span had no size while the button was
  // absolute, so the tooltips opened at the layer's corner). The place is the box around the trigger, never the button.
  assert.ok(css.includes('.deck-block-at { position: absolute; display: flex; }'), 'each handle in a placed box')
  for (const name of ['grip', 'plus', 'icon', 'split']) assert.ok(new RegExp(`\\.deck-slide \\.deck-block-${name} \\{ position: relative;`).test(css), `the ${name} is not absolute`)
  assert.equal((bar.match(/className="deck-block-at"/g) ?? []).length, 4, 'the ⋮, the +, the icon handle and the split line each in one')
}

// Words are never split mid-word on a slide, in boxes, steps, columns and cells; a web address may still break. A
// cover's words never overflow past the top; a picture gives way first.
{
  const css = readFileSync(new URL('../slide/slide.css', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  const flow = /\.deck-sl\.is-blocks \.blk-flow \{[^}]*\}/.exec(css)?.[0] ?? ''
  assert.ok(flow.includes('overflow-wrap: normal; word-break: normal;') && !flow.includes('anywhere'), 'whole words')
  assert.ok(/\.blk-link \{[^}]*overflow-wrap: anywhere;/.test(css), 'a link (a web address) may break')
  assert.ok(!/\.deck-sl\.is-blocks[^{]*\{[^}]*(?:word-break: break-all|overflow-wrap: anywhere)[^}]*\}/.test(css.replace(/\.deck-sl\.is-blocks \.blk-link \{[^}]*\}/, '').replace(/\.deck-sl \.blk-missing-name \{[^}]*\}/, '')), 'nothing else splits words')
  assert.ok(/\.is-cover \.blk-flow \{[^}]*justify-content: safe flex-end;/.test(css), "a cover's title is never pushed past the top")
  assert.ok(/\.blk-flow:has\(> \.blk-pic, > img\) \{ display: flex; flex-direction: column; \}/.test(css) && /\.blk-flow:has\(> \.blk-pic, > img\) > :is\(\.blk-pic, img\) \{ flex: 0 1 auto; min-height: 96px;/.test(css), 'the picture shrinks first, down to 96 px')
  assert.ok(/\.blk-flow:has\(> \.blk-pic, > img\) > \* \{ flex: none; \}/.test(css), 'the title and the words never shrink')
  // The stage's editor (ProseMirror) breaks long words by default: the slide's rule wins over it.
  const decks = readFileSync(new URL('../decks.css', import.meta.url), 'utf8')
  assert.ok(!/blk-flow[^{]*\{[^}]*(?:overflow-wrap|word-wrap): (?:anywhere|break-word)/.test(decks), 'the stage adds no breaking of its own')
}

console.log('slideFit.test.ts: passed')
