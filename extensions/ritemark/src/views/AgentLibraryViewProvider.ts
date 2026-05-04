import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { discoverAgents, discoverCommands } from '../agent/discovery';
import type { DiscoveredAgent, DiscoveredCommand, ItemScope } from '../agent/discovery';
import { COLORS, ICONS } from '../agent/iconPack';

type HelperType = 'skill' | 'agent';

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
  private _refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspacePath: string | undefined
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

    this._discover();
    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'ready':
          this._sendItems();
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
      }
    });
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

  private _discover() {
    this._agents = discoverAgents(this._workspacePath);
    this._commands = discoverCommands(this._workspacePath);
  }

  private _sendItems() {
    const skills = this._commands.filter((c) => c.source === 'skills');
    const commands = this._commands.filter((c) => c.source === 'commands');
    this._view?.webview.postMessage({
      type: 'items',
      agents: this._agents,
      skills,
      commands,
      workspacePath: this._workspacePath || '',
      userHomePath: os.homedir(),
    });
  }

  private _openFile(filePath: string) {
    const uri = vscode.Uri.file(filePath);
    vscode.commands.executeCommand('vscode.open', uri);
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

    const subdir = type === 'skill' ? 'skills' : 'agents';
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
      fs.writeFileSync(filePath, agentSkeleton(trimmed), 'utf8');
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
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    /* === Ritemark design tokens (Indigo-Editorial) === */
    :root {
      --r-accent: #4338CA;
      --r-accent-hover: #3730A3;
      --r-accent-soft: rgba(67, 56, 202, 0.10);
      --r-accent-shadow: 0 4px 6px -1px rgba(67, 56, 202, 0.25);
      --r-surface: var(--vscode-sideBar-background, #FFFFFF);
      --r-surface-muted: rgba(241, 245, 249, 0.6);
      --r-hairline: rgba(148, 163, 184, 0.2);
      --r-hairline-strong: rgba(148, 163, 184, 0.4);
      --r-ink-strong: var(--vscode-foreground, #1E1B4B);
      --r-ink-muted: var(--vscode-descriptionForeground, #64748B);
      --r-ink-faint: rgba(100, 116, 139, 0.65);
      --r-radius-component: 10px;
      --r-radius-input: 6px;
      --r-danger: #B91C1C;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--r-ink-strong);
      background: var(--r-surface);
      overflow-x: hidden;
    }

    /* === Header === */
    .header-counts {
      padding: 0 14px 8px 20px;
      font-size: 11px;
      color: var(--r-ink-muted);
    }
    .search-container {
      padding: 0 10px 8px 10px;
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .search-input-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: var(--r-radius-input);
    }
    .sort-btn {
      flex-shrink: 0;
      width: 28px; height: 28px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent;
      border: 1px solid var(--r-hairline-strong);
      border-radius: var(--r-radius-input);
      color: var(--r-ink-muted);
      cursor: pointer;
      padding: 0;
      transition: color 0.1s, border-color 0.1s, background 0.1s;
    }
    .sort-btn:hover { color: var(--r-accent); border-color: var(--r-accent); background: var(--r-accent-soft); }
    .sort-btn.open { color: var(--r-accent); border-color: var(--r-accent); background: var(--r-accent-soft); }
    .sort-btn svg { width: 13px; height: 13px; }
    .search-input-wrapper:focus-within {
      border-color: var(--r-accent);
      box-shadow: 0 0 0 3px var(--r-accent-soft);
    }
    .search-input {
      flex: 1; padding: 0; font-size: 12px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-input-foreground);
      background: transparent; border: none; outline: none;
    }
    .search-input::placeholder { color: var(--vscode-input-placeholderForeground); }
    .search-icon {
      flex-shrink: 0; width: 12px; height: 12px;
      color: var(--r-ink-muted);
    }

    /* === Scope tabs === */
    .scope-tabs {
      display: flex;
      padding: 0 10px;
      border-bottom: 1px solid var(--r-hairline);
    }
    .scope-tab {
      flex: 1; padding: 6px 4px;
      font-size: 12px; font-weight: 500;
      text-align: center; cursor: pointer;
      color: var(--r-ink-muted);
      border-bottom: 2px solid transparent;
      transition: color 0.1s, border-color 0.1s;
      user-select: none;
    }
    .scope-tab:hover { color: var(--r-ink-strong); }
    .scope-tab.active {
      color: var(--r-ink-strong);
      border-bottom-color: var(--r-accent);
      font-weight: 600;
    }

    /* === Section headers (with + affordance) === */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 10px 4px 20px;
      font-size: 11px; font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--r-ink-muted);
      background: var(--r-surface-muted);
      user-select: none;
    }
    .section-header-meta { display: flex; align-items: center; gap: 8px; }
    .section-count { font-size: 11px; font-weight: 400; color: var(--r-ink-faint); }
    .section-add-btn {
      width: 18px; height: 18px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 4px; cursor: pointer; padding: 0;
      color: var(--r-ink-muted); background: transparent; border: none;
    }
    .section-add-btn:hover { background: var(--r-accent-soft); color: var(--r-accent); }
    .section-add-btn svg { width: 12px; height: 12px; }

    /* === List items === */
    .item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 8px 12px 8px 14px;
      cursor: pointer;
      border-left: 2px solid transparent;
      transition: background-color 0.1s;
    }
    .item:hover { background: var(--vscode-list-hoverBackground); }
    .item.selected {
      background: var(--r-accent-soft);
      border-left-color: var(--r-accent);
    }
    .item.selected .item-name { font-weight: 600; }
    .item-icon-chip {
      flex-shrink: 0;
      width: 32px; height: 32px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 8px;
      margin-top: 1px;
    }
    .item-icon-chip svg {
      width: 18px; height: 18px;
      display: block;
    }
    .item-content { flex: 1; min-width: 0; padding-top: 1px; }
    .item-name {
      font-size: 13px; font-weight: 500; line-height: 1.35;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .item-description {
      font-size: 11px; color: var(--r-ink-muted);
      line-height: 1.4;
      margin-top: 2px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-word;
    }
    .item-description.placeholder { font-style: italic; opacity: 0.65; }
    .item-icon {
      flex-shrink: 0; margin-left: 6px; margin-top: 6px;
      font-size: 11px; line-height: 1;
    }
    .item-icon.star { color: var(--r-accent); }
    .item-icon.warning { color: #F59E0B; cursor: help; }
    .item-more-btn {
      flex-shrink: 0;
      width: 22px; height: 22px;
      margin-left: 4px;
      margin-top: 4px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 4px;
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
      color: var(--r-ink-muted);
      opacity: 0;
      transition: opacity 0.1s, background-color 0.1s, color 0.1s;
    }
    .item:hover .item-more-btn,
    .item.selected .item-more-btn,
    .item-more-btn.menu-open { opacity: 1; }
    .item-more-btn:hover {
      background: var(--r-accent-soft);
      color: var(--r-accent);
    }
    .item-more-btn svg { width: 14px; height: 14px; display: block; }
    .item-hint {
      font-size: 10px; line-height: 1.3;
      color: #F59E0B; padding: 2px 0 0; opacity: 0.85;
    }

    /* === Empty state === */
    .empty-state {
      padding: 32px 16px 24px;
      text-align: center;
    }
    .empty-state-title {
      font-size: 13px; font-weight: 500;
      color: var(--r-ink-strong);
      margin-bottom: 16px;
    }
    .empty-state-actions {
      display: flex; gap: 8px;
      justify-content: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .empty-state-footnote {
      font-size: 11px;
      color: var(--r-ink-muted);
      line-height: 1.5;
    }
    .empty-state-footnote code {
      background: var(--r-surface-muted);
      border-radius: 3px;
      padding: 1px 4px;
      font-size: 10px;
    }

    /* === Buttons === */
    .btn {
      height: 30px; padding: 0 14px;
      font-family: var(--vscode-font-family);
      font-size: 12px; font-weight: 500;
      border-radius: var(--r-radius-input);
      cursor: pointer;
      border: 1px solid transparent;
      display: inline-flex; align-items: center; gap: 4px;
      user-select: none;
    }
    .btn-primary {
      background: var(--r-accent); color: #FFFFFF;
      border-color: var(--r-accent);
      box-shadow: var(--r-accent-shadow);
    }
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
      font-family: var(--vscode-font-family);
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
  <div class="header-counts" id="counts"></div>
  <div class="search-container">
    <div class="search-input-wrapper">
      <svg class="search-icon" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round"><circle cx="116" cy="116" r="84"/><line x1="175.4" y1="175.4" x2="224" y2="224"/></svg>
      <input type="text" class="search-input" id="search" placeholder="Search" />
    </div>
    <button class="sort-btn" id="sortBtn" title="Sort" aria-label="Sort">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="12" x2="13" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/></svg>
    </button>
  </div>
  <div class="scope-tabs" id="scopeTabs">
    <div class="scope-tab active" data-scope="project" id="tabProject">Project</div>
    <div class="scope-tab" data-scope="user" id="tabUser">User</div>
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
          <div class="scope-toggle-option active" data-scope="project">Project</div>
          <div class="scope-toggle-option" data-scope="user">User</div>
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

    const ICON_PATHS = ${JSON.stringify(ICONS)};
    const ICON_COLORS = ${JSON.stringify(COLORS)};
    const DEFAULT_ICON = 'sparkle';
    const DEFAULT_COLOR = 'indigo';

    function renderIconChip(iconName, colorName) {
      const path = ICON_PATHS[iconName] || ICON_PATHS[DEFAULT_ICON];
      const palette = ICON_COLORS[colorName] || ICON_COLORS[DEFAULT_COLOR];
      const style = 'background:' + palette.bg + ';color:' + palette.fg + ';';
      return '<span class="item-icon-chip" style="' + style + '" aria-hidden="true">' +
        '<svg viewBox="0 0 256 256">' +
        path +
        '</svg></span>';
    }

    let agents = [];
    let skills = [];
    let commands = [];
    let workspacePath = '';
    let userHomePath = '';
    let selectedPath = null;
    let filter = '';
    let activeScope = 'project';
    let sortMode = 'name'; // 'name' | 'recent'

    // Modal state
    let modalType = 'skill';
    let modalScope = 'project';

    const countsEl = document.getElementById('counts');
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

    // === Modal handlers ===
    function openModal(type) {
      modalType = type;
      modalScope = activeScope;
      modalTitleEl.textContent = type === 'skill' ? 'New skill' : 'New agent';
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
      const moveLabel = itemScope === 'project' ? 'Move to User scope' : 'Move to Project scope';

      const items = [];
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
        workspacePath = msg.workspacePath || '';
        userHomePath = msg.userHomePath || '';
        render();
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
      tabProjectEl.className = 'scope-tab' + (activeScope === 'project' ? ' active' : '');
      tabUserEl.className = 'scope-tab' + (activeScope === 'user' ? ' active' : '');

      const scopedAgents = agents.filter(byScope);
      const scopedSkills = skills.filter(byScope);
      const scopedCommands = commands.filter(byScope);
      const filteredAgents = applySort(scopedAgents.filter(matches));
      const filteredSkills = applySort(scopedSkills.filter(matches));
      const filteredCommands = applySort(scopedCommands.filter(matches));

      const parts = [];
      if (agents.length) parts.push(agents.length + ' agent' + (agents.length !== 1 ? 's' : ''));
      if (skills.length) parts.push(skills.length + ' skill' + (skills.length !== 1 ? 's' : ''));
      if (commands.length) parts.push(commands.length + ' command' + (commands.length !== 1 ? 's' : ''));
      countsEl.textContent = parts.join(' \\u00b7 ');

      const scopeTotal = scopedAgents.length + scopedSkills.length + scopedCommands.length;
      if (scopeTotal === 0) {
        renderEmptyState();
        return;
      }

      let html = '';
      if (filteredAgents.length > 0) {
        html += renderSection('Agents', 'agent', filteredAgents);
      }
      if (filteredSkills.length > 0) {
        html += renderSection('Skills', 'skill', filteredSkills);
      }
      if (filteredCommands.length > 0) {
        // Commands: display only, no + affordance (decision: deprecated upstream)
        html += renderSection('Commands', null, filteredCommands);
      }

      if (!html && filter) {
        html = '<div class="empty-state"><div class="empty-state-title">No matches for "' + escapeHtml(filter) + '"</div></div>';
      }

      contentEl.innerHTML = html;
      wireRowHandlers();
      wireSectionAddHandlers();
    }

    function renderEmptyState() {
      const pathHint = activeScope === 'project' ? '.claude/' : '~/.claude/';
      contentEl.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-title">No skills or agents yet</div>' +
          '<div class="empty-state-actions">' +
            '<button class="btn btn-primary" id="emptyNewSkillBtn">' + plusSvg() + 'New skill</button>' +
            '<button class="btn btn-primary" id="emptyNewAgentBtn">' + plusSvg() + 'New agent</button>' +
          '</div>' +
          '<div class="empty-state-footnote">Helpers live in <code>' + pathHint + '</code> — they\\u2019re just markdown files.</div>' +
        '</div>';
      const sBtn = document.getElementById('emptyNewSkillBtn');
      const aBtn = document.getElementById('emptyNewAgentBtn');
      if (sBtn) sBtn.addEventListener('click', () => openModal('skill'));
      if (aBtn) aBtn.addEventListener('click', () => openModal('agent'));
    }

    function plusSvg() {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    }

    function renderSection(title, addType, items) {
      let html = '<div class="section-header">';
      html += '<span>' + escapeHtml(title) + '</span>';
      html += '<div class="section-header-meta">';
      html += '<span class="section-count">' + items.length + '</span>';
      if (addType) {
        html += '<button class="section-add-btn" data-add-type="' + addType + '" title="New ' + addType + '" aria-label="New ' + addType + '">' + plusSvg() + '</button>';
      }
      html += '</div></div>';
      for (const item of items) {
        const sel = item.filePath === selectedPath ? ' selected' : '';
        const main = !!item.isMainAgent;
        const warn = !main && !item.hasFrontmatter;
        const rel = displayPath(item);
        const desc = (item.description || '').trim();
        const descText = desc || (main ? 'Main agent configuration' : 'No description in frontmatter');
        const descClass = desc ? 'item-description' : 'item-description placeholder';
        html += '<div class="item' + sel + '" data-filepath="' + escapeHtml(item.filePath) + '" title="' + escapeHtml(rel) + '">';
        html += renderIconChip(item.icon, item.color);
        html += '<div class="item-content">';
        html += '<div class="item-name">' + escapeHtml(item.name) + '</div>';
        html += '<div class="' + descClass + '">' + escapeHtml(descText) + '</div>';
        if (warn) {
          html += '<div class="item-hint">Add a description in frontmatter — open file and click \\u24D8</div>';
        }
        html += '</div>';
        if (main) {
          html += '<span class="item-icon star" title="Main agent config">\\u2605</span>';
        } else if (warn) {
          html += '<span class="item-icon warning" title="Missing or empty description field in frontmatter.">\\u26A0</span>';
        }
        html += '<button class="item-more-btn" data-more="1" title="More actions" aria-label="More actions">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />' +
          '</svg></button>';
        html += '</div>';
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

    function wireSectionAddHandlers() {
      contentEl.querySelectorAll('.section-add-btn').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const type = el.dataset.addType;
          if (type === 'skill' || type === 'agent') openModal(type);
        });
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
