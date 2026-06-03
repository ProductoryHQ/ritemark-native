import * as vscode from 'vscode';

/**
 * Extension-side wrappers around the patch 010 workbench bridge commands.
 * Each function executes a Playwright-driven browser action in the active
 * integrated browser tab and returns the post-action ARIA summary so the
 * AI agent sees the resulting page state in a single round trip.
 *
 * All actions require:
 *   1. The `browser-agent-control` feature flag to be enabled.
 *   2. Control consent for the active tab (see BrowserContextStore.ensureControlConsentForActiveTab).
 *
 * Tools never throw on workbench errors — they always return a typed result
 * with either `summary` or `error`, so the AI runtime can surface failures
 * to the model as a tool result instead of breaking the turn.
 */

const ENSURE_CONTROL_SHARED_COMMAND = 'workbench.action.browser.ensureActiveBrowserControlShared';
const BROWSER_NAVIGATE_COMMAND = 'workbench.action.browser.agentNavigate';
const BROWSER_CLICK_COMMAND = 'workbench.action.browser.agentClick';
const BROWSER_FILL_COMMAND = 'workbench.action.browser.agentFill';
const BROWSER_TYPE_COMMAND = 'workbench.action.browser.agentType';
const BROWSER_SCROLL_COMMAND = 'workbench.action.browser.agentScroll';
const BROWSER_SNAPSHOT_COMMAND = 'workbench.action.browser.agentSnapshot';

export interface BrowserActionResult {
  pageId?: string;
  url?: string;
  title?: string;
  summary?: string;
  error?: string;
}

export interface BrowserNavigateArgs {
  url?: string;
  type?: 'url' | 'back' | 'forward' | 'reload';
}

export interface BrowserClickArgs {
  ref?: string;
  selector?: string;
  button?: 'left' | 'right' | 'middle';
  dblClick?: boolean;
}

export interface BrowserFillArgs {
  ref?: string;
  selector?: string;
  value: string;
}

export interface BrowserTypeArgs {
  text?: string;
  key?: string;
}

export interface BrowserScrollArgs {
  direction?: 'up' | 'down' | 'top' | 'bottom' | 'into-view';
  amount?: number;
  ref?: string;
  selector?: string;
}

function isBrowserActionResult(value: unknown): value is BrowserActionResult {
  return Boolean(value && typeof value === 'object');
}

async function callBrowserAction(command: string, args?: Record<string, unknown>): Promise<BrowserActionResult> {
  try {
    const result = args === undefined
      ? await vscode.commands.executeCommand<unknown>(command)
      : await vscode.commands.executeCommand<unknown>(command, args);
    if (isBrowserActionResult(result)) {
      return result;
    }
    return { error: `Browser command "${command}" returned an unexpected result.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export function browserNavigate(args: BrowserNavigateArgs): Promise<BrowserActionResult> {
  return callBrowserAction(BROWSER_NAVIGATE_COMMAND, args as unknown as Record<string, unknown>);
}

export function browserClick(args: BrowserClickArgs): Promise<BrowserActionResult> {
  return callBrowserAction(BROWSER_CLICK_COMMAND, args as unknown as Record<string, unknown>);
}

export function browserFill(args: BrowserFillArgs): Promise<BrowserActionResult> {
  return callBrowserAction(BROWSER_FILL_COMMAND, args as unknown as Record<string, unknown>);
}

export function browserType(args: BrowserTypeArgs): Promise<BrowserActionResult> {
  return callBrowserAction(BROWSER_TYPE_COMMAND, args as unknown as Record<string, unknown>);
}

export function browserScroll(args: BrowserScrollArgs): Promise<BrowserActionResult> {
  return callBrowserAction(BROWSER_SCROLL_COMMAND, args as unknown as Record<string, unknown>);
}

export function browserSnapshot(): Promise<BrowserActionResult> {
  return callBrowserAction(BROWSER_SNAPSHOT_COMMAND);
}

export function ensureBrowserControlConsent(): Promise<BrowserActionResult> {
  return callBrowserAction(ENSURE_CONTROL_SHARED_COMMAND);
}

/**
 * Format a BrowserActionResult as a single string suitable for returning as
 * an AI tool result. Keeps the structure stable so the model can reason
 * about success/failure consistently across all browser tools.
 */
export function formatActionResultForAgent(result: BrowserActionResult): string {
  const lines: string[] = [];
  if (result.error) {
    lines.push(`Error: ${result.error}`);
  }
  if (result.url) {
    lines.push(`URL: ${result.url}`);
  }
  if (result.title) {
    lines.push(`Title: ${result.title}`);
  }
  if (result.summary) {
    lines.push('Page summary after action:');
    lines.push(result.summary);
  } else if (!result.error) {
    lines.push('Action completed. (No updated summary returned.)');
  }
  return lines.join('\n');
}
