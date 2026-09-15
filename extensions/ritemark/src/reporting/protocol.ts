/**
 * Report protocol — Sprint 126 (RQ3, RQ5).
 *
 * One message in, one result out. Shape follows `../commentTasks/protocol.ts`:
 * every field is validated before the host acts, and a rejection names
 * something the UI can turn into a specific state rather than a shrug.
 *
 * The validation here is not defensive theatre. This boundary carries text the
 * user pasted, which means it carries whatever was on their clipboard — so it
 * is bounded, type-checked and never interpolated anywhere but a `mailto:`
 * query value.
 */

import { MAILTO_MAX_URL_CHARS, type ReportTransportOutcome } from './reportTransport';

/** Largest inbound report message we will parse at all. */
export const MAX_REPORT_MESSAGE_BYTES = 64 * 1024;

/** The webview asks the host to hand a composed report to a mail client. */
export interface ReportMailMessageV1 {
  type: 'report/open-mail';
  recipient: string;
  subject: string;
  body: string;
}

export interface ReportMailResultV1 {
  type: 'report/result';
  outcome: ReportTransportOutcome | 'invalid-request';
  /** Echoed so the webview can keep showing the exact text it handed over. */
  body: string;
}

function isPlainString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/**
 * A minimal address check. Not an RFC validator — the recipient is a constant
 * the webview echoes back, so this exists to reject a tampered or malformed
 * value before it reaches `mailto:`, not to police real-world addresses.
 */
function isSimpleAddress(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@,;:<>"]+@[^\s@,;:<>"]+\.[^\s@,;:<>"]+$/.test(value);
}

export function decodeReportMailMessage(value: unknown): ReportMailMessageV1 | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (input.type !== 'report/open-mail') return null;
  if (!isSimpleAddress(input.recipient)) return null;
  if (!isPlainString(input.subject, 512)) return null;
  // The body may legitimately be empty — a user can report with the subject
  // alone — but it may not be a non-string, and it may not be unbounded.
  if (typeof input.body !== 'string' || input.body.length > MAX_REPORT_MESSAGE_BYTES) return null;

  return {
    type: 'report/open-mail',
    recipient: input.recipient,
    subject: input.subject,
    body: input.body,
  };
}

export function reportResult(
  outcome: ReportMailResultV1['outcome'],
  body: string,
): ReportMailResultV1 {
  return { type: 'report/result', outcome, body };
}

/** Re-exported so the webview can show the same bound the host enforces. */
export { MAILTO_MAX_URL_CHARS };
