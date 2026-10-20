/**
 * cardPages — a card opened as a page in the Ritemark editor (Sprint 130,
 * design.md §5, technical-plan W3b).
 *
 * The page is the card's own Markdown file in the Ritemark editor, in card
 * mode: the body is a normal document, and a strip of board controls takes the
 * place of the document header. This is the host's side of it:
 *   - which documents are in card mode, and the body-only save that keeps the
 *     board's front matter byte for byte (the editor never writes it);
 *   - each page's line to the board, a third board surface;
 *   - opening a card's page, reusing one tab for pages that were only looked
 *     at (Ritemark turns VS Code's preview tabs off, so the host does this);
 *   - which card's page is the active tab, for the side bar's highlight;
 *   - `CardDocuments`, so the store reads and writes through an open page.
 *
 * The same route as the editor's agent mode for `.claude/agents/*.md`: a
 * path-based mode in the one Markdown editor, not a second editor.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import type { BoardStore, CardDocuments } from './BoardStore';
import { cardTitleOf, parseCardFile, spliceCardBody, splitCardText } from './cardFile';
import { connectBoardSurface, type BoardSurfaceContext } from './boardSurface';
import type { BoardRequest } from './protocol';

/** The Ritemark editor's view type (`RitemarkEditorProvider.viewType`). */
export const RITEMARK_EDITOR_VIEW_TYPE = 'ritemark.editor';

/** Requests from a page that change the card: the page was used, so opening
 *  the next card keeps it. */
const EDITING_REQUESTS: ReadonlySet<BoardRequest['type']> = new Set([
  'board/update',
  'board/move',
  'board/mark-done',
  'board/give',
  'board/queue',
  'board/wait',
  'board/unwait',
  'board/follow-up',
  'board/answer',
  'board/retry',
  'board/stop',
  'board/drop',
  'board/bring-back',
  'board/review-idea',
  'board/accept-review',
  'board/add-files',
]);

const CASE_INSENSITIVE = process.platform === 'darwin' || process.platform === 'win32';

export function samePath(a: string, b: string): boolean {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return CASE_INSENSITIVE ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function openCardDocument(file: string): vscode.TextDocument | undefined {
  return vscode.workspace.textDocuments.find(
    (document) => !document.isClosed && document.uri.scheme === 'file' && samePath(document.uri.fsPath, file),
  );
}

/** The store's access to card files open in an editor. */
export function workspaceCardDocuments(): CardDocuments {
  return {
    openText: (file) => openCardDocument(file)?.getText(),
    isDirty: (file) => openCardDocument(file)?.isDirty ?? false,
    async write(file, change) {
      const document = openCardDocument(file);
      if (!document) return false;
      const text = document.getText();
      const split = splitCardText(text);
      // The page lost its front matter between the read and now: let the
      // store write the disk rather than guess where the board's part goes.
      if (!split) return false;
      const wasDirty = document.isDirty;
      const headEnd = document.positionAt(split.head.length);
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, new vscode.Range(new vscode.Position(0, 0), headEnd), change.head);
      if (change.body !== undefined) {
        edit.replace(document.uri, new vscode.Range(headEnd, document.positionAt(text.length)), change.body);
      }
      if (!(await vscode.workspace.applyEdit(edit))) throw new Error('VS Code did not take the change.');
      // Unsaved typing is left for autosave, which saves the board's part with it.
      if (!wasDirty) await document.save();
      return true;
    },
  };
}

function tabUri(tab: vscode.Tab): vscode.Uri | null {
  const input = tab.input;
  if (input instanceof vscode.TabInputCustom || input instanceof vscode.TabInputText) return input.uri;
  return null;
}

function findTab(uri: string): vscode.Tab | undefined {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tabUri(tab)?.toString() === uri) return tab;
    }
  }
  return undefined;
}

/**
 * Put the keyboard in the page just opened (W16). Opening it from the Tasks
 * side bar left the focus nowhere, so the user needed Ctrl+1 first; this is
 * what Ctrl+1 does.
 */
async function focusPage(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
}

