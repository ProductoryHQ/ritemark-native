import * as vscode from 'vscode';

/**
 * Extension-side wrappers around the patch 010 workbench bridge commands.
 * Each function executes a Playwright-driven browser action in one integrated
 * browser page and returns the post-action ARIA summary so the AI agent sees
 * the resulting page state in a single round trip.
 *
 * Which page (#658): the page the AI's turn was given, named by its id in a
 * `BrowserActionTarget`. Patch 010 finds that page by id; a tab or desk
 * brought to the front during the turn never moves the actions, and a page
 * that has closed is an error, never the active tab instead.
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
  /** #658: the page named by the target's `pageId` is no longer open; nothing was done. */
  pageGone?: boolean;
  /** #658: every browser page open in the window, by id only (patch 010). */
  pageIds?: string[];
  /** #658: pages that opened since the target's `knownPageIds`. Title and address only for a shared page. */
  newPages?: BrowserPageInfo[];
}

/** #658: a browser page that opened since the AI's last browser action. */
export interface BrowserPageInfo {
  pageId: string;
  shared: boolean;
  title?: string;
  url?: string;
}

/** #658: the page an action acts in, sent to patch 010 beside the action's own arguments. */
export interface BrowserActionTarget {
  /** The turn's page, or a page a tool result named. */
  pageId?: string;
  /** The page is not the turn's: patch 010 acts only if it is shared already. */
  requireShared?: boolean;
  /** The page ids known after the last action, so a new page is named once. */
  knownPageIds?: string[];
  /** navigate with an address, and the turn has no page: open a new tab. */
  newTab?: boolean;
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

/**
 * Serializes browser tool calls across ALL conversations (Sprint 99, decision D2).
 *
 * There is one integrated browser and one active tab, so every browser tool is a
 * command against shared state. With parallel chats, chat A's navigate could land
 * between chat B's navigate and its snapshot, and B would then reason about A's
 * page — silently, and non-deterministically. Serializing here, at the single
 * chokepoint every action funnels through, makes each action atomic with respect
 * to the others.
 *
 * This does NOT give each chat its own browser: B may still snapshot a page A
 * navigated to, it just cannot happen mid-action. Per-chat browsers would need
 * per-chat tab ownership in the workbench, which is shell-tier and out of scope
 * — recorded as a known limitation in the sprint's scenarios.
 */
let browserActionChain: Promise<unknown> = Promise.resolve();

async function callBrowserAction(command: string, args?: Record<string, unknown>): Promise<BrowserActionResult> {
  // Queue behind whatever is in flight. The chain is kept un-rejectable so one
  // failed action cannot wedge every later one.
  const run = browserActionChain.then(
    () => runBrowserAction(command, args),
    () => runBrowserAction(command, args),
  );
  browserActionChain = run.then(() => undefined, () => undefined);
  return run;
}

async function runBrowserAction(command: string, args?: Record<string, unknown>): Promise<BrowserActionResult> {
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

function withTarget(args: object, target: BrowserActionTarget | undefined): Record<string, unknown> {
  return { ...(args as Record<string, unknown>), ...(target ?? {}) };
}

export function browserNavigate(args: BrowserNavigateArgs, target?: BrowserActionTarget): Promise<BrowserActionResult> {
  return callBrowserAction(BROWSER_NAVIGATE_COMMAND, withTarget(args, target));
}

export function browserClick(args: BrowserClickArgs, target?: BrowserActionTarget): Promise<BrowserActionResult> {
  return callBrowserAction(BROWSER_CLICK_COMMAND, withTarget(args, target));
}

export function browserFill(args: BrowserFillArgs, target?: BrowserActionTarget): Promise<BrowserActionResult> {
  return callBrowserAction(BROWSER_FILL_COMMAND, withTarget(args, target));
}

export function browserType(args: BrowserTypeArgs, target?: BrowserActionTarget): Promise<BrowserActionResult> {
  return callBrowserAction(BROWSER_TYPE_COMMAND, withTarget(args, target));
}

export function browserScroll(args: BrowserScrollArgs, target?: BrowserActionTarget): Promise<BrowserActionResult> {
  return callBrowserAction(BROWSER_SCROLL_COMMAND, withTarget(args, target));
}

export function browserSnapshot(target?: BrowserActionTarget): Promise<BrowserActionResult> {
  return target ? callBrowserAction(BROWSER_SNAPSHOT_COMMAND, { ...target }) : callBrowserAction(BROWSER_SNAPSHOT_COMMAND);
}

/**
 * The browser page one conversation's AI acts in (#658).
 *
 * At the start of each turn the host sets the turn's page: the page the turn's
 * browser context came from, or else the browser page in front (none when a
 * document is in front). Every browser tool sends that page's id, so patch 010
 * acts in it even after another tab or desk comes to the front. The AI may name
 * another page with `page_id`, but only a page a tool result gave it (a popup
 * its click opened, say), and only once that page is shared: patch 010 never
 * shares a page the AI was not given. When the turn has no page, navigate with
 * an address opens a new tab, and that tab becomes the turn's page.
 *
 * One holder per conversation (`browserTurnPageFor`): Claude keeps the MCP
 * server of its session's first turn, so its tools read the holder, not a value
 * captured when the server was made.
 */
export class BrowserTurnPage {
  private turnPageId: string | undefined;
  private knownPageIds: string[] | undefined;

  /**
   * A turn starts with this page (undefined: the turn has none). The pages known from an earlier turn are forgotten:
   * patch 010 then takes the pages open when the turn's first action starts as known, so a tab the person opened
   * between turns is never announced, and only a page that opens during this turn is.
   */
  startTurn(pageId: string | undefined): void {
    this.turnPageId = pageId;
    this.knownPageIds = undefined;
  }

  get pageId(): string | undefined {
    return this.turnPageId;
  }

  /** The target for one action; `explicit` is the AI's `page_id`. Null when the action has no page. */
  target(explicit?: string): BrowserActionTarget | null {
    const pageId = explicit ?? this.turnPageId;
    if (!pageId) return null;
    return {
      pageId,
      ...(explicit !== undefined && explicit !== this.turnPageId ? { requireShared: true } : {}),
      ...(this.knownPageIds ? { knownPageIds: [...this.knownPageIds] } : {}),
    };
  }

  /** The target for navigate when the turn has no page: a new tab. */
  newTabTarget(): BrowserActionTarget {
    return { newTab: true, ...(this.knownPageIds ? { knownPageIds: [...this.knownPageIds] } : {}) };
  }

  /** After an action: remember the window's pages; `adopt` makes the page the action opened the turn's page. */
  noteResult(result: BrowserActionResult, options: { adopt?: boolean } = {}): void {
    if (Array.isArray(result.pageIds)) this.knownPageIds = result.pageIds.filter((id) => typeof id === 'string');
    if (options.adopt && typeof result.pageId === 'string' && !result.pageGone) this.turnPageId = result.pageId;
  }
}

/**
 * The page a turn starts with: the page its browser context came from, else the browser page in front now (none with
 * a document in front). A context dropped on purpose (a comment task, or a page other than the one asked about after
 * the share wait) leaves the turn with no page at all; it never falls back to the page in front.
 */
export async function chooseTurnPage(options: {
  contextPageId: string | undefined;
  contextDropped: boolean;
  activePageId: () => Promise<string | undefined>;
}): Promise<string | undefined> {
  if (options.contextPageId) return options.contextPageId;
  return options.contextDropped ? undefined : options.activePageId();
}

/**
 * #658: what a turn's share wait leaves it. `askedPageId`: the page the share question was about (none: no question
 * waited on). `contextPageId`: the page the turn's browser context came from (none: no context). Without a question the
 * context stands as it is. After one, only the page asked about may be the turn's, and only when it gave the context: a
 * page brought to the front meanwhile was not the question, and a page the person declined (Not now) gives no context
 * and is dropped, so the turn never falls back to it as the page in front.
 */
export function pageAfterShareWait(options: { askedPageId: string | undefined; contextPageId: string | undefined; hasContext: boolean }): {
  useContext: boolean;
  dropped: boolean;
} {
  if (!options.askedPageId) return { useContext: options.hasContext, dropped: false };
  const fromAsked = options.hasContext && options.contextPageId === options.askedPageId;
  return { useContext: fromAsked, dropped: !fromAsked };
}

/**
 * #658: the browser context a turn gets after its share wait, and whether its page was dropped on purpose. The whole
 * decision is here: the caller passes the wait's page and the context it built, and uses only what comes back.
 */
export function contextAfterShareWait<T extends { snapshot: { pageId?: string } }>(
  askedPageId: string | undefined,
  context: T | null | undefined,
): { context: T | null; dropped: boolean } {
  const { useContext, dropped } = pageAfterShareWait({ askedPageId, contextPageId: context?.snapshot.pageId, hasContext: Boolean(context) });
  return { context: useContext && context ? context : null, dropped };
}

const turnPages = new Map<string, BrowserTurnPage>();

/** The conversation's page holder, the same object for every turn. */
export function browserTurnPageFor(conversationId: string): BrowserTurnPage {
  let page = turnPages.get(conversationId);
  if (!page) {
    page = new BrowserTurnPage();
    turnPages.set(conversationId, page);
  }
  return page;
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
  if (result.pageId && !result.pageGone) {
    lines.push(`Page id: ${result.pageId}`);
  }
  if (result.summary) {
    lines.push('Page summary after action:');
    lines.push(result.summary);
  } else if (!result.error) {
    lines.push('Action completed. (No updated summary returned.)');
  }
  for (const page of result.newPages ?? []) {
    lines.push(newPageLine(page));
  }
  return lines.join('\n');
}

/** #658: how a new page is named to the AI. A page not shared gets its id alone. */
function newPageLine(page: BrowserPageInfo): string {
  if (!page.shared) {
    return `A new browser page opened (page id ${page.pageId}). It is not shared with you: before you act in it, the user must share it. Your actions stay in the page you were given.`;
  }
  const name = [page.title ? `"${page.title}"` : undefined, page.url].filter(Boolean).join(' ');
  return `A new browser page opened: ${name || '(untitled)'}, page id ${page.pageId}. To act in it, pass page_id "${page.pageId}"; without page_id your actions stay in the page you were given.`;
}
