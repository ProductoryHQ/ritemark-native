/**
 * The deck view's requests to the host (Sprint 157). Every `deck/*` message from the editor webview is decoded here
 * with exact fields before the host acts on it; anything else is dropped.
 *
 * Pure: no `vscode`, so the test decodes the same messages the host does.
 */

import { BLOCK_MAX_STEP } from './blocks/slideRenderer';
import { MAX_DRAFT_WORDS, type StartCardState } from './startCard';
import { isThemePath, type ThemeEntry } from './deckTheme';
import type { ThemeChangeView } from './themeChange';

/** At most this many picture paths in one request: a deck's slides, with room to spare. */
export const MAX_ASSET_PATHS = 500;
const MAX_PATH_LENGTH = 1024;
/** A pasted picture as a data URL: at most this many characters (about 25 MB of picture). */
export const MAX_PICTURE_DATA_URL = 34 * 1024 * 1024;
/** The deck's text as the view holds it, sent with a library request: at most this many characters. */
export const MAX_DECK_TEXT = 8 * 1024 * 1024;
/** At most this many slides' fit steps in one Publish. */
export const MAX_DECK_SLIDES = 10_000;

export type DeckRequest =
  /** The webview URIs of the slides' pictures, by the paths the slides name (relative to the deck's folder). */
  | { type: 'deck/assets'; paths: string[] }
  /** The text of the theme file the deck names (project-relative). */
  | { type: 'deck/theme'; path: string }
  /** Sprint 162: the project's themes, each with how many decks draw it, for the deck's Theme menu. */
  | { type: 'deck/themes' }
  /** Sprint 162 PR 2: the Theme menu's Edit <Name>: the theme file at this project path opens in its own tab. */
  | { type: 'deck/edit-theme'; path: string }
  /**
   * Sprint 162 PR 2: New theme… (frame 14): a theme file by this name in `Slide library/Themes`, started from the deck's
   * theme, Paper or Ember; with `use`, this deck's `theme:` line names it (through the view, one Undo). Then its tab opens.
   */
  | { type: 'deck/new-theme'; name: string; start: 'copy' | 'paper' | 'ember'; use: boolean }
  /** A picture pasted or dropped on a slide: saved in `images/` beside the deck, for the slide with this id. */
  | { type: 'deck/save-image'; slideId: string; dataUrl: string; filename: string }
  /** The deck's current slide, for the Slide library's "Insert after slide N". */
  | { type: 'deck/current'; index: number; count: number }
  /**
   * For the AI (17 November): the slide the person is on, told once it settles: its place, id and title, and nothing
   * else. A list, so the slides selected on the strip can travel once the strip selects several. Never moves the
   * library's insert point (that is `deck/current`'s).
   */
  | { type: 'deck/current-slide'; count: number; slides: DeckCurrentSlide[] }
  /**
   * What the deck's copies show under them: changed here, a newer version in the library, the source gone. The host
   * reads the copies from the deck's document, so the stamps are taken from the bytes the file holds.
   */
  | { type: 'deck/source-states' }
  /**
   * Update the library with the slide that has this id; Use the library's version; Add the slide to the library. `text`
   * is the deck's text as the view holds it now (its newest words may not have reached the document yet).
   */
  | { type: 'deck/update-library'; id: string; text: string }
  | { type: 'deck/use-library'; id: string; text: string }
  | { type: 'deck/add-to-library'; id: string; text: string; topic?: string }
  /** The library's topics, for the Add to library sheet. */
  | { type: 'deck/library-topics' }
  /** Sprint 162 PR 5: See what changed's sheet: its Undo, for the AI's theme change with this id. */
  | { type: 'deck/theme-change-undo'; id: string }
  /** Show the copy's source in the Slide library. */
  | { type: 'deck/show-in-library'; from: string }
  /** The strip's + "From the library…" / "From another deck…": the place opens there, inserting after part `after` (-1: before the first). */
  | { type: 'deck/open-library'; section: 'topics' | 'other'; after: number }
  /** Undo a library write this view made. */
  | { type: 'deck/undo-library'; token: string }
  /** The view's answer to a `deck/insert` or `deck/set-from` that carried a request id: done, or not. */
  | { type: 'deck/applied'; requestId: string; ok: boolean }
  /** Sprint 159 PR 4: the bar's Publish control asks for the page's state. */
  | { type: 'deck/page-state' }
  /**
   * Publish or Update the page: the host writes the page beside the deck and runs 2.2's Publish on it. `text` is the
   * deck as this view holds it, front matter left out (its newest words may not have reached the document yet), `look`
   * the look the view shows (Card or Borderless, which may not have reached it either), and `steps` each slide's fit as
   * the view measured it, by its place in that text: numbers only, 0 to 3.
   */
  | { type: 'deck/publish'; text: string; look: 'card' | 'borderless'; steps: number[] }
  /** The Published chip's menu: Copy link, See online, Unpublish (2.2's commands on the page). */
  | { type: 'deck/page-action'; action: DeckPageAction }
  /** The start card (16 November, frame 20): is this deck New's, which AI drafts it, and the project's earlier decks. */
  | { type: 'deck/start-card' }
  /** The card went (× or the deck was started): it never comes back to this deck. */
  | { type: 'deck/start-card-gone' }
  /** Draft: the person's words go to the AI as a message with this deck attached. */
  | { type: 'deck/start-draft'; text: string }
  /** This deck becomes a copy of the earlier deck at this project path. */
  | { type: 'deck/start-copy'; source: string };

