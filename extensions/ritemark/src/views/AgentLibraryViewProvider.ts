import * as vscode from 'vscode';
import * as os from 'os';
import { discoverAgents, discoverCommands } from '../agent/discovery';
import type { DiscoveredAgent, DiscoveredCommand } from '../agent/discovery';

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class AgentLibraryViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.agentLibraryView';

  private _view?: vscode.WebviewView;
  private _agents: DiscoveredAgent[] = [];
  private _commands: DiscoveredCommand[] = [];

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
      }
    });
  }

  public refresh() {
    this._discover();
    this._sendItems();
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

  private _getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      overflow-x: hidden;
    }
    .header-counts {
      padding: 0 14px 8px 20px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .search-container {
      padding: 0 10px 8px 10px;
    }
    .search-input-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
    }
    .search-input-wrapper:focus-within {
      border-color: var(--vscode-focusBorder);
    }
    .search-input {
      flex: 1;
      padding: 0;
      font-size: 12px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-input-foreground);
      background: transparent;
      border: none;
      outline: none;
    }
    .search-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    .search-icon {
      flex-shrink: 0;
      width: 12px;
      height: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .scope-tabs {
      display: flex;
      padding: 0 10px;
      margin-bottom: 0;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(0,0,0,0.08));
    }
    .scope-tab {
      flex: 1;
      padding: 6px 4px;
      font-size: 12px;
      font-weight: 500;
      text-align: center;
      cursor: pointer;
      color: var(--vscode-descriptionForeground);
      border-bottom: 2px solid transparent;
      transition: color 0.1s, border-color 0.1s;
      user-select: none;
    }
    .scope-tab:hover {
      color: var(--vscode-foreground);
    }
    .scope-tab.active {
      color: var(--vscode-foreground);
      border-bottom-color: var(--vscode-focusBorder, #4338CA);
      font-weight: 600;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 14px 4px 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
      background: #F1F5F9;
      user-select: none;
    }
    .section-count {
      font-size: 11px;
      font-weight: 400;
      color: var(--vscode-descriptionForeground);
    }
    .item {
      display: flex;
      align-items: flex-start;
      padding: 8px 12px 8px 20px;
      cursor: pointer;
      border-left: 2px solid transparent;
      transition: background-color 0.1s;
    }
    .item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .item.selected {
      background: #E0E7FF;
      border-left-color: var(--vscode-focusBorder);
    }
    .item.selected .item-name {
      font-weight: 600;
    }
    .item-content {
      flex: 1;
      min-width: 0;
    }
    .item-name {
      font-size: 13px;
      font-weight: 500;
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-path {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: 3px;
    }
    .item-path.has-warning {
      color: #F59E0B;
    }
    .item-icon {
      flex-shrink: 0;
      margin-left: 6px;
      margin-top: 3px;
      font-size: 11px;
      line-height: 1;
    }
    .item-icon.star {
      color: var(--vscode-focusBorder, #4338CA);
    }
    .item-icon.warning {
      color: #F59E0B;
      cursor: help;
    }
    .item-hint {
      font-size: 10px;
      line-height: 1.3;
      color: #F59E0B;
      padding: 2px 0 0;
      opacity: 0.85;
    }
    .empty-state {
      padding: 24px 14px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.5;
    }
    .empty-state-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--vscode-foreground);
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="header-counts" id="counts"></div>
  <div class="search-container">
    <div class="search-input-wrapper">
      <svg class="search-icon" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round"><circle cx="116" cy="116" r="84"/><line x1="175.4" y1="175.4" x2="224" y2="224"/></svg>
      <input type="text" class="search-input" id="search" placeholder="Search" />
    </div>
  </div>
  <div class="scope-tabs" id="scopeTabs">
    <div class="scope-tab active" data-scope="project" id="tabProject">Project</div>
    <div class="scope-tab" data-scope="user" id="tabUser">User</div>
  </div>
  <div id="content"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    let agents = [];
    let skills = [];
    let commands = [];
    let workspacePath = '';
    let userHomePath = '';
    let selectedPath = null;
    let filter = '';
    let activeScope = 'project';

    const countsEl = document.getElementById('counts');
    const contentEl = document.getElementById('content');
    const searchEl = document.getElementById('search');
    const tabProjectEl = document.getElementById('tabProject');
    const tabUserEl = document.getElementById('tabUser');

    searchEl.addEventListener('input', (e) => {
      filter = e.target.value.toLowerCase();
      render();
    });

    tabProjectEl.addEventListener('click', () => { activeScope = 'project'; render(); });
    tabUserEl.addEventListener('click', () => { activeScope = 'user'; render(); });

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

    function byScope(item) {
      return item.scope === activeScope;
    }

    function matches(item) {
      if (!filter) return true;
      const rel = displayPath(item);
      return (
        item.name.toLowerCase().includes(filter) ||
        item.id.toLowerCase().includes(filter) ||
        rel.toLowerCase().includes(filter)
      );
    }

    function scopeCount(scope) {
      return agents.filter(i => i.scope === scope).length +
             skills.filter(i => i.scope === scope).length +
             commands.filter(i => i.scope === scope).length;
    }

    function render() {
      // Update tab active state
      tabProjectEl.className = 'scope-tab' + (activeScope === 'project' ? ' active' : '');
      tabUserEl.className = 'scope-tab' + (activeScope === 'user' ? ' active' : '');

      // Filter by scope, then by search
      const scopedAgents = agents.filter(byScope);
      const scopedSkills = skills.filter(byScope);
      const scopedCommands = commands.filter(byScope);
      const filteredAgents = scopedAgents.filter(matches);
      const filteredSkills = scopedSkills.filter(matches);
      const filteredCommands = scopedCommands.filter(matches);

      // Total counts across both scopes for stats line
      const parts = [];
      if (agents.length) parts.push(agents.length + ' agent' + (agents.length !== 1 ? 's' : ''));
      if (skills.length) parts.push(skills.length + ' skill' + (skills.length !== 1 ? 's' : ''));
      if (commands.length) parts.push(commands.length + ' command' + (commands.length !== 1 ? 's' : ''));
      countsEl.textContent = parts.join(' \\u00b7 ');

      const scopeTotal = scopedAgents.length + scopedSkills.length + scopedCommands.length;
      if (scopeTotal === 0) {
        const scopeLabel = activeScope === 'project' ? 'project' : 'user';
        contentEl.innerHTML =
          '<div class="empty-state">' +
            '<div class="empty-state-title">No ' + scopeLabel + ' agents or skills</div>' +
            '<div>Add markdown files to<br><code>' +
            (activeScope === 'project' ? '.claude/agents/' : '~/.claude/agents/') +
            '</code> or <code>' +
            (activeScope === 'project' ? '.claude/skills/' : '~/.claude/skills/') +
            '</code></div>' +
          '</div>';
        return;
      }

      let html = '';

      if (filteredAgents.length > 0) {
        html += renderSection('Agents', filteredAgents);
      }
      if (filteredSkills.length > 0) {
        html += renderSection('Skills', filteredSkills);
      }
      if (filteredCommands.length > 0) {
        html += renderSection('Commands', filteredCommands);
      }

      if (!html && filter) {
        html = '<div class="empty-state">No matches for "' + escapeHtml(filter) + '"</div>';
      }

      contentEl.innerHTML = html;

      contentEl.querySelectorAll('.item').forEach((el) => {
        el.addEventListener('click', () => {
          const fp = el.dataset.filepath;
          if (!fp) return;
          selectedPath = fp;
          render();
          vscode.postMessage({ type: 'openFile', filePath: fp });
        });
      });
    }

    function renderSection(title, items) {
      let html = '<div class="section-header">';
      html += '<span>' + escapeHtml(title) + '</span>';
      html += '<span class="section-count">' + items.length + '</span>';
      html += '</div>';
      for (const item of items) {
        const sel = item.filePath === selectedPath ? ' selected' : '';
        const main = !!item.isMainAgent;
        const warn = !main && !item.hasFrontmatter;
        const rel = displayPath(item);
        html += '<div class="item' + sel + '" data-filepath="' + escapeHtml(item.filePath) + '">';
        html += '<div class="item-content">';
        html += '<div class="item-name">' + escapeHtml(item.name) + '</div>';
        html += '<div class="item-path' + (warn ? ' has-warning' : '') + '">' + escapeHtml(rel) + '</div>';
        if (warn) {
          html += '<div class="item-hint">Add a description in frontmatter — open file and click ⓘ</div>';
        }
        html += '</div>';
        if (main) {
          html += '<span class="item-icon star" title="Main agent config">\\u2605</span>';
        } else if (warn) {
          html += '<span class="item-icon warning" title="Missing or empty description field in frontmatter. Click to open, then use the ⓘ Properties panel to fix.">\\u26A0</span>';
        }
        html += '</div>';
      }
      return html;
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
