import * as path from 'path';
import { kindOf } from '../publish/gather';
import { cssReferences, pageReferences } from '../publish/references';
import { deckNameOf, deckPictureFolderName, isDeckPath, DECK_EXTENSION, LEGACY_DECK_EXTENSION } from './deckFileName';
import { folderOf, isRelativeTarget, movedTarget, normalizePath, placeAfterMoves, projectPath, rewriteDeckPictures } from './deckLibraryFormat';
import { PAGE_FONT_FOLDER, readPageMeta } from './page/pageFile';

export type DeckMove = { from: string; to: string };
export type DeletedDeck = { file: string; text: string | undefined };
export type CopyDeckFolder = (from: string, to: string) => Promise<boolean>;

export interface DeckFolderFiles {
  kind(file: string): Promise<'file' | 'folder' | 'other' | undefined>;
  siblingDecks(dir: string): Promise<string[]>;
  readDeck(file: string): Promise<string>;
  listFolder(folder: string): AsyncIterable<{ name: string; kind: 'file' | 'folder' | 'other' }>;
  readPage(file: string): Promise<string>;
  sameFolder?(from: string, to: string): Promise<boolean>;
  rename(from: string, to: string): Promise<void>;
  trash(folder: string): Promise<void>;
  copy: CopyDeckFolder;
  notice(message: string, level: 'information' | 'warning'): void;
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
  rewriteDeckPictures(text, visit, includeLinks);
  return files;
}

function linksInto(files: Iterable<string>, folder: string): boolean {
  for (const file of files) if (inside(file, folder)) return true;
  return false;
}

const FOLDER_ENTRY_LIMIT = 500;
const OS_CLUTTER = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const OTHER_FILES = "it holds more than the deck's pictures and published page.";

