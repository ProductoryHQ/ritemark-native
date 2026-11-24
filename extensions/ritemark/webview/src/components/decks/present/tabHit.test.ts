/** #974: a tab click is a wall action only on the shown slide with the presenter view off. */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { createWindow } from '@mixmark-io/domino'
import { tabHit, wallTabHit } from './tabHit'

const { document } = createWindow(`
  <div class="wall-slide">
    <div class="blk-tabs" data-tabs-index="2">
      <div class="blk-tabbar"><span class="blk-tab">One</span><span class="blk-tab"><b>Two</b></span></div>
      <div class="blk-tabpanes"><div class="blk-tabpane">Content</div></div>
    </div>
  </div>
  <div class="wall-slide is-leaving">
    <div class="blk-tabs" data-tabs-index="1"><div class="blk-tabbar"><span class="blk-tab">Old</span></div></div>
  </div>
`)
Object.assign(globalThis, { Element: document.defaultView!.Element })

const shown = document.querySelector('.wall-slide')
const insideTab = shown?.querySelector('b') ?? null
const pane = shown?.querySelector('.blk-tabpane') ?? null
const leavingTab = document.querySelector('.is-leaving .blk-tab')
assert.ok(shown && insideTab && pane && leavingTab)
assert.deepEqual(tabHit(insideTab), { block: 2, tab: 1 }, 'a descendant names its block and tab')
assert.equal(tabHit(pane), null, 'the pane is outside the tab')
assert.equal(tabHit(null), null)

const wall = readFileSync(new URL('./DeckWall.tsx', import.meta.url), 'utf8')
assert.match(wall, /const tab = wallTabHit\(event.target, enteringRef.current, current.presenter.on\)\s+if \(tab\) \{[\s\S]*?sendToExtension\('present\/tab', tab\)\s+return\s+\}[\s\S]*?actOnClick\(spotClickOf/, 'a tab click returns before the wall acts on its own click')
assert.deepEqual(wallTabHit(insideTab, shown, false), { block: 2, tab: 1 })
assert.equal(wallTabHit(insideTab, shown, true), null, 'with the presenter view on, use the usual wall click')
assert.equal(wallTabHit(pane, shown, false), null, 'outside a tab, use the usual wall click')
assert.equal(wallTabHit(leavingTab, shown, false), null, 'only tabs on the shown slide count')
console.log('tabHit: ok')
