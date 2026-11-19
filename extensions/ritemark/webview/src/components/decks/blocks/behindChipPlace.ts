/**
 * Sprint 167 PR 4 (decks README item D, `block-details.html`; #838): the corner chip of a slide's picture Behind, on the
 * stage. Pure, so the test reads it; `BehindChip.tsx` draws it and the slide editor measures the slide for it.
 *
 * The chip sits in a corner of the slide, top right, or bottom right when the theme's logo is drawn top right on this
 * slide (Sprint 167 PR 1's four corners), so the two never sit on top of each other. It lies in the band between the
 * slide's edge and its words' box (`.blk-flow`, whose words never leave it), centred in that band and made smaller when
 * the band is low, so it never covers words and never takes their clicks, at any size of the stage.
 */
import { BLOCK_CANVAS_WIDTH, LOGO_GAP, drawsLogo, type SlideLogo } from '../../../../../src/decks/blocks/slideRenderer'

export type ChipCorner = 'top-right' | 'bottom-right'

/** The chip's height at its full size, open (the sketch's `.chip`: 12.5 px words, 5 px around, a 22 px button). */
export const CHIP_HEIGHT = 32
/** The least room between the chip and the slide's edge or its words' box. */
export const CHIP_GAP = 3
/** Never drawn smaller than this share of its size: below it the words would be too small to read. */
export const CHIP_MIN_SCALE = 0.55
/** How far in from the slide's right edge, at its full size. */
export const CHIP_RIGHT = 12
/** How far in from the slide's top or bottom edge at its full size, when the words leave it room there. */
export const CHIP_EDGE = 10
/** The open chip's width at its full size, empty (Picture behind · Choose… · ChatGPT) and with a picture (· Choose). */
export const CHIP_WIDTH_EMPTY = 262
export const CHIP_WIDTH_FILLED = 172
/** The logo's right edge from the slide's, on the 960 px canvas (`slide.css` `.slide-logo.is-top-right`). */
const LOGO_RIGHT = 30
/** The least band the chip fits in at its smallest. */
const LEAST_BAND = CHIP_HEIGHT * CHIP_MIN_SCALE + CHIP_GAP * 2

/** The corner the chip takes on this slide: bottom right when the logo is drawn top right on it, else top right. */
export function behindChipCorner(logo: SlideLogo | null | undefined, cover: boolean): ChipCorner {
  return drawsLogo(logo, cover) && logo.place === 'top-right' ? 'bottom-right' : 'top-right'
}

export interface ChipPlace {
  corner: ChipCorner
  /** From the slide's top (top right) or bottom (bottom right) edge to the chip's, in screen pixels. */
  edge: number
  /** From the slide's right edge to the chip's. */
  right: number
  /** The chip's size, 1 at full size. */
  scale: number
}

const tenth = (value: number) => Math.round(value * 10) / 10

function scaleIn(band: number): number {
  return Math.max(CHIP_MIN_SCALE, Math.min(1, (band - CHIP_GAP * 2) / CHIP_HEIGHT))
}

function placeIn(band: number, corner: ChipCorner, right: number, scale: number): ChipPlace {
  const edge = Math.max(CHIP_GAP, (band - CHIP_HEIGHT * scale) / 2)
  return { corner, edge: tenth(edge), right: tenth(right), scale: Math.round(scale * 1000) / 1000 }
}

/**
 * Where the chip goes, from the slide on the screen (`width` × `height`) and its words' box (its top and bottom, from
 * the slide's top). The band is the room between the edge of the chip's corner and the box; the chip, at `scale`, fits
 * in it with `CHIP_GAP` on both sides. Bottom right, beside a top-right logo, on a slide so small that the low band can't
 * hold the chip at its smallest: it goes top right after all, left of the logo (`logo`, its width on the 960 px canvas),
 * the only thing in that band.
 */
export function behindChipPlace(
  slide: { width: number; height: number },
  flow: { top: number; bottom: number },
  corner: ChipCorner,
  logo?: Pick<SlideLogo, 'width'> | null,
  words?: { blocks: ReadonlyArray<Box>; width: number },
): ChipPlace {
  // The words as they stand (each block's box, and the logo's, from the slide's top left): when the chip at its full
  // size in its corner is clear of every one, it is drawn so, however low the band (a title slide's low words leave the
  // whole bottom right free). Otherwise it keeps to the band, which holds whatever the words become.
  if (words) {
    const full: ChipPlace = { corner, edge: CHIP_EDGE, right: CHIP_RIGHT, scale: 1 }
    const box = grown(chipBox(full, slide, words.width), CHIP_GAP)
    if (!words.blocks.some(block => meets(box, block))) {
      const band = corner === 'top-right' ? flow.top : slide.height - flow.bottom
      // Never nearer its edge than it would sit in the band at its full size.
      return band >= CHIP_HEIGHT + CHIP_GAP * 2 ? behindChipPlace(slide, flow, corner, logo) : full
    }
  }
  const topBand = Math.max(0, flow.top)
  const bottomBand = Math.max(0, slide.height - flow.bottom)
  if (corner === 'bottom-right' && bottomBand < LEAST_BAND && topBand > bottomBand && logo) {
    const scale = scaleIn(topBand)
    return placeIn(topBand, 'top-right', (LOGO_RIGHT + logo.width + LOGO_GAP) * (slide.width / BLOCK_CANVAS_WIDTH), scale)
  }
  const band = corner === 'top-right' ? topBand : bottomBand
  const scale = scaleIn(band)
  return placeIn(band, corner, Math.max(CHIP_GAP, CHIP_RIGHT * scale), scale)
}

export interface Box { left: number; top: number; right: number; bottom: number }

const grown = (box: Box, by: number): Box => ({ left: box.left - by, top: box.top - by, right: box.right + by, bottom: box.bottom + by })
const meets = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** The chip's box on the slide (from its top left), `width` wide when open at full size. */
export function chipBox(place: ChipPlace, slide: { width: number; height: number }, width: number): Box {
  const height = CHIP_HEIGHT * place.scale
  const right = slide.width - place.right
  const top = place.corner === 'top-right' ? place.edge : slide.height - place.edge - height
  return { left: right - width * place.scale, top, right, bottom: top + height }
}
