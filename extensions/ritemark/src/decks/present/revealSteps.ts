/**
 * Decks README item 18 (18 November): items arrive one by one in Present. The step rules, pure, so the test reads the
 * same rules the host uses. The host is the only source of state: it holds how many items of the slide on the wall
 * show, and the wall and the presenter view draw that.
 *
 *  - A slide's items are those of its One by one blocks (`reveal="one"` on Boxes, Steps and Columns; a list wrapped in
 *    `::: incremental`), counted as the renderer numbers them (`blockRevealCount`). A slide with none shows whole, as
 *    before.
 *  - The slide opens with the title, any other blocks and the first item. Each → or clicker press shows the next item;
 *    ← hides the last one shown. After the last item, → goes to the next slide; at the first, ← goes back a slide.
 *  - Coming back from the next slide shows a slide whole, as it was left. The go-to box (and the grid of all slides, the
 *    presenter view's row) jumps to a slide shown whole, and so does End; Home opens the first slide as → would.
 *  - Blanking, the page's QR code, the spotlight and a filled wall are no steps: the slide comes back at the same step.
 */
import { isBlockSlide, type SlideData } from '../deckFormat';
import { blockRevealCount } from '../blocks/slideRenderer';

/** How many of the slide's items show (from 1), of how many. */
export interface WallReveal {
  shown: number;
  count: number;
}

/** How a slide reached by a move opens: with its first item, or whole. */
export type RevealArrival = 'first' | 'whole';

/** The most items a slide's steps are counted to. */
const MAX_ITEMS = 9_999;

/** How many items a slide's One by one blocks hold (0: it shows whole). */
export function revealCountOf(slide: { kind: string; data: SlideData }): number {
  if (!isBlockSlide(slide.kind)) return 0;
  return Math.min(MAX_ITEMS, blockRevealCount(slide.data.markdown ?? ''));
}

/** A slide just reached: its first item, or all of them; null for a slide with nothing to reveal. */
export function revealOnArrival(count: number, arrival: RevealArrival): WallReveal | null {
  if (!(count > 0)) return null;
  return { shown: arrival === 'first' ? 1 : count, count };
}

/** Which way a move reaches a slide: → and Home open it with its first item; ←, End and a number show it whole. */
export function arrivalOf(move: 'next' | 'back' | 'first' | 'last' | 'go'): RevealArrival {
  return move === 'next' || move === 'first' ? 'first' : 'whole';
}

/**
 * → or ← on a slide with items still to show or to hide: the step, or null when the press is a move to another slide
 * (no items, the last one shown and →, the first one and ←).
 */
export function revealStepOf(reveal: WallReveal | null, move: 'next' | 'back'): WallReveal | null {
  if (!reveal) return null;
  if (move === 'next') return reveal.shown < reveal.count ? { shown: reveal.shown + 1, count: reveal.count } : null;
  return reveal.shown > 1 ? { shown: reveal.shown - 1, count: reveal.count } : null;
}

/**
 * The same slide drawn again (an edit since, a window that loaded again): its step kept, within its items now. A slide
 * that was whole stays whole; one that now has items but had none shows whole (nothing hides under the room's eyes).
 */
export function revealKept(reveal: WallReveal | null, count: number): WallReveal | null {
  if (!(count > 0)) return null;
  if (!reveal || reveal.shown >= reveal.count) return { shown: count, count };
  return { shown: Math.max(1, Math.min(reveal.shown, count)), count };
}

/** The presenter view's line under Now: "Shown 2 of 4"; nothing for a slide with no items. */
export function revealLabel(reveal: WallReveal | null): string | null {
  return reveal ? `Shown ${reveal.shown} of ${reveal.count}` : null;
}

/** Is a reveal as the wall may be sent: whole numbers, 1 ≤ shown ≤ count. */
export function revealOf(value: unknown): WallReveal | null {
  if (typeof value !== 'object' || value === null) return null;
  const { shown, count } = value as Record<string, unknown>;
  const whole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_ITEMS;
  return whole(shown) && whole(count) && shown <= count ? { shown, count } : null;
}
