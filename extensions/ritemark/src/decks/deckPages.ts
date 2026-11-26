/**
 * deckPages — a deck (`.rtms`, or an older `.deck.md`) opened as a deck in the Ritemark editor (Sprint 157, experience 46).
 *
 * The deck is a path-based mode of the one Markdown editor, as card pages and agent files are, not a second editor:
 * VS Code's save-conflict and reload-merge hand-off (patch 014) covers only `ritemark.editor`, so a deck keeps saving,
 * conflicts, the writer's-copy merge and undo exactly as a document does. This is the host's side of the mode:
 *   - which documents open as decks (the flag, a file on disk, the name, and a deck version this build reads);
 *   - the deck view's `deck/*` requests, decoded with exact fields and answered to that one webview.
 *
 * With the flag off nothing here applies: a `.rtms` or `.deck.md` opens as an ordinary document, its slide blocks as code.
 */

import { openInBrowser } from './openInLink';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { readTimetable } from './timetable';
import { timetableStatus } from './timetableDisplay';
import { isEnabled } from '../features';
import { isRelativeImagePath } from '../utils/imagePaths';
import { parseImageDataUrl, writeImageRelativeTo } from '../utils/imageWriter';
import { ensureProjectSubfolder } from '../projects/projectFolderGuard';
import { deckModeOf } from './deckMode';
import { BUILT_IN_THEME_PATH, isThemePath, MAX_THEMES, parseTheme, pathKey, themeEntries, themePathOf, THEMES_FOLDER, type DeckTheme, type ThemeEntry } from './deckTheme';
import { LOGO_TOO_LARGE, logoAspectOf, logoKindOfName, logoProblem, MAX_LOGO_BYTES, type LogoKind } from './themeLogo';
import { decodeDeckRequest, DeckProtocolError, type DeckCurrentSlide, type DeckHostMessage, type DeckRequest, type DeckNoticeReporter } from './deckProtocol';
import { slideTitleLine, type CurrentSlide } from './currentSlide';
import { decodeDeckPresentMenuRequest, decodeDeckPresentRequest, sessionTimeEdit, type DeckPresentOptions, type DeckPresentRequest } from './present/presentProtocol';
import { frontMatterField, parseFrom } from './deckFormat';
import { slidesOfText } from './deckLibraryFormat';
import { deckName, type DeckLibrary, type LibraryWrite } from './DeckLibrary';
import { projectRelative, projectRoot } from './deckDocuments';
import type { DeckPublisher } from './deckPublish';
import type { DeckPdfSaver } from './deckPdf';
import type { StartCardState } from './startCard';
import type { ThemeChangeView } from './themeChange';

/** One open deck view: its document and panel, and the slide it shows. */
interface DeckView {
  document: vscode.TextDocument;
  panel: vscode.WebviewPanel;
  current: number;
  count: number;
  /** The slide the person is on, and the deck's slide count, as the view last told them (for the AI). */
  slides: DeckCurrentSlide[];
  slideCount: number;
}

/** The same slides, told again? */
function sameSlides(a: DeckCurrentSlide[], b: DeckCurrentSlide[]): boolean {
  return a.length === b.length && a.every((slide, i) => slide.index === b[i].index && slide.id === b[i].id && slide.title === b[i].title);
}

/** The deck the Slide library inserts into: its project-relative path, name and current slide. */
export interface ActiveDeck {
  path: string;
  name: string;
  current: number;
  count: number;
}

/** Library writes kept for their Undo, this many at most. */
const KEPT_WRITES = 20;
/** How long the host waits for an open deck view to answer an insert or a from: line. */
const VIEW_ANSWER_MS = 5000;

export class DeckPages implements vscode.Disposable {
  private readonly views = new Set<DeckView>();
  private active: DeckView | null = null;
  private readonly changed = new vscode.EventEmitter<void>();
  /** The active deck, or the slide it shows, changed (the Slide library says "Insert after slide N"). */
  readonly onDidChangeActive = this.changed.event;
  private readonly slideChanged = new vscode.EventEmitter<void>();
  /** A deck view's current slide (or the slides selected on its strip) changed: the AI's chip follows it. */
  readonly onDidChangeCurrentSlide = this.slideChanged.event;
  private readonly revealed = new vscode.EventEmitter<{ path: string; id: string } | { section: 'topics' | 'other' }>();
  /** Show in the library: the library view shows this topic's slide. */
  readonly onDidRevealInLibrary = this.revealed.event;
  private readonly writes = new Map<string, LibraryWrite>();
  private readonly waiting = new Map<string, (ok: boolean) => void>();
  private requests = 0;
  private readonly sessionEdits = new WeakMap<vscode.TextDocument, Promise<void>>();
  /** Present on the deck's bar (Sprint 159): the presenter, set once at activation (`decksHost.ts`). */
  presenter: {
    start: (origin: { document: vscode.TextDocument; panel: vscode.WebviewPanel }, request: DeckPresentRequest) => Promise<void>;
    options: () => Promise<DeckPresentOptions>;
    setPresenter: (on: boolean) => Promise<void>;
  } | null = null;
  /** Sprint 159 (PR 7): decks New just made, whose view selects the title slide's title once it is drawn; each forgotten after a minute. */
  private readonly selectTitle = new Map<string, ReturnType<typeof setTimeout>>();
  /** A line for the bar of a deck whose view is still to come (a deck renamed into a copy); each forgotten after a minute. */
  private readonly pendingNotice = new Map<string, { text: string; timer: ReturnType<typeof setTimeout> }>();
  /** Sprint 162 PR 5: See what changed for a deck whose view is still to come; each forgotten after a minute. */
  private readonly pendingChange = new Map<string, { build: (webview: vscode.Webview) => Promise<ThemeChangeView>; timer: ReturnType<typeof setTimeout> }>();
  /** Sprint 162 PR 5: the AI's theme changes (`themeAi.ts`), for See what changed's Undo; set once at activation. */
  themeChanges: { undo: (id: string) => Promise<string> } | null = null;
  /** The handout's start card (16 November, frame 20): set once at activation (`decksHost.ts`). */
  startCard: {
    state: (document: vscode.TextDocument) => Promise<StartCardState>;
    gone: (document: vscode.TextDocument) => Promise<void>;
    /** Draft and the copy: true when the card is gone (the row was used), false when it stays (nothing was done). */
    draft: (document: vscode.TextDocument, text: string, notice: DeckNoticeReporter) => Promise<boolean>;
    copy: (document: vscode.TextDocument, source: string, notice: DeckNoticeReporter) => Promise<boolean>;
  } | null = null;
  /** Sprint 170 (#881): Save as PDF from Publish's menu (`deckPdf.ts`), set once at activation. */
  pdf: Pick<DeckPdfSaver, 'save' | 'show'> | null = null;
  /** Sprint 162 PR 2: the theme's tab, for the Theme menu's Edit <Name> and New theme… (set once at activation). */
  themeEditor: {
    open: (deck: vscode.TextDocument, themePath: string) => Promise<void>;
    make: (deck: vscode.TextDocument, request: { name: string; start: 'copy' | 'paper' | 'ember'; use: boolean }) => Promise<{ ok: true; path: string; name: string } | { ok: false; problem: string }>;
  } | null = null;

