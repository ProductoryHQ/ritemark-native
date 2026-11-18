/**
 * Presenting a deck (Sprint 159; experience 17): the wall (PR 5) and the presenter view (PR 6).
 *
 * Present on a deck's bar (or ⌘↩, ⇧⌘↩ from the start) asks the host here. The wall is a webview panel,
 * `ritemark.deckWall`, drawn with the deck view's own `SlideCanvas` from the shared `webview.js`; the presenter view is
 * another, `ritemark.deckPresenter`, in Ritemark Dark: the slide now and the next one, the notes, the row of slides,
 * the clock, Next, Swap displays.
 *
 * Where they go:
 *  - With the shell's `_ritemark.present.*` commands (patch 018, `ritemarkPresent.ts`): the wall goes full screen on the
 *    second display (the one that isn't built in) and the presenter view on the laptop's, each in a window of its own
 *    with nothing of Ritemark around it. The presenter view comes on by itself with two displays; the menu turns it off.
 *  - Without them (an older shell, or a dev build whose `vscode/` lacks the patches), Present opens nothing.
 *
 * The host is the only source of state. The session (`presentSession.ts`) holds the current slide by its key and reads
 * the deck's open document again at every move, so an edit reaches the wall at the next move. The presenter view's Now
 * is the slide the wall last got, in the wall's look, so it changes with the wall; its next slide and row follow edits
 * as they come. The wall's state is built field by field and never carries the notes; only the presenter view's panel
 * gets them.
 *
 * Stopping (Esc in either window, Stop, or the wall's window closed) closes both and returns the deck view to the slide
 * the presenter ended on.
 *
 * `RITEMARK_PRESENT_WINDOWED=1` keeps both in windows instead of full screen, and offers the presenter view on one
 * display, only in a dev build (`VSCODE_DEV`), so a hidden test run never takes over the screen.
 *
 * Without the shell's commands Present stays enabled and is answered with a notice in the deck's bar, words only
 * (`PRESENT_NEEDS_UPDATE`; in a dev build `PRESENT_NEEDS_PATCHES`, which says what to run); nothing opens. Until 17
 * November a dev build placed the wall with VS Code's own window commands instead, but such a window keeps Ritemark's
 * frame: its tab row whenever the compact step never came (the wall's window not reporting the focus), the desk's edge
 * and gap always. The PR 1 builder's stale dev tree showed the room the tab row, so that path is gone: nothing of
 * Ritemark is ever on the wall, in a dev build either.
 */
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { isShellPageSignal } from '../../shellPageSignals';
import { resolveDocumentResourceRoots } from '../../webviewResourceRoots';
import { parseDeck } from '../deckFormat';
import { BUILT_IN_THEME, parseTheme, themePathOf, type DeckTheme } from '../deckTheme';
import { deckThemeFor, resolveAssetsIn } from '../deckPages';
import {
  DECK_PRESENTER_VIEW_TYPE,
  DECK_WALL_VIEW_TYPE,
  decodeWallRequest,
  frontMatterEdit,
  lengthMinutesOf,
  shownBlank,
  wallPageAddress,
  MAX_LENGTH_MINUTES,
  presenterPicturePaths,
  presenterStateOf,
  wallPicturePaths,
  wallStateOf,
  chooseDisplays,
  type WallPointer,
  type WallTimer,
  PRESENT_NEEDS_PATCHES,
  PRESENT_NEEDS_UPDATE,
  type DeckPresentOptions,
  type DeckPresentRequest,
  type PresentDisplay,
  type WallHostMessage,
  type WallRequest,
  type ClockLocale,
  type WallBlank,
  type WallFocus,
  NO_FOCUS,
  type WallState,
} from './presentProtocol';
import { readSystemClock } from './systemClock';
import { deckLookOf, deckTransitionOf, frontMatterValue, PresentSession, PresentStartError, presentTitleOf, type DeckTransition, type PresentMove } from './presentSession';

/** Where the presentation was started from: the deck's document, and its view to return to. */
interface DeckOrigin {
  document: vscode.TextDocument;
  panel: vscode.WebviewPanel;
}

