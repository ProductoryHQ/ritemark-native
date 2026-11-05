/**
 * Publishing's host controller (Sprint 149, W5, W6): the connection, Settings ▸ Sharing ▸ Web pages, the page's
 * states, and the way the token comes in. No `vscode` import: the adapter (`vscodePublish.ts`) supplies the password
 * box, the browser and the context key, so every rule here tests under plain Node.
 *
 * - **The token** comes in only through the host's own password box (`ui.askToken`), opened on a message that
 *   carries no value. It goes to the host, which keeps it in SecretStorage; it is never posted, logged or put in a
 *   projection.
 * - **The flag** `web-page-publishing` gates creating, connecting, publishing and updating. It never gates taking a
 *   page down: the list, Open, Unpublish and Disconnect work with it off (sprint-plan.md, *Feature Flag Check*).
 * - **`ritemark.publish.ready`** is set only with the flag on and a way in to the sheet registered
 *   (`setPublishEntryAvailable`, PR 3's gather and sheet). Until then the bar's Publish (PR 2) never shows.
 */

import type { PublishRequest, PublishedSite, PublishHost } from './host';
import { PublishError } from './host';
import { contentHash, suggestSubdomain } from './cloudflare/assets';
import { CONNECT_AGAIN, COULD_NOT_REACH_UNPUBLISH } from './cloudflare/CloudflareHost';
import type { SiteLedger } from './cloudflare/siteLedger';
import { decodeSettingsRequest, type WebPageRow, type WebPagesSettingsProjection } from './settingsProtocol';

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

export interface PublishUi {
  openExternal(url: string): Promise<boolean>;
  /**
   * The host's own password box. `check` answers null to close it, or a line to show under it, keeping it open
   * (answer 8). Resolves when the box closes.
   */
  askToken(options: { title: string; prompt: string; check: (value: string) => Promise<string | null> }): Promise<void>;
}

/** The page's bar, as PR 2's chip will draw it (spec R7, frame 4). */
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

export interface PublishControllerDeps {
  host: PublishHost & { accountId(): string | null };
  ledger: SiteLedger;
  ui: PublishUi;
  isFeatureEnabled: () => boolean;
  postSettings: (projection: WebPagesSettingsProjection) => void;
  setReady: (ready: boolean) => void;
  /** A page's bar state changed (PR 2's chip listens). */
  onPageState?: (pagePath: string) => void;
  log: (line: string) => void;
  now?: () => number;
}

export class PublishController {
  private enteringToken = false;
  private message: string | null = null;
  private entryAvailable = false;
  private readonly unpublishing = new Map<string, { slow: boolean }>();
  private readonly siteLines = new Map<string, string>();
  private readonly publishing = new Set<string>();
  private readonly pageLines = new Map<string, string>();
  private readonly now: () => number;

  constructor(private readonly deps: PublishControllerDeps) {
    this.now = deps.now ?? Date.now;
  }

  // ------------------------------------------------------------------ readiness

  /** PR 3's gather and sheet register here; Publish is reachable only then, and with the flag on. */
  setPublishEntryAvailable(available: boolean): void {
    this.entryAvailable = available;
    this.refreshReady();
  }

  refreshReady(): void {
    this.deps.setReady(this.deps.isFeatureEnabled() && this.entryAvailable);
  }

  // ------------------------------------------------------------------ Settings

