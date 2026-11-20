/**
 * The Slide library place (Sprint 157, README frame 3): a place in the left column, after Tasks, like Documents and
 * Tasks (Jarmo, 14 November; the Experience lead's answer 3). Its topics are the decks in `Slide library`, each
 * opening to its slides; below, Other decks lists every other deck. A slide is clicked for "Insert after slide N",
 * which copies it into the deck that is open, after its current slide.
 *
 * The webview is the shared React bundle (`data-editor-type="slide-library"`); the library's work is `DeckLibrary`'s,
 * the same operations the deck view and the AI's tools use.
 *
 * Sprint 165 PR 4 (#834): at its top, the offer of the slides in most of the project's decks (`libraryOffer.ts`), with
 * Add all and Choose… (copies into the topic Every training, one Undo on the place's notice) and Not now (kept beside
 * the library). It is worked out from the decks alone, and only a press writes anything.
 */
import { slidePicturePaths } from './blocks/slideRenderer';
import * as path from 'path';
import * as vscode from 'vscode';
import { isEnabled } from '../features';
import type { DeckLibrary, DeckSummary, TopicWrite } from './DeckLibrary';
import { readThemeOrEvening, resolveAssetsIn, type DeckPages } from './deckPages';
import { themePathOf } from './deckTheme';
import { folderOf, normalizePath, slidesOfText } from './deckLibraryFormat';
import { projectRelative, projectRoot, workspaceDeckFiles } from './deckDocuments';
import { decodeLibraryRequest } from './deckProtocol';
import { DeckIndex, hitDecks, inOpenDeck, MAX_HITS, MAX_NAMED_DECKS, namedDecks, searchLibrary, type IndexedDeck } from './librarySearch';
import { EVERY_TRAINING, NOT_NOW_PATH, NOT_NOW_UNREADABLE, hideFromOffer, notNowSlides, offerOf, readNotNow, type NotNow, type OfferedSlide } from './libraryOffer';
import type { SameSlides } from './sameSlide';
import { LIBRARY_SEARCH_COMMAND, SHELL_FIELD_COMMAND, librarySearchRow } from './librarySearchRow';

/** Sprint 165 PR 1: the project folder's name, the heading of the decks at its top level in Other decks. */
function projectName(): string {
  const root = projectRoot();
  return root ? path.basename(root) : '';
}

/** Library state is sent at most this often while decks change. */
const REFRESH_MS = 300;
/** Messages held for the page until it has loaded (Show in the library, Search, a notice), at most this many. */
const MAX_HELD = 8;
/** The offer's writes kept for their Undo, at most this many (the notice shows only the last). */
const KEPT_WRITES = 5;

