/**
 * Sprint 134 (R2, W2): the project list's first fill, once per profile.
 *
 * On the first start of this build the list is filled from what the computer
 * already has: VS Code's recent folders, then every project with chats in
 * Ritemark's chat store. Boards add no folder (their records name none), and
 * a board in a folder neither knows joins when it is next opened. Only single
 * folders that are there now are added; workspace files, remote folders, the
 * sample inside the app and folders that have gone are not.
 *
 * VS Code's spelling of a folder wins: this computer's hand-off records and
 * VS Code's saved tabs are keyed by the exact path, and the chat store keeps
 * Windows paths in lower case.
 *
 * No `vscode` import: the host passes the recent list and the URI helpers.
 * Research: docs/development/releases/v2.0.0/sprint-134-project-at-the-centre/
 *   research/first-fill-audit.md
 */

import { promises as fsp } from 'fs';
import * as path from 'path';
import type { ProjectFoundBy } from './ProjectList';

/** The time a folder check may take before it counts as not there (a share that is gone can hang). */
export const EXISTS_TIMEOUT_MS = 2000;

export interface FoundProject {
  folderUri: string;
  lastOpenedAt: string;
  foundBy: ProjectFoundBy;
}

export interface FirstFillInput {
  platform: NodeJS.Platform;
  /** VS Code's recent folders, newest first: single `file:` folders only. */
  recentFolders: readonly { uri: string; fsPath: string }[];
  /** One per chat scope with a single folder: its folder as the chat store has it, and its newest chat. */
  chatFolders: readonly { uri: string; lastActivityAt: string }[];
  /** When each folder was last open, by {@link folderKey} (ms). */
  lastOpen: ReadonlyMap<string, number>;
  exists(fsPath: string): Promise<boolean>;
  /** Folders inside the app itself (the shipped sample) are never projects. */
  insideApp(fsPath: string): boolean;
  /** The folder's spelling on disk (Windows: `realpathSync.native`). */
  spellingOnDisk(fsPath: string): string;
  /** `vscode.Uri.file(fsPath).toString()`. */
  uriOfPath(fsPath: string): string;
  /** `vscode.Uri.parse(uri).fsPath`. */
  pathOfUri(uri: string): string;
}

/**
 * One key per folder: trailing separators trimmed, and case and Unicode form
 * folded on the Mac and Windows, as VS Code compares recent folders.
 */
export function folderKey(fsPath: string, platform: NodeJS.Platform): string {
  let key = fsPath.replace(/[\\/]+$/, '') || fsPath;
  if (platform === 'darwin') key = key.normalize('NFC');
  if (platform === 'darwin' || platform === 'win32') key = key.toLowerCase();
  return key;
}

export async function firstFill(input: FirstFillInput): Promise<FoundProject[]> {
  const found = new Map<string, { uri: string; fsPath: string; time: number | undefined; position: number; foundBy: ProjectFoundBy }>();
  let position = 0;
  for (const recent of input.recentFolders) {
    const key = folderKey(recent.fsPath, input.platform);
    if (!found.has(key)) found.set(key, { uri: recent.uri, fsPath: recent.fsPath, time: input.lastOpen.get(key), position: position++, foundBy: 'recent' });
  }
  for (const chat of input.chatFolders) {
    let fsPath: string;
    try {
      fsPath = input.pathOfUri(chat.uri);
    } catch {
      continue;
    }
    const key = folderKey(fsPath, input.platform);
    const chatTime = Date.parse(chat.lastActivityAt);
    const known = found.get(key);
    if (known) {
      if (known.time === undefined && Number.isFinite(chatTime)) known.time = chatTime;
      continue;
    }
    let spelled = fsPath;
    try {
      spelled = input.spellingOnDisk(fsPath);
    } catch {
      // Not there: the existence check below leaves it out.
    }
    found.set(key, {
      uri: input.uriOfPath(spelled),
      fsPath: spelled,
      time: input.lastOpen.get(key) ?? (Number.isFinite(chatTime) ? chatTime : undefined),
      position: position++,
      foundBy: 'chats',
    });
  }
  const candidates = [...found.values()].filter((entry) => !input.insideApp(entry.fsPath));
  const there = await Promise.all(candidates.map((entry) => withTimeout(input.exists(entry.fsPath), EXISTS_TIMEOUT_MS, false)));
  const kept = candidates.filter((_, index) => there[index]);
  // Newest first; a folder with no known time keeps its place in the recent list.
  kept.sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity) || a.position - b.position);
  const oldest = Math.min(...kept.map((entry) => entry.time ?? Infinity));
  const base = Number.isFinite(oldest) ? oldest : Date.parse('2020-01-01T00:00:00.000Z');
  return kept.map((entry, index) => ({
    folderUri: entry.uri,
    // Only the order matters: a folder with no time sorts after the timed ones, in its recent-list place.
    lastOpenedAt: new Date(entry.time ?? base - (index + 1) * 1000).toISOString(),
    foundBy: entry.foundBy,
  }));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, () => {
      clearTimeout(timer);
      resolve(fallback);
    });
  });
}

