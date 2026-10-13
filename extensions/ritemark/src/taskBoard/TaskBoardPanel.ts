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

  /** Open the board, or bring it forward; show a view. */
  static async show(extensionUri: vscode.Uri, context: BoardSurfaceContext, target: { tab?: BoardTab } = {}): Promise<void> {
    if (TaskBoardPanel.current) {
      TaskBoardPanel.current.panel.reveal(undefined, false);
      await closeLeftoverBoardTabs();
    } else {
      // A board tab kept from the last session is revived only when it is
      // shown (VS Code resolves restored webviews lazily), so until then this
      // window does not know it has one. Open the board in that tab's place
      // instead of beside it (two Task board tabs, 2026-10-13).
      const restored = boardTabs();
      const viewColumn = restored[0]?.group.viewColumn ?? vscode.ViewColumn.Active;
      if (restored.length) await vscode.window.tabGroups.close(restored, true);
      const panel = vscode.window.createWebviewPanel(
        TaskBoardPanel.viewType,
        'Task board',
        { viewColumn, preserveFocus: false },
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')] },
      );
      TaskBoardPanel.current = new TaskBoardPanel(panel, extensionUri, context);
    }
    if (target.tab) TaskBoardPanel.current.connection.focus(target);
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

/** The Task board tabs in the window, restored ones not yet revived included. */
function boardTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith(TaskBoardPanel.viewType));
}

/**
 * Close Task board tabs other than the one in front: twins restored from a
 * session that opened the board twice, never revived since. Waits for the
 * reveal to reach the tab model first.
 */
async function closeLeftoverBoardTabs(): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      listener.dispose();
      resolve();
    }, 300);
    const listener = vscode.window.tabGroups.onDidChangeTabs(() => {
      clearTimeout(timer);
      listener.dispose();
      resolve();
    });
  });
  const front = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (!front || !boardTabs().includes(front)) return;
  const leftovers = boardTabs().filter((tab) => !(tab.isActive && tab.group.isActive));
  if (leftovers.length) await vscode.window.tabGroups.close(leftovers, true);
}
