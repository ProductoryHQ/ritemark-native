/**
 * Where a table's menu opens (#982), as the workbench's own menus do: under its anchor (the grip, or the pointer of a
 * right-click) when it fits there, above it when it fits there instead, and otherwise moved up until it fits the window,
 * over its anchor. Only a menu taller than the window itself scrolls.
 *
 * Pure: the menu's own height and the window's height in, Radix's `side` and `sideOffset` out.
 */

export interface MenuAnchor {
  top: number
  height: number
}

export interface MenuPlacement {
  side: 'bottom' | 'top'
  sideOffset: number
}

/** The room kept between the menu and the window's edge (the menus' `collisionPadding`). */
export const MENU_EDGE = 8
/** The menus' own gap from their anchor (`DropdownMenuContent`'s default `sideOffset`). */
export const MENU_GAP = 4

export function menuPlacement(anchor: MenuAnchor, menuHeight: number, windowHeight: number): MenuPlacement {
  const bottom = anchor.top + anchor.height
  const below = windowHeight - MENU_EDGE - bottom - MENU_GAP
  const above = anchor.top - MENU_EDGE - MENU_GAP
  if (menuHeight <= below) return { side: 'bottom', sideOffset: MENU_GAP }
  if (menuHeight <= above) return { side: 'top', sideOffset: MENU_GAP }
  // Neither side has the room: under the anchor, moved up until its foot is at the window's edge (never past its top).
  const top = Math.max(MENU_EDGE, windowHeight - MENU_EDGE - menuHeight)
  return { side: 'bottom', sideOffset: Math.min(MENU_GAP, top - bottom) }
}
