/**
 * Sprint 108 R12 — session storage.
 *
 * D5 (Jarmo, 2026-08-12): sessions live in the extension's global storage, not
 * in sidecar files next to the audio. This is the working copy; the document
 * the user saves (R11, folder of their choosing) is the artifact they own.
 *
 * File-backed rather than `Memento`-backed on purpose: a session carries
 * hundreds of segments plus ~2000 waveform peaks, which is too much to push
 * through `globalState` on every rename.
 *
 * Takes a plain directory path and touches no `vscode` API, so it is testable
 * against a temp dir.
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import type { TranscriptSession } from './types';

const SESSION_SUFFIX = '.session.json';

/**
 * Identity for a recording: path plus size and mtime.
 *
 * Deliberately not a content hash — hashing a 44 MB file on every open costs
 * more than it is worth, and this is only used to notice that the audio behind
 * a session changed or moved.
 */
export function fingerprintFile(filePath: string): string {
  const stat = fs.statSync(filePath);
  return `${stat.size}:${Math.floor(stat.mtimeMs)}`;
}

/** Stable id derived from the path, so reopening a file finds its session. */
export function sessionIdForPath(filePath: string): string {
  let hash = 0;
  const normalized = path.resolve(filePath);
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const base = path.basename(normalized).replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
  return `${base}-${(hash >>> 0).toString(36)}`;
}

export class SessionStore {
  constructor(private readonly baseDir: string) {}

  private file(sessionId: string): string {
    return path.join(this.baseDir, `${sessionId}${SESSION_SUFFIX}`);
  }

  private async ensureDir(): Promise<void> {
    await fsp.mkdir(this.baseDir, { recursive: true });
  }

  async save(session: TranscriptSession): Promise<void> {
    await this.ensureDir();
    const next: TranscriptSession = { ...session, updatedAt: new Date().toISOString() };
    // Write-then-rename: a crash mid-write must not leave a truncated session
    // where a working one used to be.
    const target = this.file(session.id);
    const temp = `${target}.tmp`;
    await fsp.writeFile(temp, JSON.stringify(next), 'utf-8');
    await fsp.rename(temp, target);
  }

  async get(sessionId: string): Promise<TranscriptSession | null> {
    try {
      const raw = await fsp.readFile(this.file(sessionId), 'utf-8');
      return JSON.parse(raw) as TranscriptSession;
    } catch {
      return null;
    }
  }

  /** The session for an audio file, if one exists. */
  async getForAudio(audioPath: string): Promise<TranscriptSession | null> {
    return this.get(sessionIdForPath(audioPath));
  }

  /**
   * The saved document for a recording, read synchronously.
   *
   * Sync because the AI sidebar resolves "the active file" on a hot path that
   * has no await to spare; a session file is a few hundred kilobytes at most.
   */
  getSavedDocumentSync(audioPath: string): string | null {
    try {
      const raw = fs.readFileSync(this.file(sessionIdForPath(audioPath)), 'utf-8');
      const session = JSON.parse(raw) as TranscriptSession;
      return session.exportPath && fs.existsSync(session.exportPath) ? session.exportPath : null;
    } catch {
      return null;
    }
  }

  async list(): Promise<TranscriptSession[]> {
    await this.ensureDir();
    const entries = await fsp.readdir(this.baseDir).catch(() => [] as string[]);
    const sessions: TranscriptSession[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(SESSION_SUFFIX)) continue;
      try {
        const raw = await fsp.readFile(path.join(this.baseDir, entry), 'utf-8');
        sessions.push(JSON.parse(raw) as TranscriptSession);
      } catch {
        // A single unreadable session must not hide the rest of the library.
      }
    }

    sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sessions;
  }

  /**
   * Sessions belonging to one project.
   *
   * The library is project-scoped: opening a different folder must not show
   * another project's recordings, even though the store itself is global.
   * A session recorded with no folder open belongs to the no-folder case.
   */
  async listForWorkspace(workspaceRoot: string | null): Promise<TranscriptSession[]> {
    const sessions = await this.listWithAudioState();
    return sessions.filter((session) => (session.workspaceRoot ?? null) === workspaceRoot);
  }

  /**
   * Mark sessions whose audio has moved or been deleted.
   *
   * R12: an unlinked session keeps its transcript. Losing the recording must
   * not silently lose the hour of corrections attached to it.
   */
  async listWithAudioState(): Promise<TranscriptSession[]> {
    const sessions = await this.list();
    return sessions.map((session) => ({
      ...session,
      audioMissing: !fs.existsSync(session.audioPath),
    }));
  }

  /**
   * Point an existing session at a moved recording.
   *
   * The session id is DERIVED FROM THE PATH, so relinking has to re-key: every
   * lookup (the workbench, the AI-sidebar resolver, save) computes
   * `sessionIdForPath(currentPath)`. Keeping the old id would leave the
   * transcript on disk but unreachable — the recording would open as "not
   * transcribed yet" with the renames, insights and saved document orphaned.
   *
   * Written under the new id first, then the old entry removed, so a crash in
   * between leaves a duplicate rather than nothing.
   */
  async relink(sessionId: string, newAudioPath: string): Promise<TranscriptSession | null> {
    const session = await this.get(sessionId);
    if (!session) return null;

    const newId = sessionIdForPath(newAudioPath);
    const relinked: TranscriptSession = {
      ...session,
      id: newId,
      audioPath: newAudioPath,
      audioFingerprint: fingerprintFile(newAudioPath),
      audioMissing: false,
    };

    await this.save(relinked);
    if (newId !== sessionId) await this.delete(sessionId);
    return relinked;
  }

  /** Removes stored transcript data only — never the audio or an export (R12). */
  async delete(sessionId: string): Promise<void> {
    await fsp.rm(this.file(sessionId), { force: true });
  }

  /** Bytes on disk, for the Settings row that lets the user clear it. */
  async sizeBytes(): Promise<number> {
    await this.ensureDir();
    const entries = await fsp.readdir(this.baseDir).catch(() => [] as string[]);
    let total = 0;
    for (const entry of entries) {
      try {
        total += (await fsp.stat(path.join(this.baseDir, entry))).size;
      } catch {
        /* ignore files that vanish mid-scan */
      }
    }
    return total;
  }

  async clear(): Promise<void> {
    const entries = await fsp.readdir(this.baseDir).catch(() => [] as string[]);
    await Promise.all(
      entries
        .filter((entry) => entry.endsWith(SESSION_SUFFIX))
        .map((entry) => fsp.rm(path.join(this.baseDir, entry), { force: true })),
    );
  }
}
