/**
 * Publishing's host controller (Sprint 149, W5, W6): the connection, Settings ▸ Sharing ▸ Web pages, the bar's
 * Publish, the page's states, and the way the token comes in. No `vscode` import: the adapter (`vscodePublish.ts`)
 * supplies the sheet, the password box, the browser and the context key, so every rule here tests under plain Node.
 *
 * - **What goes** is PR 3's plan, and only that: `publishPage` takes a `GatheredPlan`, which only `gatherPage`
 *   makes after its key scan, and the sheet's consent. A plan with a key-shaped hit needs "Publish anyway"; an
 *   update goes without the sheet only when `sheetNeeded` says so. The bytes are read again and matched to the
 *   plan's hashes (`readVerifiedUpload`) before anything is sent.
 * - **The record** of each published page is PR 3's (`publishRecords.ts`, `publish/v1/records.json`), with PR 3's
 *   `contentHash` for "Published · changed".
 * - **The token** comes in only through the host's own password box (`ui.askToken`), opened on a message that
 *   carries no value. It goes to the host, which keeps it in SecretStorage; it is never posted, logged or put in a
 *   projection.
 * - **The flag** `web-page-publishing` gates creating, connecting, publishing and updating. It never gates taking a
 *   page down: the list, Open, Unpublish and Disconnect work with it off (sprint-plan.md, *Feature Flag Check*).
 * - **`ritemark.publish.ready`** is set only with the flag on and the whole-window sheet available
 *   (`setPublishEntryAvailable`, from PR 5's `_ritemark.webviewSheet.open`). Until then the bar's Publish never shows,
 *   and nothing else reaches the sheet, the token box or the upload either: `ritemark.page.publish` from a keybinding
 *   or another extension, `publishPage`, `chooseSubdomain` and Settings' Set up all do nothing (round 3), so nobody
 *   connects Cloudflare and then finds no way to publish. Taking a page down never waits for it.
 */

import * as path from 'node:path';
import type { PublishedSite, PublishHost, VerifiedUpload } from './host';
import { PublishError, readVerifiedUpload } from './host';
import { isGatheredPlan } from './gather';
import { siteNameFor, suggestSubdomain } from './cloudflare/assets';
import { ADDRESS_TAKEN, CONNECT_AGAIN, COULD_NOT_REACH_PUBLISH, COULD_NOT_REACH_UNPUBLISH } from './cloudflare/CloudflareHost';
import { SubdomainExistsError } from './cloudflare/client';
import { recordFor, sheetNeeded, type PublishRecord, type PublishRecordStore } from './publishRecords';
import { decodeSettingsRequest, type WebPageRow, type WebPagesSettingsProjection } from './settingsProtocol';
import { isValidPagePart } from './sheetProtocol';
import { plainLine, plainPart } from './plainText';
import type { SheetConfirm, SheetConfirmReply, SheetOptions, SheetSetupResult } from './sheetModel';
import type { GatheredPlan, PublishPlan } from './types';

/** Cloudflare's token page, filled in where Cloudflare allows: the name "Ritemark" and Workers Scripts Edit (M10). */
export const TOKEN_TEMPLATE_URL = 'https://dash.cloudflare.com/?to=/:account/api-tokens'
  + `&permissionGroupKeys=${encodeURIComponent(JSON.stringify([{ key: 'workers_scripts', type: 'edit' }]))}`
  + '&name=Ritemark';

/** The lead's words for the host's password box (answer 8). */
export const TOKEN_BOX = {
  title: 'Cloudflare token',
  prompt: 'Paste the token Cloudflare showed you. Ritemark keeps it on this computer.',
} as const;

export const TOKEN_WORDS = {
  refused: "Cloudflare didn't accept this token. Copy it again from Cloudflare's page.",
  'cannot-publish': "This token can't publish pages. Make a new one on the page Ritemark opened.",
  unreachable: "Ritemark couldn't reach Cloudflare. Check the connection and try again.",
} as const;

export const NAME_TAKEN = 'This name is taken. Try another.';
export const SLOW_UNPUBLISH = 'Cloudflare is still taking the page down.';
/**
 * A first publish whose new address doesn't answer yet (A4, M6: 121 s on a brand-new workers.dev name), the lead's
 * words (6 November). A brief toast that names the page, since the person may be on another tab by then; shown at once
 * when the workers.dev name was registered in this publish, otherwise after 10 s.
 */
