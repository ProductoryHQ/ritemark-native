/**
 * The update welcome's and the start sheet's project rows (Sprint 133, R1,
 * R10): up to three recent folders, the one open when the person left first.
 * The list comes from VS Code's recent folders for this step; Sprint 134's
 * project list replaces it. Pure: no `vscode` import.
 */

import * as path from 'path';

export const MAX_PROJECT_ROWS = 3;

/** Two letters for a project's mark: "Leadership programme" → "LP", "Notes" → "NO". */
export function projectMark(name: string): string {
  const words = name.split(/[\s\-_.]+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length >= 2) return (firstChar(words[0]) + firstChar(words[1])).toUpperCase();
  const only = words[0] ?? name;
  const chars = [...only.replace(/[^\p{L}\p{N}]/gu, '')];
  return (chars.slice(0, 2).join('') || '?').toUpperCase();
}

function firstChar(word: string): string {
  return [...word.replace(/[^\p{L}\p{N}]/gu, '')][0] ?? '';
}

/** The folder as the person reads it: `~/Documents/…` on the Mac, the full path on Windows. */
export function displayPlace(fsPath: string, home: string, platform: NodeJS.Platform): string {
  // A URI's fsPath has a lowercase drive letter (c:\Users…); Windows writes it C:.
  if (platform === 'win32') return fsPath.replace(/^([a-z]):/, (_, drive: string) => `${drive.toUpperCase()}:`);
  const trimmedHome = home.replace(/\/+$/, '');
  if (trimmedHome && (fsPath === trimmedHome || fsPath.startsWith(`${trimmedHome}/`))) return `~${fsPath.slice(trimmedHome.length)}`;
  return fsPath;
}

const DAY = 24 * 60 * 60 * 1000;

/** When a project was last open, in words (experience 32: "Yesterday", "Last week"). */
export function lastOpenWords(lastOpen: number | undefined, now: number): string | null {
  if (lastOpen === undefined || !Number.isFinite(lastOpen)) return null;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - lastOpen) / DAY) + 1;
  if (lastOpen >= startOfToday.getTime()) return 'Today';
  if (days <= 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  if (days < 35) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return 'Last month';
  return 'Earlier';
}

export interface RecentFolder {
  fsPath: string;
  /** `Uri.toString()`. */
  uri: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  mark: string;
  place: string;
  when: string | null;
  current: boolean;
  uri: string;
}

/**
 * The rows: the folder this window restored first, as "Open when you left";
 * then the most recent others; at most three. Folders that are gone are left out.
 */
export function projectRows(input: {
  recents: readonly RecentFolder[];
  currentFolder: string | undefined;
  exists: (fsPath: string) => boolean;
  lastOpen: (uri: string) => number | undefined;
  home: string;
  platform: NodeJS.Platform;
  now: number;
}): ProjectRow[] {
  const seen = new Set<string>();
  const ordered: RecentFolder[] = [];
  const current = input.currentFolder ? input.recents.find((recent) => recent.uri === input.currentFolder) : undefined;
  if (current) ordered.push(current);
  for (const recent of input.recents) ordered.push(recent);
  const rows: ProjectRow[] = [];
  for (const recent of ordered) {
    if (rows.length >= MAX_PROJECT_ROWS) break;
    if (seen.has(recent.uri) || !input.exists(recent.fsPath)) continue;
    seen.add(recent.uri);
    const name = path.basename(recent.fsPath) || recent.fsPath;
    const isCurrent = recent.uri === input.currentFolder;
    rows.push({
      id: `p${rows.length}`,
      name,
      mark: projectMark(name),
      place: displayPlace(recent.fsPath, input.home, input.platform),
      when: isCurrent ? 'Open when you left' : lastOpenWords(input.lastOpen(recent.uri), input.now),
      current: isCurrent,
      uri: recent.uri,
    });
  }
  return rows;
}
