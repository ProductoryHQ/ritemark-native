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
 *   (`setPublishEntryAvailable`, from PR 5's `_ritemark.webviewSheet`). Until then the bar's Publish never shows,
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

/** PR 5's whole-window sheet host (patch 018, `_ritemark.webviewSheet`). Publish is reachable only once it exists. */
export const SHEET_HOST_COMMAND = '_ritemark.webviewSheet';

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
  private readonly now: () => number;
  private readonly readUpload: (plan: GatheredPlan) => Promise<VerifiedUpload>;

  constructor(private readonly deps: PublishControllerDeps) {
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
      void this.deps.ui.openExternal(TOKEN_TEMPLATE_URL).then(undefined, () => false);
      await this.deps.ui.askToken({
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
    for (const r of await this.deps.records.list().catch(() => [] as PublishRecord[])) this.deps.onPageState?.(r.pagePath);
  }

  private async bySite(siteName: string): Promise<PublishRecord | undefined> {
    return (await this.deps.records.list()).find((r) => r.siteName === siteName);
  }

  async openSite(id: string): Promise<void> {
    const record = await this.bySite(id);
    if (!record || record.unpublished || this.gone.has(id) || !/^https:\/\/[a-z0-9.-]+\.workers\.dev\//.test(record.address)) return;
    await this.deps.ui.openExternal(record.address);
  }

  /** Unpublish (R7): the page asked its question first. Never gated by the flag (S28b). */
  async unpublishSite(id: string): Promise<void> {
    const record = await this.bySite(id);
    if (!record || this.unpublishing.has(id)) return;
    this.siteLines.delete(id);
    const connected = this.deps.host.accountId();
    if (!connected) {
      this.siteLines.set(id, CONNECT_AGAIN);
      await this.post();
      return;
    }
    if (connected !== record.accountId) {
      this.siteLines.set(id, OTHER_ACCOUNT);
      await this.post();
      return;
    }
    this.unpublishing.set(id, { slow: false });
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
          },
        });
        down = true;
        await this.deps.records.remove(record.pagePath);
        this.gone.delete(id);
      } catch (error) {
        if (down) {
          // The page is down; only this computer's list is behind. Say that, never "still online", and note it in the
          // record, so a restart doesn't show it as published either
          this.gone.add(id);
          this.siteLines.set(id, UNPUBLISHED_LIST_STALE);
          this.deps.log('[publish] unpublished, but the record could not be removed');
          await this.deps.records.markUnpublished(record.pagePath).catch(() => {
            this.deps.log('[publish] unpublished, and the record could not be marked either');
          });
        } else {
          this.siteLines.set(id, error instanceof PublishError ? error.message : COULD_NOT_REACH_UNPUBLISH);
        }
      }
    } finally {
      this.unpublishing.delete(id);
      await this.post();
      this.deps.onPageState?.(record.pagePath);
    }
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
    let chosen: { plan: GatheredPlan; consent: PublishConsent; pagePart?: string } | null = null;
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
        const answer = await this.deps.ui.showSheet({
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
        chosen = { plan: current.plan, consent: answer.kind === 'publishAnyway' ? 'sheet-anyway' : 'sheet', pagePart: answer.pagePart };
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
    this.deps.ui.showFailure(line, () => { void this.publishFromBar(page); });
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
   */
  async publishPage(input: { plan: GatheredPlan; consent: PublishConsent; pagePart?: string }): Promise<PublishedSite> {
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

  /** The bar's state for a page. `currentHash` is PR 3's `contentHash` of what would go now, when known. */
  async pageState(pagePath: string, currentHash?: string): Promise<PageBarState> {
    const stored = await this.deps.records.get(pagePath);
    const record = stored && !stored.unpublished && !this.gone.has(stored.siteName) ? stored : undefined;
    const line = this.pageLines.get(pagePath) ?? (stored ? this.siteLines.get(stored.siteName) ?? null : null);
    if (this.publishing.has(pagePath)) {
      return { kind: 'publishing', address: record?.address ?? null, changed: false, signedOut: false, slow: false, line: null };
    }
    if (!record) return { kind: 'unpublished', address: null, changed: false, signedOut: false, slow: false, line };
    const going = this.unpublishing.get(record.siteName);
    const connected = this.deps.host.accountId();
    return {
      kind: going ? 'unpublishing' : 'published',
      address: record.address,
      changed: currentHash !== undefined && currentHash !== record.contentHash,
      signedOut: connected !== record.accountId,
      slow: going?.slow ?? false,
      line: going?.slow ? SLOW_UNPUBLISH : line,
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
    if (record) await this.unpublishSite(record.siteName);
  }
}

interface Prepared {
  plan: GatheredPlan;
  options: SheetOptions;
  record: PublishRecord | undefined;
}