export function newAddressWait(pageTitle: string): string {
  return `The new address for ${pageTitle} can take a couple of minutes to open.`;
}
/** The Publishing… chip's tooltip for the whole wait, where the page is already in view (patch 010). */
export const NEW_ADDRESS_TIP = 'The new address can take a couple of minutes to open.';
/** A wait that showed the line ended: a brief toast, as the bar may show another page by then. */
export function publishedBrief(pageTitle: string): string {
  return `${pageTitle} is published.`;
}

/**
 * The page's title as its tab shows it: the page's own `<title>`, its spaces folded, else the file's name without
 * `.html`. Read from the bytes that went, so it is the title of what was published.
 */
export function pageTitleOf(upload: { files: readonly { urlPath: string; bytes: Uint8Array }[]; pageUrlPath: string } | null, pagePath: string): string {
  // The page's and the file's words are not ours: no link syntax, one line, 80 at most (plainText.ts)
  const fallback = plainPart(path.basename(pagePath).replace(/\.html?$/i, '')) || UNTITLED_PAGE;
  const page = upload?.files.find((f) => f.urlPath === upload.pageUrlPath);
  if (!page) return fallback;
  const head = Buffer.from(page.bytes.subarray(0, 65_536)).toString('utf8');
  const match = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head);
  if (!match) return fallback;
  const text = match[1]
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } as Record<string, string>)[n])
    .replace(/\s+/g, ' ')
    .trim();
  return plainPart(text) || fallback;
}

/** A page whose title and file name are both empty once cleaned. */
export const UNTITLED_PAGE = 'Untitled page';

/**
 * The adapter's lines, each made plain on its way out (plainText.ts): a failure, a wait, a toast and a connect line
 * carry a page's title, a file's name or a host's error text, and a notification would turn link syntax in them into a
 * command link.
 */
export function plainUi(ui: PublishUi): PublishUi {
  return {
    openExternal: (url) => ui.openExternal(url),
    askToken: (options) => ui.askToken(options),
    showSheet: (request) => ui.showSheet(request),
    showFailure: (line, retry) => ui.showFailure(plainLine(line), retry),
    showWaiting: (line) => ui.showWaiting(plainLine(line)),
    showBrief: (line) => ui.showBrief(plainLine(line)),
    showConnect: (line) => ui.showConnect(plainLine(line)),
  };
}

function safeChar(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}
export const OTHER_ACCOUNT = 'This page is on another Cloudflare account. Connect that account to unpublish it.';
export const OTHER_ACCOUNT_UPDATE = 'This page is on another Cloudflare account. Connect that account to update it.';
export const SWITCHED_OFF = 'Publishing is switched off in this version.';
/** A delete that went through, with the list on this computer not updated: the truth, not "still online". */
export const UNPUBLISHED_LIST_STALE = "The page is unpublished, but Ritemark couldn't update this list. Try again to remove it.";
/** A publish that went through, with its record not written. */
export const PUBLISHED_NOT_NOTED = "The page is online, but Ritemark couldn't note it on this computer. Publish again to note it.";
export const DISCONNECT_FAILED = "Ritemark couldn't disconnect Cloudflare. Try again.";
/** A plan with something key-shaped goes only by the sheet's "Publish anyway" (decision 2). */
export const KEY_NEEDS_SHEET = 'Something that would go looks like a key or password. Publish from the sheet to decide.';

/**
 * PR 5's whole-window sheet host: its open command (patch 018, `webviewSheet.ts`'s `WEBVIEW_SHEET_OPEN_COMMAND`, kept
 * equal by the test). Publish is reachable only once it exists.
 */
export const SHEET_HOST_COMMAND = '_ritemark.webviewSheet.open';

/**
 * Whether the whole-window sheet host is registered. Its name starts with `_`, so the list is asked for with the
 * internal commands in it (`getCommands(false)`). A failed lookup is "not there".
 */
export async function sheetHostAvailable(getCommands: (filterInternal: boolean) => PromiseLike<string[]>): Promise<boolean> {
  try {
    return (await getCommands(false)).includes(SHEET_HOST_COMMAND);
  } catch {
    return false;
  }
}

/** How the person agreed to what goes. */
export type PublishConsent =
  /** Publish in the sheet, with nothing key-shaped found. */
  | 'sheet'
  /** "Publish anyway" in the sheet, past the key warning: the second, explicit press. */
  | 'sheet-anyway'
  /** Update the page with the same files and nothing key-shaped: `sheetNeeded` is false. */
  | 'unchanged-update';