export type DeckPageAction = 'copy-link' | 'see-online' | 'unpublish';

/** The bar's Publish control: hidden until Publish can be reached; then the page's state, as 2.2 keeps it. */
export interface DeckPageState {
  ready: boolean;
  kind: 'unpublished' | 'publishing' | 'published' | 'unpublishing';
  /** "Published · changed": 2.2 finds a change, or the deck's public content is no longer the page's. */
  changed: boolean;
}

/** The host's answers. */
export type DeckHostMessage =
  /** Each path the host could resolve to a picture beside the deck, mapped to its webview URI. */
  | { type: 'deck/assets'; assets: Record<string, string>; /** 17 November: the paths it looked for and found no file at. */ missing?: string[] }
  /** The theme file's text, or null when the deck names none the project has (the view draws the built-in theme). */
  | { type: 'deck/theme'; path: string; text: string | null }
  /** Sprint 162: the project's themes (`themeEntries`), for the Theme menu. */
  | { type: 'deck/themes'; themes: ThemeEntry[] }
  /** Sprint 162 PR 2: New theme…'s answer: the theme is made, or why not (the sheet stays open and says so). */
  | { type: 'deck/new-theme'; ok: true; path: string; name: string }
  | { type: 'deck/new-theme'; ok: false; problem: string }
  /**
   * Sprint 162 PR 2: this deck uses the theme at `path` now (New theme… or Save as a new theme… with "Use it in this
   * deck"): the view writes its `theme:` line as a pick, one step of its Undo, and says so on its bar.
   */
  | { type: 'deck/use-theme'; path: string; name: string }
  /**
   * Sprint 162 PR 5 (17 November): See what changed for an AI's theme change, a sheet over the deck's stage: two slides,
   * each before and after, drawn by the strip's renderer with the old theme and the new.
   */
  | { type: 'deck/theme-change'; change: ThemeChangeView }
  /** The change with this id is undone (from the chat or the sheet): the sheet's Undo goes. */
  | { type: 'deck/theme-change-undone'; id: string }
  /** The picture is saved: its path relative to the deck, and its webview URI; or it could not be. */
  | { type: 'deck/image-saved'; slideId: string; path: string; url: string }
  | { type: 'deck/image-failed'; slideId: string; message: string }
  | { type: 'deck/source-states'; states: Array<{ id: string; library: boolean; sourceName: string; changed: boolean; newer: boolean; missing: boolean }> }
  /** A library write is done: the copy's new `from:`, and the token its Undo sends. */
  | { type: 'deck/library-written'; id: string; from: string; verb: 'updated' | 'added'; token: string | null; sourceName: string }
  /** The library's version of a copy, to put in its place (its notes stay the deck's). */
  | { type: 'deck/library-part'; id: string; kind: string; body: string; handout: string }
  | { type: 'deck/library-failed'; id: string | null; message: string }
  /** The library's topics: path, name and how many slides. */
  | { type: 'deck/library-topics'; topics: Array<{ path: string; name: string; count: number }> }
  /** The library write with this token is undone: the copy's `from:` goes back too. */
  | { type: 'deck/library-undone'; token: string }
  /** Slides to insert after part `after` (from the Slide library or the AI's tools), as one undo step. */
  | { type: 'deck/insert'; after: number; parts: Array<{ kind: string; body: string; handout: string }>; requestId?: string }
  /** A copy's `from:` after the AI's library write, set by the open view (the person may be typing in it). */
  | { type: 'deck/set-from'; id: string; from: string; requestId: string }
  /** Sprint 159 (PR 7): a deck New just made: its title slide's title, selected to be typed over. */
  | { type: 'deck/select-title' }
  /** The bar's Publish control's state (Sprint 159 PR 4). */
  | { type: 'deck/page-state'; state: DeckPageState }
  /** A line for the deck's bar from Publish: why a page wasn't written, or that the link is copied. */
  | { type: 'deck/page-notice'; text: string }
  /** The start card's state for this deck (`startCard.ts`). */
  | { type: 'deck/start-card'; state: StartCardState }
  /** A line for the deck's bar from the start card: "This deck is now a copy of <name>.", or why it couldn't be. */
  | { type: 'deck/notice'; text: string };

