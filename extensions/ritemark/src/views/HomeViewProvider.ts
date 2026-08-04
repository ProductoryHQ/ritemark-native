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
  { id: 'new-ai-task', label: 'New AI task', icon: 'sparkle', command: 'ritemark.newChat' },
  { id: 'open-document', label: 'Open document…', icon: 'file', command: 'workbench.action.files.openFile' },
  { id: 'new-table', label: 'New table', icon: 'grid', command: 'ritemark.newTable' },
  { id: 'open-folder', label: 'Open folder…', icon: 'folder', command: 'workbench.action.files.openFolder' },
];

/**
 * Inline SVG icons (Phosphor-style outlines, currentColor, 1.7 stroke) — the
 * design pass replaced placeholder unicode glyphs, which rendered as random
 * boxes and made recent rows look like checkboxes.
 */
const ICON_PATHS: Record<string, string> = {
  'file-plus': 'M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8.5L14 3Zm0 0v5.5h4.5M12 12v5M9.5 14.5h5',
  'sparkle': 'M12 4l1.8 4.9L19 10.5l-5.2 1.6L12 17l-1.8-4.9L5 10.5l5.2-1.6L12 4ZM18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z',
  'file': 'M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8.5L14 3Zm0 0v5.5h4.5',
  'file-text': 'M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8.5L14 3Zm0 0v5.5h4.5M9 13h6M9 16.5h6',
  'grid': 'M4.5 5.5h15v13h-15v-13Zm0 4.3h15M4.5 14.2h15M10 5.5v13M15 5.5v13',
  'folder': 'M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.2h8A1.5 1.5 0 0 1 20.5 9.2v8.3A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5V7Z',
};

function svgIcon(name: string, size: number): string {
  const d = ICON_PATHS[name] ?? ICON_PATHS['file'];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

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
        <span class="row-ico">${svgIcon('file-text', 16)}</span>
        <span class="row-main"><span class="row-label">${esc(r.label)}</span><span class="row-detail">${esc(r.detail)}</span></span>
      </button>`).join('');
    const quickRows = QUICK_ACTIONS.map((a) => `
      <button class="row" data-command="${esc(a.command)}">
        <span class="row-ico">${svgIcon(a.icon, 16)}</span>
        <span class="row-main"><span class="row-label">${esc(a.label)}</span></span>
      </button>`).join('');

    return /* html */ `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  :root {
    --ink-strong: var(--vscode-sideBar-foreground, #1E1B4B);
    --ink-muted: var(--vscode-descriptionForeground, #64748B);
    --surface-soft: var(--vscode-list-hoverBackground, rgba(148,163,184,0.10));
    --accent: #4338CA;
    --accent-deep: #3730A3;
    --ring: rgba(67,56,202,0.28);
  }
  body.vscode-dark, body.vscode-high-contrast:not(.vscode-high-contrast-light) {
    --accent: #6366F1;
    --accent-deep: #818CF8;
    --ring: rgba(129,140,248,0.38);
  }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--ink-strong); padding: 12px 10px 16px; }

  .cta {
    display: flex; flex-direction: column; align-items: center; gap: 1px;
    width: 100%; padding: 11px 14px 9px; border: 0; border-radius: 10px; cursor: pointer;
    background: var(--accent); color: #fff; font-family: inherit;
    box-shadow: 0 4px 6px -1px rgba(67,56,202,0.25);
    transition: background 120ms ease;
  }
  .cta:hover { background: var(--accent-deep); }
  .cta:active { transform: scale(0.98); }
  .cta:focus-visible { outline: none; box-shadow: 0 0 0 4px var(--ring), 0 4px 6px -1px rgba(67,56,202,0.25); }
  .cta-top { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; }
  .cta-hint { font-size: 11px; opacity: 0.78; }

  .section { margin-top: 18px; }
  .section-title {
    font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--ink-muted); margin-bottom: 5px; padding: 0 2px;
  }
  .row {
    display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
    padding: 6px 8px; border: 0; border-radius: 4px; background: transparent;
    color: var(--ink-strong); font-family: inherit; font-size: 13px; cursor: pointer;
    transition: background 100ms ease;
  }
  .row:hover { background: var(--surface-soft); }
  .row:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ring); }
  .row-ico { display: flex; width: 16px; flex: 0 0 auto; color: var(--ink-muted); }
  .row:hover .row-ico { color: var(--accent); }
  .row-main { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .row-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-detail { font-size: 11px; color: var(--ink-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { font-size: 12px; color: var(--ink-muted); padding: 4px 2px; line-height: 1.5; }
</style></head>
<body>
  ${hasFolder ? `
  <button class="cta" data-command="ritemark.newDocument" autofocus>
    <span class="cta-top">${svgIcon('file-plus', 16)}New document</span>
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
      <span class="row-ico">${svgIcon('folder', 16)}</span>
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