export interface PublishUi {
  openExternal(url: string): Promise<boolean>;
  /**
   * The host's own password box. `check` answers null to close it, or a line to show under it, keeping it open
   * (answer 8). Resolves when the box closes.
   */
  askToken(options: { title: string; prompt: string; check: (value: string) => Promise<string | null> }): Promise<void>;
  /**
   * The Publish sheet (PR 3's, `PublishSheetPanel.showPublishSheet`): frame 2 first when `plan` is null. Resolves
   * with the person's answer, after `onConfirm` let it close.
   */
  showSheet(request: {
    plan: PublishPlan | null;
    options: SheetOptions;
    setup?: { title: string; run: () => Promise<SheetSetupResult> };
    onConfirm: (confirm: SheetConfirm) => Promise<SheetConfirmReply>;
  }): Promise<{ kind: 'cancel' } | { kind: 'publish' | 'publishAnyway'; pagePart?: string; plan: PublishPlan }>;
  /** A failure line for the page, with Try again (R7). */
  showFailure(line: string, retry: () => void): void;
  /** A line that stays while something waits: the bar's Unpublish past 10 s. The returned function closes it. */
  showWaiting(line: string): () => void;
  /** A toast that goes by itself (patch 018's brief toast): a new address's wait (M6), and its end. */
  showBrief(line: string): void;
  /** A line whose way on is connecting (again) in Settings ▸ Sharing: the bar's Unpublish signed out or on another account. */
  showConnect(line: string): void;
}

/** The page's bar, as patch 010 draws it (spec R7, frame 4), through `_ritemark.publish.pageState`. */
export interface PageBarState {
  kind: 'unpublished' | 'publishing' | 'published' | 'unpublishing';
  address: string | null;
  /** "Published · changed". */
  changed: boolean;
  /** Signed out, or on another account: Update and Unpublish ask to connect first. */
  signedOut: boolean;
  /** Unpublishing for 10 s: "Cloudflare is still taking the page down." */
  slow: boolean;
  /** The failure line under the bar, with Try again. */
  line: string | null;
  /** Publishing…'s tooltip while a new address is awaited (patch 010 shows it in place of its own); else null. */
  tooltip: string | null;
}

/** A project page, as `pageCommands.publishPage` found it by real path. */
export interface ProjectPage {
  realPath: string;
  projectFolder: string;
}

export interface PublishControllerDeps {
  host: PublishHost & { accountId(): string | null };
  records: PublishRecordStore;
  ui: PublishUi;
  isFeatureEnabled: () => boolean;
  postSettings: (projection: WebPagesSettingsProjection) => void;
  setReady: (ready: boolean) => void;
  /** PR 3's gather and key scan (`gatherPage`). */
  gather: (pagePath: string, projectFolder: string) => Promise<GatheredPlan>;
  /** Tests only: how the plan's bytes are read again (`readVerifiedUpload`). */
  readUpload?: (plan: GatheredPlan) => Promise<VerifiedUpload>;
  /** A page's bar state changed (patch 010's bar asks again). */
  onPageState?: (pagePath: string) => void;
  log: (line: string) => void;
  now?: () => number;
  /** Tests only: the random end of a new page's address. */
  random?: () => Buffer;
}

export class PublishController {
  private enteringToken = false;
  private message: string | null = null;
  private entryAvailable = false;
  private readonly unpublishing = new Map<string, { slow: boolean }>();
  /** Sites taken down whose record couldn't be removed: never shown as online. */
  private readonly gone = new Set<string>();
  private readonly siteLines = new Map<string, string>();
  private readonly publishing = new Set<string>();
  private readonly sheets = new Set<string>();
  private readonly pageLines = new Map<string, string>();
  /** First publishes waiting for their new address to answer, with the line shown (M6). */
  private readonly waiting = new Map<string, string>();
  /** The same waits by site name: Unpublish (from Settings) during one ends it. */
  private readonly waitingSites = new Map<string, { stopped: boolean }>();
  private readonly now: () => number;
  private readonly readUpload: (plan: GatheredPlan) => Promise<VerifiedUpload>;
  /** `deps.ui`, its lines made plain: the only way this controller reaches a notification. */
  private readonly ui: PublishUi;

  constructor(private readonly deps: PublishControllerDeps) {
    this.ui = plainUi(deps.ui);
    this.now = deps.now ?? Date.now;
    this.readUpload = deps.readUpload ?? ((plan) => readVerifiedUpload(plan));
  }

  // ------------------------------------------------------------------ readiness

  /** The whole-window sheet host (PR 5) registers here; Publish is reachable only then, and with the flag on. */
  setPublishEntryAvailable(available: boolean): void {
    this.entryAvailable = available;
    this.refreshReady();
    void this.post(); // Settings offers Set up only now
  }

  refreshReady(): void {
    this.deps.setReady(this.canPublish());
  }

