/**
 * Sprint 140 (R3, E2): the ready request's counts line, "144 files: 61 Word
 * documents, 38 PDFs, 22 spreadsheets, 9 text documents and 14 others", from
 * file names alone. Nothing here opens a file, reads its contents or asks for
 * its size, so a synced folder's online-only files stay online-only.
 *
 * `countsLine` is pure; `listFileNames` walks a folder with `readdir` and
 * entry types only. No `vscode` import.
 */

import * as fs from 'fs';
import * as path from 'path';

export type FileKind = 'word' | 'pdf' | 'spreadsheet' | 'presentation' | 'text' | 'picture' | 'other';

/** Past this many files the line reads "More than 10,000 files." */
export const COUNT_LIMIT = 10_000;

/** At most this many kinds are named; the rest are "others". */
const NAMED_KINDS = 4;

const EXTENSIONS: Record<string, FileKind> = {
  '.docx': 'word', '.doc': 'word', '.docm': 'word', '.dotx': 'word', '.odt': 'word', '.rtf': 'word', '.pages': 'word',
  '.pdf': 'pdf',
  '.xlsx': 'spreadsheet', '.xls': 'spreadsheet', '.xlsm': 'spreadsheet', '.csv': 'spreadsheet', '.tsv': 'spreadsheet', '.ods': 'spreadsheet', '.numbers': 'spreadsheet',
  '.pptx': 'presentation', '.ppt': 'presentation', '.odp': 'presentation', '.key': 'presentation',
  '.md': 'text', '.markdown': 'text', '.txt': 'text',
  '.png': 'picture', '.jpg': 'picture', '.jpeg': 'picture', '.gif': 'picture', '.webp': 'picture', '.heic': 'picture', '.svg': 'picture', '.tif': 'picture', '.tiff': 'picture', '.bmp': 'picture',
};

/** The kinds in the order a tie keeps them. */
const KIND_ORDER: readonly FileKind[] = ['word', 'pdf', 'spreadsheet', 'presentation', 'text', 'picture'];

const WORDS: Record<FileKind, [one: string, many: string]> = {
  word: ['Word document', 'Word documents'],
  pdf: ['PDF', 'PDFs'],
  spreadsheet: ['spreadsheet', 'spreadsheets'],
  presentation: ['presentation', 'presentations'],
  text: ['text document', 'text documents'],
  picture: ['picture', 'pictures'],
  other: ['other', 'others'],
};

export function fileKindOf(name: string): FileKind {
  return EXTENSIONS[path.extname(name).toLowerCase()] ?? 'other';
}

function phrase(kind: FileKind, count: number): string {
  return `${count} ${WORDS[kind][count === 1 ? 0 : 1]}`;
}

function joinWords(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The line for a list of file names: the total, then at most four kinds, the
 * most numerous first, and the rest as "others", last. `more` says the walk
 * stopped past the limit. Ends with a full stop.
 */
export function countsLine(names: readonly string[], more = false): string {
  if (more || names.length > COUNT_LIMIT) return 'More than 10,000 files.';
  const counts = new Map<FileKind, number>();
  for (const name of names) {
    const kind = fileKindOf(name);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const known = KIND_ORDER.filter((kind) => (counts.get(kind) ?? 0) > 0)
    .sort((a, b) => (counts.get(b)! - counts.get(a)!) || KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
  const named = known.slice(0, NAMED_KINDS);
  const others = names.length - named.reduce((sum, kind) => sum + counts.get(kind)!, 0);
  const parts = named.map((kind) => phrase(kind, counts.get(kind)!));
  if (others > 0 && parts.length > 0) parts.push(phrase('other', others));
  const total = `${names.length} ${names.length === 1 ? 'file' : 'files'}`;
  return parts.length ? `${total}: ${joinWords(parts)}.` : `${total}.`;
}

export interface ListOptions {
  /** Stop after this many names (the line then says "More than…"). */
  limit?: number;
  /** Root-level files to leave out, by name (Ritemark's pointer CLAUDE.md). */
  skipAtRoot?: ReadonlySet<string>;
}

/**
 * The names of a project's files, from directory entries only: no `stat`, no
 * open, so nothing is downloaded. Ritemark's `.ritemark/`, hidden files and
 * folders and `node_modules` are left out. A symbolic link (and, on Windows, a
 * cloud placeholder, which reads as one) counts by its name and is never
 * followed.
 */
export async function listFileNames(root: string, options: ListOptions = {}): Promise<{ names: string[]; more: boolean }> {
  const limit = options.limit ?? COUNT_LIMIT;
  const names: string[] = [];
  const queue: string[] = [root];
  while (queue.length > 0) {
    const dir = queue.shift()!;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory()) {
        queue.push(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile() && !entry.isSymbolicLink()) continue;
      if (dir === root && options.skipAtRoot?.has(entry.name)) continue;
      names.push(entry.name);
      if (names.length > limit) return { names, more: true };
    }
  }
  return { names, more: false };
}
