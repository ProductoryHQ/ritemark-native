/**
 * Small details item 3: the page's QR code on the wall encodes the page's exact address, and a camera can read it in
 * the theme's ink on its ground. Each code is drawn to pixels here exactly as the wall's SVG draws it (the quiet zone
 * in the ground, the path's modules in the ink) and read back by an independent decoder (jsQR, a dev dependency only).
 * Run: npx tsx webview/src/components/decks/present/pageCode.test.ts
 */
import assert from 'node:assert/strict'
import jsQR from 'jsqr'
import { BUILT_IN_THEME, type DeckTheme } from '../../../../../src/decks/deckTheme'
import { contrast } from '../theme/themeVars'
import { CODE_CONTRAST, CODE_SHARE, codeSide, codeText, pageCodeColours, pageCodeOf, pageCodePath, QUIET_ZONE, shortAddress, type PageCode } from './pageCode'

const BLACK = '#000000'
const hex = (colour: string) => [1, 3, 5].map(at => parseInt(colour.slice(at, at + 2), 16))

/** The modules the path draws, read back from its `M x y h w v1 h-w z` rectangles. */
function modulesOfPath(path: string, size: number): boolean[][] {
  const dark = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  for (const match of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
    const [x, y, width, back] = match.slice(1).map(Number)
    assert.equal(width, back, 'each rectangle closes on itself')
    for (let column = x; column < x + width; column++) dark[y - QUIET_ZONE][column - QUIET_ZONE] = true
  }
  return dark
}

/** The code as pixels: `scale` per module, the quiet zone in the ground, as the wall's SVG draws it. */
function pixelsOf(code: PageCode, ink: string, ground: string, scale = 6): { data: Uint8ClampedArray; width: number } {
  const dark = modulesOfPath(pageCodePath(code), code.size)
  const side = (code.size + QUIET_ZONE * 2) * scale
  const data = new Uint8ClampedArray(side * side * 4)
  const [ir, ig, ib] = hex(ink)
  const [gr, gg, gb] = hex(ground)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const row = Math.floor(y / scale) - QUIET_ZONE
      const column = Math.floor(x / scale) - QUIET_ZONE
      const on = row >= 0 && column >= 0 && row < code.size && column < code.size && dark[row][column]
      const at = (y * side + x) * 4
      data[at] = on ? ir : gr
      data[at + 1] = on ? ig : gg
      data[at + 2] = on ? ib : gb
      data[at + 3] = 255
    }
  }
  return { data, width: side }
}

function read(code: PageCode, modules: string, field: string): string | null {
  const { data, width } = pixelsOf(code, modules, field)
  // Dark modules on a light field, as every phone reads: jsQR is never told to try the code inverted.
  return jsQR(data, width, width, { inversionAttempts: 'dontInvert' })?.data ?? null
}

const ADDRESSES = [
  'https://training-day.example.workers.dev/',
  'https://a.b.workers.dev/',
  'https://onboarding-for-new-trainers-2026.productory-example.workers.dev/',
]

const DARK: DeckTheme = BUILT_IN_THEME
const LIGHT: DeckTheme = { ...BUILT_IN_THEME, name: 'Paper', bg: '#FAF7F0', head: '#1F2937', text: '#374151', glow: false }
// Headings too faint on their ground for a camera: the code takes black or white instead.
const FAINT: DeckTheme = { ...BUILT_IN_THEME, name: 'Faint', bg: '#8090A0', head: '#A0B0C0', text: '#B0C0D0', glow: false }
// A mid-dark ground, where a light-on-dark code is missed (jsQR, inverted, on #3D428F at 6 px a module).
const DUSK: DeckTheme = { ...BUILT_IN_THEME, name: 'Dusk', bg: '#3D428F', head: '#FFFFFF', text: '#E4E6F7', glow: false }
const THEMES = [DARK, LIGHT, FAINT, DUSK]

