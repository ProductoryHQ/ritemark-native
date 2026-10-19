/**
 * Try the sample project (Sprint 133, R5, W5): copy Ritemark's sample, a small
 * leadership programme, into `<Documents>/Ritemark/Leadership programme`.
 * The person works on their copy; Ritemark's own stays as shipped. A folder of
 * that name that is already there is never written into: the copy takes the
 * next free name. No `vscode` import; the file system is injected.
 */

import * as path from 'path';
import { parseCardFile, serializeCard } from '../taskBoard/cardFile';

export const SAMPLE_PROJECT_NAME = 'Leadership programme';
/** Inside the extension. */
export const SAMPLE_PROJECT_SOURCE = path.join('sample-project', SAMPLE_PROJECT_NAME);

export interface SampleFs {
  mkdir(target: string, options?: { recursive?: boolean }): Promise<unknown>;
  readdir(target: string): Promise<Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>>;
  copyFile(from: string, to: string, mode?: number): Promise<void>;
  readFile(target: string): Promise<string>;
  writeFile(target: string, text: string): Promise<void>;
  exists(target: string): Promise<boolean>;
}

/** COPYFILE_EXCL: never write over a file. */
const COPY_EXCL = 1;

/** "Leadership programme", then "Leadership programme 2", "… 3". */
export function candidateName(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base} ${attempt}`;
}

export type SampleCopyResult = { ok: true; folder: string } | { ok: false; message: string };

const FAILED = 'Ritemark couldn’t copy the sample project. Try again, or open a folder of your own.';

/**
 * Copy the sample into `parent`, under the first free name, then set the
 * cards' placeholder dates to the time of copying (through the board's own
 * parser and writer), so the board doesn't show them as months old.
 */
export async function copySampleProject(input: {
  fs: SampleFs;
  source: string;
  parent: string;
  now: Date;
  maxAttempts?: number;
}): Promise<SampleCopyResult> {
  const { fs, source, parent } = input;
  let target: string | null = null;
  try {
    await fs.mkdir(parent, { recursive: true });
    for (let attempt = 1; attempt <= (input.maxAttempts ?? 50); attempt += 1) {
      const candidate = path.join(parent, candidateName(SAMPLE_PROJECT_NAME, attempt));
      if (await fs.exists(candidate)) continue;
      try {
        // Not recursive: a folder that appeared meanwhile fails here, and the next name is tried.
        await fs.mkdir(candidate);
        target = candidate;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue;
        throw error;
      }
    }
    if (!target) return { ok: false, message: FAILED };
    await copyTree(fs, source, target);
    await stampCards(fs, path.join(target, '.ritemark', 'tasks'), input.now.toISOString());
    return { ok: true, folder: target };
  } catch {
    return { ok: false, message: FAILED };
  }
}

async function copyTree(fs: SampleFs, from: string, to: string): Promise<void> {
  for (const entry of await fs.readdir(from)) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(target);
      await copyTree(fs, source, target);
    } else if (entry.isFile()) {
      await fs.copyFile(source, target, COPY_EXCL);
    }
  }
}

/** Set every card's `created` and `updated` to the copy's time. A file that is not a card is left as it is. */
async function stampCards(fs: SampleFs, tasksFolder: string, nowIso: string): Promise<void> {
  if (!(await fs.exists(tasksFolder))) return;
  for (const entry of await fs.readdir(tasksFolder)) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const file = path.join(tasksFolder, entry.name);
    const parsed = parseCardFile(await fs.readFile(file));
    if (parsed.kind !== 'card') continue;
    await fs.writeFile(file, serializeCard({ ...parsed.card, created: nowIso, updated: nowIso }, parsed.source));
  }
}
