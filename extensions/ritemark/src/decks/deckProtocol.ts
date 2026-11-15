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
  | { type: 'deck/save-image'; slideId: string; dataUrl: string; filename: string };

/** The host's answers. */
export type DeckHostMessage =
  /** Each path the host could resolve to a picture beside the deck, mapped to its webview URI. */
  | { type: 'deck/assets'; assets: Record<string, string> }
  /** The theme file's text, or null when the deck names none the project has (the view draws the built-in theme). */
  | { type: 'deck/theme'; path: string; text: string | null }
  /** The picture is saved: its path relative to the deck, and its webview URI; or it could not be. */
  | { type: 'deck/image-saved'; slideId: string; path: string; url: string }
  | { type: 'deck/image-failed'; slideId: string; message: string };

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
    default:
      throw new DeckProtocolError('Unknown deck request');
  }
}