// ---- the code encodes the exact address, read back by an independent decoder, in every look
for (const address of ADDRESSES) {
  const code = pageCodeOf(address)
  assert.ok(code.size >= 21 && code.size % 4 === 1, `a QR code's size (${code.size})`)
  assert.deepEqual(modulesOfPath(pageCodePath(code), code.size), code.dark, 'the path draws exactly the dark modules')
  for (const theme of THEMES) {
    for (const borderless of [false, true]) {
      const { modules, field } = pageCodeColours(theme, borderless)
      assert.equal(read(code, modules, field), address, `${address} on ${theme.name}${borderless ? ' Borderless' : ''}`)
    }
  }
}

// ---- the theme's two colours, dark modules on a light field, with the contrast a camera needs
{
  const card = pageCodeColours(DARK, false)
  assert.deepEqual(card, { ink: '#FFFFFF', ground: '#1C1F4A', modules: '#1C1F4A', field: '#FFFFFF', tile: true }, 'Evening: a white tile, the modules in its ground')
  const borderless = pageCodeColours(DARK, true)
  assert.equal(borderless.field, '#FFFFFF', 'Borderless: straight on white')
  assert.equal(borderless.tile, false)
  assert.equal(borderless.modules, borderless.ink)
  assert.notEqual(borderless.ink, '#FFFFFF')
  assert.deepEqual(pageCodeColours(LIGHT, false), { ink: '#1F2937', ground: '#FAF7F0', modules: '#1F2937', field: '#FAF7F0', tile: false }, 'a light theme: its headings on its ground')
  const faint = pageCodeColours(FAINT, false)
  assert.equal(faint.ground, '#8090A0', 'the ground stays the theme’s')
  assert.ok(['#000000', '#FFFFFF'].includes(faint.ink), 'faint headings give way to black or white')
  for (const theme of THEMES) {
    for (const look of [false, true]) {
      const { modules, field } = pageCodeColours(theme, look)
      assert.ok(contrast(modules, BLACK) <= contrast(field, BLACK), `${theme.name}: the modules are the darker`)
      if (theme !== FAINT) assert.ok(contrast(modules, field) >= CODE_CONTRAST, `${theme.name}: ${contrast(modules, field).toFixed(1)} to 1`)
    }
  }
  // The fallback is the better of black and white, even when neither reaches the mark.
  assert.ok(contrast(faint.modules, faint.field) >= 3)
}

// ---- the size on the wall: the modules fill at least 40% of the wall's height, in whole pixels per module
for (const [width, height] of [[1440, 900], [1920, 1080], [1024, 768], [1280, 800], [800, 450]]) {
  const code = pageCodeOf(ADDRESSES[2])
  const side = codeSide(code.size, height, width)
  const modulePx = side / (code.size + QUIET_ZONE * 2)
  assert.ok(Number.isInteger(modulePx) && modulePx >= 1, 'whole pixels per module')
  assert.ok(modulePx * code.size >= height * 0.4, `${width}×${height}: the modules are ${Math.round(modulePx * code.size)} of ${height}`)
  assert.ok(side <= height * CODE_SHARE && side <= width * 0.9, 'it fits, the address under it')
}

// ---- the address as the room reads it, and as the code encodes it
assert.equal(shortAddress('https://training-day.example.workers.dev/'), 'training-day.example.workers.dev')
assert.equal(shortAddress('https://a.b.workers.dev/deck/'), 'a.b.workers.dev/deck')
assert.equal(codeText('https://a.b.workers.dev/'), 'https://a.b.workers.dev/', 'the exact address')
assert.equal(codeText('https://a.b.workers.dev/päev'), 'https://a.b.workers.dev/p%C3%A4ev', 'non-ASCII is percent-encoded, as a browser sends it')
assert.equal(read(pageCodeOf('https://a.b.workers.dev/päev'), '#000000', '#FFFFFF'), 'https://a.b.workers.dev/p%C3%A4ev')

console.log('pageCode: all tests passed')
