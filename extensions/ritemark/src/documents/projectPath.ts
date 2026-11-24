import { realpath } from 'node:fs/promises';
import * as path from 'node:path';
import { isInside, samePath } from '../utils/pathIdentity';

export type ProjectDocumentPath =
  | { ok: true; path: string; candidate: string }
  | { ok: false; reason: 'outside' | 'missing' };

export async function resolveProjectDocument(
  input: string,
  roots: readonly string[],
  resolveRealPath: (file: string) => Promise<string> = realpath,
  paths = path,
): Promise<ProjectDocumentPath> {
  // Only ordinary drive paths and relative paths on Windows. UNC, device paths,
  // drive-relative paths and alternate data streams aren't local documents.
  if (!roots.length || !input.trim() || /[\u0000-\u001f]/.test(input)
    || (paths.sep === '\\' && (/^[\\/]/.test(input) || /:/.test(input.replace(/^[a-z]:[\\/]/i, ''))))) {
    return { ok: false, reason: 'outside' };
  }

  const contains = (file: string, root: string) => samePath(file, root, paths) || isInside(file, root, paths);
  const local = (file: string) => paths.sep !== '\\' || /^[a-z]:[\\/]/i.test(file);
  const projectRoots = roots.filter(local);
  const realRoots = (await Promise.all(projectRoots.map((root) => resolveRealPath(root).catch(() => null))))
    .filter((root): root is string => root !== null && local(root));
  const allowedSpellings = [...projectRoots, ...realRoots];
  let reason: 'outside' | 'missing' = 'outside';
  for (const root of projectRoots) {
    const candidate = paths.resolve(root, input);
    if (!allowedSpellings.some((folder) => contains(candidate, folder))) continue;
    let real: string;
    try {
      real = await resolveRealPath(candidate);
    } catch {
      reason = 'missing';
      continue;
    }
    if (!realRoots.some((folder) => contains(real, folder))) return { ok: false, reason: 'outside' };
    return { ok: true, path: real, candidate };
  }
  return { ok: false, reason };
}
