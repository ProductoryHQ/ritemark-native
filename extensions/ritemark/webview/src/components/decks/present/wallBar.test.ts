/**
 * Sprint 166 Fix 6 (#842): the Present bar sits at the screen's foot, its box wholly outside the slide's content box.
 * Run with `npx tsx webview/src/components/decks/present/wallBar.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { SLIDE_BOTTOM_MARGIN, WALL_BAR_FROM_EDGE, WALL_BAR_HEIGHT, WALL_LINE_HEIGHT, wallBarBottom, wallBarClass, wallLineClass, wallSlideSize } from './wallKeys'

// 16:10 laptops (1440×900 leaves a band under the slide), 16:9 screens (the bar sits in the slide's bottom margin), 4:3.
for (const [width, height] of [[1440, 900], [1280, 800], [1680, 1050], [1920, 1080], [2560, 1440], [1366, 768], [1024, 768]]) {
  const frame = wallSlideSize(width, Math.max(0, height - WALL_LINE_HEIGHT))
  const frameBottom = Math.max(0, height - frame.top - frame.height)
  const bottom = wallBarBottom(frameBottom)
  // The content box's lowest edge, in px from the screen's bottom edge.
  const contentBottom = frameBottom + frame.height * SLIDE_BOTTOM_MARGIN
  assert.equal(bottom, WALL_BAR_FROM_EDGE, `${width}×${height}: the bar's bottom is 12 px from the screen's edge`)
  assert.ok(bottom + WALL_BAR_HEIGHT <= contentBottom, `${width}×${height}: the bar's top (${bottom + WALL_BAR_HEIGHT}) reaches into the content (from ${contentBottom.toFixed(1)})`)
}
// While the bar shows, the quiet line fades out; when the bar fades, the line comes back (the Experience lead, PR 6).
assert.equal(wallBarClass(true), 'wall-bar dark is-shown')
assert.equal(wallLineClass(true), 'wall-line is-hidden')
assert.equal(wallBarClass(false), 'wall-bar dark')
assert.equal(wallLineClass(false), 'wall-line')

// The wall uses both, from the same state, and the line fades with the bar's own timing.
const wall = readFileSync(new URL('./DeckWall.tsx', import.meta.url), 'utf8')
assert.ok(wall.includes('className={wallBarClass(barVisible)}'), 'the bar takes its classes from wallBarClass')
assert.ok(wall.includes('className={wallLineClass(barVisible)}'), 'the line takes its classes from wallLineClass')
assert.ok(wall.includes('barVisible={barVisible}'), 'the line is given the bar\'s own state')
const css = readFileSync(new URL('./wall.css', import.meta.url), 'utf8')
const barFade = /\.wall-bar \{[^}]*transition: (opacity [^;]+);/.exec(css)?.[1]
const lineFade = /\.wall-line \{ transition: (opacity [^;]+); \}/.exec(css)?.[1]
assert.ok(barFade, 'the bar has a fade')
assert.equal(lineFade, barFade, 'the line fades with the bar\'s timing')
assert.ok(/\.wall-line\.is-hidden \{ opacity: 0; \}/.test(css), 'a hidden line is transparent')
assert.ok(/prefers-reduced-motion: reduce\) \{ \.wall-line \{ transition: none; \} \}/.test(css), 'reduced motion: no fade')
console.log('wallBar: ok')
