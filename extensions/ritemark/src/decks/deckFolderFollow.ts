import * as path from 'path';
import { deckPictureFolderName, isDeckPath } from './deckFileName';
import { folderOf, movedTarget, placeAfterMoves, projectPath, rewriteDeckPictures, rewriteMarkdownTargets } from './deckLibraryFormat';

export type DeckMove = { from: string; to: string };
export type CopyDeckFolder = (from: string, to: string) => Promise<boolean>;

export interface DeckFolderFiles {
  kind(file: string): Promise<'file' | 'folder' | 'other' | undefined>;
  siblingDecks(dir: string): Promise<string[]>;
  readDeck(file: string): Promise<string>;
  sameFolder?(from: string, to: string): Promise<boolean>;
  rename(from: string, to: string): Promise<void>;
  trash(folder: string): Promise<void>;
  copy: CopyDeckFolder;
  notice(message: string): void;
}

export function ownDeckFolder(deck: string): string {
  const parent = folderOf(deck);
  return (parent ? parent + '/' : '') + deckPictureFolderName(deck);
}

const inside = (file: string, folder: string) => file.startsWith(folder + '/');

function linkedFiles(text: string, dir: string, includeLinks = false): Set<string> {
  const files = new Set<string>();
  const visit = (target: string) => {
    const file = projectPath(target, dir);
    if (file !== null) files.add(file);
    return target;
  };
  rewriteDeckPictures(text, visit);
  if (includeLinks) rewriteMarkdownTargets(text, visit);
  return files;
}

function linksInto(files: Iterable<string>, folder: string): boolean {
  for (const file of files) if (inside(file, folder)) return true;
  return false;
}

export async function followDeckMoves(
  moves: readonly DeckMove[],
  decks: readonly DeckMove[],
  fs: DeckFolderFiles,
): Promise<DeckMove[]> {
  const result = [...moves];
  const reported = new Set<string>();
  const stayed = (folder: string, reason: string) => {
    if (reported.has(folder)) return;
    reported.add(folder);
    fs.notice(`${path.posix.basename(folder)} stayed where it was, because ${reason}.`);
  };
  for (const deck of decks) {
    if (!isDeckPath(deck.from) || !isDeckPath(deck.to)) continue;
    const from = ownDeckFolder(deck.from);
    const to = ownDeckFolder(deck.to);
    if (from === to || result.some(move => move.from === from || inside(from, move.from))) continue;
    if (await fs.kind(from) !== 'folder') continue;
    if (inside(deck.to, from)) {
      stayed(from, 'the deck moved into it');
    } else if (await fs.kind(to) && !(await fs.sameFolder?.(from, to))) {
      stayed(from, 'that name is already taken at the destination');
    } else {
      try {
        await fs.rename(from, to);
        result.push({ from, to });
      } catch {
        stayed(from, 'it could not be moved');
      }
    }
  }
  return result;
}

export async function trashDeckFolders(decks: readonly string[], deleted: readonly string[], fs: DeckFolderFiles): Promise<void> {
  const handled = new Set<string>();
  for (const deck of decks) {
    const folder = ownDeckFolder(deck);
    if (handled.has(folder) || deleted.some(file => file === folder || inside(folder, file))) continue;
    handled.add(folder);
    if (await fs.kind(folder) !== 'folder') continue;
    const dir = folderOf(deck);
    let shared = false;
    for (const sibling of await fs.siblingDecks(dir)) {
      // A sibling that cannot be read might still use these files.
      const text = await fs.readDeck(sibling).catch(() => null);
      if (text === null || linksInto(linkedFiles(text, dir, true), folder)) {
        shared = true;
        break;
      }
    }
    if (shared) continue;
    try {
      await fs.trash(folder);
    } catch {
      fs.notice(`${path.posix.basename(folder)} stayed where it was, because it could not be moved to the Trash.`);
    }
  }
}

/** Text already written for the copy's directory, using the source's folder until the copy succeeds. */
export async function copyDeckPictures(text: string, source: string, deck: string, copy: CopyDeckFolder): Promise<string> {
  const from = ownDeckFolder(source);
  const to = ownDeckFolder(deck);
  const dir = folderOf(deck);
  if (from === to || !linksInto(linkedFiles(text, dir), from) || !(await copy(from, to))) return text;
  const after = placeAfterMoves([{ from, to }]);
  return rewriteDeckPictures(text, target => movedTarget(target, dir, dir, after));
}

export async function copyCreatedDeckPictures(deck: string, text: string, fs: DeckFolderFiles): Promise<string> {
  if (await fs.kind(ownDeckFolder(deck))) return text;
  const dir = folderOf(deck);
  const links = linkedFiles(text, dir);
  if (!links.size) return text;
  const siblings = new Map((await fs.siblingDecks(dir))
    .filter(sibling => ownDeckFolder(sibling) !== ownDeckFolder(deck))
    .map(sibling => [ownDeckFolder(sibling), sibling]));
  // A copy can link to more than one deck. Give it the first linked sibling's folder.
  const prefix = dir ? dir + '/' : '';
  const sources = new Set([...links].filter(file => file.startsWith(prefix)).map(file => prefix + file.slice(prefix.length).split('/')[0]));
  for (const folder of sources) {
    const source = siblings.get(folder);
    if (!source) continue;
    const next = await copyDeckPictures(text, source, deck, fs.copy);
    if (next !== text) return next;
  }
  return text;
}
