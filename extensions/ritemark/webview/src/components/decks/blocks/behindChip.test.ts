/**
 * Sprint 167 PR 4 (decks README item D, `block-details.html`; #838): a picture Behind, from the slide's corner chip.
 *
 *  - The chip's corner reads the logo's (Sprint 167 PR 1): bottom right beside a top-right logo drawn on the slide, else
 *    top right; so the two never sit on top of each other.
 *  - The chip lies between the slide's edge and its words' box at every stage size, so it never covers a word or takes
 *    its click, and never covers the logo in any of the four corners.
 *  - The empty place has no prompt in its middle; the chip says "Picture behind · Choose… · ChatGPT" (a round handle at
 *    rest), and with a picture "Picture behind · Choose" (nothing at rest).
 *  - Slide settings: Behind chosen with no picture opens the file picker; under Behind, Replace… and Remove (Choose… for
 *    an empty place).
 *
 * Run: npx tsx webview/src/components/decks/blocks/behindChip.test.ts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'

register(`data:text/javascript,${encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context) }",
)}`)
Object.assign(globalThis, { acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }) })
const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { CHIP_GAP, CHIP_HEIGHT, behindChipCorner, behindChipPlace, chipBox } = await import('./behindChipPlace')
const { BehindChip } = await import('./BehindChip')
const { SidePicture } = await import('./SidePicture')
const { SlideSettings, behindRemoved } = await import('../SlideSettings')
const { BLOCK_CANVAS_HEIGHT, BLOCK_CANVAS_WIDTH, FLOW_BOTTOM, FLOW_TOP, LOGO_HEIGHT, logoDrop } = await import('../../../../../src/decks/blocks/slideRenderer')
type LogoPlace = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const here = path.dirname(fileURLToPath(import.meta.url))
const noop = () => {}
const logo = (place: LogoPlace, on: 'every-slide' | 'title-slides' = 'every-slide', width = 190) => ({ url: 'logo.png', place, on, width }) as never

// ---- 1. The corner reads the logo's.
{
  assert.equal(behindChipCorner(null, false), 'top-right', 'no logo: top right')
  assert.equal(behindChipCorner(logo('top-right'), false), 'bottom-right', 'a top-right logo: bottom right')
  assert.equal(behindChipCorner(logo('top-right'), true), 'bottom-right', 'on a title slide too')
  for (const place of ['top-left', 'bottom-left', 'bottom-right'] as const) {
    assert.equal(behindChipCorner(logo(place), false), 'top-right', `a ${place} logo: top right`)
    assert.equal(behindChipCorner(logo(place), true), 'top-right', `a ${place} logo on a title slide: top right`)
  }
  // A logo on the title slides only isn't on this one: the corner is free.
  assert.equal(behindChipCorner(logo('top-right', 'title-slides'), false), 'top-right')
  assert.equal(behindChipCorner(logo('top-right', 'title-slides'), true), 'bottom-right')
}

// ---- 2. Never over the words' box nor the logo, at every stage size from 480 px wide, for each logo corner, with the
// chip open at its widest (empty: Picture behind · Choose… · ChatGPT) and its narrowest (Picture behind · Choose).
{
  const intersects = (a: { left: number; top: number; right: number; bottom: number }, b: typeof a) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const corners: Array<LogoPlace | null> = [null, 'top-left', 'top-right', 'bottom-left', 'bottom-right']
  let checked = 0
  for (const place of corners) {
    for (const width of [180, 120]) {
      for (let slideWidth = 480; slideWidth <= 1600; slideWidth += 20) {
        for (const chipWidth of [262, 172]) {
          const s = slideWidth / BLOCK_CANVAS_WIDTH
          const slide = { width: slideWidth, height: Math.round(slideWidth * BLOCK_CANVAS_HEIGHT / BLOCK_CANVAS_WIDTH) }
          // The words' box as slide.css draws it, with the room each logo corner keeps (`logoCanvasMarks`).
          const top = (FLOW_TOP + (place === 'top-left' ? logoDrop() : 0)) * s
          const bottom = slide.height - (FLOW_BOTTOM + (place === 'bottom-left' || place === 'bottom-right' ? logoDrop() : 0)) * s
          const words = { left: 64 * s, right: slide.width - 64 * s, top, bottom }
          const drawn = place ? logo(place, 'every-slide', width) : null
          const chip = behindChipPlace(slide, { top, bottom }, behindChipCorner(drawn, false), drawn)
          const box = chipBox(chip, slide, chipWidth)
          const at = `${place ?? 'no logo'}, ${slideWidth} px, chip ${chipWidth}`
          assert.ok(!intersects(box, words), `never over the words: ${at} ${JSON.stringify({ box, words })}`)
          assert.ok(box.top >= 0 && box.bottom <= slide.height && box.left >= 0 && box.right <= slide.width, `on the slide: ${at}`)
          if (place) {
            const lx = place.endsWith('left') ? 30 * s : slide.width - (30 + width) * s
            const ly = place.startsWith('top') ? 22 * s : slide.height - (18 + LOGO_HEIGHT) * s
            assert.ok(!intersects(box, { left: lx, right: lx + width * s, top: ly, bottom: ly + LOGO_HEIGHT * s }), `never over the logo: ${at}`)
          }
          checked++
        }
      }
    }
  }
  assert.ok(checked > 1000)
  // At the editor's usual size it is its full size, top right, 12 px in; beside a top-right logo, bottom right.
  const slide = { width: 960, height: 540 }
  assert.deepEqual(behindChipPlace(slide, { top: 46, bottom: 506 }, 'top-right'), { corner: 'top-right', edge: 7, right: 12, scale: 1 })
  const low = behindChipPlace(slide, { top: 46, bottom: 506 }, 'bottom-right', { width: 120 })
  assert.equal(low.corner, 'bottom-right')
  assert.ok(low.scale < 1 && low.scale * CHIP_HEIGHT + CHIP_GAP * 2 <= 34 + 0.01, 'made smaller to fit the low band')
  // The words as they stand: a title slide's words end well above the bottom, so beside a top-right logo the chip is
  // full size bottom right (its words readable), clear of every block; a block in its corner keeps it to the band.
  const cover = [{ left: 64, top: 300, right: 896, bottom: 420 }, { left: 64, top: 430, right: 896, bottom: 466 }]
  const roomy = behindChipPlace(slide, { top: 46, bottom: 506 }, 'bottom-right', { width: 120 }, { blocks: cover, width: 262 })
  assert.deepEqual(roomy, { corner: 'bottom-right', edge: 10, right: 12, scale: 1 })
  const roomyBox = chipBox(roomy, slide, 262)
  assert.ok(cover.every(block => roomyBox.top > block.bottom), 'clear of the words')
  const full = [{ left: 64, top: 46, right: 896, bottom: 506 }]
  assert.deepEqual(behindChipPlace(slide, { top: 46, bottom: 506 }, 'bottom-right', { width: 120 }, { blocks: full, width: 262 }), low, 'a full slide: the band')
  // A top band roomy enough for the full chip keeps it centred there, never pushed nearer the edge.
  assert.deepEqual(behindChipPlace(slide, { top: 84, bottom: 506 }, 'top-right', null, { blocks: [], width: 262 }), behindChipPlace(slide, { top: 84, bottom: 506 }, 'top-right'))
  // A slide so small that the low band can't hold it: top right after all, left of the logo.
  const small = behindChipPlace({ width: 560, height: 315 }, { top: 46 * 560 / 960, bottom: 315 - 34 * 560 / 960 }, 'bottom-right', { width: 120 })
  assert.equal(small.corner, 'top-right')
  assert.ok(small.right > (30 + 120) * 560 / 960, 'left of the logo')
}

// ---- 3. The chip: empty, its round handle and "Picture behind · Choose… · ChatGPT"; with a picture, "Choose" alone.
{
  const place = { corner: 'top-right' as const, edge: 7, right: 12, scale: 1 }
  const empty = parse(renderToStaticMarkup(createElement(BehindChip, { place, filled: false, keep: false, onChoose: noop, onChatgpt: noop })))
  const chip = empty.querySelector('.deck-behind-chip')!
  assert.ok(chip.classList.contains('is-empty') && chip.classList.contains('is-top-right'))
  assert.equal(chip.getAttribute('aria-label'), 'Picture behind')
  assert.ok(chip.querySelector('.deck-behind-chip-dot'), 'its round handle')
  assert.deepEqual(chip.querySelectorAll('button').map(button => button.text.trim()), ['Choose…', 'ChatGPT'])
  assert.equal(chip.querySelector('.deck-behind-chip-words')?.text, 'Picture behind')
  assert.match(chip.getAttribute('style') ?? '', /--chip-edge:7px;--chip-right:12px;--chip-scale:1/)
  const filled = parse(renderToStaticMarkup(createElement(BehindChip, { place: { ...place, corner: 'bottom-right' }, filled: true, keep: true, onChoose: noop, onChatgpt: noop })))
  const kept = filled.querySelector('.deck-behind-chip')!
  assert.ok(kept.classList.contains('is-filled') && kept.classList.contains('is-keep') && kept.classList.contains('is-bottom-right'))
  assert.deepEqual(kept.querySelectorAll('button').map(button => button.text.trim()), ['Choose'])
  // Its look: the handle at rest, open on the slide's hover, the keyboard or the place chosen; with a picture nothing at
  // rest; never native titles, and a pointer on its buttons (the global rule).
  const css = fs.readFileSync(path.join(here, '..', 'decks.css'), 'utf8')
  assert.match(css, /\.deck-slide > \.deck-behind-chip\.is-filled:where\(:not\(\.is-keep\):not\(:focus-within\)\) \{ opacity: 0; pointer-events: none; \}/)
  assert.match(css, /\.deck-slide:hover > \.deck-behind-chip \.deck-behind-chip-full, \.deck-slide > \.deck-behind-chip:is\(\.is-keep, :focus-within\) \.deck-behind-chip-full \{ display: inline-flex; \}/)
  assert.match(css, /\.deck-slide\.is-behind-chosen::after \{ content: ""; position: absolute; inset: 0; z-index: 6; border-radius: inherit; box-shadow: inset 0 0 0 3px var\(--r-accent\);/, "the ring round the whole slide")
  assert.ok(!/ title=/.test(renderToStaticMarkup(createElement(BehindChip, { place, filled: false, keep: false, onChoose: noop, onChatgpt: noop }))))
}

// ---- 4. The empty place Behind has no prompt in its middle (Left and Right keep theirs, in their own place).
{
  const side = (where: 'left' | 'right' | 'behind') => parse(renderToStaticMarkup(createElement(SidePicture, {
    side: where, path: '', missing: false, alt: '', chosen: false, comments: false,
    onChoose: noop, onLeave: noop, onPlace: noop, onWords: noop, onComment: noop, onReplace: noop, onChatgpt: noop, onReveal: noop, onRemove: noop, onFocus: noop,
  })))
  assert.equal(side('behind').querySelector('.photo-hint'), null, 'Behind: no prompt over the title')
  assert.ok(side('behind').querySelector('.photo.empty'), 'the place is there, empty')
  assert.ok(side('left').querySelector('.photo-hint'), 'Left keeps its prompt')
  assert.ok(side('right').querySelector('.photo-hint'), 'Right keeps its prompt')
}

// ---- 5. Slide settings: Replace… and Remove under Behind; Choose… for an empty one; nothing under the others.
{
  const settings = (data: Record<string, unknown>, picker = true) => parse(renderToStaticMarkup(createElement(SlideSettings, {
    number: 2, kind: '', data, onKind: noop, onChange: noop, onClose: noop, onChoosePicture: picker ? noop : undefined,
  })))
  const actions = (root: ReturnType<typeof settings>) => root.querySelector('[aria-label="The picture behind"]')?.querySelectorAll('button').map(button => button.text.trim()) ?? null
  assert.deepEqual(actions(settings({ markdown: '# A', picture: 'behind', image: 'images/dock.jpg' })), ['Replace…', 'Remove'])
  assert.deepEqual(actions(settings({ markdown: '# A', picture: 'behind' })), ['Choose…'])
  assert.equal(actions(settings({ markdown: '# A', picture: 'left', image: 'images/dock.jpg' })), null)
  assert.equal(actions(settings({ markdown: '# A' })), null)
  assert.equal(actions(settings({ markdown: '# A', picture: 'behind', image: 'images/dock.jpg' }, false)), null, 'no picker, no actions')
  // The group sits right under the Picture tiles, before Content.
  const root = settings({ markdown: '# A', picture: 'behind', image: 'images/dock.jpg' })
  const order = root.querySelectorAll('.deck-settings-k, [aria-label="The picture behind"]').map(element => element.getAttribute('aria-label') ?? element.text)
  assert.deepEqual(order, ['Picture', 'The picture behind', 'Content'])
  // Remove takes the picture, its description and its focus out; the place stays.
  assert.deepEqual(behindRemoved(), { image: undefined, alt: undefined, focus: undefined })
  // Behind chosen with no picture opens the picker at once; with one, or another place, it doesn't.
  const source = fs.readFileSync(path.join(here, '..', 'SlideSettings.tsx'), 'utf8')
  assert.match(source, /if \(picture === 'behind' && !data\.image\?\.trim\(\)\) onChoosePicture\?\.\(\)/)
}

// ---- 6. The stage: a press on the words' box itself (no words under it) chooses the picture Behind; a paste while it
// is chosen replaces it; a drop on the slide's edges goes into its place. (The editor's wiring, read from its source; the
// app run proves the behaviour, `proof/pr4-picture-behind/`.)
{
  const editor = fs.readFileSync(path.join(here, 'SlideEditor.tsx'), 'utf8')
  // Caught on the way down (capture), so the words' editor never takes the caret or the focus; only on the box itself.
  assert.match(editor, /onPointerDownCapture=\{event => \{\s+if \(pressOnEmptyWords\(event\)\) chooseSide\(\)\s+\}\}/)
  assert.match(editor, /onMouseDownCapture=\{event => \{\s+if \(pressOnEmptyWords\(event\)\) event\.preventDefault\(\)\s+\}\}/)
  assert.match(editor, /const pressOnEmptyWords = [^\n]*\n[^\n]*!event\.shiftKey && !event\.ctrlKey && !event\.metaKey && !event\.altKey\n[^\n]*event\.target === editor\.view\.dom/)
  // Never stops the press: an open popover still closes on it.
  assert.ok(!/pressOnEmptyWords\(event\)[^\n]*\n[^\n]*stopPropagation/.test(editor))
  assert.ok(editor.includes("document.addEventListener('paste', paste)"))
  // Only a picture is taken on the slide's edges: another file's drag isn't accepted there.
  assert.ok(editor.includes("item.kind === 'file' && item.type.startsWith('image/')"))
  // The chip is measured with every fit and render, never by a state counter per key.
  assert.ok(editor.includes('placeChipRef.current()') && !editor.includes('wordsMoved'))
  // An empty Behind place: a press chooses it, never opens the file picker by surprise (the chip's Choose… does).
  const side = fs.readFileSync(path.join(here, 'SidePicture.tsx'), 'utf8')
  assert.ok(side.includes("if (!url && !missing && side !== 'behind') props.onReplace()"))
  // The app run's fault (Behind chosen in Slide settings blanked the deck view) is tested in bubbleMenuBox.test.ts.
}

console.log('behindChip: passed')
