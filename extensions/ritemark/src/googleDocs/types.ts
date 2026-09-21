/**
 * Google Docs publishing — domain types (Sprint 119).
 *
 * The extension host owns every fact in here: which Google account is
 * connected, which Google Doc belongs to which Markdown file, and what state a
 * publish is in. Webviews only ever receive the redacted projections at the
 * bottom of this file — never a token, an authorization code, or a raw
 * provider response.
 *
 * Contract: docs/development/releases/v1.12.0/sprint-119-google-docs-publishing/
 *   spec.md (R1–R11) and research/integration-decisions.md
 */

export const GOOGLE_DOCS_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

/** Tag written into every file Ritemark creates, so an indeterminate create can
 *  be found again instead of retried into a duplicate (integration-decisions §4). */
export const RITEMARK_APP_PROPERTY = 'ritemarkPublish';
/** Tag for the temporary image copies used while publishing (§Images). */
export const RITEMARK_STAGING_PROPERTY = 'ritemarkImageStaging';

// ---------------------------------------------------------------------------
// Account

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds at which the access token stops being accepted. */
  expiresAt: number;
  scope: string;
}

/** Who is connected. `accountId` is Drive's stable `permissionId`, which does
 *  not change when the user renames their account or edits their address. */
export interface GoogleAccountIdentity {
  accountId: string;
  email: string;
  displayName: string;
}

export interface StoredGoogleAccountV1 extends GoogleAccountIdentity {
  schemaVersion: 1;
  connectedAt: string;
  tokens: GoogleTokens;
}

export interface GoogleTemplateChoice {
  fileId: string;
  name: string;
  /** Account that granted access to the template through the Picker. */
  accountId: string;
}

// ---------------------------------------------------------------------------
// Document binding — one Markdown file ↔ one Google Doc

export interface GoogleDocsBindingV1 {
  schemaVersion: 1;
  /** Canonical `file:` URI of the Markdown document. */
  documentUri: string;
  accountId: string;
  accountEmail: string;
  fileId: string;
  title: string;
  templateFileId: string | null;
  createdAt: string;
  lastSyncedAt: string;
  /**
   * Docs `revisionId` read back after Ritemark's own last write. A different
   * revision later means someone edited the Doc in Google Docs; Drive's
   * `version` does not move for such edits (integration-decisions §4).
   */
  lastRevisionId: string;
  /** SHA-256 of the HTML Ritemark last published, for "already up to date". */
  lastSourceHash: string;
  /** Whether the user has already seen and accepted the overwrite warning. */
  overwriteAcknowledged: boolean;
}

// ---------------------------------------------------------------------------
// Errors

export type GoogleDocsErrorCode =
  | 'configuration-unavailable'
  | 'not-connected'
  | 'reauthorization-required'
  | 'account-mismatch'
  | 'permission-denied'
  | 'target-not-found'
  | 'target-trashed'
  | 'template-unavailable'
  | 'rate-limited'
  | 'provider-unavailable'
  | 'offline'
  | 'conversion-failed'
  | 'verification-required'
  | 'local-binding-failed'
  | 'untitled-document'
  | 'cancelled'
  | 'busy'
  | 'feature-disabled'
  | 'unexpected';

export class GoogleDocsError extends Error {
  constructor(
    readonly code: GoogleDocsErrorCode,
    message: string,
    readonly details: { status?: number; retryAfterSeconds?: number; docUrl?: string } = {},
  ) {
    super(message);
    this.name = 'GoogleDocsError';
  }
}

/** Short, stable, user-safe copy per error class (design.md § Error Copy Matrix).
 *  Never includes a provider body, a token, or a file ID. */
export const GOOGLE_DOCS_ERROR_COPY: Record<GoogleDocsErrorCode, string> = {
  'configuration-unavailable': 'Google Docs publishing is not available in this build of Ritemark.',
  'not-connected': 'Connect a Google account in Ritemark Settings first.',
  'reauthorization-required': 'Google no longer accepts this connection. Reconnect your Google account in Settings.',
  'account-mismatch': 'This document was published with a different Google account. Connect that account to sync it.',
  'permission-denied': 'Google denied access to this document.',
  'target-not-found': 'The linked Google Doc is unavailable. It may have been deleted or moved out of your access.',
  'target-trashed': 'The linked Google Doc is in your Google Drive trash. Restore it, or remove the publishing link to create a new one.',
  'template-unavailable': 'The default template is no longer available to this account. Choose another template or remove it in Settings.',
  'rate-limited': 'Google is temporarily limiting requests. Try again in a moment.',
  'provider-unavailable': 'Google Docs is temporarily unavailable. Try again in a moment.',
  'offline': 'You appear to be offline. Try again when you are connected.',
  'conversion-failed': 'This document could not be prepared for Google Docs.',
  'verification-required': 'Ritemark could not confirm the result. It will check before trying again.',
  'local-binding-failed': 'The Google Doc was created, but Ritemark could not save its link.',
  'untitled-document': 'Save this document to a file before publishing it.',
  'cancelled': 'Cancelled.',
  'busy': 'This document is already being published.',
  'feature-disabled': 'Google Docs publishing is turned off.',
  'unexpected': 'Something went wrong while talking to Google Docs.',
};

// ---------------------------------------------------------------------------
// Projections — the only shapes a webview ever sees

export type GoogleDocsAccountState =
  | 'unavailable'      // no OAuth configuration in this build
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reauthorize';

export interface GoogleDocsSettingsProjection {
  enabled: boolean;
  state: GoogleDocsAccountState;
  email: string | null;
  displayName: string | null;
  template: { name: string } | null;
  choosingTemplate: boolean;
  /** Last user-facing failure of a Settings action, if any. */
  message: string | null;
}

export type GoogleDocsDocumentState =
  | 'hidden'           // feature off, or not a Markdown file
  | 'unavailable'      // no configuration in this build
  | 'not-connected'
  | 'unbound'
  | 'bound'
  | 'account-mismatch'
  | 'busy';

export interface GoogleDocsDocumentProjection {
  state: GoogleDocsDocumentState;
  /** Safe HTTPS link to the bound Doc; never the raw file ID on its own. */
  docUrl: string | null;
  title: string | null;
  lastSyncedAt: string | null;
  boundAccountEmail: string | null;
  /** Current operation stage while `busy`. */
  stage: PublishStage | null;
}

export type PublishStage = 'preparing' | 'uploading-images' | 'writing' | 'verifying';

export function docUrlFor(fileId: string): string {
  return `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/edit`;
}
