/**
 * One picture editor (experience 49): where the picture's handles are, in the coordinates of the element they are
 * drawn in. On a slide that element is the slide's canvas, drawn with `transform: scale`, so a rect on the screen is
 * divided by the scale to be the canvas's own, and a drag's movement is divided by it too: the handle stays under the
 * pointer at any size of the slide (as the table's handles do, experience 48).
 */
import type { CropHandle, PictureAlign, Region } from '../../../../src/markdown/pictureLook'

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** A document picture bar sits in its row or reserves room below the block. */
export function pictureBarPlacement(
  bottom: number,
  height: number,
  viewportHeight: number,
  inside: boolean,
  row?: { picture: Box; width: number; left: number; right: number },
): { left?: number; top: number; room: number } {
  const below = bottom + 10
  if (row) {
    const { picture, width, left, right } = row
    const inset = Math.max(left, picture.left + 12)
    if (picture.height >= height + 16 && inset + width <= right) {
      return { left: inset, top: picture.top + picture.height - height - 8, room: 0 }
    }
    // Under the picture, from its left edge, kept inside the row.
    const maxLeft = Math.max(left, right - width)
    return {
      left: Math.max(left, Math.min(picture.left, maxLeft)),
      top: Math.round(below),
      room: 10 + height + 1,
    }
  }

  const top = inside
    ? Math.max(8, bottom - height - 12)
    : below + height + 8 <= viewportHeight
      ? below
      : Math.max(8, bottom - height - 10)
  return { top: Math.round(top), room: 0 }
}

/** The scale an element is drawn at: its width on the screen over its own width. */
export function scaleOf(screenWidth: number, ownWidth: number): number {
  return ownWidth > 0 && screenWidth > 0 ? screenWidth / ownWidth : 1
}

/** A rect on the screen in the host's own coordinates. */
export function localBox(rect: Box, host: { left: number; top: number }, scale: number): Box {
  return { left: (rect.left - host.left) / scale, top: (rect.top - host.top) / scale, width: rect.width / scale, height: rect.height / scale }
}

/** A point of the host's own coordinates on the screen. */
export function screenPoint(point: { x: number; y: number }, host: { left: number; top: number }, scale: number): { x: number; y: number } {
  return { x: host.left + point.x * scale, y: host.top + point.y * scale }
}

export type Corner = 'nw' | 'ne' | 'se' | 'sw'
export const CORNERS: readonly Corner[] = ['nw', 'ne', 'se', 'sw']

/** A corner of a box. */
export function cornerOf(box: Box, corner: Corner): { x: number; y: number } {
  return { x: corner.includes('w') ? box.left : box.left + box.width, y: corner.includes('n') ? box.top : box.top + box.height }
}

/**
 * The picture's width after its corner moved `dx` (the host's own pixels): the right corners grow it to the right, the
 * left ones to the left; a centred picture grows on both sides, so its corner moves twice as far. The height follows,
 * in proportion.
 */
export function resizedWidth(startWidth: number, corner: Corner, dx: number, align: PictureAlign | undefined): number {
  const sign = corner.includes('w') ? -1 : 1
  return startWidth + sign * dx * (align === 'center' ? 2 : 1)
}

/** Where a crop handle is on the frame, as shares of its width and height. */
export function cropHandleAt(handle: CropHandle): { x: number; y: number } {
  return { x: handle.includes('w') ? 0 : handle.includes('e') ? 1 : 0.5, y: handle.includes('n') ? 0 : handle.includes('s') ? 1 : 0.5 }
}

/**
 * The whole picture in crop mode, drawn so the part it shows now stays where it is: `box` is the picture's box on the
 * page, `region` the part of the picture it shows.
 */
export function wholeBox(box: Box, region: Region): Box {
  const width = box.width / region.w
  const height = box.height / region.h
  return { left: box.left - region.x * width, top: box.top - region.y * height, width, height }
}

/** The crop frame over the whole picture. */
export function frameBox(whole: Box, region: Region): Box {
  return { left: whole.left + region.x * whole.width, top: whole.top + region.y * whole.height, width: region.w * whole.width, height: region.h * whole.height }
}
