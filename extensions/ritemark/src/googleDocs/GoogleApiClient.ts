/**
 * The narrow set of Drive and Docs calls Google Docs publishing needs
 * (Sprint 119, W3). Nothing here lists or searches the user's Drive: with the
 * `drive.file` scope Ritemark can only see files it created or that the user
 * handed it through the Picker, and this client asks for nothing more.
 *
 * Every non-2xx answer becomes a `GoogleDocsError` with a stable code. Raw
 * provider bodies never leave this file except as a truncated diagnostic on
 * the error message, which callers log but never show.
 */

import { DEFAULT_REQUEST_TIMEOUT_MS, fetchWithDeadline, type FetchLike } from './oauth';
import {
  GOOGLE_DOC_MIME,
  GoogleDocsError,
  RITEMARK_APP_PROPERTY,
  RITEMARK_STAGING_PROPERTY,
  type GoogleAccountIdentity,
} from './types';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const DOCS = 'https://docs.googleapis.com/v1';

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  trashed: boolean;
  webViewLink?: string;
  appProperties?: Record<string, string>;
}

export interface DocsDocument {
  documentId: string;
  revisionId: string;
  title: string;
  body: { content: DocsStructuralElement[] };
  inlineObjects?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}

/** Just enough of `documents.get?includeTabsContent=true` to see the tab tree. */
export interface DocsTabOutline {
  tabProperties?: { tabId?: string; title?: string };
  childTabs?: DocsTabOutline[];
}

export interface DocsStructuralElement {
  startIndex?: number;
  endIndex: number;
  paragraph?: {
    elements?: { startIndex?: number; endIndex?: number; textRun?: { content?: string } }[];
    bullet?: { nestingLevel?: number };
  };
  table?: {
    tableRows?: { tableCells?: { content?: { startIndex?: number; endIndex?: number }[] }[] }[];
  };
  sectionBreak?: unknown;
}

export interface GoogleApiClientDependencies {
  fetch?: FetchLike;
  /** Deadline for one request including its body; defaults to 60 s. */
  requestTimeoutMs?: number;
  /** Returns a currently valid access token, refreshing it if needed. */
  getAccessToken(): Promise<string>;
  /** Called once on a 401; returns a fresh token or throws reauthorization. */
  refreshAccessToken(): Promise<string>;
}

