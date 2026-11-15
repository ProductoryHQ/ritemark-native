/**
 * Presenting a deck (Sprint 159, experience 17): what crosses between the host and the wall, and the deck view's
 * Present request. Pure, so the test reads the same messages the host builds and decodes.
 *
 * The wall is the room's screen. Its state carries only what the room may see: the slides shown, each with the words
 * and settings its layout draws. Never the speaker notes, never a skipped slide (unless the presenter typed its number
 * and went there), never the `id`, `from`, `kept` or `skip` lines. `wallStateOf` builds it field by field, so nothing
 * new reaches the wall by accident.
 */
import type { SlideData, SlideItem } from '../deckFormat';
import type { DeckTheme } from '../deckTheme';
import { presentTitleOf, type PresentSlide, type PresentView } from './presentSession';

/** The webview panel that is the wall. */
export const DECK_WALL_VIEW_TYPE = 'ritemark.deckWall';

/** A slide as the wall draws it: the layout's words and settings, and its thumbnail number. */
export interface WallSlide {
  /** The thumbnail's number (the slide's place in the deck, from 1). */
  number: number;
  kind: string;
  /** Its title, or "slide N", for the go-to box. */
  title: string;
  data: SlideData;
}

/** The host's state for the wall, sent after every move. */
export interface WallState {
  type: 'present/wall';
  /** The slide on the wall now. */
  slide: WallSlide;
  /** n of N: its place among the slides shown, or null when it is skipped (reached by its number) or deleted. */
  position: number | null;
  count: number;
  /** The slide on the wall is a skipped one, reached by its number. */
  skipped: boolean;
  /** The slides shown, in order, for the grid of all slides. */
  slides: WallSlide[];
  borderless: boolean;
  theme: DeckTheme;
  /** The pictures these slides name, as the wall's webview URIs. */
  assets: Record<string, string>;
}

/** The host's answer to a typed number: the title of the slide with that number, or null when the deck has none. */
export interface WallPeeked {
  type: 'present/peeked';
  number: number;
  title: string | null;
}

/** After the move into its own window: the host asks whether the wall's window has the focus yet. */
export interface WallFocusCheck {
  type: 'present/focus-check';
}

export type WallHostMessage = WallState | WallPeeked | WallFocusCheck;

/** The wall's requests. */
export type WallRequest =
  | { type: 'present/ready' }
  /**
   * The answer to a focus check: the wall's window has the focus, so the host may make it compact and full screen;
   * `fullScreen` says whether that window is full screen already (full screen is a toggle).
   */
  | { type: 'present/focus'; fullScreen: boolean }
  | { type: 'present/next' }
  | { type: 'present/back' }
  | { type: 'present/first' }
  | { type: 'present/last' }
  | { type: 'present/go'; number: number }
  | { type: 'present/peek'; number: number }
  | { type: 'present/stop' };

/** The deck view's Present: from its current slide (`index`, from 0) or from the start. */
export interface DeckPresentRequest {
  type: 'deck/present';
  from: 'here' | 'start';
  index: number;
}

/** A slide number a person can type: at most this. */
const MAX_NUMBER = 99_999;

const ITEM_KEYS = ['heading', 'text', 'icon'] as const;

/** Only the words and settings a slide's layout draws, copied one by one. */
export function wallDataOf(data: SlideData): SlideData {
  const out: SlideData = {};
  for (const key of ['title', 'subtitle', 'number', 'look', 'picture', 'image'] as const) {
    if (typeof data[key] === 'string') out[key] = data[key];
  }
  if (Array.isArray(data.items)) {
    out.items = data.items.map(item => {
      const copy: SlideItem = {};
      for (const key of ITEM_KEYS) if (typeof item[key] === 'string') copy[key] = item[key];
      return copy;
    });
  }
  if (Array.isArray(data.rows)) out.rows = data.rows.map(row => row.map(cell => String(cell)));
  return out;
}

export function wallSlideOf(slide: PresentSlide): WallSlide {
  return { number: slide.index + 1, kind: slide.kind, title: presentTitleOf(slide), data: wallDataOf(slide.data) };
}

/** The pictures the wall's state names: the current slide's and the shown slides'. */
export function wallPicturePaths(view: PresentView): string[] {
  const paths = new Set<string>();
  for (const slide of [view.current, ...view.shown]) if (slide.data.image) paths.add(slide.data.image);
  return [...paths].sort();
}

/** The wall's state after a move. */
export function wallStateOf(view: PresentView, look: { borderless: boolean; theme: DeckTheme }, assets: Record<string, string>): WallState {
  return {
    type: 'present/wall',
    slide: wallSlideOf(view.current),
    position: view.position,
    count: view.count,
    skipped: view.current.skip,
    slides: view.shown.map(wallSlideOf),
    borderless: look.borderless,
    theme: look.theme,
    assets,
  };
}

function exactKeys(input: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(input).every(key => keys.includes(key)) && keys.every(key => key in input);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_NUMBER;
}

/** Decode one message from the wall with exact fields, or null (the shell's page signals are null too). */
export function decodeWallRequest(value: unknown): WallRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  switch (input.type) {
    case 'present/focus':
      return exactKeys(input, ['type', 'fullScreen']) && typeof input.fullScreen === 'boolean' ? { type: 'present/focus', fullScreen: input.fullScreen } : null;
    case 'present/ready':
    case 'present/next':
    case 'present/back':
    case 'present/first':
    case 'present/last':
    case 'present/stop':
      return exactKeys(input, ['type']) ? { type: input.type } : null;
    case 'present/go':
    case 'present/peek':
      return exactKeys(input, ['type', 'number']) && isNumber(input.number) ? { type: input.type, number: input.number } : null;
    default:
      return null;
  }
}

/** Decode the deck view's Present with exact fields, or null. */
export function decodeDeckPresentRequest(value: unknown): DeckPresentRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.type !== 'deck/present' || !exactKeys(input, ['type', 'from', 'index'])) return null;
  if (input.from !== 'here' && input.from !== 'start') return null;
  if (typeof input.index !== 'number' || !Number.isInteger(input.index) || input.index < 0 || input.index > MAX_NUMBER) return null;
  return { type: 'deck/present', from: input.from, index: input.index };
}
