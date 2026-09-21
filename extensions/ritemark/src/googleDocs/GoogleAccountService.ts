/**
 * The one owner of the Google account connection (Sprint 119, R1/R2).
 *
 * Tokens live only in secret storage (VS Code SecretStorage → macOS Keychain /
 * Windows Credential Manager) under a versioned, Google-Docs-specific key.
 * Settings and the editor both read account state through this service, never
 * through their own token reader (R9).
 *
 * No `vscode` import; storage, OAuth and the API client are injected.
 */

import { GoogleApiClient, type GoogleApiClientDependencies } from './GoogleApiClient';
import type { GoogleOAuthFlow, OAuthAttempt } from './oauth';
import {
  GOOGLE_DOC_MIME,
  GoogleDocsError,
  type GoogleAccountIdentity,
  type GoogleTemplateChoice,
  type GoogleTokens,
  type StoredGoogleAccountV1,
} from './types';

export const ACCOUNT_SECRET_KEY = 'ritemark.googleDocs.account.v1';
export const TEMPLATE_STATE_KEY = 'ritemark.googleDocs.template.v1';

export interface SecretStoreLike {
  get(key: string): PromiseLike<string | undefined>;
  store(key: string, value: string): PromiseLike<void>;
  delete(key: string): PromiseLike<void>;
}

export interface StateStoreLike {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}

export type AccountStatus = 'disconnected' | 'connecting' | 'connected' | 'reauthorize';

export interface AccountSnapshot {
  status: AccountStatus;
  identity: GoogleAccountIdentity | null;
  template: GoogleTemplateChoice | null;
  choosingTemplate: boolean;
}

export interface GoogleAccountServiceDependencies {
  secrets: SecretStoreLike;
  state: StateStoreLike;
  oauth: GoogleOAuthFlow;
  fetch?: GoogleApiClientDependencies['fetch'];
  now?: () => number;
}

function parseStored(raw: string | undefined): StoredGoogleAccountV1 | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as StoredGoogleAccountV1;
    if (v.schemaVersion !== 1 || !v.accountId || !v.email || !v.tokens?.refreshToken) return null;
    return v;
  } catch {
    return null;
  }
}

export class GoogleAccountService {
  private account: StoredGoogleAccountV1 | null = null;
  private loaded = false;
  private status: AccountStatus = 'disconnected';
  private attempt: OAuthAttempt | null = null;
  private choosingTemplate = false;
  private refreshInFlight: Promise<GoogleTokens> | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;

  /** The authenticated client every publish goes through. */
  readonly client: GoogleApiClient;

  constructor(private readonly deps: GoogleAccountServiceDependencies) {
    this.now = deps.now ?? Date.now;
    this.client = new GoogleApiClient({
      fetch: deps.fetch,
      getAccessToken: () => this.accessToken(),
      refreshAccessToken: () => this.accessToken(true),
    });
  }

  onDidChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* a listener must not break the service */ }
    }
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    this.account = parseStored(await this.deps.secrets.get(ACCOUNT_SECRET_KEY));
    this.status = this.account ? 'connected' : 'disconnected';
    this.loaded = true;
  }

  snapshot(): AccountSnapshot {
    const template = this.deps.state.get<GoogleTemplateChoice>(TEMPLATE_STATE_KEY) ?? null;
    return {
      status: this.status,
      identity: this.account ? { accountId: this.account.accountId, email: this.account.email, displayName: this.account.displayName } : null,
      // A template granted by another account is not offered as this account's default.
      template: template && this.account && template.accountId === this.account.accountId ? template : null,
      choosingTemplate: this.choosingTemplate,
    };
  }

  identity(): GoogleAccountIdentity | null {
    return this.snapshot().identity;
  }

  // ------------------------------------------------------------------ connect

  async connect(): Promise<GoogleAccountIdentity> {
    await this.load();
    this.cancel();
    const previous = this.status;
    this.status = 'connecting';
    this.emit();
    const attempt = this.deps.oauth.begin({ loginHint: this.account?.email });
    this.attempt = attempt;
    try {
      const { tokens } = await attempt.result;
      const identity = await this.identify(tokens);
      const priorTemplate = this.deps.state.get<GoogleTemplateChoice>(TEMPLATE_STATE_KEY);
      if (priorTemplate && priorTemplate.accountId !== identity.accountId) {
        await this.deps.state.update(TEMPLATE_STATE_KEY, undefined);
      }
      await this.persist({ schemaVersion: 1, ...identity, connectedAt: new Date(this.now()).toISOString(), tokens });
      this.status = 'connected';
      return identity;
    } catch (error) {
      this.status = this.account ? (previous === 'reauthorize' ? 'reauthorize' : 'connected') : 'disconnected';
      throw error;
    } finally {
      if (this.attempt === attempt) this.attempt = null;
      this.emit();
    }
  }

  cancel(): void {
    this.attempt?.cancel();
    this.attempt = null;
  }

  /**
   * Forget the account: revoke at Google when possible, then delete the local
   * tokens either way. Document links are kept as history (R1) so reconnecting
   * the same account makes them syncable again.
   */
  async disconnect(): Promise<void> {
    await this.load();
    this.cancel();
    const account = this.account;
    if (account) await this.deps.oauth.revoke(account.tokens);
    await this.deps.secrets.delete(ACCOUNT_SECRET_KEY);
    await this.deps.state.update(TEMPLATE_STATE_KEY, undefined);
    this.account = null;
    this.status = 'disconnected';
    this.emit();
  }

  // ------------------------------------------------------------------ template

  /**
   * Open the desktop Picker in the connected account and remember the chosen
   * Google Doc as the default template. The Picker grant arrives with a fresh
   * token; it is kept only if it belongs to the same account.
   */
  async chooseTemplate(): Promise<GoogleTemplateChoice> {
    await this.load();
    if (!this.account) throw new GoogleDocsError('not-connected', 'No Google account connected');
    this.cancel();
    this.choosingTemplate = true;
    this.emit();
    const attempt = this.deps.oauth.begin({ picker: { mimeTypes: [GOOGLE_DOC_MIME] }, loginHint: this.account.email });
    this.attempt = attempt;
    try {
      const { tokens, pickedFileIds } = await attempt.result;
      const identity = await this.identify(tokens);
      if (identity.accountId !== this.account.accountId) {
        throw new GoogleDocsError('account-mismatch', 'The template was chosen in a different Google account');
      }
      const fileId = pickedFileIds[0];
      if (!fileId) throw new GoogleDocsError('cancelled', 'No template was chosen');
      await this.persist({ ...this.account, tokens });
      const meta = await this.client.getFile(fileId);
      if (meta.mimeType !== GOOGLE_DOC_MIME || meta.trashed) {
        throw new GoogleDocsError('template-unavailable', 'The chosen file is not an available Google Doc');
      }
      const choice: GoogleTemplateChoice = { fileId, name: meta.name, accountId: identity.accountId };
      await this.deps.state.update(TEMPLATE_STATE_KEY, choice);
      return choice;
    } finally {
      this.choosingTemplate = false;
      if (this.attempt === attempt) this.attempt = null;
      this.emit();
    }
  }

  async clearTemplate(): Promise<void> {
    await this.deps.state.update(TEMPLATE_STATE_KEY, undefined);
    this.emit();
  }

  // ------------------------------------------------------------------ tokens

  /**
   * A valid access token. Refreshes are serialized: two publishes that need a
   * refresh at the same moment share one request (R9). `invalid_grant` turns
   * the account into "reconnect required" without touching document links.
   */
  async accessToken(forceRefresh = false): Promise<string> {
    await this.load();
    const account = this.account;
    if (!account) throw new GoogleDocsError('not-connected', 'No Google account connected');
    if (this.status === 'reauthorize') throw new GoogleDocsError('reauthorization-required', 'Reconnect required');
    if (!forceRefresh && account.tokens.expiresAt - 30_000 > this.now()) return account.tokens.accessToken;

    if (!this.refreshInFlight) {
      this.refreshInFlight = this.deps.oauth.refresh(account.tokens)
        .then(async (tokens) => {
          if (this.account?.accountId === account.accountId) await this.persist({ ...this.account, tokens });
          return tokens;
        })
        .catch((error: unknown) => {
          if (error instanceof GoogleDocsError && error.code === 'reauthorization-required') {
            this.status = 'reauthorize';
            this.emit();
          }
          throw error;
        })
        .finally(() => { this.refreshInFlight = null; });
    }
    return (await this.refreshInFlight).accessToken;
  }

  private async identify(tokens: GoogleTokens): Promise<GoogleAccountIdentity> {
    const probe = new GoogleApiClient({
      fetch: this.deps.fetch,
      getAccessToken: async () => tokens.accessToken,
      refreshAccessToken: async () => { throw new GoogleDocsError('reauthorization-required', 'Fresh token rejected'); },
    });
    return probe.whoAmI();
  }

  private async persist(account: StoredGoogleAccountV1): Promise<void> {
    await this.deps.secrets.store(ACCOUNT_SECRET_KEY, JSON.stringify(account));
    this.account = account;
  }
}
