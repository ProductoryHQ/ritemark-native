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

/** Row text: the page title over its address when there is a title, else host/file name over path (R5). */
export function describe(url: string, title?: string): { name: string; description: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') {
      const decoded = decodeURIComponent(parsed.pathname);
      return { name: title || path.basename(decoded) || url, description: decoded };
    }
    const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
    if (title) return { name: title, description: parsed.host + pathname };
    // host, not hostname: two dev servers on different ports stay apart (localhost:5173 vs :3000).
    return { name: parsed.host || url, description: pathname };
  } catch {
    return { name: title || url, description: title ? url : '' };
  }
}

/** True only when the file is reported as not found; other errors keep the entry (R6). */
export async function fileIsMissing(url: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.parse(url));
    return false;
  } catch (err) {
    return err instanceof vscode.FileSystemError && err.code === 'FileNotFound';
  }
}

/** Phosphor, regular weight, as the page's other icons. */
const ICON_PLUS =
  '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/></svg>';
const ICON_BROOM =
  '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M235.5,216.81c-22.56-11-35.5-34.58-35.5-64.8V134.73a15.94,15.94,0,0,0-10.09-14.87L165,110a8,8,0,0,1-4.48-10.34l21.32-53a28,28,0,0,0-16.1-37,28.14,28.14,0,0,0-35.82,16,.61.61,0,0,0,0,.12L108.9,79a8,8,0,0,1-10.37,4.49L73.11,73.14A15.89,15.89,0,0,0,55.74,76.8C34.68,98.45,24,123.75,24,152a111.45,111.45,0,0,0,31.18,77.53A8,8,0,0,0,61,232H232a8,8,0,0,0,3.5-15.19ZM67.14,88l25.41,10.3a24,24,0,0,0,31.23-13.45l21-53c2.56-6.11,9.47-9.27,15.43-7a12,12,0,0,1,6.88,15.92L145.69,93.76a24,24,0,0,0,13.43,31.14L184,134.73V152c0,.33,0,.66,0,1L55.77,101.71A108.84,108.84,0,0,1,67.14,88Zm48,128a87.53,87.53,0,0,1-24.34-42,8,8,0,0,0-15.49,4,105.16,105.16,0,0,0,18.36,38H64.44A95.54,95.54,0,0,1,40,152a85.9,85.9,0,0,1,7.73-36.29l137.8,55.12c3,18,10.56,33.48,21.89,45.16Z"/></svg>';

/** Sprint 134 R18: the group label over the recent pages. */
export const RECENT_LABEL = 'Recent';

/**
 * Sprint 134 R18: the two icon buttons at the right of the Recent label. Each posts its message, and the host
 * runs the command the view's title row ran before the project's head took that row; both stay in the palette.
 */
export const RECENT_ACTIONS = [
  {
    message: 'newTab',
    command: 'ritemark.browser.newTab',
    label: 'New browser tab',
    tooltip: 'Open a new browser tab',
    icon: ICON_PLUS,
  },
  {
    message: 'clearAll',
    command: 'ritemark.browser.history.clearAll',
    label: 'Clear history',
    tooltip: 'Clear the list of recent pages',
    icon: ICON_BROOM,
  },
] as const;

export function escapeHtml(s: string): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

/**
 * The Recent label with its two actions at the right (R18), in the column's 11-caps style. Drawn once, above
 * the list, so a button keeps the keyboard's focus when the list is drawn again.
 */
export function recentHeaderHtml(): string {
  const buttons = RECENT_ACTIONS.map(
    (action) =>
      '<button type="button" class="group-btn" data-message="' + escapeHtml(action.message) + '"' +
      ' aria-label="' + escapeHtml(action.label) + '" data-tooltip="' + escapeHtml(action.tooltip) + '">' +
      action.icon +
      '</button>'
  ).join('');
  return (
    '<div class="group">' +
      '<span class="group-label" role="heading" aria-level="2">' + escapeHtml(RECENT_LABEL) + '</span>' +
      '<span class="group-actions">' + buttons + '</span>' +
    '</div>'
  );
}

/** Sprint 134 R18: the list's words with no pages (the Experience lead: plain words). */
export const RECENT_EMPTY_TITLE = 'No pages yet';
export const RECENT_EMPTY_LINE = 'Pages you visit in Ritemark Browser appear here.';

/**
 * The page script's list: its icons, its escape helper and `renderList(items)`, which returns the rows' HTML,
 * or the empty text with no pages. The page runs this text, and the tests evaluate the same text
 * (`BrowserHistoryStore.test.ts`), so every title and address is shown escaped.
 */
