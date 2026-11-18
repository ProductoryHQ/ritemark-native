/**
 * Sprint 162 PR 2 (README "Themes", frame 11): the six slides a theme's tab previews its draft on. They are the deck's
 * own (the deck the tab was opened from, else the first deck that uses the theme, else any deck in the project), as the
 * room sees them (`wallSlideOf`: never a hidden word or a skipped slide), or, in a project with no deck, a short sample.
 * Pure: the host reads a deck's text and the test reads the same rule.
 */
import { frontMatterLook } from './deckFormat';
import { deckName } from './DeckLibrary';
import { agendaOf, slidePicturePaths } from './blocks/slideRenderer';
import type { AgendaEntry } from './blocks/agenda';
import { presentSlidesOf, type PresentSlide } from './present/presentSession';
import { wallSlideOf, type WallSlide } from './present/presentProtocol';

export const PREVIEW_SLIDES = 6;

/**
 * Which slides: one of each kind first, in the deck's order (a title, boxes, a section…, as the prototype's
 * `previewSlides` takes them), then the rest in order, until six; shown in the deck's order. Skipped slides aren't shown.
 */
export function previewSlidesOf(slides: readonly PresentSlide[]): PresentSlide[] {
  const shown = slides.filter(slide => !slide.skip);
  const taken = new Set<PresentSlide>();
  const kinds = new Set<string>();
  for (const slide of shown) {
    if (taken.size >= PREVIEW_SLIDES) break;
    if (kinds.has(slide.kind)) continue;
    kinds.add(slide.kind);
    taken.add(slide);
  }
  for (const slide of shown) {
    if (taken.size >= PREVIEW_SLIDES) break;
    taken.add(slide);
  }
  return shown.filter(slide => taken.has(slide));
}

/**
 * A deck's preview: its name, its look, its six slides as the room sees them, the pictures they name, and (small
 * details 14) its Agenda's list, from every section slide the room sees, not only the six shown, as the wall lists it.
 */
export function deckPreview(path: string | null, text: string): { deck: string | null; borderless: boolean; slides: WallSlide[]; pictures: string[]; agenda: AgendaEntry[] } {
  const all = presentSlidesOf(text);
  const shown = new Map(all.filter(slide => !slide.skip).map(slide => [slide, wallSlideOf(slide)]));
  const slides = previewSlidesOf(all).map(slide => shown.get(slide)!);
  const pictures = [...new Set(slides.flatMap(slide => slidePicturePaths(slide.data)))].sort();
  const agenda = agendaOf([...shown.values()]);
  return { deck: path === null ? null : deckName(path), borderless: frontMatterLook(text) === 'borderless', slides, pictures, agenda };
}

/** The sample a theme previews on in a project with no deck: four slides of the common kinds, no pictures. */
export const SAMPLE_DECK_TEXT = [
  '---',
  'deck: 1',
  '---',
  '',
  '```slide title',
  "title: Your talk's title",
  'subtitle: Who it is for · the day',
  '```',
  '',
  '```slide boxes',
  'title: Four parts',
  'items:',
  '- heading: Instructions',
  '  text: What it does, and in what order',
  '  icon: list-checks',
  '- heading: Knowledge',
  '  text: The files it answers from',
  '  icon: book-open',
  '- heading: Skills',
  '  text: Small skills it can call on',
  '- heading: Tools',
  '  text: What it may open or change',
  '```',
  '',
  '```slide section',
  'number: "1"',
  'title: The first part',
  '```',
  '',
  '```slide points',
  'title: Today',
  'items:',
  '- text: Why it matters',
  '- text: How it works',
  '- text: What to try on Monday',
  '```',
  '',
].join('\n');
