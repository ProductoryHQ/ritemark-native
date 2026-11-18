/**
 * Presenting a deck (Sprint 159, experience 17): what crosses between the host and the wall, and the deck view's
 * Present request. Pure, so the test reads the same messages the host builds and decodes.
 *
 * The wall is the room's screen. Its state carries only what the room may see: the slides shown, each with the words
 * and settings its layout draws. Never a comment, never a skipped slide (unless the presenter typed its number
 * and went there), never the `id`, `from`, `kept` or `skip` lines. `wallStateOf` builds it field by field, so nothing
 * new reaches the wall by accident.
 */
import type { SlideData, SlideItem } from '../deckFormat';
import { publicSlide } from '../page/publicDeck';
import { slidePicturePaths } from '../blocks/slideRenderer';
import { partComments, type PartComment } from './partComments';
import type { DeckTheme } from '../deckTheme';
import { presentTitleOf, type PresentSlide, type PresentView } from './presentSession';
import { transitionOf, type DeckTransition } from './deckTransition';

/** The webview panel that is the wall. */
export const DECK_WALL_VIEW_TYPE = 'ritemark.deckWall';
/** The webview panel that is the presenter view (Sprint 159, PR 6). */
export const DECK_PRESENTER_VIEW_TYPE = 'ritemark.deckPresenter';

/**
 * What the wall shows instead of the slide (B or "." the theme's ground, W white; Q the published page's QR code, small
 * details item 3), or null: the slide.
 */
export type WallBlank = 'ground' | 'white' | 'page';

/**
 * Decks README items 11 and 16 (17 November): the spotlight on one item of the slide on the wall, and a picture that
 * fills the wall. An item is named by its place among the slide's items (`spotItems` in the webview, from 0): the wall
 * and the presenter view draw the same slide, so the same place is the same item in both. A move clears both; nothing
 * of it goes in the file.
 */
export interface WallFocus {
  /** The item that stays as it is while the rest of the slide dims, or null. */
  spot: number | null;
  /** The picture shown whole on the wall, or null. */
  fill: number | null;
}

export const NO_FOCUS: WallFocus = { spot: null, fill: null };

/** The system's clock for the presenter view's time of day (`systemClock.ts`). */
export interface ClockLocale {
  /** The system's locale tag, or null for the webview's own. */
  locale: string | null;
  /** The system's 12- or 24-hour choice over the locale's, or null for the locale's own. */
  hourCycle: 'h12' | 'h23' | null;
}

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
  /** The bar offers the presenter view (a second display, or a dev build's windowed mode), and whether it is on. */
  presenter: { available: boolean; on: boolean };
  /** The wall is blank (to the theme's ground, or white), shows the page's QR code (`page`), or null. */
  blank: WallBlank | null;
  /** The deck's published page, by its address, for Q's QR code; null while the deck isn't published. */
  page: string | null;
  /** Items 11 and 16: the spotlit item and the picture filling the wall (`WallFocus`). */
  spot: number | null;
  fill: number | null;
  /**
   * README item 19: how the wall goes from one slide to the next (`transition:` in the deck's front matter, Fade without
   * it). Only the wall moves: the presenter view's state has none.
   */
  transition: DeckTransition;
}

/**
 * The host's state for the presenter view: the wall's, and what only the presenter sees. It is the one state that
 * carries the current part's comments ("Your comments", Sprint 161), and only the presenter view's panel ever gets it.
 */
export interface PresenterState {
  type: 'present/presenter';
  /** The slide on the wall now, and the one Next shows (null at the end). */
  current: WallSlide;
  next: WallSlide | null;
  /** Sprint 161: the current slide's part's comments, in order ("Your comments"). Only the presenter view gets them. */
  comments: PartComment[];
  position: number | null;
  count: number;
  skipped: boolean;
  /** The slides shown, in order: the row under the slide. */
  slides: WallSlide[];
  borderless: boolean;
  theme: DeckTheme;
  assets: Record<string, string>;
  /** The display the wall is on, by its name, or null on one display. */
  wallDisplay: string | null;
  /** Swap displays: there are two. */
  canSwap: boolean;
  /** The session's length in minutes (`ritemark-length` in the deck's front matter), or null. */
  length: number | null;
  /** When the presentation started (ms since the epoch), for the clock. */
  startedAt: number;
  /** The wall is blank: "The wall is blank · B to show it"; or it shows the page's QR code. */
  blank: WallBlank | null;
  /** The deck's published page, by its address: "Show the page" shows its QR code on the wall. Null: no button. */
  page: string | null;
  /** Items 11 and 16: Now shows the wall's spotlight, and says when a picture fills the wall. */
  spot: number | null;
  fill: number | null;
  /** The system's clock, for the time of day beside the elapsed time. */
  clock: ClockLocale;
}