  /**
   * `library` gives the project's library, or null when the window has no project folder on disk. `publisher` is the
   * bar's Publish (Sprint 159 PR 4).
   */
  constructor(private readonly library: () => DeckLibrary | null = () => null, private readonly publisher: DeckPublisher | null = null) {}

  /** Does this document open as a deck? `flagOn` is the flag now unless given (a connected view's, as it opened). */
  deckModeFor(document: vscode.TextDocument, flagOn = isEnabled('decks')): boolean {
    return deckModeOf({ flagOn, scheme: document.uri.scheme, fsPath: document.uri.fsPath, text: document.getText() });
  }

  /** The connected deck view of this webview, if it is one. */
  private viewFor(webview: vscode.Webview): DeckView | undefined {
    return [...this.views].find(view => view.panel.webview === webview);
  }

  /**
   * Sprint 159 (PR 7): the deck at `fsPath` was just made by New: its view, once it says which slide it shows (its first
   * `deck/current`), is told to select the title slide's title. Forgotten after a minute if no view comes.
   */
  selectTitleWhenShown(fsPath: string): void {
    const key = path.normalize(fsPath);
    clearTimeout(this.selectTitle.get(key));
    this.selectTitle.set(key, setTimeout(() => this.selectTitle.delete(key), 60_000));
  }

  /** Once the view of the deck at `fsPath` says which slide it shows, its bar says `text` (the view may be on its way). */
  noticeWhenShown(fsPath: string, text: string): void {
    const key = path.normalize(fsPath);
    clearTimeout(this.pendingNotice.get(key)?.timer);
    this.pendingNotice.set(key, { text, timer: setTimeout(() => this.pendingNotice.delete(key), 60_000) });
  }

  /**
   * Sprint 162 PR 5: See what changed for an AI's theme change, over the stage of the deck at `fsPath`: now when its view
   * is open, else once it says which slide it shows (the person's press opens it).
   */
  themeChangeWhenShown(fsPath: string, build: (webview: vscode.Webview) => Promise<ThemeChangeView>): void {
    const view = this.openViewOf(fsPath);
    if (view) {
      void build(view.panel.webview).then(change => this.post(view.panel.webview, { type: 'deck/theme-change', change }));
      return;
    }
    const key = path.normalize(fsPath);
    clearTimeout(this.pendingChange.get(key)?.timer);
    this.pendingChange.set(key, { build, timer: setTimeout(() => this.pendingChange.delete(key), 60_000) });
  }

  /** Sprint 162 PR 5: a change was undone: every deck view's sheet for it loses its Undo. */
  themeChangeUndone(id: string): void {
    for (const view of this.views) void this.post(view.panel.webview, { type: 'deck/theme-change-undone', id });
  }

  /** The line for a deck that won't come after all (its rename was refused). */
  dropNotice(fsPath: string): void {
    const key = path.normalize(fsPath);
    clearTimeout(this.pendingNotice.get(key)?.timer);
    this.pendingNotice.delete(key);
  }

  private takeNotice(document: vscode.TextDocument): string | null {
    const key = path.normalize(document.uri.fsPath);
    const pending = this.pendingNotice.get(key);
    if (!pending) return null;
    clearTimeout(pending.timer);
    this.pendingNotice.delete(key);
    return pending.text;
  }

  /** The deck's request to select its title, taken once; none for a deck with no slides (nothing to select). */
  private takeSelectTitle(document: vscode.TextDocument): boolean {
    const key = path.normalize(document.uri.fsPath);
    const timer = this.selectTitle.get(key);
    if (timer === undefined) return false;
    clearTimeout(timer);
    this.selectTitle.delete(key);
    return slidesOfText(document.getText()).length > 0;
  }

  private timetableItem: vscode.StatusBarItem | undefined;

  private refreshTimetable(): void {
    const active = [...this.views].find(view => view.panel.active);
    const status = active && this.deckModeFor(active.document, true)
      ? timetableStatus(readTimetable(active.document.getText())) : null;
    if (!status) {
      this.timetableItem?.hide();
      return;
    }
    // The same status-bar position as the document word count, just left of AI status.
    const item = this.timetableItem ??= vscode.window.createStatusBarItem(
      'ritemark.deckLength', vscode.StatusBarAlignment.Right, 101,
    );
    item.name = 'Ritemark Deck Length';
    item.text = status.text;
    item.tooltip = status.tooltip;
    item.color = status.over ? new vscode.ThemeColor('ritemark.deckLengthOver') : undefined;
    item.show();
  }

