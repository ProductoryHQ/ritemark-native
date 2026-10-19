/**
 * Sprint 134 (R8, W7): About this project.
 *
 * One file at the project's root, `AGENTS.md`, which Claude and Codex both
 * read, and a `CLAUDE.md` that only points to it (`@AGENTS.md`), so Claude
 * reads it too (Jarmo, 18 October). Ritemark shows it as "About this project".
 *
 * - An `AGENTS.md` or `CLAUDE.md` already in the folder is never written over.
 * - A folder's own `CLAUDE.md` changes only when the person clicks Add the
 *   line, which puts `@AGENTS.md` first and keeps every other byte.
 * - A `CLAUDE.md` whose whole content is `@AGENTS.md` is Ritemark's pointer;
 *   anything more is the person's own file.
 *
 * Names match without regard to case, as the Mac's and Windows' file systems
 * do: an `agents.md` is the file Claude and Codex read. No `vscode` import.
 * Research: docs/development/releases/v2.0.0/sprint-134-project-at-the-centre/
 *   research/about-file-audit.md
 */

import { promises as fsp } from 'fs';
import * as path from 'path';

export const ABOUT_FILE_NAME = 'AGENTS.md';
export const CLAUDE_FILE_NAME = 'CLAUDE.md';
export const POINTER_LINE = '@AGENTS.md';
export const ABOUT_TITLE = 'About this project';
export const ABOUT_TOOLTIP = 'AGENTS.md, read by Claude and ChatGPT';
export const ABOUT_FILE_TEMPLATE = `# ${ABOUT_TITLE}\n\n`;

export interface AboutFileFs {
  readFile(target: string): Promise<Uint8Array>;
  readdir(target: string): Promise<string[]>;
  /** Fails with EEXIST when the file is there. */
  writeNew(target: string, data: Uint8Array): Promise<void>;
  /** Replaces the file in one step (a temporary file, then rename). */
  replace(target: string, data: Uint8Array): Promise<void>;
}

export type ClaudeFileState =
  /** No `CLAUDE.md`. */
  | 'none'
  /** Ritemark's pointer and nothing else. */
  | 'pointer'
  /** The person's own, with the `@AGENTS.md` line. */
  | 'with-line'
  /** The person's own, without it: About this project shows the note. */
  | 'own';

export interface AboutState {
  /** The root's About file, with its name as it is on disk, or null. */
  aboutPath: string | null;
  claudePath: string | null;
  claude: ClaudeFileState;
}

export type AboutResult =
  | { ok: true; path: string; created: boolean; wroteClaude: boolean }
  | { ok: false; reason: 'not-writable' | 'gone'; message: string };

export type AddLineResult = { ok: true; changed: boolean } | { ok: false; reason: 'missing' | 'not-writable'; message: string };

const WORDS = {
  notWritable: 'Ritemark couldn’t create About this project: this project’s folder can’t be written to.',
  gone: 'Ritemark couldn’t create About this project: this project’s folder is not where it was.',
  missing: 'This project’s CLAUDE.md is not there any more.',
  lineNotWritable: 'Ritemark couldn’t add the line: CLAUDE.md can’t be written to.',
};

