/**
 * Presenting a deck (Sprint 159, PR 5; experience 17 frame 2): the wall.
 *
 * Present on a deck's bar (or ⌘↩, ⇧⌘↩ from the start) asks the host here. The wall is a webview panel,
 * `ritemark.deckWall`, drawn with the deck view's own `SlideCanvas` from the shared `webview.js`. It opens in the main
 * window's active group and moves at once into a window of its own, which is made compact (no title row, no tab row)
 * and then full screen: VS Code's own three commands, as patch 010's browser opens a compact auxiliary window. The main
 * window, with its AI column, notices and toasts, stays behind it.
 *
 * The host is the only source of state. The session (`presentSession.ts`) holds the current slide by its key and reads
 * the deck's open document again at every move, so an edit made in the editor reaches the wall at the next move. The
 * wall's state is built field by field (`presentProtocol.ts`) and never carries the speaker notes.
 *
 * Stopping (Esc on the wall, or the wall's window closed) returns the deck view to the slide the presenter ended on.
 *
 * `RITEMARK_PRESENT_WINDOWED=1` keeps the wall in its compact window instead of full screen, only in a dev build
 * (`VSCODE_DEV`), so a hidden test run never takes over the screen.
 *
 * In Ritemark's frame a window moved this way keeps its title row ("<deck> — <project>") and the desk's edge, and the
 * room would read the project's name on the projector (the Experience lead, 16 November). So this path runs only in a
 * dev build; elsewhere Present answers with a notice that it needs a newer Ritemark (words only, nothing opens), until
 * the shell places the wall itself (PR 6).
 */
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { isShellPageSignal } from '../../shellPageSignals';
import { resolveDocumentResourceRoots } from '../../webviewResourceRoots';
import { parseDeck } from '../deckFormat';
import { BUILT_IN_THEME, parseTheme, type DeckTheme } from '../deckTheme';
import { readTheme, resolveAssetsIn } from '../deckPages';
import { DECK_WALL_VIEW_TYPE, decodeWallRequest, wallPicturePaths, wallStateOf, type DeckPresentRequest, type WallHostMessage, type WallRequest } from './presentProtocol';
import { deckLookOf, PresentSession, PresentStartError, presentTitleOf, type PresentMove } from './presentSession';

/** Where the presentation was started from: the deck's document, and its view to return to. */
interface DeckOrigin {
  document: vscode.TextDocument;
  panel: vscode.WebviewPanel;
}

/** One presentation: its session, the wall's panel and the deck view it returns to. */
interface Running {
  session: PresentSession;
  origin: DeckOrigin;
  wall: vscode.WebviewPanel;
  subscriptions: vscode.Disposable[];
  /** The theme, read once per theme path (a move reads the front matter again). */
  theme: { path: string | null; value: DeckTheme };
  /** The pictures' URIs, for the document version they were resolved at (a move that changed nothing reuses them). */
  assets: { version: number; paths: string; value: Record<string, string> } | null;
  ended: boolean;
  /** The wall answered a focus check: its window has the focus (and whether it is full screen already). */
  focused: (fullScreen: boolean) => void;
}

/** VS Code's commands for a window of its own (`workbench.action.*`), as an older shell has them too. */
const MOVE_TO_NEW_WINDOW = 'workbench.action.moveEditorToNewWindow';
const COMPACT_WINDOW = 'workbench.action.enableCompactAuxiliaryWindow';
const TOGGLE_FULL_SCREEN = 'workbench.action.toggleFullScreen';
const LOCK_GROUP = 'workbench.action.lockEditorGroup';
/**
 * How long the host waits for the wall's window to take the focus after the move (the wall loads the bundle again in
 * its new window), and how often it asks; how long it waits for the new panel to be the active editor before the move.
 */
const FOCUS_WAIT_MS = 10_000;
const FOCUS_CHECK_MS = 150;
const ACTIVE_WAIT_MS = 3000;

/**
 * Present's answer when this Ritemark can't place the wall (outside a dev build, until the shell places it): a notice in
 * the deck's bar, words only, when Present, ⌘↩ or ⇧⌘↩ is pressed (the Experience lead, 16 November). The button stays
 * enabled, and nothing opens.
 */
export const PRESENT_NEEDS_UPDATE = 'Presenting needs a newer Ritemark. Update it, then present again.';

