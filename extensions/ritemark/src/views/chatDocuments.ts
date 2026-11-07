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

import { normalizeForCompare } from '../utils/pathIdentity';

/** One file a chat changed, as the index keeps it (PR 1's `ConversationChangedFileV1`). */
export interface ChangedFileFact {
  path: string;
  changedAt: string;
}

/** A chat's document: the newest changed file that exists, and how many other existing files it changed. */
export interface ChatDocument {
  /** The file's real path: only the comparison key with the document in front, never opened. */
  path: string;
  /** The path the project uses for the file, as its turn stored it: what a click opens (a real path may be `/private/...`). */
  openPath: string;
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
    // Compared the platform's way: on Windows one file may come in either case or slash
    const key = real ? normalizeForCompare(real) : null;
    if (!real || !key || seen.has(key)) continue;
    seen.add(key);
    if (!first) first = { real, stored: entry.path };
  }
  if (!first) return null;
  return { path: first.real, openPath: first.stored, name: fileNameOf(first.stored), more: seen.size - 1 };
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

// ── a file's language, from the installed extensions ──

/** One language an extension contributes (`contributes.languages`), the parts that name files. */
export interface LanguageContribution {
  id?: string;
  extensions?: string[];
  filenames?: string[];
}

/**
 * A file's language id from the installed extensions' `contributes.languages`,
 * as the workbench assigns it: an exact file name first, then the longest
 * extension (".flow.json" before ".json"), each case-insensitively. Built once
 * from the list; the host builds it again when extensions change. So a closed
 * `.mdown` gets markdown's icon, as its tab does.
 */
export class LanguageLookup {
  private readonly byName = new Map<string, string>();
  private readonly byExtension = new Map<string, string>();
  private readonly cache = new Map<string, string | undefined>();

  constructor(languages: readonly LanguageContribution[]) {
    for (const language of languages) {
      if (!language?.id) continue;
      for (const name of language.filenames ?? []) {
        const key = name.toLowerCase();
        if (!this.byName.has(key)) this.byName.set(key, language.id);
      }
      for (const extension of language.extensions ?? []) {
        const key = extension.toLowerCase().replace(/^\./, '');
        if (key && !this.byExtension.has(key)) this.byExtension.set(key, language.id);
      }
    }
  }

  languageOf(file: string): string | undefined {
    const name = fileNameOf(file).toLowerCase();
    if (this.cache.has(name)) return this.cache.get(name);
    let found = this.byName.get(name);
    if (!found) {
      const segments = name.split('.');
      for (let start = 1; start < segments.length && !found; start += 1) found = this.byExtension.get(segments.slice(start).join('.'));
    }
    this.cache.set(name, found);
    return found;
  }
}

// ── the files' facts, cached between file events ──

/**
 * Real paths, cached so a tab change never makes the host read the disk again
 * for every file of every chat. The host clears it on the workspace's file
 * create, delete and rename events (`clear`). A file that was gone is asked
 * again after a chat changed files (`forgetMissing`): a turn may make it again
 * without a workspace event, and gone files are few.
 */
export class RealPathCache {
  private readonly known = new Map<string, string | null>();

  constructor(private readonly realPath: (file: string) => string | null) {}

  get(file: string): string | null {
    if (!this.known.has(file)) this.known.set(file, this.realPath(file));
    return this.known.get(file) ?? null;
  }

  clear(): void { this.known.clear(); }

  forgetMissing(): void {
    for (const [file, real] of this.known) if (real === null) this.known.delete(file);
  }
}

// ── the sheet's copy ──

export interface ChatDocumentsMessage {
  type: 'chat-documents';
  documents: Record<string, ChatDocumentView>;
  front: string | null;
}

export interface ChatDocumentsPublisherDeps<View> {
  /** The sheet's view now (undefined while it is not resolved). */
  view(): View | undefined;
  documents(view: View): Promise<Record<string, ChatDocumentView>>;
  /** The real path of the document in front, read after the documents' await. */
  front(): string | null;
  post(view: View, message: ChatDocumentsMessage): Thenable<boolean> | Promise<boolean>;
}

