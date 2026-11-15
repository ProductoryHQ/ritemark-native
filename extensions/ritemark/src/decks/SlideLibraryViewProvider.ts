/**
 * The Slide library place (Sprint 157, README frame 3): a place in the left column, after Tasks, like Documents and
 * Tasks (Jarmo, 14 November; the Experience lead's answer 3). Its topics are the decks in `Slide library`, each
 * opening to its slides; below, Other decks lists every other deck. A slide is clicked for "Insert after slide N",
 * which copies it into the deck that is open, after its current slide.
 *
 * The webview is the shared React bundle (`data-editor-type="slide-library"`); the library's work is `DeckLibrary`'s,
 * the same operations the deck view and the AI's tools use.
 */
import * as vscode from 'vscode';
import { isEnabled } from '../features';
import type { DeckLibrary } from './DeckLibrary';
import type { DeckPages } from './deckPages';
import { normalizePath, slidesOfText } from './deckLibraryFormat';
import { decodeLibraryRequest } from './deckProtocol';

/** Library state is sent at most this often while decks change. */
const REFRESH_MS = 300;

export class SlideLibraryViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | null = null;
  private query = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly pages: DeckPages,
    private readonly library: () => DeckLibrary | null,
  ) {
    this.subscriptions.push(
      pages.onDidChangeActive(() => this.refreshSoon()),
      pages.onDidRevealInLibrary(target => void this.post({ type: 'library/reveal', path: target.path, id: target.id })),
    );
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.deck.md');
    this.subscriptions.push(
      watcher,
      watcher.onDidCreate(() => this.refreshSoon()),
      watcher.onDidDelete(() => this.refreshSoon()),
      watcher.onDidChange(() => this.refreshSoon()),
      vscode.workspace.onDidChangeTextDocument(event => { if (/\.deck\.md$/i.test(event.document.uri.fsPath)) this.refreshSoon(); }),
    );
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')] };
    view.webview.html = libraryHtml(view.webview, this.extensionUri);
    view.webview.onDidReceiveMessage(message => void this.handle(message));
    view.onDidChangeVisibility(() => { if (view.visible) this.refreshSoon(); });
    view.onDidDispose(() => { if (this.view === view) this.view = null; });
  }

  /** The head row's Search: the place shows, and its search field takes the keyboard. */
  async focusSearch(): Promise<void> {
    await vscode.commands.executeCommand('ritemark.slideLibraryView.focus');
    await this.post({ type: 'library/focus-search' });
  }

  private async handle(message: unknown): Promise<void> {
    const request = decodeLibraryRequest(message);
    if (!request) return;
    switch (request.type) {
      case 'library/ready':
        await this.refresh();
        return;
      case 'library/search':
        this.query = request.query;
        await this.refresh();
        return;
      case 'library/insert':
        await this.insert(request.path, request.id);
        return;
      case 'library/open': {
        const library = this.library();
        if (!library) return;
        const root = vscode.workspace.workspaceFolders?.find(folder => folder.uri.scheme === 'file');
        // Only a deck inside the project: a path that climbs out of it is refused.
        const relative = normalizePath(request.path);
        if (!root || !relative) return;
        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.joinPath(root.uri, ...relative.split('/')), 'ritemark.editor');
        return;
      }
    }
  }

  /** "Insert after slide N": a copy into the active deck, after its current slide, as one undo step there. */
  private async insert(path: string, id: string): Promise<void> {
    const library = this.library();
    const active = this.pages.activeDeck();
    const document = this.pages.activeDocument();
    if (!library || !active || !document) {
      await this.post({ type: 'library/notice', text: 'Open a deck to insert slides into it.' });
      return;
    }
    try {
      const taken = slidesOfText(document.getText()).map(slide => slide.data.id).filter((value): value is string => !!value);
      const parts = await library.copies(path, [id], active.path, taken);
      if (!(await this.pages.insertIntoActive(parts))) await this.post({ type: 'library/notice', text: 'The deck could not take the slide.' });
    } catch (error) {
      await this.post({ type: 'library/notice', text: error instanceof Error ? error.message : 'The slide could not be inserted.' });
    }
  }

  private refreshSoon(): void {
    if (!this.view?.visible) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, REFRESH_MS);
  }

  private async refresh(): Promise<void> {
    if (!this.view) return;
    if (!isEnabled('decks')) {
      await this.post({ type: 'library/state', enabled: false, decks: [], active: null, query: this.query, project: false });
      return;
    }
    const library = this.library();
    const decks = library ? await library.listDecks({ query: this.query }) : [];
    await this.post({ type: 'library/state', enabled: true, decks, active: this.pages.activeDeck(), query: this.query, project: !!library });
  }

  private async post(message: Record<string, unknown>): Promise<void> {
    try {
      await this.view?.webview.postMessage(message);
    } catch {
      // The view closed meanwhile.
    }
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    for (const subscription of this.subscriptions) subscription.dispose();
  }
}

function libraryHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = Array.from({ length: 32 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))).join('');
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
  return `<!DOCTYPE html>
<html lang="en" class="rm-ground">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:;">
  <title>Slide library</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-sideBar-background) !important; }
  </style>
</head>
<body>
  <div id="root" data-editor-type="slide-library"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
