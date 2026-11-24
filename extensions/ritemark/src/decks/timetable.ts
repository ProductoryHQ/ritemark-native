import { parseDeck, slideDataOf } from './deckFormat';
import { frontMatterValue, lengthMinutesOf, MAX_LENGTH_MINUTES } from './present/presentSession';
import { minutesIn, stepsLabelOf } from '../../webview/src/components/decks/present/pointerTimer';

export const SESSION_START = 'ritemark-start';
export const SESSION_LENGTH = 'ritemark-length';

export function clockMinutes(value: unknown): number | null {
  if (typeof value !== 'string' || !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function sessionLengthFromEnd(start: number | null, end: number): number {
  const length = end - (start ?? 0);
  return length > 0 ? length : length + MAX_LENGTH_MINUTES;
}

export interface TimetableSlide {
  /** Position in the file, from zero, including skipped slides. */
  index: number;
  skipped: boolean;
  startMinutes: number;
  minutes: number | null;
  labelMinutes: number | null;
  /** Total for a section, through the slide before the next shown section. */
  sectionMinutes: number | null;
}

export interface Timetable {
  slides: TimetableSlide[];
  sessionMinutes: number | null;
  sessionStart?: number | null;
  totalMinutes: number;
  untimedCount: number;
}

export function explicitMinutes(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  const minutes = Number(value);
  return Number.isSafeInteger(minutes) ? minutes : null;
}

/** Read planned timing from saved or in-memory deck text. Skipped slides remain addressable in file order. */
export function readTimetable(input: string): Timetable {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const sessionMinutes = lengthMinutesOf(frontMatterValue(text, SESSION_LENGTH));
  // Recognize an empty front matter before looking for slide fences.
  const deck = parseDeck(text.replace(/^---[ \t]*\n---[ \t]*(?:\n|$)/, ''));
  let totalMinutes = 0;
  let untimedCount = 0;
  let section: TimetableSlide | undefined;
  const slides = deck.slides.map(({ kind, body }, index): TimetableSlide => {
    const data = slideDataOf(kind, body);
    const isSection = kind === 'section' || data.section === true;
    const label = isSection ? null : stepsLabelOf({ kind, data });
    const labelMinutes = label === null ? null : minutesIn(label);
    const minutes = isSection ? null : explicitMinutes(data.time) ?? labelMinutes;
    const slide = {
      index, skipped: data.skip === true, startMinutes: totalMinutes, minutes, labelMinutes,
      sectionMinutes: isSection ? 0 : null,
    };
    if (!slide.skipped) {
      if (isSection) {
        section = slide;
      } else if (minutes === null) {
        untimedCount++;
      } else {
        totalMinutes += minutes;
        if (section?.sectionMinutes != null) section.sectionMinutes += minutes;
      }
    }
    return slide;
  });
  const sessionStart = clockMinutes(frontMatterValue(text, SESSION_START));
  return { slides, sessionMinutes, totalMinutes, untimedCount, ...(sessionStart === null ? {} : { sessionStart }) };
}
