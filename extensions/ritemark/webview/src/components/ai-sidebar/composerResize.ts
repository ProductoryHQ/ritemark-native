/**
 * Sprint 122 (#282) — the arithmetic of resizing the chat composer from its
 * top edge. Pure, so the rules are tested without a DOM.
 *
 * The composer sits at the bottom of the sidebar, so it is resized the way a
 * bottom panel is: drag its top edge up to make it taller, down to make it
 * shorter (Jarmo, 2026-09-23 — the corner grip gave no room to drag into).
 */

export interface HeightBounds {
  min: number;
  max: number;
}

export function clampHeight(height: number, { min, max }: HeightBounds): number {
  const ceiling = Math.max(min, max);
  return Math.round(Math.min(ceiling, Math.max(min, height)));
}

/** Dragging the top edge: moving the pointer up by N px makes the box N px taller. */
export function dragHeight(startHeight: number, startY: number, currentY: number, bounds: HeightBounds): number {
  return clampHeight(startHeight + (startY - currentY), bounds);
}

/**
 * The same from the keyboard, on the focused handle: ↑/↓ one line, Page Up /
 * Page Down three lines, Home the smallest, End the largest. `null` for any
 * other key, so the caller leaves it alone.
 */
export function keyboardHeight(key: string, current: number, bounds: HeightBounds, lineStep: number): number | null {
  switch (key) {
    case 'ArrowUp':
      return clampHeight(current + lineStep, bounds);
    case 'ArrowDown':
      return clampHeight(current - lineStep, bounds);
    case 'PageUp':
      return clampHeight(current + lineStep * 3, bounds);
    case 'PageDown':
      return clampHeight(current - lineStep * 3, bounds);
    case 'Home':
      return clampHeight(bounds.min, bounds);
    case 'End':
      return clampHeight(bounds.max, bounds);
    default:
      return null;
  }
}

/**
 * How tall the box may be dragged: the room the sidebar column has left for
 * it, minus a strip that keeps some of the conversation in view — never less
 * than the two-line floor.
 */
export function dragCeiling(roomPx: number | null, floorPx: number, transcriptStripPx: number): number {
  if (roomPx === null) return floorPx;
  return Math.max(floorPx, roomPx - transcriptStripPx);
}