  /** A deck's panel, while it is open: the active one is where the library inserts. */
  connect(document: vscode.TextDocument, panel: vscode.WebviewPanel): vscode.Disposable {
    const view: DeckView = { document, panel, current: 0, count: 0, slides: [], slideCount: 0 };
    this.views.add(view);
    if (panel.active) this.active = view;
    const state = panel.onDidChangeViewState(() => {
      this.refreshTimetable();
      if (panel.active && this.active !== view) {
        this.active = view;
        this.changed.fire();
      }
    });
    this.changed.fire();
    this.refreshTimetable();
    const edits = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document === document && event.contentChanges.length && panel.active) this.refreshTimetable();
    });
    // The bar's Publish control hears the page's state while this view is open.
    const seat = this.publisher?.attach(document, message => this.post(panel.webview, message), panel.webview);
    return {
      dispose: () => {
        seat?.dispose();
        state.dispose();
        edits.dispose();
        this.views.delete(view);
        this.refreshTimetable();
        if (this.active === view) this.active = [...this.views].find(other => other.panel.active) ?? null;
        this.changed.fire();
        if (view.slides.length > 0) this.slideChanged.fire();
      },
    };
  }

  /** The deck the library inserts into: the active deck view, or the last one shown. */
  activeDeck(): ActiveDeck | null {
    const view = this.activeView();
    const root = projectRoot();
    const relative = view && root ? projectRelative(root, view.document.uri.fsPath) : null;
    // Sprint 159 (PR 2): the library inserts only while the flag is on (its place shows), into a deck this build writes
    if (!isEnabled('decks') || !view || !relative || !this.deckModeFor(view.document, true)) return null;
    return { path: relative, name: deckName(relative), current: view.current, count: view.count };
  }

  /**
   * The slide the person is on in the open deck view of `fsPath` (17 November): what the AI's message and the
   * composer's chip name. Null when no deck view of it is open, or it hasn't said yet. The active view first, when two
   * panels show the same deck.
   */
  currentSlideOf(fsPath: string): CurrentSlide | null {
    if (!isEnabled('decks')) return null;
    const same = (view: DeckView) => path.normalize(view.document.uri.fsPath) === path.normalize(fsPath);
    const active = this.activeView();
    const view = active && same(active) ? active : [...this.views].find(same);
    if (!view || view.slides.length === 0 || view.slideCount === 0 || !this.deckModeFor(view.document, true)) return null;
    return {
      deck: deckName(view.document.uri.fsPath.split(path.sep).join('/')),
      count: view.slideCount,
      slides: view.slides.map(slide => {
        const title = slideTitleLine(slide.title);
        return { number: slide.index + 1, ...(slide.id ? { id: slide.id } : {}), ...(title ? { title } : {}) };
      }),
    };
  }

  /** Sprint 162 PR 2: the open deck view of `fsPath` that reads as a deck, if there is one. */
  private openViewOf(fsPath: string): DeckView | undefined {
    const key = path.normalize(fsPath).toLowerCase();
    return [...this.views].find(view => path.normalize(view.document.uri.fsPath).toLowerCase() === key && this.deckModeFor(view.document, true));
  }

  /** Sprint 162 PR 2: is the deck at `fsPath` open in a deck view (Save as a new theme… can put the new theme in it)? */
  hasView(fsPath: string): boolean {
    return !!this.openViewOf(fsPath);
  }

  /**
   * Sprint 162 PR 2: the deck at `fsPath` uses the theme at `themePath` now. Its open view writes the `theme:` line, as
   * a pick from the Theme menu (one step of its Undo, and the bar says so). False when no view of it is open.
   */
  useTheme(fsPath: string, themePath: string, name: string): boolean {
    const view = this.openViewOf(fsPath);
    if (!view) return false;
    void this.post(view.panel.webview, { type: 'deck/use-theme', path: themePath, name });
    return true;
  }

  /**
   * Sprint 162 PR 2: the theme file at this project path was written, made or removed (the theme's Save, an AI, another
   * program): each open deck that reads it draws its theme again, read from the file as it is now, so the decks that use
   * it follow at once. A deck reads the file its `theme:` line names, and Evening's file when that one isn't there, so
   * a change of Evening's file reaches every deck; any other only the decks naming it.
   */
  async themeFilesChanged(changed: string): Promise<void> {
    const key = pathKey;
    const evening = key(changed) === key(BUILT_IN_THEME_PATH);
    await Promise.all([...this.views].map(async view => {
      const named = themePathOf(frontMatterField(view.document.getText().replace(/^﻿/, ''), 'theme'));
      if (!evening && key(named) !== key(changed)) return;
      await this.post(view.panel.webview, { type: 'deck/theme', path: named, ...(await deckThemeFor(view.document.uri.fsPath, named, view.panel.webview)) });
      // Sprint 162 PR 6: its page keeps the theme it was published with; the chip says whether that is still this one.
      this.publisher?.lookChanged(view.document);
    }));
  }

  /**
   * Sprint 162 PR 4: a picture in a Themes folder was written, made or removed (a logo put back, replaced in place): each
   * open deck draws its theme again, so its logo (or its missing logo) follows at once.
   */
  async logoFilesChanged(): Promise<void> {
    await Promise.all([...this.views].map(async view => {
      const named = themePathOf(frontMatterField(view.document.getText().replace(/^\uFEFF/, ''), 'theme'));
      await this.post(view.panel.webview, { type: 'deck/theme', path: named, ...(await deckThemeFor(view.document.uri.fsPath, named, view.panel.webview)) });
      this.publisher?.lookChanged(view.document);
    }));
  }

  /** The active deck's text and the ids it holds (for new copies' ids). */
  activeDocument(): vscode.TextDocument | null {
    return this.activeView()?.document ?? null;
  }

  /** Slides into the active deck after its current slide, as one undo step there. */
  async insertIntoActive(parts: Array<{ kind: string; body: string; handout: string }>, after?: number): Promise<boolean> {
    const view = this.activeView();
    if (!view) return false;
    return this.post(view.panel.webview, { type: 'deck/insert', after: after ?? view.current, parts });
  }

  /**
   * The open view of this deck, if there is one: the AI's tools change an open deck through it (one undo step there,
   * and never a whole-file write under the person's typing). Each call waits for the view to say it was done.
   */
  viewOf(fsPath: string): {
    insert: (parts: Array<{ kind: string; body: string; handout: string }>, after: number) => Promise<boolean>;
    setFrom: (id: string, from: string) => Promise<boolean>;
  } | null {
    const view = [...this.views].find(entry => path.normalize(entry.document.uri.fsPath) === path.normalize(fsPath));
    // Sprint 159 (PR 2): a view whose file another program rewrote to a later format shows it as a document, and the
    // library refuses to write it (DeckLibrary)
    if (!view || !this.deckModeFor(view.document, true)) return null;
    const slideCount = () => slidesOfText(view.document.getText()).length;
    return {
      insert: async (parts, after) => {
        const before = slideCount();
        return this.ask(view, requestId => ({ type: 'deck/insert', after, parts, requestId }), () => slideCount() >= before + parts.length);
      },
      setFrom: (id, from) => this.ask(view, requestId => ({ type: 'deck/set-from', id, from, requestId }),
        () => slidesOfText(view.document.getText()).find(slide => slide.data.id === id)?.data.from === from),
    };
  }

  /**
   * Send the view a change and wait for its answer, then for the document to hold the change (the view's edit reaches
   * the document a moment after the view has made it): false when either doesn't come in time.
   */
  private async ask(view: DeckView, message: (requestId: string) => DeckHostMessage, settled: () => boolean): Promise<boolean> {
    const requestId = `r${++this.requests}`;
    const answer = new Promise<boolean>(resolve => {
      const timer = setTimeout(() => { this.waiting.delete(requestId); resolve(false); }, VIEW_ANSWER_MS);
      this.waiting.set(requestId, ok => { clearTimeout(timer); this.waiting.delete(requestId); resolve(ok); });
    });
    if (!(await this.post(view.panel.webview, message(requestId)))) this.waiting.get(requestId)?.(false);
    if (!(await answer)) return false;
    if (settled()) return true;
    return new Promise<boolean>(resolve => {
      const done = (ok: boolean) => { clearTimeout(timer); subscription.dispose(); resolve(ok); };
      const subscription = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document === view.document && settled()) done(true);
      });
      const timer = setTimeout(() => done(settled()), VIEW_ANSWER_MS);
    });
  }

  private activeView(): DeckView | null {
    if (this.active && this.views.has(this.active)) return this.active;
    return [...this.views].find(view => view.panel.visible) ?? null;
  }

  /** One request from a deck view; the answer goes to that webview only. */
  async handle(document: vscode.TextDocument, webview: vscode.Webview, message: unknown): Promise<void> {
    // Sprint 159 (PR 2): a connected deck view (one that opened with the flag on: ritemarkEditor.ts) is served while it
    // lives, as long as its file reads as a deck this build writes; the flag is not read again for the deck itself, so
    // a deck opened with the flag on keeps working after it is turned off. The Slide library's requests need the flag
    // now, since its place shows only then.
    const connected = this.viewFor(webview);
    if (!connected || !this.deckModeFor(document, true)) return;
    // Present (Sprint 159) has its own decoders, beside the presenter's other messages.
    const type = (message as { type?: unknown } | null)?.type;
    if (type === 'deck/present') {
      const present = decodeDeckPresentRequest(message);
      if (present && this.presenter) await this.presenter.start({ document, panel: connected.panel }, present);
      else if (!present) console.warn('[Decks] Dropped a malformed Present request');
      return;
    }
    if (type === 'deck/present-options' || type === 'deck/present-presenter') {
      const menu = decodeDeckPresentMenuRequest(message);
      if (!menu || !this.presenter) return;
      if (menu.type === 'deck/present-presenter') await this.presenter.setPresenter(menu.on);
      try {
        await webview.postMessage(await this.presenter.options());
      } catch {
        // The view closed meanwhile.
      }
      return;
    }
    let request: DeckRequest;
    try {
      request = decodeDeckRequest(message);
    } catch (error) {
      if (error instanceof DeckProtocolError) {
        console.warn('[Decks] Dropped a malformed request:', error.message);
        return;
      }
      throw error;
    }
    switch (request.type) {
      case 'deck/session-time': {
        const { field, value } = request;
        // The end is relative to the start as written. A start and then an end committed in quick succession
        // must use the new start, even when the document has not sent it back to the view yet.
        const pending = (this.sessionEdits.get(document) ?? Promise.resolve()).then(async () => {
          if (document.isClosed) return;
          const change = sessionTimeEdit(document.getText(), field, value);
          if (change) {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, new vscode.Range(document.positionAt(change.start), document.positionAt(change.end)), change.text);
            if (!await vscode.workspace.applyEdit(edit)) throw new Error('Session edit was declined');
          }
          await this.post(webview, { type: 'deck/notice', text: '', kind: 'success', operation: `session-${field}` });
        }).catch(async () => {
          await this.post(webview, { type: 'deck/notice', text: `The session ${field} could not be saved. Try again.`, kind: 'failure', operation: `session-${field}` });
        });
        this.sessionEdits.set(document, pending);
        await pending;
        if (this.sessionEdits.get(document) === pending) this.sessionEdits.delete(document);
        return;
      }
      case 'deck/open-in':
        openInBrowser(request.url);
        return;
      case 'deck/assets': {
        const assets = resolveAssets(document, webview, request.paths);
        await this.post(webview, { type: 'deck/assets', assets, missing: missingPictures(request.paths, assets) });
        return;
      }
      case 'deck/theme':
        await this.post(webview, { type: 'deck/theme', path: request.path, ...(await deckThemeFor(document.uri.fsPath, request.path, webview)) });
        return;
      case 'deck/themes':
        await this.post(webview, { type: 'deck/themes', themes: await this.themesFor(document) });
        return;
      // Sprint 162 PR 2: Edit <Name> and New theme… open the theme's tab; only with the flag on, as the tab opens then.
      case 'deck/edit-theme':
        if (isEnabled('decks')) await this.themeEditor?.open(document, request.path);
        return;
      case 'deck/new-theme': {
        let made: { ok: true; path: string; name: string } | { ok: false; problem: string };
        try {
          made = this.themeEditor && isEnabled('decks')
            ? await this.themeEditor.make(document, { name: request.name, start: request.start, use: request.use })
            : { ok: false, problem: 'Themes are off while Decks are turned off in Settings.' };
        } catch (error) {
          // The sheet always gets an answer: it never stays waiting.
          console.warn('[Decks] New theme failed:', error);
          made = { ok: false, problem: 'The theme could not be made.' };
        }
        await this.post(webview, made.ok ? { type: 'deck/new-theme', ok: true, path: made.path, name: made.name } : { type: 'deck/new-theme', ok: false, problem: made.problem });
        return;
      }
      case 'deck/save-image':
        await this.post(webview, await savePicture(document, webview, request.slideId, request.dataUrl, request.filename));
        return;
      case 'deck/applied':
        this.waiting.get(request.requestId)?.(request.ok);
        return;
      case 'deck/open-library': {
        if (!isEnabled('decks')) return;
        // The + between thumbnails names where the slides go: the library inserts there until another slide is current.
        connected.current = request.after;
        this.active = connected;
        this.changed.fire();
        await vscode.commands.executeCommand(`${SLIDE_LIBRARY_VIEW}.focus`);
        this.revealed.fire({ section: request.section });
        return;
      }
      case 'deck/page-state':
        await this.publisher?.requestPageState(document, webview);
        return;
      case 'deck/live-fit':
        this.publisher?.rememberLiveInput(document, webview, request);
        return;
      case 'deck/live-action':
        await this.publisher?.liveAction(document, request.action, webview);
        return;
      case 'deck/publish':
        await this.publisher?.publish(document, request.text, request.look, request.steps, (text, kind) => void this.post(webview, { type: 'deck/page-notice', text, kind, operation: 'publish' }));
        return;
      case 'deck/page-action':
        await this.publisher?.pageAction(document, request.action, text => void this.post(webview, { type: 'deck/page-notice', text }));
        return;
      // Sprint 170 (#881): Save as PDF from Publish's menu, and the bar's Show in folder after it
      case 'deck/save-pdf':
        await this.pdf?.save(document, request.kind, request.text, request.look, request.steps, message => void this.post(webview, message));
        return;
      case 'deck/pdf-show':
        await this.pdf?.show(document);
        return;
      // The AI's chip and line (17 November): the slide the person is on, as the view last told it
      case 'deck/current-slide':
        if (connected.slideCount !== request.count || !sameSlides(connected.slides, request.slides)) {
          connected.slideCount = request.count;
          connected.slides = request.slides;
          this.slideChanged.fire();
        }
        return;
      case 'deck/current': {
        if (connected.current !== request.index || connected.count !== request.count) {
          connected.current = request.index;
          connected.count = request.count;
          if (connected === this.activeView()) this.changed.fire();
        }
        if (this.takeSelectTitle(document)) await this.post(webview, { type: 'deck/select-title' });
        const notice = this.takeNotice(document);
        if (notice) await this.post(webview, { type: 'deck/notice', text: notice });
        const change = this.pendingChange.get(path.normalize(document.uri.fsPath));
        if (change) {
          clearTimeout(change.timer);
          this.pendingChange.delete(path.normalize(document.uri.fsPath));
          await this.post(webview, { type: 'deck/theme-change', change: await change.build(webview) });
        }
        return;
      }
      case 'deck/theme-change-undo':
        await this.themeChanges?.undo(request.id);
        return;
      // The start card (16 November, frame 20): only with the flag on, as New → Deck is.
      case 'deck/start-card':
        await this.post(webview, { type: 'deck/start-card', state: this.startCard && isEnabled('decks') ? await this.startCard.state(document) : { fresh: false, ai: null, earlier: [] } });
        return;
      case 'deck/start-card-gone':
        await this.startCard?.gone(document);
        return;
      case 'deck/start-draft':
      case 'deck/start-copy': {
        // The card waits for the answer: gone once the row was used, or as it is now when nothing was done
        const card = this.startCard;
        const notice: DeckNoticeReporter = (text, kind) => void this.post(webview, { type: 'deck/notice', text, kind, operation: 'start-card' });
        const gone = !card || !isEnabled('decks') || (request.type === 'deck/start-draft'
          ? await card.draft(document, request.text, notice)
          : await card.copy(document, request.source, notice));
        await this.post(webview, { type: 'deck/start-card', state: gone || !card ? { fresh: false, ai: null, earlier: [] } : await card.state(document) });
        return;
      }
      default:
        await this.handleLibrary(document, webview, request);
    }
  }

  /**
   * Sprint 162: the project's themes for the deck's Theme menu: the files in `Slide library/Themes` of the folder the
   * deck reads its theme from (`deckThemeFor`'s rule), and the built-in theme, each with the number of the project's
   * decks that draw it. A deck outside the open project counts only itself.
   */
  private async themesFor(document: vscode.TextDocument): Promise<ThemeEntry[]> {
    const root = themeRootOf(document.uri.fsPath);
    const files = await projectThemeFiles(root);
    const own = [frontMatterField(document.getText().replace(/^﻿/, ''), 'theme')];
    const library = this.library();
    const project = projectRoot();
    let deckThemes = own;
    if (library && project && path.resolve(project) === path.resolve(root) && projectRelative(project, document.uri.fsPath)) {
      try {
        deckThemes = await library.deckThemes();
      } catch (error) {
        console.warn('[Decks] Could not count the decks for the Theme menu:', error);
      }
    }
    return themeEntries(files, deckThemes);
  }

  /** The copies' and the library's requests, through the project's library. */
  private async handleLibrary(document: vscode.TextDocument, webview: vscode.Webview, request: DeckRequest): Promise<void> {
    const library = this.library();
    const root = projectRoot();
    const deckPath = root ? projectRelative(root, document.uri.fsPath) : null;
    const failed = (id: string | null, message: string) => this.post(webview, { type: 'deck/library-failed', id, message, operation: request.type });
    if (!isEnabled('decks')) {
      // Sprint 159 (PR 2): the deck keeps working with the flag turned off since it opened, but the library is off
      if (request.type === 'deck/source-states') await this.post(webview, { type: 'deck/source-states', states: [] });
      else if (request.type !== 'deck/show-in-library') await failed('id' in request ? request.id : null, 'The Slide library is off while Decks are turned off in Settings.');
      return;
    }
    if (!library || !deckPath) {
      if (request.type !== 'deck/source-states') await failed(null, 'The Slide library works for a deck inside the open project folder.');
      return;
    }
    // The copy as the view holds it now (its newest words may still be on their way to the document), written by the
    // same writer that writes the file, so its stamp is the file's.
    const part = (id: string, text: string) => {
      const slide = slidesOfText(text).find(entry => entry.data.id === id);
      if (!slide) throw new Error('That slide is no longer in the deck.');
      return { id, kind: slide.kind, body: slide.body, handout: slide.handout, from: slide.data.from };
    };
    try {
      switch (request.type) {
        case 'deck/source-states': {
          const copies = slidesOfText(document.getText())
            .filter(slide => slide.data.id && slide.data.from)
            .map(slide => ({ id: slide.data.id as string, from: slide.data.from as string, kind: slide.kind, body: slide.body, handout: slide.handout }));
          await this.post(webview, { type: 'deck/source-states', states: copies.length ? await library.sourceStates(deckPath, copies) : [] });
          return;
        }
        case 'deck/update-library': {
          const write = await library.updateLibrarySlide(deckPath, part(request.id, request.text));
          await this.post(webview, { type: 'deck/library-written', id: request.id, from: write.from, verb: 'updated', token: this.keep(write), sourceName: deckName(write.path) });
          return;
        }
        case 'deck/use-library': {
          const copy = part(request.id, request.text);
          const copied = await library.useSource(deckPath, copy.body, copy.kind);
          await this.post(webview, { type: 'deck/library-part', id: request.id, ...copied });
          return;
        }
        case 'deck/add-to-library': {
          const copy = part(request.id, request.text);
          const topic = request.topic?.trim() || await pickTopic(library);
          if (!topic) return;
          const write = await library.addToLibrary(deckPath, topic, copy);
          await this.post(webview, { type: 'deck/library-written', id: request.id, from: write.from, verb: 'added', token: this.keep(write), sourceName: deckName(write.path) });
          return;
        }
        case 'deck/library-topics': {
          const topics = await library.listDecks({ where: 'library' });
          await this.post(webview, { type: 'deck/library-topics', topics: topics.map(topic => ({ path: topic.path, name: topic.name, count: topic.slides.length })) });
          return;
        }
        case 'deck/show-in-library': {
          const source = parseFrom(request.from);
          if (!source) return;
          await vscode.commands.executeCommand(`${SLIDE_LIBRARY_VIEW}.focus`);
          await this.post(webview, { type: 'deck/notice', text: '', kind: 'success', operation: request.type });
          this.revealed.fire({ path: source.path, id: source.id });
          return;
        }
        case 'deck/undo-library': {
          const write = this.writes.get(request.token);
          this.writes.delete(request.token);
          if (!write || !(await library.undoWrite(write))) {
            await this.post(webview, { type: 'deck/notice', text: 'The library was changed since, so it is left as it is.', kind: 'success', operation: request.type });
            return;
          }
          await this.post(webview, { type: 'deck/library-undone', token: request.token });
          return;
        }
      }
    } catch (error) {
      await failed('id' in request ? request.id : null, error instanceof Error ? error.message : 'The Slide library could not do that.');
    }
  }

  /** Keep a library write for its Undo; returns the token the view sends back. */
  private keep(write: LibraryWrite): string | null {
    if (write.previous === null) return null;
    const token = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    this.writes.set(token, write);
    while (this.writes.size > KEPT_WRITES) this.writes.delete(this.writes.keys().next().value as string);
    return token;
  }

  private async post(webview: vscode.Webview, message: DeckHostMessage): Promise<boolean> {
    try {
      return await webview.postMessage(message);
    } catch {
      // The view closed meanwhile.
      return false;
    }
  }

  dispose(): void {
    this.timetableItem?.dispose();
    for (const timer of this.selectTitle.values()) clearTimeout(timer);
    this.selectTitle.clear();
    for (const pending of this.pendingNotice.values()) clearTimeout(pending.timer);
    this.pendingNotice.clear();
    for (const pending of this.pendingChange.values()) clearTimeout(pending.timer);
    this.pendingChange.clear();
    this.changed.dispose();
    this.slideChanged.dispose();
    this.revealed.dispose();
    this.views.clear();
  }
}

