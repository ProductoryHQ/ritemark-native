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

export class TasksViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.tasksView';
  private connection: BoardSurfaceConnection | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: BoardSurfaceContext,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
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
