/**
 * HomeViewProvider — Sprint 106 (#74): the persistent Home / first-task
 * launcher.
 *
 * A lightweight RE-ENTRY point, not a second onboarding system (locked Welcome
 * principles, Sprint 43): one dominant "New document — Markdown (.md)" action,
 * a few quick actions that all reuse EXISTING commands, and recent workspace
 * documents. Self-contained HTML (no webview bundle dependency) styled with
 * the Indigo-Editorial tokens.
 */
import * as vscode from 'vscode';
import * as path from 'path';

const QUICK_ACTIONS: Array<{ id: string; label: string; icon: string; command: string }> = [
  { id: 'new-ai-task', label: 'New AI task', icon: '✦', command: 'ritemark.newChat' },
  { id: 'open-document', label: 'Open document…', icon: '⌸', command: 'workbench.action.files.openFile' },
  { id: 'new-table', label: 'New table', icon: '▦', command: 'ritemark.newTable' },
  { id: 'open-folder', label: 'Open folder…', icon: '▤', command: 'workbench.action.files.openFolder' },
];

export class HomeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.homeView';
  private _view: vscode.WebviewView | null = null;

  constructor(private readonly _enabled: boolean = true) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage(async (message: { type?: string; command?: string; path?: string }) => {
      switch (message.type) {
        case 'run-command':
          if (typeof message.command === 'string' && this._isAllowedCommand(message.command)) {
            await vscode.commands.executeCommand(message.command);
          }
          return;
        case 'open-recent':
          if (typeof message.path === 'string') {
            await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(message.path));
          }
          return;
        case 'refresh':
          await this.render();
          return;
      }
    });
    view.onDidChangeVisibility(() => { if (view.visible) void this.render(); });
    void this.render();
  }

  /** Only the fixed launcher commands may run from this webview. */
  private _isAllowedCommand(command: string): boolean {
    return command === 'ritemark.newDocument' || QUICK_ACTIONS.some((a) => a.command === command);
  }

  /**
   * Recent work from an existing source: the most recently modified Markdown
   * documents in the workspace. No new persistence, no duplicate history.
   */
  private async _recentDocuments(): Promise<Array<{ label: string; detail: string; fsPath: string }>> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return [];
    try {
      const files = await vscode.workspace.findFiles('**/*.md', '**/{node_modules,.git,.ritemark}/**', 200);
      const stats = await Promise.all(files.map(async (uri) => {
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          return { uri, mtime: stat.mtime };
        } catch { return null; }
      }));
      return stats
        .filter((s): s is { uri: vscode.Uri; mtime: number } => s !== null)
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 5)
        .map(({ uri }) => ({
          label: path.basename(uri.fsPath),
          detail: vscode.workspace.asRelativePath(uri, false),
          fsPath: uri.fsPath,
        }));
    } catch {
      return [];
    }
  }

  async render(): Promise<void> {
    if (!this._view) return;
    if (!this._enabled) {
      // home-launcher kill-switch: honest disabled notice, no launcher UI.
      this._view.webview.html = '<html><body style="font-family:var(--vscode-font-family);font-size:12px;color:var(--vscode-descriptionForeground);padding:12px">Home is disabled by the home-launcher feature flag.</body></html>';
      return;
    }
    const hasFolder = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
    const recents = hasFolder ? await this._recentDocuments() : [];
    this._view.webview.html = this._html(hasFolder, recents);
  }

  private _html(hasFolder: boolean, recents: Array<{ label: string; detail: string; fsPath: string }>): string {
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const recentRows = recents.map((r) => `
      <button class="row" data-open="${esc(r.fsPath)}" title="${esc(r.detail)}">
        <span class="row-ico">▢</span>
        <span class="row-main"><span class="row-label">${esc(r.label)}</span><span class="row-detail">${esc(r.detail)}</span></span>
      </button>`).join('');
    const quickRows = QUICK_ACTIONS.map((a) => `
      <button class="row" data-command="${esc(a.command)}">
        <span class="row-ico">${a.icon}</span>
        <span class="row-main"><span class="row-label">${esc(a.label)}</span></span>
      </button>`).join('');

    return /* html */ `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  :root {
    --ink-strong: var(--vscode-sideBar-foreground, #1E1B4B);
    --ink-muted: var(--vscode-descriptionForeground, #64748B);
    --hairline: var(--vscode-sideBarSectionHeader-border, rgba(148,163,184,0.28));
    --surface-soft: var(--vscode-list-hoverBackground, rgba(148,163,184,0.10));
    --accent: #4338CA;
  }
  body.vscode-dark { --accent: #818CF8; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--ink-strong); padding: 12px 10px; }
  .cta {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    width: 100%; padding: 12px 14px; border: 0; border-radius: 10px; cursor: pointer;
    background: var(--accent); color: #fff; font-family: inherit;
    box-shadow: 0 4px 6px -1px rgba(67,56,202,0.25);
  }
  .cta:hover { filter: brightness(1.06); }
  .cta:active { transform: scale(0.98); }
  .cta-label { font-size: 13px; font-weight: 600; }
  .cta-hint { font-size: 11px; opacity: 0.85; }
  .section { margin-top: 16px; }
  .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-muted); margin-bottom: 4px; padding: 0 2px; }
  .row {
    display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
    padding: 6px 8px; border: 0; border-radius: 4px; background: transparent;
    color: var(--ink-strong); font-family: inherit; font-size: 13px; cursor: pointer;
  }
  .row:hover { background: var(--surface-soft); }
  .row:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent); }
  .row-ico { width: 16px; text-align: center; color: var(--ink-muted); flex: 0 0 auto; }
  .row-main { min-width: 0; display: flex; flex-direction: column; }
  .row-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-detail { font-size: 11px; color: var(--ink-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { font-size: 12px; color: var(--ink-muted); padding: 4px 2px; line-height: 1.5; }
</style></head>
<body>
  ${hasFolder ? `
  <button class="cta" data-command="ritemark.newDocument" autofocus>
    <span class="cta-label">New document</span>
    <span class="cta-hint">Markdown (.md)</span>
  </button>

  <div class="section">
    <div class="section-title">Quick actions</div>
    ${quickRows}
  </div>

  <div class="section">
    <div class="section-title">Recent documents</div>
    ${recents.length > 0 ? recentRows : '<p class="empty">Documents you edit will show up here.</p>'}
  </div>
  ` : `
  <p class="empty">Open a folder to start writing — your documents live in a folder Ritemark can see.</p>
  <div class="section">
    <button class="row" data-command="workbench.action.files.openFolder">
      <span class="row-ico">▤</span>
      <span class="row-main"><span class="row-label">Open folder…</span></span>
    </button>
  </div>
  `}
<script>
  const vscodeApi = acquireVsCodeApi();
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.command) vscodeApi.postMessage({ type: 'run-command', command: btn.dataset.command });
    else if (btn.dataset.open) vscodeApi.postMessage({ type: 'open-recent', path: btn.dataset.open });
  });
</script>
</body></html>`;
  }
}
