/**
 * Sprint 134 (W3): which project each running window holds.
 *
 * Every window has its own extension host, and they share one global storage.
 * A card's hand-off record says `running` after its window closed until that
 * project opens again (`CardHandoffLedger.recover`), so counting another
 * project needs to know whether a live window holds it. The same shape as
 * `conversations/turnOwners.ts`: one small file per host, `<pid>.json`, and a
 * file whose process is gone holds nothing.
 *
 * Research: docs/development/releases/v2.0.0/sprint-134-project-at-the-centre/
 *   research/waiting-audit.md §1
 */

import * as fs from 'fs';
import * as path from 'path';
import { processIsAlive } from '../conversations/turnOwners';

export function projectWindowsDir(globalStoragePath: string): string {
  return path.join(globalStoragePath, 'projects', 'v1', 'windows');
}

/** This window's claim on its project, written at activation and removed at dispose. */
export class ProjectWindow {
  constructor(
    private readonly dir: string,
    private readonly pid: number = process.pid,
  ) {}

  private get file(): string {
    return path.join(this.dir, `${this.pid}.json`);
  }

  hold(folderUri: string): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(`${this.file}.tmp`, JSON.stringify({ folderUri }));
      fs.renameSync(`${this.file}.tmp`, this.file);
    } catch (error) {
      console.warn('[Projects] Could not record this window’s project for other windows:', error);
    }
  }

  dispose(): void {
    fs.rmSync(this.file, { force: true });
  }
}

/** The folder URIs live windows hold. Reads only; a dead window's file is skipped. */
export function liveProjectWindows(
  dir: string,
  isAlive: (pid: number) => boolean = processIsAlive,
): Set<string> {
  const held = new Set<string>();
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return held;
  }
  for (const name of names) {
    const match = /^(\d+)\.json$/.exec(name);
    if (!match || !isAlive(Number(match[1]))) continue;
    try {
      const value: unknown = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      const folderUri = (value as { folderUri?: unknown } | null)?.folderUri;
      if (typeof folderUri === 'string') held.add(folderUri);
    } catch {
      // A file mid-write or unreadable holds nothing.
    }
  }
  return held;
}