async function deckFolderOwnership(
  deck: string, text: string, folder: string, fs: DeckFolderFiles,
): Promise<'unlinked' | 'foreign' | 'owned'> {
  const linked = linkedFiles(text, folderOf(deck), true);
  let linkedIntoFolder = linksInto(linked, folder);
  const owned = new Set([...linked].filter(file => kindOf(file) === 'picture'));

  const files = new Set<string>();
  const pending = [folder];
  let count = 0;
  let hasOtherEntries = false;
  try {
    while (pending.length) {
      const dir = pending.pop()!;
      for await (const entry of fs.listFolder(dir)) {
        if (++count > FOLDER_ENTRY_LIMIT) return linkedIntoFolder ? 'foreign' : 'unlinked';
        const file = dir + '/' + entry.name;
        if (entry.kind === 'folder') pending.push(file);
        else if (entry.kind === 'file') files.add(file);
        else hasOtherEntries = true;
      }
    }

    for (const page of files) {
      if (folderOf(page) !== folder || path.posix.extname(page).toLowerCase() !== '.html') continue;
      const html = await fs.readPage(page);
      if (!readPageMeta(html).ritemark) continue;
      linkedIntoFolder = true;
      owned.add(page);
      const { refs, inlineCss } = pageReferences(html);
      for (const ref of [...refs, ...inlineCss.flatMap(cssReferences)]) {
        if (ref.as !== 'picture' && ref.as !== 'any') continue;
        if (!isRelativeTarget(ref.value)) continue;
        const address = ref.value.split(/[?#]/, 1)[0];
        if (/%(?:2f|5c)/i.test(address)) continue;
        const file = normalizePath(folder + '/' + decodeURIComponent(address));
        if (file === null || !inside(file, folder)) continue;
        const kind = kindOf(file);
        if (kind === 'picture' || (kind === 'font' && inside(file, folder + '/' + PAGE_FONT_FOLDER))) owned.add(file);
      }
    }
    if (!linkedIntoFolder) return 'unlinked';
    return !hasOtherEntries && [...files].every(file => owned.has(file) || OS_CLUTTER.has(path.posix.basename(file))) ? 'owned' : 'foreign';
  } catch {
    // Without a claim on the folder the deck says nothing, as it does for a folder it never linked into.
    return linkedIntoFolder ? 'foreign' : 'unlinked';
  }
}

export async function followDeckMoves(
  moves: readonly DeckMove[],
  decks: readonly DeckMove[],
  fs: DeckFolderFiles,
): Promise<DeckMove[]> {
  const result = [...moves];
  const reported = new Set<string>();
  const stayed = (folder: string, reason: string, level: 'information' | 'warning' = 'information') => {
    if (reported.has(folder)) return;
    reported.add(folder);
    fs.notice(`“${path.posix.basename(folder)}” stayed where it was, because ${reason}`, level);
  };
  for (const deck of decks) {
    if (!isDeckPath(deck.from) || !isDeckPath(deck.to)) continue;
    const from = ownDeckFolder(deck.from);
    const to = ownDeckFolder(deck.to);
    if (from === to || result.some(move => move.from === from || inside(from, move.from))) continue;
    if (await fs.kind(from) !== 'folder') continue;
    const text = await fs.readDeck(deck.to).catch(() => undefined);
    if (text === undefined) continue;
    const ownership = await deckFolderOwnership(deck.from, text, from, fs);
    if (ownership === 'unlinked') continue;
    if (inside(deck.to, from)) {
      stayed(from, 'the deck was moved into it.');
    } else if (ownership === 'foreign') {
      stayed(from, OTHER_FILES, 'information');
    } else if (await fs.kind(to) && !(await fs.sameFolder?.(from, to))) {
      stayed(from, `“${path.posix.basename(to)}” is already there. The deck's pictures still show.`);
    } else {
      try {
        await fs.rename(from, to);
        result.push({ from, to });
      } catch {
        stayed(from, "it couldn't be moved. The deck's pictures still show.", 'warning');
      }
    }
  }
  return result;
}

export async function trashDeckFolders(decks: readonly DeletedDeck[], deleted: readonly string[], fs: DeckFolderFiles): Promise<void> {
  const handled = new Set<string>();
  const unreadableFolders = new Set(decks.filter(deck => deck.text === undefined).map(deck => ownDeckFolder(deck.file)));
  for (const { file: deck, text } of decks) {
    const folder = ownDeckFolder(deck);
    if (text === undefined || unreadableFolders.has(folder) || handled.has(folder) ||
        deleted.some(file => file === folder || inside(folder, file))) continue;
    if (await fs.kind(folder) !== 'folder') continue;
    const ownership = await deckFolderOwnership(deck, text, folder, fs);
    if (ownership === 'unlinked') continue;
    handled.add(folder);
    const name = path.posix.basename(folder);
    if (ownership === 'foreign') {
      fs.notice(`“${name}” stayed where it was, because ${OTHER_FILES}`, 'information');
      continue;
    }
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
      fs.notice(`“${name}” stayed where it was, because it couldn't be moved to the Trash.`, 'warning');
      continue;
    }
    fs.notice(`“${name}” went to the Trash with the deck.`, 'information');
  }
}

export interface CreatedDeckFiles extends DeckFolderFiles {
  findFiles(glob: string, limit: number): Promise<string[]>;
  readBytes(file: string): Promise<Buffer>;
  resolves(file: string): Promise<boolean>;
  log(message: string): void;
}

const COPY_SEARCH_LIMIT = 32;

/** Recover the source of an Explorer copy, whose create event only names the destination. */
export async function copyCreatedDeckPictures(deck: string, text: string, fs: CreatedDeckFiles, bytes: Buffer): Promise<string> {
  const dir = folderOf(deck);
  const to = ownDeckFolder(deck);
  const stem = deckNameOf(deck);
  const originalStem = stem.replace(/ copy(?: [0-9]+)?$/, '');
  const links = new Set<string>();
  rewriteDeckPictures(text, target => {
    const file = projectPath(target, dir);
    if (file !== null) links.add(file);
    return target;
  }, true);
  if (!links.size) return text;

  // A duplicate beside the original already resolves its pictures. It still needs its own folder.
  const deckEndings = [DECK_EXTENSION, LEGACY_DECK_EXTENSION];
  const siblingFolders = deckEndings.map(ending => ownDeckFolder(path.posix.join(dir, originalStem + ending)));
  const needsOwnFolder = siblingFolders.some(folder => folder !== to && linksInto(links, folder)) && !(await fs.kind(to));
  const resolved = await Promise.all([...links].map(file => fs.resolves(file)));
  const hasMissingLinks = resolved.includes(false);
  if (!hasMissingLinks && !needsOwnFolder) return text;

  const stems = new Set([stem, originalStem]);
  const names = [...stems].flatMap(name => {
    const literal = name.replace(/[\[\]{}*?,]/g, char => `[${char}]`);
    return deckEndings.map(ending => literal + ending);
  });
  const candidates = await fs.findFiles(`**/{${names.join(',')}}`, COPY_SEARCH_LIMIT);
  const matches: string[] = [];
  // A full result set may hide another identical deck.
  let complete = candidates.length < COPY_SEARCH_LIMIT;
  if (complete) {
    for (const candidate of new Set(candidates)) {
      if (candidate === deck || !isDeckPath(candidate) || !stems.has(deckNameOf(candidate))) continue;
      const saved = await fs.readBytes(candidate).catch(() => null);
      if (!saved) {
        complete = false;
        break;
      }
      if (saved.equals(bytes)) matches.push(candidate);
      if (matches.length > 1) break;
    }
  }
  if (!complete || matches.length !== 1) {
    fs.log(`Could not identify a unique copy source for "${deck}".`);
    return text;
  }

  const source = matches[0];
  const sourceDir = folderOf(source);
  if (!hasMissingLinks && sourceDir !== dir) return text;
  const from = ownDeckFolder(source);
  const copied = from !== to && !inside(to, from) && await fs.copy(from, to);
  const after = placeAfterMoves(copied ? [{ from, to }] : []);
  return rewriteDeckPictures(text, target => movedTarget(target, sourceDir, dir, after), true);
}
