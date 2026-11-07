/**
 * Sprint 155 (PR 2) — each chat shows its document (experience 45).
 *
 * A chat's document is the newest file its turns changed that still exists
 * (PR 1 keeps each chat's changed files in the index, newest change first). Its
 * icon is the file's own icon from Ritemark's file icon theme
 * (`fileicons/ritemark-icon-theme.json`), resolved the way the workbench does:
 * fileNames, then fileExtensions (longest first), then languageIds, then the
 * default file icon. The host resolves it and hands the sheet a webview URI;
 * nothing is drawn by hand.
 *
 * A click on the head's icon brings that document's tab forward in its own
 * editor group, or opens the document in a new tab at the row's end when it is
 * closed. Only the person's click or key does this: nothing here runs on a tab
 * change or a chat change (Jarmo, 5 and 7 November).
 *
 * No `vscode` import, so all of it is unit-testable with fakes.
 */

/** One file a chat changed, as the index keeps it (PR 1's `ConversationChangedFileV1`). */
export interface ChangedFileFact {
  path: string;
  changedAt: string;
}

/** A chat's document: the newest changed file that exists, and how many other existing files it changed. */
export interface ChatDocument {
  /** The file's real path (the comparison key with the document in front). */
  path: string;
  /** The file's name, as its tab shows it. */
  name: string;
  /** Other changed files that still exist ("and N more"). */
  more: number;
}

/** What the sheet gets for a chat: its document and its icon's webview URI. */
export interface ChatDocumentView extends ChatDocument {
  iconUri: string;
}

/** The base name of a POSIX or Windows path. */
export function fileNameOf(file: string): string {
  const parts = file.split(/[\\/]/);
  return parts[parts.length - 1] || file;
}

/**
 * The chat's document. `realPath` answers the file's real path, or null when it
 * is gone; a gone file is skipped and never counted, so "and N more" names only
 * files a click could reach. Two stored paths to one real file count once.
 */
export function chatDocumentOf(
  changedFiles: readonly ChangedFileFact[] | undefined,
  realPath: (file: string) => string | null,
): ChatDocument | null {
  if (!changedFiles?.length) return null;
  const newestFirst = [...changedFiles].sort((a, b) => (a.changedAt === b.changedAt ? 0 : a.changedAt < b.changedAt ? 1 : -1));
  const seen = new Set<string>();
  let first: { real: string; stored: string } | null = null;
  for (const entry of newestFirst) {
    const real = realPath(entry.path);
    if (!real || seen.has(real)) continue;
    seen.add(real);
    if (!first) first = { real, stored: entry.path };
  }
  if (!first) return null;
  return { path: first.real, name: fileNameOf(first.real), more: seen.size - 1 };
}

/** Every chat's document, with its icon; chats without one are left out. */
export function chatDocumentsFor(
  chats: readonly { conversationId: string; changedFiles?: readonly ChangedFileFact[] }[],
  realPath: (file: string) => string | null,
  iconUri: (file: string) => string,
): Record<string, ChatDocumentView> {
  const documents: Record<string, ChatDocumentView> = {};
  for (const chat of chats) {
    const document = chatDocumentOf(chat.changedFiles, realPath);
    if (document) documents[chat.conversationId] = { ...document, iconUri: iconUri(document.path) };
  }
  return documents;
}

// ── Ritemark's file icon theme ──

interface IconAssociations {
  file?: string;
  fileExtensions?: Record<string, string>;
  fileNames?: Record<string, string>;
  languageIds?: Record<string, string>;
}

/** The parts of a VS Code file icon theme this reads. */
export interface FileIconTheme extends IconAssociations {
  iconDefinitions: Record<string, { iconPath: string }>;
  light?: IconAssociations;
}

/**
 * A file's icon in the theme, as the path its definition names (relative to
 * the theme file). In a light theme the `light` associations come first, then
 * the base ones, at each step, as the workbench reads them.
 */
export function resolveFileIcon(theme: FileIconTheme, file: string, options: { kind: 'light' | 'dark'; languageId?: string }): string | undefined {
  const sets: IconAssociations[] = options.kind === 'light' && theme.light ? [theme.light, theme] : [theme];
  const name = fileNameOf(file).toLowerCase();
  const pick = (lookup: (set: IconAssociations) => string | undefined): string | undefined => {
    for (const set of sets) {
      const id = lookup(set);
      if (id && theme.iconDefinitions[id]) return theme.iconDefinitions[id].iconPath;
    }
    return undefined;
  };
  const byName = pick((set) => set.fileNames?.[name]);
  if (byName) return byName;
  // "course.flow.json": "flow.json" first, then "json"
  const segments = name.split('.');
  for (let start = 1; start < segments.length; start += 1) {
    const extension = segments.slice(start).join('.');
    const byExtension = pick((set) => set.fileExtensions?.[extension]);
    if (byExtension) return byExtension;
  }
  if (options.languageId) {
    const byLanguage = pick((set) => set.languageIds?.[options.languageId!]);
    if (byLanguage) return byLanguage;
  }
  return pick((set) => set.file);
}

// ── the click ──

/** One editor group's tabs: each tab's real path (null for a tab without a file), and which is in front. */
export interface TabGroupFact {
  viewColumn: number;
  isActive: boolean;
  tabs: { path: string | null; isActive: boolean }[];
}

export type BringForwardPlan = { kind: 'reveal'; group: number; tab: number } | { kind: 'open' };

/**
 * Where the document's tab is: in the active group if it is open there, else
 * in the first group that has it. None: it opens.
 */
export function planBringForward(
  groups: readonly TabGroupFact[],
  file: string,
  samePath: (a: string, b: string) => boolean = (a, b) => a === b,
): BringForwardPlan {
  const order = groups.map((group, index) => ({ group, index }))
    .sort((a, b) => Number(b.group.isActive) - Number(a.group.isActive));
  for (const { group, index } of order) {
    const tab = group.tabs.findIndex((entry) => entry.path !== null && samePath(entry.path, file));
    if (tab >= 0) return { kind: 'reveal', group: index, tab };
  }
  return { kind: 'open' };
}

export interface BringForwardDeps {
  groups(): readonly TabGroupFact[];
  /** Bring an open tab forward in its own group. */
  reveal(group: number, tab: number): Promise<void>;
  /** Open the document in a new tab (the workbench puts it beside the active one). */
  open(file: string): Promise<void>;
  /** Move the active group's active tab to the row's end. */
  moveActiveToEnd(): Promise<void>;
  samePath?(a: string, b: string): boolean;
}

/**
 * Bring the chat's document forward: its open tab, in its own group; or a new
 * tab at the row's end. A tab is moved only when the document is the one in
 * front after the open.
 */
export async function bringDocumentForward(file: string, deps: BringForwardDeps): Promise<'revealed' | 'opened'> {
  const same = deps.samePath ?? ((a: string, b: string) => a === b);
  const plan = planBringForward(deps.groups(), file, same);
  if (plan.kind === 'reveal') {
    await deps.reveal(plan.group, plan.tab);
    return 'revealed';
  }
  await deps.open(file);
  const active = deps.groups().find((group) => group.isActive);
  const at = active ? active.tabs.findIndex((tab) => tab.isActive) : -1;
  const inFront = active && at >= 0 ? active.tabs[at] : undefined;
  if (active && inFront?.path && same(inFront.path, file) && at < active.tabs.length - 1) await deps.moveActiveToEnd();
  return 'opened';
}
