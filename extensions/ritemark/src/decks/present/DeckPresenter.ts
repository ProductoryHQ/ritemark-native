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
 */
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { isShellPageSignal } from '../../shellPageSignals';
import { resolveDocumentResourceRoots } from '../../webviewResourceRoots';
import { parseDeck } from '../deckFormat';
import { BUILT_IN_THEME, parseTheme, type DeckTheme } from '../deckTheme';
import { readProjectTheme, resolveAssetsIn } from '../deckPages';
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
  ended: boolean;
  /** The wall answered a focus check: its window has the focus. */
  focused: () => void;
}

/** VS Code's commands for a window of its own (`workbench.action.*`), as an older shell has them too. */
const MOVE_TO_NEW_WINDOW = 'workbench.action.moveEditorToNewWindow';
const COMPACT_WINDOW = 'workbench.action.enableCompactAuxiliaryWindow';
const TOGGLE_FULL_SCREEN = 'workbench.action.toggleFullScreen';
/** How long the host waits for the wall's window to take the focus after the move, and how often it asks. */
const FOCUS_WAIT_MS = 3000;
const FOCUS_CHECK_MS = 150;

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
        retainContextWhenHidden: false,
        localResourceRoots: resolveDocumentResourceRoots({
          mediaPath: vscode.Uri.joinPath(this.extensionUri, 'media').fsPath,
          documentPath: origin.document.uri.fsPath,
          workspaceFolderPath: workspaceFolderOf(origin.document),
          homeDir: os.homedir(),
        }).map(root => vscode.Uri.file(root)),
      },
    );
    wall.webview.html = wallHtml(wall.webview, this.extensionUri);
    const running: Running = { session, origin, wall, subscriptions: [], theme: { path: null, value: BUILT_IN_THEME }, ended: false, focused: () => {} };
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
        running.focused();
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
      const root = workspaceFolderOf(running.origin.document) ?? path.dirname(running.origin.document.uri.fsPath);
      const themeText = themePath ? await readProjectTheme(root, themePath) : null;
      running.theme = { path: themePath, value: themeText === null ? BUILT_IN_THEME : parseTheme(themeText) };
    }
    const assets = resolveAssetsIn(path.dirname(running.origin.document.uri.fsPath), running.wall.webview, wallPicturePaths(view));
    if (running.ended) return;
    await post(running.wall.webview, wallStateOf(view, { borderless: deckLookOf(text) === 'borderless', theme: running.theme.value }, assets));
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
 * The wall, now the active editor of the main window, goes into a window of its own, then that window is made compact
 * and full screen (in a dev build's windowed mode it stays a compact window).
 *
 * VS Code's compact and full-screen commands act on the window that has the focus, and when no window has it they act
 * on the main window. A new window takes the focus a moment after the move, and making it compact moves the focus
 * inside it. So before each of the two commands the host asks the wall (now in its own window) until it says its
 * window has the focus. Without that answer (Ritemark in the background) nothing more is done: the main window is never
 * made full screen by mistake, and the wall stays a window of its own.
 */
async function placeWall(running: Running): Promise<void> {
  await vscode.commands.executeCommand(MOVE_TO_NEW_WINDOW);
  if (!(await wallHasFocus(running))) return;
  await vscode.commands.executeCommand(COMPACT_WINDOW);
  if (presentWindowed() || !(await wallHasFocus(running))) return;
  await vscode.commands.executeCommand(TOGGLE_FULL_SCREEN);
}

/** Ask the wall until it says its window has the focus: true, or false after a while or when the wall is gone. */
function wallHasFocus(running: Running): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const started = Date.now();
    const finish = (value: boolean) => { clearInterval(timer); running.focused = () => {}; resolve(value); };
    const ask = () => {
      if (running.ended || Date.now() - started > FOCUS_WAIT_MS) {
        finish(false);
        return;
      }
      // The wall's window can have the focus with nothing inside it focused: revealing the panel puts it in the wall.
      if (Date.now() - started >= FOCUS_CHECK_MS) running.wall.reveal(running.wall.viewColumn, false);
      void post(running.wall.webview, { type: 'present/focus-check' });
    };
    const timer = setInterval(ask, FOCUS_CHECK_MS);
    running.focused = () => finish(true);
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