export class SlideLibraryViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | null = null;
  /** The page has loaded and said so: until then messages are held, not lost. */
  private ready = false;
  private held: Array<Record<string, unknown>> = [];
  private query = '';
  /**
   * #887: the words in the shell's field (the place's Search row, patch 018), once it has sent any. The page shows
   * their search and draws no field of its own; a page loaded again (the place hidden and shown) gets them back.
   */
  private shellText: string | undefined;
  /** Each refresh's number: a slower, older one (a broader search) never posts over a newer one. */
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly subscriptions: vscode.Disposable[] = [];
  /**
   * Sprint 165 PR 3: the project's decks, read once and then again only as they change (the watcher below names them),
   * so typing in the search reads no file. Kept only while the decks are watched.
   */
  private index: { root: string; index: DeckIndex } | null = null;
  /** The open deck the last state was worked out for: another one changes the ticks and what search may show. */
  private stateActive: string | null = null;
  /** Sprint 165 PR 4: the offer's Add all and Choose… writes, by the token their notice's Undo sends. */
  private readonly writes = new Map<string, TopicWrite>();
  /**
   * The offer last worked out, and what it was worked out from: the grouping (the index's, the same object until a
   * deck changes), the open deck and Not now's text. Typing in a deck changes the grouping; a search changes none.
   */
  private offerMemo: { same: SameSlides; active: string | null; notNow: string | null; offer: OfferedSlide[] } | null = null;
  /** Not now's file can't be read: the place says so once, until it can again. */
  private notNowBroken = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly pages: DeckPages,
    private readonly library: () => DeckLibrary | null,
  ) {
    this.subscriptions.push(
      // Another deck or another slide: only the active deck's line changes, so only it is sent (the page leaves the
      // active deck out of Other decks itself).
      pages.onDidChangeActive(() => {
        if (!this.ready || !this.view?.visible) return;
        const active = isEnabled('decks') ? this.pages.activeDeck() : null;
        void this.post({ type: 'library/active', active });
        // Another deck in front (Sprint 165 PR 3): which slides it already has, the ticks, change with it.
        if ((active?.path ?? null) !== this.stateActive) this.refreshSoon();
      }),
      pages.onDidRevealInLibrary(target => {
        // The page clears its search to show the place; the shell's field lets go of its words too (#887).
        if (this.shellText) {
          this.shellText = '';
          void Promise.resolve(vscode.commands.executeCommand(SHELL_FIELD_COMMAND, LIBRARY_SEARCH_COMMAND, { text: '' })).catch(() => undefined);
        }
        void this.post('section' in target
          ? { type: 'library/show', section: target.section }
          : { type: 'library/reveal', path: target.path, id: target.id });
      }),
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
    const isDeck = (uri: vscode.Uri) => /\.deck\.md$/i.test(uri.fsPath);
    // Sprint 165 PR 4: a folder of decks deleted at once (the Slide library folder, say) is reported as the folder
    // alone, which the deck watcher never matches. A delete of a folder that held indexed decks reads them again, so
    // the place never keeps showing decks that are gone (and the offer comes back); any other delete does nothing.
    const deletes = vscode.workspace.createFileSystemWatcher('**/*', true, true, false);
    const listedAgain = (uri: vscode.Uri) => {
      const current = this.index;
      const relative = current && !isDeck(uri) ? projectRelative(current.root, uri.fsPath) : null;
      if (!current || !relative || !current.index.holdsUnder(relative)) return;
      // A stale path lists the files again, and the next update drops the decks no longer listed; the rest stay read.
      current.index.invalidate(relative);
      this.refreshSoon();
    };
    // Not now's file deleted (as it says to, to have the slides offered again) or edited: the offer follows.
    const notNow = vscode.workspace.createFileSystemWatcher(`**/${NOT_NOW_PATH}`);
    const notNowChanged = () => this.refreshSoon();
    this.watching = [
      watcher,
      deletes,
      deletes.onDidDelete(listedAgain),
      notNow,
      notNow.onDidCreate(notNowChanged),
      notNow.onDidChange(notNowChanged),
      notNow.onDidDelete(notNowChanged),
      watcher.onDidCreate(uri => this.deckChanged(uri)),
      watcher.onDidDelete(uri => this.deckChanged(uri)),
      watcher.onDidChange(uri => this.deckChanged(uri)),
      vscode.workspace.onDidChangeTextDocument(event => { if (isDeck(event.document.uri)) this.deckChanged(event.document.uri); }),
      // An open deck closed unsaved: its file's text is the deck again, at the same file time.
      vscode.workspace.onDidCloseTextDocument(document => { if (isDeck(document.uri)) this.deckChanged(document.uri); }),
    ];
  }

  private stopWatching(): void {
    for (const subscription of this.watching) subscription.dispose();
    this.watching = [];
    // Unwatched, the index would go stale: the next view reads the decks afresh.
    this.index = null;
  }

  /** A deck's file or open text changed: the index reads it again, and the place shows it soon. */
  private deckChanged(uri: vscode.Uri): void {
    const current = this.index;
    const relative = current ? projectRelative(current.root, uri.fsPath) : null;
    if (current && relative) current.index.invalidate(relative);
    this.refreshSoon();
  }

  /** The index of this window's project, made when first needed (and again for another project folder). */
  private indexOf(): DeckIndex | null {
    const root = projectRoot();
    if (!root) return null;
    if (this.index?.root !== root) this.index = { root, index: new DeckIndex(workspaceDeckFiles(root)) };
    return this.index.index;
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

  /**
   * The head row's Search (`ritemark.slideLibrary.search`, #887): the shell's field sends its words and its ↓ and
   * Enter; with nothing (⌘F in the place), the caret goes to the shell's field, or, on an older shell without one, to
   * the place's own.
   */
  async searchRow(arg?: unknown): Promise<void> {
    const action = librarySearchRow(arg);
    if (action.kind === 'text') {
      this.shellText = action.text;
      if (this.ready) await this.post({ type: 'library/query', query: action.text });
      return;
    }
    if (action.kind === 'results') {
      await vscode.commands.executeCommand('ritemark.slideLibraryView.focus');
      await this.post({ type: 'library/focus-results' });
      return;
    }
    const focusShellField = async (): Promise<boolean | undefined> => {
      try {
        return await vscode.commands.executeCommand<boolean>(SHELL_FIELD_COMMAND, LIBRARY_SEARCH_COMMAND, { focus: true }) === true;
      } catch {
        return undefined; // An older shell: no field of its own in the row
      }
    };
    let shellField = await focusShellField();
    if (shellField === false) {
      // The shell's field isn't drawn yet (the place still opening): once more after the place shows
      await vscode.commands.executeCommand('ritemark.slideLibraryView.focus');
      shellField = await focusShellField();
    }
    if (!shellField) await this.focusSearch();
  }

  /** The place shows, and its own search field takes the keyboard (a shell without the row's field, #887). */
  async focusSearch(): Promise<void> {
    await vscode.commands.executeCommand('ritemark.slideLibraryView.focus');
    await this.post({ type: 'library/focus-search' });
  }

  private async handle(message: unknown): Promise<void> {
    const request = decodeLibraryRequest(message);
    if (!request) {
      // A section or an offer the decoder refused (an id twice, too many slides) says so instead of doing nothing; the
      // offer's buttons wait for an answer.
      const type = typeof message === 'object' && message !== null ? (message as { type?: unknown }).type : undefined;
      if (type === 'library/insert-section') await this.post({ type: 'library/notice', text: 'The section could not be taken.' });
      else if (type === 'library/offer-add' || type === 'library/offer-not-now') {
        await this.post({ type: 'library/notice', text: 'The offer could not do that. Try again.' });
        await this.refresh();
      }
      return;
    }
    switch (request.type) {
      case 'library/ready': {
        this.ready = true;
        await this.refresh();
        const held = this.held;
        this.held = [];
        for (const message of held) await this.post(message);
        // #887: the shell's field's words, for a page loaded again while they stay
        if (this.shellText !== undefined) await this.post({ type: 'library/query', query: this.shellText });
        return;
      }
      case 'library/find':
        await this.searchRow();
        return;
      case 'library/search':
        this.query = request.query;
        // Only the words changed: the index lists no file again unless a deck changed meanwhile.
        await this.refresh({ listAgain: false });
        return;
      case 'library/insert':
        await this.insert(request.path, [request.id]);
        return;
      case 'library/insert-section':
        await this.insert(request.path, request.ids);
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
      case 'library/offer-add':
        await this.addOffered(request.slides);
        return;
      case 'library/offer-not-now':
        await this.notNow(request.slides);
        return;
      case 'library/undo':
        await this.undo(request.token);
        return;
    }
  }

  /**
   * Sprint 165 PR 4, Add all and Choose…: copies of the slides into Every training (made if it isn't there), one write;
   * the place opens the topic, and its notice has the Undo.
   */
  private async addOffered(slides: Array<{ path: string; id: string }>): Promise<void> {
    const library = isEnabled('decks') ? this.library() : null;
    if (!library) {
      await this.post({ type: 'library/notice', text: 'Open a project folder to keep a slide library.' });
      await this.refresh();
      return;
    }
    // The place's new state goes first, then the notice: the notice frees the offer's buttons, which must not show
    // the slides just added for a second press.
    let notice: Record<string, unknown>;
    let reveal: string | null = null;
    try {
      const write = await library.addCopiesToTopic(slides, EVERY_TRAINING);
      this.index?.index.invalidate(write.path);
      reveal = write.path;
      notice = {
        type: 'library/notice',
        text: `${write.count === 1 ? '1 slide' : `${write.count} slides`} added to the library, in ${EVERY_TRAINING}.`,
        undo: this.keep(write),
      };
    } catch (error) {
      notice = { type: 'library/notice', text: error instanceof Error ? error.message : 'The slides could not be added.' };
    }
    await this.refresh();
    if (reveal) await this.post({ type: 'library/reveal', path: reveal });
    await this.post(notice);
  }

  /** Not now: the slides (every copy of each) are kept beside the library and never offered again. */
  private async notNow(slides: Array<{ path: string; id: string }>): Promise<void> {
    const library = isEnabled('decks') ? this.library() : null;
    const index = library ? this.indexOf() : null;
    if (!library || !index) {
      await this.post({ type: 'library/notice', text: 'Open a project folder to keep a slide library.' });
      await this.refresh();
      return;
    }
    let text: string;
    try {
      const decks = await index.decks();
      await hideFromOffer(library.files, notNowSlides(decks, index.same(), slides));
      text = slides.length === 1 ? 'Hidden. This slide won’t be offered again.' : 'Hidden. These slides won’t be offered again.';
    } catch (error) {
      text = error instanceof Error ? error.message : 'The offer could not be hidden.';
    }
    // The state first, then the notice that frees the buttons (as Add does).
    await this.refresh();
    await this.post({ type: 'library/notice', text });
  }

  /** The notice's Undo: the write taken back while nothing changed the topic since. */
  private async undo(token: string): Promise<void> {
    const library = this.library();
    const write = this.writes.get(token);
    this.writes.delete(token);
    if (!library || !write) {
      // A window reloaded since, or older than the last five adds: the press still gets an answer.
      await this.post({ type: 'library/notice', text: `This Undo is no longer here. Open ${EVERY_TRAINING} to take the slides out.` });
      return;
    }
    let text: string;
    try {
      text = (await library.undoTopicWrite(write))
        ? 'Undone. The slides are out of the library again.'
        : `${EVERY_TRAINING} was changed since, so it is left as it is.`;
    } catch (error) {
      // The Trash refused (a drive without one), say: the slides stay, and the person is told why.
      text = `The slides could not be taken out: ${error instanceof Error ? error.message : 'the file could not be moved to the Trash'}.`;
    }
    this.index?.index.invalidate(write.path);
    await this.post({ type: 'library/notice', text });
    await this.refresh();
  }

  /** Keep a write for its Undo; the token the notice sends back. */
  private keep(write: TopicWrite): string {
    const token = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    this.writes.set(token, write);
    while (this.writes.size > KEPT_WRITES) this.writes.delete(this.writes.keys().next().value as string);
    return token;
  }

  /**
   * "Insert after slide N": copies into the active deck, after its current slide, as one undo step there. One slide, or
   * (Sprint 165 PR 2, Take section) a section's slides in their order: the same copies, one edit.
   */
  private async insert(path: string, ids: string[]): Promise<void> {
    const library = this.library();
    const active = this.pages.activeDeck();
    const document = this.pages.activeDocument();
    if (!library || !active || !document) {
      await this.post({ type: 'library/notice', text: 'Open a deck to insert slides into it.' });
      return;
    }
    try {
      const taken = slidesOfText(document.getText()).map(slide => slide.data.id).filter((value): value is string => !!value);
      const parts = await library.copies(path, ids, active.path, taken);
      // A section goes through the view's confirmed insert: the view answers, and the document must gain every slide.
      const view = ids.length > 1 ? this.pages.viewOf(document.uri.fsPath) : null;
      const done = view ? await view.insert(parts, active.current) : await this.pages.insertIntoActive(parts);
      if (!done) await this.post({ type: 'library/notice', text: ids.length > 1 ? 'The deck could not take the section.' : 'The deck could not take the slide.' });
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

  private async refresh(options: { listAgain?: boolean } = {}): Promise<void> {
    if (!this.view) return;
    if (!isEnabled('decks')) {
      await this.post({ type: 'library/state', enabled: false, decks: [], active: null, query: this.query, project: false });
      return;
    }
    const generation = ++this.generation;
    const query = this.query;
    const library = this.library();
    const index = library ? this.indexOf() : null;
    const active = this.pages.activeDeck();
    let indexed: IndexedDeck[] = [];
    try {
      indexed = index ? await index.decks(options) : [];
    } catch {
      // The project's files couldn't be listed this time: the place keeps what it shows, and the next change tries again.
      return;
    }
    const same = index?.same();
    // Sprint 165 PR 3: a search lists each slide once (the decks sent hold only the slides it shows); the ticks mark
    // the slides whose copy is already in the open deck, in the search and in the decks alike.
    const found = same && query.trim() ? searchLibrary(indexed, same, query, { active: active?.path, limit: MAX_HITS }) : null;
    const decks = found ? hitDecks(indexed, found.hits) : indexed.map(entry => entry.summary);
    // #877 (the Experience lead): the decks whose folder or name has the words, as closed rows above the slides.
    const named = found ? namedDecks(indexed, query, { active: active?.path, limit: MAX_NAMED_DECKS }) : null;
    const here = same ? inOpenDeck(indexed, same, active?.path) : [];
    // Sprint 165 PR 4: the offer, only while browsing (a search shows none).
    let offer: OfferedSlide[] = [];
    if (same && library && !query.trim()) offer = await this.offerFor(library, indexed, same, active?.path ?? null);
    // Each deck's pictures once: a named deck can be a hit deck too.
    const drawn = named ? [...new Map([...decks, ...named.decks].map(deck => [deck.path, deck] as const)).values()] : decks;
    const { assets, themes } = this.view ? await looksOf(this.view.webview, drawn) : { assets: {}, themes: {} };
    if (generation !== this.generation) return;
    this.stateActive = active?.path ?? null;
    await this.post({
      type: 'library/state', enabled: true, decks, assets, themes, active, query, project: !!library, projectName: projectName(), here, offer,
      ...(found ? { search: { ...found, decks: named?.decks ?? [], deckTotal: named?.total ?? 0 } } : {}),
    });
  }

  /**
   * Sprint 165 PR 4: the offer for this state, worked out again only when the grouping, the open deck or Not now's text
   * changed. Not now's file broken: no offer, and a notice once.
   */
  private async offerFor(library: DeckLibrary, indexed: IndexedDeck[], same: SameSlides, active: string | null): Promise<OfferedSlide[]> {
    const text = await library.files.read(NOT_NOW_PATH).catch(() => null);
    const memo = this.offerMemo;
    if (memo && memo.same === same && memo.active === active && memo.notNow === text) return memo.offer;
    // The text just read, as `readNotNow` reads it (one read for the memo and the offer).
    const notNow: NotNow | null = await readNotNow({ read: async () => text });
    if (!notNow !== this.notNowBroken) {
      this.notNowBroken = !notNow;
      if (!notNow) void this.post({ type: 'library/notice', text: NOT_NOW_UNREADABLE });
    }
    const offer = notNow ? offerOf(indexed, same, notNow, { active }).slides : [];
    this.offerMemo = { same, active, notNow: text, offer };
    return offer;
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
    const images = [...new Set(deck.slides.flatMap(slide => slidePicturePaths(slide.data)))];
    if (images.length) assets[deck.path] = resolveAssetsIn(path.join(root, ...folderOf(deck.path).split('/').filter(Boolean)), webview, images);
    // Sprint 162: a deck naming no theme, or a missing one, draws the project's own Evening file when it has one.
    const key = themePathOf(deck.theme);
    if (!(key in themes)) themes[key] = await readThemeOrEvening(root, key);
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
