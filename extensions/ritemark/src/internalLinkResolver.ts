import * as path from 'path';
import { promises as fsPromises } from 'fs';

/**
 * Sprint 72 R7: resolve an internal Markdown link to a real filesystem path
 * and check that it stays inside the user's workspace.
 *
 * Lives outside `ritemarkEditor.ts` so it can be unit-tested without spinning
 * up the VS Code runtime.
 *
 * Behaviour (mirrors the R7 acceptance criteria in spec.md):
 *
 *  1. `href` is stripped of any `#fragment` and `?query`.
 *  2. `href` is URI-decoded so `%20` etc. survive into the filesystem call.
 *  3. The absolute target path is computed via
 *     `path.resolve(path.dirname(documentPath), decodedHref)`.
 *  4. The real path is taken via `fs.promises.realpath` (symlinks followed).
 *     If the target does not exist yet, `ENOENT` is caught and the lexical
 *     `path.resolve` result is used for the containment check; the result is
 *     then reported as `'not-found'`.
 *  5. Containment check:
 *      - If `workspaceFolderPath` is provided, the real path must lie inside
 *        it (after `realpath` is also applied to the folder, so symlinked
 *        workspaces still match).
 *      - If no workspace folder is provided, the real path must lie inside
 *        the current document's parent directory.
 *     Failures are reported as `'out-of-workspace'`.
 */
export interface ResolveInternalLinkPureParams {
  documentPath: string;
  href: string;
  workspaceFolderPath?: string;
}

export interface ResolveInternalLinkResult {
  /**
   * Best-effort real path of the resolved target. Always set, even on
   * rejection, so the caller can include it in error messages.
   */
  realPath: string;

  /**
   * The exact path used for the containment check. Useful for tests and for
   * deciding which message to show the user.
   */
  resolvedPath: string;

  rejection?: 'out-of-workspace' | 'not-found';

  /**
   * The path that was compared against during the containment check.
   * `'workspace'` when `workspaceFolderPath` was provided, `'document-parent'`
   * otherwise. Useful in error messages.
   */
  containmentRoot?: string;
  containmentScope: 'workspace' | 'document-parent';
}

export interface ResolveDeps {
  realpath?: (p: string) => Promise<string>;
}

/**
 * Returns `true` if `child` is the same as `parent` or a descendant of it.
 * Uses path.relative to avoid false positives like `/foo/bar` vs `/foo/bar-x`.
 */
export function isPathInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  if (rel === '') return true; // identical
  if (rel.startsWith('..')) return false;
  if (path.isAbsolute(rel)) return false;
  return true;
}

function stripFragmentAndQuery(href: string): string {
  const hashIndex = href.indexOf('#');
  const queryIndex = href.indexOf('?');
  let end = href.length;
  if (hashIndex !== -1) end = Math.min(end, hashIndex);
  if (queryIndex !== -1) end = Math.min(end, queryIndex);
  return href.slice(0, end);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Resolve the real path of the deepest existing ancestor of `target` and
 * append the unresolved tail.
 *
 * Used when `realpath(target)` ENOENTs: the lexical path may live under a
 * symlinked parent (on macOS `/tmp` → `/private/tmp`) and a later
 * `isPathInside` check against a `realpath`'d workspace root would
 * mis-classify the missing file as out-of-workspace.
 *
 * Walks up the directory tree, calling `realpath` on each ancestor until
 * one resolves. Returns the joined path: `realpath(ancestor) + tail`.
 *
 * If even the root does not resolve, the original lexical path is returned
 * — there is nothing better we can do.
 */
async function realpathWithFallback(
  target: string,
  realpath: (p: string) => Promise<string>
): Promise<string> {
  let current = target;
  const tail: string[] = [];
  // Cap the walk to avoid spinning forever on pathological inputs.
  for (let depth = 0; depth < 64; depth++) {
    try {
      const resolved = await realpath(current);
      return tail.length === 0 ? resolved : path.join(resolved, ...tail.reverse());
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw err;
      const parent = path.dirname(current);
      if (parent === current) break; // reached filesystem root
      tail.push(path.basename(current));
      current = parent;
    }
  }
  return target;
}

export async function resolveInternalLinkTarget(
  params: ResolveInternalLinkPureParams,
  deps: ResolveDeps = {}
): Promise<ResolveInternalLinkResult> {
  const realpath = deps.realpath ?? fsPromises.realpath;

  const cleanedHref = safeDecode(stripFragmentAndQuery(params.href));
  const documentDir = path.dirname(params.documentPath);
  const resolvedPath = path.resolve(documentDir, cleanedHref);

  let realPath = resolvedPath;
  let notFound = false;
  try {
    realPath = await realpath(resolvedPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      notFound = true;
      // The lexical path may live under a symlinked parent (on macOS
      // /tmp → /private/tmp). Walk up to the deepest existing ancestor,
      // realpath it, and re-attach the missing tail. Without this, a
      // missing file inside the workspace gets mis-classified as
      // out-of-workspace because the containment root is realpath'd but
      // the missing target isn't.
      realPath = await realpathWithFallback(resolvedPath, realpath);
    } else {
      throw err;
    }
  }

  // Resolve the containment root the same way we resolved the target, so a
  // symlinked workspace folder still matches when the symlinked target lands
  // inside its real location.
  const containmentScope: 'workspace' | 'document-parent' = params.workspaceFolderPath
    ? 'workspace'
    : 'document-parent';
  let containmentRoot = params.workspaceFolderPath ?? documentDir;
  try {
    containmentRoot = await realpath(containmentRoot);
  } catch {
    // If the root itself does not resolve, fall back to the lexical path.
  }

  if (!isPathInside(realPath, containmentRoot)) {
    return {
      realPath,
      resolvedPath,
      rejection: 'out-of-workspace',
      containmentRoot,
      containmentScope,
    };
  }

  if (notFound) {
    return {
      realPath,
      resolvedPath,
      rejection: 'not-found',
      containmentRoot,
      containmentScope,
    };
  }

  return {
    realPath,
    resolvedPath,
    containmentRoot,
    containmentScope,
  };
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx']);

/**
 * Whether to open the resolved target with Ritemark's custom Markdown
 * editor (true) or VS Code's default opener (false).
 */
export function isMarkdownFile(filePath: string): boolean {
  return MARKDOWN_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}
