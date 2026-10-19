/**
 * Sprint 134 (R2, W2): the projects on this computer.
 *
 * Ritemark's own list, in `<globalStorage>/projects/v1/list.json`. A folder
 * joins it whenever a window opens it, and the first start of this build
 * fills it once from what the computer already has (`firstFill.ts`). A folder
 * that is not found stays in the list, marked, until the person finds it or
 * removes it (R13); Ritemark never drops one. The list holds folder addresses
 * only: no names, no counts, nothing that leaves the computer.
 *
 * Every window shares the file. Each change re-reads it, applies one change
 * and writes it back by temporary file and rename, so a window never writes
 * back another window's older copy.
 *
 * No `vscode` import: the file system is injected.
 */

import * as path from 'path';
import { normalizeProjectUri } from '../conversations/projectScope';

export const PROJECT_LIST_VERSION = 1 as const;

/** How a project joined: a window opened it, or the first fill found it in the recent list or the chats. */
export type ProjectFoundBy = 'opened' | 'recent' | 'chats';

export interface ProjectEntryV1 {
  /** The folder's `uri.toString()`, as the window that opened it had it. */
  folderUri: string;
  addedAt: string;
  /** When a window last opened it; the first fill's own time for a project it found. */
  lastOpenedAt: string;
  foundBy: ProjectFoundBy;
  /** Set while the folder is not found, with when Ritemark first missed it. */
  missingSince?: string;
}

export interface ProjectListFs {
  readFile(target: string): Promise<string>;
  writeFile(target: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  /** Recursive: the list lives in global storage, never in a project. */
  mkdir(target: string): Promise<void>;
}

export type RelocateResult = { ok: true } | { ok: false; reason: 'taken' | 'not-listed' };

function sameProject(a: string, b: string): boolean {
  try {
    return normalizeProjectUri(a) === normalizeProjectUri(b);
  } catch {
    return a === b;
  }
}

function decodeEntry(value: unknown): ProjectEntryV1 | null {
  const entry = value as Partial<ProjectEntryV1> | null;
  if (!entry || typeof entry.folderUri !== 'string' || typeof entry.addedAt !== 'string' || typeof entry.lastOpenedAt !== 'string') return null;
  const foundBy: ProjectFoundBy = ['opened', 'recent', 'chats'].includes(entry.foundBy as string) ? entry.foundBy as ProjectFoundBy : 'opened';
  try {
    if (!/^[a-z][a-z0-9+.-]*:/i.test(entry.folderUri)) return null;
    new URL(entry.folderUri);
  } catch {
    return null;
  }
  return {
    folderUri: entry.folderUri,
    addedAt: entry.addedAt,
    lastOpenedAt: entry.lastOpenedAt,
    foundBy,
    ...(typeof entry.missingSince === 'string' ? { missingSince: entry.missingSince } : {}),
  };
}

/** Most recently opened first. */
export function byLastOpened(a: ProjectEntryV1, b: ProjectEntryV1): number {
  return a.lastOpenedAt < b.lastOpenedAt ? 1 : a.lastOpenedAt > b.lastOpenedAt ? -1 : a.folderUri < b.folderUri ? -1 : 1;
}

export class ProjectList {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<() => void>();
  private readonly now: () => Date;
  private readonly randomId: () => string;

  constructor(
    private readonly file: string,
    private readonly fs: ProjectListFs,
    options: { now?: () => Date; randomId?: () => string } = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.randomId = options.randomId ?? (() => Math.random().toString(36).slice(2, 10));
  }

  static fileFor(globalStoragePath: string): string {
    return path.join(globalStoragePath, 'projects', 'v1', 'list.json');
  }

  onDidChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Every project, most recently opened first; the open one, when given, before all. */
  async entries(openFolderUri?: string): Promise<ProjectEntryV1[]> {
    await this.tail.catch(() => undefined);
    const entries = [...(await this.read()).entries].sort(byLastOpened);
    if (!openFolderUri) return entries;
    const open = entries.findIndex((entry) => sameProject(entry.folderUri, openFolderUri));
    if (open > 0) entries.unshift(...entries.splice(open, 1));
    return entries;
  }

  /** A window opened the folder: it joins the list, or comes first again, and is found. */
  opened(folderUri: string): Promise<void> {
    return this.change((entries) => {
      const at = this.now().toISOString();
      const existing = entries.find((entry) => sameProject(entry.folderUri, folderUri));
      if (existing) {
        existing.lastOpenedAt = at;
        delete existing.missingSince;
        return entries;
      }
      return [...entries, { folderUri, addedAt: at, lastOpenedAt: at, foundBy: 'opened' }];
    });
  }