function code(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

/** `@AGENTS.md` and nothing more, with surrounding whitespace, line endings and a byte-order mark ignored. */
export function isPointerOnly(text: string): boolean {
  return text.replace(/^﻿/, '').trim().toLowerCase() === POINTER_LINE.toLowerCase();
}

/** A `CLAUDE.md` that already imports About this project, on a line of its own. */
export function hasPointerLine(text: string): boolean {
  return text.replace(/^﻿/, '').split(/\r?\n/).some((line) => line.trim().toLowerCase() === POINTER_LINE.toLowerCase());
}

/** A root file by its name, whatever its case on disk. */
async function findAtRoot(fs: AboutFileFs, folder: string, name: string): Promise<string | null> {
  let names: string[];
  try {
    names = await fs.readdir(folder);
  } catch {
    return null;
  }
  const found = names.find((entry) => entry.toLowerCase() === name.toLowerCase());
  return found ? path.join(folder, found) : null;
}

export async function readAboutState(fs: AboutFileFs, folder: string): Promise<AboutState> {
  const [aboutPath, claudePath] = await Promise.all([findAtRoot(fs, folder, ABOUT_FILE_NAME), findAtRoot(fs, folder, CLAUDE_FILE_NAME)]);
  let claude: ClaudeFileState = 'none';
  if (claudePath) {
    try {
      const text = decode(await fs.readFile(claudePath));
      claude = isPointerOnly(text) ? 'pointer' : hasPointerLine(text) ? 'with-line' : 'own';
    } catch {
      // A CLAUDE.md that can't be read is the person's; the note would offer to change it.
      claude = 'own';
    }
  }
  return { aboutPath, claudePath, claude };
}

/** About this project shows the note when the folder has its own CLAUDE.md without the line. */
export function needsNote(state: AboutState): boolean {
  return state.claude === 'own';
}

/**
 * The menu's About this project, after the person chose Create (or when the
 * file is there): the root's `AGENTS.md`, written only when there is none, and
 * the pointer `CLAUDE.md` only when the folder has no `CLAUDE.md` at all.
 */
export async function createAboutFile(fs: AboutFileFs, folder: string): Promise<AboutResult> {
  const state = await readAboutState(fs, folder);
  if (state.aboutPath) return { ok: true, path: state.aboutPath, created: false, wroteClaude: false };
  const aboutPath = path.join(folder, ABOUT_FILE_NAME);
  try {
    await fs.writeNew(aboutPath, new TextEncoder().encode(ABOUT_FILE_TEMPLATE));
  } catch (error) {
    if (code(error) === 'EEXIST') return { ok: true, path: aboutPath, created: false, wroteClaude: false };
    if (code(error) === 'ENOENT' || code(error) === 'ENOTDIR') return { ok: false, reason: 'gone', message: WORDS.gone };
    return { ok: false, reason: 'not-writable', message: WORDS.notWritable };
  }
  let wroteClaude = false;
  if (!state.claudePath) {
    try {
      await fs.writeNew(path.join(folder, CLAUDE_FILE_NAME), new TextEncoder().encode(`${POINTER_LINE}\n`));
      wroteClaude = true;
    } catch {
      // Someone wrote one meanwhile, or it can't be written: the note covers it.
    }
  }
  return { ok: true, path: aboutPath, created: true, wroteClaude };
}

/**
 * Add the line: `@AGENTS.md` becomes the first line of the folder's own
 * `CLAUDE.md`; every other byte stays as it was. Re-read at the click, so a
 * change made since the note was drawn is kept.
 */
export async function addPointerLine(fs: AboutFileFs, folder: string): Promise<AddLineResult> {
  const claudePath = await findAtRoot(fs, folder, CLAUDE_FILE_NAME);
  if (!claudePath) return { ok: false, reason: 'missing', message: WORDS.missing };
  let bytes: Uint8Array;
  try {
    bytes = await fs.readFile(claudePath);
  } catch {
    return { ok: false, reason: 'missing', message: WORDS.missing };
  }
  const text = decode(bytes);
  if (hasPointerLine(text)) return { ok: true, changed: false };
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const newline = /\r\n/.test(text) ? '\r\n' : '\n';
  const line = new TextEncoder().encode(`${POINTER_LINE}${newline}`);
  const next = new Uint8Array(bytes.length + line.length);
  next.set(bytes.subarray(0, bom), 0);
  next.set(line, bom);
  next.set(bytes.subarray(bom), bom + line.length);
  try {
    await fs.replace(claudePath, next);
  } catch {
    return { ok: false, reason: 'not-writable', message: WORDS.lineNotWritable };
  }
  return { ok: true, changed: true };
}

/** True for the project root's About file (any case), never a subfolder's. */
export function isAboutFile(folder: string, filePath: string): boolean {
  return path.dirname(filePath) === folder && path.basename(filePath).toLowerCase() === ABOUT_FILE_NAME.toLowerCase();
}

/** True for the root's `CLAUDE.md`, which Home leaves out when it is the pointer. */
export function isRootClaudeFile(folder: string, filePath: string): boolean {
  return path.dirname(filePath) === folder && path.basename(filePath).toLowerCase() === CLAUDE_FILE_NAME.toLowerCase();
}

/** Node's file system, for the extension host. */
export function nodeAboutFileFs(): AboutFileFs {
  return {
    readFile: async (target) => new Uint8Array(await fsp.readFile(target)),
    readdir: (target) => fsp.readdir(target),
    writeNew: async (target, data) => {
      await fsp.writeFile(target, data, { flag: 'wx' });
    },
    replace: async (target, data) => {
      const temp = `${target}.tmp-${Math.random().toString(36).slice(2, 10)}`;
      await fsp.writeFile(temp, data);
      try {
        await fsp.rename(temp, target);
      } catch (error) {
        await fsp.unlink(temp).catch(() => undefined);
        throw error;
      }
    },
  };
}
