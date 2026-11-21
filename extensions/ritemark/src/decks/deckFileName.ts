/**
 * A deck's file name (Sprint 159, deck icons; Sprint 172, `.rtms`): the only place that knows what a deck's file is
 * called, with no imports, so the host, the search worker and the webview all share it. A new deck is `<name>.rtms`; a
 * deck made before 2.3 may end `.deck.md`, and is read the same way and never renamed. Patch 018's
 * `ritemarkSplitExtension` (Documents, the tabs) splits names the same way in VS Code's own code, and the file icon
 * theme's `rtms` and `deck.md` associations give the same files the deck icon.
 */

/** A new deck's extension, as ".md" is a document's. Every deck Ritemark makes ends so. */
export const DECK_EXTENSION = '.rtms';

/** The extension of a deck made before 2.3: read as a deck, never written for a new one. */
export const LEGACY_DECK_EXTENSION = '.deck.md';

/** Every deck in a folder, for `findFiles` and file watchers: both endings. */
export const DECK_GLOB = '**/*.{rtms,deck.md}';

/** The endings a deck may have, in any case. */
const DECK_ENDING = /(\.rtms|\.deck\.md)$/i;

/** A deck's file name ends `.rtms` or `.deck.md`, in any case: the files that open as decks, and that show the deck icon. */
export function isDeckPath(fsPath: string): boolean {
  return DECK_ENDING.test(fsPath);
}

/** A deck's name: its file name (or path, with `/` or `\`) without the deck's ending. Any other name is only its base. */
export function deckNameOf(fileName: string): string {
  const base = fileName.slice(Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\')) + 1);
  return base.replace(DECK_ENDING, '');
}

/** A new deck's file name: `<name>.rtms`. */
export function deckFileName(name: string): string {
  return `${name}${DECK_EXTENSION}`;
}

/**
 * A file name as the lists show it: the name, and the extension drawn muted. An old deck's extension is the whole
 * `.deck.md`, once there is a name before it; any other file's (a `.rtms` deck's too) is from its last dot. A name with
 * no dot, only a leading one, or a trailing one, has no extension. So a file named only `.deck.md` reads ".deck" +
 * ".md", and one named only `.rtms` has no extension, as a dotfile does.
 */
export function splitFileName(fileName: string): { name: string; extension: string } {
  const legacy = /\.deck\.md$/i.test(fileName) ? fileName.length - LEGACY_DECK_EXTENSION.length : 0;
  const dot = legacy > 0 ? legacy : fileName.lastIndexOf('.');
  return dot > 0 && dot < fileName.length - 1 ? { name: fileName.slice(0, dot), extension: fileName.slice(dot) } : { name: fileName, extension: '' };
}