/**
 * Posts every chat's document and the document in front to the sheet, only
 * when they changed since the last post. Sends overlap (a conversation change
 * and a tab change a moment apart): only the newest one posts. A sheet resolved
 * again (moved, Reload Webviews, its process restarted) has lost its copy, so
 * the host calls `reset` before the bootstrap's send.
 */
export class ChatDocumentsPublisher<View> {
  private sequence = 0;
  private sent: { documents: Record<string, ChatDocumentView>; front: string | null } | undefined;

  constructor(private readonly deps: ChatDocumentsPublisherDeps<View>) {}

  reset(): void { this.sent = undefined; }

  /** True when this send posted. */
  async send(): Promise<boolean> {
    const view = this.deps.view();
    if (!view) return false;
    const sequence = ++this.sequence;
    const documents = await this.deps.documents(view);
    if (sequence !== this.sequence || view !== this.deps.view()) return false;
    const front = this.deps.front();
    const sent = this.sent;
    if (sent && sent.front === front && JSON.stringify(sent.documents) === JSON.stringify(documents)) return false;
    this.sent = { documents, front };
    const delivered = await this.deps.post(view, { type: 'chat-documents', documents, front });
    if (delivered === false) this.sent = undefined;
    return delivered !== false;
  }
}

// ── the click ──

/**
 * One editor group's tabs: each tab's real path (null for a tab without a file), and which is in front. A diff tab
 * (File changes, Review) is marked: it shows the file but is not the document's tab, so a click never "reveals" it.
 */
export interface TabGroupFact {
  viewColumn: number;
  isActive: boolean;
  tabs: { path: string | null; isActive: boolean; isDiff?: boolean }[];
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
    const tab = group.tabs.findIndex((entry) => !entry.isDiff && entry.path !== null && samePath(entry.path, file));
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
  /**
   * The tab model's change event. A custom editor (Ritemark's .md) may show its tab after the open command resolved,
   * so the move waits for the document's tab in front, at most `tabWaitMs`. Without it nothing waits.
   */
  onDidChangeTabs?(listener: () => void): { dispose(): void };
  tabWaitMs?: number;
}

/** Resolves when `ready()` holds, checked now and on each `subscribe` event, or after `timeoutMs`. */
export function waitUntil(
  ready: () => boolean,
  subscribe: ((listener: () => void) => { dispose(): void }) | undefined,
  timeoutMs: number,
): Promise<boolean> {
  if (ready()) return Promise.resolve(true);
  if (!subscribe) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    let subscription: { dispose(): void } | undefined;
    const finish = (value: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      subscription?.dispose();
      resolve(value);
    };
    const timer = setTimeout(() => finish(ready()), timeoutMs);
    subscription = subscribe(() => { if (ready()) finish(true); });
    if (done) subscription.dispose();
  });
}

/**
 * Bring the chat's document forward: its open tab, in its own group; or a new
 * tab at the row's end. A tab is moved only when the document is the one in
 * front after the open.
 */
export async function bringDocumentForward(file: string, deps: BringForwardDeps, openPath: string = file): Promise<'revealed' | 'opened'> {
  const same = deps.samePath ?? ((a: string, b: string) => a === b);
  const plan = planBringForward(deps.groups(), file, same);
  if (plan.kind === 'reveal') {
    await deps.reveal(plan.group, plan.tab);
    return 'revealed';
  }
  // The path the project uses: a real path may differ (`/private/...` on macOS)
  await deps.open(openPath);
  const documentInFront = () => {
    const active = deps.groups().find((group) => group.isActive);
    const at = active ? active.tabs.findIndex((tab) => tab.isActive) : -1;
    const inFront = active && at >= 0 ? active.tabs[at] : undefined;
    return active && inFront?.path && !inFront.isDiff && same(inFront.path, file) ? { active, at } : undefined;
  };
  await waitUntil(() => documentInFront() !== undefined, deps.onDidChangeTabs?.bind(deps), deps.tabWaitMs ?? 1500);
  const found = documentInFront();
  if (found && found.at < found.active.tabs.length - 1) await deps.moveActiveToEnd();
  return 'opened';
}
