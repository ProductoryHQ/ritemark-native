/**
 * TaskBoardPanel — the Task board tab in the editor area (Sprint 130, #119):
 * the planning surface with Your calls, Board, Ideas and Log.
 *
 * One tab per window: opening the board again reveals it. It comes back after
 * a restart through a serializer, on the view the user had open (the webview
 * keeps that in its own state).
 */

import * as vscode from 'vscode';
import { boardHtml, connectBoardSurface, type BoardSurfaceConnection, type BoardSurfaceContext } from './boardSurface';
import type { BoardTab } from './protocol';

export class TaskBoardPanel {
  public static readonly viewType = 'ritemark.taskBoard';
  private static current: TaskBoardPanel | undefined;

  /** Open the board, or bring it forward; show a view and/or a card. */
  static show(extensionUri: vscode.Uri, context: BoardSurfaceContext, target: { cardId?: string; tab?: BoardTab } = {}): void {
    if (TaskBoardPanel.current) {
      TaskBoardPanel.current.panel.reveal(undefined, false);
    } else {
      const panel = vscode.window.createWebviewPanel(
        TaskBoardPanel.viewType,
        'Task board',
        { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')] },
      );
      TaskBoardPanel.current = new TaskBoardPanel(panel, extensionUri, context);
    }
    if (target.cardId || target.tab) TaskBoardPanel.current.connection.focus(target);
  }

  /** Restore the tab VS Code kept from the last session. */
  static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: BoardSurfaceContext): void {
    TaskBoardPanel.current?.panel.dispose();
    TaskBoardPanel.current = new TaskBoardPanel(panel, extensionUri, context);
  }

  private readonly connection: BoardSurfaceConnection;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: BoardSurfaceContext,
  ) {
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')] };
    // A tab icon is an image, so it cannot follow currentColor: one per theme.
    panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'media', 'tasks-tab-light.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'media', 'tasks-tab-dark.svg'),
    };
    panel.webview.html = boardHtml(panel.webview, extensionUri, 'task-board', 'Task board');
    this.connection = connectBoardSurface(panel.webview, 'panel', context);
    panel.onDidDispose(() => {
      this.connection.dispose();
      if (TaskBoardPanel.current === this) TaskBoardPanel.current = undefined;
    });
  }
}
