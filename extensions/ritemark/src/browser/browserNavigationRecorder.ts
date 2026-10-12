/**
 * Browser Recent recorder (Sprint 131, #195).
 *
 * Patch 009's `RitemarkBrowserHistoryContribution` calls DID_NAVIGATE_COMMAND for
 * every top-level navigation and title change of a browser tab an editor pane
 * shows, and once when a tab is first shown. This module decides what counts as
 * a visit; the patch only reports what the tab shows. It imports nothing from
 * `vscode`, so every rule is unit-tested without a stub.
 *
 * Spec: docs/development/releases/v1.14.0/sprint-131-browser-recent/spec.md (R1–R8).
 */

/** Must match RITEMARK_BROWSER_DID_NAVIGATE_COMMAND in patch 009 (a test checks it). */
export const DID_NAVIGATE_COMMAND = 'ritemark.browser.didNavigate';
export const MAX_URL_LENGTH = 8192;
export const MAX_TITLE_LENGTH = 300;
/** A tab must stay on a page this long before it counts (client redirects, R1 revised). */
export const SETTLE_MS = 1_000;
/** Title changes are taken only this long after the navigation (R5). */
export const TITLE_SETTLE_MS = 10_000;
const MAX_TRACKED_TABS = 200;
const RECORDED_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

export interface BrowserNavigationEvent {
  kind: 'navigate' | 'title';
  pageId: string;
  url: string;
  title: string;
  /** The page's main-frame load failed (the error page is showing). */
  failed: boolean;
  /** The tab browses in an ephemeral (private) storage session. */
  ephemeral: boolean;
}

/** Validates the command argument; undefined for anything malformed (R8). */
export function parseNavigationEvent(raw: unknown): BrowserNavigationEvent | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const e = raw as Record<string, unknown>;
  if (e.kind !== 'navigate' && e.kind !== 'title') return undefined;
  if (typeof e.pageId !== 'string' || !e.pageId) return undefined;
  if (typeof e.url !== 'string' || typeof e.title !== 'string') return undefined;
  if (typeof e.failed !== 'boolean' || typeof e.ephemeral !== 'boolean') return undefined;
  return { kind: e.kind, pageId: e.pageId, url: e.url, title: e.title, failed: e.failed, ephemeral: e.ephemeral };
}

/**
 * The address Recent stores: http/https/file only, WHATWG-normalized (host case,
 * default port, root slash), without user:password, at most MAX_URL_LENGTH
 * characters (R3, R4). Undefined when the address is not recorded.
 */
export function normalizeHistoryUrl(raw: string): string | undefined {
  if (raw.length > MAX_URL_LENGTH) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (!RECORDED_PROTOCOLS.has(parsed.protocol)) return undefined;
  parsed.username = '';
  parsed.password = '';
  return parsed.href.length > MAX_URL_LENGTH ? undefined : parsed.href;
}

/** Same document = the same address apart from its #fragment (R3). */
export function sameDocument(a: string, b: string): boolean {
  return withoutFragment(a) === withoutFragment(b);
}

/** Recent keeps one entry per page: the normalized address without its #fragment (R4). */
export function historyKey(url: string): string {
  return withoutFragment(normalizeHistoryUrl(url) ?? url);
}

function withoutFragment(url: string): string {
  const hash = url.indexOf('#');
  return hash === -1 ? url : url.slice(0, hash);
}

/**
 * One line, at most MAX_TITLE_LENGTH characters. Undefined when empty or when it
 * is Chromium's fallback for a page without a title: the address, the address
 * without its scheme, or a local file's name (R5, Phase 0 P2).
 */
export function cleanTitle(raw: string, url: string): string | undefined {
  const title = raw.replace(/\s+/g, ' ').trim();
  if (!title || fallbackTitles(url).has(title)) return undefined;
  return title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : title;
}

