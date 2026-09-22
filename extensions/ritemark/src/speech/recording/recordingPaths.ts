/**
 * Sprint 118 R4 — where a recording goes and what it is called.
 *
 * Frozen in Phase 0 (§2.1, §5; Jarmo 2026-09-22):
 *   - a workspace folder open → `<folder>/recordings/`;
 *   - several folders → the one holding the active file, otherwise ask once;
 *   - no folder → ask before recording, remember the choice;
 *   - `Recording YYYY-MM-DD HH.MM.wav`, ` (2)` on a collision, never overwrite.
 *
 * Pure functions only, so every rule is testable without VS Code.
 */

import * as path from 'path';
import { BITS_PER_SAMPLE, BYTES_PER_SECOND, CHANNELS, PARTIAL_SUFFIX, PROJECT_RECORDINGS_FOLDER, SAMPLE_RATE, WAV_HEADER_BYTES } from './types';

export interface WorkspaceFolderInfo {
  name: string;
  path: string;
}

export type DestinationDecision =
  | { kind: 'folder'; dir: string; label: string }
  | { kind: 'choose-workspace-folder'; folders: WorkspaceFolderInfo[] }
  | { kind: 'choose-location' };

/** `/a/b` contains `/a/b/c.md` but not `/a/bc.md`. */
export function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function projectRecordingsDir(folder: WorkspaceFolderInfo): { dir: string; label: string } {
  return { dir: path.join(folder.path, PROJECT_RECORDINGS_FOLDER), label: `${folder.name}/${PROJECT_RECORDINGS_FOLDER}` };
}

/** Shorten a location for display: the home directory becomes `~`. */
export function displayLocation(dir: string, home: string): string {
  return home && isInside(dir, home) ? path.join('~', path.relative(home, dir)) : dir;
}

export function decideDestination(input: {
  workspaceFolders: WorkspaceFolderInfo[];
  activeFilePath: string | null;
  rememberedLocation: string | null;
  home: string;
}): DestinationDecision {
  const { workspaceFolders, activeFilePath, rememberedLocation, home } = input;
  if (workspaceFolders.length === 1) {
    return { kind: 'folder', ...projectRecordingsDir(workspaceFolders[0]) };
  }
  if (workspaceFolders.length > 1) {
    const owner = activeFilePath
      ? workspaceFolders.find((folder) => isInside(activeFilePath, folder.path))
      : undefined;
    return owner ? { kind: 'folder', ...projectRecordingsDir(owner) } : { kind: 'choose-workspace-folder', folders: workspaceFolders };
  }
  if (rememberedLocation) {
    return { kind: 'folder', dir: rememberedLocation, label: displayLocation(rememberedLocation, home) };
  }
  return { kind: 'choose-location' };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** `Recording 2026-09-22 14.05` in local time — filesystem-safe everywhere. */
export function recordingBaseName(now: Date): string {
  return `Recording ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}`;
}

/**
 * Pick a name whose final `.wav` and in-progress `.wav.part` are both free.
 * A collision adds ` (2)`, ` (3)`, … — an existing file is never overwritten.
 */
export async function reserveRecordingPath(
  dir: string,
  baseName: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<{ finalPath: string; partPath: string }> {
  for (let n = 1; n <= 999; n++) {
    const name = n === 1 ? `${baseName}.wav` : `${baseName} (${n}).wav`;
    const finalPath = path.join(dir, name);
    const partPath = finalPath + PARTIAL_SUFFIX;
    if (!(await exists(finalPath)) && !(await exists(partPath))) return { finalPath, partPath };
  }
  throw new Error('No free recording name');
}

/** The final path a `.wav.part` promotes to. */
export function finalPathFor(partPath: string): string {
  return partPath.endsWith(PARTIAL_SUFFIX) ? partPath.slice(0, -PARTIAL_SUFFIX.length) : partPath;
}

export function durationFromDataBytes(dataBytes: number): number {
  return dataBytes / BYTES_PER_SECOND;
}

/** A canonical 44-byte PCM WAV header for `dataBytes` of audio. */
export function wavHeader(dataBytes: number): Buffer {
  const header = Buffer.alloc(WAV_HEADER_BYTES);
  const blockAlign = CHANNELS * (BITS_PER_SAMPLE / 8);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

/** True when `header` is exactly what `wavHeader(dataBytes)` writes. */
export function isValidWavHeader(header: Buffer, dataBytes: number): boolean {
  return header.length === WAV_HEADER_BYTES && header.equals(wavHeader(dataBytes));
}
