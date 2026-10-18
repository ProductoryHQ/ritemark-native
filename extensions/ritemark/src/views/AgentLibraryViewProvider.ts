import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as fsp from 'fs/promises';
import { discoverAgents, discoverCommands, validateAgentFrontmatter } from '../agent/discovery';
import type { DiscoveredAgent, DiscoveredCommand, ItemScope } from '../agent/discovery';
import type { DaemonResultStore } from '../daemon/DaemonResultStore';
import type { DaemonController } from '../daemon/index';

type HelperType = 'skill' | 'agent' | 'command';

type CreateHelperPayload = {
  type: HelperType;
  scope: ItemScope;
  name: string;
};

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
  return slug || 'untitled';
}

function uniqueSlug(baseSlug: string, parentDir: string, isDirectoryItem: boolean): string {
  const exists = (slug: string) => {
    const target = path.join(parentDir, isDirectoryItem ? slug : `${slug}.md`);
    return fs.existsSync(target);
  };
  if (!exists(baseSlug)) return baseSlug;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${baseSlug}-${i}`;
    if (!exists(candidate)) return candidate;
  }
  return `${baseSlug}-${Date.now()}`;
}

function skillSkeleton(name: string): string {
  return `---
name: ${name}
description:
when_to_use:
disable-model-invocation: false
user-invocable: true
arguments:
allowed-tools:
paths:
---

<!-- Plain-language description of WHEN this skill should activate.
     Be specific. Weak descriptions are the #1 reason skills don't trigger.
     Example: "Reformats meeting notes into structured outlines with action items." -->
`;
}

function agentSkeleton(name: string): string {
  return `---
name: ${name}
description:
tools:
model:
effort:
skills:
memory:
---

<!-- Plain-language description of what this agent does and when to delegate to it.
     Anthropic does not publish an "agent-creator" guide; refer to
     https://code.claude.com/docs/en/sub-agents.md for the full schema. -->
`;
}

function commandSkeleton(name: string): string {
  return `---
description: ${name}
argument-hint:
---

<!-- The prompt Claude follows when someone types this command (/ and its file name).
     Write it as instructions; $ARGUMENTS stands for what follows the command. -->
`;
}

function getClaudeRoot(scope: ItemScope, workspacePath: string | undefined): string | null {
  if (scope === 'project') {
    return workspacePath ? path.join(workspacePath, '.claude') : null;
  }
  return path.join(os.homedir(), '.claude');
}

/** Determine the scope of a file path by checking which root it lives under. */
function detectScope(filePath: string, workspacePath: string | undefined): ItemScope {
  if (workspacePath && filePath.startsWith(path.join(workspacePath, '.claude'))) return 'project';
  return 'user';
}

/** Determine if a file represents a skill (lives inside a .claude/skills/<dir>/SKILL.md path). */
function isSkillItem(filePath: string): boolean {
  const parent = path.basename(path.dirname(path.dirname(filePath)));
  const file = path.basename(filePath);
  return parent === 'skills' && file === 'SKILL.md';
}

/** For skill items, the "real" item the user thinks of is the directory; for agents, the file. */
function getItemRoot(filePath: string): string {
  return isSkillItem(filePath) ? path.dirname(filePath) : filePath;
}

export class AgentLibraryViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.agentLibraryView';

  private _view?: vscode.WebviewView;
  private _agents: DiscoveredAgent[] = [];
  private _commands: DiscoveredCommand[] = [];
  private _flows: Array<{ id: string; name: string; filePath: string }> = [];
  private _refreshTimer: NodeJS.Timeout | null = null;
  /** The webview has said it is ready; until then, messages wait (New and Search at the column's head). */
  private _ready = false;
  private readonly _pending: object[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspacePath: string | undefined,
    private readonly _resultStore?: DaemonResultStore,
    private readonly _daemon?: DaemonController
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    this._ready = false;
    this._discover();
    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'ready':
          this._ready = true;
          this._sendItems();
          for (const pending of this._pending.splice(0)) {
            void webviewView.webview.postMessage(pending);
          }
          break;
        case 'openFile':
          this._openFile(message.filePath);
          break;
        case 'refresh':
          this._discover();
          this._sendItems();
          break;
        case 'createHelper':
          void this._createHelper(message.payload as CreateHelperPayload);
          break;
        case 'duplicateHelper':
          void this._duplicateHelper(message.filePath);
          break;
        case 'revealInFinder':
          void this._revealInFinder(message.filePath);
          break;
        case 'deleteHelper':
          void this._deleteHelper(message.filePath);
          break;
        case 'moveScope':
          void this._moveScope(message.filePath);
          break;
        case 'launchChat':
          void this._launchChat(message.agentId, message.filePath);
          break;
        case 'setDaemonConsent': {
          const next = message.state === 'granted' ? 'granted' : 'declined';
          if (this._daemon) {
            void this._daemon.setConsent(next).then(() => this.refresh());
          }
          return;
        }
        case 'approveScheduledRun':
          void vscode.commands.executeCommand(
            'ritemark.daemon.approveScheduledAction',
            message.taskId,
            message.runId
          );
          break;
      }
    });
  }

  /** Opens the library's New dialog for a kind: New at the column's head (Ritemark 2.0, experience 31). */
  public openCreate(kind: HelperType): void {
    this._postWhenReady({ type: 'openCreate', kind });
  }

  /** Shows and focuses the library's search: Search at the column's head. */
  public focusSearch(): void {
    this._postWhenReady({ type: 'focusSearch' });
  }

  /** Reveals the library and sends the message once its webview listens. */
  private _postWhenReady(message: object): void {
    void vscode.commands.executeCommand(`${AgentLibraryViewProvider.viewType}.focus`);
    if (this._view && this._ready) {
      void this._view.webview.postMessage(message);
    } else {
      this._pending.push(message);
    }
  }

  /** Public refresh API used by file watchers and external callers. Debounced. */
  public refresh() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      this._discover();
      this._sendItems();
      this._refreshTimer = null;
    }, 200);
  }

  /**
   * Reveal the Agent Library, expand the SCHEDULED section and — when a run is
   * given — scroll to and briefly highlight that run. Invoked from the daemon's
   * completion/blocked toast buttons and the status-bar item (via
   * ritemark.daemon.showScheduledRuns / openResult).
   */
  public revealScheduled(taskId?: string, runId?: string): void {
    // Reveals the view (creates it if the library has never been opened).
    void vscode.commands.executeCommand('ritemark.agentLibraryView.focus');
    this._view?.webview.postMessage({
      type: 'revealScheduled',
      taskId: taskId ?? null,
      runId: runId ?? null,
    });
  }

  private _discover() {
    this._agents = discoverAgents(this._workspacePath);
    this._commands = discoverCommands(this._workspacePath);
    this._discoverFlows(); // fire-and-forget; updates _flows then re-sends items
  }

  private _discoverFlows(): void {
    if (!this._workspacePath) return;
    const flowsDir = path.join(this._workspacePath, '.ritemark', 'flows');
    fsp.readdir(flowsDir).then((files) => {
      this._flows = files
        .filter((f) => f.endsWith('.flow.json'))
        .map((f) => {
          const stem = path.basename(f, '.flow.json');
          return { id: stem, name: stem, filePath: path.join(flowsDir, f) };
        });
      this._sendItems();
    }).catch(() => {
      this._flows = [];
    });
  }

  private _sendItems() {
    const skills = this._commands.filter((c) => c.source === 'skills');
    const commands = this._commands.filter((c) => c.source === 'commands');

    // Build attachment map: flow stem → agent display names
    const attachmentMap: Record<string, string[]> = {};
    for (const agent of this._agents) {
      if (agent.routine) {
        const stem = path.basename(agent.routine, '.flow.json');
        if (!attachmentMap[stem]) attachmentMap[stem] = [];
        attachmentMap[stem].push(agent.name);
      }
    }

    const flows = this._flows.map((f) => ({
      ...f,
      attachedAgents: attachmentMap[f.id] || [],
    }));

    // Validation touches the filesystem (fs.existsSync on routine paths) and must
    // run here on the extension host — the webview script has no fs access.
    const agentsPayload = this._agents.map((a) => ({
      ...a,
      validationErrors: a.isMainAgent ? [] : validateAgentFrontmatter(a),
    }));

    const scheduledRuns = this._resultStore ? this._resultStore.getAllRuns(10) : [];

    this._view?.webview.postMessage({
      type: 'items',
      agents: agentsPayload,
      skills,
      commands,
      flows,
      scheduledRuns,
      // Sprint 107 R2: per-workspace consent state for schedule-triggered runs.
      daemonConsent: this._daemon && this._daemon.scheduler ? this._daemon.getConsent() : null,
      workspacePath: this._workspacePath || '',
      userHomePath: os.homedir(),
    });
  }

  private _openFile(filePath: string) {
    const uri = vscode.Uri.file(filePath);
    vscode.commands.executeCommand('vscode.open', uri);
  }

  private async _launchChat(agentId: string, filePath: string) {
    await vscode.commands.executeCommand('ritemark.pinAgent', agentId, filePath);
    await vscode.commands.executeCommand('ritemark.unifiedView.focus');
  }

  private async _createHelper(payload: CreateHelperPayload) {
    const { type, scope, name } = payload;
    const trimmed = name.trim();
    if (!trimmed) return;

    const claudeRoot = getClaudeRoot(scope, this._workspacePath);
    if (!claudeRoot) {
      vscode.window.showWarningMessage(
        'Open a folder first to create a project-scoped helper, or switch to User scope.'
      );
      return;
    }

    const subdir = type === 'skill' ? 'skills' : type === 'command' ? 'commands' : 'agents';
    const parentDir = path.join(claudeRoot, subdir);
    fs.mkdirSync(parentDir, { recursive: true });

    const baseSlug = slugify(trimmed);
    const isDirItem = type === 'skill';
    const slug = uniqueSlug(baseSlug, parentDir, isDirItem);

    let filePath: string;
    if (type === 'skill') {
      const skillDir = path.join(parentDir, slug);
      fs.mkdirSync(skillDir, { recursive: true });
      filePath = path.join(skillDir, 'SKILL.md');
      fs.writeFileSync(filePath, skillSkeleton(trimmed), 'utf8');
    } else {
      filePath = path.join(parentDir, `${slug}.md`);
      fs.writeFileSync(filePath, type === 'command' ? commandSkeleton(trimmed) : agentSkeleton(trimmed), 'utf8');
    }

    this.refresh();
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
  }

  private async _duplicateHelper(filePath: string) {
    if (!fs.existsSync(filePath)) return;

    const itemRoot = getItemRoot(filePath);
    const isDir = isSkillItem(filePath);
    const parentDir = path.dirname(itemRoot);
    const base = path.basename(itemRoot, isDir ? '' : '.md');
    const baseSlug = `${base}-copy`;
    const newSlug = uniqueSlug(baseSlug, parentDir, isDir);

    const newPath = isDir
      ? path.join(parentDir, newSlug)
      : path.join(parentDir, `${newSlug}.md`);

    if (isDir) {
      this._copyDirRecursive(itemRoot, newPath);
    } else {
      fs.copyFileSync(itemRoot, newPath);
    }

    this.refresh();
    const fileToOpen = isDir ? path.join(newPath, 'SKILL.md') : newPath;
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fileToOpen));
  }

  private _copyDirRecursive(src: string, dest: string) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this._copyDirRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private async _revealInFinder(filePath: string) {
    const itemRoot = getItemRoot(filePath);
    const uri = vscode.Uri.file(itemRoot);
    await vscode.commands.executeCommand('revealFileInOS', uri);
  }

  private async _deleteHelper(filePath: string) {
    if (!fs.existsSync(filePath)) return;

    const itemRoot = getItemRoot(filePath);
    const isDir = isSkillItem(filePath);
    const scope = detectScope(itemRoot, this._workspacePath);
    const displayName = path.basename(itemRoot, isDir ? '' : '.md');

    const detail =
      scope === 'project'
        ? 'This file is part of your project. Teammates who pull this branch will lose access to it.\n\nThe file will be moved to your OS trash and can be restored from there.'
        : 'The file will be moved to your OS trash and can be restored from there.';

    const choice = await vscode.window.showWarningMessage(
      `Delete "${displayName}"?`,
      { modal: true, detail },
      'Delete'
    );
    if (choice !== 'Delete') return;

    try {
      await vscode.workspace.fs.delete(vscode.Uri.file(itemRoot), {
        useTrash: true,
        recursive: true,
      });
      this.refresh();
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to delete: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async _moveScope(filePath: string) {
    if (!fs.existsSync(filePath)) return;

    const itemRoot = getItemRoot(filePath);
    const isDir = isSkillItem(filePath);
    const currentScope = detectScope(itemRoot, this._workspacePath);
    const targetScope: ItemScope = currentScope === 'project' ? 'user' : 'project';

    const targetClaudeRoot = getClaudeRoot(targetScope, this._workspacePath);
    if (!targetClaudeRoot) {
      vscode.window.showWarningMessage(
        'Cannot move to project scope: no folder is open.'
      );
      return;
    }

    // Same subdir (skills/ or agents/) on the other side.
    const subdir = path.basename(path.dirname(isDir ? itemRoot : path.dirname(itemRoot)));
    // For agents, parent is .claude/agents; for skills, parent of dir is .claude/skills.
    const realSubdir = isDir
      ? path.basename(path.dirname(itemRoot))
      : path.basename(path.dirname(itemRoot));
    const _ = subdir; // silence unused
    void _;
    const targetParent = path.join(targetClaudeRoot, realSubdir);
    fs.mkdirSync(targetParent, { recursive: true });

    const itemBaseName = path.basename(itemRoot);
    const targetPath = path.join(targetParent, itemBaseName);

    if (fs.existsSync(targetPath)) {
      const overwrite = await vscode.window.showWarningMessage(
        `A "${itemBaseName}" already exists in ${targetScope} scope. Overwrite?`,
        { modal: true },
        'Overwrite'
      );
      if (overwrite !== 'Overwrite') return;
      // Delete existing target via OS trash before move
      try {
        await vscode.workspace.fs.delete(vscode.Uri.file(targetPath), {
          useTrash: true,
          recursive: true,
        });
      } catch {
        // proceed; rename will fail if it can't replace
      }
    }

    try {
      await vscode.workspace.fs.rename(
        vscode.Uri.file(itemRoot),
        vscode.Uri.file(targetPath),
        { overwrite: false }
      );
      this.refresh();
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to move: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private _getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    // The kit's icons, from the Phosphor font the extension ships for the product icons
    const phosphorUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'producticons', 'Phosphor-Regular.woff2'));
    const fontLatin = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'fonts', 'SofiaSans-latin.woff2'));
    const fontLatinExt = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'fonts', 'SofiaSans-latin-ext.woff2'));
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <style>
    /* === Ritemark 2.0 (experience 31): the Agents place in the column's list language; colours from the theme === */
    @font-face { font-family: 'Phosphor'; src: url('${phosphorUri}') format('woff2'); font-display: block; }
    /* Brand font: Ritemark UI is Sofia Sans, never the system stack */
    @font-face {
      font-family: 'Sofia Sans'; font-style: normal; font-weight: 100 900; font-display: swap;
      src: url('${fontLatinExt}') format('woff2');
      unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
    }
    @font-face {
      font-family: 'Sofia Sans'; font-style: normal; font-weight: 100 900; font-display: swap;
      src: url('${fontLatin}') format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    :root {
      --r-accent: var(--vscode-focusBorder, #4338CA);
      --r-accent-hover: var(--vscode-button-hoverBackground, #3730A3);
      --r-accent-soft: var(--vscode-ritemark-placeActiveBackground, rgba(67, 56, 202, 0.10));
      --r-accent-shadow: 0 4px 6px -1px rgba(67, 56, 202, 0.25);
      --r-surface: var(--vscode-sideBar-background, #F1F5F9);
      --r-surface-muted: var(--vscode-ritemark-aiSheet, #F8FAFC);
      --r-surface-soft: var(--vscode-toolbar-hoverBackground, rgba(148, 163, 184, 0.12));
      --r-desk: var(--vscode-ritemark-desk, #FFFFFF);
      --r-hairline: var(--vscode-ritemark-sheetBorder, #E2E8F0);
      --r-hairline-strong: var(--vscode-input-border, #CBD5E1);
      --r-ink-strong: var(--vscode-foreground, #1E1B4B);
      --r-ink-body: var(--vscode-tab-inactiveForeground, #475569);
      --r-ink-muted: var(--vscode-descriptionForeground, #617187);
      --r-ink-faint: var(--vscode-descriptionForeground, #617187);
      --r-hover: var(--vscode-toolbar-hoverBackground, rgba(148, 163, 184, 0.12));
      --r-warn: var(--vscode-editorWarning-foreground, #B45309);
      --r-radius-component: 10px;
      --r-radius-input: 8px;
      --r-danger: var(--vscode-errorForeground, #B91C1C);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Sofia Sans', var(--vscode-font-family);
      font-size: 13px;
      color: var(--r-ink-body);
      background: var(--r-surface);
      overflow-x: hidden;
      padding-bottom: 16px;
    }
    .ph { font-family: 'Phosphor'; font-style: normal; font-weight: normal; line-height: 1; }

    /* === Search: shown by Search at the column's head, or while it filters === */
    .search-container {
      padding: 0 8px 8px 8px;
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .search-container.hidden { display: none; }
    .search-input-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      height: 28px;
      padding: 0 10px;
      background: var(--r-desk);
      box-shadow: inset 0 0 0 1px var(--r-hairline-strong);
      border-radius: var(--r-radius-input);
    }
    .search-input-wrapper:focus-within { box-shadow: inset 0 0 0 1px var(--r-accent); }
    .search-input {
      flex: 1; padding: 0; font-size: 12px;
      font-family: inherit;
      color: var(--r-ink-strong);
      background: transparent; border: none; outline: none;
    }
    .search-input::placeholder { color: var(--r-ink-muted); }
    .search-icon { flex-shrink: 0; font-size: 12px; color: var(--r-ink-muted); }
    .sort-btn {
      flex-shrink: 0;
      width: 28px; height: 28px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--r-desk);
      border: none;
      box-shadow: inset 0 0 0 1px var(--r-hairline-strong);
      border-radius: var(--r-radius-input);
      color: var(--r-ink-muted);
      cursor: pointer;
      padding: 0;
    }
    .sort-btn:hover, .sort-btn.open { color: var(--r-ink-strong); background: var(--r-hover); }
    .sort-btn svg { width: 13px; height: 13px; }

    /* === This project and All projects: a two-part switch (kit: theme.html .seg) === */
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 2px;
      margin: 0 0 0 16px; /* the column's head ends 8 under Search, so the switch sits at 208 (theme.html .seg) */
      border-radius: 8px;
      background: var(--r-hairline);
    }
    .seg-item {
      height: 24px;
      padding: 0 10px;
      border-radius: 6px;
      font-size: 12px; font-weight: 500; line-height: 24px;
      color: var(--r-ink-body);
      cursor: pointer;
      user-select: none;
    }
    .seg-item.on {
      background: var(--r-desk);
      color: var(--r-ink-strong);
      box-shadow: 0 1px 2px var(--vscode-ritemark-sheetShadow, rgba(30, 27, 75, 0.08));
    }

    /* === The library's sections, as the column's groups (kit: theme.html .g2) === */
    .group {
      display: flex; align-items: center; gap: 6px;
      margin: 16px 0 8px 16px;
      font-size: 11px; font-weight: 600; line-height: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--r-ink-strong);
      user-select: none;
    }
    .group .count { font-weight: 500; color: var(--r-ink-muted); }

    /* === Rows: 32 high, as the documents tree's (kit: ritemark.css .row) === */
    .item {
      position: relative;
      display: flex; align-items: center; gap: 8px;
      height: 32px;
      margin: 0 8px;
      padding: 0 8px;
      border-radius: 4px;
      cursor: pointer;
      color: var(--r-ink-body);
    }
    .item:hover { background: var(--r-hover); }
    .item.open { background: var(--r-desk); }
    .item.open .row-label { color: var(--r-ink-strong); font-weight: 500; }
    .item.open .row-icon { color: var(--r-accent); }
    .row-icon { flex: none; width: 14px; font-size: 14px; color: var(--r-ink-muted); }
    .row-label {
      flex: 1 1 auto; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: 13px; line-height: 32px;
    }
    .row-ext { color: var(--r-ink-muted); }
    .item.open .row-ext { color: var(--r-ink-muted); font-weight: 400; }
    .row-meta { flex: none; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; line-height: 32px; color: var(--r-ink-muted); padding-right: 2px; }
    .row-meta.failed { color: var(--r-ink-body); }
    .row-meta .ph { font-size: 14px; }
    .row-meta svg { width: 12px; height: 12px; }
    .row-meta.warn, .row-warn { color: var(--r-warn); }
    .row-meta.warn { cursor: pointer; }
    .row-warn { flex: none; font-size: 14px; }
    .item-more-btn {
      position: absolute;
      right: 4px; top: 5px;
      width: 22px; height: 22px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 4px;
      background: var(--r-desk);
      border: none;
      padding: 0;
      cursor: pointer;
      color: var(--r-ink-muted);
      opacity: 0;
    }
    /* a row with a warning keeps it in sight: the ⋯ sits just before it */
    .item.has-warn .item-more-btn { right: 26px; }
    .item:hover .item-more-btn,
    .item-more-btn.menu-open,
    .item-more-btn:focus-visible { opacity: 1; }
    .item-more-btn:hover,
    .item-more-btn.menu-open { color: var(--r-ink-strong); }
    .item-more-btn:focus-visible { outline: 1px solid var(--r-accent); }
    .item-more-btn svg { width: 14px; height: 14px; display: block; }

    /* === Scheduled runs: the folder's permission, then the runs === */
    .consent-row {
      display: flex; align-items: center; gap: 8px;
      margin: 0 8px 4px; padding: 6px 8px;
      border-radius: 6px;
      background: var(--r-hover);
    }
    .consent-label { font-size: 12px; line-height: 16px; color: var(--r-ink-body); flex: 1; min-width: 0; }
    /* kit: .btn.quiet, body ink with no fill until hovered */
    .consent-btn {
      flex-shrink: 0; height: 24px; padding: 0 8px;
      border: 0; border-radius: 6px;
      font-family: inherit; font-size: 12px; font-weight: 500; line-height: 24px;
      cursor: pointer;
      background: transparent; color: var(--r-ink-body);
    }
    .consent-btn:hover { background: var(--r-hover); color: var(--r-ink-strong); }
    .run-spin { animation: sched-spin 1.1s linear infinite; display: inline-block; }
    @keyframes sched-spin { to { transform: rotate(360deg); } }

    /* === Empty state === */
    /* experience 31: an empty list is one line in muted ink */
    .empty-state {
      padding: 12px 8px;
      font-size: 13px; line-height: 20px;
      color: var(--r-ink-muted);
    }

    /* === Buttons === */
    .btn {
      height: 30px; padding: 0 14px;
      font-family: inherit;
      font-size: 12px; font-weight: 500;
      border-radius: var(--r-radius-input);
      cursor: pointer;
      border: 1px solid transparent;
      display: inline-flex; align-items: center; gap: 4px;
      user-select: none;
    }
    .btn-primary {
      /* the theme's button colours: white on indigo in Light, ink on the lighter indigo in Dark (kit: .dark .btn.primary) */
      background: var(--vscode-button-background, var(--r-accent)); color: var(--vscode-button-foreground, #FFFFFF);
      border-color: var(--vscode-button-background, var(--r-accent));
      box-shadow: var(--r-accent-shadow);
    }
    body.vscode-dark .btn-primary { box-shadow: none; }
    .btn-primary:hover:not(:disabled) { background: var(--r-accent-hover); border-color: var(--r-accent-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
    .btn-secondary {
      background: transparent; color: var(--r-ink-strong);
      border-color: var(--r-hairline-strong);
    }
    .btn-secondary:hover { background: var(--r-surface-muted); }
    .btn svg { width: 11px; height: 11px; }

    /* === Modal === */
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(30, 27, 75, 0.45);
      display: none;
      align-items: center; justify-content: center;
      z-index: 1000;
    }
    .modal-backdrop.open { display: flex; }
    .modal {
      width: min(360px, calc(100vw - 24px));
      background: var(--r-surface);
      border: 1px solid var(--r-hairline);
      border-radius: var(--r-radius-component);
      padding: 20px;
      box-shadow: 0 20px 40px -10px rgba(30, 27, 75, 0.3);
    }
    .modal-title {
      font-size: 14px; font-weight: 600;
      color: var(--r-ink-strong);
      margin-bottom: 16px;
    }
    .modal-field { margin-bottom: 14px; }
    .modal-field-label {
      display: block;
      font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--r-ink-muted);
      margin-bottom: 6px;
    }
    .modal-input {
      width: 100%; height: 34px;
      padding: 0 10px;
      font-family: inherit;
      font-size: 13px;
      color: var(--r-ink-strong);
      background: var(--r-surface);
      border: 1px solid var(--r-hairline-strong);
      border-radius: var(--r-radius-input);
      outline: none;
    }
    .modal-input:focus {
      border-color: var(--r-accent);
      box-shadow: 0 0 0 3px var(--r-accent-soft);
    }
    .scope-toggle {
      display: flex;
      background: var(--r-surface-muted);
      border: 1px solid var(--r-hairline);
      border-radius: var(--r-radius-input);
      padding: 2px; gap: 2px;
    }
    .scope-toggle-option {
      flex: 1; padding: 6px 8px;
      font-size: 12px; font-weight: 500;
      color: var(--r-ink-muted);
      text-align: center; cursor: pointer;
      border-radius: 4px;
      user-select: none;
    }
    .scope-toggle-option.active {
      background: var(--r-surface);
      color: var(--r-ink-strong);
      box-shadow: 0 1px 2px rgba(30, 27, 75, 0.08);
    }
    .modal-actions {
      display: flex; justify-content: flex-end; gap: 8px;
      margin-top: 20px;
    }

    /* === Context menu === */
    .context-menu {
      position: fixed;
      background: var(--r-surface);
      border: 1px solid var(--r-hairline);
      border-radius: var(--r-radius-component);
      box-shadow: 0 10px 30px -5px rgba(30, 27, 75, 0.25);
      padding: 4px;
      display: none;
      z-index: 100;
      min-width: 200px;
    }
    .context-menu.open { display: block; }
    .context-menu-item {
      padding: 6px 12px;
      font-size: 13px;
      color: var(--r-ink-strong);
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
    }
    .context-menu-item:hover { background: var(--r-accent-soft); color: var(--r-accent); }
    .context-menu-item.danger { color: var(--r-danger); }
    .context-menu-item.danger:hover { background: rgba(185, 28, 28, 0.08); color: var(--r-danger); }
    .context-menu-separator { height: 1px; background: var(--r-hairline); margin: 4px 0; }
  </style>
</head>
<body>
  <div class="search-container hidden" id="searchContainer">
    <div class="search-input-wrapper">
      <i class="ph search-icon" aria-hidden="true">&#xe30c;</i>
      <input type="text" class="search-input" id="search" placeholder="Search agents, skills and flows" />
    </div>
    <button class="sort-btn" id="sortBtn" title="Sort" aria-label="Sort">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="12" x2="13" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/></svg>
    </button>
  </div>
  <div class="seg" id="scopeTabs" role="tablist">
    <span class="seg-item on" role="tab" data-scope="project" id="tabProject">This project</span>
    <span class="seg-item" role="tab" data-scope="user" id="tabUser">All projects</span>
  </div>
  <div id="content"></div>

  <!-- Modal -->
  <div class="modal-backdrop" id="modalBackdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <h2 class="modal-title" id="modalTitle">New skill</h2>
      <div class="modal-field">
        <label class="modal-field-label" for="modalNameInput">Name</label>
        <input type="text" class="modal-input" id="modalNameInput" placeholder="e.g. Outline from notes" autocomplete="off" />
      </div>
      <div class="modal-field">
        <label class="modal-field-label">Scope</label>
        <div class="scope-toggle" id="modalScopeToggle">
          <div class="scope-toggle-option active" data-scope="project">This project</div>
          <div class="scope-toggle-option" data-scope="user">All projects</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modalCancelBtn" type="button">Cancel</button>
        <button class="btn btn-primary" id="modalCreateBtn" type="button" disabled>Create</button>
      </div>
    </div>
  </div>

  <!-- Context menu -->
  <div class="context-menu" id="contextMenu" role="menu"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    let agents = [];
    let skills = [];
    let commands = [];
    let flows = [];
    let scheduledRuns = [];
    let daemonConsent = null; // Sprint 107 R2: 'granted' | 'declined' | 'undecided' | null
    let workspacePath = '';
    let userHomePath = '';
    let selectedPath = null;
    let filter = '';
    let activeScope = 'project';
    let sortMode = 'name'; // 'name' | 'recent'

    // Modal state
    let modalType = 'skill';
    let modalScope = 'project';

    const contentEl = document.getElementById('content');
    const searchEl = document.getElementById('search');
    const tabProjectEl = document.getElementById('tabProject');
    const tabUserEl = document.getElementById('tabUser');
    const sortBtnEl = document.getElementById('sortBtn');
    const backdropEl = document.getElementById('modalBackdrop');
    const modalTitleEl = document.getElementById('modalTitle');
    const modalNameEl = document.getElementById('modalNameInput');
    const modalScopeToggleEl = document.getElementById('modalScopeToggle');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalCreateBtn = document.getElementById('modalCreateBtn');
    const contextMenuEl = document.getElementById('contextMenu');

    searchEl.addEventListener('input', (e) => {
      filter = e.target.value.toLowerCase();
      render();
    });

    // Search shows from Search at the column's head (or while it filters) and hides again with Escape
    const searchContainerEl = document.getElementById('searchContainer');
    function setSearchOpen(open) {
      searchContainerEl.classList.toggle('hidden', !open && !filter);
    }
    searchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchEl.value = '';
        filter = '';
        setSearchOpen(false);
        render();
      }
    });
    searchEl.addEventListener('blur', (e) => {
      if (!filter && !(e.relatedTarget && searchContainerEl.contains(e.relatedTarget))) setSearchOpen(false);
    });

    tabProjectEl.addEventListener('click', () => { activeScope = 'project'; render(); });
    tabUserEl.addEventListener('click', () => { activeScope = 'user'; render(); });

    // === Sort popover ===
    sortBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = sortBtnEl.getBoundingClientRect();
      showSortMenu(rect.left, rect.bottom + 4);
    });
    function showSortMenu(x, y) {
      const items = [
        { label: 'Name (A → Z)', mode: 'name' },
        { label: 'Recently modified', mode: 'recent' },
      ];
      contextMenuEl.innerHTML = '';
      for (const entry of items) {
        const el = document.createElement('div');
        el.className = 'context-menu-item' + (sortMode === entry.mode ? ' active' : '');
        el.setAttribute('role', 'menuitem');
        el.innerHTML = (sortMode === entry.mode ? '\\u2713 ' : '\\u00a0\\u00a0 ') + escapeHtml(entry.label);
        el.addEventListener('click', () => {
          sortMode = entry.mode;
          sortBtnEl.classList.remove('open');
          hideContextMenu();
          render();
        });
        contextMenuEl.appendChild(el);
      }
      contextMenuEl.style.left = x + 'px';
      contextMenuEl.style.top = y + 'px';
      contextMenuEl.classList.add('open');
      sortBtnEl.classList.add('open');
      requestAnimationFrame(() => {
        const rect = contextMenuEl.getBoundingClientRect();
        if (rect.right > window.innerWidth - 4) {
          contextMenuEl.style.left = Math.max(4, window.innerWidth - rect.width - 4) + 'px';
        }
      });
    }

    // Sprint 107 R2: consent toggle clicks (delegated — rows re-render often).
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('.consent-btn') : null;
      if (!btn) return;
      vscode.postMessage({ type: 'setDaemonConsent', state: btn.getAttribute('data-consent') });
    });

    // === Modal handlers ===
    function openModal(type) {
      modalType = type;
      modalScope = activeScope;
      modalTitleEl.textContent = type === 'skill' ? 'New skill' : type === 'command' ? 'New command' : 'New agent';
      modalNameEl.value = '';
      modalCreateBtn.disabled = true;
      modalScopeToggleEl.querySelectorAll('.scope-toggle-option').forEach((el) => {
        el.classList.toggle('active', el.dataset.scope === modalScope);
      });
      backdropEl.classList.add('open');
      setTimeout(() => modalNameEl.focus(), 30);
    }
    function closeModal() {
      backdropEl.classList.remove('open');
    }
    modalCancelBtn.addEventListener('click', closeModal);
    backdropEl.addEventListener('click', (e) => {
      if (e.target === backdropEl) closeModal();
    });
    modalNameEl.addEventListener('input', (e) => {
      modalCreateBtn.disabled = !e.target.value.trim();
    });
    modalNameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !modalCreateBtn.disabled) submitModal();
      if (e.key === 'Escape') closeModal();
    });
    modalScopeToggleEl.addEventListener('click', (e) => {
      const target = e.target.closest('.scope-toggle-option');
      if (!target) return;
      modalScope = target.dataset.scope;
      modalScopeToggleEl.querySelectorAll('.scope-toggle-option').forEach((el) => {
        el.classList.toggle('active', el === target);
      });
    });
    modalCreateBtn.addEventListener('click', submitModal);
    function submitModal() {
      const name = modalNameEl.value.trim();
      if (!name) return;
      vscode.postMessage({
        type: 'createHelper',
        payload: { type: modalType, scope: modalScope, name }
      });
      closeModal();
    }

    // === Context menu ===
    function showContextMenu(x, y, item, alignRightX) {
      const isMainAgent = !!item.isMainAgent;
      const itemScope = item.scope;
      const moveLabel = itemScope === 'project' ? 'Move to All projects' : 'Move to This project';

      const items = [];
      if (item.source === undefined) {
        items.push({ label: 'Launch Chat', action: () => vscode.postMessage({ type: 'launchChat', agentId: item.id, filePath: item.filePath }) });
      }
      items.push({ label: 'Open', action: () => vscode.postMessage({ type: 'openFile', filePath: item.filePath }) });
      if (!isMainAgent) {
        items.push({ label: 'Duplicate', action: () => vscode.postMessage({ type: 'duplicateHelper', filePath: item.filePath }) });
      }
      items.push({ label: 'Reveal in Finder', action: () => vscode.postMessage({ type: 'revealInFinder', filePath: item.filePath }) });
      items.push({ label: moveLabel, action: () => vscode.postMessage({ type: 'moveScope', filePath: item.filePath }) });
      if (!isMainAgent) {
        items.push({ separator: true });
        items.push({ label: 'Delete…', danger: true, action: () => vscode.postMessage({ type: 'deleteHelper', filePath: item.filePath }) });
      }

      contextMenuEl.innerHTML = '';
      for (const entry of items) {
        if (entry.separator) {
          const sep = document.createElement('div');
          sep.className = 'context-menu-separator';
          contextMenuEl.appendChild(sep);
        } else {
          const el = document.createElement('div');
          el.className = 'context-menu-item' + (entry.danger ? ' danger' : '');
          el.setAttribute('role', 'menuitem');
          el.textContent = entry.label;
          el.addEventListener('click', () => {
            entry.action();
            hideContextMenu();
          });
          contextMenuEl.appendChild(el);
        }
      }

      contextMenuEl.style.left = x + 'px';
      contextMenuEl.style.top = y + 'px';
      contextMenuEl.classList.add('open');

      // Adjust if it would overflow viewport, or right-align to a given anchor
      requestAnimationFrame(() => {
        const rect = contextMenuEl.getBoundingClientRect();
        if (typeof alignRightX === 'number') {
          contextMenuEl.style.left = Math.max(4, alignRightX - rect.width) + 'px';
        } else if (rect.right > window.innerWidth - 4) {
          contextMenuEl.style.left = Math.max(4, window.innerWidth - rect.width - 4) + 'px';
        }
        if (rect.bottom > window.innerHeight - 4) {
          contextMenuEl.style.top = Math.max(4, window.innerHeight - rect.height - 4) + 'px';
        }
      });
    }
    function hideContextMenu() {
      contextMenuEl.classList.remove('open');
      sortBtnEl.classList.remove('open');
    }
    document.addEventListener('click', (e) => {
      if (!contextMenuEl.contains(e.target)) hideContextMenu();
    });
    document.addEventListener('contextmenu', (e) => {
      // Suppress default browser context menu outside of our handler
      if (!e.target.closest('.item')) {
        e.preventDefault();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { hideContextMenu(); closeModal(); }
    });
    window.addEventListener('blur', hideContextMenu);

    // === Discovery messages ===
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'items') {
        agents = msg.agents || [];
        skills = msg.skills || [];
        commands = msg.commands || [];
        flows = msg.flows || [];
        scheduledRuns = msg.scheduledRuns || [];
        daemonConsent = msg.daemonConsent ?? null;
        workspacePath = msg.workspacePath || '';
        userHomePath = msg.userHomePath || '';
        render();
      } else if (msg.type === 'openCreate') {
        // New at the column's head (Ritemark 2.0, experience 31)
        openModal(msg.kind);
      } else if (msg.type === 'focusSearch') {
        setSearchOpen(true);
        searchEl.focus();
        searchEl.select();
      } else if (msg.type === 'revealScheduled') {
        // Triggered by the daemon's toast buttons / status-bar item.
        render();
        requestAnimationFrame(() => {
          const row = msg.runId
            ? contentEl.querySelector('.sched-item[data-run="' + msg.runId + '"]')
            : null;
          const target = row || contentEl.querySelector('[data-group="Scheduled"]');
          if (target) target.scrollIntoView({ block: 'center' });
          if (row) {
            row.style.outline = '2px solid var(--vscode-focusBorder)';
            row.style.outlineOffset = '1px';
            row.style.borderRadius = '6px';
            setTimeout(() => { row.style.outline = ''; row.style.outlineOffset = ''; }, 1600);
          }
        });
      }
    });

    function displayPath(item) {
      const absPath = item.filePath || '';
      if (item.scope === 'project' && workspacePath && absPath.startsWith(workspacePath)) {
        const rel = absPath.slice(workspacePath.length);
        return rel.startsWith('/') ? rel.slice(1) : rel;
      }
      if (item.scope === 'user' && userHomePath && absPath.startsWith(userHomePath)) {
        return '~' + absPath.slice(userHomePath.length);
      }
      return absPath;
    }

    function byScope(item) { return item.scope === activeScope; }

    function applySort(items) {
      const sorted = items.slice();
      if (sortMode === 'recent') {
        sorted.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
      } else {
        sorted.sort((a, b) => a.name.localeCompare(b.name));
      }
      return sorted;
    }

    function matches(item) {
      if (!filter) return true;
      const rel = displayPath(item);
      const desc = (item.description || '').toLowerCase();
      return (
        item.name.toLowerCase().includes(filter) ||
        item.id.toLowerCase().includes(filter) ||
        rel.toLowerCase().includes(filter) ||
        desc.includes(filter)
      );
    }

    function render() {
      tabProjectEl.className = 'seg-item' + (activeScope === 'project' ? ' on' : '');
      tabUserEl.className = 'seg-item' + (activeScope === 'user' ? ' on' : '');
      tabProjectEl.setAttribute('aria-selected', String(activeScope === 'project'));
      tabUserEl.setAttribute('aria-selected', String(activeScope === 'user'));

      const scopedAgents = agents.filter(byScope);
      const scopedSkills = skills.filter(byScope);
      const scopedCommands = commands.filter(byScope);
      // Flows are workspace-level only (no user-scope flows)
      const filteredAgents = applySort(scopedAgents.filter(matches));
      const filteredSkills = applySort(scopedSkills.filter(matches));
      const filteredCommands = applySort(scopedCommands.filter(matches));
      const filteredFlows = flows.filter((f) => !filter || f.name.toLowerCase().includes(filter));

      const scopeTotal = scopedAgents.length + scopedSkills.length + scopedCommands.length + flows.length + scheduledRuns.length;
      if (scopeTotal === 0) {
        renderEmptyState();
        return;
      }

      let html = '';
      // CLAUDE.md / AGENTS.md are instruction files (no frontmatter, not agents) — own section.
      const instructionDocs = filteredAgents.filter((a) => a.isMainAgent);
      const subAgents = filteredAgents.filter((a) => !a.isMainAgent);
      if (instructionDocs.length > 0) {
        html += renderSection('Instructions', 'instructions', instructionDocs);
      }
      if (subAgents.length > 0) {
        html += renderSection('Agents', 'agent', subAgents);
      }
      if (filteredSkills.length > 0) {
        html += renderSection('Skills', 'skill', filteredSkills);
      }
      if (filteredCommands.length > 0) {
        html += renderSection('Commands', 'command', filteredCommands);
      }
      const filteredRuns = scheduledRuns.filter((r) => !filter || (r.taskId || '').toLowerCase().includes(filter));
      if (filteredRuns.length > 0) {
        html += renderScheduledSection(filteredRuns);
      }
      if (filteredFlows.length > 0) {
        html += renderFlowsSection(filteredFlows);
      }

      if (!html && filter) {
        html = '<div class="empty-state">No matches for \u201c' + escapeHtml(filter) + '\u201d</div>';
      }

      contentEl.innerHTML = html;
      wireRowHandlers();
      wireScheduledHandlers();
    }

    function wireScheduledHandlers() {
      contentEl.querySelectorAll('.sched-approve').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const taskId = el.dataset.task;
          const runId = el.dataset.run;
          if (!taskId || !runId) return;
          vscode.postMessage({ type: 'approveScheduledRun', taskId, runId });
        });
      });
    }

    // The kit's icons (Phosphor), by kind of row
    const ICON = { instructions: '&#xe23a;', agent: '&#xe762;', skill: '&#xe6a2;', command: '&#xe1c4;', scheduled: '&#xe19a;', flow: '&#xe6ec;', warning: '&#xe4e0;', warningCircle: '&#xe4e2;' };

    function moreButton() {
      return '<button class="item-more-btn" data-more="1" title="More actions" aria-label="More actions">' +
        '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">' +
        '<circle cx="64" cy="128" r="12" /><circle cx="128" cy="128" r="12" /><circle cx="192" cy="128" r="12" />' +
        '</svg></button>';
    }

    function groupHtml(title, count) {
      return '<div class="group" data-group="' + escapeHtml(title) + '" role="heading" aria-level="2">' + escapeHtml(title) + '<span class="count">' + count + '</span></div>';
    }

    // A row (kit: ritemark.css .row): the kind's icon, the name, then what it needs to say at the right
    function rowHtml(row) {
      let html = '<div class="item' + (row.open ? ' open' : '') + (row.warn ? ' has-warn' : '') + (row.extraClass ? ' ' + row.extraClass : '') + '"' + (row.attrs || '') + ' title="' + escapeHtml(row.title) + '">';
      html += '<i class="ph row-icon" aria-hidden="true">' + row.icon + '</i>';
      html += '<span class="row-label">' + labelHtml(row.label) + '</span>';
      if (row.warn) html += '<i class="ph row-warn" role="img" aria-label="' + escapeHtml(row.warn) + '">' + ICON.warning + '</i>';
      if (row.meta || row.metaHtml) html += '<span class="row-meta' + (row.metaClass ? ' ' + row.metaClass : '') + '"' + (row.metaAttrs || '') + '>' + (row.metaHtml || escapeHtml(row.meta)) + '</span>';
      if (row.more) html += moreButton();
      return html + '</div>';
    }

    // The name in the row's ink, its extension in muted ink (experience 31)
    function labelHtml(label) {
      const m = /^(.+?)(\\.flow\\.json|\\.[^.\\s]+)$/i.exec(label || '');
      return m ? escapeHtml(m[1]) + '<span class="row-ext">' + escapeHtml(m[2]) + '</span>' : escapeHtml(label);
    }

    // Files show their extension (framework.md); a skill is a folder and shows its folder's name
    function fileLabel(filePath) {
      const parts = (filePath || '').split(/[\\\\/]/);
      const base = parts.pop() || '';
      return /^SKILL\\.md$/i.test(base) ? (parts.pop() || base) : base;
    }

    // What used to be on the row's second line is in its tooltip: where it lives, its description, who it is for
    function itemTooltip(item, extra) {
      const lines = [displayPath(item)];
      const desc = (item.description || '').trim();
      if (desc) lines.push(desc);
      // the badge's words (the Experience lead): For Claude, For ChatGPT, Shared
      if (item.provenance) lines.push(item.provenance === 'shared' ? 'Shared' : item.provenance === 'codex' ? 'For ChatGPT' : 'For Claude');
      if (extra) lines.push(extra);
      return lines.join('\\n');
    }

    function renderFlowsSection(items) {
      let html = groupHtml('Flows', items.length);
      for (const flow of items) {
        const used = flow.attachedAgents && flow.attachedAgents.length > 0 ? 'Used by ' + flow.attachedAgents.join(', ') : '';
        html += rowHtml({
          icon: ICON.flow, label: fileLabel(flow.filePath), open: flow.filePath === selectedPath, more: true,
          attrs: ' data-filepath="' + escapeHtml(flow.filePath) + '"',
          title: [flow.filePath, used].filter(Boolean).join('\\n'),
        });
      }
      return html;
    }

    function relativeTime(iso) {
      if (!iso) return '';
      const then = new Date(iso).getTime();
      if (isNaN(then)) return '';
      const diff = Date.now() - then;
      const min = Math.floor(diff / 60000);
      if (min < 1) return 'just now';
      if (min < 60) return min + ' min ago';
      const hr = Math.floor(min / 60);
      if (hr < 24) return hr + 'h ago';
      const day = Math.floor(hr / 24);
      return day === 1 ? 'yesterday' : day + 'd ago';
    }

    // Outcome → { chip background token, chip text, foreground colour, icon SVG }
    function scheduledOutcomeMeta(outcome) {
      switch (outcome) {
        case 'completed':
          return { cls: 'ok', label: 'Completed', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>' };
        case 'blocked':
          return { cls: 'warn', label: 'Blocked', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' };
        case 'errored':
          return { cls: 'err', label: 'Errored', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 9v4M12 17h.01"/></svg>' };
        case 'missed':
          return { cls: 'muted', label: 'Missed', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' };
        case 'skipped':
          return { cls: 'muted', label: 'Skipped', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>' };
        default:
          return { cls: 'run', label: 'In progress', icon: '<svg class="run-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.5" stroke-linecap="round"/></svg>' };
      }
    }

    function renderScheduledSection(items) {
      const visible = items.filter((run) => !run.supersededBy);
      let html = groupHtml('Scheduled', visible.length);
      // Sprint 107 R2: consent status + toggle — schedule-triggered runs fire
      // without a user gesture, so the workspace opt-in is always visible and
      // reversible here.
      if (daemonConsent) {
        const on = daemonConsent === 'granted';
        html += '<div class="consent-row">';
        html += '<span class="consent-label">' + (on
          ? 'Scheduled agents may run automatically in this folder.'
          : (daemonConsent === 'declined'
            ? 'Scheduled agents are paused in this folder.'
            : 'Scheduled agents need your permission to run in this folder.')) + '</span>';
        html += '<button class="consent-btn" data-consent="' + (on ? 'declined' : 'granted') + '">'
          + (on ? 'Pause' : 'Allow') + '</button>';
        html += '</div>';
      }
      for (const run of visible) {
        const meta = scheduledOutcomeMeta(run.outcome);
        const label = run.taskId || 'Scheduled run';
        const desc = run.outcome === 'blocked' && run.blockedAction
          ? 'Wanted to ' + (run.blockedAction.kind === 'file-write' ? 'write ' : 'run ') + run.blockedAction.target
          : (run.outputFirstLine || run.errorMessage || run.skipReason || '');
        const dur = run.durationMs ? ' (' + (run.durationMs / 1000).toFixed(1) + 's)' : '';
        const blocked = run.outcome === 'blocked';
        const runAttrs = ' data-task="' + escapeHtml(label) + '" data-run="' + escapeHtml(run.runId || '') + '"';
        // experience 31: the run's time when done, a spinner while it runs, "Approval needed" in amber (it opens
        // the review), "Failed" in body ink with a warning; the details in the tooltip
        const running = meta.cls === 'run';
        const failed = run.outcome === 'errored';
        html += rowHtml({
          icon: ICON.scheduled, label, extraClass: 'sched-item', attrs: runAttrs,
          meta: blocked ? 'Approval needed' : failed ? '' : relativeTime(run.startedAt),
          metaHtml: running ? meta.icon : failed ? '<i class="ph" aria-hidden="true">' + ICON.warningCircle + '</i>Failed' : '',
          metaClass: blocked ? 'warn sched-approve' : failed ? 'failed' : '',
          metaAttrs: blocked ? runAttrs : '',
          title: [meta.label + dur, desc].filter(Boolean).join('\\n'),
        });
      }
      return html;
    }

    // experience 31: an empty list is one line in muted ink; New in the head makes every kind
    function renderEmptyState() {
      contentEl.innerHTML = '<div class="empty-state">' + (activeScope === 'project'
        ? 'Agents, skills, commands and flows for this project live here. New makes one.'
        : 'Agents, skills and commands for all your projects live here. New makes one.') + '</div>';
    }

    function renderSection(title, kind, items) {
      let html = groupHtml(title, items.length);
      for (const item of items) {
        const main = !!item.isMainAgent;
        // validateAgentFrontmatter only applies to agents (have isMainAgent property)
        const isAgent = 'isMainAgent' in item;
        const errors = (isAgent && !main) ? (item.validationErrors || []) : [];
        const warn = errors[0] || (isAgent && !main && !item.hasFrontmatter ? 'Add a description in its frontmatter' : '');
        html += rowHtml({
          icon: ICON[kind], label: fileLabel(item.filePath), open: item.filePath === selectedPath, more: true,
          attrs: ' data-filepath="' + escapeHtml(item.filePath) + '"',
          title: itemTooltip(item, main ? 'Instructions loaded into every session' : warn), warn,
        });
      }
      return html;
    }

    function findItemByFilePath(fp) {
      return (
        agents.find((i) => i.filePath === fp) ||
        skills.find((i) => i.filePath === fp) ||
        commands.find((i) => i.filePath === fp) ||
        null
      );
    }

    function wireRowHandlers() {
      contentEl.querySelectorAll('.item').forEach((el) => {
        el.addEventListener('click', (e) => {
          if (e.target && e.target.closest && e.target.closest('.item-more-btn')) return;
          const fp = el.dataset.filepath;
          if (!fp) return;
          selectedPath = fp;
          render();
          vscode.postMessage({ type: 'openFile', filePath: fp });
        });
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const fp = el.dataset.filepath;
          if (!fp) return;
          const item = findItemByFilePath(fp);
          if (!item) return;
          showContextMenu(e.clientX, e.clientY, item);
        });
        const moreBtn = el.querySelector('.item-more-btn');
        if (moreBtn) {
          moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const fp = el.dataset.filepath;
            if (!fp) return;
            const item = findItemByFilePath(fp);
            if (!item) return;
            const rect = moreBtn.getBoundingClientRect();
            showContextMenu(rect.right, rect.bottom + 2, item, rect.right);
          });
        }
      });
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