/** One window of the presentation: its panel, its page's loads, and the pictures resolved for it. */
interface Screen {
  panel: vscode.WebviewPanel;
  /** The page as made for it, set again when a move leaves the panel without its page. */
  html: string;
  /** How many times the page has loaded and said so (`present/ready`), and a wait for the next load. */
  loads: number;
  loaded: Array<() => void>;
  assets: { version: number; paths: string; value: Record<string, string> } | null;
}

/** One presentation. */
interface Running {
  session: PresentSession;
  origin: DeckOrigin;
  wall: Screen;
  presenter: Screen | null;
  subscriptions: vscode.Disposable[];
  /** The theme, read once per theme path (a move reads the front matter again). */
  theme: { path: string | null; value: DeckTheme };
  /** The state the wall last got: the presenter view's Now is its slide, in its look. */
  wallState: WallState | null;
  /** The shell places the windows (`_ritemark.present.place`), and the displays it reported. */
  shell: boolean;
  displays: PresentDisplay[];
  /** The displays the wall and the presenter view are on, by their index in `displays`. */
  wallDisplay: number;
  presenterDisplay: number;
  startedAt: number;
  ended: boolean;
  /** A swap is moving the windows: a second press meanwhile is let go. */
  swapping: boolean;
  /** The presenter view's refresh after an edit, once the typing pauses; and the latest state's number. */
  refresh: ReturnType<typeof setTimeout> | null;
  presenterSerial: number;
  /** B, "." or W blanked the wall (until any key, a click or a move); the presenter view says so. */
  blank: WallBlank | null;
  /** Decks README items 11 and 16: the spotlit item and the picture filling the wall, until a move (never saved). */
  focus: WallFocus;
  /** The system's clock, read once at the start, for the presenter view's time of day (the webview's own until then). */
  clock: ClockLocale;
  /** The deck's published page, by its address (Q shows its QR code), or null while it isn't published. */
  page: string | null;
  /** Each blank request and move takes a number: a Q still asking for the page gives way to a later key or move. */
  blankSerial: number;
  /** Decks README item 9: the exercise's timer, started from the presenter view, until stopped (never saved). */
  timer: WallTimer | null;
}

/** The shell's commands (patch 018). */
const DISPLAYS_COMMAND = '_ritemark.present.displays';
const PLACE_COMMAND = '_ritemark.present.place';
/** How long the host waits for a new panel to be an editor before it is placed. */
const ACTIVE_WAIT_MS = 3000;
/** How long a page may take to load (the bundle is large): before a panel is moved, and again after. */
const LOAD_WAIT_MS = 8000;
const RELOAD_WAIT_MS = 4000;
/** The presenter view follows edits this long after the typing pauses. */
const EDIT_REFRESH_MS = 200;
/** Presenter view on or off, as the person last chose in the menu (on by default, with two displays). */
const PRESENTER_KEY = 'ritemark.present.presenterView';
/** The dev windowed mode's windows, on the one display: the wall left, the presenter view right. */
const WINDOWED_WALL = { x: 24, y: 64, width: 800, height: 450 };
const WINDOWED_PRESENTER = { x: 840, y: 64, width: 864, height: 540 };

/** The dev-only windowed mode: honoured only in a dev build. */
export function presentWindowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.RITEMARK_PRESENT_WINDOWED === '1' && !!env.VSCODE_DEV;
}

/**
 * A presenter view can show: the shell places the windows, and there is a second display (or a dev build's windowed
 * mode). The menu and a running presentation read the same rule.
 */
export function presenterViewAvailable(shell: boolean, displays: number, windowed: boolean = presentWindowed()): boolean {
  return shell && (displays > 1 || windowed);
}


/** A theme path no deck names: the wall's theme before its first look. */
const UNREAD_THEME = '\u0000unread';
export class DeckPresenter implements vscode.Disposable {
  private running: Running | null = null;
  /** Each start takes a number; a later start, or a Stop, makes an earlier one that is still waiting give up. */
  private starts = 0;

  /**
   * Small details item 3: the deck's published page's address, or null (Publish's page state, `deckPublish.ts`). Set
   * once at activation; without it no deck is published here, and Q and "Show the page" are not offered.
   */
  pageAddress: ((document: vscode.TextDocument) => Promise<string | null>) | null = null;
  /** Publish's page state changed (a page published or unpublished): the running presentation asks again. */
  onPageChange: ((listener: () => void) => vscode.Disposable) | null = null;

