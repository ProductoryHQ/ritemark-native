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
import { BUILT_IN_THEME, BUILT_IN_THEME_PATH, BUILT_IN_THEME_TEXT, isThemePath, parseTheme, themeEntries, themeKeyOf, themeOfEntry, THEMES_FOLDER } from './deckTheme';
import { frontMatterField } from './deckFormat';
import { themeModeOf } from './deckMode';
import { deckName, type DeckLibrary } from './DeckLibrary';
import { projectRelative } from './deckDocuments';
import { projectThemeFiles, readThemeOrEvening, resolveAssetsIn, type DeckPages } from './deckPages';
import { newThemeNameProblem, newThemeText, themePathFor, themeTextWith, type ThemeStart } from './themeFile';
import { decodeThemeRequest, ThemeProtocolError, type ThemeDeck, type ThemeHostMessage, type ThemePreview, type ThemeRequest } from './themeProtocol';
import { deckPreview, SAMPLE_DECK_TEXT } from './themePreview';
import { ensureProjectSubfolder } from '../projects/projectFolderGuard';

/** One open theme tab: its document and panel. */
interface ThemeView {
  document: vscode.TextDocument;
  panel: vscode.WebviewPanel;
}

/** A Save its notice's Undo can take back: the file's text before it and the text it wrote. */
interface SavedTheme {
  token: string;
  before: string;
  after: string;
}

