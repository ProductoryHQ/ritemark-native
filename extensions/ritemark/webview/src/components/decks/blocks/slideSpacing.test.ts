/**
 * Sprint 164 PR 2: spacing on the slide, variant D (the decks README, "Spacing on the slide"; `spacing-gap.html`).
 * Three sizes, all slide px times the fit and never an em of a block's own type: 12 under every block and none above or
 * under the last; 18 inside every surface (a box, a tab's pane, the code block's sides and foot; table cells 18 at the
 * sides and 9 above and under; the first tab's name 5 + 13 from the band's edge); 32 between columns, 16 between boxes,
 * and a column with no padding of its own. The values are read from slide.css (the one sheet the stage, the strip, the
 * wall, the presenter view and the page draw with) and computed at two fit levels. Run with `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../slide/slide.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
const decks = readFileSync(new URL('../decks.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')

/** The declarations of the rule whose selector list is exactly `selector` (top level, outside @-blocks' own rules). */
function rule(sheet: string, selector: string): Record<string, string> {
  const found: Record<string, string> = {}
  let hit = false
  for (const match of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].trim() !== selector) continue
    hit = true
    for (const part of match[2].split(';')) {
      const at = part.indexOf(':')
      if (at > 0) found[part.slice(0, at).trim()] = part.slice(at + 1).trim()
    }
  }
  assert.ok(hit, `slide.css has a rule for ${selector}`)
  return found
}

/** One length at a fit: `0`, `Npx`, or `calc(Npx * var(--fit, 1))`. An em is refused: it would follow a block's type. */
function px(value: string, fit: number): number {
  const v = value.trim()
  if (v === '0') return 0
  let m = /^calc\((-?[\d.]+)px \* var\(--fit, 1\)\)$/.exec(v)
  if (m) return Number(m[1]) * fit
  m = /^(-?[\d.]+)px$/.exec(v)
  if (m) return Number(m[1])
  throw new Error(`not a slide-px length: ${v}`)
}

/** A margin or padding shorthand, as [top, right, bottom, left] at a fit. */
function box(value: string, fit: number): [number, number, number, number] {
  const parts = value.match(/calc\([^)]*\)\)|[^ ]+/g) ?? []
  const n = parts.map(part => px(part, fit))
  const [t, r = t, b = t, l = r] = n
  return [t, r, b, l]
}

const close = (actual: number, expected: number, what: string) => assert.ok(Math.abs(actual - expected) < 1e-9, `${what}: ${actual} (expected ${expected})`)

const B = '.deck-sl.is-blocks'
const BLOCKS: Array<[string, string]> = [
  ['a paragraph', `${B} p`],
  ['a list', `${B} ul, ${B} ol`],
  ['a code block', `${B} pre`],
  ['a quote', `${B} blockquote`],
  ['a table', `${B} table`],
  ['a Columns block', `${B} .blk-columns`],
  ['a Boxes block', `${B} .blk-boxes`],
  ['a Tabs block', `${B} .blk-tabs`],
  ['a Button', `${B} .blk-button`],
  ['a picture', `${B} .blk-pic`],
  ['an Agenda', `${B} .blk-agenda`],
]

for (const fit of [1, 0.7]) {
  // Between blocks: 12 under every block, none above.
  for (const [what, selector] of BLOCKS) {
    const [top, , bottom] = box(rule(css, selector).margin, fit)
    close(top, 0, `${what} has no space above it at fit ${fit}`)
    close(bottom, 12 * fit, `${what} has 12 under it at fit ${fit}`)
  }
  // The editor's own picture and Agenda follow the same rule.
  close(box(rule(decks, `${B}.is-editing .blk-flow img`).margin, fit)[2], 12 * fit, `the stage's picture has 12 under it at fit ${fit}`)
  close(box(rule(decks, `${B}.is-editing .blk-flow .blk-agenda-host`).margin, fit)[2], 12 * fit, `the stage's Agenda has 12 under it at fit ${fit}`)

  // Inside a surface: 18.
  for (const side of box(rule(css, `${B} .blk-box`).padding, fit)) close(side, 18 * fit, `a box's padding at fit ${fit}`)
  for (const side of box(rule(css, `${B} .blk-tabpane`).padding, fit)) close(side, 18 * fit, `a tab pane's padding at fit ${fit}`)
  const code = box(rule(css, `${B} pre.cb`).padding, fit)
  close(code[0], 0, 'the code block keeps its Copy row at its top')
  close(code[1], 18 * fit, `the code block's sides at fit ${fit}`)
  close(code[3], 18 * fit, `the code block's sides at fit ${fit}`)
  close(code[2], 18 * fit, `the code block's foot at fit ${fit}`)
  const cell = box(rule(css, `${B} th, ${B} td`).padding, fit)
  close(cell[0], 9 * fit, `a cell's top at fit ${fit}`); close(cell[2], 9 * fit, `a cell's foot at fit ${fit}`)
  close(cell[1], 18 * fit, `a cell's sides at fit ${fit}`); close(cell[3], 18 * fit, `a cell's sides at fit ${fit}`)
  // The first tab's name lines up with the pane's words: the band's 5 and the tab's 13.
  const band = box(rule(css, `${B} .blk-tabbar`).padding, fit)
  const tab = box(rule(css, `${B} .blk-tab`).padding, fit)
  if (fit === 1) close(band[3] + tab[3], 18, 'the first tab\'s name starts 18 from the band\'s edge, as the pane\'s words do')

  // Side by side: 32 between columns, 16 between boxes, and a column has no padding at any side.
  close(px(rule(css, `${B} .blk-columns`)['column-gap'], fit), 32 * fit, `the columns' gap at fit ${fit}`)
  close(px(rule(css, `${B} .blk-boxes`).gap, fit), 16 * fit, `the boxes' gap at fit ${fit}`)
  for (const side of box(rule(css, `${B} .blk-column`).padding, fit)) close(side, 0, `a column's padding at fit ${fit}`)
}

// None under the last block, in the flow and in a column, a box and a pane.
assert.match(css, /\.deck-sl\.is-blocks \.blk-flow > :last-child \{ margin-bottom: 0; \}/, 'none under the last block')
assert.match(css, /\.deck-sl\.is-blocks \.blk-column > :last-child, \.deck-sl\.is-blocks \.blk-box > :last-child \{ margin-bottom: 0; \}/, 'none under a column\'s or a box\'s last block')
assert.match(css, /\.deck-sl\.is-blocks \.blk-tabpane > :last-child \{ margin-bottom: 0; \}/, 'none under a pane\'s last block')
// No column carries its own space: the first-column exception is gone with it.
assert.ok(!css.includes('.blk-column:first-child { padding-left'), 'no first-column padding rule')
// No block keeps today's em top margins.
for (const old of ['margin: .3em 0', 'margin: .2em 0']) assert.ok(!css.includes(old), `slide.css has no "${old}"`)

console.log('slideSpacing: ok')