  constructor(private readonly extensionUri: vscode.Uri, private readonly state: vscode.Memento) {}

  /** The Present menu's Presenter view: available with two displays and the shell's commands; on unless turned off. */
  async options(): Promise<DeckPresentOptions> {
    const shell = await hasShellPlacement();
    const displays = shell ? await readDisplays() : [];
    const available = presenterViewAvailable(shell, displays.length);
    const chosen = chooseDisplays(displays);
    return {
      type: 'deck/present-options',
      available,
      on: available && this.presenterWanted(),
      wallDisplay: available && displays.length > 1 ? displays[chosen.wall].name : null,
    };
  }

  /**
   * Presenter view on or off, kept for the next presentation (and this one, while it runs). It returns once the choice
   * is kept, so the menu's check changes at once; placing the window in a running presentation goes on after.
   */
  async setPresenter(on: boolean): Promise<void> {
    await this.state.update(PRESENTER_KEY, on);
    const running = this.running;
    if (running && running.shell && !running.ended) {
      void this.togglePresenter(running, on).catch(error => console.error('[Decks] Presenter view could not be turned', on ? 'on' : 'off', error));
    }
  }

  private presenterWanted(): boolean {
    return this.state.get<boolean>(PRESENTER_KEY, true);
  }

  /** Present, from the deck view's current slide or from the start. A second Present ends the first. */
  async start(origin: DeckOrigin, request: DeckPresentRequest): Promise<void> {
    this.stop();
    const start = ++this.starts;
    // First, before the deck is read or anything opens: a shell without the placement commands can't place the wall,
    // and Present answers with the notice (in a dev build, what to run).
    const shell = await hasShellPlacement();
    // Another Present (⌘↩ twice, or from another deck view) or a Stop came while this one asked the shell: it gives up.
    if (start !== this.starts) return;
    if (!shell) {
      await post(origin.panel.webview, { type: 'deck/present-failed', message: presentNeedsShellMessage() });
      return;
    }
    let session: PresentSession;
    try {
      session = new PresentSession(origin.document.getText(), request.from === 'start' ? { from: 'start' } : { from: 'here', index: request.index });
    } catch (error) {
      if (!(error instanceof PresentStartError)) throw error;
      await post(origin.panel.webview, { type: 'deck/present-failed', message: error.message });
      return;
    }
    const displays = await readDisplays();
    if (start !== this.starts) return;
    const chosen = chooseDisplays(displays);
    const running: Running = {
      session,
      origin,
      wall: this.createScreen(origin, DECK_WALL_VIEW_TYPE),
      presenter: null,
      subscriptions: [],
      // Nothing read yet: the first look reads the theme, also for a deck naming none (the project's own Evening file, as
      // the deck view draws it; the review of #785).
      theme: { path: UNREAD_THEME, value: BUILT_IN_THEME },
      wallState: null,
      shell,
      displays,
      wallDisplay: chosen.wall,
      presenterDisplay: chosen.presenter,
      startedAt: Date.now(),
      ended: false,
      swapping: false,
      refresh: null,
      presenterSerial: 0,
      blank: null,
      focus: NO_FOCUS,
      clock: { locale: null, hourCycle: null },
      page: null,
      blankSerial: 0,
      timer: null,
    };
    this.running = running;
    // Whether the deck is published, and where: the wall and the presenter view get it once it is known, and again
    // whenever Publish's page state changes (published from the main window during the talk, or unpublished).
    void this.readPage(running);
    if (this.onPageChange) running.subscriptions.push(this.onPageChange(() => { void this.readPage(running); }));
    // The system's clock comes a moment later (macOS's `defaults`): the presenter view gets it then.
    void readSystemClock().then(clock => {
      running.clock = clock;
      if (clock.locale !== null || clock.hourCycle !== null) void this.showPresenter(running);
    });
    this.listen(running, running.wall);
    running.subscriptions.push(
      // The deck's view closed: there is nothing to return to, and the presentation goes too.
      origin.panel.onDidDispose(() => { if (this.running === running) this.stop(); }),
      // The presenter view's next slide and row follow edits as they come, once the typing pauses (the wall, and the
      // presenter view's Now with it, wait for the next move).
      vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document !== origin.document || !running.presenter) return;
        if (running.refresh) clearTimeout(running.refresh);
        running.refresh = setTimeout(() => { running.refresh = null; void this.showPresenter(running); }, EDIT_REFRESH_MS);
      }),
      { dispose: () => { if (running.refresh) clearTimeout(running.refresh); } },
    );
    // The wall is placed on its display, then the presenter view is made and placed on the laptop's, which keeps the
    // focus (the presenter's keys and clicker work there). Each panel is made in the deck's group, where it is the
    // tab in front, so its page loads before it moves (a panel behind another tab loads nothing).
    await this.place(running, running.wall, DECK_WALL_VIEW_TYPE, running.wallDisplay, WINDOWED_WALL);
    // (A presenter view turned on from the wall's bar while the wall was being placed is there already.)
    if (this.presenterAvailable(running) && this.presenterWanted() && !running.ended && !running.presenter) {
      this.addPresenter(running);
      if (running.presenter) await this.place(running, running.presenter, DECK_PRESENTER_VIEW_TYPE, running.presenterDisplay, WINDOWED_PRESENTER);
      // The wall's bar shows the presenter view as on (the wall's first state, sent when it loaded, said off).
      if (!running.ended) await this.showWall(running);
    }
    // The keys go to the window placed last: the focus inside its page, not only on its window.
    const focused = (running.presenter ?? running.wall).panel;
    if (!running.ended) focused.reveal(focused.viewColumn, false);
  }

  /** Stop the presentation: both windows close and the deck view returns to the slide the presenter ended on. */
  stop(): void {
    // A start still asking the shell gives up too.
    this.starts++;
    const running = this.running;
    if (!running) return;
    running.presenter?.panel.dispose();
    running.wall.panel.dispose();
  }

  private presenterAvailable(running: Running): boolean {
    return presenterViewAvailable(running.shell, running.displays.length);
  }

  private createScreen(origin: DeckOrigin, viewType: string): Screen {
    const document = origin.document;
    const panel = vscode.window.createWebviewPanel(
      viewType,
      deckTitle(document),
      // In the deck's own group, in front: never in the wall's locked window, and loaded at once.
      { viewColumn: origin.panel.viewColumn ?? vscode.ViewColumn.Active, preserveFocus: false },
      {
        enableScripts: true,
        // Kept while hidden: the go-to box, the grid and the clock survive anything shown over them for a moment.
        retainContextWhenHidden: true,
        localResourceRoots: resolveDocumentResourceRoots({
          mediaPath: vscode.Uri.joinPath(this.extensionUri, 'media').fsPath,
          documentPath: document.uri.fsPath,
          workspaceFolderPath: workspaceFolderOf(document),
          homeDir: os.homedir(),
        }).map(root => vscode.Uri.file(root)),
      },
    );
    const html = presentHtml(panel.webview, this.extensionUri, viewType === DECK_WALL_VIEW_TYPE ? 'deck-wall' : 'deck-presenter');
    panel.webview.html = html;
    return { panel, html, loads: 0, loaded: [], assets: null };
  }

  private listen(running: Running, screen: Screen): void {
    running.subscriptions.push(
      screen.panel.webview.onDidReceiveMessage(message => { void this.receive(running, screen, message); }),
      screen.panel.onDidDispose(() => {
        if (screen === running.wall) void this.end(running);
        else if (running.presenter === screen) {
          running.presenter = null;
          // A dot the presenter view was showing goes with it (item 12).
          void post(running.wall.panel.webview, { type: 'present/pointer', at: null } satisfies WallPointer);
          void this.showWall(running);
        }
      }),
    );
  }

  /** The presenter view's panel, made in the main window (placed by the caller). */
  private addPresenter(running: Running): void {
    const screen = this.createScreen(running.origin, DECK_PRESENTER_VIEW_TYPE);
    running.presenter = screen;
    this.listen(running, screen);
  }

  private async togglePresenter(running: Running, on: boolean): Promise<void> {
    if (on && !running.presenter && this.presenterAvailable(running)) {
      this.addPresenter(running);
      if (running.presenter) await this.place(running, running.presenter, DECK_PRESENTER_VIEW_TYPE, running.presenterDisplay, WINDOWED_PRESENTER);
      await this.showWall(running);
    } else if (!on && running.presenter) {
      // Its onDidDispose tells the wall.
      running.presenter.panel.dispose();
    }
  }

  /**
   * The shell places a panel in a window of its own on a display, once the panel is an editor it can find and its page
   * has loaded. The window it places last has the focus. A webview moved into a new window loads its page again; when
   * it doesn't (a panel moved while its first page was still on its way), the page is set again. A panel already in
   * its own window moves with the window (Swap displays) and keeps its page.
   */
  private async place(running: Running, screen: Screen, viewType: string, display: number, windowed: { x: number; y: number; width: number; height: number }): Promise<void> {
    if (!(await panelIsOpen(running, viewType))) return;
    if (screen.loads === 0) await nextLoad(screen, LOAD_WAIT_MS).loaded;
    if (running.ended) return;
    const fullScreen = !presentWindowed();
    const reloaded = nextLoad(screen, RELOAD_WAIT_MS);
    const placed = await vscode.commands.executeCommand<unknown>(PLACE_COMMAND, { viewType, display, fullScreen, ...(fullScreen ? {} : { windowed }) });
    if (placed !== 'opened') {
      reloaded.cancel();
      return;
    }
    if (!(await reloaded.loaded) && !running.ended) screen.panel.webview.html = `${screen.html}<!-- ${Date.now()} -->`;
  }

  /** Swap displays: the wall goes where the presenter view is, and the presenter view where the wall was. */
  private async swap(running: Running): Promise<void> {
    if (!running.shell || running.displays.length < 2 || running.swapping) return;
    running.swapping = true;
    try {
      [running.wallDisplay, running.presenterDisplay] = [running.presenterDisplay, running.wallDisplay];
      await this.place(running, running.wall, DECK_WALL_VIEW_TYPE, running.wallDisplay, WINDOWED_WALL);
      if (running.presenter) await this.place(running, running.presenter, DECK_PRESENTER_VIEW_TYPE, running.presenterDisplay, WINDOWED_PRESENTER);
      await this.showPresenter(running);
    } finally {
      running.swapping = false;
    }
  }

  /** The presenter view's clock: the session's length, asked and kept in the deck's front matter (`ritemark-length`). */
  private async setLength(running: Running): Promise<void> {
    const document = running.origin.document;
    const now = lengthMinutesOf(frontMatterValue(document.getText(), 'ritemark-length'));
    const answer = await vscode.window.showInputBox({
      title: 'How long is the session?',
      prompt: 'In minutes. It is kept in the deck, so the clock shows it the next time too.',
      value: now ? String(now) : '',
      placeHolder: '45',
      validateInput: value => (lengthMinutesOf(value) === null ? `A whole number of minutes, from 1 to ${MAX_LENGTH_MINUTES}` : null),
    });
    const minutes = lengthMinutesOf(answer);
    if (minutes === null || running.ended) return;
    const edit = frontMatterEdit(document.getText(), 'ritemark-length', String(minutes));
    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.replace(document.uri, new vscode.Range(document.positionAt(edit.start), document.positionAt(edit.end)), edit.text);
    await vscode.workspace.applyEdit(workspaceEdit);
    await this.showPresenter(running);
  }

  private async receive(running: Running, screen: Screen, raw: unknown): Promise<void> {
    if (isShellPageSignal(raw)) return;
    const request = decodeWallRequest(raw);
    if (!request || running.ended) return;
    switch (request.type) {
      case 'present/ready':
        screen.loads++;
        for (const resolve of screen.loaded.splice(0)) resolve();
        if (screen === running.wall) await this.showWall(running);
        else await this.showPresenter(running);
        return;
      case 'present/stop':
        this.stop();
        return;
      case 'present/presenter':
        await this.setPresenter(!running.presenter);
        return;
      case 'present/swap':
        if (screen === running.presenter) await this.swap(running);
        return;
      case 'present/set-length':
        if (screen === running.presenter) await this.setLength(running);
        return;
      case 'present/blank': {
        const serial = ++running.blankSerial;
        // Q: the page's QR code, only for a deck that is published now (Publish asked again, never an old address).
        // Refused, the windows still get a state, so the ask they keep settles (`settleAsked`).
        if (request.to === 'page' && !(await this.readPage(running))) {
          if (!running.ended && serial === running.blankSerial) await this.showSameSlide(running);
          return;
        }
        // A key or a move that came while Q was asking wins: the code never shows after the slide came back.
        if (running.ended || serial !== running.blankSerial) return;
        running.blank = request.to;
        await this.showSameSlide(running);
        return;
      }
      case 'present/spot':
        // A new spotlight (or none) is never a filled wall.
        running.focus = { spot: request.item, fill: null };
        await this.showSameSlide(running);
        return;
      case 'present/fill':
        running.focus = { ...running.focus, fill: request.item };
        await this.showSameSlide(running);
        return;
      case 'present/timer':
        // Item 9: started, restarted or stopped from the presenter view; not a move, and it stays across moves.
        if (screen !== running.presenter) return;
        running.timer = request.minutes === null ? null : { endsAt: Date.now() + request.minutes * 60_000, minutes: request.minutes };
        await this.showSameSlide(running);
        return;
      case 'present/pointer':
        // Item 12: the presenter view's dot, relayed to the wall as it comes; nothing is kept, and nothing else is sent.
        if (screen !== running.presenter) return;
        await post(running.wall.panel.webview, { type: 'present/pointer', at: request.at } satisfies WallPointer);
        return;
      case 'present/peek': {
        running.session.read(running.origin.document.getText());
        const slide = running.session.slideNumbered(request.number);
        await post(screen.panel.webview, { type: 'present/peeked', number: request.number, title: slide ? presentTitleOf(slide) : null });
        return;
      }
      default: {
        // A move (a button, the row, the grid) brings the slide back too, on the slide it moves to.
        running.blank = null;
        running.blankSerial++;
        // A move clears the spotlight and the filled wall: → and a clicker clear it and go on, in one press.
        running.focus = NO_FOCUS;
        running.session.move(running.origin.document.getText(), moveOf(request));
        // Even a move that goes nowhere (the last slide, a number with no slide) draws the deck as it is now, on the
        // wall and then in the presenter view.
        await this.showWall(running);
      }
    }
  }

  /** The deck's look as its front matter has it now. */
  private async look(running: Running): Promise<{ borderless: boolean; theme: DeckTheme; transition: DeckTransition }> {
    const text = running.origin.document.getText();
    const themePath = parseDeck(text).theme;
    if (running.theme.path !== themePath) {
      // The deck view's own reading of the theme file, from the same project folder, with its logo's address in the
      // wall's window (Sprint 162 PR 4; the presenter view draws the wall's state, and the same address).
      const read = await deckThemeFor(running.origin.document.uri.fsPath, themePathOf(themePath), running.wall.panel.webview);
      const theme = read.text === null ? BUILT_IN_THEME : parseTheme(read.text);
      running.theme = { path: themePath, value: read.logo ? { ...theme, logoUrl: read.logo, ...(read.logoAspect ? { logoAspect: read.logoAspect } : {}) } : theme };
    }
    return { borderless: deckLookOf(text) === 'borderless', theme: running.theme.value, transition: deckTransitionOf(text) };
  }

  /** The pictures as a window's URIs, looked up on disk only when the document or the pictures changed. */
  private assets(running: Running, screen: Screen, paths: string[]): Record<string, string> {
    const version = running.origin.document.version;
    const key = paths.join('\n');
    if (!screen.assets || screen.assets.version !== version || screen.assets.paths !== key) {
      screen.assets = { version, paths: key, value: resolveAssetsIn(path.dirname(running.origin.document.uri.fsPath), screen.panel.webview, paths) };
    }
    return screen.assets.value;
  }

  /** Send the wall its state, then the presenter view its own, whose Now is the wall's slide. */
  private async showWall(running: Running): Promise<void> {
    if (running.ended) return;
    const view = running.session.view();
    const look = await this.look(running);
    const assets = this.assets(running, running.wall, wallPicturePaths(view));
    if (running.ended) return;
    const presenter = { available: this.presenterAvailable(running), on: !!running.presenter };
    // An item's place names an item of the slide the wall has: when this draw brings the slide in another form (an edit
    // since, drawn now by a reload, the presenter view turned on or off), the spotlight and a filled wall go, rather
    // than land on another item (review of #790).
    let state = wallStateOf(view, look, assets, presenter, running.blank, running.page, running.focus, running.timer);
    if (running.wallState && JSON.stringify(running.wallState.slide) !== JSON.stringify(state.slide)) {
      running.focus = NO_FOCUS;
      state = { ...state, spot: null, fill: null };
    }
    running.wallState = state;
    await post(running.wall.panel.webview, state);
    await this.showPresenter(running);
  }

  /**
   * Blanking, the spotlight and a filled wall are not moves: the wall gets the slide it last got, so an edit made since
   * still waits for the next move (a key that brings the slide back never looks like a step), and an item's place names
   * the same item on the wall and in the presenter view's Now.
   */
  private async showSameSlide(running: Running): Promise<void> {
    const onWall = running.wallState;
    if (!onWall) {
      await this.showWall(running);
      return;
    }
    const state: WallState = { ...onWall, presenter: { available: this.presenterAvailable(running), on: !!running.presenter }, blank: shownBlank(running.blank, running.page), page: running.page, spot: running.focus.spot, fill: running.focus.fill, timer: running.timer };
    running.wallState = state;
    await post(running.wall.panel.webview, state);
    await this.showPresenter(running);
  }

  /**
   * Send the presenter view its state, the deck read again, so an edit shows in the next slide and the row at once.
   * Its Now is the slide the wall last got, in the wall's look: the edit reaches both at the next move.
   */
  private async showPresenter(running: Running): Promise<void> {
    const screen = running.presenter;
    if (!screen || running.ended) return;
    // Only the newest state is sent: an older one still reading the theme gives way.
    const serial = ++running.presenterSerial;
    running.session.read(running.origin.document.getText());
    const view = running.session.view();
    // Before the wall has a state, the deck's look as it is now (the wall's first state then sends this view its own).
    const onWall = running.wallState;
    const look = onWall ? { borderless: onWall.borderless, theme: onWall.theme } : await this.look(running);
    if (running.ended || running.presenter !== screen || serial !== running.presenterSerial) return;
    const assets = this.assets(running, screen, presenterPicturePaths(view, onWall?.slide));
    const twoDisplays = running.displays.length > 1;
    await post(screen.panel.webview, presenterStateOf(view, look, assets, {
      wallDisplay: twoDisplays ? running.displays[running.wallDisplay]?.name ?? null : null,
      canSwap: twoDisplays,
      length: lengthMinutesOf(frontMatterValue(running.origin.document.getText(), 'ritemark-length')),
      startedAt: running.startedAt,
      blank: running.blank,
      focus: running.focus,
      clock: running.clock,
      timer: running.timer,
      page: running.page,
    }, onWall?.slide));
  }

  /**
   * The deck's published page, asked again: kept for the wall and the presenter view, and sent to both when it changed
   * (not a move: the wall keeps the slide it last got). A page gone takes its QR code off the wall.
   */
  private async readPage(running: Running): Promise<string | null> {
    let page: string | null = null;
    try {
      page = wallPageAddress(this.pageAddress ? await this.pageAddress(running.origin.document) : null);
    } catch {
      page = null;
    }
    if (running.ended) return null;
    if (page !== running.page) {
      running.page = page;
      if (!page && running.blank === 'page') running.blank = null;
      // Before the wall's first state, that state carries it.
      if (running.wallState) await this.showSameSlide(running);
    }
    return page;
  }

  /**
   * The wall is gone: the presentation ends, the presenter view closes, and the deck view shows the slide the presenter
   * ended on. (The deck is not revealed: a reveal while the wall's window closes would open the deck in that window.)
   */
  private async end(running: Running): Promise<void> {
    if (running.ended) return;
    running.ended = true;
    if (this.running === running) this.running = null;
    for (const subscription of running.subscriptions) subscription.dispose();
    running.presenter?.panel.dispose();
    const index = running.session.endedIndex(running.origin.document.getText());
    await post(running.origin.panel.webview, { type: 'deck/present-ended', index });
  }

  dispose(): void {
    this.stop();
  }
}

