/**
 * Where the slide goes: split along the long side (experience 46, 16 November; Jarmo: "sobib - eks päriselus tuleb siis
 * järgi katsetada"). A 16:9 slide needs width; reading text needs height, but not more width than about 70 characters.
 * So the deck's room is split along its longer side:
 *
 *  - **beside** (the slide left of the handout) while a slide of at least 400 px and handout text of at least 600 px
 *    both fit: a room of 1,100 px;
 *  - **above** (the slide centred on top, the handout below it in the Text editor's column) when the room is narrower.
 *
 * The room is the deck view's own width less the strip: what's left of the window after every panel (the left column,
 * the strip and the AI column). There's no setting; the view switch on the bar covers the two focus needs.
 *
 * Pure functions, so the rule can be tested without a window.
 */

export type DeckOrientation = 'beside' | 'above'

/** The narrowest slide and handout text that still sit side by side (README: 400 and 600, a room of 1,100). */
export const BESIDE_SLIDE_MIN = 400
export const BESIDE_TEXT_MIN = 600
export const BESIDE_ROOM = 1100
/** Once above, the room must grow this much past 1,100 before the slide goes beside again, so a window dragged to the
 *  boundary doesn't make the slide flicker between the two. Beside never shows in a room under 1,100. */
export const ORIENTATION_HYSTERESIS = 24

/**
 * The orientation for a room, given the one shown now (null before the first measure). Beside below 1,100 never;
 * above until the room reaches 1,100 + the hysteresis. A room not measured yet keeps what is shown.
 */
export function orientationFor(room: number, shown: DeckOrientation | null): DeckOrientation {
  if (!(room > 0)) return shown ?? 'beside'
  if (room < BESIDE_ROOM) return 'above'
  if (shown === 'above' && room < BESIDE_ROOM + ORIENTATION_HYSTERESIS) return 'above'
  return 'beside'
}

/** The slide's share of the height above the line: half by default, and kept, as the beside share is, in the view's
 *  own state (`deckAboveRatio`), never in the file. */
export const ABOVE_RATIO_DEFAULT = 0.5
export const ABOVE_RATIO_MIN = 0.25
export const ABOVE_RATIO_MAX = 0.75

/** The share above the line to start with: the one the person dragged to and the view kept, else half. */
export function initialAboveRatio(stored: unknown): number {
  return typeof stored === 'number' && Number.isFinite(stored) && stored >= ABOVE_RATIO_MIN && stored <= ABOVE_RATIO_MAX ? stored : ABOVE_RATIO_DEFAULT
}

/** A dragged share, held inside its bounds. */
export function clampAboveRatio(ratio: number): number {
  return Number.isFinite(ratio) ? Math.max(ABOVE_RATIO_MIN, Math.min(ABOVE_RATIO_MAX, ratio)) : ABOVE_RATIO_DEFAULT
}

/** Neither pane above or below the line is ever shorter than this, while the room is tall enough for both. */
export const ABOVE_PANE_MIN = 160

/** The line's place, from the room's top, for the room's height and the share above it. */
export function aboveLineFor(height: number, ratio: number): number {
  if (!(height > 0)) return 0
  const line = Math.round(height * clampAboveRatio(ratio))
  if (height < ABOVE_PANE_MIN * 2) return line
  return Math.max(ABOVE_PANE_MIN, Math.min(height - ABOVE_PANE_MIN, line))
}

/** The slide's side margin on the stage and its widest; and, above, the room the pane keeps around the slide: its full
 *  height less 32 (the Experience lead, 17 November, "Nothing around the slide but the slide": the rows above and under
 *  the slide leave the stage, so the slide gets that height). */
export const STAGE_MARGIN = 24
export const BIG_MAX = 900
export const ABOVE_STAGE_ROOM = 32

/**
 * The height of what the stage holds under the slide (a row still there, such as the speaker notes', with its margin),
 * from the stage group's height and the slide's as drawn: the group is the slide, the rows under it and 16 above and
 * under them. Never negative.
 */
export function rowsUnder(groupHeight: number, slideHeight: number): number {
  return Number.isFinite(groupHeight) && Number.isFinite(slideHeight) ? Math.max(0, Math.round(groupHeight - slideHeight - ABOVE_STAGE_ROOM)) : 0
}

/**
 * The slide's width on a stage `width` × `height`. Beside, the slide is bound by its width (and sits centred in its
 * pane's height); above, it takes its pane's full height less 32 and less `under`, the rows still under it (measured,
 * `rowsUnder`), at 16:9, capped by the width, so the stage never overflows its pane. With no row under it, the slide
 * is the pane less 32.
 */
export function slideWidthFor(width: number, height: number, above: boolean, under = 0): number {
  const byWidth = Math.min(width - STAGE_MARGIN * 2, BIG_MAX)
  const byHeight = above ? Math.floor(((height - ABOVE_STAGE_ROOM - Math.max(0, under)) * 16) / 9) : Infinity
  return Math.max(0, Math.min(byWidth, byHeight))
}

/**
 * Slide only (the design: "Slide only gives the slide the whole room, and the strip stays"; Jarmo, 17 November: "align
 * slide to center... and fill the space"): the largest 16:9 slide in the room `width` × `height` between the strip and
 * the AI pane (or the window's edge), less the side margins and 32 in height and the rows still under it, with no
 * 900 cap. The stage centres it both ways.
 */
export function fullSlideWidthFor(width: number, height: number, under = 0): number {
  const byWidth = width - STAGE_MARGIN * 2
  const byHeight = Math.floor(((height - ABOVE_STAGE_ROOM - Math.max(0, under)) * 16) / 9)
  return Math.max(0, Math.min(byWidth, byHeight))
}

/** Place the full settings card within the stage. Below, its height plus the gap joins the stage's scroll flow. */
export function slideSettingsPlacement(
  stageWidth: number, stageHeight: number, slideLeft: number, slideWidth: number,
  popup: { width: number; height: number }, gap: number, padding: number,
): { side: 'right' | 'left' | 'bottom'; room: number } {
  if (popup.height + padding * 2 <= stageHeight) {
    const sideRoom = popup.width + gap + padding
    if (stageWidth - slideLeft - slideWidth >= sideRoom) return { side: 'right', room: 0 }
    if (slideLeft >= sideRoom) return { side: 'left', room: 0 }
  }
  return { side: 'bottom', room: popup.height + gap }
}
