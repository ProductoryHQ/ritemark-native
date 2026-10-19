/**
 * TasksViewProvider — the Tasks side bar (Sprint 130, #119): the daily glance
 * at the project's task board. Since Sprint 134 (R17) it lists the tasks in
 * the order work moves (Ideas, To do, Doing, Done), with the tasks that wait
 * for the person first in their stage, and runs the project head's two rows,
 * New task and Search (`runHeadRow`).
 *
 * The webview is the shared React bundle (`data-editor-type="tasks-panel"`);
 * everything it does goes through `connectBoardSurface`, the same path as the
 * Task board tab, so both always show the same board.
 */

import * as vscode from 'vscode';
import { boardHtml, connectBoardSurface, type BoardSurfaceConnection, type BoardSurfaceContext } from '../taskBoard/boardSurface';
import type { BoardHeadRow } from '../taskBoard/protocol';

/** A view resolved this soon after activation is the window restoring it, not a click. */
const STARTUP_RESTORE_MS = 10_000;
/** A head row that reveals the hidden view leaves the board where it is for this long. */
const HEAD_ROW_REVEAL_MS = 2_000;

export class TasksViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.tasksView';
  private connection: BoardSurfaceConnection | null = null;
  private view: vscode.WebviewView | null = null;
  private readonly createdAt = Date.now();
  /** A head row that ran before the view was made; the new connection takes it. */
  private pendingRow: BoardHeadRow | null = null;
  /** Until then, the view becoming visible is a head row's doing, not a click on Tasks. */
  private headRowUntil = 0;

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
    this.view = view;
    if (this.showBoard && Date.now() - this.createdAt > STARTUP_RESTORE_MS && !this.headRowRevealing()) void this.showBoard();
    view.onDidChangeVisibility(() => {
      // A head row keeps the keyboard in the side bar, so it does not bring the board forward.
      if (view.visible && this.showBoard && !this.headRowRevealing()) void this.showBoard();
    });
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    view.webview.html = boardHtml(view.webview, this.extensionUri, 'tasks-panel', 'Tasks');
    this.connection?.dispose();
    const connection = connectBoardSurface(view.webview, 'sidebar', this.context);
    this.connection = connection;
    if (this.pendingRow) {
      connection.headRow(this.pendingRow);
      this.pendingRow = null;
    }
    view.onDidDispose(() => {
      connection.dispose();
      if (this.connection === connection) this.connection = null;
      if (this.view === view) this.view = null;
    });
  }

  /**
   * The project head's rows on Tasks (Sprint 134, R16–R17): show the Tasks
   * view with the keyboard in it, then New task shows the add field and Search
   * the search field. With `row` null (no board: no folder, or the flag off)
   * the view only shows, and says why there is no board, as it does today.
   */
  async runHeadRow(row: BoardHeadRow | null): Promise<void> {
    if (!this.view?.visible) this.headRowUntil = Date.now() + HEAD_ROW_REVEAL_MS;
    await vscode.commands.executeCommand(`${TasksViewProvider.viewType}.focus`);
    if (!row) return;
    // Posted after the focus, so the field takes the keyboard once the view has it.
    if (this.connection) this.connection.headRow(row);
    else this.pendingRow = row;
  }

  private headRowRevealing(): boolean {
    return Date.now() < this.headRowUntil;
  }
}
