import * as path from 'path';
import * as vscode from 'vscode';
import { openInIntegratedBrowser } from './IntegratedBrowser';

const REDIRECT_WINDOW_MS = 1500;

function isHtmlFile(uri: vscode.Uri): boolean {
  return uri.scheme === 'file' && /\.html?$/i.test(uri.fsPath);
}

function shouldUseBrowser(): boolean {
  return vscode.workspace
    .getConfiguration('ritemark.browser')
    .get<'browser' | 'text'>('htmlDefaultOpener', 'browser') === 'browser';
}

/**
 * Routes .html text-editor opens into the native Electron BrowserView.
 *
 * VS Code's custom editor default association is not reliable for our pivot
 * because the actual renderer is a shell-level BrowserView, not a custom
 * editor webview. This listener catches both Explorer/CLI opens and link-opened
 * local HTML documents, opens the file in the integrated browser, then closes
 * the transient source editor. The explicit "Open as Text" command bypasses
 * this path by temporarily marking a URI as text-intended.
 */
export class BrowserHtmlOpenRedirector implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly textBypassUntil = new Map<string, number>();
  private readonly redirectedUntil = new Map<string, number>();

  public static register(context: vscode.ExtensionContext): BrowserHtmlOpenRedirector {
    const redirector = new BrowserHtmlOpenRedirector();
    redirector.disposables.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        void redirector.redirectIfNeeded(document);
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) void redirector.redirectIfNeeded(editor.document);
      }),
      // Cold-start: VS Code may surface visible editors before onDidOpenTextDocument
      // fires (e.g. CLI open, restore-session). Subscribe to the event so we catch
      // editors that become visible after activation but before the setTimeout fires.
      // The existing redirectedUntil map prevents double-redirect.
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        for (const editor of editors) {
          void redirector.redirectIfNeeded(editor.document);
        }
      })
    );

    // Belt-and-suspenders: catch files already visible at activation time.
    setTimeout(() => {
      for (const editor of vscode.window.visibleTextEditors) {
        void redirector.redirectIfNeeded(editor.document);
      }
    }, 750);

    context.subscriptions.push(redirector);
    return redirector;
  }

  public allowTextOpen(uri: vscode.Uri): void {
    this.textBypassUntil.set(this.key(uri), Date.now() + REDIRECT_WINDOW_MS);
  }

  private async redirectIfNeeded(document: vscode.TextDocument): Promise<void> {
    if (!shouldUseBrowser() || !isHtmlFile(document.uri)) return;

    const key = this.key(document.uri);
    const now = Date.now();
    if ((this.textBypassUntil.get(key) ?? 0) > now) return;
    if ((this.redirectedUntil.get(key) ?? 0) > now) return;

    this.redirectedUntil.set(key, now + REDIRECT_WINDOW_MS);

    try {
      await openInIntegratedBrowser(document.uri);
      await this.closeMatchingSourceTabs(document.uri);
    } catch (err) {
      void vscode.window.showErrorMessage(
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  private async closeMatchingSourceTabs(uri: vscode.Uri): Promise<void> {
    // Once the browser editor is active, vscode.window.activeTextEditor is the
    // *previous* text editor, not the one we just promoted. Walk every tab in
    // every group and close any TabInputText whose URI matches our redirect.
    const targetKey = this.key(uri);
    const tabsToClose: vscode.Tab[] = [];
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        const input = tab.input;
        if (input instanceof vscode.TabInputText && this.key(input.uri) === targetKey) {
          tabsToClose.push(tab);
        }
      }
    }
    if (tabsToClose.length > 0) {
      await vscode.window.tabGroups.close(tabsToClose, true);
    }
  }

  private key(uri: vscode.Uri): string {
    return uri.scheme === 'file' ? path.normalize(uri.fsPath) : uri.toString();
  }

  public dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables.length = 0;
  }
}
