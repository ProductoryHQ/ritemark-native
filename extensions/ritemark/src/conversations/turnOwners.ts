/**
 * TurnOwners — which extension host runs which conversations (Sprint 130, W13).
 *
 * Every window has its own extension host, and all of them share the
 * conversation store. The startup sweep (`interruptTurnsLeftByRestart`)
 * records turns a crash left `working` as interrupted. Windows without a
 * folder share one scope, so the sweep must not touch a turn another window
 * is still running. A host claims a conversation when a turn in it becomes
 * active. The sweep leaves a conversation alone while a host that claimed it
 * still runs.
 *
 * One small file per host, `<pid>.json`, lists its claims. A file whose
 * process is gone is removed by the next host that reads it.
 */

import * as fs from 'fs';
import * as path from 'path';

export function turnOwnersDir(globalStoragePath: string): string {
  return path.join(globalStoragePath, 'conversations', 'owners');
}

/** A process that exists. EPERM means it exists and belongs to someone else. */
function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export class TurnOwners {
  private readonly claimed = new Set<string>();

  constructor(
    private readonly dir: string,
    private readonly pid: number = process.pid,
    private readonly isAlive: (pid: number) => boolean = processIsAlive,
  ) {}

  /**
   * This host runs a turn in the conversation. Written at once (and
   * synchronously), so another window's sweep sees it as soon as the turn's
   * record says `working`.
   */
  claim(conversationId: string): void {
    if (this.claimed.has(conversationId)) return;
    this.claimed.add(conversationId);
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const file = path.join(this.dir, `${this.pid}.json`);
      fs.writeFileSync(`${file}.tmp`, JSON.stringify([...this.claimed]));
      fs.renameSync(`${file}.tmp`, file);
    } catch (error) {
      console.warn('[Conversations] Could not record a running turn for other windows:', error);
    }
  }

  /** Another host that still runs has claimed the conversation. */
  isClaimedElsewhere(conversationId: string): boolean {
    let names: string[];
    try {
      names = fs.readdirSync(this.dir);
    } catch {
      return false;
    }
    for (const name of names) {
      const match = /^(\d+)\.json$/.exec(name);
      if (!match || Number(match[1]) === this.pid) continue;
      const file = path.join(this.dir, name);
      if (!this.isAlive(Number(match[1]))) {
        fs.rmSync(file, { force: true });
        continue;
      }
      try {
        const ids: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Array.isArray(ids) && ids.includes(conversationId)) return true;
      } catch {
        // A file mid-write or unreadable claims nothing.
      }
    }
    return false;
  }

  /** The host is going away: its claims go with it. */
  dispose(): void {
    fs.rmSync(path.join(this.dir, `${this.pid}.json`), { force: true });
  }
}