export class CardPages implements vscode.Disposable {
  /** The page the board opened last, while it is open. */
  private lastOpened: string | null = null;
  /** Pages used since they opened: typed in, or changed through their strip. */
  private readonly edited = new Set<string>();
  private active: string | null = null;
  private readonly activeListeners = new Set<(cardId: string | null) => void>();
  private readonly invalidateTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Cards whose next page to load takes the focus: one renamed by Make it a
   *  task, or one just opened from the keyboard. */
  private readonly returning = new Map<string, ReturnType<typeof setTimeout>>();
  /** Card files being moved, by their old URI (see `noteMoving`). */
  private readonly moving = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly store: BoardStore,
    private readonly surfaceContext: () => BoardSurfaceContext,
  ) {
    this.disposables.push(
      vscode.window.tabGroups.onDidChangeTabs((event) => {
        for (const tab of event.closed) {
          const uri = tabUri(tab)?.toString();
          if (!uri || findTab(uri)) continue;
          this.edited.delete(uri);
          if (this.lastOpened === uri) this.lastOpened = null;
        }
        this.updateActive();
      }),
      vscode.window.tabGroups.onDidChangeTabGroups(() => this.updateActive()),
      // Typing on a page shows on the board (a description's checkboxes), and a
      // page reloaded from disk is read again.
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length === 0) return;
        if (event.document.uri.scheme === 'file' && this.isCardPath(event.document.uri.fsPath)) {
          this.scheduleInvalidate(path.basename(event.document.uri.fsPath));
        }
      }),
      // Closing a page without saving throws its typing away; read the disk again.
      vscode.workspace.onDidCloseTextDocument((document) => {
        if (document.uri.scheme === 'file' && this.isCardPath(document.uri.fsPath)) {
          this.scheduleInvalidate(path.basename(document.uri.fsPath));
        }
      }),
    );
    const stop = store.onDidChange(() => {
      this.updateActive();
      void this.closeDeletedPages();
    });
    this.disposables.push({ dispose: stop });
    this.updateActive();
  }

  /** A file in this board's card folder, by path alone. */
  isCardPath(fsPath: string): boolean {
    const name = path.basename(fsPath);
    return name.toLowerCase().endsWith('.md') && !name.startsWith('.') && samePath(path.dirname(fsPath), this.store.tasksDir);
  }

  /** Card mode: a file in the card folder that reads as a card. A card that
   *  won't read opens as a plain document, so it can be repaired. */
  cardModeFor(document: vscode.TextDocument): { cardId: string } | null {
    if (document.uri.scheme !== 'file' || !this.isCardPath(document.uri.fsPath)) return null;
    const parsed = parseCardFile(document.getText());
    if (parsed.kind !== 'card') return null;
    return { cardId: this.store.cardIdOfFile(path.basename(document.uri.fsPath)) ?? parsed.card.id };
  }

  /** A card page's title, for its tab and the AI's chip (#477); null when the file isn't a card. */
  cardTitleFor(document: vscode.TextDocument): string | null {
    if (!this.cardModeFor(document)) return null;
    return cardTitleOf(document.getText());
  }

  /**
   * The text a body edit from a page saves: the document's own front matter,
   * untouched, then the body. Null when the document is not in card mode, so
   * the editor saves it the usual way.
   */
  spliceBody(document: vscode.TextDocument, body: string): string | null {
    if (!this.cardModeFor(document)) return null;
    const text = spliceCardBody(document.getText(), body);
    if (text !== null) this.edited.add(document.uri.toString());
    return text;
  }

  /** Connect a page's webview to the board. */
  connect(document: vscode.TextDocument, webview: vscode.Webview): vscode.Disposable {
    const uri = document.uri.toString();
    const cardId = this.cardModeFor(document)?.cardId ?? null;
    const connection = connectBoardSurface(webview, 'page', this.surfaceContext(), {
      onRequest: (request) => {
        if (EDITING_REQUESTS.has(request.type)) this.edited.add(uri);
        // Make it a task renames the file, and the page comes back as a new
        // webview without the keyboard focus it was clicked with (W16).
        if (request.type === 'board/accept-review') this.focusWhenBack(request.cardId);
      },
      onReady: () => {
        const timer = cardId ? this.returning.get(cardId) : undefined;
        if (!cardId || !timer) return;
        clearTimeout(timer);
        this.returning.delete(cardId);
        // The editor takes the focus; the page then pulls it into its own
        // document, where it can stop short (seen once on Windows and the Mac).
        void focusPage().then(() => connection.focus({}));
      },
    });
    return connection;
  }

  /** The next page of this card to load takes the focus, within a few seconds. */
  private focusWhenBack(cardId: string): void {
    clearTimeout(this.returning.get(cardId));
    this.returning.set(cardId, setTimeout(() => this.returning.delete(cardId), 5000));
  }

  /**
   * Open a card's page. The page the board opened before is closed when it was
   * only looked at (not typed in, not changed, not pinned, nothing unsaved), so
   * clicking through cards keeps one tab. A card file that won't read opens as
   * plain text, where the broken front matter can be fixed.
   */
  async open(target: { cardId?: string; fileName?: string; focus?: boolean }): Promise<void> {
    if (!target.cardId && target.fileName) {
      const file = path.join(this.store.tasksDir, path.basename(target.fileName));
      await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(file), 'default', { preview: false });
      if (target.focus) await focusPage();
      return;
    }
    const file = target.cardId ? this.store.filePathOf(target.cardId) : null;
    if (!file) return;
    const uri = vscode.Uri.file(file);
    const key = uri.toString();
    const existing = findTab(key);
    const previous = this.lastOpened;
    // A new page's webview loads after the editor took the focus, and could
    // leave it on the page body (seen once on Windows): focus it again then.
    if (target.focus && !existing && target.cardId) this.focusWhenBack(target.cardId);
    await vscode.commands.executeCommand('vscode.openWith', uri, RITEMARK_EDITOR_VIEW_TYPE, {
      preview: false,
      ...(existing ? { viewColumn: existing.group.viewColumn } : {}),
    });
    if (target.focus) await focusPage();
    if (existing) return;
    if (previous && previous !== key && !this.edited.has(previous)) {
      const tab = findTab(previous);
      if (tab && !tab.isDirty && !tab.isPinned) {
        try {
          await vscode.window.tabGroups.close(tab, true);
        } catch (error) {
          console.warn('[taskBoard] could not close the previous card page', error);
        }
      }
    }
    this.lastOpened = key;
    this.edited.delete(key);
  }

  /** For the board surfaces: the card whose page is the active tab. */
  readonly activePage = {
    current: (): string | null => this.active,
    onDidChange: (listener: (cardId: string | null) => void): (() => void) => {
      this.activeListeners.add(listener);
      return () => this.activeListeners.delete(listener);
    },
  };

  dispose(): void {
    for (const timer of this.invalidateTimers.values()) clearTimeout(timer);
    this.invalidateTimers.clear();
    for (const timer of [...this.returning.values(), ...this.moving.values()]) clearTimeout(timer);
    this.returning.clear();
    this.moving.clear();
    for (const disposable of this.disposables) disposable.dispose();
    this.activeListeners.clear();
  }

  private updateActive(): void {
    const tab = vscode.window.tabGroups.activeTabGroup?.activeTab;
    const input = tab?.input;
    let cardId: string | null = null;
    if (input instanceof vscode.TabInputCustom && input.viewType === RITEMARK_EDITOR_VIEW_TYPE && this.isCardPath(input.uri.fsPath)) {
      cardId = this.store.cardIdOfFile(path.basename(input.uri.fsPath));
    }
    if (cardId === this.active) return;
    this.active = cardId;
    for (const listener of this.activeListeners) listener(cardId);
  }

  private scheduleInvalidate(fileName: string): void {
    const pending = this.invalidateTimers.get(fileName);
    if (pending) clearTimeout(pending);
    this.invalidateTimers.set(
      fileName,
      setTimeout(() => {
        this.invalidateTimers.delete(fileName);
        void this.store.invalidate(fileName).catch((error) => console.warn('[taskBoard] invalidate failed', error));
      }, 300),
    );
  }

  /**
   * The board is moving this card file (Make it a task). Its page moves with
   * it, so for a moment the old path is gone while its tab is still there:
   * that tab is not a deleted card's.
   */
  noteMoving(file: string): void {
    const key = vscode.Uri.file(file).toString();
    clearTimeout(this.moving.get(key));
    this.moving.set(key, setTimeout(() => this.moving.delete(key), 5000));
  }

  /** A deleted card takes its page with it, unless the page holds unsaved typing. */
  private async closeDeletedPages(): Promise<void> {
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        const uri = tabUri(tab);
        if (!uri || uri.scheme !== 'file' || tab.isDirty || !this.isCardPath(uri.fsPath)) continue;
        if (this.moving.has(uri.toString())) continue;
        try {
          await vscode.workspace.fs.stat(uri);
        } catch {
          try {
            await vscode.window.tabGroups.close(tab, true);
          } catch {
            // Already closed.
          }
        }
      }
    }
  }
}
