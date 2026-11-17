/**
 * Sprint 162 PR 2: the theme's tab and the host. Every `theme/*` message from a theme's webview is decoded here with
 * exact fields before the host acts on it; anything else is dropped. Pure: no `vscode`, so the test decodes the same
 * messages the host does.
 */
import type { WallSlide } from './present/presentProtocol';
import { isThemeChanges, type ThemeChanges } from './themeFile';
import type { ThemeChangeView } from './themeChange';

export type ThemeRequest =
  /** The tab is drawn: the host sends the theme's state and its decks. */
  | { type: 'theme/ready' }
  /** A change to the draft: the theme document's lines for these fields (`themeTextWith`). */
  | { type: 'theme/set'; changes: ThemeChanges }
  /** Save: the draft goes into the theme file, and every deck that uses it follows. */
  | { type: 'theme/save' }
  /** Discard: the draft goes, and the tab shows the file as it is. */
  | { type: 'theme/discard' }
  /** Cmd+Z and Cmd+Shift+Z in the tab: the draft's own last change taken back, or put back. */
  | { type: 'theme/undo' }
  | { type: 'theme/redo' }
  /** Save as a new theme…: the draft goes into a new file by this name; this theme and its decks stay as they were. */
  | { type: 'theme/save-as'; name: string; use: boolean }
  /** "Used by N decks": open this deck (a project path). */
  | { type: 'theme/open-deck'; path: string }
  /** The Save notice's Undo: the decks go back, and the changes stay in the tab, not saved. */
  | { type: 'theme/undo-save'; token: string }
  /**
   * Sprint 162 PR 5: the contrast line's "Check all colours" or "Fix with Claude": the AI's colour check goes to the
   * open chat, and its changes land in this tab's draft.
   */
  | { type: 'theme/check-colours' }
  /** See what changed's sheet: its Undo, for the change with this id. */
  | { type: 'theme/change-undo'; id: string };

/** A deck that uses the theme, as "Used by N decks" lists it. */
export interface ThemeDeck {
  path: string;
  name: string;
}

/** The six slides the tab previews the draft on: the deck's own, as the room sees them, or Ritemark's sample. */
export interface ThemePreview {
  /** The deck's name, or null for the sample. */
  deck: string | null;
  borderless: boolean;
  slides: WallSlide[];
  assets: Record<string, string>;
}

export type ThemeHostMessage =
  /** The theme document as it is: its text (the draft, when `dirty`), its project path and the file's own name. */
  | { type: 'theme/state'; path: string; text: string; dirty: boolean }
  /**
   * The decks that use the theme; the slides it previews on; the deck Save as a new theme… may put the new one in (the
   * deck the tab was opened from, while its view is open); and the names and files already taken in the folder.
   */
  | { type: 'theme/decks'; decks: ThemeDeck[]; preview: ThemePreview; useIn: string | null; taken: { names: string[]; files: string[] } }
  /** A line for the tab's bar; with `token`, its Undo takes back a Save. */
  | { type: 'theme/notice'; text: string; token?: string }
  /** Save as a new theme…'s answer: done (the tab moves to the new theme), or why not (the sheet stays and says so). */
  | { type: 'theme/save-as'; ok: boolean; problem?: string }
  /** Sprint 162 PR 5: See what changed for an AI's change to the draft: the sheet over the preview. */
  | { type: 'theme/change'; change: ThemeChangeView }
  /** The change with this id is undone (from the chat or the sheet): the sheet's Undo goes. */
  | { type: 'theme/change-undone'; id: string };

export class ThemeProtocolError extends Error {}

const MAX_PATH_LENGTH = 1024;

function exactKeys(input: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) throw new ThemeProtocolError(`Unexpected field ${key}`);
  }
}

function stringOf(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new ThemeProtocolError('Expected a string');
  return value;
}

/** Decode one webview message as a theme request, or throw. */
export function decodeThemeRequest(value: unknown): ThemeRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ThemeProtocolError('Message must be an object');
  const input = value as Record<string, unknown>;
  switch (input.type) {
    case 'theme/ready':
    case 'theme/save':
    case 'theme/discard':
    case 'theme/undo':
    case 'theme/redo':
      exactKeys(input, ['type']);
      return { type: input.type };
    case 'theme/set':
      exactKeys(input, ['type', 'changes']);
      if (!isThemeChanges(input.changes)) throw new ThemeProtocolError('changes must be theme fields');
      return { type: 'theme/set', changes: input.changes };
    case 'theme/save-as':
      exactKeys(input, ['type', 'name', 'use']);
      if (typeof input.use !== 'boolean') throw new ThemeProtocolError('use must be a boolean');
      return { type: 'theme/save-as', name: stringOf(input.name, 200), use: input.use };
    case 'theme/open-deck': {
      exactKeys(input, ['type', 'path']);
      const path = stringOf(input.path, MAX_PATH_LENGTH);
      if (!/\.deck\.md$/i.test(path)) throw new ThemeProtocolError('path must be a deck');
      return { type: 'theme/open-deck', path };
    }
    case 'theme/undo-save':
      exactKeys(input, ['type', 'token']);
      return { type: 'theme/undo-save', token: stringOf(input.token, 64) };
    case 'theme/check-colours':
      exactKeys(input, ['type']);
      return { type: 'theme/check-colours' };
    case 'theme/change-undo':
      exactKeys(input, ['type', 'id']);
      return { type: 'theme/change-undo', id: stringOf(input.id, 64) };
    default:
      throw new ThemeProtocolError('Unknown theme request');
  }
}
