/**
 * Sprint 166 Fix 6 (#842): the Present bar sits at the screen's foot, its box wholly outside the slide's content box.
 * Run with `npx tsx webview/src/components/decks/present/wallBar.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { SLIDE_BOTTOM_MARGIN, WALL_BAR_FROM_EDGE, WALL_BAR_HEIGHT, WALL_LINE_HEIGHT, wallBarBottom, wallSlideSize } from './wallKeys'

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
console.log('wallBar: ok')