/** VS Code's own window commands may place the wall only in a dev build (their window shows the project's name). */
export function presentFallbackAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!env.VSCODE_DEV;
}

/** The dev-only windowed mode: honoured only in a dev build. */
export function presentWindowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.RITEMARK_PRESENT_WINDOWED === '1' && !!env.VSCODE_DEV;
}

export class DeckPresenter implements vscode.Disposable {
  private running: Running | null = null;

  constructor(private readonly extensionUri: vscode.Uri) {}

  /** Present on the wall, from the deck view's current slide or from the start. A second Present ends the first. */
  async start(origin: DeckOrigin, request: DeckPresentRequest): Promise<void> {
    this.stop();
    // First, before the deck is read or anything opens: this Ritemark can't place the wall.
    if (!presentFallbackAllowed()) {
      await post(origin.panel.webview, { type: 'deck/present-failed', message: PRESENT_NEEDS_UPDATE });
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
    const wall = vscode.window.createWebviewPanel(
      DECK_WALL_VIEW_TYPE,
      deckTitle(origin.document),
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      {
        enableScripts: true,
        // Kept while hidden: the go-to box and the grid survive anything shown over the wall for a moment.
        retainContextWhenHidden: true,
        localResourceRoots: resolveDocumentResourceRoots({
          mediaPath: vscode.Uri.joinPath(this.extensionUri, 'media').fsPath,
          documentPath: origin.document.uri.fsPath,
          workspaceFolderPath: workspaceFolderOf(origin.document),
          homeDir: os.homedir(),
        }).map(root => vscode.Uri.file(root)),
      },
    );
    wall.webview.html = wallHtml(wall.webview, this.extensionUri);
    const running: Running = { session, origin, wall, subscriptions: [], theme: { path: null, value: BUILT_IN_THEME }, assets: null, ended: false, focused: () => {} };
    this.running = running;
    running.subscriptions.push(
      wall.webview.onDidReceiveMessage(message => { void this.receive(running, message); }),
      wall.onDidDispose(() => { void this.end(running); }),
      // The deck's view closed: there is nothing to return to, and the wall goes too.
      origin.panel.onDidDispose(() => { if (this.running === running) wall.dispose(); }),
    );
    await placeWall(running);
  }

  /** Stop the presentation: the wall closes and the deck view returns to the slide the presenter ended on. */
  stop(): void {
    this.running?.wall.dispose();
  }

  private async receive(running: Running, raw: unknown): Promise<void> {
    if (isShellPageSignal(raw)) return;
    const request = decodeWallRequest(raw);
    if (!request || running.ended) return;
    switch (request.type) {
      case 'present/ready':
        await this.show(running);
        return;
      case 'present/focus':
        running.focused(request.fullScreen);
        return;
      case 'present/stop':
        running.wall.dispose();
        return;
      case 'present/peek': {
        running.session.read(running.origin.document.getText());
        const slide = running.session.slideNumbered(request.number);
        await post(running.wall.webview, { type: 'present/peeked', number: request.number, title: slide ? presentTitleOf(slide) : null });
        return;
      }
      default: {
        running.session.move(running.origin.document.getText(), moveOf(request));
        // Even a move that goes nowhere (the last slide, a number with no slide) draws the deck as it is now.
        await this.show(running);
      }
    }
  }

  /** Send the wall its state, from the deck's document as it is now. */
  private async show(running: Running): Promise<void> {
    const text = running.origin.document.getText();
    const view = running.session.view();
    const themePath = parseDeck(text).theme;
    if (running.theme.path !== themePath) {
      // The deck view's own reading of the theme file, from the same project folder.
      const themeText = themePath ? await readTheme(running.origin.document, themePath) : null;
      running.theme = { path: themePath, value: themeText === null ? BUILT_IN_THEME : parseTheme(themeText) };
    }
    // The pictures are looked up on disk only when the document or the slides shown changed since the last move.
    const paths = wallPicturePaths(view);
    const version = running.origin.document.version;
    if (!running.assets || running.assets.version !== version || running.assets.paths !== paths.join('\n')) {
      running.assets = { version, paths: paths.join('\n'), value: resolveAssetsIn(path.dirname(running.origin.document.uri.fsPath), running.wall.webview, paths) };
    }
    if (running.ended) return;
    await post(running.wall.webview, wallStateOf(view, { borderless: deckLookOf(text) === 'borderless', theme: running.theme.value }, running.assets.value));
  }

  /**
   * The wall is gone, and its window with it: the deck view shows the slide the presenter ended on. (The deck is not
   * revealed: a reveal while the wall's window closes would open the deck in that window.)
   */
  private async end(running: Running): Promise<void> {
    if (running.ended) return;
    running.ended = true;
    if (this.running === running) this.running = null;
    for (const subscription of running.subscriptions) subscription.dispose();
    const index = running.session.endedIndex(running.origin.document.getText());
    await post(running.origin.panel.webview, { type: 'deck/present-ended', index });
  }

  dispose(): void {
    this.stop();
  }
}

function moveOf(request: Exclude<WallRequest, { type: 'present/ready' | 'present/focus' | 'present/stop' | 'present/peek' }>): PresentMove {
  switch (request.type) {
    case 'present/next': return { type: 'next' };
    case 'present/back': return { type: 'back' };
    case 'present/first': return { type: 'first' };
    case 'present/last': return { type: 'last' };
    case 'present/go': return { type: 'go', number: request.number };
  }
}

/**
 * The wall goes into a window of its own, then that window is made compact, its group locked and the window made full
 * screen (in a dev build's windowed mode it stays a compact window).
 *
 *  - The panel is moved only once the main window reports it as the active editor: the move takes whatever editor is
 *    active, and it must never be the deck.
 *  - VS Code's compact, lock and full-screen commands act on the window that has the focus, and on the main window when
 *    none has it. A new window takes the focus a moment after the move, so before each step the host asks the wall
 *    (now in its own window) until it says its window has the focus. Without that answer nothing more is done: the
 *    main window is never made full screen by mistake, and the wall stays a window of its own.
 *  - The locked group keeps anything opened during the talk (a link, a file the AI opens) off the wall: it opens in
 *    the main window instead.
 *  - Full screen is a toggle, so it is sent only when the wall says its window is not full screen already.
 */
async function placeWall(running: Running): Promise<void> {
  if (!(await wallIsActive(running))) return;
  await vscode.commands.executeCommand(MOVE_TO_NEW_WINDOW);
  if (running.ended || !(await wallHasFocus(running))) return;
  await vscode.commands.executeCommand(COMPACT_WINDOW);
  await vscode.commands.executeCommand(LOCK_GROUP);
  if (presentWindowed() || running.ended) return;
  const focus = await wallHasFocus(running);
  if (focus && !focus.fullScreen) await vscode.commands.executeCommand(TOGGLE_FULL_SCREEN);
}

/** Wait until the main window reports the wall as the active editor; false after a while or when the wall is gone. */
async function wallIsActive(running: Running): Promise<boolean> {
  const started = Date.now();
  while (!running.ended && Date.now() - started < ACTIVE_WAIT_MS) {
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    if (input instanceof vscode.TabInputWebview && input.viewType.endsWith(DECK_WALL_VIEW_TYPE)) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}

/**
 * Ask the wall until it says its window has the focus: its answer (whether the window is full screen already), or
 * null after a while or when the wall is gone.
 */
function wallHasFocus(running: Running): Promise<{ fullScreen: boolean } | null> {
  return new Promise(resolve => {
    const started = Date.now();
    const finish = (value: { fullScreen: boolean } | null) => { clearInterval(timer); running.focused = () => {}; resolve(value); };
    const ask = () => {
      if (running.ended || Date.now() - started > FOCUS_WAIT_MS) {
        finish(null);
        return;
      }
      // The wall's window can have the focus with nothing inside it focused: revealing the panel puts it in the wall.
      if (Date.now() - started >= FOCUS_CHECK_MS) running.wall.reveal(running.wall.viewColumn, false);
      void post(running.wall.webview, { type: 'present/focus-check' });
    };
    const timer = setInterval(ask, FOCUS_CHECK_MS);
    running.focused = fullScreen => finish({ fullScreen });
    ask();
  });
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

function wallHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = Array.from({ length: 32 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))).join('');
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:;">
  <title>Presenting</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    /* The bands' colour from the first frame, so the wall never flashes white before it draws */
    html, body { height: 100%; overflow: hidden; background: #0E0C24 !important; }
  </style>
</head>
<body>
  <div id="root" data-editor-type="deck-wall"></div>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}
