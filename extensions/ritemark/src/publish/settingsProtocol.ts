/**
 * The `publish:*` messages between Settings ▸ Sharing ▸ Web pages and the host (Sprint 149, spec R9).
 *
 * Exact-field decoding, as `googleDocs/protocol.ts` does: the page can ask for the five things below and nothing else.
 * **No message either way carries a token.** `publish:startTokenEntry` carries no value: the host opens its own
 * password box (R6). `publish:open` and `publish:unpublish` name a published page by its site name, which the host
 * looks up in its own records; the page can't hand the host an address or an account.
 */

export const PUBLISH_PREFIX = 'publish:';

export type PublishSettingsRequest =
  | { type: 'publish:connect' }
  | { type: 'publish:startTokenEntry' }
  | { type: 'publish:disconnect' }
  | { type: 'publish:open'; id: string }
  | { type: 'publish:unpublish'; id: string };

export const PUBLISH_SETTINGS_REQUESTS = [
  'publish:connect', 'publish:startTokenEntry', 'publish:disconnect', 'publish:open', 'publish:unpublish',
] as const;

/** The host's one message to the page. */
export const PUBLISH_SETTINGS_EVENT = 'publish:settings';

/** A published page in Settings' list (R9). Its address is public already; nothing else about the account is. */
export interface WebPageRow {
  id: string;
  name: string;
  address: string;
  /** Unpublishing: the row's buttons wait; `slow` after 10 s (the lead, answer 7). */
  status: 'online' | 'unpublishing';
  slow: boolean;
  /** Its own failure line ("…The page is still online."), or null. */
  message: string | null;
}

/** Settings ▸ Sharing ▸ Web pages, as the host draws it. The shape mirrors `WebPagesSettingsCard.tsx`'s. */
export interface WebPagesSettingsProjection {
  /** `web-page-publishing`: with it off the list stays, and nothing offers to connect (S28b). */
  enabled: boolean;
  state: 'disconnected' | 'connected';
  accountName: string | null;
  subdomain: string | null;
  /** The host's password box is open. */
  enteringToken: boolean;
  /** Whether a sign-in through Cloudflare's own page exists in this build (decision 6). False in 2.2. */
  oauthAvailable: boolean;
  pages: WebPageRow[];
  message: string | null;
}

const SITE_ID = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function isPublishMessage(value: unknown): value is { type: string } {
  return Boolean(value) && typeof value === 'object'
    && typeof (value as { type?: unknown }).type === 'string'
    && (value as { type: string }).type.startsWith(PUBLISH_PREFIX);
}

export function decodeSettingsRequest(value: unknown): PublishSettingsRequest | null {
  if (!isPublishMessage(value)) return null;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case 'publish:connect':
    case 'publish:startTokenEntry':
    case 'publish:disconnect':
      return exactKeys(message, ['type']) ? { type: message.type } : null;
    case 'publish:open':
    case 'publish:unpublish':
      if (!exactKeys(message, ['type', 'id']) || typeof message.id !== 'string' || !SITE_ID.test(message.id)) return null;
      return { type: message.type, id: message.id };
    default:
      return null;
  }
}
