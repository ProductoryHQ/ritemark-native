/**
 * The project at the centre (Sprint 134): composition, one per window.
 *
 * - the project list (`ProjectList`), joined by this window's folder and filled
 *   once per profile (`firstFill.ts`), and this window's claim on its project
 *   (`projectWindows.ts`);
 * - what waits (`WaitingReader`), with the open project's live board;
 * - switching (`ProjectSwitcher`), and the veto patch 018 asks before VS Code
 *   reloads the window for another folder;
 * - Home's tab (`HomePanel.ts`), the projects list in Home's place
 *   (`ProjectsViewProvider.ts`), the permanent tabs and the places' clicks
 *   (`permanentTabs.ts`).
 */

import { promises as fsp, realpathSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { TaskBoardHost } from '../taskBoard/taskBoardHost';
import type { GuidanceHost } from '../guidance/GuidanceHost';
import { HOME_VIEW_TYPE, HomeHost } from '../views/HomePanel';
import { registerPermanentTabs, registerPlaceClicks } from '../views/permanentTabs';
import { ProjectsViewProvider } from '../views/ProjectsViewProvider';
import { createAboutFile, nodeAboutFileFs, readAboutState } from './aboutFile';
import { firstFill, lastOpenTimes, readChatFolders } from './firstFill';
import { ProjectList } from './ProjectList';
import { projectWindowsDir, ProjectWindow } from './projectWindows';
import { ProjectSwitcher } from './switchProject';
import { WaitingReader } from './waiting';
import { pickerFolder } from '../utils/dialogDefaults';

export const FILLED_KEY = 'ritemark.projects.filledV1';

export interface ProjectsHostDependencies {
  context: vscode.ExtensionContext;
  taskBoard: TaskBoardHost;
  boardEnabled: () => boolean;
  /** The AI's sheet. */
  openConversation: (conversationId: string) => Promise<void>;
  workingChats: () => { conversationId: string; runtimeId: string | null }[];
  stopWorkingChats: () => Promise<void>;
  /** Sprint 140: the first day's guidance, Home's one card; null without a project. */
  guidance: GuidanceHost | null;
  /** Sprint 142 (R3): a message the AI's sheet accepted, which ends Home's switch note. */
  onTurnAccepted?: (listener: () => void) => vscode.Disposable;
}

export interface ProjectsHost {
  projectList: ProjectList;
  /** The first fill has run (or wasn't needed): the welcome's lists wait for it. */
  ready: Promise<void>;
  switcher: ProjectSwitcher;
  /** Bring Home's tab forward, or open it. */
  revealHome: () => Promise<void>;
}

const nodeListFs = {
  readFile: (target: string) => fsp.readFile(target, 'utf8'),
  writeFile: (target: string, data: string) => fsp.writeFile(target, data, 'utf8'),
  rename: (from: string, to: string) => fsp.rename(from, to),
  mkdir: async (target: string) => {
    await fsp.mkdir(target, { recursive: true });
  },
};

/** VS Code's recent folders: single local folders and network paths, newest first. */
async function recentFolders(): Promise<{ uri: string; fsPath: string }[]> {
  try {
    const recents = await vscode.commands.executeCommand<{ workspaces?: Array<{ folderUri?: vscode.Uri; remoteAuthority?: string }> }>('_workbench.getRecentlyOpened');
    return (recents?.workspaces ?? [])
      .filter((entry) => entry.folderUri?.scheme === 'file' && !entry.remoteAuthority)
      .map((entry) => ({ uri: entry.folderUri!.toString(), fsPath: entry.folderUri!.fsPath }));
  } catch {
    return [];
  }
}

async function fillOnce(context: vscode.ExtensionContext, list: ProjectList): Promise<void> {
  if (context.globalState.get<boolean>(FILLED_KEY) === true) return;
  const globalStoragePath = context.globalStorageUri.fsPath;
  const pathOfUri = (uri: string) => vscode.Uri.parse(uri).fsPath;
  const [recent, chats, lastOpen] = await Promise.all([
    recentFolders(),
    readChatFolders(globalStoragePath),
    lastOpenTimes(globalStoragePath, pathOfUri, process.platform),
  ]);
  const extensionRoot = context.extensionUri.fsPath;
  const found = await firstFill({
    platform: process.platform,
    recentFolders: recent,
    chatFolders: chats,
    lastOpen,
    exists: (fsPath) => fsp.stat(fsPath).then((stat) => stat.isDirectory(), () => false),
    insideApp: (fsPath) => fsPath === extensionRoot || fsPath.startsWith(extensionRoot + path.sep),
    spellingOnDisk: (fsPath) => (process.platform === 'win32' ? realpathSync.native(fsPath) : fsPath),
    uriOfPath: (fsPath) => vscode.Uri.file(fsPath).toString(),
    pathOfUri,
  });
  await list.addFound(found);
  await context.globalState.update(FILLED_KEY, true);
}

export function registerProjects(deps: ProjectsHostDependencies): ProjectsHost {
  const { context } = deps;
  const globalStoragePath = context.globalStorageUri.fsPath;
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const folder = workspaceFolder?.uri.scheme === 'file' && !vscode.workspace.workspaceFile ? workspaceFolder : undefined;
  const projectList = new ProjectList(ProjectList.fileFor(globalStoragePath), nodeListFs);

  // This window's project joins the list, first, and other windows learn this window holds it.
  const opened = folder ? projectList.opened(folder.uri.toString()) : Promise.resolve();
  if (folder) {
    const window = new ProjectWindow(projectWindowsDir(globalStoragePath));
    window.hold(folder.uri.toString());
    context.subscriptions.push(window);
  }
  const ready = opened.then(() => fillOnce(context, projectList)).catch((error) => {
    console.warn('[Projects] The first fill failed; the list fills as folders open:', error);
  });

  const waiting = new WaitingReader({ globalStoragePath, boardEnabled: deps.boardEnabled });
  const nameOf = (folderUri: string) => path.basename(vscode.Uri.parse(folderUri).fsPath) || folderUri;
  const switcher = new ProjectSwitcher({
    context,
    hereName: () => folder?.name ?? 'this window',
    hereUri: () => folder?.uri.toString() ?? null,
    nameOf,
    workingChats: deps.workingChats,
    stopWorkingChats: deps.stopWorkingChats,
  });

  // What waits in the open project, from the board's live calls.
  const countHere = async (): Promise<number | null> => {
    if (!folder) return null;
    const board = deps.boardEnabled() ? deps.taskBoard.controller : null;
    const snapshot = board ? await board.snapshot().catch(() => null) : null;
    const handoffs = await waiting.readHandoffs(folder.uri.fsPath);
    const here = await waiting.read(folder.uri.toString(), folder.uri.fsPath, snapshot ? {
      calls: snapshot.calls,
      titleOf: () => '',
      conversationIds: new Set(handoffs.flatMap((record) => (record.conversationId ? [record.conversationId] : []))),
    } : undefined);
    return here.total ?? null;
  };

  let projectsView: ProjectsViewProvider | undefined;
  const home = folder ? new HomeHost({
    context,
    folder,
    projectList,
    waiting,
    switcher,
    board: () => (deps.boardEnabled() ? deps.taskBoard.controller : null),
    boardEnabled: deps.boardEnabled,
    openConversation: deps.openConversation,
    onProjectsChanged: () => projectsView?.refresh(),
    guidance: deps.guidance,
    onTurnAccepted: deps.onTurnAccepted,
  }) : undefined;
  const revealHome = async (): Promise<void> => {
    await home?.reveal({ viewColumn: vscode.ViewColumn.One });
  };

  projectsView = new ProjectsViewProvider({
    context,
    folder,
    projectList,
    waiting,
    switcher,
    countHere,
    revealHome,
    showMissing: async (project) => {
      if (home) {
        await home.showMissing(project);
        return;
      }
      // A window with no project has no Home tab: the same choice, as a question.
      const picked = await vscode.window.showWarningMessage(
        'This project’s folder is not where it was',
        { modal: true, detail: `${project.place}\n\nIt may have been moved or renamed, or it is on a drive that is not connected now.` },
        'Find it…',
        'Remove from the list',
      );
      if (picked === 'Remove from the list') await projectList.remove(project.folderUri);
      if (picked === 'Find it…') {
        const chosen = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'This is the project',
          title: `Where is ${project.name} now?`,
          // Sprint 143 (#510): a folder that exists, never the operating system's guess.
          defaultUri: vscode.Uri.file(pickerFolder([path.dirname(vscode.Uri.parse(project.folderUri).fsPath)])),
        });
        if (!chosen?.[0]) return;
        const moved = await projectList.relocate(project.folderUri, chosen[0].toString());
        if (moved.ok) await switcher.switchTo(chosen[0]);
        else void vscode.window.showWarningMessage('That folder is already another project in the list. The list is as it was.');
      }
    },
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ProjectsViewProvider.viewType, projectsView, { webviewOptions: { retainContextWhenHidden: true } }),
    projectsView,
    vscode.window.registerWebviewPanelSerializer(HOME_VIEW_TYPE, {
      async deserializeWebviewPanel(panel) {
        // A Home tab restored in a window with no project is not Home: it goes.
        if (home) home.revive(panel);
        else panel.dispose();
      },
    }),
    registerPlaceClicks({ home: revealHome, board: deps.taskBoard.showBoard }),
    vscode.commands.registerCommand('ritemark.openHome', revealHome),
    // File ▸ Switch project (R8): Home's projects list, its search ready for typing.
    vscode.commands.registerCommand('ritemark.projects.switch', async () => {
      await revealHome();
      await projectsView?.focusSearch();
    }),
    // Patch 018's veto: VS Code is about to reload this window for another folder (R9).
    vscode.commands.registerCommand('_ritemark.projects.beforeReload', (target?: unknown) => switcher.beforeReload(target)),
    // The head's Switch project ▸ (R8): its rows, asked for by patch 018 when the flyout opens.
    vscode.commands.registerCommand('ritemark.projects.switcherItems', async () => {
      const rows = await projectsView!.projectRows();
      const alt = process.platform === 'darwin' ? '⌥ click' : 'Alt click';
      return [
        ...rows.map(({ row, folderUri }) => ({
          label: row.name,
          mark: row.mark,
          sub: row.missing ? 'Not found' : row.count ? (row.count === 1 ? '1 waits' : `${row.count} wait`) : undefined,
          // A project whose folder is not found: muted, with its old place under its name (R13, S38)
          ...(row.missing ? { muted: true, detail: row.place, trailingIcon: 'warning' } : {}),
          checked: row.open && !row.missing,
          command: 'ritemark.projects.switchTo',
          args: [folderUri],
        })),
        { label: 'All projects, on Home', icon: 'home', command: 'ritemark.projects.switch', separatorBefore: true },
        { label: 'Open in a new window', icon: 'window', sub: alt, command: 'ritemark.projects.openInNewWindow' },
      ];
    }),
    vscode.commands.registerCommand('ritemark.projects.switchTo', async (folderUri?: unknown, options?: { newWindow?: boolean }) => {
      if (typeof folderUri === 'string') await projectsView!.openProject(folderUri, options?.newWindow === true);
    }),
    vscode.commands.registerCommand('ritemark.projects.openInNewWindow', async () => {
      const rows = (await projectsView!.projectRows()).filter(({ row }) => !row.open && !row.missing);
      const picked = await vscode.window.showQuickPick(
        rows.map(({ row, folderUri }) => ({ label: row.name, description: row.place, folderUri })),
        { title: 'Open in a new window', placeHolder: 'Which project?' },
      );
      if (picked) await switcher.switchTo(vscode.Uri.parse(picked.folderUri), { newWindow: true });
    }),
    // About this project (R8): the project's AGENTS.md, opened, or created after asking.
    vscode.commands.registerCommand('ritemark.aboutProject', async () => {
      if (!folder) return;
      const fs = nodeAboutFileFs();
      const state = await readAboutState(fs, folder.uri.fsPath);
      if (!state.aboutPath) {
        const create = await vscode.window.showInformationMessage(
          'Create About this project?',
          {
            modal: true,
            detail: state.claudePath
              ? 'Ritemark writes AGENTS.md in this project’s folder, which Claude and ChatGPT read. Your CLAUDE.md stays as it is.'
              : 'Ritemark writes AGENTS.md in this project’s folder, which Claude and ChatGPT read, and a one-line CLAUDE.md that points Claude to it.',
          },
          'Create',
        );
        if (create !== 'Create') return;
      }
      const result = await createAboutFile(fs, folder.uri.fsPath);
      if (!result.ok) {
        void vscode.window.showWarningMessage(result.message);
        return;
      }
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.path));
    }),
  );
  if (home) context.subscriptions.push(home);

  // Counts follow the board at once (R3).
  const board = deps.taskBoard.controller;
  if (board) context.subscriptions.push({ dispose: board.subscribe(() => projectsView?.refresh()) });
  // ... and follow the chats too: a question, an answer or a reply read, in this window or another (R3, S9, S62)
  const chatIndex = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(
    vscode.Uri.file(path.join(context.globalStorageUri.fsPath, 'conversations', 'v1')), 'index.json'));
  let chatRefresh: ReturnType<typeof setTimeout> | undefined;
  const onChatIndex = () => {
    if (chatRefresh) clearTimeout(chatRefresh);
    chatRefresh = setTimeout(() => {
      waiting.invalidate();
      projectsView?.refresh();
    }, 300);
  };
  context.subscriptions.push(chatIndex, chatIndex.onDidChange(onChatIndex), chatIndex.onDidCreate(onChatIndex), { dispose: () => chatRefresh && clearTimeout(chatRefresh) });

  // Home and Tasks, the first two tabs, in a project window (R5).
  if (folder && home) {
    // R9: a window a switch in place opened lands on Home, once
    let land = ProjectSwitcher.takeLanding(context, folder ? folder.uri.toString() : null);
    context.subscriptions.push(registerPermanentTabs({
      landingPending: land, // Sprint 144 (P5, #569): Home comes forward at once
      landOnHome: () => {
        const value = land;
        land = false;
        return value;
      },
      openHome: async () => {
        await home.reveal({ viewColumn: vscode.ViewColumn.One });
      },
      openBoard: async () => {
        await deps.taskBoard.showBoard?.();
      },
      boardEnabled: () => deps.boardEnabled() && deps.taskBoard.showBoard !== null,
    }));
  }

  return { projectList, ready, switcher, revealHome };
}
