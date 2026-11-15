/**
 * The deck view's requests to the host (Sprint 157). Every `deck/*` message from the editor webview is decoded here
 * with exact fields before the host acts on it; anything else is dropped.
 *
 * Pure: no `vscode`, so the test decodes the same messages the host does.
 */

/** At most this many picture paths in one request: a deck's slides, with room to spare. */
export const MAX_ASSET_PATHS = 500;
const MAX_PATH_LENGTH = 1024;

export type DeckRequest =
  /** The webview URIs of the slides' pictures, by the paths the slides name (relative to the deck's folder). */
  | { type: 'deck/assets'; paths: string[] }
  /** The text of the theme file the deck names (project-relative). */
  | { type: 'deck/theme'; path: string };

/** The host's answers. */
export type DeckHostMessage =
  /** Each path the host could resolve to a picture beside the deck, mapped to its webview URI. */
  | { type: 'deck/assets'; assets: Record<string, string> }
  /** The theme file's text, or null when the deck names none the project has (the view draws the built-in theme). */
  | { type: 'deck/theme'; path: string; text: string | null };

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
    default:
      throw new DeckProtocolError('Unknown deck request');
  }
}
