/**
 * Sprint 171 (#876; the decks README, the Button block): a lone button never moves under the pointer that chooses it,
 * on a slide and in a Text document. The pill's place inside the block's slot is its margin plus padding on the left
 * and on top, and the slot's height is margin + padding + the pill + padding + margin; both must be the same chosen,
 * not chosen, and not chosen again. The rules are read from slide.css and buttonBlock.css in cascade order (each
 * selector below is the state's own, in the order the sheets write them). Run with `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
const slideCss = read('../../components/decks/slide/slide.css')
const textCss = read('./buttonBlock.css')

/** Every declaration of the top-level rules whose selector is one of `selectors`, later ones winning. */
function cascade(sheet: string, selectors: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of sheet.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    if (!selectors.includes(m[1].trim())) continue
    for (const part of m[2].split(';')) {
      const at = part.indexOf(':')
      if (at > 0) out[part.slice(0, at).trim()] = part.slice(at + 1).trim()
    }
  }
  return out
}

function len(v: string, fit: number): number {
  v = v.trim()
  if (v === '0') return 0
  let m = /^calc\((-?[\d.]+)px \* var\(--fit, 1\)\)$/.exec(v)
  if (m) return Number(m[1]) * fit
  m = /^(-?[\d.]+)px$/.exec(v)
  if (m) return Number(m[1])
  m = /^(-?[\d.]+)em$/.exec(v)
  if (m) return Number(m[1]) * 16
  throw new Error(`not a length: ${v}`)
}

/** top, right, bottom, left of a margin/padding shorthand. */
function box(v: string | undefined, fit: number): number[] {
  if (!v || v === 'none') return [0, 0, 0, 0]
  const parts = v.match(/calc\([^)]*\)\)|calc\([^)]*\)|\S+/g)!.map((p) => len(p, fit))
  const [t, r = t, b = t, l = r] = parts
  return [t, r, b, l]
}

function place(sheet: string, selectors: string[], fit: number, pill: number) {
  const d = cascade(sheet, selectors)
  const [mt, , mb, ml] = box(d.margin, fit)
  const [pt, , pb, pl] = box(d.padding, fit)
  return { left: ml + pl, top: mt + pt, slot: mt + pt + pill + pb + mb }
}

const surfaces = [
  {
    name: 'slide', sheet: slideCss, fits: [1, 0.5], pill: 40,
    base: '.deck-sl.is-blocks .blk-button',
    idle: '.deck-sl.is-blocks .blk-button.is-solo:not(.is-chosen)',
    chosen: '.deck-sl.is-blocks .blk-button.is-solo.is-chosen',
  },
  {
    name: 'Text document', sheet: textCss, fits: [1], pill: 36,
    base: '.blk-button:not(.deck-sl *)',
    idle: '.blk-button.is-solo:not(.is-chosen):not(.deck-sl *)',
    chosen: '.blk-button.is-solo.is-chosen:not(.deck-sl *)',
  },
]

for (const s of surfaces) {
  for (const fit of s.fits) {
    const idle = place(s.sheet, [s.base, s.idle], fit, s.pill)
    const chosen = place(s.sheet, [s.base, s.chosen], fit, s.pill)
    const again = place(s.sheet, [s.base, s.idle], fit, s.pill)
    assert.deepEqual(chosen, idle, `${s.name} at fit ${fit}: the pill and its slot stay put when chosen (${JSON.stringify(idle)} → ${JSON.stringify(chosen)})`)
    assert.deepEqual(again, idle, `${s.name} at fit ${fit}: and when no longer chosen`)
  }
  // The chosen card still shows: a layer behind the pill, reaching out 10 above and under and 18 on the left.
  const layer = cascade(s.sheet, [`${s.chosen}::before`])
  assert.equal(layer.position, 'absolute', `${s.name}: the chosen card is drawn as a layer`)
  assert.ok(layer.background && layer['box-shadow'], `${s.name}: the layer has the card's fill and edge`)
  assert.deepEqual(box(layer.inset, 1), [-10, 0, -10, -18], `${s.name}: the card grows outward around the pill`)
  // The words come first in the block; chosen, their field opens after the pill, so the pill keeps the left edge.
  assert.equal(cascade(s.sheet, [`${s.chosen} > .blk-button-words`]).order, '1', `${s.name}: the words open on the pill's right`)
}

// A button with words beside it is untouched: its card keeps its padding.
assert.deepEqual(box(cascade(slideCss, ['.deck-sl.is-blocks .blk-button']).padding, 1), [10, 12, 10, 18])
assert.deepEqual(box(cascade(textCss, ['.blk-button:not(.deck-sl *)']).padding, 1), [10, 12, 10, 18])

console.log('soloButtonStill: ok')
