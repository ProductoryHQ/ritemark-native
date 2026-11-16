/**
 * A deck's file name (Sprint 159, deck icons): one rule for every place that names a file or picks its icon, with no
 * imports, so the host, the search worker and the webview all share it. Patch 018's `ritemarkSplitExtension` (Documents,
 * the tabs) splits names the same way in VS Code's own code, and the file icon theme's `deck.md` association gives the
 * same files the easel.
 */

/** A deck's extension, as ".md" is a document's. */
export const DECK_EXTENSION = '.deck.md';

/** A deck's file name ends `.deck.md`, in any case: the files that open as decks, and that show the easel. */
export function isDeckPath(fsPath: string): boolean {
  return /\.deck\.md$/i.test(fsPath);
}

/**
 * A file name as the lists show it: the name, and the extension drawn muted. A deck's extension is the whole
 * `.deck.md`, once there is a name before it; any other file's is from its last dot. A name with no dot, only a
 * leading one, or a trailing one, has no extension. So a file named only `.deck.md` reads ".deck" + ".md", as a
 * dotfile does.
 */
export function splitFileName(fileName: string): { name: string; extension: string } {
  const deck = isDeckPath(fileName) ? fileName.length - DECK_EXTENSION.length : 0;
  const dot = deck > 0 ? deck : fileName.lastIndexOf('.');
  return dot > 0 && dot < fileName.length - 1 ? { name: fileName.slice(0, dot), extension: fileName.slice(dot) } : { name: fileName, extension: '' };
}
