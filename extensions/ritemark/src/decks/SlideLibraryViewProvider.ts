/**
 * The Slide library place (Sprint 157, README frame 3): a place in the left column, after Tasks, like Documents and
 * Tasks (Jarmo, 14 November; the Experience lead's answer 3). Its topics are the decks in `Slide library`, each
 * opening to its slides; below, Other decks lists every other deck. A slide is clicked for "Insert after slide N",
 * which copies it into the deck that is open, after its current slide.
 *
 * The webview is the shared React bundle (`data-editor-type="slide-library"`); the library's work is `DeckLibrary`'s,
 * the same operations the deck view and the AI's tools use.
 */
import * as path from 'path';
import * as vscode from 'vscode';
import { isEnabled } from '../features';
import type { DeckLibrary, DeckSummary } from './DeckLibrary';
import { readProjectTheme, resolveAssetsIn, type DeckPages } from './deckPages';
import { folderOf, normalizePath, slidesOfText } from './deckLibraryFormat';
import { projectRoot } from './deckDocuments';
import { decodeLibraryRequest } from './deckProtocol';

/** Library state is sent at most this often while decks change. */
const REFRESH_MS = 300;
/** Messages held for the page until it has loaded (Show in the library, Search, a notice), at most this many. */
const MAX_HELD = 8;

export class SlideLibraryViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | null = null;
  /** The page has loaded and said so: until then messages are held, not lost. */
  private ready = false;
  private held: Array<Record<string, unknown>> = [];
  private query = '';
  /** Each refresh's number: a slower, older one (a broader search) never posts over a newer one. */
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly pages: DeckPages,
    private readonly library: () => DeckLibrary | null,
  ) {
    this.subscriptions.push(
      // Another deck or another slide: only the active deck's line changes, so only it is sent (the page leaves the
      // active deck out of Other decks itself).
      pages.onDidChangeActive(() => {
        if (this.ready && this.view?.visible) void this.post({ type: 'library/active', active: isEnabled('decks') ? this.pages.activeDeck() : null });
      }),
      pages.onDidRevealInLibrary(target => void this.post('section' in target
        ? { type: 'library/show', section: target.section }
        : { type: 'library/reveal', path: target.path, id: target.id })),
    );
  }

  /**
   * Sprint 159 (PR 2): the project's decks are watched only while the place's view exists (the flag on): with the flag
   * off, as most windows have it, nothing of the library runs, and turning it off ends the watching with the view.
   */
  private watching: vscode.Disposable[] = [];

  private watchDecks(): void {
    if (this.watching.length) return;
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.deck.md');
    this.watching = [
      watcher,
      watcher.onDidCreate(() => this.refreshSoon()),
      watcher.onDidDelete(() => this.refreshSoon()),
      watcher.onDidChange(() => this.refreshSoon()),
      vscode.workspace.onDidChangeTextDocument(event => { if (/\.deck\.md$/i.test(event.document.uri.fsPath)) this.refreshSoon(); }),
    ];
  }

  private stopWatching(): void {
    for (const subscription of this.watching) subscription.dispose();
    this.watching = [];
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.watchDecks();
    this.view = view;
    this.ready = false;
    // The project folder too: the slides' pictures are drawn on the thumbnails.
    const folders = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file').map(folder => folder.uri);
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media'), ...folders] };
    view.webview.html = libraryHtml(view.webview, this.extensionUri);
    view.webview.onDidReceiveMessage(message => void this.handle(message));
    view.onDidChangeVisibility(() => { if (view.visible) this.refreshSoon(); });
    view.onDidDispose(() => {
      if (this.view !== view) return;
      this.view = null;
      this.ready = false;
      this.stopWatching();
    });
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
      case 'library/ready': {
        this.ready = true;
        await this.refresh();
        const held = this.held;
        this.held = [];
        for (const message of held) await this.post(message);
        return;
      }
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
    const generation = ++this.generation;
    const query = this.query;
    const library = this.library();
    const decks = library ? await library.listDecks({ query }) : [];
    const { assets, themes } = this.view ? await looksOf(this.view.webview, decks) : { assets: {}, themes: {} };
    if (generation !== this.generation) return;
    await this.post({ type: 'library/state', enabled: true, decks, assets, themes, active: this.pages.activeDeck(), query, project: !!library });
  }

  private async post(message: Record<string, unknown>): Promise<void> {
    if (!this.view || !this.ready) {
      // The place is opening (or not open yet): the message waits for its page.
      if (message.type !== 'library/state' && message.type !== 'library/active') this.held = [...this.held, message].slice(-MAX_HELD);
      return;
    }
    try {
      await this.view?.webview.postMessage(message);
    } catch {
      // The view closed meanwhile.
    }
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    for (const subscription of this.subscriptions) subscription.dispose();
    this.stopWatching();
  }
}

/** What the thumbnails need to look like their decks: each deck's pictures as webview URIs, and the themes' text. */
async function looksOf(webview: vscode.Webview, decks: DeckSummary[]): Promise<{ assets: Record<string, Record<string, string>>; themes: Record<string, string | null> }> {
  const root = projectRoot();
  const assets: Record<string, Record<string, string>> = {};
  const themes: Record<string, string | null> = {};
  if (!root) return { assets, themes };
  for (const deck of decks) {
    const images = [...new Set(deck.slides.map(slide => slide.data.image).filter((image): image is string => !!image))];
    if (images.length) assets[deck.path] = resolveAssetsIn(path.join(root, ...folderOf(deck.path).split('/').filter(Boolean)), webview, images);
    if (deck.theme && !(deck.theme in themes)) themes[deck.theme] = await readProjectTheme(root, deck.theme);
  }
  return { assets, themes };
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
