import * as path from 'path';

export type WorkspaceFileKind = 'markdown' | 'document' | 'data' | 'image' | 'other';

export interface WorkspaceFileLinkResult {
  label: string;
  relativePath: string;
  workspacePath: string;
  directory: string;
  extension: string;
  kind: WorkspaceFileKind;
}

/**
 * Sprint 72 (2026-05-26) — the previous hard-coded extension allowlist
 * was removed after dev verification showed it blocked technical-writer
 * flows (e.g. `@test-utils.js` returned "No matching files"). Every
 * workspace file that is not inside a heavy/generated folder is now
 * searchable; ranking in `scoreWorkspaceFileResult` keeps Markdown
 * floating to the top.
 */
const HEAVY_FOLDER_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'build',
  '.next',
  '.turbo',
  'coverage',
]);

export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').split(path.sep).join('/');
}

/**
 * Whether a candidate file is exposed to `@` search. Heavy/generated
 * folders are excluded via {@link shouldSkipWorkspacePath}; everything
 * else passes — there is no file-extension allowlist.
 */
export function isSearchableFile(filePath: string): boolean {
  return !shouldSkipWorkspacePath(filePath);
}

export function shouldSkipWorkspacePath(filePath: string): boolean {
  const normalized = toPosixPath(filePath);
  const segments = normalized.split('/');
  return segments.some(segment =>
    HEAVY_FOLDER_NAMES.has(segment) ||
    segment.endsWith('.app') ||
    segment.startsWith('VSCode-')
  );
}

export function classifyWorkspaceFileKind(filePath: string): WorkspaceFileKind {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md' || ext === '.markdown') return 'markdown';
  if (ext === '.pdf' || ext === '.docx' || ext === '.txt') return 'document';
  if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') return 'data';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return 'image';
  return 'other';
}

export function buildWorkspaceFileLinkResult(
  documentPath: string,
  filePath: string,
  workspaceRoot?: string
): WorkspaceFileLinkResult {
  const ext = path.extname(filePath).toLowerCase();
  const label = path.basename(filePath, ext);
  const relativePath = toPosixPath(path.relative(path.dirname(documentPath), filePath)) || path.basename(filePath);
  const workspacePath = workspaceRoot
    ? toPosixPath(path.relative(workspaceRoot, filePath))
    : toPosixPath(filePath);
  const directory = toPosixPath(path.dirname(workspacePath));

  return {
    label,
    relativePath,
    workspacePath,
    directory: directory === '.' ? '' : directory,
    extension: ext.replace(/^\./, ''),
    kind: classifyWorkspaceFileKind(filePath),
  };
}

export function scoreWorkspaceFileResult(result: WorkspaceFileLinkResult, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  const label = result.label.toLowerCase();
  const fullPath = result.workspacePath.toLowerCase();

  let score = 0;

  if (!normalizedQuery) {
    score += result.kind === 'markdown' ? 20 : 0;
  } else if (label === normalizedQuery) {
    score += 120;
  } else if (label.startsWith(normalizedQuery)) {
    score += 95;
  } else if (label.includes(normalizedQuery)) {
    score += 70;
  } else if (fullPath.includes(normalizedQuery)) {
    score += 45;
  } else if (isSubsequence(normalizedQuery, label)) {
    score += 25;
  } else {
    return -1;
  }

  if (result.kind === 'markdown') score += 18;
  if (result.kind === 'document') score += 8;
  if (result.directory.split('/').length <= 2) score += 3;

  return score;
}

export function sortWorkspaceFileResults(
  results: WorkspaceFileLinkResult[],
  query: string
): WorkspaceFileLinkResult[] {
  return results
    .map(result => ({ result, score: scoreWorkspaceFileResult(result, query) }))
    .filter(item => item.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.result.workspacePath.localeCompare(b.result.workspacePath);
    })
    .map(item => item.result);
}

function isSubsequence(query: string, value: string): boolean {
  if (!query) return true;

  let queryIndex = 0;
  for (const char of value) {
    if (char === query[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === query.length) return true;
    }
  }

  return false;
}
