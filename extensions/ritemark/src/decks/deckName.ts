/**
 * A deck's file name (Sprint 159, deck icons): one rule for every place that names a file or picks its icon, with no
 * imports, so the host, the search worker and the webview all share it. Patch 018's `ritemarkSplitExtension` (Documents,
 * the tabs) follows the same rule in VS Code's own code.
 */

/** A deck's extension, as ".md" is a document's. */
export const DECK_EXTENSION = '.deck.md';

/**
 * A deck's file name ends `.deck.md`, in any case, after a name of its own. A file named only `.deck.md` is a dotfile,
 * as `.gitignore` is, not a deck with an empty name.
 */
export function isDeckPath(fsPath: string): boolean {
  return /[^\\/]\.deck\.md$/i.test(fsPath);
}

/**
 * A file name as the lists show it: the name, and the extension drawn muted. A deck's extension is the whole
 * `.deck.md`; any other file's is from its last dot. A name with no dot, or only a leading one, has no extension.
 */
export function splitFileName(fileName: string): { name: string; extension: string } {
  const dot = isDeckPath(fileName) ? fileName.length - DECK_EXTENSION.length : fileName.lastIndexOf('.');
  return dot > 0 ? { name: fileName.slice(0, dot), extension: fileName.slice(dot) } : { name: fileName, extension: '' };
}
