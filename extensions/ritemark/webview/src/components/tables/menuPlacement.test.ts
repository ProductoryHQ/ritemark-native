/**
 * A table's menu fits the window (#982): under its anchor, above it, or moved up over it.
 *
 * Run: npx tsx webview/src/components/tables/menuPlacement.test.ts
 */
import { strict as assert } from 'node:assert'
import { MENU_EDGE, MENU_GAP, menuPlacement } from './menuPlacement'

const point = (top: number) => ({ top, height: 0 })

// Room below: under the anchor, at the usual gap.
assert.deepEqual(menuPlacement(point(100), 400, 900), { side: 'bottom', sideOffset: MENU_GAP })

// A grip near the window's foot, room above: the menu opens upward.
assert.deepEqual(menuPlacement({ top: 800, height: 14 }, 400, 900), { side: 'top', sideOffset: MENU_GAP })

// A right-click in the middle of the window, the menu taller than either half: moved up so its foot is at the edge.
{
  const placed = menuPlacement(point(450), 600, 900)
  assert.equal(placed.side, 'bottom')
  const top = 450 + placed.sideOffset
  assert.equal(top + 600, 900 - MENU_EDGE, 'the menu ends at the window\'s edge')
  assert.ok(top >= MENU_EDGE, 'and starts inside the window')
}

// Exactly the room below: still under the anchor.
assert.deepEqual(menuPlacement(point(100), 900 - MENU_EDGE - 100 - MENU_GAP, 900), { side: 'bottom', sideOffset: MENU_GAP })

// Taller than the window: it starts at the window's top edge (and scrolls in the room it has).
{
  const placed = menuPlacement(point(450), 2000, 900)
  assert.equal(placed.side, 'bottom')
  assert.equal(450 + placed.sideOffset, MENU_EDGE)
}

console.log('menuPlacement: all passed')
