import * as path from 'path';
import { isPictureFile } from '../publish/fileKinds';
import { deckPictureFolderName, isDeckPath, deckFileOfPictureFolder } from './deckFileName';

/** The deck names in a directory determine which folders belong to decks. */
export function deckFolderNames(files: Iterable<string>): Set<string> {
  return new Set([...files].filter(isDeckPath).map(deckPictureFolderName));
}

function* candidateFolders(relative: string): Iterable<string> {
  const parts = relative.split('/');
  for (let index = 0; index < parts.length - 1; index++) {
    if (deckFileOfPictureFolder(parts[index])) yield parts.slice(0, index + 1).join('/');
  }
}

export function insideDeckFolder(relative: string, owned: ReadonlySet<string>): boolean {
  for (const folder of candidateFolders(relative)) {
    if (owned.has(folder)) return true;
  }
  return false;
}

/**
 * Ritemark's assets in an owned deck folder, by path alone.
 * Directory paths end in `/`, so only the top-level asset trees can be pruned.
 */
export function ritemarkFileInDeckFolder(relative: string, owned: ReadonlySet<string>): boolean {
  for (const folder of candidateFolders(relative)) {
    if (!owned.has(folder)) continue;
    const inside = relative.slice(folder.length + 1);
    if (inside.startsWith('fonts/') || inside.startsWith('logos/')) return true;
    if (!inside.endsWith('/') && (isPictureFile(inside) ||
      (!inside.includes('/') && path.posix.extname(inside).toLowerCase() === '.html'))) return true;
  }
  return false;
}

/** Check on disk, including siblings outside a caller's capped or filtered listing. */
export function deckFolderCheck(
  root: string,
  listFiles: (dir: string) => Promise<string[]>,
  matches = insideDeckFolder,
) {
  const listings = new Map<string, Promise<Set<string>>>();
  return async (relative: string): Promise<boolean> => {
    const owned = new Set<string>();
    for (const folder of candidateFolders(relative)) {
      const parent = path.posix.dirname(folder);
      let names = listings.get(parent);
      if (!names) {
        names = listFiles(path.join(root, parent)).then(deckFolderNames, () => new Set<string>());
        listings.set(parent, names);
      }
      if ((await names).has(path.posix.basename(folder))) owned.add(folder);
    }
    return matches(relative, owned);
  };
}

export function listedDeckFolders(files: Iterable<string>): Set<string> {
  return new Set([...files].filter(isDeckPath).map(file => {
    const parent = path.posix.dirname(file);
    return path.posix.join(parent, deckPictureFolderName(file));
  }));
}
