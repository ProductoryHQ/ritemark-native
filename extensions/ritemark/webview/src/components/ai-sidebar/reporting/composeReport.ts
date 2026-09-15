/**
 * The report builder — Sprint 126 (RQ2, RQ5).
 *
 * Microsoft Store policy 11.16 requires a working way for a user to report
 * inappropriate generated output. This module builds the text that gets
 * reported, and it is deliberately the narrowest thing in the feature.
 *
 * WHY THE SIGNATURE IS THE PRIVACY CONTRACT: an earlier design attached the
 * report to a conversation turn and pre-filled the model output, which made
 * RQ5 ("the report carries only the stated fields") a filtering problem — a
 * list of things to strip, which is exactly the kind of list that rots the
 * first time a caller is added. Reporting is now reached from the status bar
 * and from AI Information, neither of which has an output in hand, so this
 * builder is never GIVEN a conversation, a document, a path, a workspace name,
 * a runtime or a credential. It cannot leak what it never receives.
 *
 * The user pastes or writes what they are reporting. That is also why "the
 * user sees exactly what is sent" is literally true here rather than enforced.
 */

/** The only context a report carries. Adding a field here is a privacy decision. */
export interface ReportContextV1 {
  /** Ritemark version, e.g. "1.11.0". */
  appVersion: string;
  /** Platform identifier, e.g. "win32". */
  platform: string;
  /** ISO-8601 timestamp of when the report was composed. */
  occurredAt: string;
}

/**
 * Bound on the user's own text. Generous — a reported output can be long —
 * but finite, because the composed report becomes a `mailto:` body and an
 * unbounded one would be truncated by the mail handler without telling anyone.
 */
export const MAX_REPORT_BODY_CHARS = 8_000;

/** The address that receives reports. Monitored by the Ritemark team. */
export const REPORT_RECIPIENT = 'info@productory.eu';

function trimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Narrow arbitrary input to the three fields a report may carry.
 *
 * Callers pass a bootstrap-shaped object that legitimately holds much more
 * (workspace name, file paths, runtime identity). Rather than trusting each
 * caller to pick correctly, the narrowing happens here, once.
 */
export function narrowReportContext(input: unknown): ReportContextV1 {
  const source = (input ?? {}) as Record<string, unknown>;
  return {
    appVersion: trimmedString(source.appVersion) || 'unknown',
    platform: trimmedString(source.platform) || 'unknown',
    occurredAt: trimmedString(source.occurredAt) || new Date().toISOString(),
  };
}

/** The context block shown at the top of the composed report, and editable. */
export function reportContextLines(context: ReportContextV1): string[] {
  return [
    `Ritemark ${context.appVersion} (${context.platform})`,
    `Reported ${context.occurredAt}`,
  ];
}

/**
 * Build the full report text.
 *
 * `body` is whatever the user typed or pasted. It is clipped rather than
 * rejected, because losing a long paste at the moment someone is trying to
 * complain is the worst possible time to be strict — and the clip is visible
 * in the field before anything is sent.
 */
export function composeReport(context: ReportContextV1, body: string): string {
  const clipped = body.slice(0, MAX_REPORT_BODY_CHARS).trimEnd();
  return [...reportContextLines(context), '', clipped].join('\n').trimEnd();
}

/** Subject line for the mail handler. Carries no report content. */
export function reportSubject(context: ReportContextV1): string {
  return `Ritemark ${context.appVersion} — AI output report`;
}
