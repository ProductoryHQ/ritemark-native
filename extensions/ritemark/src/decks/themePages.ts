/**
 * themePages — a theme file opened in its own tab (Sprint 162 PR 2; README "Themes (15 November)" and "Saving a
 * theme", frames 11, 14, 18 and 19).
 *
 * The tab is a path-based mode of the one Markdown editor, as a deck is (`deckPages`): a `Slide library/Themes/
 * <Name>.theme.md` opens in the Ritemark editor, which draws the theme's tab instead of the text. So the draft is the
 * theme document's unsaved text: the tab gets VS Code's own dot, Save and Cmd+S write the file, closing the tab with a
 * draft asks first, a window reload keeps the draft, and a writer's change on disk goes through the document's own
 * conflict handling. The decks read their theme from the file on disk (`readProjectTheme`), never from the document, so
 * they keep their look until Save, and follow it once the file is written (`DeckPages.themeFilesChanged`).
 *
 * This is the host's side of the mode:
 *   - which documents open as themes (`themeModeOf`: the flag, a file in the project's `Slide library/Themes`);
 *   - the tab's `theme/*` requests, decoded with exact fields (`decodeThemeRequest`) and answered to that one webview:
 *     a change to the draft (`themeTextWith`, only the lines of the fields that changed), Save, Discard, Save as a new
 *     theme…, the Save notice's Undo, and opening a deck that uses it;
 *   - the Theme menu's Edit <Name> and New theme… for a deck (`open`, `make`).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { isEnabled } from '../features';
import { BUILT_IN_THEME, BUILT_IN_THEME_PATH, BUILT_IN_THEME_TEXT, isThemePath, parseTheme, themeEntries, themeKeyOf, themeOfEntry, THEMES_FOLDER, type ThemeEntry } from './deckTheme';
import { frontMatterField } from './deckFormat';
import { themeModeOf } from './deckMode';
import { deckName, type DeckLibrary } from './DeckLibrary';
import { projectRelative, projectRoot } from './deckDocuments';
import { logoWebviewUri, projectThemeFiles, readThemeOrEvening, resolveAssetsIn, themeLogoFile, type DeckPages } from './deckPages';
import { logoNames, logoProblem, logoKindOfName, MAX_LOGO_BYTES, LOGO_TOO_LARGE } from './themeLogo';
import { newThemeNameProblem, newThemeText, themePathFor, themeTextWith, type ThemeStart } from './themeFile';
import { decodeThemeRequest, ThemeProtocolError, type ThemeDeck, type ThemeHostMessage, type ThemeLogoState, type ThemePreview, type ThemeRequest } from './themeProtocol';
import { deckPreview, SAMPLE_DECK_TEXT } from './themePreview';
import { ensureProjectSubfolder } from '../projects/projectFolderGuard';

/** The project's decks and themes, read once for an answer (`ThemePages.snapshot`). */
interface ProjectThemes {
  decks: Array<{ path: string; theme: string | null; text: string; modified: number }>;
  entries: ThemeEntry[];
  folderFiles: string[];
}

/** One open theme tab: its document and panel. */
interface ThemeView {
  document: vscode.TextDocument;
  panel: vscode.WebviewPanel;
  /** The last state sent (Sprint 162 PR 4: the logo is looked up on disk first), so an older one never comes after it. */
  stateSerial: number;
}

/** A Save its notice's Undo can take back: the file's text before it and the text it wrote. */
interface SavedTheme {
  token: string;
  before: string;
  after: string;
}

const RITEMARK_EDITOR = 'ritemark.editor';
/** How long a theme's Save mark holds (a Save that failed never ends it). */
const SAVE_MARK_MS = 5000;
/** At most this many steps of a draft's own Undo. */
const MAX_UNDO = 100;

/** The folder a theme or a deck at `fsPath` belongs to: its project folder, or null outside one. */
function rootOf(fsPath: string): string | null {
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath));
  return folder && folder.uri.scheme === 'file' ? folder.uri.fsPath : null;
}

/** A path as a key that finds the same file whatever its case or separators (macOS and Windows find it so). */
function keyOf(fsPath: string): string {
  return path.normalize(fsPath).toLowerCase();
}

