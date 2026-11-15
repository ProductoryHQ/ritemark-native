/**
 * Presenting a deck (Sprint 159, experience 17): the session's rules, pure, so the test reads the same rules the host
 * uses.
 *
 *  - The session's order is the deck's slides without `skip: true`. Next and Back pass a skipped slide, and n of N
 *    counts only the slides shown.
 *  - A typed number is a thumbnail's number (the slide's place in the deck), so a skipped slide is reached by its
 *    number too: the presenter asked for it by name.
 *  - The current slide is held by its key (its `id`, or for a slide without one its kind and body), never by its
 *    number. Every move reads the deck's text again, so a slide added, skipped, changed or deleted in the editor
 *    reaches the wall at the next move.
 *  - When the current slide is deleted, the wall keeps it until the move, then goes on to the slide that came after
 *    it (or back to the one that came before).
 *
 * No `vscode` and no DOM: the host gives it the open document's text.
 */
import { parseDeck, parseSlideBody, readScalar, type SlideData } from '../deckFormat';

/** One slide of the deck, as presenting reads it. */
export interface PresentSlide {
  /** Its place in the deck, from 0. Its number (the thumbnail's) is this plus one. */
  index: number;
  /** What holds it across edits: its id, or its kind and body (with the count of earlier twins) when it has none. */
  key: string;
  kind: string;
  data: SlideData;
  /** The speaker notes, or null. Only the presenter view gets them; the wall never does (presentProtocol.ts). */
  notes: string | null;
  skip: boolean;
}

/** A move on the wall or in the presenter view. `go` takes a thumbnail's number (from 1). */
export type PresentMove =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'first' }
  | { type: 'last' }
  | { type: 'go'; number: number };

/** Where the session is, after the last move. */
export interface PresentView {
  /** The slide on the wall. */
  current: PresentSlide;
  /** Its place among the slides shown (from 1), or null when it is skipped (reached by its number) or deleted. */
  position: number | null;
  /** How many slides are shown: the N of n of N. */
  count: number;
  /** The slides shown, in order. */
  shown: PresentSlide[];
  /** The slide Next goes to, or null at the end. */
  next: PresentSlide | null;
  /** Every slide of the deck, skipped ones too, as last read (for a number's title). */
  all: PresentSlide[];
}

/** Where a presentation starts: the first slide shown, or the deck view's current slide (its index, from 0). */
export type PresentStart = { from: 'start' } | { from: 'here'; index: number };

/** The deck's slides, in order, with their keys. */
export function presentSlidesOf(text: string): PresentSlide[] {
  const seen = new Map<string, number>();
  return parseDeck(text).slides.map((block, index) => {
    const data = parseSlideBody(block.body);
    const base = data.id ? `id:${data.id}` : `body:${block.kind}\n${block.body.trim()}`;
    const twins = seen.get(base) ?? 0;
    seen.set(base, twins + 1);
    return { index, key: twins ? `${base}#${twins}` : base, kind: block.kind, data, notes: block.notes, skip: data.skip === true };
  });
}

/** A slide's title as the go-to box names it: its title, or "slide N" for a slide without one. */
export function presentTitleOf(slide: PresentSlide): string {
  const title = (slide.data.title ?? '').replace(/\s+/g, ' ').trim();
  return title || `slide ${slide.index + 1}`;
}

/** One value of the deck's front matter (`look`, `ritemark-length`), as written, or null. */
export function frontMatterValue(text: string, key: string): string | null {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return null;
  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line);
    if (entry && entry[1] === key) return readScalar(entry[2]);
  }
  return null;
}

/**
 * Card or Borderless, the deck's own choice in its front matter (`look: borderless`); Card otherwise. The deck view's
 * own rule (`properties.look === 'borderless'`), so the wall never shows a look the stage doesn't.
 */
export function deckLookOf(text: string): 'card' | 'borderless' {
  return frontMatterValue(text, 'look') === 'borderless' ? 'borderless' : 'card';
}

/** Why a presentation can't start: the deck has no slide to show. */
export class PresentStartError extends Error {}

export class PresentSession {
  private slides: PresentSlide[];
  private current: PresentSlide;
  /** The current slide is no longer in the deck: the wall keeps it until the next move. */
  private gone = false;
  /** The keys of the slides before and after the current one when it was last found, for when it is deleted. */
  private before: string[] = [];
  private after: string[] = [];

