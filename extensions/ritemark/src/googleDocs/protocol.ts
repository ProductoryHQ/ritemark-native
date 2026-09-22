/**
 * The `google-docs/*` messages between webviews and the host (Sprint 119, W5).
 *
 * Same discipline as `commentTasks/protocol.ts`: exact-field decoding, so a
 * webview can only ask for the handful of things below and cannot smuggle a
 * file ID, an account, or a URL into a host action. The host resolves every
 * identity itself from the document the message arrived on.
 */

import type { GoogleDocsDocumentProjection, GoogleDocsSettingsProjection } from './types';

export const GOOGLE_DOCS_PREFIX = 'google-docs/';

/** Largest export HTML accepted from the editor (data-URI images included). */
export const MAX_PUBLISH_HTML_BYTES = 40 * 1024 * 1024;

export type GoogleDocsEditorRequest =
  | { type: 'google-docs/publish'; html: string; title: string | null }
  | { type: 'google-docs/open' }
  | { type: 'google-docs/unlink' }
  | { type: 'google-docs/open-settings' }
  | { type: 'google-docs/request-projection' };

export type GoogleDocsSettingsRequest =
  | { type: 'google-docs/connect' }
  | { type: 'google-docs/cancel' }
  | { type: 'google-docs/disconnect' }
  | { type: 'google-docs/choose-template' }
  | { type: 'google-docs/clear-template' };

export type GoogleDocsEditorEvent = { type: 'google-docs/projection'; projection: GoogleDocsDocumentProjection };
export type GoogleDocsSettingsEvent = { type: 'google-docs/settings'; projection: GoogleDocsSettingsProjection };

function exactKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function isGoogleDocsMessage(value: unknown): value is { type: string } {
  return Boolean(value) && typeof value === 'object'
    && typeof (value as { type?: unknown }).type === 'string'
    && (value as { type: string }).type.startsWith(GOOGLE_DOCS_PREFIX);
}

export function decodeEditorRequest(value: unknown): GoogleDocsEditorRequest | null {
  if (!isGoogleDocsMessage(value)) return null;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case 'google-docs/publish': {
      if (!exactKeys(message, ['type', 'html', 'title'])) return null;
      if (typeof message.html !== 'string' || Buffer.byteLength(message.html) > MAX_PUBLISH_HTML_BYTES) return null;
      const title = message.title === undefined || message.title === null ? null
        : typeof message.title === 'string' ? message.title.slice(0, 250) : undefined;
      if (title === undefined) return null;
      return { type: 'google-docs/publish', html: message.html, title };
    }
    case 'google-docs/open':
    case 'google-docs/unlink':
    case 'google-docs/open-settings':
    case 'google-docs/request-projection':
      return exactKeys(message, ['type']) ? { type: message.type } : null;
    default:
      return null;
  }
}

export function decodeSettingsRequest(value: unknown): GoogleDocsSettingsRequest | null {
  if (!isGoogleDocsMessage(value)) return null;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case 'google-docs/connect':
    case 'google-docs/cancel':
    case 'google-docs/disconnect':
    case 'google-docs/choose-template':
    case 'google-docs/clear-template':
      return exactKeys(message, ['type']) ? { type: message.type } : null;
    default:
      return null;
  }
}