export class DeckProtocolError extends Error {}

/** A slide the person is on, as the deck view tells it: its place from 0, its `id:` and its `title:` when it has them. */
export interface DeckCurrentSlide {
  index: number;
  id?: string;
  title?: string;
}

/** A current slide's title: at most this many characters (the host shortens it again for the AI's line and the chip). */
export const MAX_CURRENT_TITLE = 300;

/**
 * A slide's `id:` as the AI may be told it: the ids Ritemark makes (`newId`) and hand-written ones (`q3-results`,
 * `intro_slide`, `42`). Never a path or a line: letters, digits, `-`, `_` and `.`, at most 64.
 */
export function isCurrentSlideId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(value);
}

function decodeCurrentSlides(value: unknown, count: number): DeckCurrentSlide[] {
  // Empty: no slide is current (a deck with none)
  if (!Array.isArray(value) || value.length > count) throw new DeckProtocolError('slides must be the deck\'s slides');
  return value.map((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw new DeckProtocolError('a slide must be an object');
    const fields = entry as Record<string, unknown>;
    exactKeys(fields, ['index', 'id', 'title']);
    if (!isCount(fields.index) || (fields.index as number) >= count) throw new DeckProtocolError('a slide\'s index must be in the deck');
    if (fields.id !== undefined && !isCurrentSlideId(fields.id)) throw new DeckProtocolError('id must be a slide id');
    if (fields.title !== undefined && (typeof fields.title !== 'string' || fields.title.length > MAX_CURRENT_TITLE)) throw new DeckProtocolError('title must be a short line');
    return {
      index: fields.index as number,
      ...(fields.id !== undefined ? { id: fields.id as string } : {}),
      ...(fields.title !== undefined ? { title: fields.title as string } : {}),
    };
  });
}

function exactKeys(input: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) throw new DeckProtocolError(`Unexpected field ${key}`);
  }
}

