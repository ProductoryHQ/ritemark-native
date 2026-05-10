import * as vscode from 'vscode';
import { BrowserHistoryStore } from './BrowserHistoryStore';

const OPEN_BROWSER_COMMAND = 'workbench.action.browser.open';
const GO_BACK_COMMAND = 'workbench.action.browser.goBack';
const GO_FORWARD_COMMAND = 'workbench.action.browser.goForward';
const RELOAD_COMMAND = 'workbench.action.browser.reload';
const OPEN_EXTERNAL_COMMAND = 'workbench.action.browser.openExternal';

let historyStore: BrowserHistoryStore | undefined;

export function setBrowserHistoryStore(store: BrowserHistoryStore | undefined): void {
  historyStore = store;
}

export function normalizeBrowserUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('URL must not be empty.');
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\[::]):\d+(?:\/|$)/i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  return `https://${trimmed}`;
}

export async function openInIntegratedBrowser(target: string | vscode.Uri): Promise<void> {
  const url = typeof target === 'string' ? normalizeBrowserUrl(target) : target.toString();
  await vscode.commands.executeCommand(OPEN_BROWSER_COMMAND, { url, openToSide: false });
  void historyStore?.record(url);
}

export async function openEmptyBrowserTab(): Promise<void> {
  await vscode.commands.executeCommand(OPEN_BROWSER_COMMAND, {});
}

export async function goBackInIntegratedBrowser(): Promise<void> {
  await vscode.commands.executeCommand(GO_BACK_COMMAND);
}

export async function goForwardInIntegratedBrowser(): Promise<void> {
  await vscode.commands.executeCommand(GO_FORWARD_COMMAND);
}

export async function reloadIntegratedBrowser(): Promise<void> {
  await vscode.commands.executeCommand(RELOAD_COMMAND);
}

export async function openIntegratedBrowserUrlExternally(raw?: string): Promise<void> {
  if (raw?.trim()) {
    await vscode.env.openExternal(vscode.Uri.parse(normalizeBrowserUrl(raw)));
    return;
  }

  await vscode.commands.executeCommand(OPEN_EXTERNAL_COMMAND);
}
