/**
 * A local stand-in for Cloudflare's API and for workers.dev (Sprint 149, PR 4's tests). Never imported by product
 * code. It listens on 127.0.0.1 only, on a port the OS picks, and is closed by each test.
 *
 * It follows the spike's calls (`cf-publish-spike.mjs`) and holds the parts the client must get right: the upload
 * goes with the upload JWT and never the token, the deploy carries noindex in `_headers`, an update sends only the
 * files it doesn't hold, and a deleted page stops answering only after a few checks (propagation, M9). Its error
 * messages echo the Authorization header back, as a careless server might, so the tests can prove `redact`.
 *
 * Its responses are the documented shapes, not measured ones: A4 (M1–M11) replaces them with recorded responses.
 */

import * as http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';

export type TokenKind = 'ok' | 'no-publish' | 'no-accounts';

export interface FakeRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  authorization: string | null;
  body: string;
}

interface Session { script: string; manifest: Record<string, { hash: string; size: number }>; missing: Set<string>; completion: string }
interface Script { assets: Map<string, { hash: string; bytes: Buffer }>; headers: string; enabled: boolean; previews: boolean | null }

export interface FakeFailure {
  method?: string;
  path: RegExp;
  status?: number;
  /** Cloudflare's error code in the answer (10013 by default). */
  code?: number;
  /** Drop the connection instead of answering. */
  drop?: boolean;
  times: number;
}

export class FakeCloudflare {
  readonly tokens = new Map<string, TokenKind>();
  accounts: Array<{ id: string; name: string }> = [{ id: 'a'.repeat(32), name: 'Mari Tamm' }];
  subdomain: string | null = 'pages-4821';
  readonly takenNames = new Set<string>(['pages-1111']);
  readonly scripts = new Map<string, Script>();
  readonly blobs = new Map<string, Buffer>();
  readonly requests: FakeRequest[] = [];
  readonly failures: FakeFailure[] = [];
  /** How many address checks a deleted page keeps answering for (propagation). */
  goneAfterChecks = 0;
  /** How many address checks a new page's address stays silent for after its first deploy (M6: a new name warms up). */
  answerAfterChecks = 0;
  /** Upload sessions answer with Wrangler's single-file mode. */
  singleUploads = false;
  /** Files per bucket, so a page with several files needs several uploads. */
  bucketSize = 2;
  private readonly sessions = new Map<string, Session>();
  private readonly fading = new Map<string, number>();
  private readonly warming = new Map<string, number>();
  private server: http.Server | null = null;
  port = 0;

  get base(): string { return `http://127.0.0.1:${this.port}`; }
  get apiBase(): string { return `${this.base}/client/v4`; }

  async start(): Promise<this> {
    this.server = http.createServer((req, res) => { void this.handle(req, res); });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    this.port = (this.server!.address() as AddressInfo).port;
    return this;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (!server) return;
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  /** Every byte any request carried, for the token search (S21). */
  allTraffic(): string {
    return this.requests.map((r) => `${r.method} ${r.path} ${JSON.stringify(r.query)} ${r.body}`).join('\n');
  }

  private jwt(payload: Record<string, unknown>): string {
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    return `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ ...payload, n: randomBytes(4).toString('hex') })}.c2ln`;
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks);
    const url = new URL(req.url ?? '/', this.base);
    const record: FakeRequest = {
      method: req.method ?? 'GET',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      authorization: typeof req.headers.authorization === 'string' ? req.headers.authorization : null,
      body: raw.toString('utf8'),
    };
    this.requests.push(record);

    const failure = this.failures.find((f) => f.times > 0 && f.path.test(url.pathname) && (!f.method || f.method === record.method));
    if (failure) {
      failure.times--;
      if (failure.drop) { req.socket.destroy(); return; }
      return this.send(res, failure.status ?? 500, { success: false, errors: [{ code: failure.code ?? 10013, message: 'An unknown error has occurred' }] });
    }

    try {
      if (url.pathname.startsWith('/__site/')) return this.site(url, record, res);
      if (!url.pathname.startsWith('/client/v4/')) return this.send(res, 404, { success: false, errors: [{ code: 7000, message: 'No route' }] });
      await this.api(url, record, req.headers['content-type'] ?? '', raw, res);
    } catch (error) {
      this.send(res, 500, { success: false, errors: [{ code: 10013, message: String(error) }] });
    }
  }

