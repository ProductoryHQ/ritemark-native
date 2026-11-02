/**
 * The projects list (Sprint 134, R7, R13; W6): the left column when Home is
 * the chosen place. It takes 1.x's Home launcher's slot (`ritemark.homeView`)
 * and is drawn by the shared bundle (`data-editor-type="projects"`).
 *
 * Rows come from Ritemark's own list (`ProjectList`), each with its mark, its
 * name and what waits in it (`WaitingReader`); the open one first. A folder
 * that is not found keeps its place, muted. Folders are checked when the list
 * shows and when the window gains focus.
 */

import { createHash } from 'crypto';
import { promises as fsp } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ProjectList, ProjectEntryV1 } from '../projects/ProjectList';
import { projectInitials } from '../projects/projectFile';
import { decodeProjectsRequest, type ProjectRow, type ProjectsRequest, type ProjectsState } from '../projects/protocol';
import type { ProjectSwitcher } from '../projects/switchProject';
import type { WaitingReader } from '../projects/waiting';
import { displayPlace } from '../welcome/recentProjects';
import { pickerFolder } from '../utils/dialogDefaults';
import { HOME_PLACE_ID } from '../frameIdentifiers';

const FOUND_TIMEOUT_MS = 2000;
/** A view resolved this soon after activation is the window restoring it, not a click. */
const STARTUP_RESTORE_MS = 10_000;

export interface ProjectsViewDependencies {
  context: vscode.ExtensionContext;
  folder: vscode.WorkspaceFolder | undefined;
  projectList: ProjectList;
  waiting: WaitingReader;
  switcher: ProjectSwitcher;
  /** What waits in the open project, from its live board and chats. */
  countHere: () => Promise<number | null>;
  /** Home's tab: brought forward, or showing a project that is not found. */
  revealHome: () => Promise<void>;
  showMissing: (project: { id: string; folderUri: string; name: string; mark: string; place: string }) => Promise<void>;
}

/** An opaque id for a folder: the page never sees or sends a path. */
export function projectId(folderUri: string): string {
  return `project:${createHash('sha256').update(folderUri).digest('hex').slice(0, 16)}`;
}

function nameOf(folderUri: string): string {
  return path.basename(vscode.Uri.parse(folderUri).fsPath) || folderUri;
}

/** Whether a folder is there; undefined when the check couldn't tell in time (a slow share). */
async function folderFound(folderUri: string): Promise<boolean | undefined> {
  const check = fsp.stat(vscode.Uri.parse(folderUri).fsPath).then((stat) => stat.isDirectory(), (error: NodeJS.ErrnoException) => (error.code === 'ENOENT' || error.code === 'ENOTDIR' ? false : undefined));
  return Promise.race([check, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), FOUND_TIMEOUT_MS))]);
}