  /** The flag on and the whole-window sheet there: the one gate for every way into the sheet, the token box or the upload. */
  private canPublish(): boolean {
    return this.deps.isFeatureEnabled() && this.entryAvailable;
  }

  /** A page's record, unless it was taken down and only its removal failed (`unpublished`). */
  private async liveRecord(pagePath: string): Promise<PublishRecord | undefined> {
    const record = await this.deps.records.get(pagePath);
    return record && !record.unpublished && !this.gone.has(record.siteName) ? record : undefined;
  }

  // ------------------------------------------------------------------ Settings

  async settingsProjection(): Promise<WebPagesSettingsProjection> {
    const snapshot = this.deps.host.snapshot();
    const records = await this.deps.records.list();
    const pages: WebPageRow[] = records
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((r) => {
        const down = Boolean(r.unpublished) || this.gone.has(r.siteName);
        return {
          id: r.siteName,
          name: path.basename(r.pagePath),
          address: r.address,
          status: this.unpublishing.has(r.siteName) ? 'unpublishing' as const : down ? 'unpublished' as const : 'online' as const,
          slow: this.unpublishing.get(r.siteName)?.slow ?? false,
          // A page down whose record stayed: the truth, after a restart too
          message: this.siteLines.get(r.siteName) ?? (down ? UNPUBLISHED_LIST_STALE : null),
        };
      });
    return {
      enabled: this.deps.isFeatureEnabled(),
      entryAvailable: this.entryAvailable,
      state: snapshot.state,
      accountName: snapshot.accountName,
      subdomain: snapshot.subdomain,
      enteringToken: this.enteringToken,
      oauthAvailable: false,
      pages,
      message: this.message,
    };
  }

  private async post(): Promise<void> {
    try {
      this.deps.postSettings(await this.settingsProjection());
    } catch {
      this.deps.log('[publish] could not draw Settings ▸ Sharing ▸ Web pages');
    }
  }

  async handleSettingsMessage(raw: unknown): Promise<void> {
    const request = decodeSettingsRequest(raw);
    if (!request) return; // a malformed or unknown message does nothing, and is not echoed
    switch (request.type) {
      // No OAuth client in 2.2 (cut 1): Set up is the token path (S23)
      case 'publish:connect':
      case 'publish:startTokenEntry':
        await this.startTokenEntry();
        return;
      case 'publish:disconnect':
        await this.disconnect();
        return;
      case 'publish:open':
        await this.openSite(request.id);
        return;
      case 'publish:unpublish':
        await this.unpublishSite(request.id);
        return;
    }
  }

  /** Set up: Cloudflare's token page and the host's password box at once (answer 8). */
  async startTokenEntry(): Promise<void> {
    if (!this.canPublish() || this.enteringToken) return;
    this.enteringToken = true;
    this.message = null;
    await this.post();
    try {
      void this.ui.openExternal(TOKEN_TEMPLATE_URL).then(undefined, () => false);
      await this.ui.askToken({
        ...TOKEN_BOX,
        check: async (value) => {
          const outcome = await this.deps.host.connectWithToken(value);
          this.deps.log(`[publish] token check: ${outcome}`);
          if (outcome === 'connected') return null;
          return TOKEN_WORDS[outcome];
        },
      });
    } finally {
      this.enteringToken = false;
      this.refreshReady();
      await this.post();
    }
  }

  /**
   * Disconnect (R9): the page asked its question first. Published pages stay; the flag doesn't gate it. A failed
   * delete of the stored entry says so, and Settings is drawn again either way (Opus review of b07e7c11).
   */
  async disconnect(): Promise<void> {
    try {
      await this.deps.host.disconnect();
      this.message = null;
    } catch {
      this.deps.log('[publish] the stored Cloudflare connection could not be deleted');
      this.message = DISCONNECT_FAILED;
    }
    await this.post();
    await this.askBarsAgain();
  }

  /**
   * Another window connected or disconnected (the shared keychain entry changed): read it again, then draw an open
   * Settings page again and have every page bar ask for its state, as this window's own Set up and Disconnect do
   * (Codex's review of #668). A failed read still draws what is known.
   */
  async connectionChanged(reload: () => Promise<void>): Promise<void> {
    try {
      await reload();
    } catch {
      this.deps.log('[publish] could not read the stored Cloudflare connection again');
    }
    this.refreshReady();
    await this.post();
    await this.askBarsAgain();
  }

  /** Every published page's bar asks for its state again. */
  private async askBarsAgain(): Promise<void> {
    const pages = new Set((await this.deps.records.list().catch(() => [] as PublishRecord[])).map((r) => r.pagePath));
    for (const pagePath of pages) this.deps.onPageState?.(pagePath);
  }

