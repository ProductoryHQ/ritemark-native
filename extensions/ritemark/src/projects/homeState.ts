/**
 * Sprint 134 (R4, W4): Home's state from what the host read, with no `vscode`
 * import, so every rule is tested: which files show under Last changed and by
 * what name, what waits and with which AI, and the other projects' line.
 */

import * as path from 'path';
import { isAboutFile, isRootClaudeFile, ABOUT_TITLE } from './aboutFile';
import type { AiName, HomeRecentItem, HomeWaitingItem, RecentKind } from './protocol';
import type { ProjectWaiting } from './waiting';

/** How many files Last changed lists. */
export const RECENT_LIMIT = 5;

const KINDS: Record<string, RecentKind> = {
  '.md': 'markdown', '.markdown': 'markdown', '.txt': 'markdown',
  '.pdf': 'pdf',
  '.docx': 'word', '.doc': 'word',
  '.csv': 'sheet', '.xlsx': 'sheet', '.xls': 'sheet',
  '.pptx': 'slides', '.ppt': 'slides',
  '.drawio': 'drawing',
  '.flow': 'flow',
};

/** The kinds of file Ritemark opens, and so lists under Last changed. */
export const RECENT_EXTENSIONS: readonly string[] = Object.keys(KINDS);

export function kindOf(fileName: string): RecentKind {
  if (fileName.toLowerCase().endsWith('.flow.json')) return 'flow';
  return KINDS[path.extname(fileName).toLowerCase()] ?? 'other';
}

export function aiNameOf(runtimeId: string | null | undefined): AiName | null {
  switch (runtimeId) {
    case 'claude-code': return 'Claude';
    case 'codex': return 'ChatGPT';
    case 'opencode': return 'OpenCode';
    default: return null;
  }
}

export interface ChangedFile {
  /** Absolute path. */
  path: string;
  changedAt: number;
}

/**
 * Last changed: the newest files, most recent first. The project's AGENTS.md
 * is About this project; Ritemark's pointer CLAUDE.md is left out, as
 * Documents leaves it out (R8). `pointerPaths` are root CLAUDE.md files whose
 * whole content is the pointer.
 */
export function recentItems(
  folder: string,
  files: readonly ChangedFile[],
  pointerPaths: ReadonlySet<string>,
  limit = RECENT_LIMIT,
): { item: HomeRecentItem; path: string }[] {
  return [...files]
    .filter((file) => !(isRootClaudeFile(folder, file.path) && pointerPaths.has(file.path)))
    .sort((a, b) => b.changedAt - a.changedAt || (a.path < b.path ? -1 : 1))
    .slice(0, limit)
    .map((file, index) => {
      const about = isAboutFile(folder, file.path);
      const base = path.basename(file.path);
      const dot = base.lastIndexOf('.');
      const relativeDir = path.relative(folder, path.dirname(file.path));
      return {
        path: file.path,
        item: {
          id: `file:${index}`,
          name: about ? ABOUT_TITLE : dot > 0 ? base.slice(0, dot) : base,
          extension: about || dot <= 0 ? '' : base.slice(dot),
          folder: relativeDir && relativeDir !== '.' ? relativeDir.split(path.sep).join('/') : null,
          kind: kindOf(base),
          about,
          changedAt: new Date(file.changedAt).toISOString(),
        },
      };
    });
}

/** What waits here, as Home lists it: cards first (most urgent first), then chats. */
export function waitingItems(waiting: ProjectWaiting): HomeWaitingItem[] {
  return waiting.items.map((item) => item.source === 'card'
    ? { id: `card:${item.cardId}`, source: 'card', kind: item.kind, title: item.title, detail: null, ai: null, since: item.since }
    : { id: `chat:${item.conversationId}`, source: 'chat', kind: item.kind, title: item.title, detail: null, ai: aiNameOf(item.runtimeId), since: item.since });
}

/** The other projects with something waiting, in the list's order; null when none can be counted. */
export function othersOf(projects: readonly { name: string; waiting: ProjectWaiting | undefined }[]): { name: string; count: number }[] | null {
  const counted = projects.filter((project) => project.waiting?.total !== undefined);
  if (projects.length > 0 && counted.length === 0) return null;
  return counted.filter((project) => (project.waiting!.total ?? 0) > 0).map((project) => ({ name: project.name, count: project.waiting!.total! }));
}
