/**
 * taskBoardHost — composes the task board into the extension (Sprint 130, #119).
 *
 * One board per window, for the first workspace folder (the app's project). It
 * wires the card store to the folder (with a watcher for outside edits, the
 * system trash for deletes and the open card pages), the controller to the
 * board surfaces, the card pages, the activity bar badge, the two commands, and
 * the agents' availability.
 *
 * Without a folder, or with `ritemark.features.task-board` off, the surfaces
 * still load and say why there is no board; nothing is written to disk.
 */

import * as path from 'path';
import { promises as fsp } from 'fs';
import * as vscode from 'vscode';
import type { AgentId } from '../agent/types';
import { isEnabled } from '../features/featureGate';
import type { RuntimeAvailabilities, RuntimeAvailability } from '../runtime/availability';
import { TasksViewProvider } from '../views/TasksViewProvider';
import type { AgentTaskListener } from '../views/UnifiedViewProvider';
import { BoardController } from './BoardController';
import { CardHandoffLedger, type CardTaskSidebar } from './CardHandoffLedger';
import { CardTaskStore, cardTaskStoreDir } from './CardTaskStore';
import { BoardStore, nodeBoardStoreFileSystem } from './BoardStore';
import { TaskBoardPanel } from './TaskBoardPanel';
import { CardPages, workspaceCardDocuments } from './cardPages';
import { setBoardToolController } from '../runtime/ritemarkTools';
import type { OneShotSettings } from '../runtime/oneShotTurn';
import { createRuntime } from '../runtime/runtimeFactory';
import { IdeaReviewer } from './ideaReview';
import type { BoardSnapshot } from './protocol';
import { BOARD_AGENTS, WIP_LIMIT_DEFAULT } from './protocol';
import { CARD_FOLDER } from './cardTypes';
import type { BoardHostActions, BoardSurfaceContext } from './boardSurface';

export interface TaskBoardHostDependencies {
  context: vscode.ExtensionContext;
  runtimeAvailability: (runtimeId: AgentId) => Promise<RuntimeAvailability>;
  /** The AI sidebar's side of Give to agent (UnifiedViewProvider). */
  cardSidebar: CardTaskSidebar;
  /** Hear turn events next to the comment tasks (G1). */
  attachTaskListener: (listener: AgentTaskListener) => void;
  /** The folder, model and keys a one-shot call (idea review) uses for an agent. */
  oneShotSettings: (runtimeId: AgentId) => Promise<OneShotSettings>;
}

export interface TaskBoardHost {
  controller: BoardController | null;
  store: BoardStore | null;
  /** Cards opened as pages in the Ritemark editor; null without a board. */
  cardPages: CardPages | null;
}

const RECOVER_COMMANDS: Record<string, string> = {
  'sign-in-claude': 'ritemark.claudeLogin',
  'sign-in-codex': 'ritemark.codexLogin',
  settings: 'ritemark.aiSettings',
  'open-folder': 'workbench.action.files.openFolder',
};

function insideFolder(folder: string, candidate: string): string | null {
  const relative = path.relative(folder, path.resolve(folder, candidate));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return relative.split(path.sep).join('/');
}

