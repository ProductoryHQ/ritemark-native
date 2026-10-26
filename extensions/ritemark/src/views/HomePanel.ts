/**
 * Home's tab (Sprint 134, R4, R10, R11, R13; W4): the project's own page,
 * first on the desk, pinned (`permanentTabs.ts`). A webview panel in the shared
 * bundle (`data-editor-type="home"`), restored after a restart by its
 * serializer. The page draws what this host sends and asks for what the
 * person does; every request is decoded field by field (`projects/protocol.ts`).
 */

import { createHash } from 'crypto';
import { promises as fsp } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { BoardController } from '../taskBoard/BoardController';
import type { BoardSnapshot } from '../taskBoard/protocol';
import { isPointerOnly } from '../projects/aboutFile';
import { recentItems, RECENT_EXTENSIONS, othersOf, showWhatMoved, switchNoteEndsOnHost, waitingItems } from '../projects/homeState';
import { projectInitials, readProject, setProjectCover, setProjectLine, nodeProjectFileFs } from '../projects/projectFile';
import type { ProjectList } from '../projects/ProjectList';
import { decodeHomeRequest, type HomeRequest, type HomeState } from '../projects/protocol';
import { ProjectSwitcher, type SwitchedFrom } from '../projects/switchProject';
import type { ProjectWaiting, WaitingReader } from '../projects/waiting';
import { UPDATED_FROM_1X_KEY } from '../welcome/updateDetection';
import { displayPlace } from '../welcome/recentProjects';
import type { GuidanceHost, HomeGuidanceInput } from '../guidance/GuidanceHost';
import { normalizeProjectUri } from '../conversations/projectScope';

export const HOME_VIEW_TYPE = 'ritemark.home';
export const WHAT_MOVED_SEEN_KEY = 'ritemark.whatMovedSeen';
/** product.json's defaultChatAgent.chatExtensionId; More shows Copilot Chat only while it is installed and enabled. */
const COPILOT_CHAT_EXTENSION_ID = 'GitHub.copilot-chat';
const FILE_SCAN_LIMIT = 5000;
const REDRAW_DEBOUNCE_MS = 1500;

export interface HomeHostDependencies {
  context: vscode.ExtensionContext;
  folder: vscode.WorkspaceFolder;
  projectList: ProjectList;
  waiting: WaitingReader;
  switcher: ProjectSwitcher;
  /** The open project's board; null when there is none or the flag is off. */
  board: () => BoardController | null;
  boardEnabled: () => boolean;
  /** The AI's sheet: open a chat by id (R4). */
  openConversation: (conversationId: string) => Promise<void>;
  /** The projects list: a project of the list was chosen whose folder is not found. */
  onProjectsChanged: () => void;
  /** Sprint 140: the first day's guidance (Home's one card); null in a window with none. */
  guidance: GuidanceHost | null;
  /** Sprint 142 (R3): a message the AI's sheet accepted. */
  onTurnAccepted?: (listener: () => void) => vscode.Disposable;
}