function moveOf(request: Extract<WallRequest, { type: 'present/next' | 'present/back' | 'present/first' | 'present/last' | 'present/go' }>): PresentMove {
  switch (request.type) {
    case 'present/next': return { type: 'next' };
    case 'present/back': return { type: 'back' };
    case 'present/first': return { type: 'first' };
    case 'present/last': return { type: 'last' };
    case 'present/go': return { type: 'go', number: request.number };
  }
}

/** Whether the screen's page loads (says it is ready) within `ms`; `cancel` takes the wait back. */
function nextLoad(screen: Screen, ms: number): { loaded: Promise<boolean>; cancel: () => void } {
  let done: () => void = () => {};
  let cancel: () => void = () => {};
  const loaded = new Promise<boolean>(resolve => {
    const timer = setTimeout(() => { remove(); resolve(false); }, ms);
    const remove = () => { const at = screen.loaded.indexOf(done); if (at >= 0) screen.loaded.splice(at, 1); };
    done = () => { clearTimeout(timer); resolve(true); };
    cancel = () => { clearTimeout(timer); remove(); resolve(false); };
    screen.loaded.push(done);
  });
  return { loaded, cancel };
}

/** The shell's commands don't change while Ritemark runs: asked once. */
let shellPlacement: Promise<boolean> | null = null;