/** Decode one webview message as a deck request, or throw. */
export function decodeDeckRequest(value: unknown): DeckRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new DeckProtocolError('Message must be an object');
  const input = value as Record<string, unknown>;
  switch (input.type) {
    case 'deck/assets': {
      exactKeys(input, ['type', 'paths']);
      if (!Array.isArray(input.paths) || input.paths.length > MAX_ASSET_PATHS) throw new DeckProtocolError('paths must be a short list');
      const paths = input.paths.map((path) => {
        if (typeof path !== 'string' || path.length === 0 || path.length > MAX_PATH_LENGTH) throw new DeckProtocolError('Each path must be a string');
        return path;
      });
      return { type: 'deck/assets', paths };
    }
    case 'deck/theme': {
      exactKeys(input, ['type', 'path']);
      if (typeof input.path !== 'string' || input.path.length === 0 || input.path.length > MAX_PATH_LENGTH) throw new DeckProtocolError('path must be a string');
      return { type: 'deck/theme', path: input.path };
    }
    case 'deck/save-image': {
      exactKeys(input, ['type', 'slideId', 'dataUrl', 'filename']);
      if (typeof input.slideId !== 'string' || !/^[0-9a-z]{1,16}$/i.test(input.slideId)) throw new DeckProtocolError('slideId must be a slide id');
      if (typeof input.dataUrl !== 'string' || !input.dataUrl.startsWith('data:image/') || input.dataUrl.length > MAX_PICTURE_DATA_URL) throw new DeckProtocolError('dataUrl must be a picture');
      if (typeof input.filename !== 'string' || input.filename.length === 0 || input.filename.length > 255) throw new DeckProtocolError('filename must be a name');
      return { type: 'deck/save-image', slideId: input.slideId, dataUrl: input.dataUrl, filename: input.filename };
    }
    case 'deck/current': {
      exactKeys(input, ['type', 'index', 'count']);
      if (!isCount(input.index) || !isCount(input.count)) throw new DeckProtocolError('index and count must be counts');
      return { type: 'deck/current', index: input.index, count: input.count };
    }
    case 'deck/current-slide': {
      exactKeys(input, ['type', 'count', 'slides']);
      if (!isCount(input.count)) throw new DeckProtocolError('count must be a count');
      return { type: 'deck/current-slide', count: input.count, slides: decodeCurrentSlides(input.slides, input.count) };
    }
    case 'deck/source-states': {
      exactKeys(input, ['type']);
      return { type: 'deck/source-states' };
    }
    case 'deck/update-library':
    case 'deck/use-library': {
      exactKeys(input, ['type', 'id', 'text']);
      return { type: input.type, id: slideIdOf(input.id), text: stringOf(input.text, MAX_DECK_TEXT, true) };
    }
    case 'deck/add-to-library': {
      // The topic is the sheet's choice (a topic's path, as long as a path may be, or a new topic's name); without one,
      // the host asks.
      if ('topic' in input) {
        exactKeys(input, ['type', 'id', 'text', 'topic']);
        return { type: 'deck/add-to-library', id: slideIdOf(input.id), text: stringOf(input.text, MAX_DECK_TEXT, true), topic: stringOf(input.topic, MAX_PATH_LENGTH) };
      }
      exactKeys(input, ['type', 'id', 'text']);
      return { type: 'deck/add-to-library', id: slideIdOf(input.id), text: stringOf(input.text, MAX_DECK_TEXT, true) };
    }
    case 'deck/library-topics': {
      exactKeys(input, ['type']);
      return { type: 'deck/library-topics' };
    }
    case 'deck/theme-change-undo': {
      exactKeys(input, ['type', 'id']);
      return { type: 'deck/theme-change-undo', id: stringOf(input.id, 64) };
    }
    case 'deck/themes': {
      exactKeys(input, ['type']);
      return { type: 'deck/themes' };
    }
    case 'deck/edit-theme': {
      exactKeys(input, ['type', 'path']);
      const path = stringOf(input.path, MAX_PATH_LENGTH);
      if (!isThemePath(path)) throw new DeckProtocolError('path must be a theme file');
      return { type: 'deck/edit-theme', path };
    }
    case 'deck/new-theme': {
      exactKeys(input, ['type', 'name', 'start', 'use']);
      const name = stringOf(input.name, 200);
      if (input.start !== 'copy' && input.start !== 'paper' && input.start !== 'ember') throw new DeckProtocolError('start must be copy, paper or ember');
      if (typeof input.use !== 'boolean') throw new DeckProtocolError('use must be a boolean');
      return { type: 'deck/new-theme', name, start: input.start, use: input.use };
    }
    case 'deck/open-library': {
      exactKeys(input, ['type', 'section', 'after']);
      if (input.section !== 'topics' && input.section !== 'other') throw new DeckProtocolError('section must be topics or other');
      if (typeof input.after !== 'number' || !Number.isInteger(input.after) || input.after < -1 || input.after >= 100_000) throw new DeckProtocolError('after must be a part or -1');
      return { type: 'deck/open-library', section: input.section, after: input.after };
    }
    case 'deck/show-in-library': {
      exactKeys(input, ['type', 'from']);
      return { type: 'deck/show-in-library', from: stringOf(input.from, MAX_PATH_LENGTH) };
    }
    case 'deck/undo-library': {
      exactKeys(input, ['type', 'token']);
      return { type: 'deck/undo-library', token: stringOf(input.token, 64) };
    }
    case 'deck/page-state': {
      exactKeys(input, ['type']);
      return { type: 'deck/page-state' };
    }
    case 'deck/publish': {
      exactKeys(input, ['type', 'text', 'look', 'steps']);
      const text = stringOf(input.text, MAX_DECK_TEXT, true);
      if (input.look !== 'card' && input.look !== 'borderless') throw new DeckProtocolError('look must be card or borderless');
      const look = input.look;
      if (!Array.isArray(input.steps) || input.steps.length > MAX_DECK_SLIDES) throw new DeckProtocolError('steps must be a short list');
      const steps = input.steps.map(step => {
        // A block slide's fit has six steps (Sprint 161); `publicDeck` holds a v1 slide to its own three.
        if (typeof step !== 'number' || !Number.isInteger(step) || step < 0 || step > BLOCK_MAX_STEP) throw new DeckProtocolError(`Each step must be 0 to ${BLOCK_MAX_STEP}`);
        return step;
      });
      return { type: 'deck/publish', text, look, steps };
    }
    case 'deck/page-action': {
      exactKeys(input, ['type', 'action']);
      if (input.action !== 'copy-link' && input.action !== 'see-online' && input.action !== 'unpublish') throw new DeckProtocolError('Unknown page action');
      return { type: 'deck/page-action', action: input.action };
    }
    case 'deck/start-card':
    case 'deck/start-card-gone': {
      exactKeys(input, ['type']);
      return { type: input.type };
    }
    case 'deck/start-draft': {
      exactKeys(input, ['type', 'text']);
      const text = stringOf(input.text, MAX_DRAFT_WORDS);
      if (!text.trim()) throw new DeckProtocolError('text must hold words');
      return { type: 'deck/start-draft', text };
    }
    case 'deck/start-copy': {
      exactKeys(input, ['type', 'source']);
      const source = stringOf(input.source, MAX_PATH_LENGTH);
      if (!/\.deck\.md$/i.test(source)) throw new DeckProtocolError('source must be a deck');
      return { type: 'deck/start-copy', source };
    }
    case 'deck/applied': {
      exactKeys(input, ['type', 'requestId', 'ok']);
      if (typeof input.ok !== 'boolean') throw new DeckProtocolError('ok must be a boolean');
      return { type: 'deck/applied', requestId: stringOf(input.requestId, 64), ok: input.ok };
    }
    default:
      throw new DeckProtocolError('Unknown deck request');
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 100_000;
}