/** One per window: computes Home's state, answers its requests, and owns its panel. */
export class HomeHost implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private redrawTimer: ReturnType<typeof setTimeout> | undefined;
  private ready = false;
  private recentPaths = new Map<string, string>();
  private waitingIds = new Map<string, { source: 'card' | 'chat'; id: string }>();
  private snapshot: BoardSnapshot | null = null;
  private notice: string | null = null;
  /** OK on the unreadable project file's note: it stays hidden until the window reloads (S3). */
  private unreadableSeen = false;
  private switchedFrom: SwitchedFrom | null;
  /** When the switch note was first drawn on a visible Home (R3); null before. */
  private switchedShownAt: number | null = null;
  private missing: { id: string; folderUri: string; name: string; mark: string; place: string } | null = null;

  constructor(private readonly deps: HomeHostDependencies) {
    this.switchedFrom = ProjectSwitcher.takeSwitchedFrom(deps.context, deps.folder.uri.toString());
    const unsubscribe = this.subscribeBoard();
    if (unsubscribe) this.disposables.push({ dispose: unsubscribe });
    // The project's files: Last changed and whether the project is empty.
    const files = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(deps.folder, '**/*'));
    const onFiles = (uri: vscode.Uri) => {
      if (/[\\/](\.git|node_modules|\.ritemark)[\\/]/.test(uri.fsPath)) return;
      this.scheduleRedraw();
    };
    this.disposables.push(files, files.onDidCreate(onFiles), files.onDidDelete(onFiles), files.onDidChange(onFiles));
    // The chats: their index changes whenever a chat's state does, in this window or another.
    const chats = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(
      vscode.Uri.file(path.join(deps.context.globalStorageUri.fsPath, 'conversations', 'v1')), 'index.json'));
    const onChats = () => {
      this.deps.waiting.invalidate();
      this.scheduleRedraw();
    };
    this.disposables.push(chats, chats.onDidChange(onChats), chats.onDidCreate(onChats));
    this.disposables.push(deps.projectList.onDidChange(() => this.scheduleRedraw()) as unknown as vscode.Disposable);
    // Copilot Chat installed, enabled or removed: What moved's line follows it.
    this.disposables.push(vscode.extensions.onDidChange(() => this.scheduleRedraw()));
    // Sprint 140: the guidance card follows a sign-in, a press, a send
    if (deps.guidance) this.disposables.push(deps.guidance.onDidChange(() => this.scheduleRedraw(0)));
    // Sprint 142 (R3): a message sent on the AI's sheet ends the switch note
    if (deps.onTurnAccepted && this.switchedFrom) this.disposables.push(deps.onTurnAccepted(() => this.endSwitchedNote('turn-accepted')));
  }

  /** Sprint 142 (R3): the person started something the host can see; the note goes and does not come back. */
  private endSwitchedNote(event: 'home-hidden' | 'turn-accepted'): void {
    if (!this.switchedFrom) return;
    const shownFor = this.switchedShownAt === null ? null : Date.now() - this.switchedShownAt;
    if (!switchNoteEndsOnHost(event, shownFor)) return;
    this.switchedFrom = null;
    void this.push();
  }

  private subscribeBoard(): (() => void) | undefined {
    const board = this.deps.board();
    if (!board) return undefined;
    void board.snapshot().then((snapshot) => {
      this.snapshot = snapshot;
      this.scheduleRedraw(0);
    }, () => undefined);
    return board.subscribe((snapshot) => {
      this.snapshot = snapshot;
      this.scheduleRedraw(0);
    });
  }

  /** Show Home: bring its tab forward, or make it. Calls that overlap share one attempt, so two never make two Homes. */
  reveal(options: { preserveFocus?: boolean; viewColumn?: vscode.ViewColumn } = {}): Promise<vscode.WebviewPanel> {
    if (!this.revealing) {
      this.revealing = this.revealOnce(options).finally(() => {
        this.revealing = undefined;
      });
    }
    return this.revealing;
  }

  private revealing: Promise<vscode.WebviewPanel> | undefined;

  private async revealOnce(options: { preserveFocus?: boolean; viewColumn?: vscode.ViewColumn }): Promise<vscode.WebviewPanel> {
    if (this.panel) {
      this.panel.reveal(this.panel.viewColumn ?? options.viewColumn, options.preserveFocus);
      return this.panel;
    }
    // A Home tab the window restored is revived only when shown: bring that tab forward and wait for it, rather
    // than make a second Home (S21).
    const restored = vscode.window.tabGroups.all.flatMap((group) => group.tabs)
      .find((tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith(HOME_VIEW_TYPE));
    if (restored) {
      const index = restored.group.tabs.indexOf(restored);
      if (restored.group.viewColumn === vscode.ViewColumn.One) await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
      await vscode.commands.executeCommand('workbench.action.openEditorAtIndex', index);
      for (let waited = 0; !this.panel && waited < 3000; waited += 50) await new Promise((resolve) => setTimeout(resolve, 50));
      if (this.panel) return this.panel;
    }
    const panel = vscode.window.createWebviewPanel(
      HOME_VIEW_TYPE,
      'Home',
      { viewColumn: options.viewColumn ?? vscode.ViewColumn.One, preserveFocus: options.preserveFocus ?? false },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: this.resourceRoots() },
    );
    this.attach(panel);
    return panel;
  }

  /** The serializer's panel after a restart. */
  revive(panel: vscode.WebviewPanel): void {
    if (this.panel && this.panel !== panel) {
      panel.dispose();
      return;
    }
    panel.webview.options = { enableScripts: true, localResourceRoots: this.resourceRoots() };
    this.attach(panel);
  }

  get current(): vscode.WebviewPanel | undefined {
    return this.panel;
  }

  /** A project of the list whose folder is not found: its Home's not-found box (experience 33, frame 2). */
  async showMissing(project: { id: string; folderUri: string; name: string; mark: string; place: string }): Promise<void> {
    this.missing = project;
    await this.reveal();
    await this.push();
  }

  private resourceRoots(): vscode.Uri[] {
    return [
      vscode.Uri.joinPath(this.deps.context.extensionUri, 'media'),
      vscode.Uri.joinPath(this.deps.folder.uri, '.ritemark'),
    ];
  }

  private attach(panel: vscode.WebviewPanel): void {
    this.panel = panel;
    this.ready = false;
    panel.iconPath = {
      light: vscode.Uri.joinPath(this.deps.context.extensionUri, 'media', 'home', 'home-tab-light.svg'),
      dark: vscode.Uri.joinPath(this.deps.context.extensionUri, 'media', 'home', 'home-tab-dark.svg'),
    };
    panel.webview.html = homeHtml(panel.webview, this.deps.context.extensionUri);
    const subscriptions: vscode.Disposable[] = [
      panel.webview.onDidReceiveMessage((raw) => {
        const decoded = decodeHomeRequest(raw);
        if (!decoded.ok) {
          console.warn('[Home] Refused a request:', decoded.reason);
          return;
        }
        void this.handle(decoded.request).catch((error) => console.error('[Home] Request failed:', error));
      }),
      panel.onDidChangeViewState(() => {
        if (panel.visible) {
          this.deps.waiting.invalidate();
          this.scheduleRedraw(0);
          // The list beside Home counts from the same fresh read (R3, S9)
          this.deps.onProjectsChanged();
        } else {
          // Sprint 142 (R3): another tab chosen or opened on Home's desk ends the switch note
          this.endSwitchedNote('home-hidden');
        }
      }),
    ];
    panel.onDidDispose(() => {
      subscriptions.forEach((subscription) => subscription.dispose());
      if (this.panel === panel) this.panel = undefined;
    });
  }

  private scheduleRedraw(delay = REDRAW_DEBOUNCE_MS): void {
    if (!this.panel || !this.ready) return;
    if (this.redrawTimer) clearTimeout(this.redrawTimer);
    this.redrawTimer = setTimeout(() => {
      this.redrawTimer = undefined;
      void this.push();
    }, delay);
  }

  private async handle(request: HomeRequest): Promise<void> {
    const folder = this.deps.folder;
    switch (request.type) {
      case 'home/ready':
        this.ready = true;
        await this.push();
        return;
      case 'home/open-documents':
        await vscode.commands.executeCommand('workbench.view.explorer');
        return;
      case 'home/set-line': {
        const result = await setProjectLine(nodeProjectFileFs(), folder.uri.fsPath, request.line, { folderName: folder.name });
        this.notice = result.ok ? null : result.message;
        await this.push();
        return;
      }
      case 'home/change-cover': {
        const picked = await vscode.window.showOpenDialog({
          canSelectMany: false,
          openLabel: 'Use as cover',
          title: 'Choose a cover picture',
          filters: { Pictures: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
        });
        if (!picked?.[0]) return;
        const result = await setProjectCover(nodeProjectFileFs(), folder.uri.fsPath, picked[0].fsPath, { folderName: folder.name });
        this.notice = result.ok ? null : result.message;
        await this.push();
        return;
      }
      case 'home/open-waiting': {
        const target = this.waitingIds.get(request.id);
        if (!target) return;
        if (target.source === 'card') await vscode.commands.executeCommand('ritemark.openTaskBoard', target.id);
        else await this.deps.openConversation(target.id);
        return;
      }
      case 'home/start': {
        const command = request.kind === 'text' ? 'ritemark.newDocument' : request.kind === 'table' ? 'ritemark.newTable' : 'ritemark.browser.newTab';
        await vscode.commands.executeCommand(command);
        return;
      }
      case 'home/open-recent': {
        const file = this.recentPaths.get(request.id);
        if (file) await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file));
        return;
      }
      case 'home/what-moved-seen':
        await this.deps.context.globalState.update(WHAT_MOVED_SEEN_KEY, true);
        await this.push();
        return;
      case 'home/go-back': {
        const from = this.switchedFrom;
        this.switchedFrom = null;
        await this.push();
        if (from) await this.deps.switcher.switchTo(vscode.Uri.parse(from.folderUri), { goingBack: true });
        return;
      }
      case 'home/dismiss-switched':
        this.switchedFrom = null;
        await this.push();
        return;
      case 'home/find-missing':
        if (this.missing && this.missing.id === request.id) await this.findMissing(this.missing);
        return;
      case 'home/remove-missing':
        if (this.missing && this.missing.id === request.id) {
          const here = this.missing.folderUri === folder.uri.toString();
          await this.deps.projectList.remove(this.missing.folderUri);
          this.missing = null;
          this.deps.onProjectsChanged();
          // This window's own project: nothing is left to show in it, so it closes the folder (S53)
          if (here) await vscode.commands.executeCommand('workbench.action.closeFolder');
          else await this.push();
        }
        return;
      case 'home/dismiss-missing':
        this.missing = null;
        await this.push();
        return;
      case 'home/add-files': {
        const picked = await vscode.window.showOpenDialog({ canSelectMany: true, openLabel: 'Copy into this project', title: 'Bring files into this project' });
        if (picked?.length) await this.copyIn(picked);
        return;
      }
      case 'home/drop-files':
        await this.copyIn(request.uris.map((uri) => vscode.Uri.parse(uri)).filter((uri) => uri.scheme === 'file'));
        return;
      case 'home/dismiss-notice':
        if (!this.notice) this.unreadableSeen = true;
        this.notice = null;
        await this.push();
        return;
      // Sprint 140 (R4–R6, R14): the guidance card
      case 'home/ready-request': {
        const input = await this.guidanceInput();
        if (input) await this.deps.guidance?.pressReadyRequest(input);
        return;
      }
      case 'home/ready-request-ai':
        await this.deps.guidance?.chooseAi(folder.uri.toString(), request.ai);
        return;
      case 'home/ready-request-hide':
        await this.deps.guidance?.hide(folder.uri.toString());
        return;
      case 'home/sign-in':
        await this.deps.guidance?.signIn(folder.uri.toString(), request.ai);
        return;
      case 'home/save-keys': {
        const result = await this.deps.guidance?.saveKeys(folder.uri.toString(), request.keys) ?? { ok: false, message: null };
        await this.panel?.webview.postMessage({ type: 'home/keys-saved', ...result });
        return;
      }
      case 'home/feedback-send':
        await this.deps.guidance?.sendFeedbackLine(request.text);
        return;
      case 'home/feedback-not-now':
        await this.deps.guidance?.feedbackNotNow();
        return;
      case 'home/feedback-mail':
        await this.deps.guidance?.mailFeedbackLine(request.text);
        return;
    }
  }

  /** What the guidance needs from this host's own reads (Sprint 140). */
  private async guidanceInput(recent?: { empty: boolean; pointers: Set<string> }): Promise<HomeGuidanceInput | null> {
    const { folder, context } = this.deps;
    const files = recent ?? await this.recentFiles();
    const entry = (await this.deps.projectList.entries(folder.uri.toString())).find((candidate) => sameFolder(candidate.folderUri, folder.uri.toString()));
    return {
      folderUri: folder.uri.toString(),
      folderPath: folder.uri.fsPath,
      projectName: folder.name,
      empty: files.empty,
      whatMoved: showWhatMoved(context.globalState.get<unknown>(UPDATED_FROM_1X_KEY), context.globalState.get<unknown>(WHAT_MOVED_SEEN_KEY)),
      foundBy: entry?.foundBy ?? null,
      chatIndex: await this.deps.waiting.readChatIndex(),
      handoffs: await this.deps.waiting.readHandoffs(folder.uri.fsPath),
      skipAtRoot: new Set([...files.pointers].map((file) => path.basename(file))),
    };
  }

  /** Find it…: the folder picker at the old place's nearest parent that is there. */
  private async findMissing(missing: { folderUri: string; name: string }): Promise<void> {
    let start = vscode.Uri.parse(missing.folderUri).fsPath;
    for (let i = 0; i < 20; i += 1) {
      const parent = path.dirname(start);
      if (parent === start) break;
      start = parent;
      if (await fsp.stat(start).then((stat) => stat.isDirectory(), () => false)) break;
    }
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: vscode.Uri.file(start),
      openLabel: 'This is the project',
      title: `Where is ${missing.name} now?`,
    });
    if (!picked?.[0]) return;
    const result = await this.deps.projectList.relocate(missing.folderUri, picked[0].toString());
    if (!result.ok) {
      this.notice = result.reason === 'taken'
        ? `That folder is already ${path.basename(picked[0].fsPath)}, another project in the list. The list is as it was.`
        : 'That project is no longer in the list.';
      await this.push();
      return;
    }
    this.missing = null;
    this.deps.onProjectsChanged();
    await this.deps.switcher.switchTo(picked[0]);
  }

  /** Copy files into the project's top folder; the originals stay where they are (R13). */
  private async copyIn(sources: vscode.Uri[]): Promise<void> {
    const root = this.deps.folder.uri;
    // Nothing brings back a project folder that has gone (R13, S53): a copy into it would make it again.
    if (!(await folderIsThere(root.fsPath))) {
      this.notice = 'This project’s folder is not where it was, so nothing was copied.';
      await this.push();
      return;
    }
    const failed: string[] = [];
    for (const source of sources) {
      const base = path.basename(source.fsPath);
      const dot = base.lastIndexOf('.');
      const stem = dot > 0 ? base.slice(0, dot) : base;
      const extension = dot > 0 ? base.slice(dot) : '';
      let target = vscode.Uri.joinPath(root, base);
      for (let copy = 2; await exists(target) && copy < 100; copy += 1) target = vscode.Uri.joinPath(root, `${stem} ${copy}${extension}`);
      try {
        await vscode.workspace.fs.copy(source, target, { overwrite: false });
      } catch {
        failed.push(base);
      }
    }
    this.notice = failed.length ? `Ritemark couldn’t copy ${failed.join(', ')} into this project.` : null;
    this.scheduleRedraw(0);
  }

  /** Home's state, read now. */
  private async state(): Promise<HomeState> {
    const { folder, context } = this.deps;
    // The open project's folder can go while its window is open: its Home shows the not-found box, as a project of
    // the list does, and the list marks it (R13, S53).
    if (!this.missing && !(await folderIsThere(folder.uri.fsPath))) {
      await this.deps.projectList.markFound(async (uri) => (uri === folder.uri.toString() ? false : undefined));
      this.deps.onProjectsChanged();
      const name = folder.name;
      this.missing = { id: `here:${createHash('sha256').update(folder.uri.toString()).digest('hex').slice(0, 16)}`, folderUri: folder.uri.toString(), name, mark: projectInitials(name), place: displayPlace(folder.uri.fsPath, os.homedir(), process.platform) };
    }
    const details = await readProject(nodeProjectFileFs(), folder.uri.fsPath, folder.name);
    const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
    const coverUrl = details.cover && this.panel
      ? this.panel.webview.asWebviewUri(vscode.Uri.joinPath(folder.uri, '.ritemark', details.cover)).toString()
      : null;
    // What waits here, with the board's live calls.
    const snapshot = this.deps.boardEnabled() ? this.snapshot : null;
    const titles = new Map((snapshot?.cards ?? []).map((card) => [card.id, card.title]));
    const handoffs = await this.deps.waiting.readHandoffs(folder.uri.fsPath);
    const here = await this.deps.waiting.read(folder.uri.toString(), folder.uri.fsPath, snapshot ? {
      calls: snapshot.calls,
      titleOf: (id) => titles.get(id) ?? '',
      conversationIds: new Set(handoffs.flatMap((record) => (record.conversationId ? [record.conversationId] : []))),
    } : undefined);
    const items = waitingItems(here);
    this.waitingIds = new Map(items.map((item) => [item.id, { source: item.source, id: item.id.slice(item.id.indexOf(':') + 1) }]));
    // The other projects, counted on show.
    const entries = (await this.deps.projectList.entries(folder.uri.toString()))
      .filter((entry) => entry.folderUri !== folder.uri.toString() && !entry.missingSince);
    const counts = await this.deps.waiting.readMany(entries.map((entry) => ({ folderUri: entry.folderUri, folderPath: vscode.Uri.parse(entry.folderUri).fsPath })));
    const others = othersOf(entries.map((entry) => ({
      name: path.basename(vscode.Uri.parse(entry.folderUri).fsPath),
      waiting: counts.get(entry.folderUri) as ProjectWaiting | undefined,
    })));
    // Last changed, and whether the project holds anything at all.
    const recent = await this.recentFiles();
    // Sprint 140 (R2): the one guidance card under Waiting for you
    const whatMoved = showWhatMoved(context.globalState.get<unknown>(UPDATED_FROM_1X_KEY), context.globalState.get<unknown>(WHAT_MOVED_SEEN_KEY));
    const guidanceInput = this.deps.guidance ? await this.guidanceInput(recent) : null;
    const guidance = this.deps.guidance && guidanceInput
      ? await this.deps.guidance.homeGuidance(guidanceInput).catch((error) => {
          console.warn('[Home] The guidance card could not be read:', error);
          return whatMoved ? { card: 'what-moved' as const } : null;
        })
      : whatMoved ? { card: 'what-moved' as const } : null;
    return {
      platform,
      project: {
        name: details.name,
        mark: details.mark,
        place: displayPlace(folder.uri.fsPath, os.homedir(), process.platform),
        line: details.line,
        coverUrl,
      },
      waiting: { count: here.total ?? null, items },
      others,
      recent: recent.items,
      empty: recent.empty,
      boardEnabled: this.deps.boardEnabled(),
      guidance,
      copilotChat: vscode.extensions.getExtension(COPILOT_CHAT_EXTENSION_ID) !== undefined,
      switchedFrom: this.switchedFrom ? { name: this.switchedFrom.name } : null,
      missing: this.missing ? { id: this.missing.id, name: this.missing.name, mark: this.missing.mark, place: this.missing.place, here: this.missing.folderUri === folder.uri.toString() } : null,
      notice: this.notice ?? (details.unreadable && !this.unreadableSeen ? 'Ritemark can’t read this project’s settings file (.ritemark/project.json), so it shows the defaults and leaves the file as it is.' : null),
    };
  }

  private async recentFiles(): Promise<{ items: HomeState['recent']; empty: boolean; pointers: Set<string> }> {
    const folder = this.deps.folder;
    // Hidden folders too (.claude's agents, .github, …): Last changed is the person's documents (QA, 19 October)
    const exclude = '{**/node_modules/**,**/.*/**,**/.DS_Store}';
    const any = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*'), exclude, 1);
    if (any.length === 0) return { items: [], empty: true, pointers: new Set() };
    const pattern = `**/*{${[...RECENT_EXTENSIONS, '.flow.json'].join(',')}}`;
    const found = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), exclude, FILE_SCAN_LIMIT);
    const files = (await Promise.all(found.map(async (uri) => {
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        return { path: uri.fsPath, changedAt: stat.mtime };
      } catch {
        return null;
      }
    }))).filter((file): file is { path: string; changedAt: number } => file !== null);
    const pointers = new Set<string>();
    for (const file of files) {
      if (path.dirname(file.path) === folder.uri.fsPath && path.basename(file.path).toLowerCase() === 'claude.md') {
        const text = await fsp.readFile(file.path, 'utf8').catch(() => '');
        if (isPointerOnly(text)) pointers.add(file.path);
      }
    }
    const items = recentItems(folder.uri.fsPath, files, pointers);
    this.recentPaths = new Map(items.map(({ item, path: filePath }) => [item.id, filePath]));
    return { items: items.map(({ item }) => item), empty: false, pointers };
  }

  private async push(): Promise<void> {
    if (!this.panel || !this.ready) return;
    const state = await this.state();
    await this.panel.webview.postMessage({ type: 'home/state', state });
    if (state.switchedFrom && this.switchedShownAt === null && this.panel?.visible) this.switchedShownAt = Date.now();
  }

  dispose(): void {
    if (this.redrawTimer) clearTimeout(this.redrawTimer);
    this.disposables.forEach((disposable) => disposable.dispose());
    this.panel?.dispose();
  }
}

function sameFolder(a: string, b: string): boolean {
  try {
    return normalizeProjectUri(a) === normalizeProjectUri(b);
  } catch {
    return a === b;
  }
}

async function folderIsThere(fsPath: string): Promise<boolean> {
  return fsp.stat(fsPath).then((stat) => stat.isDirectory(), () => false);
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export function homeHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = nonceOf();
  const media = (...parts: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', ...parts));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:;">
  <title>Home</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { min-height: 100%; }
    body { color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  </style>
</head>
<body>
  <div id="root" data-editor-type="home" data-cover="${media('welcome', 'welcome-hero.jpg')}"></div>
  <script nonce="${nonce}" src="${media('webview.js')}"></script>
</body>
</html>`;
}

function nonceOf(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let index = 0; index < 32; index += 1) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
