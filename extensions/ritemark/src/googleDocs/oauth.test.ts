import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GoogleOAuthFlow, type FetchLike, type LoopbackResponse, type StartLoopback } from './oauth';
import { GoogleDocsError } from './types';

const config = { clientId: 'client.apps.googleusercontent.com', clientSecret: 'public-desktop-secret' };

interface Harness {
  flow: GoogleOAuthFlow;
  opened: string[];
  closed: () => number;
  callback: (query: Record<string, string>) => LoopbackResponse;
  tokenBodies: URLSearchParams[];
}

function harness(options: { tokenStatus?: number; tokenBody?: string; timeoutMs?: number; openOk?: boolean } = {}): Harness {
  const opened: string[] = [];
  let closeCount = 0;
  let onRequest: ((url: URL) => LoopbackResponse) | null = null;
  const tokenBodies: URLSearchParams[] = [];
  const startLoopback: StartLoopback = async (handler) => {
    onRequest = handler;
    return { port: 49152, close: () => { closeCount++; } };
  };
  const fetch: FetchLike = async (url, init) => {
    if (url.includes('/token')) tokenBodies.push(new URLSearchParams(String(init?.body)));
    const status = options.tokenStatus ?? 200;
    const body = options.tokenBody ?? JSON.stringify({ access_token: 'ya29.access', refresh_token: '1//refresh', expires_in: 3599, scope: 'https://www.googleapis.com/auth/drive.file' });
    return { ok: status < 400, status, text: async () => body };
  };
  let counter = 0;
  const flow = new GoogleOAuthFlow({
    config,
    openExternal: async (url) => { opened.push(url); return options.openOk ?? true; },
    fetch,
    startLoopback,
    randomBytes: (size) => Buffer.alloc(size, ++counter),
    now: () => 1_000_000,
    timeoutMs: options.timeoutMs ?? 60_000,
  });
  return {
    flow,
    opened,
    closed: () => closeCount,
    callback: (query) => {
      if (!onRequest) throw new Error('listener not started');
      const url = new URL('http://127.0.0.1:49152/');
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
      return onRequest(url);
    },
    tokenBodies,
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

async function main(): Promise<void> {
  // ── The authorization request ────────────────────────────────────────────────
  {
    const h = harness();
    const attempt = h.flow.begin({ loginHint: 'jarmo@productory.eu' });
    await settle();
    assert.equal(h.opened.length, 1, 'the system browser is opened once');
    const url = new URL(h.opened[0]);
    assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    const q = url.searchParams;
    assert.equal(q.get('redirect_uri'), 'http://127.0.0.1:49152', 'loopback on the OS-assigned port');
    assert.equal(q.get('scope'), 'https://www.googleapis.com/auth/drive.file', 'drive.file and nothing else');
    assert.equal(q.get('code_challenge_method'), 'S256');
    assert.equal(q.get('access_type'), 'offline');
    assert.equal(q.get('prompt'), 'consent');
    assert.equal(q.get('login_hint'), 'jarmo@productory.eu');
    assert.equal(q.get('trigger_onepick'), null, 'no Picker unless asked for');
    const state = q.get('state')!;
    const challenge = q.get('code_challenge')!;

    // A callback carrying another attempt's state cannot complete this one.
    const wrong = h.callback({ state: 'someone-else', code: 'evil' });
    assert.equal(wrong.status, 400);
    assert.equal(h.tokenBodies.length, 0, 'no exchange for a mismatched state');
    assert.equal(h.closed(), 0, 'a stale callback does not end the real attempt');

    const ok = h.callback({ state, code: '4/code', scope: 'drive.file' });
    assert.equal(ok.status, 200);
    const result = await attempt.result;
    assert.equal(result.tokens.accessToken, 'ya29.access');
    assert.equal(result.tokens.refreshToken, '1//refresh');
    assert.equal(result.tokens.expiresAt, 1_000_000 + (3599 - 60) * 1000, 'expiry keeps a safety margin');
    assert.deepEqual(result.pickedFileIds, []);
    assert.equal(h.closed(), 1, 'the listener closes on success');

    const body = h.tokenBodies[0];
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('client_secret'), config.clientSecret, 'Phase 0: a desktop client must send its secret');
    assert.equal(body.get('redirect_uri'), 'http://127.0.0.1:49152');
    const verifier = body.get('code_verifier')!;
    const expected = createHash('sha256').update(verifier).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    assert.equal(expected, challenge, 'the verifier matches the challenge sent to Google');

    const late = h.callback({ state, code: 'replay' });
    assert.equal(late.status, 410, 'a replayed callback after completion is refused');
  }

  // ── The Picker is the same request plus two parameters ───────────────────────
  {
    const h = harness();
    const attempt = h.flow.begin({ picker: { mimeTypes: ['application/vnd.google-apps.document'] } });
    await settle();
    const q = new URL(h.opened[0]).searchParams;
    assert.equal(q.get('trigger_onepick'), 'true');
    assert.equal(q.get('mimetypes'), 'application/vnd.google-apps.document');
    h.callback({ state: q.get('state')!, code: '4/code', picked_file_ids: 'doc-1, doc-2' });
    const result = await attempt.result;
    assert.deepEqual(result.pickedFileIds, ['doc-1', 'doc-2'], 'picked ids come back on the redirect');
  }

  // ── Declined consent, cancel, timeout, browser failure ───────────────────────
  {
    const h = harness();
    const attempt = h.flow.begin();
    await settle();
    const state = new URL(h.opened[0]).searchParams.get('state')!;
    h.callback({ state, error: 'access_denied' });
    await assert.rejects(attempt.result, (e: GoogleDocsError) => e.code === 'cancelled');
    assert.equal(h.closed(), 1);
  }
  {
    const h = harness();
    const attempt = h.flow.begin();
    await settle();
    attempt.cancel();
    await assert.rejects(attempt.result, (e: GoogleDocsError) => e.code === 'cancelled');
    assert.equal(h.closed(), 1, 'cancel closes the listener');
  }
  {
    const h = harness({ timeoutMs: 5 });
    const attempt = h.flow.begin();
    await assert.rejects(attempt.result, (e: GoogleDocsError) => e.code === 'cancelled' && /timed out/.test(e.message));
    assert.equal(h.closed(), 1, 'timeout closes the listener');
  }
  {
    const h = harness({ openOk: false });
    const attempt = h.flow.begin();
    await assert.rejects(attempt.result, (e: GoogleDocsError) => e.code === 'unexpected');
  }

  // ── Token endpoint failures ──────────────────────────────────────────────────
  {
    const h = harness({ tokenStatus: 400, tokenBody: JSON.stringify({ error: 'invalid_grant' }) });
    const attempt = h.flow.begin();
    await settle();
    h.callback({ state: new URL(h.opened[0]).searchParams.get('state')!, code: '4/code' });
    await assert.rejects(attempt.result, (e: GoogleDocsError) => e.code === 'reauthorization-required');
  }
  {
    const h = harness({ tokenBody: JSON.stringify({ access_token: 'a' }) });
    const attempt = h.flow.begin();
    await settle();
    h.callback({ state: new URL(h.opened[0]).searchParams.get('state')!, code: '4/code' });
    await assert.rejects(attempt.result, (e: GoogleDocsError) => /no refresh token/.test(e.message));
  }

  // ── Refresh and revoke ───────────────────────────────────────────────────────
  {
    const h = harness({ tokenBody: JSON.stringify({ access_token: 'ya29.new', expires_in: 3599 }) });
    const refreshed = await h.flow.refresh({ accessToken: 'old', refreshToken: '1//keep', expiresAt: 0, scope: 's' });
    assert.equal(refreshed.accessToken, 'ya29.new');
    assert.equal(refreshed.refreshToken, '1//keep', 'the refresh token is kept when Google does not rotate it');
    assert.equal(h.tokenBodies[0].get('grant_type'), 'refresh_token');
  }
  {
    const h = harness({ tokenStatus: 400, tokenBody: JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }) });
    await assert.rejects(h.flow.refresh({ accessToken: 'a', refreshToken: 'r', expiresAt: 0, scope: 's' }),
      (e: GoogleDocsError) => e.code === 'reauthorization-required', 'a revoked grant is a reconnect, not a crash');
  }
  {
    const failing = new GoogleOAuthFlow({
      config,
      openExternal: async () => true,
      fetch: async () => { throw new Error('ENOTFOUND'); },
    });
    assert.equal(await failing.revoke({ accessToken: 'a', refreshToken: 'r', expiresAt: 0, scope: 's' }), false,
      'revoke is best effort and never throws');
  }

  console.log('googleDocs/oauth: all assertions passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