/** The notice for a shell without the commands: a dev build says what to run, any other build to update. */
export function presentNeedsShellMessage(env: NodeJS.ProcessEnv = process.env): string {
  return env.VSCODE_DEV ? PRESENT_NEEDS_PATCHES : PRESENT_NEEDS_UPDATE;
}

/** The shell can place the windows: this Ritemark's shell has the commands (patch 018, Sprint 159). */
function hasShellPlacement(): Promise<boolean> {
  // Only an answer is kept: a failed ask (the extension host still starting) is asked again next time.
  shellPlacement ??= askShellPlacement().catch(error => {
    shellPlacement = null;
    throw error;
  });
  return shellPlacement;
}

async function askShellPlacement(): Promise<boolean> {
  // All commands, the private ones too (`getCommands(true)` leaves out those whose name starts with an underscore).
  const commands = await vscode.commands.getCommands(false);
  return commands.includes(PLACE_COMMAND) && commands.includes(DISPLAYS_COMMAND);
}

async function readDisplays(): Promise<PresentDisplay[]> {
  try {
    const displays = await vscode.commands.executeCommand<unknown>(DISPLAYS_COMMAND);
    if (!Array.isArray(displays)) return [];
    return displays
      .filter((display): display is PresentDisplay => !!display && typeof display.name === 'string')
      .map(display => ({ name: display.name, primary: display.primary === true, internal: display.internal === true }));
  } catch {
    return [];
  }
}

