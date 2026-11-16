/**
 * The slide strip's keys: Backspace or Delete deletes the selected slide (Jarmo, 16 November), from the strip or a
 * thumbnail, never with one slide left, never on a held key's repeats, and never from words typed elsewhere.
 *
 * Run: npx tsx webview/src/components/decks/stripKeys.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { keyOrigin, stripKeyOf, type OriginElement } from './stripKeys'

// A strip with thumbnails whose ⋯ buttons can take the focus, a slide box (editable) inside a thumbnail, a + between
// thumbnails, and a handout and a menu item outside the strip.
const inStrip = new Set<unknown>()
const el = (opts: { thumb?: number; editable?: boolean; tag?: string; inside?: boolean }): OriginElement => {
  const node: OriginElement = {
    closest: selector => (selector === '[data-thumb]' && opts.thumb !== undefined ? { getAttribute: () => String(opts.thumb) } : null),
    isContentEditable: !!opts.editable,
    tagName: opts.tag ?? 'DIV',
  }
  if (opts.inside) inStrip.add(node)
  return node
}
const strip = Object.assign(el({}), { contains: (node: unknown) => node === strip || inStrip.has(node) })
const moreButton3 = el({ thumb: 3, tag: 'BUTTON', inside: true })
const thumb0 = el({ thumb: 0, inside: true })
const gapPlus = el({ tag: 'BUTTON', inside: true })
const boxInThumb = el({ thumb: 1, editable: true, inside: true })
const handout = el({ editable: true })
const menuItem = el({}) // portalled: React hands its keys up to the strip, but it is not in the strip

assert.deepEqual(keyOrigin(strip, strip), { from: 'strip' })
assert.deepEqual(keyOrigin(moreButton3, strip), { from: 'thumb', index: 3 })
assert.deepEqual(keyOrigin(thumb0, strip), { from: 'thumb', index: 0 })
assert.equal(keyOrigin(gapPlus, strip), null, 'a + between thumbnails is not a thumbnail')
assert.equal(keyOrigin(boxInThumb, strip), null, 'words being typed are never the strip\'s')
assert.equal(keyOrigin(handout, strip), null)
assert.equal(keyOrigin(menuItem, strip), null, 'a menu item\'s keys stay the menu\'s')
assert.equal(keyOrigin(null, strip), null)

const onStrip = { from: 'strip' } as const

// ---- Backspace on the focused strip removes the selected slide
assert.deepEqual(stripKeyOf({ key: 'Backspace' }, onStrip, 5, 2), { type: 'delete', index: 2 })
assert.deepEqual(stripKeyOf({ key: 'Delete' }, onStrip, 5, 2), { type: 'delete', index: 2 })

// ---- Both keys work with the focus on a thumbnail, and delete that thumbnail's slide, as its menu's Delete slide does
assert.deepEqual(stripKeyOf({ key: 'Backspace' }, keyOrigin(moreButton3, strip), 5, 1), { type: 'delete', index: 3 })
assert.deepEqual(stripKeyOf({ key: 'Delete' }, keyOrigin(thumb0, strip), 5, 4), { type: 'delete', index: 0 })
assert.equal(stripKeyOf({ key: 'Delete' }, { from: 'thumb', index: 5 }, 5, 0), null, 'a thumbnail already gone')

// ---- Nothing happens with a single slide (the menu's Delete slide is off for it too), or none
assert.equal(stripKeyOf({ key: 'Backspace' }, onStrip, 1, 0), null)
assert.equal(stripKeyOf({ key: 'Delete' }, { from: 'thumb', index: 0 }, 1, 0), null)
assert.equal(stripKeyOf({ key: 'Delete' }, onStrip, 0, 0), null)

// ---- A held key deletes one slide, not one per repeat
assert.equal(stripKeyOf({ key: 'Backspace', repeat: true }, onStrip, 5, 2), null)

// ---- Typing in the handout, on the stage or in a slide box is unaffected
for (const key of ['Backspace', 'Delete', 'ArrowDown', 'Home', 'End', 'z']) {
  assert.equal(stripKeyOf({ key, metaKey: key === 'z' }, keyOrigin(handout, strip), 5, 2), null, `handout ${key}`)
  assert.equal(stripKeyOf({ key }, keyOrigin(boxInThumb, strip), 5, 2), null, `slide box ${key}`)
  assert.equal(stripKeyOf({ key }, keyOrigin(menuItem, strip), 5, 2), null, `menu ${key}`)
}

// ---- With a modifier, or already taken by a menu button, the key is not the strip's
for (const mod of ['metaKey', 'ctrlKey', 'altKey', 'shiftKey'] as const) {
  assert.equal(stripKeyOf({ key: 'Backspace', [mod]: true }, onStrip, 5, 2), null, `Backspace ${mod}`)
  assert.equal(stripKeyOf({ key: 'ArrowDown', [mod]: true }, onStrip, 5, 2), null, `ArrowDown ${mod}`)
  assert.equal(stripKeyOf({ key: 'Home', [mod]: true }, onStrip, 5, 2), null, `Home ${mod}`)
}
assert.equal(stripKeyOf({ key: 'Delete', defaultPrevented: true }, { from: 'thumb', index: 1 }, 5, 2), null)

// ---- Cmd+Z on the strip goes to the deck's history, so a deleted slide comes back; redo too
assert.deepEqual(stripKeyOf({ key: 'z', metaKey: true }, onStrip, 4, 1), { type: 'undo', redo: false })
assert.deepEqual(stripKeyOf({ key: 'z', ctrlKey: true }, onStrip, 4, 1), { type: 'undo', redo: false })
assert.deepEqual(stripKeyOf({ key: 'Z', metaKey: true, shiftKey: true }, onStrip, 4, 1), { type: 'undo', redo: true })
assert.equal(stripKeyOf({ key: 'z', metaKey: true, isComposing: true }, onStrip, 4, 1), null)
assert.equal(stripKeyOf({ key: 'z' }, onStrip, 4, 1), null)

// ---- The keys the strip had keep working on the strip itself, and stay the ⋯ button's on a thumbnail
assert.deepEqual(stripKeyOf({ key: 'Home' }, onStrip, 5, 3), { type: 'pick', index: 0 })
assert.deepEqual(stripKeyOf({ key: 'End' }, onStrip, 5, 1), { type: 'pick', index: 4 })
assert.deepEqual(stripKeyOf({ key: 'ArrowDown' }, onStrip, 5, 4), { type: 'pick', index: 4 })
assert.deepEqual(stripKeyOf({ key: 'ArrowUp' }, onStrip, 5, 0), { type: 'pick', index: 0 })
assert.deepEqual(stripKeyOf({ key: 'ArrowRight' }, onStrip, 5, 1), { type: 'pick', index: 2 })
assert.deepEqual(stripKeyOf({ key: 'F10', shiftKey: true }, onStrip, 5, 1), { type: 'menu' })
assert.deepEqual(stripKeyOf({ key: 'ContextMenu' }, onStrip, 5, 1), { type: 'menu' })
assert.equal(stripKeyOf({ key: 'F10' }, onStrip, 5, 1), null)
assert.equal(stripKeyOf({ key: 'ArrowDown' }, { from: 'thumb', index: 1 }, 5, 1), null)
assert.equal(stripKeyOf({ key: 'a' }, onStrip, 5, 1), null)

// ---- The strip uses these keys, and its menu's Delete slide shows the key (a wiring check, not a behaviour test)
const source = readFileSync(new URL('./SlideStrip.tsx', import.meta.url), 'utf8')
assert.ok(source.includes('stripKeyOf(') && source.includes('keyOrigin('), 'SlideStrip reads its keys from stripKeys')
assert.ok(source.includes('deck-menu-key'), 'Delete slide shows its key')

console.log('stripKeys: ok')