function retryAfter(headers: { get(name: string): string | null } | undefined): number | undefined {
  const raw = headers?.get('retry-after');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export function mapHttpError(status: number, body: string, headers?: { get(name: string): string | null }): GoogleDocsError {
  let reason = '';
  let message = '';
  try {
    const json = JSON.parse(body) as { error?: { message?: string; errors?: { reason?: string }[] } };
    message = json.error?.message ?? '';
    reason = json.error?.errors?.[0]?.reason ?? '';
  } catch { /* not JSON */ }
  const diag = `${status}${reason ? ` ${reason}` : ''}: ${message.slice(0, 160)}`;
  if (status === 401) return new GoogleDocsError('reauthorization-required', diag, { status });
  if (status === 404) return new GoogleDocsError('target-not-found', diag, { status });
  if (status === 429 || reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
    return new GoogleDocsError('rate-limited', diag, { status, retryAfterSeconds: retryAfter(headers) });
  }
  if (status === 403) return new GoogleDocsError('permission-denied', diag, { status });
  if (status >= 500) return new GoogleDocsError('provider-unavailable', diag, { status });
  if (status === 400 && /revision/i.test(message)) return new GoogleDocsError('verification-required', diag, { status });
  return new GoogleDocsError('unexpected', diag, { status });
}

export class GoogleApiClient {
  private readonly fetch: FetchLike;

  constructor(private readonly deps: GoogleApiClientDependencies) {
    this.fetch = deps.fetch ?? (globalThis.fetch as unknown as FetchLike);
  }

  // ------------------------------------------------------------------ identity

  /** `about.get` works with `drive.file`, so identity needs no extra scope. */
  async whoAmI(): Promise<GoogleAccountIdentity> {
    const json = await this.json<{ user?: { permissionId?: string; emailAddress?: string; displayName?: string } }>(
      'GET', `${DRIVE}/about?fields=user(permissionId,emailAddress,displayName)`);
    const user = json.user;
    if (!user?.permissionId || !user.emailAddress) throw new GoogleDocsError('unexpected', 'Google returned no account identity');
    return { accountId: user.permissionId, email: user.emailAddress, displayName: user.displayName ?? user.emailAddress };
  }

  // ------------------------------------------------------------------ files

  getFile(fileId: string): Promise<DriveFileMeta> {
    return this.json('GET', `${DRIVE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,trashed,webViewLink,appProperties`);
  }

  createDocument(name: string, operationId: string): Promise<DriveFileMeta> {
    return this.json('POST', `${DRIVE}/files?fields=id,name,mimeType,trashed,webViewLink,appProperties`, {
      name,
      mimeType: GOOGLE_DOC_MIME,
      appProperties: { [RITEMARK_APP_PROPERTY]: operationId },
    });
  }

  copyDocument(sourceId: string, name: string, operationId: string): Promise<DriveFileMeta> {
    return this.json('POST', `${DRIVE}/files/${encodeURIComponent(sourceId)}/copy?fields=id,name,mimeType,trashed,webViewLink,appProperties`, {
      name,
      appProperties: { [RITEMARK_APP_PROPERTY]: operationId },
    });
  }

  /** Recovery after an indeterminate create: find the file by the tag we wrote. */
  async findByOperation(operationId: string): Promise<DriveFileMeta | null> {
    const q = `appProperties has { key='${RITEMARK_APP_PROPERTY}' and value='${operationId.replace(/'/g, '')}' } and trashed=false`;
    const json = await this.json<{ files?: DriveFileMeta[] }>(
      'GET', `${DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,trashed,webViewLink,appProperties)&pageSize=5`);
    return json.files?.[0] ?? null;
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.request('DELETE', `${DRIVE}/files/${encodeURIComponent(fileId)}`);
  }

  // ------------------------------------------------------------------ image staging

  /** Upload image bytes as a temporary app-created file. */
  async uploadImage(bytes: Buffer, mimeType: string, name: string): Promise<string> {
    const boundary = `ritemark-${Math.random().toString(36).slice(2)}`;
    const meta = { name, appProperties: { [RITEMARK_STAGING_PROPERTY]: 'temporary' } };
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await this.request('POST', `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`, body, `multipart/related; boundary=${boundary}`);
    const json = JSON.parse(await res.text()) as { id?: string };
    if (!json.id) throw new GoogleDocsError('unexpected', 'Image upload returned no id');
    return json.id;
  }

  /** Make a staged image link-readable so Docs' anonymous fetcher can copy it. */
  async shareByLink(fileId: string): Promise<string> {
    const json = await this.json<{ id?: string }>('POST', `${DRIVE}/files/${encodeURIComponent(fileId)}/permissions?fields=id`, {
      role: 'reader',
      type: 'anyone',
    });
    if (!json.id) throw new GoogleDocsError('unexpected', 'Sharing returned no permission id');
    return json.id;
  }

  async unshare(fileId: string, permissionId: string): Promise<void> {
    await this.request('DELETE', `${DRIVE}/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}`);
  }

  // ------------------------------------------------------------------ docs

  getDocument(documentId: string): Promise<DocsDocument> {
    return this.json('GET', `${DOCS}/documents/${encodeURIComponent(documentId)}`);
  }

  /** The tab tree only — ids and titles, no content. */
  getDocumentTabs(documentId: string): Promise<{ tabs?: DocsTabOutline[] }> {
    const fields = encodeURIComponent('tabs(tabProperties(tabId,title),childTabs(tabProperties(tabId,title)))');
    return this.json('GET', `${DOCS}/documents/${encodeURIComponent(documentId)}?includeTabsContent=true&fields=${fields}`);
  }

  /**
   * One atomic batch. With `requiredRevisionId`, Google refuses the write if
   * anyone has changed the document since that revision (Phase 0 §4).
   */
  batchUpdate(documentId: string, requests: unknown[], requiredRevisionId?: string): Promise<{ writeControl?: { requiredRevisionId?: string } }> {
    return this.json('POST', `${DOCS}/documents/${encodeURIComponent(documentId)}:batchUpdate`, {
      requests,
      ...(requiredRevisionId ? { writeControl: { requiredRevisionId } } : {}),
    });
  }

  // ------------------------------------------------------------------ transport

  private async json<T>(method: string, url: string, body?: unknown): Promise<T> {
    const res = await this.request(method, url, body === undefined ? undefined : JSON.stringify(body), 'application/json');
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  private async request(method: string, url: string, body?: string | Buffer, contentType?: string) {
    const send = (token: string) => fetchWithDeadline(this.fetch, url, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body !== undefined && contentType ? { 'content-type': contentType } : {}) },
      body,
    }, this.deps.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
    let res = await send(await this.deps.getAccessToken());
    if (res.status === 401) {
      // One refresh, one retry. A second 401 is a revoked or expired grant.
      res = await send(await this.deps.refreshAccessToken());
    }
    if (!res.ok) throw mapHttpError(res.status, await res.text(), res.headers);
    return res;
  }
}