/**
 * The chat store's single-folder scopes, read raw: `index.json` for each
 * scope's newest chat, then that one record for its folder. Never through the
 * store, whose every method rewrites the index. `records/` is scanned only
 * when the index can't be read.
 */
export async function readChatFolders(globalStoragePath: string): Promise<{ uri: string; lastActivityAt: string }[]> {
  const base = path.join(globalStoragePath, 'conversations', 'v1');
  const newest = new Map<string, { ids: { id: string; at: string }[] }>();
  let fromIndex = true;
  try {
    const index = JSON.parse(await fsp.readFile(path.join(base, 'index.json'), 'utf8')) as { entries?: unknown };
    if (!Array.isArray(index.entries)) throw new Error('no entries');
    for (const raw of index.entries) {
      const entry = raw as { conversationId?: unknown; scopeId?: unknown; lastActivityAt?: unknown; integrity?: unknown };
      if (typeof entry.conversationId !== 'string' || typeof entry.scopeId !== 'string' || typeof entry.lastActivityAt !== 'string') continue;
      if (entry.integrity === 'corrupt') continue;
      const scope = newest.get(entry.scopeId) ?? { ids: [] };
      scope.ids.push({ id: entry.conversationId, at: entry.lastActivityAt });
      newest.set(entry.scopeId, scope);
    }
  } catch {
    fromIndex = false;
  }
  const out: { uri: string; lastActivityAt: string }[] = [];
  const readScope = async (file: string): Promise<{ scopeId: string; uri: string | null; at: string } | null> => {
    try {
      const record = JSON.parse(await fsp.readFile(file, 'utf8')) as { scopeId?: unknown; lastActivityAt?: unknown; scope?: { kind?: unknown; folderUris?: unknown } };
      if (typeof record.scopeId !== 'string' || typeof record.lastActivityAt !== 'string') return null;
      const folders = record.scope?.folderUris;
      const uri = record.scope?.kind === 'single-root' && Array.isArray(folders) && typeof folders[0] === 'string' ? folders[0] : null;
      return { scopeId: record.scopeId, uri, at: record.lastActivityAt };
    } catch {
      return null;
    }
  };
  if (fromIndex) {
    for (const { ids } of newest.values()) {
      ids.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      // The newest record that can still be read tells the scope's folder.
      for (const { id, at } of ids) {
        const scope = await readScope(path.join(base, 'records', `${id}.json`));
        if (!scope) continue;
        if (scope.uri) out.push({ uri: scope.uri, lastActivityAt: at });
        break;
      }
    }
    return out;
  }
  let names: string[] = [];
  try {
    names = await fsp.readdir(path.join(base, 'records'));
  } catch {
    return out;
  }
  const byScope = new Map<string, { uri: string; at: string }>();
  for (const name of names) {
    if (!name.endsWith('.json') || name.includes('.tmp-')) continue;
    const scope = await readScope(path.join(base, 'records', name));
    if (!scope?.uri) continue;
    const known = byScope.get(scope.scopeId);
    if (!known || known.at < scope.at) byScope.set(scope.scopeId, { uri: scope.uri, at: scope.at });
  }
  for (const { uri, at } of byScope.values()) out.push({ uri, lastActivityAt: at });
  return out;
}

/**
 * When each folder was last open: VS Code keeps one storage folder per
 * workspace (`User/workspaceStorage/<id>/workspace.json` names the folder),
 * and its state database is written while a window has it open. Keyed by
 * {@link folderKey}; the newest of a folder's storage folders wins.
 */
export async function lastOpenTimes(
  globalStoragePath: string,
  pathOfUri: (uri: string) => string,
  platform: NodeJS.Platform,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const root = path.join(globalStoragePath, '..', '..', 'workspaceStorage');
  let entries: string[] = [];
  try {
    entries = await fsp.readdir(root);
  } catch {
    return out;
  }
  await Promise.all(entries.map(async (entry) => {
    try {
      const meta = JSON.parse(await fsp.readFile(path.join(root, entry, 'workspace.json'), 'utf8')) as { folder?: unknown };
      if (typeof meta.folder !== 'string') return;
      const stat = await fsp.stat(path.join(root, entry, 'state.vscdb'));
      const key = folderKey(pathOfUri(meta.folder), platform);
      out.set(key, Math.max(out.get(key) ?? 0, stat.mtimeMs));
    } catch {
      // Not a folder workspace, or no state yet.
    }
  }));
  return out;
}