function fallbackTitles(url: string): Set<string> {
  const page = withoutFragment(url);
  const noScheme = page.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const titles = new Set([url, page, noScheme, page.replace(/\/$/, ''), noScheme.replace(/\/$/, '')]);
  try {
    const parsed = new URL(page);
    if (parsed.protocol === 'file:') {
      const filePath = decodeURIComponent(parsed.pathname);
      titles.add(filePath);
      titles.add(filePath.slice(filePath.lastIndexOf('/') + 1));
    }
  } catch {
    // Not a URL: the raw forms above are all there is.
  }
  return titles;
}

export interface HistorySink {
  record(url: string, title?: string): Promise<void>;
  setTitle(url: string, title: string): Promise<void>;
}

export interface RecorderClock {
  now(): number;
  /** Runs `callback` after `ms`; returns a function that cancels it. */
  schedule(callback: () => void, ms: number): () => void;
}

const realClock: RecorderClock = {
  now: () => Date.now(),
  schedule: (callback, ms) => {
    const handle = setTimeout(callback, ms);
    return () => clearTimeout(handle);
  },
};

interface TabState {
  /** Normalized address of the tab's current document. */
  url: string;
  /** When the tab navigated to it. */
  at: number;
  /** Best title so far. */
  title?: string;
  /** Title last written to the sink. */
  writtenTitle?: string;
  /** Set while the navigation waits SETTLE_MS before it counts. */
  cancel?: () => void;
}

export class BrowserNavigationRecorder {
  /** pageId → the tab's current document. Map order = least recently navigated first. */
  private readonly tabs = new Map<string, TabState>();

  constructor(
    private readonly sink: HistorySink,
    private readonly clock: RecorderClock = realClock
  ) {}

  handle(raw: unknown): void {
    const event = parseNavigationEvent(raw);
    if (!event || event.ephemeral) return;
    const url = normalizeHistoryUrl(event.url);
    if (!url) return;

    const tab = this.tabs.get(event.pageId);
    if (tab && sameDocument(url, tab.url)) {
      // A title change, a reload, a tab switch or an #anchor jump: not a new visit.
      this.applyTitle(tab, event.title);
      return;
    }
    if (event.kind === 'title' || event.failed) return;
    this.startNavigation(event.pageId, url, event.title, tab);
  }

  /** Records every navigation still waiting to settle. */
  dispose(): void {
    for (const tab of this.tabs.values()) {
      if (tab.cancel) {
        tab.cancel();
        this.settle(tab);
      }
    }
    this.tabs.clear();
  }

  private startNavigation(pageId: string, url: string, rawTitle: string, previous: TabState | undefined): void {
    // The tab left the previous page before it settled: a redirect hop or a page left at once.
    previous?.cancel?.();
    this.tabs.delete(pageId);
    const tab: TabState = { url, at: this.clock.now(), title: cleanTitle(rawTitle, url) };
    tab.cancel = this.clock.schedule(() => this.settle(tab), SETTLE_MS);
    this.tabs.set(pageId, tab);
    this.trimTrackedTabs();
  }

  private settle(tab: TabState): void {
    tab.cancel = undefined;
    tab.writtenTitle = tab.title;
    this.sink.record(tab.url, tab.title).catch(() => {
      // Storage failure: Recent misses this one visit.
    });
  }

  private applyTitle(tab: TabState, rawTitle: string): void {
    if (this.clock.now() - tab.at > TITLE_SETTLE_MS) return;
    const title = cleanTitle(rawTitle, tab.url);
    if (!title) return;
    tab.title = title;
    if (tab.cancel || title === tab.writtenTitle) return;
    tab.writtenTitle = title;
    this.sink.setTitle(tab.url, title).catch(() => {
      // Storage failure: the entry keeps its previous title.
    });
  }

  private trimTrackedTabs(): void {
    while (this.tabs.size > MAX_TRACKED_TABS) {
      const [oldestId, oldest] = this.tabs.entries().next().value as [string, TabState];
      if (oldest.cancel) {
        oldest.cancel();
        this.settle(oldest);
      }
      this.tabs.delete(oldestId);
    }
  }
}