/** Wait until a panel of this view type is an editor the window knows (its tab); false after a while or when ended. */
async function panelIsOpen(running: Running, viewType: string): Promise<boolean> {
  const started = Date.now();
  while (!running.ended && Date.now() - started < ACTIVE_WAIT_MS) {
    const open = vscode.window.tabGroups.all.some(group => group.tabs.some(tab => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith(viewType)));
    if (open) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}

function workspaceFolderOf(document: vscode.TextDocument): string | null {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  return folder?.uri.scheme === 'file' ? folder.uri.fsPath : null;
}

/** The deck's name: its file name without `.deck.md`. */
function deckTitle(document: vscode.TextDocument): string {
  return path.basename(document.uri.fsPath).replace(/\.deck\.md$/i, '');
}

type DeckPresentMessage = { type: 'deck/present-ended'; index: number } | { type: 'deck/present-failed'; message: string };

async function post(webview: vscode.Webview, message: WallHostMessage | DeckPresentMessage): Promise<boolean> {
  try {
    return await webview.postMessage(message);
  } catch {
    // The view closed meanwhile.
    return false;
  }
}

function presentHtml(webview: vscode.Webview, extensionUri: vscode.Uri, editorType: 'deck-wall' | 'deck-presenter'): string {
  const nonce = Array.from({ length: 32 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))).join('');
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
  // The first frame's colour: the wall's bands, the presenter view's Ritemark Dark, so neither flashes white.
  const ground = editorType === 'deck-wall' ? '#0E0C24' : '#16132F';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:;">
  <title>Presenting</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; background: ${ground} !important; }
  </style>
</head>
<body>
  <div id="root" data-editor-type="${editorType}"></div>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}