/** The host's answer to a typed number: the title of the slide with that number, or null when the deck has none. */
export interface WallPeeked {
  type: 'present/peeked';
  number: number;
  title: string | null;
}

export type WallHostMessage = WallState | WallPeeked | PresenterState;

/** The wall's requests. */
export type WallRequest =
  | { type: 'present/ready' }
  | { type: 'present/next' }
  | { type: 'present/back' }
  | { type: 'present/first' }
  | { type: 'present/last' }
  | { type: 'present/go'; number: number }
  | { type: 'present/peek'; number: number }
  | { type: 'present/stop' }
  /** The wall's bar: the presenter view on or off. */
  | { type: 'present/presenter' }
  /** The presenter view: the wall and the presenter view change displays. */
  | { type: 'present/swap' }
  /** The presenter view's clock: ask the session's length and keep it in the deck's front matter. */
  | { type: 'present/set-length' }
  /** B, "." or W blanks the wall, Q shows the page's QR code; any key brings the slide back (`to` null). */
  | { type: 'present/blank'; to: WallBlank | null }
  /** Item 16: a click or F, Tab, Shift+Tab spotlights an item; a click outside or Esc clears it (`item` null). */
  | { type: 'present/spot'; item: number | null }
  /** Item 11: a click on a spotlit picture fills the wall with it; any key or click returns (`item` null). */
  | { type: 'present/fill'; item: number | null };

/** The deck view's Present: from its current slide (`index`, from 0) or from the start. */
export interface DeckPresentRequest {
  type: 'deck/present';
  from: 'here' | 'start';
  index: number;
}

/** A slide number a person can type: at most this. */
const MAX_NUMBER = 99_999;
/** An item's place on a slide: at most this. */
const MAX_ITEM = 9_999;

const ITEM_KEYS = ['heading', 'text', 'icon'] as const;

/** Only the words and settings a slide's layout draws, copied one by one. */
export function wallDataOf(data: SlideData): SlideData {
  const out: SlideData = {};
  for (const key of ['title', 'subtitle', 'number', 'tag', 'look', 'picture', 'image'] as const) {
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
  if (typeof data.markdown === 'string') out.markdown = data.markdown;
  // A section's mark (no words; the page shows its band): an Agenda on the wall lists the deck's sections (small details 14).
  if (data.section === true) out.section = true;
  return out;
}

/**
 * A slide as the room sees it. Sprint 161: through `publicSlide`, the page's own rule, so the wall and the page show
 * the same: what a v1 layout draws (never the words it keeps hidden), a block slide's Markdown without its comments,
 * and never a header's id, from, kept or skip. `wallDataOf` then copies its fields one by one.
 */
export function wallSlideOf(slide: PresentSlide): WallSlide {
  const shown = publicSlide(slide.kind, slide.data);
  // Its title as the room may see it: a block slide's from its public Markdown (`publicSlide`).
  const title = presentTitleOf({ ...slide, data: shown.data });
  return { number: slide.index + 1, kind: shown.kind, title, data: wallDataOf(shown.data) };
}

/** The pictures the wall's state names: the current slide's and the shown slides'. */
export function wallPicturePaths(view: PresentView): string[] {
  const paths = new Set<string>();
  // Only what the room may see (`publicSlide`): a picture a layout doesn't draw is never asked for.
  for (const slide of [view.current, ...view.shown]) for (const picture of slidePicturePaths(publicSlide(slide.kind, slide.data).data)) paths.add(picture);
  return [...paths].sort();
}

/** The wall's state after a move. */
export function wallStateOf(
  view: PresentView,
  look: { borderless: boolean; theme: DeckTheme; transition?: DeckTransition },
  assets: Record<string, string>,
  presenter: { available: boolean; on: boolean } = { available: false, on: false },
  blank: WallBlank | null = null,
  page: string | null = null,
  focus: WallFocus = NO_FOCUS,
): WallState {
  const address = wallPageAddress(page);
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
    presenter: { available: presenter.available, on: presenter.on },
    blank: shownBlank(blank, address),
    page: address,
    spot: itemOf(focus.spot),
    fill: itemOf(focus.fill),
    transition: transitionOf(look.transition),
  };
}

