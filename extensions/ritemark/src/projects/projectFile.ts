/**
 * Sprint 134 (R1, W1): a project's own details, `.ritemark/project.json`.
 *
 * The folder holds what the person changed: the line under the project's
 * name and a cover picture of their own. Nothing is written until they change
 * something; until then the folder's name, initials from it and Ritemark's
 * cover are used. A file Ritemark can't read is never written over, and keys
 * it doesn't know are kept.
 *
 * The name and the mark are the folder's in this sprint: nothing lets a person
 * change them, and the left column's head (patch 018) draws the folder's name
 * with the same initials rule. A `name` or `mark` in the file is kept as it is.
 *
 * No `vscode` import: the file system is injected, so every rule is tested.
 */

import { promises as fsp } from 'fs';
import * as path from 'path';

export const PROJECT_FILE_VERSION = 'project/1';
export const PROJECT_LINE_LIMIT = 200;
/** A picture larger than this is refused rather than copied into the folder. */
export const COVER_SIZE_LIMIT = 10 * 1024 * 1024;
export const COVER_EXTENSIONS: readonly string[] = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

export interface ProjectFileFs {
  readFile(target: string): Promise<Uint8Array>;
  writeFile(target: string, data: Uint8Array): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  /** Never recursive: a project folder that has gone must stay gone (R13). */
  mkdir(target: string): Promise<void>;
  readdir(target: string): Promise<string[]>;
  unlink(target: string): Promise<void>;
  stat(target: string): Promise<{ size: number; isDirectory: boolean }>;
}

export interface ProjectDetails {
  name: string;
  mark: string;
  /** The person's line about the project; empty when they wrote none. */
  line: string;
  /** The cover's file name inside `.ritemark/`, or null for Ritemark's own. */
  cover: string | null;
  /** The file is there but Ritemark can't read it; it is left as it is. */
  unreadable: boolean;
}

export type ProjectWriteResult =
  | { ok: true; details: ProjectDetails }
  | { ok: false; reason: 'unreadable' | 'not-writable' | 'gone' | 'not-an-image' | 'too-large'; message: string };

const WORDS = {
  unreadable: 'Ritemark can’t read this project’s settings file (.ritemark/project.json), so it left the file as it is and didn’t save the change.',
  notWritable: 'Ritemark couldn’t save the change: this project’s folder can’t be written to.',
  gone: 'Ritemark couldn’t save the change: this project’s folder is not where it was.',
  notAnImage: 'Choose a JPEG, PNG, WebP or GIF picture.',
  tooLarge: 'That picture is larger than 10 MB. Choose a smaller one.',
};

/**
 * "Harbour leadership programme" → "HL", "Notes" → "NO": two letters, as patch 018's head (`ritemarkProjectInitials`)
 * and the welcome (`projectMark`) draw them, one rule everywhere.
 */
