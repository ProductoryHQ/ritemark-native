/**
 * Small details, item 3 (decks README, 17 November): the published page's link on the wall, as a QR code, so a phone
 * at the back of the room opens it. Pure, so the test reads the same code the wall draws.
 *
 *  - `pageCodeOf`: the code's modules for the page's address, made offline by qrcode-generator (MIT; its notice is
 *    below, a legal comment kept in the bundle). Error correction M, the size the address needs.
 *  - `pageCodePath`: the dark modules as one SVG path, a unit square each, for a `viewBox` that includes the quiet
 *    zone (`QUIET_ZONE` modules on every side, the standard's 4), so the code scales to any size without a seam.
 *  - `pageCodeColours`: the theme's two colours, its ink (the headings' colour) and its ground, always dark modules on
 *    a light field, the way every phone's camera reads a QR code (a light-on-dark code is missed by some scanners, and
 *    by jsQR on a mid-dark ground). On a light ground the code is the ink straight on the wall's ground; on a dark
 *    ground (Evening) it is a tile of the ink, white, with the modules in the ground's colour, its quiet zone inside the
 *    tile. Ink too faint against its ground is taken to black or white, whichever reads.
 *  - `shortAddress`: the address as the room reads it under the code: no `https://`, no trailing slash.
 */
import qrcode from 'qrcode-generator'
import type { DeckTheme } from '../../../../../src/decks/deckTheme'
import { contrast, themeVars } from '../theme/themeVars'

/** The quiet zone round the code, in modules: the QR standard's 4. */
export const QUIET_ZONE = 4
/** The least contrast between the code's ink and its ground that a phone's camera reads from the back of a room. */
export const CODE_CONTRAST = 7

export interface PageCode {
  /** Modules per side, without the quiet zone. */
  size: number
  /** `dark[row][column]`. */
  dark: boolean[][]
}

/** The address as a QR code encodes it: ASCII only (a non-ASCII path is percent-encoded), or the text as given. */
export function codeText(address: string): string {
  try {
    return new URL(address).href
  } catch {
    return address
  }
}

/** The QR code's modules for an address. */
export function pageCodeOf(address: string): PageCode {
  const code = qrcode(0, 'M')
  code.addData(codeText(address), 'Byte')
  code.make()
  const size = code.getModuleCount()
  const dark: boolean[][] = []
  for (let row = 0; row < size; row++) {
    const line: boolean[] = []
    for (let column = 0; column < size; column++) line.push(code.isDark(row, column))
    dark.push(line)
  }
  return { size, dark }
}

/** The dark modules as one SVG path, offset by the quiet zone; a row's run of dark modules is one rectangle. */
export function pageCodePath(code: PageCode): string {
  const parts: string[] = []
  for (let row = 0; row < code.size; row++) {
    let column = 0
    while (column < code.size) {
      if (!code.dark[row][column]) { column++; continue }
      const start = column
      while (column < code.size && code.dark[row][column]) column++
      parts.push(`M${start + QUIET_ZONE} ${row + QUIET_ZONE}h${column - start}v1h${start - column}z`)
    }
  }
  return parts.join('')
}

/** The code's side, its quiet zone in, as a share of the height it is drawn in: its modules then fill about half of it. */
export const CODE_SHARE = 0.62

/** The code's side in whole pixels per module (crisp edges), as near `CODE_SHARE` of `height` as fits `width`. */
export function codeSide(modules: number, height: number, width: number): number {
  const side = modules + QUIET_ZONE * 2
  const room = Math.min(height * CODE_SHARE, width * 0.9)
  const module = Math.max(1, Math.floor(room / side))
  return module * side
}

const WHITE = '#FFFFFF'
const BLACK = '#000000'

export interface PageCodeColours {
  /** The theme's ink (the address under the code is in it too) and its ground. */
  ink: string
  ground: string
  /** The modules' colour and the field's (the quiet zone and the light modules): always dark on light. */
  modules: string
  field: string
  /** The field is a tile of its own (a dark ground); else the code is drawn straight on the wall's ground. */
  tile: boolean
}

/** The code's colours: the theme's ink and ground, dark modules on a light field, unless a camera couldn't tell them. */
export function pageCodeColours(theme: DeckTheme, borderless: boolean): PageCodeColours {
  const ground = isHex(borderless ? WHITE : theme.bg) ? (borderless ? WHITE : theme.bg) : WHITE
  // The headings' colour: on a dark ground the theme's own (white in the built-in), on Borderless its darkest.
  const headings = themeVars(theme, borderless).hd
  const ink = isHex(headings) && contrast(headings, ground) >= CODE_CONTRAST
    ? headings
    : contrast(WHITE, ground) >= contrast(BLACK, ground) ? WHITE : BLACK
  const tile = luminance(ink) > luminance(ground)
  return tile ? { ink, ground, modules: ground, field: ink, tile } : { ink, ground, modules: ink, field: ground, tile }
}

function luminance(colour: string): number {
  // The ordering is all that matters here: the two colours' WCAG contrast against black says which is lighter.
  return contrast(colour, BLACK)
}

function isHex(colour: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(colour)
}

/** The address as the room reads it: `name.example.workers.dev`, or with its path when it has one. */
export function shortAddress(address: string): string {
  return address.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

/*! @license qrcode-generator MIT
 * QR Code Generator for JavaScript. Copyright (c) 2009 Kazuhiko Arase. URL: http://www.d-project.com/
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
 * Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
 */
