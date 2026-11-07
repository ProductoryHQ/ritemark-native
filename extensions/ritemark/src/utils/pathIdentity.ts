/**
 * Sprint 155: whether two file paths name the same file, and whether a file is
 * inside a folder, compared the platform's way.
 *
 * On Windows a path may come with either drive-letter case and either slash
 * (`c:\ws\doc.md`, `C:/ws/doc.md`), and NTFS names are case-insensitive: those
 * are folded before comparing. On macOS and Linux nothing is folded; only
 * `resolve` and `normalize` apply. Pure: it reads no file. A caller that can
 * resolve symlinks (`realpath`) does that first and compares the results here.
 *
 * The path module is injectable so tests on any platform can pass `path.win32`
 * or `path.posix`.
 */

import * as path from 'path';

export type PathModule = Pick<path.PlatformPath, 'resolve' | 'normalize' | 'sep'>;

function isWin32(p: PathModule): boolean {
  return p.sep === '\\';
}

/** A path in the form two paths are compared in: resolved, normalized; on win32, backslashes and lower case. */
export function normalizeForCompare(file: string, p: PathModule = path): string {
  const normalized = p.normalize(p.resolve(file));
  return isWin32(p) ? normalized.replace(/\//g, '\\').toLowerCase() : normalized;
}

/** True when `a` and `b` name the same file (as written; no symlinks resolved). */
export function samePath(a: string, b: string, p: PathModule = path): boolean {
  return a === b || normalizeForCompare(a, p) === normalizeForCompare(b, p);
}

/** True when `file` is inside the folder `root` (at any depth; the folder itself is not inside). */
export function isInside(file: string, root: string, p: PathModule = path): boolean {
  const normalizedRoot = normalizeForCompare(root, p);
  const prefix = normalizedRoot.endsWith(p.sep) ? normalizedRoot : normalizedRoot + p.sep;
  return normalizeForCompare(file, p).startsWith(prefix);
}

/**
 * True when `a` and `b` name the same file on disk: symlinks resolved first
 * (`realpath`, which throws for a file that is gone), then compared with
 * {@link samePath}, so a deleted file still matches in any spelling.
 */
export function sameFile(
  a: string,
  b: string,
  realpath: (file: string) => string,
  p: PathModule = path,
): boolean {
  if (a === b) return true;
  const real = (file: string): string => {
    try { return realpath(file); } catch { return file; }
  };
  return samePath(real(a), real(b), p);
}