export function registerTaskBoard(deps: TaskBoardHostDependencies): TaskBoardHost {
  const { context } = deps;
  const extensionUri = context.extensionUri;
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.scheme === 'file' ? vscode.workspace.workspaceFolders[0] : undefined;
  const enabled = isEnabled('task-board');

  // Agents' availability: cached for the buttons, refreshed when a board
  // surface loads, and checked for real right before agent work starts.
  const runtimes = Object.fromEntries(
    BOARD_AGENTS.map((id) => [id, { state: 'checking', usable: false, detail: null } satisfies RuntimeAvailability]),
  ) as RuntimeAvailabilities;
  let controller: BoardController | null = null;
  const checkRuntime = async (runtimeId: AgentId): Promise<RuntimeAvailability> => {
    const availability = await deps.runtimeAvailability(runtimeId).catch(
      (error: unknown): RuntimeAvailability => ({ state: 'error', usable: false, detail: error instanceof Error ? error.message : String(error) }),
    );
    runtimes[runtimeId] = availability;
    return availability;
  };
  let refreshing: Promise<void> | null = null;
  const refreshRuntimes = () => {
    refreshing ??= Promise.all(BOARD_AGENTS.map(checkRuntime)).then(() => {
      refreshing = null;
      controller?.scheduleRefresh();
    });
  };

  // Badge on the Tasks icon: a hidden tree view carries it from activation,
  // before the side bar has ever been opened (Phase 0, P6).
  const badgeView = vscode.window.createTreeView('ritemark.tasksBadge', {
    treeDataProvider: { getChildren: () => [], getTreeItem: (item: vscode.TreeItem) => item },
  });
  context.subscriptions.push(badgeView);
  const setBadge = (count: number) => {
    badgeView.badge = count > 0 ? { value: count, tooltip: count === 1 ? '1 task needs you' : `${count} tasks need you` } : undefined;
  };

  let store: BoardStore | null = null;
  if (folder && enabled) {
    const root = folder.uri.fsPath;
    store = new BoardStore(root, {
      fileSystem: {
        ...nodeBoardStoreFileSystem,
        async trash(file) {
          await vscode.workspace.fs.delete(vscode.Uri.file(file), { useTrash: true });
        },
        // A workspace edit, so a card page open on the file moves with it.
        async move(from, to) {
          const edit = new vscode.WorkspaceEdit();
          edit.renameFile(vscode.Uri.file(from), vscode.Uri.file(to), { overwrite: false });
          if (!(await vscode.workspace.applyEdit(edit))) throw new Error('the rename was refused');
        },
      },
      // A card open as a page is read and written through its document.
      documents: workspaceCardDocuments(),
    });
    const ledger = new CardHandoffLedger({
      store: new CardTaskStore(cardTaskStoreDir(context.globalStorageUri.fsPath, root)),
      board: store,
      sidebar: deps.cardSidebar,
      folderPath: root,
      // Every runtime gets the board tools whenever the board exists (W5), so
      // a card's prompt can name the card.
      hasBoardTools: () => true,
    });
    controller = new BoardController({
      store,
      ledger,
      folderName: folder.name,
      settings: {
        get: <T>(key: string) => context.workspaceState.get<T>(key),
        update: (key, value) => Promise.resolve(context.workspaceState.update(key, value)),
      },
      runtimes: () => runtimes,
      checkRuntime,
      enabled: () => true,
      fileExists: async (relative) => {
        const inside = insideFolder(root, relative);
        if (!inside) return false;
        return fsp.stat(path.join(root, inside)).then(() => true, () => false);
      },
      setBadge,
      // Review with {Agent} (W6): a one-shot runtime with the AI sidebar's
      // model and keys for that agent; it creates no conversation.
      reviewer: new IdeaReviewer({
        createRuntime: (runtimeId) => createRuntime(runtimeId),
        settings: (runtimeId) => deps.oneShotSettings(runtimeId),
      }),
    });
    const boardController = controller;
    context.subscriptions.push({ dispose: () => boardController.dispose() });
    // The agents' board tools (W5) act on this board.
    setBoardToolController(() => boardController);
    context.subscriptions.push({ dispose: () => setBoardToolController(() => null) });
    deps.attachTaskListener(ledger);
    // Work a quit or crash left in flight becomes Interrupted (with Retry);
    // records of cards that are gone are dropped.
    void store
      .list()
      .then((entries) => ledger.recover(new Set(entries.flatMap((entry) => (entry.kind === 'card' ? [entry.card.id] : [])))))
      .then(() => boardController.scheduleRefresh())
      .catch((error) => console.warn('[taskBoard] recovery failed', error));

    // Edits from git, sync tools, other editors and agents' own file tools.
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, `${CARD_FOLDER}/*.md`));
    const changed = (uri: vscode.Uri) => {
      void store?.invalidate(path.basename(uri.fsPath)).catch((error) => console.warn('[taskBoard] invalidate failed', error));
    };
    watcher.onDidChange(changed);
    watcher.onDidCreate(changed);
    watcher.onDidDelete(changed);
    context.subscriptions.push(watcher);
    // A file a card names can come and go (S9): the board re-checks named
    // files when a project file is created or deleted, at most every 400 ms.
    const projectFiles = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, '**/*'), false, true, false);
    let recheck: ReturnType<typeof setTimeout> | null = null;
    const filesChanged = () => {
      recheck ??= setTimeout(() => {
        recheck = null;
        boardController.scheduleRefresh();
      }, 400);
    };
    projectFiles.onDidCreate(filesChanged);
    projectFiles.onDidDelete(filesChanged);
    context.subscriptions.push(projectFiles, { dispose: () => recheck && clearTimeout(recheck) });
    // The badge is right from the start, not only once a surface opens.
    void boardController.refresh().catch((error) => console.warn('[taskBoard] first refresh failed', error));
  }

  const emptySnapshot = (): BoardSnapshot => ({
    folder: folder ? folder.name : null,
    enabled,
    cards: [],
    archived: [],
    unreadable: [],
    calls: [],
    attention: { count: 0, oldestSince: null, blocked: 0 },
    doing: { count: 0, limit: WIP_LIMIT_DEFAULT },
    runtimes: [],
    defaultRuntime: 'claude-code',
  });

  let cardPages: CardPages | null = null;
  const actions: BoardHostActions = {
    openBoard: async (target) => TaskBoardPanel.show(extensionUri, surfaceContext, target),
    openCard: async (target) => {
      await cardPages?.open(target);
    },
    openFile: async (relative) => {
      if (!folder) return;
      const inside = insideFolder(folder.uri.fsPath, relative);
      if (!inside) {
        void vscode.window.showWarningMessage(`"${relative}" is not inside this project.`);
        return;
      }
      const uri = vscode.Uri.file(path.join(folder.uri.fsPath, inside));
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        void vscode.window.showWarningMessage(`${inside} is no longer in the project.`);
        return;
      }
      await vscode.commands.executeCommand('vscode.open', uri, { preview: false });
    },
    addFiles: async (cardId) => {
      if (!folder || !controller || !store) return;
      const card = await store.get(cardId);
      if (!card) return;
      const picked = await vscode.window.showOpenDialog({
        defaultUri: folder.uri,
        canSelectMany: true,
        canSelectFolders: false,
        openLabel: 'Add to card',
        title: `Files for “${card.title}”`,
      });
      if (!picked?.length) return;
      const inside: string[] = [];
      const outside: string[] = [];
      for (const uri of picked) {
        const relative = insideFolder(folder.uri.fsPath, uri.fsPath);
        if (relative) inside.push(relative);
        else outside.push(path.basename(uri.fsPath));
      }
      if (outside.length) {
        void vscode.window.showWarningMessage(
          `${outside.join(', ')} ${outside.length === 1 ? 'is' : 'are'} outside this project, so the card cannot name ${outside.length === 1 ? 'it' : 'them'}.`,
        );
      }
      if (inside.length) {
        const answer = await controller.update(cardId, { files: [...card.files, ...inside] });
        if (!answer.ok) void vscode.window.showWarningMessage(answer.message);
      }
    },
    recover: async (action) => {
      const command = RECOVER_COMMANDS[action];
      if (command) await vscode.commands.executeCommand(command);
    },
  };

  const surfaceContext: BoardSurfaceContext = {
    controller,
    emptySnapshot,
    actions,
    onReady: refreshRuntimes,
  };
  if (store) {
    cardPages = new CardPages(store, () => surfaceContext);
    surfaceContext.activePage = cardPages.activePage;
    context.subscriptions.push(cardPages);
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TasksViewProvider.viewType, new TasksViewProvider(extensionUri, surfaceContext), {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerWebviewPanelSerializer(TaskBoardPanel.viewType, {
      async deserializeWebviewPanel(panel) {
        TaskBoardPanel.revive(panel, extensionUri, surfaceContext);
      },
    }),
    // With a card id, the card's page opens instead of the board.
    vscode.commands.registerCommand('ritemark.openTaskBoard', async (cardId?: unknown) => {
      if (typeof cardId === 'string' && cardPages) await cardPages.open({ cardId });
      else await TaskBoardPanel.show(extensionUri, surfaceContext);
    }),
    vscode.commands.registerCommand('ritemark.addTask', async () => {
      if (!controller) {
        void vscode.window.showInformationMessage(
          folder ? 'The task board is turned off.' : 'Open a folder to keep a task board.',
        );
        return;
      }
      const title = await vscode.window.showInputBox({
        title: 'Add a task',
        prompt: 'It goes to the top of To do.',
        placeHolder: 'What needs doing?',
        ignoreFocusOut: false,
      });
      if (!title?.trim()) return;
      const answer = await controller.add({ title, stage: 'todo' });
      if (!answer.ok) void vscode.window.showWarningMessage(answer.message);
    }),
  );

  return { controller, store, cardPages };
}