  private send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  }

  private ok(res: http.ServerResponse, result: unknown): void {
    this.send(res, 200, { success: true, errors: [], messages: [], result });
  }

  private refuse(res: http.ServerResponse, status: number, code: number, message: string, auth: string | null): void {
    // Echoes the header, as a careless server would: the client must redact it
    this.send(res, status, { success: false, errors: [{ code, message: `${message} (sent: ${auth ?? 'nothing'})` }] });
  }

  private async api(url: URL, r: FakeRequest, contentType: string, raw: Buffer, res: http.ServerResponse): Promise<void> {
    const path = url.pathname.slice('/client/v4'.length);
    const bearer = r.authorization?.replace(/^Bearer /, '') ?? '';
    const parts = path.split('/').filter(Boolean);

    // The upload itself goes with the upload JWT, never the token
    if (parts[0] === 'accounts' && parts[2] === 'workers' && parts[3] === 'assets' && parts[4] === 'upload') {
      return this.upload(parts[5], bearer, contentType, raw, res, r.authorization);
    }

    const kind = this.tokens.get(bearer);
    if (!kind) return this.refuse(res, 401, 1000, 'Invalid API Token', r.authorization);

    if (path === '/accounts' && r.method === 'GET') return this.ok(res, kind === 'no-accounts' ? [] : this.accounts);

    const account = parts[1];
    if (parts[0] !== 'accounts' || !this.accounts.some((a) => a.id === account)) return this.refuse(res, 403, 9109, 'Unauthorized to access requested resource', r.authorization);
    if (kind !== 'ok') return this.refuse(res, 403, 10000, 'Authentication error', r.authorization);

    const rest = parts.slice(2).join('/');
    if (rest === 'workers/scripts' && r.method === 'GET') return this.ok(res, [...this.scripts.keys()].map((id) => ({ id })));
    if (rest === 'workers/subdomain' && r.method === 'GET') {
      if (!this.subdomain) return this.send(res, 404, { success: false, errors: [{ code: 10007, message: 'This account has no workers.dev subdomain.' }] });
      return this.ok(res, { subdomain: this.subdomain });
    }
    if (rest === 'workers/subdomain' && r.method === 'PUT') {
      const name = String((JSON.parse(r.body) as { subdomain?: unknown }).subdomain ?? '');
      if (this.takenNames.has(name)) return this.send(res, 409, { success: false, errors: [{ code: 10032, message: 'Subdomain unavailable.' }] });
      this.subdomain = name;
      return this.ok(res, { subdomain: name });
    }

    const script = parts[4];
    if (parts[2] === 'workers' && parts[3] === 'scripts' && script) {
      const tail = parts.slice(5).join('/');
      if (tail === 'assets-upload-session' && r.method === 'POST') {
        const manifest = (JSON.parse(r.body) as { manifest: Session['manifest'] }).manifest;
        const missing = new Set(Object.values(manifest).map((m) => m.hash).filter((h) => !this.blobs.has(h)));
        const completion = this.jwt({ phase: 'complete', script });
        const session: Session = { script, manifest, missing, completion };
        if (missing.size === 0) {
          this.sessions.set(completion, session);
          return this.ok(res, { jwt: completion, buckets: [] });
        }
        const upload = this.jwt({ phase: 'upload', script, ...(this.singleUploads ? { wrangler_single_asset_uploads: true } : {}) });
        this.sessions.set(upload, session);
        this.sessions.set(completion, session);
        const list = [...missing];
        const buckets: string[][] = [];
        for (let i = 0; i < list.length; i += this.bucketSize) buckets.push(list.slice(i, i + this.bucketSize));
        return this.ok(res, { jwt: upload, buckets });
      }
      if (tail === '' && r.method === 'PUT') {
        const form = await new Response(new Uint8Array(raw), { headers: { 'content-type': contentType } }).formData();
        const metadata = JSON.parse(String(form.get('metadata'))) as { assets?: { jwt?: string; config?: { _headers?: string } } };
        const session = metadata.assets?.jwt ? this.sessions.get(metadata.assets.jwt) : undefined;
        if (!session || session.completion !== metadata.assets?.jwt || session.script !== script || session.missing.size > 0) {
          return this.send(res, 400, { success: false, errors: [{ code: 10021, message: 'Invalid assets completion token.' }] });
        }
        const assets = new Map<string, { hash: string; bytes: Buffer }>();
        for (const [p, m] of Object.entries(session.manifest)) assets.set(p, { hash: m.hash, bytes: this.blobs.get(m.hash)! });
        const previous = this.scripts.get(script);
        if (!previous && this.answerAfterChecks > 0) this.warming.set(script, this.answerAfterChecks);
        this.scripts.set(script, { assets, headers: metadata.assets?.config?._headers ?? '', enabled: previous?.enabled ?? false, previews: previous?.previews ?? null });
        this.fading.delete(script);
        return this.ok(res, { id: script });
      }
      if (tail === 'subdomain' && r.method === 'POST') {
        const entry = this.scripts.get(script);
        if (!entry) return this.send(res, 404, { success: false, errors: [{ code: 10007, message: 'Worker not found.' }] });
        const body = JSON.parse(r.body) as { enabled?: boolean; previews_enabled?: boolean };
        entry.enabled = body.enabled === true;
        entry.previews = body.previews_enabled ?? null;
        return this.ok(res, { enabled: entry.enabled, previews_enabled: entry.previews });
      }
      if (tail === '' && r.method === 'DELETE') {
        if (!this.scripts.has(script)) return this.send(res, 404, { success: false, errors: [{ code: 10007, message: 'Worker not found.' }] });
        this.scripts.delete(script);
        this.fading.set(script, this.goneAfterChecks);
        return this.ok(res, null);
      }
    }
    return this.send(res, 404, { success: false, errors: [{ code: 7003, message: 'Could not route' }] });
  }

  private async upload(hashInPath: string | undefined, bearer: string, contentType: string, raw: Buffer, res: http.ServerResponse, auth: string | null): Promise<void> {
    const session = this.sessions.get(bearer);
    if (!session || session.completion === bearer) return this.refuse(res, 401, 10001, 'Upload needs the upload JWT', auth);
    const store = (hash: string, bytes: Buffer, urlPath: string | undefined) => {
      const ext = urlPath ? (urlPath.slice(urlPath.lastIndexOf('/') + 1).split('.').slice(1).pop() ?? '') : '';
      const expected = createHash('sha256').update(bytes.toString('base64') + ext).digest('hex').slice(0, 32);
      if (expected !== hash) throw new Error(`hash mismatch for ${hash}`);
      this.blobs.set(hash, bytes);
      session.missing.delete(hash);
    };
    const pathOf = (hash: string) => Object.entries(session.manifest).find(([, m]) => m.hash === hash)?.[0];
    if (hashInPath) {
      store(hashInPath, raw, pathOf(hashInPath));
    } else {
      const form = await new Response(new Uint8Array(raw), { headers: { 'content-type': contentType } }).formData();
      for (const [hash, value] of form as unknown as Iterable<[string, string | Blob]>) {
        const text = typeof value === 'string' ? value : await value.text();
        store(hash, Buffer.from(text, 'base64'), pathOf(hash));
      }
    }
    this.send(res, 201, { success: true, errors: [], result: session.missing.size === 0 ? { jwt: session.completion } : {} });
  }

  /** `https://<script>.<subdomain>.workers.dev/<path>`, as the public would ask it. */
  private site(url: URL, r: FakeRequest, res: http.ServerResponse): void {
    const [, , host, ...rest] = url.pathname.split('/');
    const [script, sub] = (host ?? '').split('.');
    const warm = this.warming.get(script ?? '');
    if (warm !== undefined && warm > 0) {
      this.warming.set(script!, warm - 1);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('There is nothing here yet');
      return;
    }
    let entry = sub === this.subdomain ? this.scripts.get(script ?? '') : undefined;
    if (!entry && this.fading.has(script ?? '')) {
      const left = this.fading.get(script!)!;
      if (left > 0) {
        this.fading.set(script!, left - 1);
        res.writeHead(200, { 'Content-Type': 'text/html', 'X-Robots-Tag': 'noindex' });
        res.end('<p>still cached</p>');
        return;
      }
    }
    if (!entry || !entry.enabled) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('There is nothing here yet'); return; }
    const p = `/${rest.join('/')}`;
    const asset = entry.assets.get(p === '/' ? '/index.html' : p) ?? entry.assets.get(`${p}.html`);
    const noindex = /\/\*\n\s+X-Robots-Tag: noindex/.test(entry.headers);
    const headers: Record<string, string> = noindex ? { 'X-Robots-Tag': 'noindex' } : {};
    if (!asset) { res.writeHead(404, headers); res.end('Not found'); return; }
    res.writeHead(200, headers);
    res.end(asset.bytes);
    void r;
  }
}
