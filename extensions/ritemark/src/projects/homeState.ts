/**
 * Sprint 134 (R4, W4): Home's state from what the host read, with no `vscode`
 * import, so every rule is tested: which files show under Last changed and by
 * what name, what waits and with which AI, and the other projects' line.
 */

import { ritemarkFileInDeckFolder, listedDeckFolders } from '../decks/deckFolderListing';
import { createHash } from 'crypto';
import * as path from 'path';
import { isAboutFile, isRootClaudeFile, ABOUT_TITLE } from './aboutFile';
import { isDeckPath, splitFileName } from '../decks/deckFileName';
import type { AiName, HomeRecentItem, HomeWaitingItem, RecentKind, StartKind } from './protocol';
import type { ProjectWaiting } from './waiting';

/**
 * What a Start something card runs: New's own commands, so a card does what New → <kind> does. Deck runs New → Deck's
 * command (Sprint 159, #749) only while the `decks` flag is on; with it off there is no Deck card, and a stray request
 * runs nothing.
 */
export function startCommand(kind: StartKind, decksEnabled: boolean): string | undefined {
  switch (kind) {
    case 'text': return 'ritemark.newDocument';
    case 'table': return 'ritemark.newTable';
    case 'deck': return decksEnabled ? 'ritemark.decks.new' : undefined;
    case 'web': return 'ritemark.browser.newTab';
  }
}

/** How many files Last changed lists. */
export const RECENT_LIMIT = 5;

const KINDS: Record<string, RecentKind> = {
  '.md': 'markdown', '.markdown': 'markdown', '.txt': 'markdown',
  // Sprint 172: a deck (`kindOf` names it `deck` first); listed here so Last changed finds `.rtms` files at all
  '.rtms': 'markdown',
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
  // A deck is its own kind (not PowerPoint's `slides`), shown with the deck's own icon, as its tab is (Sprint 159)
  if (isDeckPath(fileName)) return 'deck';
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
  const relative = (file: ChangedFile) => path.relative(folder, file.path).split(path.sep).join('/');
  const owned = listedDeckFolders(files.map(relative));
  return [...files]
    .filter(file => !ritemarkFileInDeckFolder(relative(file), owned))
    .filter((file) => !(isRootClaudeFile(folder, file.path) && pointerPaths.has(file.path)))
    .sort((a, b) => b.changedAt - a.changedAt || (a.path < b.path ? -1 : 1))
    .slice(0, limit)
    .map((file, index) => {
      const about = isAboutFile(folder, file.path);
      const base = path.basename(file.path);
      // An old deck's extension is the whole ".deck.md" (a ".rtms" one's is its last dot), as Documents splits it (patch 018's ritemarkSplitExtension)
      const split = splitFileName(base);
      const relativeDir = path.relative(folder, path.dirname(file.path));
      return {
        path: file.path,
        item: {
          // Stable across redraws, so focus stays on the same file when the list reorders (S15); opaque to the page.
          id: `file:${createHash('sha256').update(path.relative(folder, file.path)).digest('hex').slice(0, 16)}`,
          name: about ? ABOUT_TITLE : split.name,
          extension: about ? '' : split.extension,
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
    ? { id: `card:${item.cardId}`, source: 'card', kind: item.kind, title: item.title, detail: null, ai: null, since: item.since, colorSlot: null }
    : { id: `chat:${item.conversationId}`, source: 'chat', kind: item.kind, title: item.title, detail: null, ai: aiNameOf(item.runtimeId), since: item.since, colorSlot: item.colorSlot, ...(item.quoted ? { quoted: true } : {}) });
}

/** The other projects with something waiting, in the list's order; null when none can be counted. */
export function othersOf(projects: readonly { name: string; waiting: ProjectWaiting | undefined }[]): { name: string; count: number }[] | null {
  const counted = projects.filter((project) => project.waiting?.total !== undefined);
  if (projects.length > 0 && counted.length === 0) return null;
  return counted.filter((project) => (project.waiting!.total ?? 0) > 0).map((project) => ({ name: project.name, count: project.waiting!.total! }));
}

/**
 * What moved shows on Home once for a profile that came from Ritemark 1 (R11):
 * the welcome records `ritemark.updatedFrom1x` as `{ at }` when an update
 * welcome finishes, and the first visible delivery records it seen.
 */
export function showWhatMoved(updatedFrom1x: unknown, seen: unknown): boolean {
  const updated = updatedFrom1x === true || (typeof updatedFrom1x === 'object' && updatedFrom1x !== null);
  return updated && seen !== true;
}

/**
 * Sprint 142 (R3; experience 3, #557): the project-switch note goes when the person starts something. The page hears
 * its own presses, keys and drags; the host hears the rest that the extension can see (Q5): Home hidden by another
 * tab, and a message sent on the AI's sheet. A change in the first moments after the note shows is the window
 * settling after the switch (its tabs restored, Home brought forward), not the person.
 */
export const SWITCH_NOTE_SETTLE_MS = 1500;
export function switchNoteEndsOnHost(event: 'home-hidden' | 'turn-accepted', shownForMs: number | null): boolean {
  if (shownForMs === null || shownForMs < SWITCH_NOTE_SETTLE_MS) return false;
  return event === 'home-hidden' || event === 'turn-accepted';
}
