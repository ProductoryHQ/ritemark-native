/**
 * Installed-app OAuth for Google Docs publishing (Sprint 119, R1/R2).
 *
 * The flow Phase 0 proved against the real endpoints: a one-shot listener on
 * 127.0.0.1 with an OS-assigned port, an S256 PKCE challenge, a random
 * `state`, the system browser, and a code exchange that must include the
 * client secret. The desktop Picker is the same request with
 * `trigger_onepick=true`; its choice comes back as `picked_file_ids` on the
 * same redirect.
 *
 * No `vscode` import: the browser, the listener, the clock and HTTP are
 * injected, so every rejection path runs in Node tests.
 */

import * as http from 'http';
import { createHash, randomBytes as nodeRandomBytes } from 'crypto';
import type { GoogleOAuthClientConfig } from './config';
import { GOOGLE_DOCS_SCOPE, GoogleDocsError, type GoogleTokens } from './types';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
export const DEFAULT_ATTEMPT_TIMEOUT_MS = 5 * 60_000;

export type FetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer | URLSearchParams;
}) => Promise<{ ok: boolean; status: number; text(): Promise<string>; headers?: { get(name: string): string | null } }>;

export interface LoopbackResponse {
  status: number;
  html: string;
}

export interface LoopbackListener {
  port: number;
  close(): void;
}

/** Starts a listener that answers exactly the requests the flow cares about. */
export type StartLoopback = (onRequest: (url: URL) => LoopbackResponse) => Promise<LoopbackListener>;

export interface GoogleOAuthDependencies {
  config: GoogleOAuthClientConfig;
  openExternal(url: string): Promise<boolean>;
  fetch?: FetchLike;
  startLoopback?: StartLoopback;
  randomBytes?: (size: number) => Buffer;
  now?: () => number;
  timeoutMs?: number;
}

export interface OAuthAttemptOptions {
  /** Open the desktop Picker restricted to these MIME types. */
  picker?: { mimeTypes: string[] };
  /** Suggest the already-connected account so the Picker opens in it. */
  loginHint?: string;
}

export interface OAuthAttemptResult {
  tokens: GoogleTokens;
  pickedFileIds: string[];
}

export interface OAuthAttempt {
  result: Promise<OAuthAttemptResult>;
  cancel(): void;
}

