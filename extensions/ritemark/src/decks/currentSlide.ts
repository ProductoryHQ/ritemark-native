/**
 * currentSlide — the slide the person is on in a deck view, as the AI and the composer's chip name it (17 November,
 * Jarmo: "how else do I say 'make the corrections on this slide'").
 *
 * The deck view tells the host which slide it shows (`deck/current-slide`); the host puts it in the active file's
 * context while that deck view is the tab in front, and the composer's chip shows it. What the chip shows when a
 * message is sent is what that message carries (`slideAtSend`), for all three AIs, also when it waits in the queue.
 * Only a slide's number, id and title travel: its words reach the AI the usual way, through the deck tools.
 *
 * Every word the chip and the AI's line use is here, in one place (the chip's look: the Experience lead, 17 November).
 * Pure, so the webview imports it too.
 */

import { isCurrentSlideId } from './deckProtocol';

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
  /** The current slide (later also the slides selected on the strip), in the deck's order. Never empty. */
  slides: CurrentSlideEntry[];
}

/** The slide a message was sent on: the file the chip named (project-relative, as the active file's path) and its slide. */
export interface SlideAtSend {
  path: string;
  slide: CurrentSlide;
}

/** A title as one line, at most this long, wherever it is shown or sent. */
export const SLIDE_TITLE_MAX = 120;
/** At most this many slides in one line (a strip selection). */
const MAX_SLIDES = 500;

/** A title as one short line: no line breaks, cut at `SLIDE_TITLE_MAX`. Empty for none. */
export function slideTitleLine(title: unknown): string {
  if (typeof title !== 'string') return '';
  const line = title.replace(/\s+/g, ' ').trim();
  return line.length > SLIDE_TITLE_MAX ? `${line.slice(0, SLIDE_TITLE_MAX - 1)}…` : line;
}

/**
 * The person's words inside the AI's bracketed line: quoted, with its quotes and backslashes escaped, and its square
 * brackets as round ones, so a title can never end the line or read as another context line (`] [Selected text: …`).
 */
export function quotedForAI(text: string): string {
  return JSON.stringify(text.replace(/\[/g, '(').replace(/\]/g, ')'));
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

/** What the AI's line says about one slide: `"Agenda", id k3f9`, `id k3f9`, or nothing. */
function slideFacts(entry: CurrentSlideEntry): string {
  const title = slideTitleLine(entry.title);
  return [title ? quotedForAI(title) : null, entry.id ? `id ${entry.id}` : null].filter(Boolean).join(', ');
}

/** One slide in a list: `5 ("Agenda", id k3f9)`, or `5`. */
function slideInLine(entry: CurrentSlideEntry): string {
  const facts = slideFacts(entry);
  return facts ? `${entry.number} (${facts})` : String(entry.number);
}

/**
 * The AI's line: `The person is on slide 5 of 13 ("Agenda", id k3f9) in "Training".` Several slides: `The person has
 * selected 3 slides of 13 in "Training": 3 ("A", id x), 4 (id y), 5.` The DECKS instructions say what it means.
 */
export function currentSlideContextLine(slide: CurrentSlide): string {
  const { slides, count } = slide;
  const deck = quotedForAI(slideTitleLine(slide.deck));
  if (slides.length === 1) {
    const facts = slideFacts(slides[0]);
    return `The person is on slide ${slides[0].number} of ${count}${facts ? ` (${facts})` : ''} in ${deck}.`;
  }
  return `The person has selected ${slides.length} slides of ${count} in ${deck}: ${slides.map(slideInLine).join(', ')}.`;
}

/** The line each AI's turn carries after `[Currently editing: …]`, or null when no deck slide is current. */
export function currentSlideNote(slide: CurrentSlide | undefined | null): string | null {
  return slide && slide.slides.length > 0 ? `[Current slide: ${currentSlideContextLine(slide)}]` : null;
}

/**
 * A message's `slideAtSend` from the AI's sheet, checked field by field: the sheet only echoes what the host sent it,
 * but nothing else of it reaches an AI's prompt. Null for anything else.
 */
export function slideAtSendOf(value: unknown): SlideAtSend | null {
  if (typeof value !== 'object' || value === null) return null;
  const { path, slide } = value as { path?: unknown; slide?: unknown };
  if (typeof path !== 'string' || path.length === 0 || path.length > 4096 || typeof slide !== 'object' || slide === null) return null;
  const { deck, count, slides } = slide as { deck?: unknown; count?: unknown; slides?: unknown };
  if (typeof deck !== 'string' || !Number.isInteger(count) || (count as number) < 1 || !Array.isArray(slides) || slides.length === 0 || slides.length > MAX_SLIDES) return null;
  const entries: CurrentSlideEntry[] = [];
  for (const entry of slides as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { number, id, title } = entry as { number?: unknown; id?: unknown; title?: unknown };
    if (!Number.isInteger(number) || (number as number) < 1 || (number as number) > (count as number)) return null;
    if (id !== undefined && !isCurrentSlideId(id)) return null;
    if (title !== undefined && typeof title !== 'string') return null;
    const line = slideTitleLine(title);
    entries.push({ number: number as number, ...(id !== undefined ? { id: id as string } : {}), ...(line ? { title: line } : {}) });
  }
  return { path, slide: { deck: slideTitleLine(deck), count: count as number, slides: entries } };
}

/** The active file's lines every AI's turn starts with: `[Currently editing: <path>]`, then the slide's line if any. */
export function activeFileLines(activeFile: { path: string; slide?: CurrentSlide }): string[] {
  const note = currentSlideNote(activeFile.slide);
  return [`[Currently editing: ${activeFile.path}]`, ...(note ? [note] : [])];
}

/** The turn's active file with the slide the message was sent on: only when it names this same file, else none. */
export function withSlideAtSend<T extends { path: string; slide?: CurrentSlide }>(activeFile: T, sent: SlideAtSend | null): T {
  const rest = { ...activeFile };
  delete rest.slide;
  return sent && sent.path === activeFile.path ? { ...rest, slide: sent.slide } : rest;
}