/** The view id of the Slide library place. */
export const SLIDE_LIBRARY_VIEW = 'ritemark.slideLibraryView';

/** Add to library: one of the library's topics, or a new one by name. */
async function pickTopic(library: DeckLibrary): Promise<string | null> {
  const topics = await library.listDecks({ where: 'library' });
  const NEW = '$(add) New topic…';
  const picked = await vscode.window.showQuickPick(
    [...topics.map(topic => ({ label: topic.name, description: `${topic.slides.length} slides`, path: topic.path })), { label: NEW, description: '', path: '' }],
    { title: 'Add to the Slide library', placeHolder: 'Choose the topic this slide belongs to' },
  );
  if (!picked) return null;
  if (picked.path) return picked.path;
  const name = await vscode.window.showInputBox({
    title: 'New topic in the Slide library',
    prompt: 'A topic is a deck in the Slide library folder.',
    placeHolder: 'Working with data',
    validateInput: value => (value.trim() ? (/[\\/:*?"<>|]/.test(value) ? 'A topic name has no / \\ : * ? " < > |' : null) : 'Give the topic a name'),
  });
  return name?.trim() || null;
}

function resolveAssets(document: vscode.TextDocument, webview: vscode.Webview, paths: string[]): Record<string, string> {
  return resolveAssetsIn(path.dirname(document.uri.fsPath), webview, paths);
}

/**
 * 17 November: the relative pictures asked for that `resolveAssetsIn` found no file for. The deck view draws them as
 * missing, with their names, instead of an empty place; only paths the slides themselves name are ever asked.
 */
export function missingPictures(paths: string[], assets: Record<string, string>): string[] {
  return [...new Set(paths.filter(relative => isRelativeImagePath(relative) && !assets[relative]))];
}

/**
 * The slides' pictures as webview URIs: only relative paths beside the deck that name a file (the same test the
 * editor's Markdown images use), each with its modified time so a changed picture is drawn again.
 */
export function resolveAssetsIn(folder: string, webview: vscode.Webview, paths: string[]): Record<string, string> {
  const assets: Record<string, string> = {};
  for (const relative of paths) {
    if (!isRelativeImagePath(relative) || assets[relative]) continue;
    const absolute = path.resolve(folder, relative);
    try {
      const stat = fs.statSync(absolute);
      if (!stat.isFile()) continue;
      assets[relative] = `${webview.asWebviewUri(vscode.Uri.file(absolute)).toString()}?v=${Math.round(stat.mtimeMs)}`;
    } catch {
      // No such picture: the slide draws its empty picture place.
    }
  }
  return assets;
}

/** A theme file is front matter only: anything larger than this is not one. */
const MAX_THEME_BYTES = 64 * 1024;

/**
 * Sprint 162 (step-3-themes.md, "A project's own file takes a built-in's place"): the theme file named, or, when the
 * project has no such file (or none is named), the project's own `Evening.theme.md`; null when it has neither, and the
 * reader draws the built-in theme.
 */
export async function readThemeOrEvening(root: string, themePath: string | null | undefined): Promise<string | null> {
  return (await readThemeFileOrEvening(root, themePath))?.text ?? null;
}

/** `readThemeOrEvening`, with the project path of the file it read (its logo is beside it, Sprint 162 PR 4). */
export async function readThemeFileOrEvening(root: string, themePath: string | null | undefined): Promise<{ path: string; text: string; bytes: Buffer } | null> {
  const named = themePath && isThemePath(themePath) ? await readProjectThemeBytes(root, themePath) : null;
  if (named !== null) return { path: themePath!.trim(), text: named.toString('utf8'), bytes: named };
  const evening = await readProjectThemeBytes(root, BUILT_IN_THEME_PATH);
  return evening === null ? null : { path: BUILT_IN_THEME_PATH, text: evening.toString('utf8'), bytes: evening };
}

/**
 * Sprint 162 PR 4: a theme's logo on disk, as every view finds it. `none`: the theme has no logo. `found`: its file,
 * read (the page carries these bytes), inside the project once links are followed. `missing`: no file there; the
 * slides draw no logo and the theme's tab says so. `refused`: something there that can't be the logo (too large, not
 * the picture its name says, an SVG with scripts or links in it, outside the project); drawn as missing, with why.
 */
export type ThemeLogoFile =
  | { state: 'none' }
  | { state: 'found'; absolute: string; file: string; kind: LogoKind; bytes: Buffer; modified: number; aspect: number | null }
  | { state: 'missing'; file: string }
  | { state: 'refused'; file: string; problem: string };

/** The logo files read lately, by their real path and name, with the time and size they were read at. */
const logoFileCache = new Map<string, { modified: number; size: number; answer: ThemeLogoFile }>();

export async function themeLogoFile(root: string, themePath: string, theme: Pick<DeckTheme, 'logo'>, second = false, fresh = false): Promise<ThemeLogoFile> {
  // `second`: the logo's second version (18 November), found, checked and refused by the same rules.
  const file = second ? theme.logo?.second?.file : theme.logo?.file;
  if (!file) return { state: 'none' };
  const refused = (problem: string): ThemeLogoFile => ({ state: 'refused', file, problem });
  const kind = logoKindOfName(file);
  if (!kind) return refused('A logo is an SVG or a PNG picture.');
  const absolute = path.resolve(root, path.dirname(themePath.trim()), ...file.split(/[\\/]/));
  if (!projectRelative(root, absolute)) return refused('The logo is outside the project.');
  let realFile: string;
  try {
    realFile = await fs.promises.realpath(absolute);
  } catch {
    return { state: 'missing', file };
  }
  try {
    // A link inside the project that points out of it is not followed.
    if (!projectRelative(await fs.promises.realpath(root), realFile)) return refused('The logo is outside the project.');
    const stat = await fs.promises.stat(realFile);
    if (!stat.isFile()) return { state: 'missing', file };
    if (stat.size > MAX_LOGO_BYTES) return refused(LOGO_TOO_LARGE);
    // Read and checked once for each version of the file (the review of #785: the tab asks at every change of the draft).
    const key = `${realFile}\u0000${file}`;
    const seen = logoFileCache.get(key);
    if (!fresh && seen && seen.modified === stat.mtimeMs && seen.size === stat.size) return seen.answer;
    const bytes = await fs.promises.readFile(realFile);
    const problem = logoProblem(file, bytes);
    const answer: ThemeLogoFile = problem ? refused(problem) : { state: 'found', absolute, file, kind, bytes, modified: Math.round(stat.mtimeMs), aspect: logoAspectOf(bytes, kind) };
    if (logoFileCache.size >= 16) logoFileCache.delete(logoFileCache.keys().next().value!);
    logoFileCache.set(key, { modified: stat.mtimeMs, size: stat.size, answer });
    return answer;
  } catch {
    return { state: 'missing', file };
  }
}

/** A found logo's address in a webview, with its modified time, so a changed picture is drawn again. */
export function logoWebviewUri(webview: vscode.Webview, found: Extract<ThemeLogoFile, { state: 'found' }>): string {
  return `${webview.asWebviewUri(vscode.Uri.file(found.absolute)).toString()}?v=${found.modified}`;
}

/**
 * The theme a deck at `deckPath` draws, as the deck view and the wall are sent it: the theme
 * file's text (null: the built-in theme), and its logo's address in this webview (null: none, or a missing file), and
 * its second version's (18 November), each with its width to its height. Which one a slide draws is the drawer's
 * (`themeSlideLogo`), which knows the deck's look.
 */
export async function deckThemeFor(deckPath: string, themePath: string, webview: vscode.Webview): Promise<DeckThemeAddresses> {
  const root = themeRootOf(deckPath);
  const read = await readThemeFileOrEvening(root, themePath);
  if (!read) return { text: null, logo: null, logoAspect: null, secondLogo: null, secondLogoAspect: null };
  const theme = parseTheme(read.text);
  const [found, second] = await Promise.all([themeLogoFile(root, read.path, theme), themeLogoFile(root, read.path, theme, true)]);
  return {
    text: read.text,
    logo: found.state === 'found' ? logoWebviewUri(webview, found) : null,
    logoAspect: found.state === 'found' ? found.aspect : null,
    secondLogo: second.state === 'found' ? logoWebviewUri(webview, second) : null,
    secondLogoAspect: second.state === 'found' ? second.aspect : null,
  };
}

export interface DeckThemeAddresses {
  text: string | null;
  logo: string | null;
  logoAspect: number | null;
  secondLogo: string | null;
  secondLogoAspect: number | null;
}

/** The theme a deck at `deckPath` draws, and its logo file and its second version's (Sprint 162 PR 4: the page carries one). */
export async function deckThemeAndLogo(deckPath: string, themePath: string, fresh = false) {
  const root = themeRootOf(deckPath);
  const files = [themePath, BUILT_IN_THEME_PATH].filter(isThemePath).map(file => path.resolve(root, file.trim()));
  const read = await readThemeFileOrEvening(root, themePath);
  if (!read) {
    return { text: null, bytes: null, files, logo: { state: 'none' } as const, secondLogo: { state: 'none' } as const };
  }
  const theme = parseTheme(read.text);
  for (const file of [theme.logo?.file, theme.logo?.second?.file]) {
    if (!file) continue;
    const absolute = path.resolve(root, path.dirname(read.path), ...file.split(/[\\/]/));
    if (projectRelative(root, absolute)) files.push(absolute);
  }
  const [logo, secondLogo] = await Promise.all([themeLogoFile(root, read.path, theme, false, fresh), themeLogoFile(root, read.path, theme, true, fresh)]);
  return { text: read.text, bytes: read.bytes, files, logo, secondLogo };
}

/** The folder a deck at `deckPath` reads its theme from: its project folder, or its own folder when it has none. */
export function themeRootOf(deckPath: string): string {
  return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(deckPath))?.uri.fsPath ?? path.dirname(deckPath);
}

/**
 * Sprint 162: the theme files in `Slide library/Themes` of the project at `root`, each read by `readProjectTheme`'s
 * rule (inside the project once links are followed, small enough to be a theme). None when the folder isn't there.
 */
export async function projectThemeFiles(root: string): Promise<Array<{ path: string; text: string }>> {
  let names: string[];
  try {
    names = (await fs.promises.readdir(path.join(root, THEMES_FOLDER))).filter(name => /\.theme\.md$/i.test(name)).sort();
  } catch {
    return [];
  }
  // Read side by side: the Theme menu waits on them each time it opens.
  const read = await Promise.all(names.slice(0, MAX_THEMES).map(async name => {
    const relative = `${THEMES_FOLDER}/${name}`;
    return { path: relative, text: await readProjectTheme(root, relative) };
  }));
  return read.filter((file): file is { path: string; text: string } => file.text !== null);
}

/** The text of a theme file in the project at `root`, or null (the same limits as a deck's own theme). */
export async function readProjectTheme(root: string, themePath: string): Promise<string | null> {
  return (await readProjectThemeBytes(root, themePath))?.toString('utf8') ?? null;
}

async function readProjectThemeBytes(root: string, themePath: string): Promise<Buffer | null> {
  if (!isThemePath(themePath)) return null;
  const absolute = path.resolve(root, themePath);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  try {
    // A link inside the project that points out of it is not followed.
    const [realRoot, realFile] = await Promise.all([fs.promises.realpath(root), fs.promises.realpath(absolute)]);
    const realRelative = path.relative(realRoot, realFile);
    if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) return null;
    const stat = await fs.promises.stat(realFile);
    if (!stat.isFile() || stat.size > MAX_THEME_BYTES) return null;
    return await fs.promises.readFile(realFile);
  } catch {
    return null;
  }
}

/**
 * A picture pasted or dropped on a slide, saved as the editor saves a pasted picture: in `images/` beside the deck
 * (only while the deck's folder is there), under a cleaned name that never overwrites another file.
 */
async function savePicture(document: vscode.TextDocument, webview: vscode.Webview, slideId: string, dataUrl: string, filename: string): Promise<DeckHostMessage> {
  try {
    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed) throw new Error('That is not a picture.');
    const folder = path.dirname(document.uri.fsPath);
    const imagesDir = path.join(folder, 'images');
    await ensureProjectSubfolder(folder, imagesDir);
    const written = writeImageRelativeTo(imagesDir, `${path.basename(filename, path.extname(filename))}.${parsed.extension}`, parsed.base64);
    const url = webview.asWebviewUri(vscode.Uri.file(path.join(imagesDir, written))).toString();
    return { type: 'deck/image-saved', slideId, path: `images/${written}`, url };
  } catch (error) {
    console.warn('[Decks] Could not save a picture:', error);
    return { type: 'deck/image-failed', slideId, message: 'The picture could not be saved beside the deck.' };
  }
}