const RITEMARK_EDITOR = 'ritemark.editor';

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
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor(private readonly library: () => DeckLibrary | null, private readonly decks: DeckPages) {
    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        const views = [...this.views].filter(view => view.document === event.document);
        if (views.length === 0) return;
        // A clean document whose text changed holds the file's text (reverted, or reloaded after a writer's change). A
        // Save turns it clean with no change of text: that is `saved`'s, which needs the text the file had before. The
        // change event comes before the document's dirty state is told (found in the app: an edit read as clean), so the
        // state is read a moment later.
        if (event.contentChanges.length > 0) {
          const document = event.document;
          const text = document.getText();
          setTimeout(() => {
            if (!document.isClosed && !document.isDirty && document.getText() === text && [...this.views].some(view => view.document === document)) {
              this.diskTexts.set(document.uri.toString(), text);
            }
          }, 150);
        }
        for (const view of views) this.postState(view);
      }),
      vscode.workspace.onDidSaveTextDocument(document => {
        const views = [...this.views].filter(view => view.document === document);
        if (views.length > 0) void this.saved(document, views);
      }),
    );
    // A theme file written (the tab's Save, an AI, another program): open decks draw it again. Watched by name, so a
    // theme folder that comes later is covered too.
    const watcher = vscode.workspace.createFileSystemWatcher(`**/${THEMES_FOLDER}/*.theme.md`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void this.decks.themeFilesChanged(), 80);
    };
    this.subscriptions.push(watcher, watcher.onDidChange(changed), watcher.onDidCreate(changed), watcher.onDidDelete(changed), { dispose: () => clearTimeout(timer) });
  }

  /** Does this document open as a theme? `flagOn` is the flag now unless given (a connected view's, as it opened). */
  themeModeFor(document: vscode.TextDocument, flagOn = isEnabled('decks')): boolean {
    const root = document.uri.scheme === 'file' ? rootOf(document.uri.fsPath) : null;
    return themeModeOf({ flagOn, scheme: document.uri.scheme, relative: root ? projectRelative(root, document.uri.fsPath) : null });
  }

  /** A theme's panel, while it is open. Its tab is named after the theme. */
  connect(document: vscode.TextDocument, panel: vscode.WebviewPanel): vscode.Disposable {
    const view: ThemeView = { document, panel };
    this.views.add(view);
    const uri = document.uri.toString();
    if (!this.diskTexts.has(uri)) {
      if (!document.isDirty) this.diskTexts.set(uri, document.getText());
      else void fs.promises.readFile(document.uri.fsPath, 'utf8').then(text => { if (!this.diskTexts.has(uri)) this.diskTexts.set(uri, text); }, () => undefined);
    }
    this.nameTab(view);
    const named = vscode.workspace.onDidChangeTextDocument(event => { if (event.document === document) this.nameTab(view); });
    return {
      dispose: () => {
        named.dispose();
        this.views.delete(view);
        if (![...this.views].some(other => other.document === document)) {
          this.diskTexts.delete(uri);
          this.saves.delete(uri);
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
      case 'theme/set':
        await this.change(view, themeTextWith(document.getText(), request.changes));
        return;
      case 'theme/save':
        if (document.isDirty) await document.save();
        return;
      case 'theme/discard':
        await this.discard(view);
        return;
      case 'theme/save-as':
        await this.saveAs(view, request.name, request.use);
        return;
      case 'theme/open-deck': {
        const root = rootOf(document.uri.fsPath);
        const absolute = root ? path.resolve(root, request.path) : null;
        if (!root || !absolute || !projectRelative(root, absolute) || !fs.existsSync(absolute)) return;
        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(absolute), RITEMARK_EDITOR, { preview: false });
        return;
      }
      case 'theme/undo-save':
        await this.undoSave(view, request.token);
        return;
    }
  }

  /**
   * The draft becomes `text`: one edit of the document, for the lines that differ. A draft changed back to the file's
   * own text is no draft: the document goes back to the file, and its dot goes.
   */
  private async change(view: ThemeView, text: string): Promise<void> {
    const document = view.document;
    const current = document.getText();
    if (text === current) return;
    if (document.isDirty && text === this.diskTexts.get(document.uri.toString()) && (await this.revert(view))) return;
    await replaceText(document, text);
  }

  /** Discard: the document goes back to the file. */
  private async discard(view: ThemeView): Promise<void> {
    if (!view.document.isDirty) return;
    if (await this.revert(view)) return;
    // Not the active editor (it lost the focus meanwhile): the file's text, which leaves the dot until Save.
    const disk = this.diskTexts.get(view.document.uri.toString());
    if (disk !== undefined) await replaceText(view.document, disk);
  }

  /**
   * VS Code's own Revert, for this tab: its document takes the file's text and is no longer changed. Only while the tab
   * is the active editor (the command reverts the active one), which it is while the person works in it.
   */
  private async revert(view: ThemeView): Promise<boolean> {
    const active = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    if (!(active instanceof vscode.TabInputCustom) || active.uri.toString() !== view.document.uri.toString() || !view.panel.active) return false;
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
    const decks = await this.decksUsing(document);
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
    const taken = await this.takenNames(root);
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

  /** The names and file names the project's themes already have: the files in the folder and the built-in Evening. */
  private async takenNames(root: string): Promise<{ names: string[]; files: string[] }> {
    const entries = themeEntries(await projectThemeFiles(root), []);
    let files: string[] = [];
    try {
      files = (await fs.promises.readdir(path.join(root, THEMES_FOLDER))).filter(file => /\.theme\.md$/i.test(file));
    } catch {
      // No folder yet: no files.
    }
    return { names: entries.map(entry => themeOfEntry(entry).name), files };
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
    await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(made.absolute), RITEMARK_EDITOR, { preview: false });
    return { ok: true, path: made.relative, name: made.name };
  }

  /** The project's decks that draw this theme (its file, or Evening's path when it is the project's own Evening). */
  private async decksUsing(document: vscode.TextDocument): Promise<Array<ThemeDeck & { text: string; modified: number }>> {
    const root = rootOf(document.uri.fsPath);
    const library = this.library();
    const relative = root ? projectRelative(root, document.uri.fsPath) : null;
    if (!root || !library || !relative) return [];
    let list: Awaited<ReturnType<DeckLibrary['deckThemeList']>>;
    try {
      list = await library.deckThemeList();
    } catch (error) {
      console.warn('[Themes] Could not read the decks:', error);
      return [];
    }
    const entries = themeEntries(await projectThemeFiles(root), []);
    const own = entries.find(entry => entry.path.toLowerCase() === relative.toLowerCase())?.path
      ?? (relative.toLowerCase() === BUILT_IN_THEME_PATH.toLowerCase() ? BUILT_IN_THEME_PATH : relative);
    return list
      .filter(deck => themeKeyOf(deck.theme, entries) === own)
      .map(deck => ({ path: deck.path, name: deckName(deck.path), text: deck.text, modified: deck.modified }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The decks, the preview and the names taken, for the tab. */
  private async postDecks(view: ThemeView): Promise<void> {
    const document = view.document;
    const root = rootOf(document.uri.fsPath);
    const using = await this.decksUsing(document);
    const originPath = this.origins.get(keyOf(document.uri.fsPath));
    const library = this.library();
    // The deck it previews: the one it was opened from, else the first that uses it, else any deck, else the sample.
    let source: { path: string | null; text: string; folder: string | null } | null = null;
    if (originPath && root) {
      const relative = projectRelative(root, originPath);
      const open = vscode.workspace.textDocuments.find(entry => keyOf(entry.uri.fsPath) === keyOf(originPath));
      const text = open?.getText() ?? (relative && library ? await library.readDeckText(relative) : null);
      if (relative && text !== null) source = { path: relative, text, folder: path.dirname(originPath) };
    }
    if (!source && using.length && root) {
      const first = using[0];
      source = { path: first.path, text: first.text, folder: path.dirname(path.join(root, ...first.path.split('/'))) };
    }
    if (!source && root && library) {
      try {
        const any = (await library.deckThemeList()).sort((a, b) => b.modified - a.modified)[0];
        if (any) source = { path: any.path, text: any.text, folder: path.dirname(path.join(root, ...any.path.split('/'))) };
      } catch {
        // No decks to read: the sample.
      }
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
      taken: root ? await this.takenNames(root) : { names: [BUILT_IN_THEME.name], files: [] },
    });
  }

  private postState(view: ThemeView): void {
    const root = rootOf(view.document.uri.fsPath);
    void this.post(view.panel.webview, {
      type: 'theme/state',
      path: (root && projectRelative(root, view.document.uri.fsPath)) || path.basename(view.document.uri.fsPath),
      text: view.document.getText(),
      dirty: view.document.isDirty,
    });
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