  private async bySite(siteName: string): Promise<PublishRecord | undefined> {
    return (await this.deps.records.list()).find((r) => r.siteName === siteName);
  }

  async openSite(id: string): Promise<void> {
    const record = await this.bySite(id);
    if (!record || record.unpublished || this.gone.has(id) || !/^https:\/\/[a-z0-9.-]+\.workers\.dev\//.test(record.address)) return;
    await this.ui.openExternal(record.address);
  }

  /**
   * Unpublish (R7): the page asked its question first. Never gated by the flag (S28b).
   *
   * Settings shows each outcome in the page's row. The bar draws only its chip and its spinner (patch 010 reads the
   * state's kind), so an Unpublish started from the bar (`fromBar`) also says it out loud (Codex's review of #668):
   * "Cloudflare is still taking the page down." past 10 s, closed when it ends; a failure, or a page down with the list
   * behind, with Try again; and Connect again when signed out or on another account. The bar asks for its state again
   * at the end either way, so no spinner is left.
   */
  async unpublishSite(id: string, options: { fromBar?: boolean } = {}): Promise<void> {
    const record = await this.bySite(id);
    if (!record || this.unpublishing.has(id)) return;
    const fromBar = options.fromBar === true;
    this.siteLines.delete(id);
    const connected = this.deps.host.accountId();
    if (!connected || connected !== record.accountId) {
      const line = connected ? OTHER_ACCOUNT : CONNECT_AGAIN;
      this.siteLines.set(id, line);
      await this.post();
      if (fromBar) this.ui.showConnect(line);
      return;
    }
    let closeSlow: (() => void) | null = null;
    let failure: string | null = null;
    this.unpublishing.set(id, { slow: false });
    const wait = this.waitingSites.get(id);
    if (wait) wait.stopped = true;
    await this.post();
    this.deps.onPageState?.(record.pagePath);
    try {
      let down = false;
      try {
        await this.deps.host.unpublish(record.siteName, record.address, {
          onSlow: () => {
            this.unpublishing.set(id, { slow: true });
            void this.post();
            this.deps.onPageState?.(record.pagePath);
            if (fromBar && !closeSlow) {
              try {
                closeSlow = this.ui.showWaiting(SLOW_UNPUBLISH);
              } catch {
                closeSlow = () => undefined;
              }
            }
          },
        });
        down = true;
        await this.deps.records.remove(record.pagePath, record.siteName);
        this.gone.delete(id);
      } catch (error) {
        if (down) {
          // The page is down; only this computer's list is behind. Say that, never "still online", and note it in the
          // record, so a restart doesn't show it as published either
          this.gone.add(id);
          this.siteLines.set(id, UNPUBLISHED_LIST_STALE);
          failure = UNPUBLISHED_LIST_STALE;
          this.deps.log('[publish] unpublished, but the record could not be removed');
          await this.deps.records.markUnpublished(record.pagePath, record.siteName).catch(() => {
            this.deps.log('[publish] unpublished, and the record could not be marked either');
          });
        } else {
          failure = error instanceof PublishError ? error.message : COULD_NOT_REACH_UNPUBLISH;
          this.siteLines.set(id, failure);
        }
      }
    } finally {
      this.unpublishing.delete(id);
      try { (closeSlow as (() => void) | null)?.(); } catch { /* a closed line stays closed */ }
      await this.post();
      this.deps.onPageState?.(record.pagePath);
    }
    // After the state is back, so Try again starts afresh
    if (fromBar && failure) this.ui.showFailure(failure, () => { void this.unpublishSite(id, { fromBar: true }); });
  }

  // ------------------------------------------------------------------ the bar's Publish (R5, R7)

  /**
   * The bar's Publish, and the chip's Update the page: frame 2 while nothing is set up, then the gather and the key
   * scan, then frame 3 (or, for an update with the same files and nothing key-shaped, straight up), then the upload.
   * `page` is a project page by real path (`pageCommands.publishPage` refused anything else).
   */
  async publishFromBar(page: ProjectPage): Promise<void> {
    if (!this.canPublish()) return; // ritemark.page.publish from a keybinding or code, before PR 5's sheet: nothing
    const key = page.realPath;
    if (this.publishing.has(key) || this.sheets.has(key)) return;
    this.sheets.add(key);
    let chosen: { plan: GatheredPlan; consent: PublishConsent; pagePart?: string; newName?: boolean } | null = null;
    try {
      const title = path.basename(key).replace(/\.html?$/i, '');
      let prepared: Prepared | null = null;
      let stopLine: string | null = null;
      const prepare = async (): Promise<Prepared | null> => {
        try {
          return await this.prepare(page);
        } catch (error) {
          stopLine = error instanceof PublishError ? error.message : COULD_NOT_REACH_PUBLISH;
          return null;
        }
      };
      if (this.deps.host.snapshot().state === 'connected') {
        prepared = await prepare();
        if (!prepared) return this.fail(key, stopLine ?? COULD_NOT_REACH_PUBLISH, page);
        if (prepared.record && !sheetNeeded(prepared.record, prepared.plan)) {
          chosen = { plan: prepared.plan, consent: 'unchanged-update' };
        }
      }
      if (!chosen) {
        let current = prepared;
        const answer = await this.ui.showSheet({
          plan: current?.plan ?? null,
          options: current?.options ?? {},
          setup: current ? undefined : {
            title,
            run: async () => {
              await this.startTokenEntry();
              if (this.deps.host.snapshot().state !== 'connected') return null;
              current = await prepare();
              return current ? { plan: current.plan, options: current.options } : { stop: true };
            },
          },
          onConfirm: async (confirm) => {
            if (!current) return { kind: 'stop' };
            const reply = await this.confirmSheet(current, confirm);
            if (reply.kind === 'stop') stopLine = this.pageLines.get(key) ?? COULD_NOT_REACH_PUBLISH;
            return reply;
          },
        });
        if (stopLine) return this.fail(key, stopLine, page);
        if (answer.kind === 'cancel' || !current) return;
        if (answer.plan !== current.plan) return; // never another plan than the one prepared here
        chosen = { plan: current.plan, consent: answer.kind === 'publishAnyway' ? 'sheet-anyway' : 'sheet', pagePart: answer.pagePart, newName: current.newName };
      }
    } finally {
      this.sheets.delete(key);
    }
    if (!chosen) return;
    try {
      await this.publishPage(chosen);
    } catch (error) {
      this.fail(key, error instanceof PublishError ? error.message : COULD_NOT_REACH_PUBLISH, page);
    }
  }

  private fail(pagePath: string, line: string, page: ProjectPage): void {
    this.pageLines.set(pagePath, line);
    this.deps.onPageState?.(pagePath);
    this.ui.showFailure(line, () => { void this.publishFromBar(page); });
  }

  /** The account's name read again, the gather and scan, and the sheet's rows (R5, answer 5). */
  private async prepare(page: ProjectPage): Promise<Prepared> {
    const accountId = this.deps.host.accountId();
    if (!accountId) throw new PublishError('not-connected', CONNECT_AGAIN);
    const record = await this.liveRecord(page.realPath);
    if (record && record.accountId !== accountId) throw new PublishError('failed', OTHER_ACCOUNT_UPDATE);
    const subdomain = await this.deps.host.refreshSubdomain();
    const plan = await this.deps.gather(page.realPath, page.projectFolder);
    const accountName = this.deps.host.snapshot().accountName;
    const options: SheetOptions = {
      destination: { name: 'Your Cloudflare', detail: accountName ?? 'Your account' },
    };
    if (record) {
      options.address = { page: record.siteName, suffix: `.${subdomain ?? 'workers'}.workers.dev`, editable: false };
    } else {
      const suggestion = subdomain ? null : suggestSubdomain();
      options.address = { page: siteNameFor(path.basename(page.realPath), this.deps.random), suffix: `.${subdomain ?? suggestion}.workers.dev`, editable: true };
      if (suggestion) options.nameRow = { suggestion };
    }
    return { plan, options, record };
  }

  /**
   * A press of Publish, before the sheet closes: the page part, the workers.dev name (registered only while the
   * account has none), and an address already on the account. A refusal keeps the sheet open with its line.
   */
  private async confirmSheet(prepared: Prepared, confirm: SheetConfirm): Promise<SheetConfirmReply> {
    if (!prepared.record && !isValidPagePart(confirm.pagePart)) return { kind: 'refuse', reason: 'addressInvalid' };
    if (prepared.options.nameRow) {
      const result = await this.chooseSubdomain(confirm.subdomain ?? '');
      if ('existing' in result) {
        // The account had a name after all: kept, never renamed; the sheet shows the address it really gets
        prepared.options = { ...prepared.options, nameRow: undefined, address: { ...prepared.options.address!, suffix: `.${result.existing}.workers.dev` } };
        return { kind: 'update', options: prepared.options };
      }
      if ('error' in result) {
        if (result.error === NAME_TAKEN) return { kind: 'refuse', reason: 'nameTaken' };
        this.pageLines.set(prepared.plan.pagePath, result.error);
        return { kind: 'stop' };
      }
      prepared.options = { ...prepared.options, nameRow: undefined, address: { ...prepared.options.address!, suffix: `.${result.name}.workers.dev` } };
      prepared.newName = true; // registered now: its first page takes a while to answer (M6)
    }
    if (!prepared.record) {
      try {
        if (await this.deps.host.siteExists(confirm.pagePart!)) return { kind: 'refuse', reason: 'addressTaken' };
      } catch (error) {
        this.pageLines.set(prepared.plan.pagePath, error instanceof PublishError ? error.message : COULD_NOT_REACH_PUBLISH);
        return { kind: 'stop' };
      }
    }
    return { kind: 'close' };
  }

  /** The name row's choice. Taken or not allowed: "This name is taken. Try another.", and Publish waits. */
  async chooseSubdomain(typed: string): Promise<{ name: string } | { existing: string } | { error: string }> {
    if (!this.canPublish()) return { error: SWITCHED_OFF };
    try {
      return { name: await this.deps.host.chooseSubdomain(typed) };
    } catch (error) {
      if (error instanceof SubdomainExistsError) return { existing: error.existing };
      if (error instanceof PublishError && (error.code === 'name-taken' || error.code === 'name-invalid')) return { error: NAME_TAKEN };
      return { error: error instanceof PublishError ? error.message : "Ritemark couldn't reach Cloudflare. Try again." };
    }
  }

  /**
   * Publish or Update one page (R7). Takes only PR 3's gather-and-scan result and the person's consent: a plan
   * `gatherPage` didn't make is refused, a key-shaped hit needs the sheet's "Publish anyway", and an update without
   * the sheet needs `sheetNeeded` to be false. Update keeps the record's site name, so the address stays (M8); a new
   * page's part of the address is checked again here.
   *
   * A first publish then waits, still "Publishing…", until its new address answers or the host's cap (A4, M6: 121 s
   * on a brand-new workers.dev name), with `NEW_ADDRESS_WAIT` shown at once when `newName` (the name was registered
   * in this publish), otherwise once the wait is slow. The record is written before the wait: the page is online.
   */
  async publishPage(input: { plan: GatheredPlan; consent: PublishConsent; pagePart?: string; newName?: boolean }): Promise<PublishedSite> {
    if (!this.canPublish()) throw new PublishError('failed', SWITCHED_OFF);
    const { plan, consent } = input;
    if (!isGatheredPlan(plan)) throw new PublishError('failed', 'Ritemark could not check what goes. Press Publish again.');
    const accountId = this.deps.host.accountId();
    if (!accountId) throw new PublishError('not-connected', CONNECT_AGAIN);
    if (plan.tooBig.length > 0 || plan.tooMany) throw new PublishError(plan.tooMany ? 'too-many' : 'too-big', 'This page is too big for Cloudflare\'s free plan. Nothing was sent.');
    const pagePath = plan.pagePath;
    if (this.publishing.has(pagePath)) throw new PublishError('failed', 'This page is being published.');
    const record = await this.liveRecord(pagePath);
    if (record && record.accountId !== accountId) throw new PublishError('failed', OTHER_ACCOUNT_UPDATE);
    if (plan.keyHits.length > 0 && consent !== 'sheet-anyway') throw new PublishError('failed', KEY_NEEDS_SHEET);
    if (consent === 'unchanged-update' && (!record || sheetNeeded(record, plan))) {
      throw new PublishError('failed', 'What goes changed. Press Publish to see it.');
    }
    let siteName: string;
    if (record) siteName = record.siteName;
    else if (isValidPagePart(input.pagePart)) siteName = input.pagePart;
    else throw new PublishError('name-invalid', 'Use lowercase letters, digits and dashes, and keep the six at the end.');

    this.publishing.add(pagePath);
    this.pageLines.delete(pagePath);
    this.deps.onPageState?.(pagePath);
    try {
      // Exactly the bytes the scan read, or nothing (PR 3's blocking item)
      const upload = await this.readUpload(plan);
      const site = await this.deps.host.publish(siteName, upload, { replacing: Boolean(record) });
      this.gone.delete(site.name);
      try {
        await this.deps.records.put(recordFor(plan, { accountId, siteName: site.name, address: site.address }, new Date(this.now())));
      } catch {
        this.deps.log('[publish] published, but the record could not be written');
        this.pageLines.set(pagePath, PUBLISHED_NOT_NOTED);
      }
      await this.post();
      if (!record) await this.waitForFirstAnswer(pagePath, site, input.newName === true, pageTitleOf(upload, pagePath));
      return site;
    } catch (error) {
      const line = error instanceof PublishError
        ? (error.code === 'address-taken' ? ADDRESS_TAKEN : error.message)
        : COULD_NOT_REACH_PUBLISH;
      this.pageLines.set(pagePath, line);
      throw error instanceof PublishError ? error : new PublishError('failed', line);
    } finally {
      this.publishing.delete(pagePath);
      this.deps.onPageState?.(pagePath);
    }
  }

  /**
   * "Publishing…" until a new address answers (M6); never a failure, whatever the wait's end. Once the wait is known to
   * be long, a brief toast names the page and Publishing…'s tooltip says why for the rest of the wait; when that wait
   * ends with the page online (or at the cap, the upload having gone through), a brief toast says it is published.
   */
  private async waitForFirstAnswer(pagePath: string, site: PublishedSite, newName: boolean, title: string): Promise<void> {
    let shown = false;
    const brief = (line: string) => {
      try { this.ui.showBrief(line); } catch { /* a toast that can't show changes nothing */ }
    };
    const showLine = () => {
      if (shown) return;
      shown = true;
      this.waiting.set(pagePath, NEW_ADDRESS_TIP);
      brief(newAddressWait(title));
      this.deps.onPageState?.(pagePath);
    };
    const wait = { stopped: false };
    this.waitingSites.set(site.name, wait);
    if (newName) showLine();
    let published = false;
    try {
      const end = await this.deps.host.waitUntilOnline(site.address, { onSlow: showLine, stop: () => wait.stopped });
      this.deps.log(`[publish] ${site.name}: ${end === 'online' ? 'the new address answers' : end === 'stopped' ? 'the wait for the new address was stopped' : 'the new address has not answered yet'}`);
      published = end !== 'stopped';
    } catch {
      this.deps.log('[publish] the wait for the new address ended early');
    } finally {
      this.waiting.delete(pagePath);
      if (this.waitingSites.get(site.name) === wait) this.waitingSites.delete(site.name);
    }
    if (shown && published) brief(publishedBrief(title));
  }

  /** The bar's state for a page. `currentHash` is PR 3's `contentHash` of what would go now, when known. */
  async pageState(pagePath: string, currentHash?: string): Promise<PageBarState> {
    const stored = await this.deps.records.get(pagePath);
    const record = stored && !stored.unpublished && !this.gone.has(stored.siteName) ? stored : undefined;
    const line = this.pageLines.get(pagePath) ?? (stored ? this.siteLines.get(stored.siteName) ?? null : null);
    if (this.publishing.has(pagePath)) {
      return { kind: 'publishing', address: record?.address ?? null, changed: false, signedOut: false, slow: false, line: null, tooltip: this.waiting.get(pagePath) ?? null };
    }
    if (!record) return { kind: 'unpublished', address: null, changed: false, signedOut: false, slow: false, line, tooltip: null };
    const going = this.unpublishing.get(record.siteName);
    const connected = this.deps.host.accountId();
    return {
      kind: going ? 'unpublishing' : 'published',
      address: record.address,
      changed: currentHash !== undefined && currentHash !== record.contentHash,
      signedOut: connected !== record.accountId,
      slow: going?.slow ?? false,
      line: going?.slow ? SLOW_UNPUBLISH : line,
      tooltip: null,
    };
  }

  /** The page's record while it is online, for the bar's Copy link, Open the page and Unpublish. */
  recordFor(pagePath: string): Promise<PublishRecord | undefined> {
    return this.liveRecord(pagePath);
  }

  /**
   * Whether the bar's answer needs "what would go now" (PR 3's gather and scan, for "Published · changed"): only for a
   * page shown as published. Publishing…, Unpublishing… and an unpublished page skip the gather.
   */
  async needsCurrentHash(pagePath: string): Promise<boolean> {
    if (this.publishing.has(pagePath)) return false;
    const record = await this.liveRecord(pagePath);
    return Boolean(record) && !this.unpublishing.has(record!.siteName);
  }

  /** The bar's Unpublish, after its question. */
  async unpublishPage(pagePath: string): Promise<void> {
    const record = await this.liveRecord(pagePath);
    if (record) await this.unpublishSite(record.siteName, { fromBar: true });
  }
}

interface Prepared {
  plan: GatheredPlan;
  options: SheetOptions;
  record: PublishRecord | undefined;
  /** The workers.dev name was registered in this sheet (M6: its first page takes a while to answer). */
  newName?: boolean;
}
