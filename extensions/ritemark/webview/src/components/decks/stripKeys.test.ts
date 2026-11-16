/**
 * The slide strip's keys: Backspace or Delete deletes the selected slide (Jarmo, 16 November), from the strip or a
 * thumbnail, never with one slide left, and never from words typed elsewhere.
 *
 * Run: npx tsx webview/src/components/decks/stripKeys.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { keyOrigin, stripKeyOf, type OriginElement } from './stripKeys'

// A strip with one thumbnail whose ⋯ button can take the focus, a slide box (editable) inside a thumbnail, a + between
// thumbnails, and a handout and a menu item outside the strip.
const inStrip = new Set<unknown>()
const el = (opts: { thumb?: boolean; editable?: boolean; tag?: string; inside?: boolean }): OriginElement => {
  const node: OriginElement = {
    closest: selector => (selector === '[data-thumb]' && opts.thumb ? {} : null),
    isContentEditable: !!opts.editable,
    tagName: opts.tag ?? 'DIV',
  }
  if (opts.inside) inStrip.add(node)
  return node
}
const strip = Object.assign(el({}), { contains: (node: unknown) => node === strip || inStrip.has(node) })
const moreButton = el({ thumb: true, tag: 'BUTTON', inside: true })
const thumb = el({ thumb: true, inside: true })
const gapPlus = el({ tag: 'BUTTON', inside: true })
const boxInThumb = el({ thumb: true, editable: true, inside: true })
const handout = el({ editable: true })
const menuItem = el({}) // portalled: React hands its keys up to the strip, but it is not in the strip

assert.equal(keyOrigin(strip, strip), 'strip')
assert.equal(keyOrigin(moreButton, strip), 'thumb')
assert.equal(keyOrigin(thumb, strip), 'thumb')
assert.equal(keyOrigin(gapPlus, strip), 'other', 'a + between thumbnails is not a thumbnail')
assert.equal(keyOrigin(boxInThumb, strip), 'other', 'words being typed are never the strip\'s')
assert.equal(keyOrigin(handout, strip), 'other')
assert.equal(keyOrigin(menuItem, strip), 'other', 'a menu item\'s keys stay the menu\'s')
assert.equal(keyOrigin(null, strip), 'other')

// ---- Backspace on the focused strip removes the selected slide
assert.deepEqual(stripKeyOf({ key: 'Backspace' }, 'strip', 5, 2), { type: 'delete', index: 2 })
assert.deepEqual(stripKeyOf({ key: 'Delete' }, 'strip', 5, 2), { type: 'delete', index: 2 })

// ---- Both keys work with the focus on a thumbnail (its ⋯ has it after its menu closes)
assert.deepEqual(stripKeyOf({ key: 'Backspace' }, keyOrigin(moreButton, strip), 5, 3), { type: 'delete', index: 3 })
assert.deepEqual(stripKeyOf({ key: 'Delete' }, keyOrigin(thumb, strip), 5, 0), { type: 'delete', index: 0 })

// ---- Nothing happens with a single slide (the menu's Delete slide is off for it too), or none
assert.equal(stripKeyOf({ key: 'Backspace' }, 'strip', 1, 0), null)
assert.equal(stripKeyOf({ key: 'Delete' }, 'thumb', 1, 0), null)
assert.equal(stripKeyOf({ key: 'Delete' }, 'strip', 0, 0), null)

// ---- Typing in the handout, on the stage or in a slide box is unaffected
for (const key of ['Backspace', 'Delete', 'ArrowDown', 'Home', 'End']) {
  assert.equal(stripKeyOf({ key }, keyOrigin(handout, strip), 5, 2), null, `handout ${key}`)
  assert.equal(stripKeyOf({ key }, keyOrigin(boxInThumb, strip), 5, 2), null, `slide box ${key}`)
  assert.equal(stripKeyOf({ key }, keyOrigin(menuItem, strip), 5, 2), null, `menu ${key}`)
}

// ---- With a modifier, or already taken by a menu button, the key is not the strip's
for (const mod of ['metaKey', 'ctrlKey', 'altKey', 'shiftKey'] as const) {
  assert.equal(stripKeyOf({ key: 'Backspace', [mod]: true }, 'strip', 5, 2), null, mod)
}
assert.equal(stripKeyOf({ key: 'Delete', defaultPrevented: true }, 'thumb', 5, 2), null)

// ---- The keys the strip had keep working on the strip itself, and stay the ⋯ button's on a thumbnail
assert.deepEqual(stripKeyOf({ key: 'Home' }, 'strip', 5, 3), { type: 'pick', index: 0 })
assert.deepEqual(stripKeyOf({ key: 'End' }, 'strip', 5, 1), { type: 'pick', index: 4 })
assert.deepEqual(stripKeyOf({ key: 'ArrowDown' }, 'strip', 5, 4), { type: 'pick', index: 4 })
assert.deepEqual(stripKeyOf({ key: 'ArrowUp' }, 'strip', 5, 0), { type: 'pick', index: 0 })
assert.deepEqual(stripKeyOf({ key: 'ArrowRight' }, 'strip', 5, 1), { type: 'pick', index: 2 })
assert.deepEqual(stripKeyOf({ key: 'F10', shiftKey: true }, 'strip', 5, 1), { type: 'menu' })
assert.deepEqual(stripKeyOf({ key: 'ContextMenu' }, 'strip', 5, 1), { type: 'menu' })
assert.equal(stripKeyOf({ key: 'F10' }, 'strip', 5, 1), null)
assert.equal(stripKeyOf({ key: 'ArrowDown' }, 'thumb', 5, 1), null)
assert.equal(stripKeyOf({ key: 'a' }, 'strip', 5, 1), null)

// ---- The strip calls remove with it, and its menu's Delete slide shows the key
const source = readFileSync(new URL('./SlideStrip.tsx', import.meta.url), 'utf8')
assert.match(source, /onKeyDown=\{onKey\}/)
assert.match(source, /keyOrigin\(event\.target as HTMLElement, event\.currentTarget\)/)
assert.match(source, /else actions\.remove\(key\.index\)/)
assert.match(source, /Delete slide<\/span>\s*<span className="deck-menu-key">\{DELETE_KEY\}<\/span>/)

console.log('stripKeys: ok')
