/**
 * TasksViewProvider — the Tasks side bar (Sprint 130, #119): the daily glance
 * at the project's task board. Add a task, see Your calls first, then Doing,
 * To do, Ideas and Done.
 *
 * The webview is the shared React bundle (`data-editor-type="tasks-panel"`);
 * everything it does goes through `connectBoardSurface`, the same path as the
 * Task board tab, so both always show the same board.
 */

import * as vscode from 'vscode';
import { boardHtml, connectBoardSurface, type BoardSurfaceConnection, type BoardSurfaceContext } from '../taskBoard/boardSurface';

/** A view resolved this soon after activation is the window restoring it, not a click. */
const STARTUP_RESTORE_MS = 10_000;

export class TasksViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.tasksView';
  private connection: BoardSurfaceConnection | null = null;
  private readonly createdAt = Date.now();

  /**
   * `showBoard` opens the Task board tab and focuses it. Clicking Tasks shows
   * the board too, because that is what people expected the click to do
   * (Jarmo, 2026-10-14). A Tasks side bar the window restores at startup
   * leaves the restored editors in front.
   */
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: BoardSurfaceContext,
    private readonly showBoard?: () => Promise<void>,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    if (this.showBoard && Date.now() - this.createdAt > STARTUP_RESTORE_MS) void this.showBoard();
    view.onDidChangeVisibility(() => {
      if (view.visible && this.showBoard) void this.showBoard();
    });
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    view.webview.html = boardHtml(view.webview, this.extensionUri, 'tasks-panel', 'Tasks');
    this.connection?.dispose();
    const connection = connectBoardSurface(view.webview, 'sidebar', this.context);
    this.connection = connection;
    view.onDidDispose(() => {
      connection.dispose();
      if (this.connection === connection) this.connection = null;
    });
  }
}