export class ProjectsViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'ritemark.homeView';

  private view: vscode.WebviewView | undefined;
  private ready = false;
  private entries = new Map<string, ProjectEntryV1>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly createdAt = Date.now();

  constructor(private readonly deps: ProjectsViewDependencies) {
    const offList = deps.projectList.onDidChange(() => void this.push());
    this.disposables.push({ dispose: offList });
    this.disposables.push(vscode.window.onDidChangeWindowState((state) => {
      if (state.focused && this.view?.visible) void this.checkFolders();
    }));
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    // A view resolved well after start is a click on Home's place, not the window restoring it (as Tasks does).
    if (Date.now() - this.createdAt > STARTUP_RESTORE_MS) void this.deps.revealHome();
    this.view = view;
    this.ready = false;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.deps.context.extensionUri, 'media')] };
    view.webview.html = projectsHtml(view.webview, this.deps.context.extensionUri);
    view.webview.onDidReceiveMessage((raw) => {
      const decoded = decodeProjectsRequest(raw);
      if (!decoded.ok) {
        console.warn('[Projects] Refused a request:', decoded.reason);
        return;
      }
      void this.handle(decoded.request).catch((error) => console.error('[Projects] Request failed:', error));
    });
    view.onDidChangeVisibility(() => {
      if (view.visible) {
        this.deps.waiting.invalidate();
        void this.checkFolders();
        // The Home place chosen brings Home's tab forward (R5), as Tasks does for the board.
        void this.deps.revealHome();
      }
    });
    view.onDidDispose(() => {
      if (this.view === view) this.view = undefined;
    });
  }

  /** File ▸ Switch project: the list, with its search ready for typing. */
  async focusSearch(): Promise<void> {
    await vscode.commands.executeCommand(HOME_PLACE_ID);
    this.view?.show(false);
    void this.view?.webview.postMessage({ type: 'projects/focus-search' });
  }

  /** Re-read and redraw (another window changed the list, a board changed). */
  refresh(): void {
    void this.push();
  }

  private async checkFolders(): Promise<void> {
    await this.deps.projectList.markFound(folderFound);
    await this.push();
  }

  private async handle(request: ProjectsRequest): Promise<void> {
    switch (request.type) {
      case 'projects/ready':
        this.ready = true;
        await this.push();
        void this.checkFolders();
        return;
      case 'projects/open': {
        const entry = this.entries.get(request.id);
        if (entry) await this.openProject(entry.folderUri, request.newWindow);
        return;
      }
      case 'projects/remove': {
        const entry = this.entries.get(request.id);
        if (entry && entry.folderUri !== this.deps.folder?.uri.toString()) await this.deps.projectList.remove(entry.folderUri);
        return;
      }
      case 'projects/reveal': {
        const entry = this.entries.get(request.id);
        if (entry) await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.parse(entry.folderUri));
        return;
      }
      case 'projects/open-folder': {
        const picked = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: 'Open',
          title: 'Open a folder as a project',
          // Sprint 143 (#510): a folder that exists, never the operating system's guess.
          defaultUri: vscode.Uri.file(pickerFolder([this.deps.folder ? path.dirname(this.deps.folder.uri.fsPath) : undefined])),
        });
        if (picked?.[0]) await this.deps.switcher.switchTo(picked[0]);
        return;
      }
      case 'projects/new-project':
        await this.newProject();
        return;
    }
  }

  /**
   * Open a project of the list: Home when it is this window's, its not-found box when its folder is gone, a new
   * window with ⌥ (Alt), otherwise a switch in place (R7, R9, R13). Also the head's switcher's rows (R8).
   */
  async openProject(folderUri: string, newWindow: boolean): Promise<void> {
    const here = this.deps.folder?.uri.toString();
    if (here && folderUri === here && !newWindow) {
      await this.deps.revealHome();
      return;
    }
    const entry = (await this.deps.projectList.entries()).find((candidate) => candidate.folderUri === folderUri);
    if (entry?.missingSince || (await folderFound(folderUri)) === false) {
      await this.deps.projectList.markFound(async (uri) => (uri === folderUri ? false : undefined));
      const name = nameOf(folderUri);
      await this.deps.showMissing({
        id: projectId(folderUri),
        folderUri,
        name,
        mark: projectInitials(name),
        place: displayPlace(vscode.Uri.parse(folderUri).fsPath, os.homedir(), process.platform),
      });
      return;
    }
    await this.deps.switcher.switchTo(vscode.Uri.parse(folderUri), { newWindow });
  }

  /** The list's rows, the open project first, with what waits in each (the page's and the switcher's). */
  async projectRows(): Promise<{ row: ProjectRow; folderUri: string }[]> {
    const here = this.deps.folder?.uri.toString();
    const entries = await this.deps.projectList.entries(here);
    this.entries = new Map(entries.map((entry) => [projectId(entry.folderUri), entry]));
    const others = entries.filter((entry) => entry.folderUri !== here && !entry.missingSince);
    const counts = await this.deps.waiting.readMany(others.map((entry) => ({ folderUri: entry.folderUri, folderPath: vscode.Uri.parse(entry.folderUri).fsPath })));
    const hereCount = here ? await this.deps.countHere() : null;
    return entries.map((entry) => {
      const name = nameOf(entry.folderUri);
      const open = entry.folderUri === here;
      return {
        folderUri: entry.folderUri,
        row: {
          id: projectId(entry.folderUri),
          name,
          mark: projectInitials(name),
          count: open ? hereCount : counts.get(entry.folderUri)?.total ?? null,
          open,
          // The open project too: its folder can go while its window is open (S53)
          missing: Boolean(entry.missingSince),
          place: displayPlace(vscode.Uri.parse(entry.folderUri).fsPath, os.homedir(), process.platform),
        },
      };
    });
  }

  /**
   * Start a new project: the welcome's own flow (Sprint 133 R5, S25), with its name field, its place and Change…;
   * it switches to the new project when made.
   */
  private async newProject(): Promise<void> {
    await vscode.commands.executeCommand('ritemark.welcome.newProject');
  }

  private async push(): Promise<void> {
    if (!this.view || !this.ready) return;
    const platform: ProjectsState['platform'] = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
    const projects = (await this.projectRows()).map(({ row }) => row);
    await this.view.webview.postMessage({ type: 'projects/state', state: { platform, projects } });
  }

  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
  }
}

function projectsHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = createHash('sha256').update(`${Math.random()}${Date.now()}`).digest('hex').slice(0, 32);
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
  // Sprint 142 (#504): the list scrolls on the ground (index.css, html.rm-ground)
  return `<!DOCTYPE html>
<html lang="en" class="rm-ground">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:;">
  <title>Projects</title>
  <style>* { margin: 0; padding: 0; box-sizing: border-box; } html, body { min-height: 100%; }</style>
</head>
<body>
  <div id="root" data-editor-type="projects"></div>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}
