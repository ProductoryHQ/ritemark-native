/**
 * Where a local page is: a `.html`/`.htm` file, and whether it sits inside the open project
 * (Sprint 149, R2, W1).
 *
 * Pure: no `vscode` import, so it is tested directly. `pageCommands.ts` feeds it the tab's or the
 * caller's target and the workspace folders.
 *
 * The project boundary is decided on real paths (`realpath`), so a symlink inside the project that
 * points out of it, or a `..` that climbs out, is outside. On Windows the comparison ignores case.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const PAGE_EXTENSIONS = ['.html', '.htm'] as const;

/** A target as the commands receive it: a `vscode.Uri`-like value, or a URL string. */
export type PageTarget = string | { scheme: string; fsPath: string };

export type PageLocation =
  | { kind: 'project'; realPath: string; projectFolder: string }
  | { kind: 'outside'; realPath: string }
  | { kind: 'missing'; fsPath: string }
  /** The name is a page's, but the file it resolves to isn't one: a link to a program or a folder (PR 2's review). */
  | { kind: 'notAPage'; realPath: string };

export function isPagePath(p: string): boolean {
  const ext = path.extname(p).toLowerCase();
  return (PAGE_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * The file-system path of a local page, or undefined when the target isn't a local `.html` file
 * (a web address, another scheme, another file type).
 */
export function localPagePath(target: PageTarget | undefined): string | undefined {
  if (!target) return undefined;
  let fsPath: string | undefined;
  if (typeof target === 'string') {
    if (!/^file:/i.test(target)) return undefined;
    try {
      const url = new URL(target);
      // file://host/share/… (a UNC path) keeps its host
      const host = url.hostname.toLowerCase() === 'localhost' ? '' : url.host; // file://localhost/… is local
      fsPath = host ? `//${host}${decodeURIComponent(url.pathname)}` : decodeURIComponent(url.pathname);
      if (/^\/[a-zA-Z]:\//.test(fsPath)) fsPath = fsPath.slice(1); // file:///C:/…
    } catch {
      return undefined;
    }
  } else {
    if (target.scheme !== 'file') return undefined;
    fsPath = target.fsPath;
  }
  return fsPath && isPagePath(fsPath) ? fsPath : undefined;
}

export interface LocateOptions {
  realpath?: (p: string) => Promise<string>;
  /** Whether the resolved path is a regular file (default: `fs.promises.stat`). */
  isFile?: (p: string) => Promise<boolean>;
  platform?: NodeJS.Platform;
}

/** Whether `child` is `parent` itself or below it (both real, absolute paths). */
export function isInside(child: string, parent: string, platform: NodeJS.Platform = process.platform): boolean {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const norm = (s: string) => (platform === 'win32' ? s.toLowerCase() : s);
  const rel = p.relative(norm(parent), norm(child));
  if (rel === '') return true;
  const leaves = rel === '..' || rel.startsWith('..' + p.sep);
  return !leaves && !p.isAbsolute(rel);
}

/**
 * Where the page is, by real paths. A page that can't be resolved (deleted, unreadable) is
 * `missing`; a project folder that can't be resolved is skipped.
 */
export async function locatePage(
  fsPath: string,
  projectFolders: readonly string[],
  options: LocateOptions = {},
): Promise<PageLocation> {
  const realpath = options.realpath ?? ((p: string) => fs.promises.realpath(p));
  const platform = options.platform ?? process.platform;
  let realPath: string;
  try {
    realPath = await realpath(fsPath);
  } catch {
    return { kind: 'missing', fsPath };
  }
  // What opens or goes up is the resolved file, never the name: a `.html` that is a link to `run.command` would
  // otherwise run in Terminal from Open in your browser (and a link to a folder would open the folder).
  const isFile = options.isFile ?? (async (p: string) => (await fs.promises.stat(p)).isFile());
  let regular = false;
  try {
    regular = await isFile(realPath);
  } catch {
    return { kind: 'missing', fsPath };
  }
  if (!regular || !isPagePath(realPath)) {
    return { kind: 'notAPage', realPath };
  }
  for (const folder of projectFolders) {
    let realFolder: string;
    try {
      realFolder = await realpath(folder);
    } catch {
      continue;
    }
    if (realPath !== realFolder && isInside(realPath, realFolder, platform)) {
      return { kind: 'project', realPath, projectFolder: realFolder };
    }
  }
  return { kind: 'outside', realPath };
}
