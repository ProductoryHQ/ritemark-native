/**
 * The one guard for a folder Ritemark makes under a project (Sprint 134, R13).
 *
 * A recursive `mkdir` makes every missing parent, so a project folder that was
 * moved, renamed or deleted while it was open came back, empty, the next time
 * anything wrote below it (Sprint 133's QA: Flows' storage did it every 30 s).
 * Every site that makes a folder under a project goes through here instead:
 *   - the project's folder is `stat`ed first, and must be there and be a folder;
 *   - only then is the subfolder made, with `recursive: true`, which is safe
 *     once the root is known to exist.
 * A folder that is not found stays not found until the person finds it or
 * removes it from the list.
 *
 * Contract: docs/development/releases/v2.0.0/sprint-134-project-at-the-centre/
 *   technical-plan.md (W10) and research/confirmations.md §7.
 */

import * as fsp from 'fs/promises';
import * as path from 'path';

export interface ProjectFolderFileSystem {
  stat(target: string): Promise<{ isDirectory(): boolean }>;
  /** Make a folder and any missing parents below the checked root. */
  mkdir(target: string): Promise<void>;
}

export const nodeProjectFolderFileSystem: ProjectFolderFileSystem = {
  stat: (target) => fsp.stat(target),
  async mkdir(target) {
    await fsp.mkdir(target, { recursive: true });
  },
};

/**
 * - `missing`: the project's folder is not there (moved, renamed, deleted, or
 *   on a drive that is not connected);
 * - `not-a-folder`: something else has its name;
 * - `outside`: the asked-for folder is not under the project's folder.
 */
export type ProjectFolderErrorCode = 'missing' | 'not-a-folder' | 'outside';

export class ProjectFolderError extends Error {
  constructor(
    readonly code: ProjectFolderErrorCode,
    readonly projectRoot: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProjectFolderError';
  }
}

export function isProjectFolderError(error: unknown): error is ProjectFolderError {
  return error instanceof ProjectFolderError;
}

/** `/a/b` holds `/a/b` and `/a/b/c`, not `/a/bc` or `/a`. */
export function isInsideProject(projectRoot: string, target: string): boolean {
  const relative = path.relative(path.resolve(projectRoot), path.resolve(target));
  if (relative === '') return true;
  if (path.isAbsolute(relative)) return false;
  return relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

/**
 * Make `relativeDir` under `projectRoot`, only while the project's folder is
 * there. `relativeDir` is relative to the root (`.ritemark/flows`); an absolute
 * path inside the root is taken as it is. Returns the folder's absolute path.
 *
 * Refuses with a `ProjectFolderError`, and makes nothing, when the root is not
 * there or is not a folder. Any other error from the `stat` (no permission,
 * for one) is passed on as it is.
 */
export async function ensureProjectSubfolder(
  projectRoot: string,
  relativeDir: string,
  fileSystem: Partial<ProjectFolderFileSystem> = {},
): Promise<string> {
  const fs: ProjectFolderFileSystem = { ...nodeProjectFolderFileSystem, ...fileSystem };
  const root = path.resolve(projectRoot);
  const target = path.resolve(root, relativeDir);
  if (!isInsideProject(root, target)) {
    throw new ProjectFolderError('outside', root, `${target} is not inside the folder ${root}.`);
  }

  let stats: { isDirectory(): boolean };
  try {
    stats = await fs.stat(root);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new ProjectFolderError('missing', root, `The folder ${root} is not where it was.`);
    }
    throw error;
  }
  if (!stats.isDirectory()) {
    throw new ProjectFolderError('not-a-folder', root, `${root} is not a folder.`);
  }

  if (target !== root) await fs.mkdir(target);
  return target;
}