const b64url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#1f1d3a}
h1{font-size:1.25rem}p{line-height:1.5;color:#55536e}</style></head>
<body><h1>${title}</h1><p>${body}</p></body></html>`;
}

export const nodeStartLoopback: StartLoopback = (onRequest) =>
  new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const response = onRequest(url);
      res.writeHead(response.status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(response.html);
    });
    server.once('error', reject);
    // Bind to IPv4 loopback only, on a port the OS chooses: nothing outside this
    // machine can reach it, and there is no fixed port to collide on.
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Loopback listener has no port'));
        return;
      }
      resolve({ port: address.port, close: () => server.close() });
    });
  });

function mapTokenError(status: number, body: string): GoogleDocsError {
  let error = '';
  try { error = String((JSON.parse(body) as { error?: string }).error ?? ''); } catch { /* not JSON */ }
  if (error === 'invalid_grant') return new GoogleDocsError('reauthorization-required', 'Google rejected the grant', { status });
  if (status >= 500) return new GoogleDocsError('provider-unavailable', 'Google token service unavailable', { status });
  if (status === 429) return new GoogleDocsError('rate-limited', 'Google token service rate limited', { status });
  return new GoogleDocsError('unexpected', `Token endpoint answered ${status}${error ? ` (${error})` : ''}`, { status });
}

export class GoogleOAuthFlow {
  private readonly fetch: FetchLike;
  private readonly startLoopback: StartLoopback;
  private readonly randomBytes: (size: number) => Buffer;
  private readonly now: () => number;
  private readonly timeoutMs: number;

  constructor(private readonly deps: GoogleOAuthDependencies) {
    this.fetch = deps.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.startLoopback = deps.startLoopback ?? nodeStartLoopback;
    this.randomBytes = deps.randomBytes ?? nodeRandomBytes;
    this.now = deps.now ?? Date.now;
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
  }

  /**
   * One attempt: its own state, verifier, listener and deadline. The listener
   * closes on success, failure, cancel and timeout alike.
   */
  begin(options: OAuthAttemptOptions = {}): OAuthAttempt {
    const verifier = b64url(this.randomBytes(64));
    const challenge = b64url(createHash('sha256').update(verifier).digest());
    const state = b64url(this.randomBytes(24));

    let listener: LoopbackListener | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    let rejectAttempt: (error: GoogleDocsError) => void = () => undefined;

    const finish = () => {
      settled = true;
      if (timer) clearTimeout(timer);
      timer = null;
      listener?.close();
      listener = null;
    };

    const result = new Promise<OAuthAttemptResult>((resolve, reject) => {
      rejectAttempt = (error) => {
        if (settled) return;
        finish();
        reject(error);
      };

      const onRequest = (url: URL): LoopbackResponse => {
        if (url.pathname !== '/') return { status: 404, html: page('Not found', 'This address is only used to finish connecting Ritemark.') };
        if (settled) return { status: 410, html: page('Already finished', 'You can close this tab and return to Ritemark.') };

        // A callback carrying someone else's state is ignored, not honoured:
        // it cannot complete this attempt, and it does not end it either.
        if (url.searchParams.get('state') !== state) {
          return { status: 400, html: page('Ritemark did not connect', 'This sign-in link is out of date. Start again from Ritemark.') };
        }

        const error = url.searchParams.get('error');
        if (error) {
          rejectAttempt(error === 'access_denied'
            ? new GoogleDocsError('cancelled', 'Consent was declined')
            : new GoogleDocsError('unexpected', `Authorization failed: ${error}`));
          return { status: 200, html: page('Ritemark was not connected', 'Nothing was changed. You can close this tab.') };
        }

        const code = url.searchParams.get('code');
        if (!code) {
          rejectAttempt(new GoogleDocsError('unexpected', 'Authorization response had no code'));
          return { status: 400, html: page('Ritemark did not connect', 'Google did not return an authorization. Start again from Ritemark.') };
        }

        const picked = (url.searchParams.get('picked_file_ids') ?? '')
          .split(',').map((id) => id.trim()).filter(Boolean);
        const redirectUri = `http://127.0.0.1:${listener?.port ?? 0}`;
        finish();
        this.exchange(code, verifier, redirectUri)
          .then((tokens) => resolve({ tokens, pickedFileIds: picked }))
          .catch((e) => reject(e instanceof GoogleDocsError ? e : new GoogleDocsError('unexpected', String(e))));
        return {
          status: 200,
          html: options.picker
            ? page('Template chosen', 'You can close this tab and return to Ritemark.')
            : page('Ritemark is connected', 'You can close this tab and return to Ritemark.'),
        };
      };

      this.startLoopback(onRequest)
        .then(async (started) => {
          if (settled) { started.close(); return; }
          listener = started;
          const params = new URLSearchParams({
            client_id: this.deps.config.clientId,
            redirect_uri: `http://127.0.0.1:${started.port}`,
            response_type: 'code',
            scope: GOOGLE_DOCS_SCOPE,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            state,
            access_type: 'offline',
            prompt: 'consent',
          });
          if (options.loginHint) params.set('login_hint', options.loginHint);
          if (options.picker) {
            params.set('trigger_onepick', 'true');
            if (options.picker.mimeTypes.length) params.set('mimetypes', options.picker.mimeTypes.join(','));
          }
          timer = setTimeout(() => rejectAttempt(new GoogleDocsError('cancelled', 'Sign-in timed out')), this.timeoutMs);
          const opened = await this.deps.openExternal(`${AUTH_ENDPOINT}?${params.toString()}`);
          if (!opened) rejectAttempt(new GoogleDocsError('unexpected', 'The system browser could not be opened'));
        })
        .catch((e) => rejectAttempt(new GoogleDocsError('unexpected', `Loopback listener failed: ${String(e)}`)));
    });

    return {
      result,
      cancel: () => rejectAttempt(new GoogleDocsError('cancelled', 'Cancelled by the user')),
    };
  }

  private async exchange(code: string, verifier: string, redirectUri: string): Promise<GoogleTokens> {
    const body = new URLSearchParams({
      client_id: this.deps.config.clientId,
      client_secret: this.deps.config.clientSecret,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });
    const res = await this.post(TOKEN_ENDPOINT, body);
    const text = await res.text();
    if (!res.ok) throw mapTokenError(res.status, text);
    const json = JSON.parse(text) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!json.access_token || !json.refresh_token) {
      throw new GoogleDocsError('unexpected', 'Google returned no refresh token');
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: this.now() + Math.max(60, (json.expires_in ?? 3600) - 60) * 1000,
      scope: json.scope ?? GOOGLE_DOCS_SCOPE,
    };
  }

  async refresh(tokens: GoogleTokens): Promise<GoogleTokens> {
    const body = new URLSearchParams({
      client_id: this.deps.config.clientId,
      client_secret: this.deps.config.clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await this.post(TOKEN_ENDPOINT, body);
    const text = await res.text();
    if (!res.ok) throw mapTokenError(res.status, text);
    const json = JSON.parse(text) as { access_token?: string; expires_in?: number; scope?: string; refresh_token?: string };
    if (!json.access_token) throw new GoogleDocsError('unexpected', 'Refresh returned no access token');
    return {
      accessToken: json.access_token,
      // Google normally keeps the refresh token; take a rotated one if offered.
      refreshToken: json.refresh_token ?? tokens.refreshToken,
      expiresAt: this.now() + Math.max(60, (json.expires_in ?? 3600) - 60) * 1000,
      scope: json.scope ?? tokens.scope,
    };
  }

  /** Best effort: a revoke that fails must not stop a local disconnect. */
  async revoke(tokens: GoogleTokens): Promise<boolean> {
    try {
      const res = await this.post(REVOKE_ENDPOINT, new URLSearchParams({ token: tokens.refreshToken || tokens.accessToken }));
      return res.ok;
    } catch {
      return false;
    }
  }

  private async post(url: string, body: URLSearchParams) {
    try {
      return await this.fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (e) {
      throw new GoogleDocsError('offline', `Could not reach Google: ${String(e)}`);
    }
  }
}