  async settingsProjection(): Promise<WebPagesSettingsProjection> {
    const snapshot = this.deps.host.snapshot();
    const records = await this.deps.ledger.all();
    const pages: WebPageRow[] = records
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .map((r) => ({
        id: r.siteName,
        name: r.pageName,
        address: r.address,
        status: this.unpublishing.has(r.siteName) ? 'unpublishing' : 'online',
        slow: this.unpublishing.get(r.siteName)?.slow ?? false,
        message: this.siteLines.get(r.siteName) ?? null,
      }));
    return {
      enabled: this.deps.isFeatureEnabled(),
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

  /** "Use a token instead": Cloudflare's token page and the host's password box at once (answer 8). */
  async startTokenEntry(): Promise<void> {
    if (!this.deps.isFeatureEnabled() || this.enteringToken) return;
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

  /** Disconnect (R9): the page asked its question first. Published pages stay; the flag doesn't gate it. */
  async disconnect(): Promise<void> {
    await this.deps.host.disconnect();
    this.message = null;
    await this.post();
    for (const r of await this.deps.ledger.all()) this.deps.onPageState?.(r.pagePath);
  }

  async openSite(id: string): Promise<void> {
    const record = await this.deps.ledger.bySite(id);
    if (!record || !/^https:\/\/[a-z0-9.-]+\.workers\.dev\//.test(record.address)) return;
    await this.deps.ui.openExternal(record.address);
  }

  /** Unpublish (R7): the page asked its question first. Never gated by the flag (S28b). */
  async unpublishSite(id: string): Promise<void> {
    const record = await this.deps.ledger.bySite(id);
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
      await this.deps.host.unpublish(record.siteName, record.address, {
        onSlow: () => {
          this.unpublishing.set(id, { slow: true });
          void this.post();
          this.deps.onPageState?.(record.pagePath);
        },
      });
      await this.deps.ledger.remove(id);
    } catch (error) {
      this.siteLines.set(id, error instanceof PublishError ? error.message : COULD_NOT_REACH_UNPUBLISH);
    } finally {
      this.unpublishing.delete(id);
      await this.post();
      this.deps.onPageState?.(record.pagePath);
    }
  }

  // ------------------------------------------------------------------ the page

  /**
   * What PR 3's sheet shows for the account (R5, the lead's answer 5): Where (the account's name), and, only while
   * the account has no workers.dev name, the name row pre-filled with "pages" and four digits.
   */
  sheetAccount(): { accountName: string | null; subdomain: string | null; suggestion: string | null } {
    const snapshot = this.deps.host.snapshot();
    return {
      accountName: snapshot.accountName,
      subdomain: snapshot.subdomain,
      suggestion: snapshot.state === 'connected' && !snapshot.subdomain ? suggestSubdomain() : null,
    };
  }

  /** The name row's choice. Taken or not allowed: "This name is taken. Try another.", and Publish waits. */
  async chooseSubdomain(typed: string): Promise<{ name: string } | { error: string }> {
    if (!this.deps.isFeatureEnabled()) return { error: 'Publishing is switched off in this version.' };
    try {
      return { name: await this.deps.host.chooseSubdomain(typed) };
    } catch (error) {
      if (error instanceof PublishError && (error.code === 'name-taken' || error.code === 'name-invalid')) return { error: NAME_TAKEN };
      return { error: error instanceof PublishError ? error.message : "Ritemark couldn't reach Cloudflare. Try again." };
    }
  }

  /**
   * Publish or Update one page (R7), after the person pressed Publish in PR 3's sheet. Update keeps the record's
   * site name, so the address stays (M8).
   */
  async publishPage(input: { pagePath: string; pageName: string; request: PublishRequest; siteName: string }): Promise<PublishedSite> {
    if (!this.deps.isFeatureEnabled()) throw new PublishError('failed', 'Publishing is switched off in this version.');
    const accountId = this.deps.host.accountId();
    if (!accountId) throw new PublishError('not-connected', CONNECT_AGAIN);
    if (this.publishing.has(input.pagePath)) throw new PublishError('failed', 'This page is being published.');
    this.publishing.add(input.pagePath);
    this.pageLines.delete(input.pagePath);
    this.deps.onPageState?.(input.pagePath);
    try {
      const site = await this.deps.host.publish(input.siteName, input.request);
      await this.deps.ledger.put({
        siteName: site.name,
        accountId,
        address: site.address,
        pagePath: input.pagePath,
        pageName: input.pageName,
        contentHash: contentHash(input.request.assets),
        files: input.request.assets.map((a) => a.urlPath).sort(),
        publishedAt: this.now(),
      });
      await this.post();
      return site;
    } catch (error) {
      const line = error instanceof PublishError ? error.message : "Ritemark couldn't reach Cloudflare. The page is still on this computer.";
      this.pageLines.set(input.pagePath, line);
      throw error instanceof PublishError ? error : new PublishError('failed', line);
    } finally {
      this.publishing.delete(input.pagePath);
      this.deps.onPageState?.(input.pagePath);
    }
  }

  async pageState(pagePath: string, currentHash?: string): Promise<PageBarState> {
    const record = await this.deps.ledger.forPage(pagePath);
    const line = this.pageLines.get(pagePath) ?? (record ? this.siteLines.get(record.siteName) ?? null : null);
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
}
