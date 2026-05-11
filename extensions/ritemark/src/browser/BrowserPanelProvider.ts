import * as path from 'path';
import * as vscode from 'vscode';
import { BrowserHistoryEntry, BrowserHistoryStore } from './BrowserHistoryStore';

interface RecentItem {
  url: string;
  name: string;
  description: string;
  visitedAt: number;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function describe(url: string): { name: string; description: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') {
      const decoded = decodeURIComponent(parsed.pathname);
      return { name: path.basename(decoded) || url, description: decoded };
    }
    const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
    return { name: parsed.hostname || url, description: pathname };
  } catch {
    return { name: url, description: '' };
  }
}

export class BrowserPanelProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  public static readonly viewId = 'ritemark.browserView';

  private webviewView: vscode.WebviewView | undefined;
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor(
    private readonly history: BrowserHistoryStore,
    private readonly extensionUri: vscode.Uri
  ) {
    this.subscriptions.push(history.onDidChange(() => this.postItems()));
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.renderHtml(webviewView.webview);

    this.subscriptions.push(
      webviewView.webview.onDidReceiveMessage((msg: { type?: string; url?: string }) => {
        switch (msg?.type) {
          case 'ready':
            this.postItems();
            break;
          case 'open':
            if (typeof msg.url === 'string') {
              void vscode.commands.executeCommand('ritemark.browser.history.open', msg.url);
            }
            break;
          case 'remove':
            if (typeof msg.url === 'string') {
              void this.history.remove(msg.url);
            }
            break;
        }
      })
    );
  }

  private postItems(): void {
    if (!this.webviewView) return;
    const items: RecentItem[] = this.history.getAll().map((e: BrowserHistoryEntry) => {
      const { name, description } = describe(e.url);
      return { url: e.url, name, description, visitedAt: e.visitedAt };
    });
    void this.webviewView.webview.postMessage({ type: 'items', items });
  }

  private renderHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    :root {
      --r-accent: #4338CA;
      --r-accent-soft: rgba(67, 56, 202, 0.10);
      --r-surface: var(--vscode-sideBar-background, #FFFFFF);
      --r-ink-strong: var(--vscode-foreground, #1E1B4B);
      --r-ink-muted: var(--vscode-descriptionForeground, #64748B);
      --r-ink-faint: rgba(100, 116, 139, 0.65);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--r-ink-strong);
      background: var(--r-surface);
      overflow-x: hidden;
    }
    .empty {
      padding: 18px 16px;
      color: var(--r-ink-muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .empty-title { font-weight: 500; color: var(--r-ink-strong); margin-bottom: 4px; }
    .item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 8px 12px 8px 14px;
      cursor: pointer;
      border-left: 2px solid transparent;
      transition: background-color 0.1s;
    }
    .item:hover { background: var(--vscode-list-hoverBackground); }
    .item.active { background: var(--r-accent-soft); border-left-color: var(--r-accent); }
    .item-icon-chip {
      flex-shrink: 0;
      width: 32px; height: 32px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 8px;
      background: var(--r-accent-soft);
      color: var(--r-accent);
      margin-top: 1px;
    }
    .item-icon-chip svg { width: 18px; height: 18px; display: block; }
    .item-content { flex: 1; min-width: 0; padding-top: 1px; }
    .item-name {
      font-size: 13px; font-weight: 500; line-height: 1.35;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .item-description {
      font-size: 11px; color: var(--r-ink-muted);
      line-height: 1.4; margin-top: 2px;
      overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      word-break: break-all;
    }
    .item-remove-btn {
      flex-shrink: 0;
      width: 22px; height: 22px;
      margin-left: 4px; margin-top: 4px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 4px;
      background: transparent; border: none; padding: 0;
      cursor: pointer;
      color: var(--r-ink-muted);
      opacity: 0;
      transition: opacity 0.1s, background-color 0.1s, color 0.1s;
    }
    .item:hover .item-remove-btn,
    .item:focus-within .item-remove-btn { opacity: 1; }
    .item-remove-btn:hover { background: var(--r-accent-soft); color: var(--r-accent); }
    .item-remove-btn svg { width: 14px; height: 14px; display: block; }
  </style>
</head>
<body>
  <div id="content"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const content = document.getElementById('content');

    const ICON_GLOBE = '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128,26A102,102,0,1,0,230,128,102.12,102.12,0,0,0,128,26Zm89.61,96H180.53a154.66,154.66,0,0,0-15.19-60.43A90.21,90.21,0,0,1,217.61,122ZM128,217.6c-9.34,0-22.41-15.78-30.41-43.61A186.5,186.5,0,0,1,93.6,134h68.8a186.5,186.5,0,0,1-4,39.94C150.41,201.82,137.34,217.6,128,217.6ZM93.6,122a186.5,186.5,0,0,1,4-39.94c8-27.83,21.07-43.61,30.41-43.61s22.41,15.78,30.41,43.61a186.5,186.5,0,0,1,4,39.94ZM90.66,61.57A154.66,154.66,0,0,0,75.47,122H38.39A90.21,90.21,0,0,1,90.66,61.57ZM38.39,134H75.47a154.66,154.66,0,0,0,15.19,60.43A90.21,90.21,0,0,1,38.39,134Zm127,60.43A154.66,154.66,0,0,0,180.53,134h37.08A90.21,90.21,0,0,1,165.34,194.43Z"/></svg>';
    const ICON_CLOSE = '<svg viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round"><line x1="64" y1="64" x2="192" y2="192"/><line x1="192" y1="64" x2="64" y2="192"/></svg>';

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function render(items) {
      if (!items || items.length === 0) {
        content.innerHTML = '<div class="empty"><div class="empty-title">No recent URLs</div>Pages you visit in Ritemark Browser appear here.</div>';
        return;
      }
      const rows = items.map((item) => {
        const url = escapeHtml(item.url);
        const name = escapeHtml(item.name);
        const desc = escapeHtml(item.description);
        return (
          '<div class="item" role="button" tabindex="0" data-url="' + url + '" title="' + url + '">' +
            '<span class="item-icon-chip">' + ICON_GLOBE + '</span>' +
            '<div class="item-content">' +
              '<div class="item-name">' + name + '</div>' +
              (desc ? '<div class="item-description">' + desc + '</div>' : '') +
            '</div>' +
            '<button class="item-remove-btn" data-action="remove" aria-label="Remove from history">' + ICON_CLOSE + '</button>' +
          '</div>'
        );
      }).join('');
      content.innerHTML = rows;
    }

    content.addEventListener('click', (e) => {
      const target = e.target;
      const removeBtn = target.closest('.item-remove-btn');
      const item = target.closest('.item');
      if (!item) return;
      const url = item.getAttribute('data-url');
      if (!url) return;
      if (removeBtn) {
        e.stopPropagation();
        vscode.postMessage({ type: 'remove', url });
        return;
      }
      vscode.postMessage({ type: 'open', url });
    });

    content.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const item = e.target.closest('.item');
      if (!item) return;
      const url = item.getAttribute('data-url');
      if (!url) return;
      e.preventDefault();
      vscode.postMessage({ type: 'open', url });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg && msg.type === 'items') render(msg.items);
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    for (const d of this.subscriptions) d.dispose();
    this.subscriptions.length = 0;
    this.webviewView = undefined;
  }
}
