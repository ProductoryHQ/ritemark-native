/**
 * #887: the Slide library's Search row is the search field in its own place. The shell (patch 018,
 * `ritemarkProjectHead.ts`) draws the row and turns it into the field; its words and keys come to the row's command,
 * `ritemark.slideLibrary.search`, as Documents' box sends them (`{ text }`, `{ key: 'down' | 'enter' }`). The command
 * with nothing (⌘F in the place, an older shell's row) asks the shell for the caret in its field, and an older shell,
 * which has no such field, gets the place's own field as before.
 *
 * Pure, so the tests need no VS Code.
 */

/** The row's command, named in the frame's manifest (`branding/product.json`). */
export const LIBRARY_SEARCH_COMMAND = 'ritemark.slideLibrary.search';
/** The shell's field (patch 018): `{ focus: true }` puts the caret in it, `{ text }` sets its words; true when it did. */
export const SHELL_FIELD_COMMAND = '_ritemark.projectHead.field';
/** Set by the extension so the shell draws the row as the field; an older extension never sets it and keeps its own. */
export const LIBRARY_FIELD_CONTEXT_KEY = `${LIBRARY_SEARCH_COMMAND}.field`;
/** The words a search takes, at most. */
export const MAX_LIBRARY_SEARCH_CHARS = 200;

export type LibrarySearchRow =
  | { kind: 'text'; text: string; cut?: true }
  | { kind: 'results' }
  | { kind: 'focus' };

/** What the row's command was asked: the field's words, a key that goes to the results, or the caret in the field. */
export function librarySearchRow(arg: unknown): LibrarySearchRow {
  const value = arg && typeof arg === 'object' ? (arg as Record<string, unknown>) : {};
  if (typeof value.text === 'string') {
    // Words past the cap are cut; `cut` says so, so the shell's field can be given the words searched
    const text = value.text.slice(0, MAX_LIBRARY_SEARCH_CHARS);
    return text.length < value.text.length ? { kind: 'text', text, cut: true } : { kind: 'text', text };
  }
  if (value.key === 'down' || value.key === 'enter') return { kind: 'results' };
  return { kind: 'focus' };
}
