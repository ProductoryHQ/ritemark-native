/**
 * README item 20 (the content arrives in a row) and "The page and Present are one player": how a slide arrived, and
 * whether its content comes in a row or the slide shows whole. One rule for the wall (the host says how the slide
 * arrived, in the wall's state) and the published page (which knows for itself); the page's script carries these very
 * functions (`pageScript.ts` puts their source in), so the two can't drift.
 *
 *  - **A press going on** (→, the clicker, the space bar, a swipe, the page's ›) plays the row, and so does Home, which
 *    opens the first slide as → would (README item 18), and the start of a presentation, the first slide arriving from
 *    the theme's ground.
 *  - **Whole:** going back, a jump (the go-to box, End, the grid of all slides, the presenter view's row, the page's
 *    Contents, `#N`, a link) and the slide coming back from a blank wall, the QR code, the spotlight or a filled picture
 *    (no move at all: the slide is simply shown again). Going back is looking for something, not telling it again.
 *  - **Never:** with reduced motion, in a deck whose transition is None (stillness throughout), or while the wall is
 *    covered (blank, the QR code, a picture filling it).
 *
 * Pure and self-contained: each function uses only its arguments, so its source runs as it is on the page.
 */

/** How a slide reached the wall or the page. */
export type SlideArrival = 'next' | 'home' | 'back' | 'jump' | 'start';

const ARRIVALS: readonly SlideArrival[] = ['next', 'home', 'back', 'jump', 'start'];

/** An arrival as the wall may be sent one: one of the five, else null (the same slide drawn again). */
export function slideArrivalOf(value: unknown): SlideArrival | null {
  return typeof value === 'string' && (ARRIVALS as readonly string[]).includes(value) ? (value as SlideArrival) : null;
}

/** The host's moves, as the arrival each one makes: → going on, Home, ← back, End and a number a jump. */
export function arrivalOfMove(move: 'next' | 'back' | 'first' | 'last' | 'go'): SlideArrival {
  return move === 'next' ? 'next' : move === 'first' ? 'home' : move === 'back' ? 'back' : 'jump';
}

/**
 * Whether a slide that arrived this way opens as a press going on opens it: with its first One by one item (README item
 * 18), and with its content in a row (item 20). Null: the same slide drawn again (an edit, a window that loaded again).
 */
export function opensOnward(arrival: string | null): boolean {
  return arrival === 'next' || arrival === 'home' || arrival === 'start';
}

/**
 * Whether the new slide's content comes in a row: an onward arrival (`opensOnward(arrival)`), with motion, in a deck whose
 * transition moves (Fade, Push or Zoom), on a wall that isn't covered. Else the slide shows whole: with the deck's
 * transition going back or after a jump, at once with None, reduced motion or a covered wall.
 */
export function rowPlays(onward: boolean, transition: string, reduced: boolean, covered: boolean): boolean {
  return onward && !reduced && !covered && transition !== 'none';
}