export function projectInitials(name: string): string {
  const words = name.split(/[\s:_-]+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  const letters = (word: string) => [...word.replace(/[^\p{L}\p{N}]/gu, '')];
  const mark = words.length >= 2 ? (letters(words[0])[0] ?? '') + (letters(words[1])[0] ?? '') : letters(words[0] ?? '').slice(0, 2).join('');
  return mark.toUpperCase() || '·';
}

/** One line, at most {@link PROJECT_LINE_LIMIT} characters, cut at a word where it can be. */
export function cleanProjectLine(raw: string): string {
  const line = raw.replace(/\s+/g, ' ').trim();
  if ([...line].length <= PROJECT_LINE_LIMIT) return line;
  const cut = [...line].slice(0, PROJECT_LINE_LIMIT).join('');
  const space = cut.lastIndexOf(' ');
  return (space > PROJECT_LINE_LIMIT * 0.6 ? cut.slice(0, space) : cut).trimEnd();
}

function projectDir(folder: string): string {
  return path.join(folder, '.ritemark');
}

function projectFilePath(folder: string): string {
  return path.join(projectDir(folder), 'project.json');
}

function code(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

/** A cover named in the file: a plain file name inside `.ritemark/`, never a path out of it. */
function safeCoverName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // The proof of concept wrote ".ritemark/cover.jpg"; this sprint writes "cover.jpg".
  const name = value.replace(/\\/g, '/').replace(/^\.ritemark\//, '');
  if (!name || name.includes('/') || name === '.' || name === '..') return null;
  if (!COVER_EXTENSIONS.includes(path.extname(name).toLowerCase())) return null;
  return name;
}

type Parsed =
  | { kind: 'missing' }
  | { kind: 'unreadable' }
  | { kind: 'read'; data: Record<string, unknown> };

async function readParsed(fs: ProjectFileFs, folder: string): Promise<Parsed> {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await fs.readFile(projectFilePath(folder)));
  } catch (error) {
    if (code(error) === 'ENOENT' || code(error) === 'ENOTDIR') return { kind: 'missing' };
    return { kind: 'unreadable' };
  }
  try {
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { kind: 'unreadable' };
    const record = data as Record<string, unknown>;
    // No version is the proof of concept's file; any other version is a newer Ritemark's.
    if (record.ritemark !== undefined && record.ritemark !== PROJECT_FILE_VERSION) return { kind: 'unreadable' };
    return { kind: 'read', data: record };
  } catch {
    return { kind: 'unreadable' };
  }
}

function detailsFrom(parsed: Parsed, folderName: string): ProjectDetails {
  const data = parsed.kind === 'read' ? parsed.data : {};
  const rawLine = typeof data.line === 'string' ? data.line : typeof data.about === 'string' ? data.about : '';
  return {
    name: folderName,
    mark: projectInitials(folderName),
    line: cleanProjectLine(rawLine),
    cover: safeCoverName(data.cover),
    unreadable: parsed.kind === 'unreadable',
  };
}

/** The project's details: its file's when it reads, the folder's defaults otherwise. Writes nothing. */
export async function readProject(fs: ProjectFileFs, folder: string, folderName = path.basename(folder)): Promise<ProjectDetails> {
  return detailsFrom(await readParsed(fs, folder), folderName);
}

async function writeAtomically(fs: ProjectFileFs, target: string, data: Uint8Array, randomId: () => string): Promise<void> {
  const temp = `${target}.tmp-${randomId()}`;
  await fs.writeFile(temp, data);
  try {
    await fs.rename(temp, target);
  } catch (error) {
    await fs.unlink(temp).catch(() => undefined);
    throw error;
  }
}

/** `.ritemark/` inside a folder that is still there; never the folder itself (R13). */
async function ensureProjectDir(fs: ProjectFileFs, folder: string): Promise<void> {
  const stat = await fs.stat(folder);
  if (!stat.isDirectory) throw Object.assign(new Error('not a folder'), { code: 'ENOTDIR' });
  try {
    await fs.mkdir(projectDir(folder));
  } catch (error) {
    if (code(error) !== 'EEXIST') throw error;
  }
}

function failure(error: unknown): ProjectWriteResult {
  const c = code(error);
  if (c === 'ENOENT' || c === 'ENOTDIR') return { ok: false, reason: 'gone', message: WORDS.gone };
  return { ok: false, reason: 'not-writable', message: WORDS.notWritable };
}