/** The pictures the presenter view names: the wall's, the next slide's, and the one on the slide the wall last got. */
export function presenterPicturePaths(view: PresentView, onWall?: WallSlide): string[] {
  const paths = new Set(wallPicturePaths(view));
  for (const picture of view.next ? slidePicturePaths(publicSlide(view.next.kind, view.next.data).data) : []) paths.add(picture);
  for (const picture of onWall ? slidePicturePaths(onWall.data) : []) paths.add(picture);
  return [...paths].sort();
}

/**
 * The presenter view's state: the wall's slide, the next one and the notes, and the clock's. `onWall` is the slide the
 * wall last got: Now shows it as the room sees it (an edit reaches both at the next move), marked in the row where it
 * is now, while the next slide and the row follow the edit.
 */
export function presenterStateOf(
  view: PresentView,
  look: { borderless: boolean; theme: DeckTheme },
  assets: Record<string, string>,
  session: { wallDisplay: string | null; canSwap: boolean; length: number | null; startedAt: number; blank?: WallBlank | null; clock?: ClockLocale; page?: string | null; focus?: WallFocus },
  onWall?: WallSlide,
): PresenterState {
  const address = wallPageAddress(session.page ?? null);
  return {
    type: 'present/presenter',
    current: onWall ? { ...onWall, number: view.current.index + 1 } : wallSlideOf(view.current),
    next: view.next ? wallSlideOf(view.next) : null,
    comments: partComments(view.current.handout, view.current.converted),
    position: view.position,
    count: view.count,
    skipped: view.current.skip,
    slides: view.shown.map(wallSlideOf),
    borderless: look.borderless,
    theme: look.theme,
    assets,
    wallDisplay: session.wallDisplay,
    canSwap: session.canSwap,
    length: session.length,
    startedAt: session.startedAt,
    blank: shownBlank(session.blank ?? null, address),
    page: address,
    spot: itemOf(session.focus?.spot ?? null),
    fill: itemOf(session.focus?.fill ?? null),
    clock: { locale: session.clock?.locale ?? null, hourCycle: session.clock?.hourCycle ?? null },
  };
}

function blankOf(value: unknown): WallBlank | null {
  return value === 'ground' || value === 'white' || value === 'page' ? value : null;
}

/** The longest page address the wall is sent. */
const MAX_ADDRESS = 2048;

/**
 * A published page's address as the wall may show it: an https address, or null. (Only Publish's own addresses ever
 * reach here: `DeckPublisher.pageAddressOf` keeps to `WORKERS_DEV_ADDRESS`; this is the message's shape.)
 */
export function wallPageAddress(value: unknown): string | null {
  return typeof value === 'string' && value.length <= MAX_ADDRESS && /^https:\/\/[^\s/]+/.test(value) ? value : null;
}

/** The blank the wall shows: the page's QR code only while the deck has a published page. The one rule for it. */
export function shownBlank(value: unknown, page: string | null): WallBlank | null {
  const blank = blankOf(value);
  return blank === 'page' && page === null ? null : blank;
}

function isItem(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_ITEM;
}

