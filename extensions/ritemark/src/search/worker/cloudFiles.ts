/**
 * Sprint 148 (R1, A4): a file kept only online is never downloaded.
 *
 * - The Mac: iCloud Drive's and the File Provider clouds' (OneDrive, Dropbox,
 *   Google Drive) evicted files are "dataless": a size and no blocks on disk.
 *   `stat` and `readdir` don't download them; reading would. Such a file is
 *   found by its name. (A sparse file with nothing written in it has no blocks
 *   either; it holds no words, so being found by name loses nothing. A file the
 *   file system stores compressed keeps its blocks and is read: A4.)
 * - Windows: nothing under a OneDrive folder is read until audit A4 proves a
 *   check that tells an online-only file without opening it (spec R1). The
 *   folders are the `OneDrive*` environment variables' and any folder named
 *   "OneDrive" or "OneDrive - <organisation>".
 */
import * as path from 'node:path';

export type CloudState = 'online-only' | 'cloud-folder' | null;

const ONEDRIVE_FOLDER = /^onedrive( - .+)?$/i;

export function oneDriveRootsFromEnv(env: Record<string, string | undefined>): string[] {
  const roots = new Set<string>();
  for (const name of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) {
    const value = env[name]?.trim();
    if (value) roots.add(value);
  }
  return [...roots];
}

function isUnder(candidate: string, root: string): boolean {
  const a = path.win32.normalize(candidate).toLowerCase();
  const b = path.win32.normalize(root).toLowerCase().replace(/[\\/]+$/, '');
  return a === b || a.startsWith(`${b}\\`);
}

/** Windows: is this path in a OneDrive folder? */
export function inOneDriveFolder(filePath: string, oneDriveRoots: readonly string[]): boolean {
  if (oneDriveRoots.some((root) => isUnder(filePath, root))) return true;
  return path.win32.normalize(filePath).split('\\').some((segment) => ONEDRIVE_FOLDER.test(segment));
}

export interface StatShape {
  size: number;
  blocks: number;
}

/** Whether a file may be read without downloading it. */
export function cloudState(filePath: string, stat: StatShape, platform: string, oneDriveRoots: readonly string[]): CloudState {
  if (platform === 'win32') return inOneDriveFolder(filePath, oneDriveRoots) ? 'cloud-folder' : null;
  if (platform === 'darwin' && stat.size > 0 && stat.blocks === 0) return 'online-only';
  return null;
}