interface WriteOptions {
  folderName?: string;
  randomId?: () => string;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function changeProject(
  fs: ProjectFileFs,
  folder: string,
  change: (data: Record<string, unknown>) => Record<string, unknown> | null,
  options: WriteOptions,
): Promise<ProjectWriteResult> {
  const folderName = options.folderName ?? path.basename(folder);
  const parsed = await readParsed(fs, folder);
  if (parsed.kind === 'unreadable') return { ok: false, reason: 'unreadable', message: WORDS.unreadable };
  const before = parsed.kind === 'read' ? parsed.data : {};
  const after = change({ ...before });
  if (!after) return { ok: true, details: detailsFrom(parsed, folderName) };
  // The version first, then the rest in their order (unknown keys kept).
  const next: Record<string, unknown> = { ritemark: PROJECT_FILE_VERSION, ...after };
  try {
    await ensureProjectDir(fs, folder);
    await writeAtomically(fs, projectFilePath(folder), new TextEncoder().encode(`${JSON.stringify(next, null, 2)}\n`), options.randomId ?? randomSuffix);
  } catch (error) {
    return failure(error);
  }
  return { ok: true, details: detailsFrom({ kind: 'read', data: next }, folderName) };
}

/** Change the line. An unchanged line writes nothing; an empty one removes it. */
export function setProjectLine(fs: ProjectFileFs, folder: string, raw: string, options: WriteOptions = {}): Promise<ProjectWriteResult> {
  const line = cleanProjectLine(raw);
  return changeProject(fs, folder, (data) => {
    const current = typeof data.line === 'string' ? cleanProjectLine(data.line) : typeof data.about === 'string' ? cleanProjectLine(data.about) : '';
    if (current === line && data.about === undefined) return null;
    delete data.about;
    if (line) data.line = line;
    else delete data.line;
    return data;
  }, options);
}

/**
 * Copy a picture into `.ritemark/cover.<ext>` and name it in the file, so the
 * cover travels with the folder. The original stays where it is. An earlier
 * cover of another kind is removed once the new one is saved.
 */
export async function setProjectCover(fs: ProjectFileFs, folder: string, source: string, options: WriteOptions = {}): Promise<ProjectWriteResult> {
  const extension = path.extname(source).toLowerCase();
  if (!COVER_EXTENSIONS.includes(extension)) return { ok: false, reason: 'not-an-image', message: WORDS.notAnImage };
  const parsed = await readParsed(fs, folder);
  if (parsed.kind === 'unreadable') return { ok: false, reason: 'unreadable', message: WORDS.unreadable };
  let bytes: Uint8Array;
  try {
    const stat = await fs.stat(source);
    if (stat.size > COVER_SIZE_LIMIT) return { ok: false, reason: 'too-large', message: WORDS.tooLarge };
    bytes = await fs.readFile(source);
  } catch {
    return { ok: false, reason: 'not-an-image', message: WORDS.notAnImage };
  }
  const coverName = `cover${extension === '.jpeg' ? '.jpg' : extension}`;
  const randomId = options.randomId ?? randomSuffix;
  try {
    await ensureProjectDir(fs, folder);
    await writeAtomically(fs, path.join(projectDir(folder), coverName), bytes, randomId);
  } catch (error) {
    return failure(error);
  }
  const result = await changeProject(fs, folder, (data) => {
    data.cover = coverName;
    return data;
  }, { ...options, randomId });
  if (!result.ok) return result;
  // Earlier covers of another kind go once the new one is named.
  try {
    for (const name of await fs.readdir(projectDir(folder))) {
      if (name !== coverName && /^cover\.[a-z]+$/i.test(name) && COVER_EXTENSIONS.includes(path.extname(name).toLowerCase())) {
        await fs.unlink(path.join(projectDir(folder), name)).catch(() => undefined);
      }
    }
  } catch {
    // An old cover left behind is harmless.
  }
  return result;
}

/** Node's file system, for the extension host. */
export function nodeProjectFileFs(): ProjectFileFs {
  return {
    readFile: async (target) => new Uint8Array(await fsp.readFile(target)),
    writeFile: (target, data) => fsp.writeFile(target, data),
    rename: (from, to) => fsp.rename(from, to),
    mkdir: async (target) => {
      await fsp.mkdir(target);
    },
    readdir: (target) => fsp.readdir(target),
    unlink: (target) => fsp.unlink(target),
    stat: async (target) => {
      const stat = await fsp.stat(target);
      return { size: stat.size, isDirectory: stat.isDirectory() };
    },
  };
}