function itemOf(value: unknown): number | null {
  return isItem(value) ? value : null;
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
    case 'present/ready':
    case 'present/presenter':
    case 'present/swap':
    case 'present/set-length':
    case 'present/next':
    case 'present/back':
    case 'present/first':
    case 'present/last':
    case 'present/stop':
      return exactKeys(input, ['type']) ? { type: input.type } : null;
    case 'present/go':
    case 'present/peek':
      return exactKeys(input, ['type', 'number']) && isNumber(input.number) ? { type: input.type, number: input.number } : null;
    case 'present/blank':
      return exactKeys(input, ['type', 'to']) && (input.to === null || blankOf(input.to) !== null) ? { type: 'present/blank', to: blankOf(input.to) } : null;
    case 'present/spot':
    case 'present/fill':
      return exactKeys(input, ['type', 'item']) && (input.item === null || isItem(input.item)) ? { type: input.type, item: itemOf(input.item) } : null;
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

/**
 * Present's answer on a shell without its placement commands (outside a dev build): a notice in the deck's bar, words
 * only, when Present, ⌘↩ or ⇧⌘↩ is pressed (the Experience lead, 16 November). The button stays enabled, and nothing
 * opens.
 */
export const PRESENT_NEEDS_UPDATE = 'Presenting needs a newer Ritemark. Update it, then present again.';

/**
 * The same answer in a dev build, whose `vscode/` may be older than its extension (a light worktree's copied tree): what
 * to run, so a builder never takes the missing commands for a Present fault.
 */
export const PRESENT_NEEDS_PATCHES = 'Run ./scripts/apply-patches.sh: this dev build has no Present commands.';

/** The deck view's Present menu: whether a presenter view can show, where, and whether it is on. */
export interface DeckPresentOptions {
  type: 'deck/present-options';
  /** A second display is connected (or a dev build's windowed mode) and the shell can place the windows. */
  available: boolean;
  on: boolean;
  /** The display the wall goes to, by its name ("Slides on <name>, your comments here"), or null. */
  wallDisplay: string | null;
}

/** The deck view's requests about the menu: the options, and Presenter view turned on or off. */
export type DeckPresentMenuRequest = { type: 'deck/present-options' } | { type: 'deck/present-presenter'; on: boolean };

export function decodeDeckPresentMenuRequest(value: unknown): DeckPresentMenuRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.type === 'deck/present-options') return exactKeys(input, ['type']) ? { type: 'deck/present-options' } : null;
  if (input.type === 'deck/present-presenter' && exactKeys(input, ['type', 'on']) && typeof input.on === 'boolean') return { type: 'deck/present-presenter', on: input.on };
  return null;
}

/** The longest session the clock is set for, in minutes. */
export const MAX_LENGTH_MINUTES = 24 * 60;

/** A session length as written (`45`, `"90"`): whole minutes from 1 to a day, or null. */
export function lengthMinutesOf(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const text = value.trim();
  if (!/^\d{1,4}$/.test(text)) return null;
  const minutes = Number(text);
  return minutes >= 1 && minutes <= MAX_LENGTH_MINUTES ? minutes : null;
}

/**
 * The edit that sets one plain value in the deck's front matter (`ritemark-length: 45`): the line replaced when it is
 * there, added at the front matter's end when not, or a front matter made for it at the top. Everything else stays
 * byte for byte.
 */
export function frontMatterEdit(text: string, key: string, value: string): { start: number; end: number; text: string } {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  // An empty front matter (`---` then `---`) first: the body is optional and lazy, so a later `---` in the deck is
  // never taken for the closing line.
  const match = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)??---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { start: 0, end: 0, text: `---${newline}${key}: ${value}${newline}---${newline}${newline}` };
  const bodyStart = match[0].indexOf('\n') + 1;
  const body = match[1];
  if (body === undefined) return { start: bodyStart, end: bodyStart, text: `${key}: ${value}${newline}` };
  let offset = bodyStart;
  for (const line of body.split('\n')) {
    const bare = line.replace(/\r$/, '');
    const entry = /^([A-Za-z0-9_-]+):/.exec(bare);
    if (entry && entry[1] === key) return { start: offset, end: offset + bare.length, text: `${key}: ${value}` };
    offset += line.length + 1;
  }
  // Before the closing line: after the body's last line.
  const bodyEnd = bodyStart + body.length;
  return { start: bodyEnd, end: bodyEnd, text: `${newline}${key}: ${value}` };
}

/** A display, as the shell's `_ritemark.present.displays` gives it. */
export interface PresentDisplay {
  name: string;
  primary: boolean;
  internal: boolean;
}

/**
 * Which display the wall goes to and which the presenter view. The wall: the first display that is neither built in
 * nor the primary (the projector), else the first that isn't built in (a projector made the primary), else the first
 * that isn't the primary. The presenter view: the built-in display, else the primary, else another. On one display (or
 * mirrored displays, which report one), both are the same. Pure, so the test reads the same rule.
 */
export function chooseDisplays(displays: PresentDisplay[]): { wall: number; presenter: number } {
  if (displays.length < 2) return { wall: 0, presenter: 0 };
  let wall = displays.findIndex(display => !display.internal && !display.primary);
  if (wall < 0) wall = displays.findIndex(display => !display.internal);
  if (wall < 0) wall = displays.findIndex(display => !display.primary);
  if (wall < 0) wall = 1;
  let presenter = displays.findIndex((display, index) => index !== wall && display.internal);
  if (presenter < 0) presenter = displays.findIndex((display, index) => index !== wall && display.primary);
  if (presenter < 0) presenter = displays.findIndex((_display, index) => index !== wall);
  return { wall, presenter };
}