export const RECENT_LIST_SCRIPT = `
    const ICON_GLOBE = '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128,26A102,102,0,1,0,230,128,102.12,102.12,0,0,0,128,26Zm89.61,96H180.53a154.66,154.66,0,0,0-15.19-60.43A90.21,90.21,0,0,1,217.61,122ZM128,217.6c-9.34,0-22.41-15.78-30.41-43.61A186.5,186.5,0,0,1,93.6,134h68.8a186.5,186.5,0,0,1-4,39.94C150.41,201.82,137.34,217.6,128,217.6ZM93.6,122a186.5,186.5,0,0,1,4-39.94c8-27.83,21.07-43.61,30.41-43.61s22.41,15.78,30.41,43.61a186.5,186.5,0,0,1,4,39.94ZM90.66,61.57A154.66,154.66,0,0,0,75.47,122H38.39A90.21,90.21,0,0,1,90.66,61.57ZM38.39,134H75.47a154.66,154.66,0,0,0,15.19,60.43A90.21,90.21,0,0,1,38.39,134Zm127,60.43A154.66,154.66,0,0,0,180.53,134h37.08A90.21,90.21,0,0,1,165.34,194.43Z"/></svg>';
    const ICON_CLOSE = '<svg viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round"><line x1="64" y1="64" x2="192" y2="192"/><line x1="192" y1="64" x2="64" y2="192"/></svg>';

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function renderList(items) {
      if (!items || items.length === 0) {
        return '<div class="empty"><div class="empty-title">' + escapeHtml(${JSON.stringify(RECENT_EMPTY_TITLE)}) + '</div>' + escapeHtml(${JSON.stringify(RECENT_EMPTY_LINE)}) + '</div>';
      }
      return items.map((item) => {
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
    }
`;

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
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) void this.pruneMissingFiles();
      }),
      webviewView.webview.onDidReceiveMessage((msg: { type?: string; url?: string }) => {
        switch (msg?.type) {
          case 'ready':
            this.postItems();
            void this.pruneMissingFiles();
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
          default: {
            // R18: the Recent label's New browser tab and Clear history
            const action = RECENT_ACTIONS.find((candidate) => candidate.message === msg?.type);
            if (action) void vscode.commands.executeCommand(action.command);
            break;
          }
        }
      })
    );
  }

  /** Local files that are gone drop out when Recent is shown; the store's change event re-posts the list. */
  private async pruneMissingFiles(): Promise<void> {
    try {
      await this.history.pruneMissingFiles(fileIsMissing);
    } catch {
      // Keep the list as it is.
    }
  }

  private postItems(): void {
    if (!this.webviewView) return;
    const items: RecentItem[] = this.history.getAll().map((e: BrowserHistoryEntry) => {
      const { name, description } = describe(e.url, e.title);
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
      --r-ink-muted: var(--vscode-descriptionForeground, #617187);
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
    button, [role="button"] { cursor: pointer; }
    /* R18: the Recent label, in the column's 11-caps style (018's .ritemark-project-group), its two icon buttons
       at its right. It stays in view as the list scrolls, as Documents' label stays over the tree. */
    .group {
      position: sticky; top: 0; z-index: 1;
      display: flex; align-items: center; gap: 8px;
      padding: 14px 12px 6px 16px;
      background: var(--r-surface);
    }
    .group-label {
      flex: 1; min-width: 0;
      font-size: 11px; line-height: 14px; font-weight: 600;
      letter-spacing: 0.5px; text-transform: uppercase;
      color: var(--vscode-sideBarTitle-foreground, var(--r-ink-strong));
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .group-actions { flex-shrink: 0; display: flex; align-items: center; gap: 2px; }
    .group-btn {
      position: relative;
      width: 22px; height: 22px;
      margin: -4px 0; /* the label's line stays 14 high */
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 4px;
      background: transparent; border: none; padding: 0;
      color: var(--r-ink-muted);
      transition: background-color 0.1s, color 0.1s;
    }
    .group-btn:hover { background: var(--vscode-list-hoverBackground); color: var(--r-ink-strong); }
    .group-btn:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    .group-btn svg { width: 14px; height: 14px; display: block; }
    /* The tooltip, as the app's (ui/tooltip.tsx): on hover and on keyboard focus, under the button, kept inside
       the column by its right edge. */
    .group-btn::after {
      content: attr(data-tooltip);
      position: absolute; top: calc(100% + 6px); right: 0;
      padding: 6px 10px; border-radius: 8px;
      background: var(--r-ink-strong); color: var(--r-surface);
      font-size: 12px; line-height: 1.35; font-weight: 400;
      letter-spacing: normal; text-transform: none; white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
      pointer-events: none;
      opacity: 0; visibility: hidden;
      transition: opacity 0.1s, visibility 0.1s;
    }
    .group-btn:hover::after { opacity: 1; visibility: visible; transition-delay: 0.3s; }
    .group-btn:focus-visible::after { opacity: 1; visibility: visible; }
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
  ${recentHeaderHtml()}
  <div id="content"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const content = document.getElementById('content');
${RECENT_LIST_SCRIPT}
    function render(items) {
      content.innerHTML = renderList(items);
    }

    document.querySelector('.group-actions').addEventListener('click', (e) => {
      const button = e.target.closest('[data-message]');
      if (button) vscode.postMessage({ type: button.getAttribute('data-message') });
    });

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
