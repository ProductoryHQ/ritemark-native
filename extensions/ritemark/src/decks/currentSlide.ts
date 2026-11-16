/**
 * currentSlide — the slide the person is on in a deck view, as the AI and the composer's chip name it (17 November,
 * Jarmo: "how else do I say 'make the corrections on this slide'").
 *
 * The deck view tells the host which slide is current (`deck/current`); the host puts it in the active file's context,
 * and every message sent while that deck is in front carries one line about it, for all three AIs. Only a slide's
 * number, id and title travel: its words reach the AI the usual way, through the deck tools.
 *
 * Every word the chip and the AI's line use is here, in one place (the chip's look: the Experience lead, 17 November).
 * Pure, so the webview imports it too.
 */

/** One slide the person is on, or one of those selected on the strip. */
export interface CurrentSlideEntry {
  /** The slide's number, from 1. */
  number: number;
  /** The slide's `id:`, when it has one. */
  id?: string;
  /** The slide's `title:`, when it has one. */
  title?: string;
}

/** The deck in front and the slide (or slides) the person is on there. */
export interface CurrentSlide {
  /** The deck's name, as the library names it (its file name without `.deck.md`). */
  deck: string;
  /** How many slides the deck has. */
  count: number;
  /** The current slide, or the slides selected on the strip, in the deck's order. Never empty. */
  slides: CurrentSlideEntry[];
}

/** A title as one line, at most this long, wherever it is shown or sent. */
export const SLIDE_TITLE_MAX = 120;

/** A title as one short line: no line breaks, cut at `SLIDE_TITLE_MAX`. Empty for none. */
export function slideTitleLine(title: unknown): string {
  if (typeof title !== 'string') return '';
  const line = title.replace(/\s+/g, ' ').trim();
  return line.length > SLIDE_TITLE_MAX ? `${line.slice(0, SLIDE_TITLE_MAX - 1)}…` : line;
}

/** The slides' numbers in words: "3–5" when they run in order, "2, 5, 7" for up to three that don't, else null. */
export function slideNumbersText(numbers: number[]): string | null {
  if (numbers.length === 0) return null;
  if (numbers.length === 1) return String(numbers[0]);
  const run = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);
  if (run) return `${numbers[0]}–${numbers[numbers.length - 1]}`;
  return numbers.length <= 3 ? numbers.join(', ') : null;
}

/** The chip: "Slide 5 · <title>", "Slide 5", "Slides 3–5", "Slides 2, 5, 7" or "6 slides". */
export function currentSlideChipLabel(slide: CurrentSlide): string {
  const { slides } = slide;
  if (slides.length === 1) {
    const title = slideTitleLine(slides[0].title);
    return title ? `Slide ${slides[0].number} · ${title}` : `Slide ${slides[0].number}`;
  }
  const numbers = slideNumbersText(slides.map(entry => entry.number));
  return numbers ? `Slides ${numbers}` : `${slides.length} slides`;
}

/**
 * The chip's tooltip: "<deck>, slide 5 of 13. Claude reads 'this slide' as this one." `ai` is the composer's AI's
 * name. Several slides: "<deck>, slides 3–5 of 13."
 */
export function currentSlideChipTooltip(slide: CurrentSlide, ai: string): string {
  const { slides, deck, count } = slide;
  if (slides.length === 1) return `${deck}, slide ${slides[0].number} of ${count}. ${ai} reads 'this slide' as this one.`;
  const numbers = slideNumbersText(slides.map(entry => entry.number));
  return numbers ? `${deck}, slides ${numbers} of ${count}.` : `${deck}, ${slides.length} of ${count} slides.`;
}

/** One slide as the AI's line names it: "5 ('Agenda', id k3f9)", "5 (id k3f9)" or "5". */
function slideInLine(entry: CurrentSlideEntry): string {
  const title = slideTitleLine(entry.title);
  const parts = [title ? `'${title}'` : null, entry.id ? `id ${entry.id}` : null].filter(Boolean);
  return parts.length > 0 ? `${entry.number} (${parts.join(', ')})` : String(entry.number);
}

/**
 * The AI's line: "The person is on slide 5 of 13 ('Agenda', id k3f9) in Training." Several slides: "The person has
 * selected 3 slides of 13 in Training: 3 ('A', id x), 4 (id y), 5." The DECKS instructions say what it means.
 */
export function currentSlideContextLine(slide: CurrentSlide): string {
  const { slides, deck, count } = slide;
  if (slides.length === 1) {
    const [entry] = slides;
    const title = slideTitleLine(entry.title);
    const parts = [title ? `'${title}'` : null, entry.id ? `id ${entry.id}` : null].filter(Boolean);
    return `The person is on slide ${entry.number} of ${count}${parts.length > 0 ? ` (${parts.join(', ')})` : ''} in ${deck}.`;
  }
  return `The person has selected ${slides.length} slides of ${count} in ${deck}: ${slides.map(slideInLine).join(', ')}.`;
}

/** The line each AI's turn carries after `[Currently editing: …]`, or null when no deck slide is current. */
export function currentSlideNote(slide: CurrentSlide | undefined | null): string | null {
  return slide && slide.slides.length > 0 ? `[Current slide: ${currentSlideContextLine(slide)}]` : null;
}