export class ThemePages implements vscode.Disposable {
  private readonly views = new Set<ThemeView>();
  /** The deck each theme was last opened from (Edit, New theme…), by the theme file's key: the deck its tab previews. */
  private readonly origins = new Map<string, string>();
  /** Each open theme document's text as its file holds it, by URI: what Discard and a change back to it return to. */
  private readonly diskTexts = new Map<string, string>();
  /** The last Save of each theme document, by URI, for its notice's Undo. */
  private readonly saves = new Map<string, SavedTheme>();
  /** A line for a theme's tab that is still to come (Save as a new theme…), by the new file's key. */
  private readonly pendingNotice = new Map<string, string>();
  /** Theme documents whose Save is the Undo of a Save, by URI. */
  private readonly undoing = new Set<string>();
  /**
   * Theme documents being saved, by URI, from VS Code's will-save to its did-save, with the time it started: a Save that
   * fails never says it's done, so a mark older than a few seconds no longer counts.
   */
  private readonly saving = new Map<string, number>();
  /** The draft's own Undo and Redo (Cmd+Z in the tab): the texts it had, by URI. */
  private readonly history = new Map<string, { undo: string[]; redo: string[] }>();
  /** Each theme document's requests, one after another, by URI. */
  private readonly queues = new Map<string, Promise<void>>();
  private readonly subscriptions: vscode.Disposable[] = [];
  private decksTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly library: () => DeckLibrary | null, private readonly decks: DeckPages) {
    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        for (const view of this.views) {
          if (view.document !== event.document) continue;
          this.nameTab(view);
          this.postState(view);
        }
      }),
      // A Save of a theme is `saved`'s: the file's text before it is what the notice's Undo puts back, so the watcher
      // leaves the file's text alone until `saved` has taken it.
      vscode.workspace.onWillSaveTextDocument(event => {
        if (this.hasView(event.document)) this.saving.set(event.document.uri.toString(), Date.now());
      }),
      vscode.workspace.onDidSaveTextDocument(document => {
        this.saving.delete(document.uri.toString());
        // A deck saved (its `theme:` line, New theme…'s pick): the open themes' "Used by" and preview follow.
        if (document.uri.scheme === 'file' && /\.deck\.md$/i.test(document.uri.fsPath)) this.decksChanged();
        const views = [...this.views].filter(view => view.document === document);
        if (views.length > 0) void this.saved(document, views);
      }),
    );
    // A theme file written (the tab's Save, an AI, another program): the open decks that read it draw it again, and an
    // open theme takes the file's text as what it holds now. Watched by name, so a theme folder that comes later is
    // covered too.
    const watcher = vscode.workspace.createFileSystemWatcher(`**/${THEMES_FOLDER}/*.theme.md`);
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const changed = (uri: vscode.Uri) => {
      const key = uri.toString();
      clearTimeout(timers.get(key));
      timers.set(key, setTimeout(() => {
        timers.delete(key);
        void this.fileChanged(uri);
      }, 80));
    };
    this.subscriptions.push(watcher, watcher.onDidChange(changed), watcher.onDidCreate(changed), watcher.onDidDelete(changed), {
      dispose: () => { for (const timer of timers.values()) clearTimeout(timer); },
    });
    // Sprint 162 PR 4 (the review of #785): a logo picture put back, replaced in place or removed beside a theme: the
    // open theme tabs and decks draw it (or its absence) again, at once.
    const logos = vscode.workspace.createFileSystemWatcher(`**/${THEMES_FOLDER}/**/*.{svg,png,SVG,PNG}`);
    let logoTimer: ReturnType<typeof setTimeout> | undefined;
    const logoChanged = () => {
      clearTimeout(logoTimer);
      logoTimer = setTimeout(() => {
        for (const view of this.views) this.postState(view);
        void this.decks.logoFilesChanged();
      }, 120);
    };
    this.subscriptions.push(logos, logos.onDidChange(logoChanged), logos.onDidCreate(logoChanged), logos.onDidDelete(logoChanged), {
      dispose: () => clearTimeout(logoTimer),
    });
  }

  private isSaving(key: string): boolean {
    const started = this.saving.get(key);
    return started !== undefined && Date.now() - started < SAVE_MARK_MS;
  }

  private hasView(document: vscode.TextDocument): boolean {
    return [...this.views].some(view => view.document === document);
  }

  /** The file of an open theme as it is on disk now; null when it can't be read. */
  private async readDisk(document: vscode.TextDocument): Promise<string | null> {
    try {
      return await fs.promises.readFile(document.uri.fsPath, 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * A theme file changed on disk: an open theme's file text follows it (a writer's change while a draft is open is the
   * file's now, so Discard and a change back go to it, and a Save's Undo never writes over it), except while its own
   * Save is under way. Then the open decks that read that file draw it again.
   */
  private async fileChanged(uri: vscode.Uri): Promise<void> {
    const key = uri.toString();
    const document = [...this.views].find(view => view.document.uri.toString() === key)?.document;
    if (document && !this.isSaving(key)) {
      const text = await this.readDisk(document);
      if (text !== null && !this.isSaving(key)) this.diskTexts.set(key, text);
    }
    const root = rootOf(uri.fsPath);
    const relative = root ? projectRelative(root, uri.fsPath) : null;
    if (relative) await this.decks.themeFilesChanged(relative);
  }

  /** The open theme tabs read their decks again, once the decks' saves have settled. */
  private decksChanged(): void {
    clearTimeout(this.decksTimer);
    this.decksTimer = setTimeout(() => { for (const view of this.views) void this.postDecks(view); }, 200);
  }

  /**
   * One request at a time for each theme document: a change is worked out from the text the one before it left, never
   * from a text an earlier edit is still changing.
   */
  private queue(document: vscode.TextDocument, run: () => Promise<void>): Promise<void> {
    const key = document.uri.toString();
    const next = (this.queues.get(key) ?? Promise.resolve()).then(run, run);
    const settled = next.catch(error => console.warn('[Themes] A request failed:', error));
    this.queues.set(key, settled);
    void settled.then(() => { if (this.queues.get(key) === settled) this.queues.delete(key); });
    return settled;
  }

  /** Does this document open as a theme? `flagOn` is the flag now unless given (a connected view's, as it opened). */
  themeModeFor(document: vscode.TextDocument, flagOn = isEnabled('decks')): boolean {
    const root = document.uri.scheme === 'file' ? rootOf(document.uri.fsPath) : null;
    return themeModeOf({ flagOn, scheme: document.uri.scheme, relative: root ? projectRelative(root, document.uri.fsPath) : null });
  }

  /** A theme's panel, while it is open. Its tab is named after the theme. */
  connect(document: vscode.TextDocument, panel: vscode.WebviewPanel): vscode.Disposable {
    const view: ThemeView = { document, panel, stateSerial: 0 };
    this.views.add(view);
    const uri = document.uri.toString();
    if (!this.diskTexts.has(uri)) {
      if (!document.isDirty) this.diskTexts.set(uri, document.getText());
      else void this.readDisk(document).then(text => { if (text !== null && !this.diskTexts.has(uri)) this.diskTexts.set(uri, text); });
    }
    this.nameTab(view);
    return {
      dispose: () => {
        this.views.delete(view);
        if (![...this.views].some(other => other.document === document)) {
          this.diskTexts.delete(uri);
          this.saves.delete(uri);
          this.history.delete(uri);
        }
      },
    };
  }

  /** The tab shows the theme's name (README frame 11), as the draft reads it. */
  private nameTab(view: ThemeView): void {
    const name = parseTheme(view.document.getText()).name;
    if (view.panel.title !== name) view.panel.title = name;
  }

  /** One request from a theme's tab; the answer goes to that webview only. */
  async handle(document: vscode.TextDocument, webview: vscode.Webview, message: unknown): Promise<void> {
    const view = [...this.views].find(entry => entry.panel.webview === webview && entry.document === document);
    if (!view) return;
    let request: ThemeRequest;
    try {
      request = decodeThemeRequest(message);
    } catch (error) {
      if (error instanceof ThemeProtocolError) {
        console.warn('[Themes] Dropped a malformed request:', error.message);
        return;
      }
      throw error;
    }
    switch (request.type) {
      case 'theme/ready': {
        this.postState(view);
        await this.postDecks(view);
        const notice = this.pendingNotice.get(keyOf(document.uri.fsPath));
        if (notice) {
          this.pendingNotice.delete(keyOf(document.uri.fsPath));
          await this.post(webview, { type: 'theme/notice', text: notice });
        }
        return;
      }
      // Each of these changes the document or the file: one at a time, each from the text the one before left.
      case 'theme/set': {
        const changes = request.changes;
        await this.queue(document, () => this.change(view, themeTextWith(document.getText(), changes), 'edit'));
        return;
      }
      // Cmd+Z and Cmd+Shift+Z in the tab: the draft's own steps (the editor's Undo keys do nothing in a theme's tab).
      case 'theme/undo':
      case 'theme/redo': {
        const back = request.type === 'theme/undo';
        await this.queue(document, async () => {
          const steps = this.stepsOf(document);
          const text = (back ? steps.undo : steps.redo).pop();
          if (text === undefined) return;
          (back ? steps.redo : steps.undo).push(document.getText());
          await this.change(view, text, 'history');
        });
        return;
      }
      case 'theme/save':
        await this.queue(document, async () => { if (document.isDirty) await document.save(); });
        return;
      case 'theme/discard':
        await this.queue(document, () => this.discard(view));
        return;
      case 'theme/save-as': {
        const { name, use } = request;
        await this.queue(document, () => this.saveAs(view, name, use));
        return;
      }
      case 'theme/open-deck': {
        const root = rootOf(document.uri.fsPath);
        const absolute = root ? path.resolve(root, request.path) : null;
        if (!root || !absolute || !projectRelative(root, absolute) || !fs.existsSync(absolute)) return;
        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(absolute), RITEMARK_EDITOR, { preview: false });
        return;
      }
      case 'theme/undo-save': {
        const token = request.token;
        await this.queue(document, () => this.undoSave(view, token));
        return;
      }
      case 'theme/logo-file': {
        const { dataUrl, filename } = request;
        const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
        await this.queue(document, () => this.takeLogo(view, filename, bytes));
        return;
      }
      case 'theme/choose-logo': {
        const picked = await this.chooseLogo(view);
        if (picked) await this.queue(document, () => this.takeLogo(view, picked.name, picked.bytes));
        return;
      }
    }
  }

  /** Choose a file… on the Logo row: an SVG or a PNG, from the project's folder at first. Null when nothing is taken. */
  private async chooseLogo(view: ThemeView): Promise<{ name: string; bytes: Buffer } | null> {
    const root = rootOf(view.document.uri.fsPath);
    const picked = await vscode.window.showOpenDialog({
      title: 'Choose the theme\'s logo',
      openLabel: 'Use as the logo',
      canSelectMany: false,
      canSelectFolders: false,
      defaultUri: root ? vscode.Uri.file(root) : undefined,
      filters: { 'Logo (SVG or PNG)': ['svg', 'png'] },
    });
    const uri = picked?.[0];
    if (!uri || uri.scheme !== 'file') return null;
    try {
      const stat = await fs.promises.stat(uri.fsPath);
      if (!stat.isFile()) return null;
      if (stat.size > MAX_LOGO_BYTES) {
        await this.post(view.panel.webview, { type: 'theme/notice', text: LOGO_TOO_LARGE });
        return null;
      }
      return { name: path.basename(uri.fsPath), bytes: await fs.promises.readFile(uri.fsPath) };
    } catch {
      await this.post(view.panel.webview, { type: 'theme/notice', text: 'That file could not be read.' });
      return null;
    }
  }

  /**
   * A logo dropped or chosen (step-3-themes.md, "Logo"): checked (`logoProblem`: an SVG or a PNG, small, an SVG with
   * nothing in it that runs or loads), copied beside the theme file as `<theme> logo.svg` (`themeLogo.logoNames`:
   * never over another picture; the same picture already there is used), and named in the draft's `logo:` line. The
   * decks get it with Save, as any change. Discard leaves the copy beside the theme (Undo in the draft can name it
   * again), and nothing of Ritemark's removes a picture.
   */
  private async takeLogo(view: ThemeView, name: string, bytes: Buffer): Promise<void> {
    const say = (text: string) => this.post(view.panel.webview, { type: 'theme/notice', text });
    const problem = logoProblem(name, bytes);
    const kind = logoKindOfName(name);
    if (problem || !kind) {
      await say(problem ?? 'A logo is an SVG or a PNG picture.');
      return;
    }
    const themeFile = view.document.uri.fsPath;
    const folder = path.dirname(themeFile);
    const root = rootOf(themeFile);
    try {
      // The theme's folder is inside the project once links are followed: a linked folder never takes the copy out.
      const [realRoot, realFolder] = root ? await Promise.all([fs.promises.realpath(root), fs.promises.realpath(folder)]) : ['', ''];
      if (root && realFolder !== realRoot && !projectRelative(realRoot, realFolder)) {
        await say('The theme\'s folder is outside the project, so the logo was not copied.');
        return;
      }
      let chosen: string | null = null;
      for (const candidate of logoNames(path.basename(themeFile), kind)) {
        const target = path.join(folder, candidate);
        try {
          await fs.promises.writeFile(target, bytes, { flag: 'wx' });
          chosen = candidate;
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error;
          // Taken: the same picture is used as it is; another picture, or anything else, is never written over.
          const there = await fs.promises.lstat(target);
          if (there.isFile() && !there.isSymbolicLink() && there.size === bytes.length && (await fs.promises.readFile(target)).equals(bytes)) {
            chosen = candidate;
            break;
          }
        }
      }
      if (!chosen) {
        await say('The logo could not be copied beside the theme.');
        return;
      }
      await this.change(view, themeTextWith(view.document.getText(), { logo: chosen }), 'edit');
      await say(`The logo is beside the theme file, as ${chosen}. Save puts it on the decks.`);
    } catch (error) {
      console.warn('[Themes] Could not copy the logo:', error);
      await say('The logo could not be copied beside the theme.');
    }
  }

  /**
   * The draft becomes `text`: one edit of the document, for the lines that differ. A draft changed back to the file's
   * own text is no draft: the document goes back to the file, and its dot goes.
   */
  private async change(view: ThemeView, text: string, kind: 'edit' | 'history'): Promise<void> {
    const document = view.document;
    const current = document.getText();
    if (text === current) return;
    if (kind === 'edit') {
      const steps = this.stepsOf(document);
      steps.undo.push(current);
      if (steps.undo.length > MAX_UNDO) steps.undo.shift();
      steps.redo.length = 0;
    }
    // The file as it is now, not as it was when the tab opened: a writer may have changed it since.
    if (document.isDirty && text === (await this.readDisk(document)) && (await this.revert(view))) return;
    await replaceText(document, text);
  }

  private stepsOf(document: vscode.TextDocument): { undo: string[]; redo: string[] } {
    const key = document.uri.toString();
    let steps = this.history.get(key);
    if (!steps) this.history.set(key, steps = { undo: [], redo: [] });
    return steps;
  }

  /** Discard: the document goes back to the file. */
  private async discard(view: ThemeView): Promise<void> {
    if (!view.document.isDirty) return;
    if (await this.revert(view)) return;
    // Not the active editor (it lost the focus meanwhile): the file's text, which leaves the dot until Save.
    const disk = await this.readDisk(view.document);
    if (disk !== null) await replaceText(view.document, disk);
  }

  /**
   * VS Code's own Revert, for this tab: its document takes the file's text and is no longer changed. Only while the tab
   * is the active editor (the command reverts the active one), which it is while the person works in it.
   */
  private async revert(view: ThemeView): Promise<boolean> {
    const isActive = () => {
      const active = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
      return active instanceof vscode.TabInputCustom && active.uri.toString() === view.document.uri.toString() && view.panel.active;
    };
    // The focus may have moved meanwhile (a sheet, another group): the tab is brought forward first.
    if (!isActive()) {
      view.panel.reveal(view.panel.viewColumn, false);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!isActive()) return false;
    await vscode.commands.executeCommand('workbench.action.files.revert');
    return !view.document.isDirty;
  }

  /** Save wrote the file: the tab says how many decks have the new look, with Undo. */
  private async saved(document: vscode.TextDocument, views: ThemeView[]): Promise<void> {
    const uri = document.uri.toString();
    const before = this.diskTexts.get(uri);
    const after = document.getText();
    this.diskTexts.set(uri, after);
    if (before === undefined || before === after || this.undoing.has(uri)) {
      for (const view of views) this.postState(view);
      return;
    }
    const token = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    this.saves.set(uri, { token, before, after });
    const root = rootOf(document.uri.fsPath);
    const decks = root ? this.decksUsing(document, await this.snapshot(root)) : [];
    const name = parseTheme(after).name;
    const reach = decks.length === 0 ? 'No deck uses it yet.' : `${decks.length === 1 ? '1 deck has' : `${decks.length} decks have`} the new look. A published page keeps its look until you update it.`;
    for (const view of views) {
      this.postState(view);
      await this.post(view.panel.webview, { type: 'theme/notice', text: `${name} is saved. ${reach}`, token });
    }
  }

  /**
   * The Save notice's Undo: the file gets back the text it had before the Save, so the decks go back, and the changes
   * stay in the tab as a draft, not saved. Only while the file is still what that Save wrote and the tab holds no newer
   * draft; otherwise it says so and changes nothing.
   */
  private async undoSave(view: ThemeView, token: string): Promise<void> {
    const document = view.document;
    const uri = document.uri.toString();
    const save = this.saves.get(uri);
    if (!save || save.token !== token) return;
    this.saves.delete(uri);
    let onDisk: string | null = null;
    try {
      onDisk = await fs.promises.readFile(document.uri.fsPath, 'utf8');
    } catch {
      // Gone: nothing to put back.
    }
    if (document.isDirty || onDisk !== save.after || document.getText() !== save.after) {
      await this.post(view.panel.webview, { type: 'theme/notice', text: 'The theme was changed since, so it is left as it is.' });
      return;
    }
    // The Save this makes is the Undo's, not the person's: it says nothing of its own.
    this.undoing.add(uri);
    try {
      await replaceText(document, save.before);
      await document.save();
    } finally {
      this.undoing.delete(uri);
    }
    await replaceText(document, save.after);
    await this.post(view.panel.webview, { type: 'theme/notice', text: 'The decks are back as they were. Your changes are still here, not saved.' });
  }

  /**
   * Save as a new theme… (README "Saving a theme"): the draft goes into a new file by this name beside the theme; the
   * theme and its decks stay as they were (the draft is discarded here). The tab moves to the new theme, and with `use`
   * the deck the tab was opened from uses it.
   */
  private async saveAs(view: ThemeView, name: string, use: boolean): Promise<void> {
    const document = view.document;
    const root = rootOf(document.uri.fsPath);
    const answer = (message: ThemeHostMessage) => this.post(view.panel.webview, message);
    if (!root) {
      await answer({ type: 'theme/save-as', ok: false, problem: 'A theme can be saved as a new one only inside the open project.' });
      return;
    }
    const made = await this.writeNew(root, name, themeTextWith(document.getText(), { name: name.trim() }));
    if ('problem' in made) {
      await answer({ type: 'theme/save-as', ok: false, problem: made.problem });
      return;
    }
    const oldName = parseTheme(this.diskTexts.get(document.uri.toString()) ?? document.getText()).name;
    await answer({ type: 'theme/save-as', ok: true });
    const origin = this.origins.get(keyOf(document.uri.fsPath));
    if (origin) this.origins.set(keyOf(made.absolute), origin);
    // The draft goes, so the old theme's file and its decks stay as they were and its tab closes without asking.
    await this.discard(view);
    const usedHere = use && origin ? this.decks.useTheme(origin, made.relative, made.name) : false;
    this.pendingNotice.set(keyOf(made.absolute), `${made.name} is a new theme in Slide library › Themes. ${oldName} is as it was${usedHere ? `; ${deckName(projectRelative(root, origin!) ?? origin!)} uses ${made.name} now` : ''}.`);
    const column = view.panel.viewColumn;
    await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(made.absolute), RITEMARK_EDITOR, { preview: false, viewColumn: column });
    if (!document.isDirty) {
      const tab = vscode.window.tabGroups.all.flatMap(group => group.tabs)
        .find(entry => entry.input instanceof vscode.TabInputCustom && entry.input.uri.toString() === document.uri.toString());
      if (tab) await vscode.window.tabGroups.close(tab);
    }
  }

  /**
   * Write a new theme file in the project's `Slide library/Themes`, by the name rule (`newThemeNameProblem`: a name no
   * other theme there has, that a file name can hold). Never over another file.
   */
  private async writeNew(root: string, name: string, text: string): Promise<{ relative: string; absolute: string; name: string } | { problem: string }> {
    const taken = this.takenNames(await this.snapshot(root, false));
    const problem = newThemeNameProblem(name, taken);
    if (problem) return { problem };
    const relative = themePathFor(name);
    const absolute = path.join(root, ...relative.split('/'));
    try {
      const folder = await ensureProjectSubfolder(root, THEMES_FOLDER);
      // The folder is inside the project once links are followed: a linked folder never takes the file outside it.
      const [realRoot, realFolder] = await Promise.all([fs.promises.realpath(root), fs.promises.realpath(folder)]);
      if (!projectRelative(realRoot, realFolder)) return { problem: 'The Themes folder is outside the project, so the theme was not written.' };
      await fs.promises.writeFile(absolute, text, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      return { problem: code === 'EEXIST' ? `There's a file called ${path.basename(absolute)} already. Give the theme another name.` : 'The theme file could not be written.' };
    }
    return { relative, absolute, name: name.trim() };
  }

  /**
   * What the project holds, read once for each answer: its decks with their `theme:` lines, its theme files, and the
   * file names in the Themes folder (also those that can't be read as themes).
   */
  private async snapshot(root: string, withDecks = true): Promise<ProjectThemes> {
    const library = withDecks ? this.library() : null;
    let decks: ProjectThemes['decks'] = [];
    if (library && path.resolve(projectRoot() ?? '') === path.resolve(root)) {
      try {
        decks = await library.deckThemeList();
      } catch (error) {
        console.warn('[Themes] Could not read the decks:', error);
      }
    }
    const [files, names] = await Promise.all([
      projectThemeFiles(root),
      fs.promises.readdir(path.join(root, THEMES_FOLDER)).then(all => all.filter(file => /\.theme\.md$/i.test(file)), () => [] as string[]),
    ]);
    return { decks, entries: themeEntries(files, []), folderFiles: names };
  }

  /** The names and file names the project's themes already have: the files in the folder and the built-in Evening. */
  private takenNames(project: ProjectThemes): { names: string[]; files: string[] } {
    return { names: project.entries.map(entry => themeOfEntry(entry).name), files: project.folderFiles };
  }

  /**
   * The Theme menu's Edit <Name> (frame 12): the theme file the deck draws opens in its tab, which previews this deck.
   * Only a file the project has: the built-in Evening has none until one is made.
   */
  async open(deck: vscode.TextDocument, themePath: string): Promise<void> {
    const root = rootOf(deck.uri.fsPath);
    if (!root || !isThemePath(themePath)) return;
    const absolute = path.resolve(root, themePath);
    if (!projectRelative(root, absolute) || !fs.existsSync(absolute)) return;
    this.origins.set(keyOf(absolute), deck.uri.fsPath);
    // Its tab, when it is open already, previews this deck now.
    for (const view of this.views) if (keyOf(view.document.uri.fsPath) === keyOf(absolute)) await this.postDecks(view);
    await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(absolute), RITEMARK_EDITOR, { preview: false });
  }

  /**
   * New theme… (frame 14): a theme file by this name, started from the deck's theme (a copy of the file it draws, or of
   * the built-in theme), Paper or Ember. With `use`, the deck uses it (its view writes the line, one Undo). Then the
   * theme's tab opens, previewing this deck. Answers the sheet: made, or why not.
   */
  async make(deck: vscode.TextDocument, request: { name: string; start: ThemeStart; use: boolean }): Promise<{ ok: true; path: string; name: string } | { ok: false; problem: string }> {
    const root = rootOf(deck.uri.fsPath);
    if (!root || !projectRelative(root, deck.uri.fsPath)) return { ok: false, problem: 'A theme can be made for a deck inside the open project.' };
    const copy = request.start === 'copy'
      ? (await readThemeOrEvening(root, frontMatterField(deck.getText().replace(/^﻿/, ''), 'theme'))) ?? BUILT_IN_THEME_TEXT
      : '';
    const made = await this.writeNew(root, request.name, newThemeText(request.name, request.start, copy));
    if ('problem' in made) return { ok: false, problem: made.problem };
    this.origins.set(keyOf(made.absolute), deck.uri.fsPath);
    if (request.use) this.decks.useTheme(deck.uri.fsPath, made.relative, made.name);
    this.pendingNotice.set(keyOf(made.absolute), `${made.name} is in Slide library › Themes.${request.use ? ` ${deckName(projectRelative(root, deck.uri.fsPath)!)} uses it.` : ''}`);
    try {
      await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(made.absolute), RITEMARK_EDITOR, { preview: false });
    } catch (error) {
      // The theme is made either way; its tab can be opened from Documents or the menu's Edit.
      console.warn('[Themes] Could not open the new theme:', error);
    }
    return { ok: true, path: made.relative, name: made.name };
  }

  /** The project's decks that draw this theme (its file, or Evening's path when it is the project's own Evening). */
  private decksUsing(document: vscode.TextDocument, project: ProjectThemes): Array<ThemeDeck & { text: string; modified: number }> {
    const root = rootOf(document.uri.fsPath);
    const relative = root ? projectRelative(root, document.uri.fsPath) : null;
    if (!relative) return [];
    const own = project.entries.find(entry => entry.path.toLowerCase() === relative.toLowerCase())?.path
      ?? (relative.toLowerCase() === BUILT_IN_THEME_PATH.toLowerCase() ? BUILT_IN_THEME_PATH : relative);
    return project.decks
      .filter(deck => themeKeyOf(deck.theme, project.entries) === own)
      .map(deck => ({ path: deck.path, name: deckName(deck.path), text: deck.text, modified: deck.modified }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The decks, the preview and the names taken, for the tab. */
  private async postDecks(view: ThemeView): Promise<void> {
    const document = view.document;
    const root = rootOf(document.uri.fsPath);
    const project = root ? await this.snapshot(root) : null;
    const using = project ? this.decksUsing(document, project) : [];
    const originPath = this.origins.get(keyOf(document.uri.fsPath));
    const library = this.library();
    // The deck it previews: the one it was opened from, else the first that uses it, else any deck, else the sample.
    let source: { path: string | null; text: string; folder: string | null } | null = null;
    if (originPath && root) {
      const relative = projectRelative(root, originPath);
      const open = vscode.workspace.textDocuments.find(entry => entry.uri.scheme === 'file' && keyOf(entry.uri.fsPath) === keyOf(originPath));
      const text = open?.getText() ?? (relative && library ? await library.readDeckText(relative) : null);
      if (relative && text !== null) source = { path: relative, text, folder: path.dirname(originPath) };
    }
    if (!source && using.length && root) {
      const first = using[0];
      source = { path: first.path, text: first.text, folder: path.dirname(path.join(root, ...first.path.split('/'))) };
    }
    if (!source && root && project) {
      const any = [...project.decks].sort((a, b) => b.modified - a.modified)[0];
      if (any) source = { path: any.path, text: any.text, folder: path.dirname(path.join(root, ...any.path.split('/'))) };
    }
    const shown = deckPreview(source?.path ?? null, source?.text ?? SAMPLE_DECK_TEXT);
    const slides = shown.slides.length ? shown : deckPreview(null, SAMPLE_DECK_TEXT);
    const preview: ThemePreview = {
      deck: slides.deck,
      borderless: slides.borderless,
      slides: slides.slides,
      assets: source?.folder && slides.pictures.length ? resolveAssetsIn(source.folder, view.panel.webview, slides.pictures) : {},
    };
    const useIn = originPath && this.decks.hasView(originPath) && root ? deckName(projectRelative(root, originPath) ?? originPath) : null;
    await this.post(view.panel.webview, {
      type: 'theme/decks',
      decks: using.map(deck => ({ path: deck.path, name: deck.name })),
      preview,
      useIn,
      taken: project ? this.takenNames(project) : { names: [BUILT_IN_THEME.name], files: [] },
    });
  }

  private postState(view: ThemeView): void {
    const root = rootOf(view.document.uri.fsPath);
    const serial = ++view.stateSerial;
    const text = view.document.getText();
    const state = {
      type: 'theme/state' as const,
      path: (root && projectRelative(root, view.document.uri.fsPath)) || path.basename(view.document.uri.fsPath),
      text,
      dirty: view.document.isDirty,
    };
    void this.logoState(view, text).then(logo => {
      // A newer state was sent meanwhile: this one is stale.
      if (serial === view.stateSerial) void this.post(view.panel.webview, { ...state, logo });
    });
  }

  /**
   * Sprint 162 PR 4: the draft's logo as the tab shows it: its file beside the theme, drawn when it is there and can be
   * the logo, and otherwise why not ("The logo file … is missing.").
   */
  private async logoState(view: ThemeView, text: string): Promise<ThemeLogoState | null> {
    const theme = parseTheme(text);
    if (!theme.logo) return null;
    const themeFile = view.document.uri.fsPath;
    const root = rootOf(themeFile) ?? path.dirname(themeFile);
    const relative = projectRelative(root, themeFile) ?? path.basename(themeFile);
    const found = await themeLogoFile(root, relative, theme).catch(() => ({ state: 'missing' as const, file: theme.logo!.file }));
    switch (found.state) {
      case 'found': return { file: found.file, url: logoWebviewUri(view.panel.webview, found), problem: null };
      case 'missing': return { file: found.file, url: null, problem: `The logo's file, ${found.file}, isn't beside the theme. The slides show no logo until it's back, or you choose another.` };
      case 'refused': return { file: found.file, url: null, problem: found.problem };
      default: return null;
    }
  }

  private async post(webview: vscode.Webview, message: ThemeHostMessage): Promise<boolean> {
    try {
      return await webview.postMessage(message);
    } catch {
      // The view closed meanwhile.
      return false;
    }
  }

  dispose(): void {
    clearTimeout(this.decksTimer);
    for (const subscription of this.subscriptions) subscription.dispose();
    this.views.clear();
  }
}

/** The document's text becomes `text`: one edit, of the span between the first and the last character that differ. */
async function replaceText(document: vscode.TextDocument, text: string): Promise<boolean> {
  const current = document.getText();
  if (current === text) return true;
  let start = 0;
  while (start < current.length && start < text.length && current[start] === text[start]) start++;
  let end = 0;
  while (end < current.length - start && end < text.length - start && current[current.length - 1 - end] === text[text.length - 1 - end]) end++;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(document.positionAt(start), document.positionAt(current.length - end)), text.slice(start, text.length - end));
  return vscode.workspace.applyEdit(edit);
}