function stringOf(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && value.length === 0)) throw new DeckProtocolError('Expected a string');
  return value;
}

function slideIdOf(value: unknown): string {
  const id = stringOf(value, 16);
  if (!/^[0-9a-z]+$/i.test(id)) throw new DeckProtocolError('id must be a slide id');
  return id;
}

/** The Slide library place's requests (`SlideLibraryViewProvider`): search, insert a slide, open a deck. */
export type LibraryRequest =
  | { type: 'library/ready' }
  | { type: 'library/search'; query: string }
  | { type: 'library/insert'; path: string; id: string }
  | { type: 'library/open'; path: string };

/** Decode one message from the Slide library place with exact fields, or null. */
export function decodeLibraryRequest(value: unknown): LibraryRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  const only = (...allowed: string[]) => keys.length === allowed.length && keys.every(key => allowed.includes(key));
  const text = (field: unknown, max: number) => typeof field === 'string' && field.length <= max;
  const deckPath = (field: unknown) => text(field, MAX_PATH_LENGTH) && (field as string).length > 0 && /\.deck\.md$/i.test(field as string);
  switch (input.type) {
    case 'library/ready':
      return only('type') ? { type: 'library/ready' } : null;
    case 'library/search':
      return only('type', 'query') && text(input.query, 200) ? { type: 'library/search', query: input.query as string } : null;
    case 'library/insert':
      return only('type', 'path', 'id') && deckPath(input.path) && typeof input.id === 'string' && /^[0-9a-z]{1,16}$/i.test(input.id)
        ? { type: 'library/insert', path: input.path as string, id: input.id }
        : null;
    case 'library/open':
      return only('type', 'path') && deckPath(input.path) ? { type: 'library/open', path: input.path as string } : null;
    default:
      return null;
  }
}
