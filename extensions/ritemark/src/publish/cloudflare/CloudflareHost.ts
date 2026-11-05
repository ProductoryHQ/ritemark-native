/**
 * Cloudflare as a `PublishHost` (Sprint 149, W4): the account and the client together, with Cloudflare's failures
 * turned into the plain lines of spec R7. Every message it throws is already redacted by the client.
 */

import type { ConnectionSnapshot, PublishHost, PublishedSite, TokenCheck, VerifiedUpload } from '../host';
import { isVerifiedUpload, PublishError } from '../host';
import type { CloudflareAccount } from './account';
import { buildManifest, cleanName, siteAddress } from './assets';
import { CloudflareApiError, SubdomainExistsError } from './client';

export const COULD_NOT_REACH_PUBLISH = "Ritemark couldn't reach Cloudflare. The page is still on this computer.";
export const COULD_NOT_REACH_UNPUBLISH = "Ritemark couldn't reach Cloudflare. The page is still online.";
export const CONNECT_AGAIN = 'Connect again to update or unpublish.';
export const ADDRESS_TAKEN = 'This address is taken. Try another.';

export interface CloudflareHostOptions {
  log?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** How long Unpublish waits for the address to stop answering (M9 sets it). */
  unpublishDeadlineMs?: number;
  /** When "Cloudflare is still taking the page down." shows (the lead, answer 7). */
  slowAfterMs?: number;
  pollMs?: number;
}

export class CloudflareHost implements PublishHost {
  readonly id = 'cloudflare' as const;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(private readonly account: CloudflareAccount, private readonly options: CloudflareHostOptions = {}) {
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;
  }

  snapshot(): ConnectionSnapshot {
    return this.account.snapshot();
  }

  /** Host-only: the connected account's ID (the ledger checks a record against it). */
  accountId(): string | null {
    return this.account.accountId();
  }

  connectWithToken(token: string): Promise<TokenCheck> {
    return this.account.connectWithToken(token);
  }

  disconnect(): Promise<void> {
    return this.account.disconnect();
  }

  async refreshSubdomain(): Promise<string | null> {
    this.requireAccount();
    try {
      return await this.account.refreshSubdomain();
    } catch (error) {
      throw this.plain(error, COULD_NOT_REACH_PUBLISH);
    }
  }

  /**
   * The name row's choice, registered only while the account has none: the client reads the name again right
   * before the PUT and refuses when there is one. That one is then kept here (`name-exists` is thrown, so the sheet
   * shows the address it really gets), and nothing is renamed.
   */
  async chooseSubdomain(typed: string): Promise<string> {
    const name = cleanName(typed);
    if (!name) throw new PublishError('name-invalid', 'Use lowercase letters, digits and dashes.');
    const accountId = this.requireAccount();
    try {
      const chosen = await this.account.client().registerSubdomain(accountId, name);
      await this.account.setSubdomain(chosen);
      return chosen;
    } catch (error) {
      if (error instanceof SubdomainExistsError) {
        await this.account.setSubdomain(error.existing);
        throw error;
      }
      throw this.plain(error, COULD_NOT_REACH_PUBLISH);
    }
  }

  async siteExists(siteName: string): Promise<boolean> {
    const accountId = this.requireAccount();
    try {
      return await this.account.client().scriptExists(accountId, siteName);
    } catch (error) {
      throw this.plain(error, COULD_NOT_REACH_PUBLISH);
    }
  }

  async publish(siteName: string, upload: VerifiedUpload, options: { replacing: boolean }): Promise<PublishedSite> {
    const accountId = this.requireAccount();
    // Only bytes read again and matched to the plan's hashes go (PR 3's blocking item)
    if (!isVerifiedUpload(upload)) throw new PublishError('failed', 'Ritemark could not check what goes. Press Publish again.');
    const subdomain = this.account.snapshot().subdomain;
    if (!subdomain) throw new PublishError('failed', "Choose your pages' address first.");
    if (!upload.files.some((a) => a.urlPath === upload.pageUrlPath)) throw new PublishError('failed', 'The page itself is not among the files.');
    // Over a limit, nothing is sent (R3, S15): the manifest is built before any call
    const { manifest, entries } = buildManifest(upload.files);
    // A first publish never replaces a Worker already on the account, the person's own or another page's
    if (!options.replacing && (await this.siteExists(siteName))) throw new PublishError('address-taken', ADDRESS_TAKEN);
    try {
      const { uploaded } = await this.account.client().deploy(accountId, siteName, manifest, entries);
      this.options.log?.(`[publish] ${siteName}: deployed, ${uploaded} of ${entries.length} files uploaded`);
    } catch (error) {
      throw this.plain(error, COULD_NOT_REACH_PUBLISH);
    }
    return { name: siteName, address: siteAddress(siteName, subdomain, upload.pageUrlPath) };
  }

  async unpublish(siteName: string, address: string, options: { onSlow?: () => void } = {}): Promise<void> {
    const accountId = this.requireAccount();
    const client = this.account.client();
    const started = this.now();
    const deadline = this.options.unpublishDeadlineMs ?? 120_000;
    const slowAfter = this.options.slowAfterMs ?? 10_000;
    const poll = this.options.pollMs ?? 2_000;
    let slowShown = false;
    const checkSlow = () => {
      if (!slowShown && this.now() - started >= slowAfter) { slowShown = true; options.onSlow?.(); }
    };

    try {
      await client.deleteScript(accountId, siteName);
    } catch (error) {
      throw this.plain(error, COULD_NOT_REACH_UNPUBLISH);
    }
    // "Unpublished" only once the address has stopped answering (R7, M9)
    for (;;) {
      checkSlow();
      if (await client.addressAnswers(address) === 'gone') return;
      if (this.now() - started >= deadline) throw new PublishError('still-online', COULD_NOT_REACH_UNPUBLISH);
      await this.sleep(poll);
    }
  }

  private requireAccount(): string {
    const id = this.account.accountId();
    if (!id) throw new PublishError('not-connected', CONNECT_AGAIN);
    return id;
  }

  /** Cloudflare's failure as one plain line; its own (redacted) text goes to the log only. */
  private plain(error: unknown, fallback: string): PublishError {
    if (error instanceof PublishError) {
      if (error.code === 'unreachable') {
        this.options.log?.(`[publish] ${error.message}`);
        return new PublishError('unreachable', fallback);
      }
      return error;
    }
    if (error instanceof CloudflareApiError) {
      this.options.log?.(`[publish] ${error.message}`);
      if (error.status === 401) return new PublishError('refused', "Cloudflare didn't accept Ritemark's connection. Connect again.");
      if (error.status === 403) return new PublishError('cannot-publish', "This connection can't publish pages. Connect again with a new token.");
      return new PublishError('failed', fallback);
    }
    this.options.log?.('[publish] an unexpected failure');
    return new PublishError('failed', fallback);
  }
}