  /** The first fill's projects: new ones join; ones already listed keep what they have. */
  addFound(found: readonly { folderUri: string; lastOpenedAt: string; foundBy: ProjectFoundBy }[]): Promise<void> {
    return this.change((entries) => {
      const at = this.now().toISOString();
      let changed = false;
      for (const project of found) {
        if (entries.some((entry) => sameProject(entry.folderUri, project.folderUri))) continue;
        entries.push({ folderUri: project.folderUri, addedAt: at, lastOpenedAt: project.lastOpenedAt, foundBy: project.foundBy });
        changed = true;
      }
      return changed ? entries : null;
    });
  }

  /** Remove from the list only: the folder, its chats and its board stay as they are. */
  remove(folderUri: string): Promise<void> {
    return this.change((entries) => {
      const next = entries.filter((entry) => !sameProject(entry.folderUri, folderUri));
      return next.length === entries.length ? null : next;
    });
  }

  /** Find it…: the project now lives at `to`. Refused when `to` is another project's. */
  async relocate(from: string, to: string): Promise<RelocateResult> {
    let result: RelocateResult = { ok: false, reason: 'not-listed' };
    await this.change((entries) => {
      const moving = entries.find((entry) => sameProject(entry.folderUri, from));
      if (!moving) return null;
      if (!sameProject(from, to) && entries.some((entry) => sameProject(entry.folderUri, to))) {
        result = { ok: false, reason: 'taken' };
        return null;
      }
      moving.folderUri = to;
      moving.lastOpenedAt = this.now().toISOString();
      delete moving.missingSince;
      result = { ok: true };
      return entries;
    });
    return result;
  }

  /**
   * Record which folders are found. `found` answers true, false, or undefined
   * when it couldn't tell (a slow network drive): those keep what they had.
   */
  async markFound(found: (folderUri: string) => Promise<boolean | undefined>): Promise<void> {
    const { entries } = await this.read();
    const answers = new Map<string, boolean | undefined>();
    await Promise.all(entries.map(async (entry) => answers.set(entry.folderUri, await found(entry.folderUri).catch(() => undefined))));
    await this.change((current) => {
      let changed = false;
      const at = this.now().toISOString();
      for (const entry of current) {
        const answer = answers.get(entry.folderUri);
        if (answer === true && entry.missingSince) {
          delete entry.missingSince;
          changed = true;
        } else if (answer === false && !entry.missingSince) {
          entry.missingSince = at;
          changed = true;
        }
      }
      return changed ? current : null;
    });
  }

  /** The list; `unreadable` when a file is there that this build can't read. */
  private async read(): Promise<{ entries: ProjectEntryV1[]; unreadable: boolean }> {
    let text: string;
    try {
      text = await this.fs.readFile(this.file);
    } catch {
      return { entries: [], unreadable: false };
    }
    try {
      const value = JSON.parse(text) as { schemaVersion?: unknown; entries?: unknown };
      if (value.schemaVersion !== PROJECT_LIST_VERSION || !Array.isArray(value.entries)) return { entries: [], unreadable: true };
      const entries: ProjectEntryV1[] = [];
      for (const raw of value.entries) {
        const entry = decodeEntry(raw);
        if (entry && !entries.some((other) => sameProject(other.folderUri, entry.folderUri))) entries.push(entry);
      }
      return { entries, unreadable: false };
    } catch {
      return { entries: [], unreadable: true };
    }
  }

  /**
   * One change, in order with this window's others: re-read, apply, write.
   * `apply` returns null when nothing changed, so nothing is written.
   */
  private change(apply: (entries: ProjectEntryV1[]) => ProjectEntryV1[] | null): Promise<void> {
    const run = this.tail.catch(() => undefined).then(async () => {
      const current = await this.read();
      const next = apply(current.entries);
      if (!next) return;
      await this.fs.mkdir(path.dirname(this.file));
      // A list this build can't read (a newer Ritemark's) is kept beside the new one, never lost.
      if (current.unreadable) await this.fs.rename(this.file, `${this.file}.unreadable-${this.now().getTime()}`).catch(() => undefined);
      const temp = `${this.file}.tmp-${this.randomId()}`;
      await this.fs.writeFile(temp, `${JSON.stringify({ schemaVersion: PROJECT_LIST_VERSION, entries: next }, null, 2)}\n`);
      await this.fs.rename(temp, this.file);
      for (const listener of this.listeners) listener();
    });
    this.tail = run;
    return run;
  }
}
