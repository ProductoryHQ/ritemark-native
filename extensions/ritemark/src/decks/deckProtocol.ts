/**
 * The deck view's requests to the host (Sprint 157). Every `deck/*` message from the editor webview is decoded here
 * with exact fields before the host acts on it; anything else is dropped.
 *
 * Pure: no `vscode`, so the test decodes the same messages the host does.
 */

/** At most this many picture paths in one request: a deck's slides, with room to spare. */
export const MAX_ASSET_PATHS = 500;
const MAX_PATH_LENGTH = 1024;
/** A pasted picture as a data URL: at most this many characters (about 25 MB of picture). */
export const MAX_PICTURE_DATA_URL = 34 * 1024 * 1024;

export type DeckRequest =
  /** The webview URIs of the slides' pictures, by the paths the slides name (relative to the deck's folder). */
  | { type: 'deck/assets'; paths: string[] }
  /** The text of the theme file the deck names (project-relative). */
  | { type: 'deck/theme'; path: string }
  /** A picture pasted or dropped on a slide: saved in `images/` beside the deck, for the slide with this id. */
  | { type: 'deck/save-image'; slideId: string; dataUrl: string; filename: string }
  /** The deck's current slide, for the Slide library's "Insert after slide N". */
  | { type: 'deck/current'; index: number; count: number }
  /**
   * What the deck's copies show under them: changed here, a newer version in the library, the source gone. The host
   * reads the copies from the deck's document, so the stamps are taken from the bytes the file holds.
   */
  | { type: 'deck/source-states' }
  /** Update the library with the slide that has this id; Use the library's version; Add the slide to the library. */
  | { type: 'deck/update-library'; id: string }
  | { type: 'deck/use-library'; id: string }
  | { type: 'deck/add-to-library'; id: string }
  /** Show the copy's source in the Slide library. */
  | { type: 'deck/show-in-library'; from: string }
  /** Undo a library write this view made. */
  | { type: 'deck/undo-library'; token: string };

/** The host's answers. */
export type DeckHostMessage =
  /** Each path the host could resolve to a picture beside the deck, mapped to its webview URI. */
  | { type: 'deck/assets'; assets: Record<string, string> }
  /** The theme file's text, or null when the deck names none the project has (the view draws the built-in theme). */
  | { type: 'deck/theme'; path: string; text: string | null }
  /** The picture is saved: its path relative to the deck, and its webview URI; or it could not be. */
  | { type: 'deck/image-saved'; slideId: string; path: string; url: string }
  | { type: 'deck/image-failed'; slideId: string; message: string }
  | { type: 'deck/source-states'; states: Array<{ id: string; library: boolean; sourceName: string; changed: boolean; newer: boolean; missing: boolean }> }
  /** A library write is done: the copy's new `from:`, and the token its Undo sends. */
  | { type: 'deck/library-written'; id: string; from: string; verb: 'updated' | 'added'; token: string | null; sourceName: string }
  /** The library's version of a copy, to put in its place (its notes stay the deck's). */
  | { type: 'deck/library-part'; id: string; kind: string; body: string; handout: string }
  | { type: 'deck/library-failed'; id: string | null; message: string }
  /** Slides to insert after part `after` (from the Slide library or the AI's tools), as one undo step. */
  | { type: 'deck/insert'; after: number; parts: Array<{ kind: string; body: string; handout: string }> };

export class DeckProtocolError extends Error {}

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
    case 'deck/source-states': {
      exactKeys(input, ['type']);
      return { type: 'deck/source-states' };
    }
    case 'deck/update-library':
    case 'deck/use-library':
    case 'deck/add-to-library': {
      exactKeys(input, ['type', 'id']);
      return { type: input.type, id: slideIdOf(input.id) };
    }
    case 'deck/show-in-library': {
      exactKeys(input, ['type', 'from']);
      return { type: 'deck/show-in-library', from: stringOf(input.from, MAX_PATH_LENGTH) };
    }
    case 'deck/undo-library': {
      exactKeys(input, ['type', 'token']);
      return { type: 'deck/undo-library', token: stringOf(input.token, 64) };
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
