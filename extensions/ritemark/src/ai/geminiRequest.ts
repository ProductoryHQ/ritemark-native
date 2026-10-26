/**
 * Gemini API requests (Sprint 141, R12/#558, R13).
 *
 * Every request Ritemark makes to Google's Gemini API sends the person's key in the
 * `x-goog-api-key` header, never in the URL: a query string ends up in proxy and
 * gateway logs, crash reports and error messages where a header does not. Google's
 * API overview: every request "must include a x-goog-api-key header".
 * `geminiRequest.test.ts` scans the source for a Gemini URL that carries `key=`.
 *
 * Pure apart from the injectable `fetch`, so it unit-tests without vscode.
 */

export const GEMINI_API_ORIGIN = 'https://generativelanguage.googleapis.com';

export type GeminiApiVersion = 'v1' | 'v1beta';

/** A Gemini API URL. It never takes the key: that goes in `geminiHeaders`. */
export function geminiUrl(version: GeminiApiVersion, path: string, query?: Record<string, string>): string {
  const url = new URL(`${GEMINI_API_ORIGIN}/${version}/${path.replace(/^\/+/, '')}`);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (name.toLowerCase() === 'key') throw new Error('The Gemini API key goes in the x-goog-api-key header, never in the URL');
    url.searchParams.set(name, value);
  }
  return url.toString();
}

/** Request headers for the Gemini API: the key, and any others the call needs. */
export function geminiHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  return { ...extra, 'x-goog-api-key': apiKey };
}

export interface GeminiApiModel {
  name?: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

export interface GeminiModelListing {
  /** Every model of every page read. */
  models: GeminiApiModel[];
  /** Pages read successfully. */
  pages: number;
  /** HTTP status of the first page that failed, if one did. */
  failedStatus?: number;
  /** Google's own message for that failure, if it sent one. */
  failedMessage?: string;
}

export interface ListGeminiModelsOptions {
  version?: GeminiApiVersion;
  /** Google's documented maximum per page; its default is 50 (R13). */
  pageSize?: number;
  maxPages?: number;
  /** Per page. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * `models.list`, every page (R13): Google returns 50 models per page unless asked
 * for more, with a `nextPageToken` for the rest. A page that fails after the first
 * keeps what was read. The first page's failure is reported, not thrown, so each
 * caller keeps its own error wording.
 */
export async function listGeminiModels(apiKey: string, options: ListGeminiModelsOptions = {}): Promise<GeminiModelListing> {
  const {
    version = 'v1',
    pageSize = 1000,
    maxPages = 5,
    timeoutMs = 8_000,
    fetchImpl = fetch,
  } = options;
  const listing: GeminiModelListing = { models: [], pages: 0 };
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const query: Record<string, string> = { pageSize: String(pageSize) };
    if (pageToken) query.pageToken = pageToken;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(geminiUrl(version, 'models', query), {
        headers: geminiHeaders(apiKey),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as { error?: { message?: unknown } } | undefined;
        listing.failedStatus = response.status;
        if (typeof body?.error?.message === 'string') listing.failedMessage = body.error.message;
        break;
      }
      const body = await response.json() as { models?: unknown; nextPageToken?: unknown };
      if (Array.isArray(body.models)) listing.models.push(...body.models.filter(isRecord));
      listing.pages++;
      pageToken = typeof body.nextPageToken === 'string' && body.nextPageToken ? body.nextPageToken : undefined;
      if (!pageToken) break;
    } catch (err) {
      listing.failedMessage = err instanceof Error && err.name !== 'AbortError' ? err.message : 'The request timed out';
      break;
    } finally {
      clearTimeout(timer);
    }
  }
  return listing;
}

function isRecord(value: unknown): value is GeminiApiModel {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