  /** A session on the deck's text, from the start or from the deck view's current slide. Throws PresentStartError. */
  constructor(text: string, start: PresentStart) {
    this.slides = presentSlidesOf(text);
    if (this.slides.length === 0) throw new PresentStartError('This deck has no slides yet.');
    const shown = this.slides.filter(slide => !slide.skip);
    // From this slide shows it even when it is skipped, as a typed number does: the presenter chose it.
    const chosen = start.from === 'here' ? this.slides[start.index] ?? shown[0] : shown[0];
    if (!chosen) throw new PresentStartError('Every slide in this deck is skipped.');
    this.current = chosen;
    this.remember();
  }

  /** Read the deck again: the current slide is found by its key. */
  read(text: string): void {
    this.slides = presentSlidesOf(text);
    const found = this.slides.find(slide => slide.key === this.current.key) ?? this.edited();
    if (found) {
      this.current = found;
      this.gone = false;
      this.remember();
    } else {
      this.gone = true;
    }
  }

  /** Read the deck again and move. False when the move goes nowhere (the end, the start, a number with no slide). */
  move(text: string, move: PresentMove): boolean {
    this.read(text);
    const shown = this.slides.filter(slide => !slide.skip);
    let target: PresentSlide | undefined;
    switch (move.type) {
      case 'next':
        target = this.gone ? this.firstOf(this.after, shown) ?? shown[shown.length - 1] : shown.find(slide => slide.index > this.current.index);
        break;
      case 'back':
        target = this.gone ? this.lastOf(this.before, shown) ?? shown[0] : [...shown].reverse().find(slide => slide.index < this.current.index);
        break;
      case 'first':
        target = shown[0];
        break;
      case 'last':
        target = shown[shown.length - 1];
        break;
      case 'go':
        target = Number.isInteger(move.number) ? this.slides[move.number - 1] : undefined;
        break;
    }
    if (!target || (!this.gone && target.key === this.current.key)) return false;
    this.current = target;
    this.gone = false;
    this.remember();
    return true;
  }

  /** Where the session is now. */
  view(): PresentView {
    const shown = this.slides.filter(slide => !slide.skip);
    const at = this.gone ? -1 : shown.findIndex(slide => slide.key === this.current.key);
    const next = this.gone ? this.firstOf(this.after, shown) ?? null : shown.find(slide => slide.index > this.current.index) ?? null;
    return { current: this.current, position: at < 0 ? null : at + 1, count: shown.length, shown, next, all: this.slides };
  }

  /** The slide with this thumbnail number, skipped or not, as last read; undefined when there is none. */
  slideNumbered(number: number): PresentSlide | undefined {
    return Number.isInteger(number) ? this.slides[number - 1] : undefined;
  }

  /**
   * The deck view's index of the slide the presenter ended on, after reading the deck again: the current slide, or
   * when it was deleted the slide that came after it (or before it), or the last slide.
   */
  endedIndex(text: string): number {
    this.read(text);
    if (!this.gone) return this.current.index;
    const after = this.firstOf(this.after, this.slides);
    if (after) return after.index;
    const before = this.lastOf(this.before, this.slides);
    return before ? before.index : Math.max(0, Math.min(this.current.index, this.slides.length - 1));
  }

  /**
   * A current slide without an id is held by its words, so changing them loses it: when exactly one slide without an
   * id stands where it stood (between its old neighbours), that is the same slide, changed.
   */
  private edited(): PresentSlide | undefined {
    if (this.current.data.id) return undefined;
    const lower = this.lastOf(this.before, this.slides);
    const upper = this.firstOf(this.after, this.slides);
    const between = this.slides.slice(lower ? lower.index + 1 : 0, upper ? upper.index : this.slides.length);
    return between.length === 1 && !between[0].data.id ? between[0] : undefined;
  }

  private remember(): void {
    const at = this.slides.findIndex(slide => slide.key === this.current.key);
    if (at < 0) return;
    this.before = this.slides.slice(0, at).map(slide => slide.key);
    this.after = this.slides.slice(at + 1).map(slide => slide.key);
  }

  /** The first of `keys`, in their order, that is among `slides`. */
  private firstOf(keys: string[], slides: PresentSlide[]): PresentSlide | undefined {
    for (const key of keys) {
      const slide = slides.find(entry => entry.key === key);
      if (slide) return slide;
    }
    return undefined;
  }

  /** The last of `keys`, in their order, that is among `slides`. */
  private lastOf(keys: string[], slides: PresentSlide[]): PresentSlide | undefined {
    for (let index = keys.length - 1; index >= 0; index--) {
      const slide = slides.find(entry => entry.key === keys[index]);
      if (slide) return slide;
    }
    return undefined;
  }
}
