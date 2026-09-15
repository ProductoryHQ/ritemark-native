/**
 * Report transport — Sprint 126 (RQ3).
 *
 * Ritemark does not send the report. It hands it to the user's mail client and
 * the story ends there: no callback, no receipt, no way to learn whether the
 * user pressed send. Everything downstream of this module is written to be
 * honest about that (see `reportCopy.ts`).
 *
 * THREE OUTCOMES, ONLY ONE OF WHICH IS "the mail app opened":
 *
 *  - `opened`      — `openExternal` accepted the URI. NOT a delivery, and not
 *                    even a guarantee a window appeared: on some systems the
 *                    call resolves true while the OS quietly does nothing. The
 *                    UI therefore keeps the report text and a Copy control
 *                    visible in this state too, rather than treating it as done.
 *  - `no-handler`  — `openExternal` refused or threw. The expected case on a
 *                    clean Windows machine with no mail account, which is
 *                    exactly what a Store reviewer is likely to be using, so it
 *                    is a first-class state and not an error.
 *  - `too-long`    — the encoded URI exceeds what mail handlers carry reliably.
 *                    Handled BEFORE opening anything, because the failure mode
 *                    otherwise is silent truncation: the handler opens, the
 *                    body is cut, and the user sends a report missing the part
 *                    they cared about without either of us noticing.
 */

/**
 * Conservative ceiling on the whole encoded `mailto:` URI.
 *
 * There is no single documented limit — handlers, shells and the OS each
 * impose their own, and the ones that truncate do it without reporting. 1800
 * is comfortably inside every commonly cited bound. Being too generous here
 * loses report content silently; being too strict merely routes the user to
 * the copy path, which works and tells the truth. The asymmetry decides it.
 */
export const MAILTO_MAX_URL_CHARS = 1_800;

export type ReportTransportOutcome = 'opened' | 'no-handler' | 'too-long';

export interface ReportMailRequest {
  recipient: string;
  subject: string;
  body: string;
}

/** RFC 6068 wants the address raw and the header values percent-encoded. */
export function buildMailtoUrl(request: ReportMailRequest): string {
  const query = [
    `subject=${encodeURIComponent(request.subject)}`,
    `body=${encodeURIComponent(request.body)}`,
  ].join('&');
  return `mailto:${request.recipient}?${query}`;
}

/** True when the encoded URI is short enough to hand over without risking a cut. */
export function fitsInMailto(request: ReportMailRequest): boolean {
  return buildMailtoUrl(request).length <= MAILTO_MAX_URL_CHARS;
}

export interface ReportTransportDependencies {
  /**
   * Hands the URL to the OS. Injected as a plain string function so this
   * module never imports `vscode` — which keeps it runnable under `tsx` in a
   * plain Node test, the same reason `CommentTaskController` takes its
   * dependencies rather than reaching for the API.
   */
  openExternal: (url: string) => Promise<boolean> | Thenable<boolean>;
}

/**
 * Attempt the handoff. Never throws: every failure is one of the outcomes
 * above, because a thrown error here would surface as "something went wrong"
 * on a path whose whole job is to be dependable.
 */
export async function openReportMail(
  request: ReportMailRequest,
  dependencies: ReportTransportDependencies,
): Promise<ReportTransportOutcome> {
  if (!fitsInMailto(request)) return 'too-long';

  try {
    const opened = await dependencies.openExternal(buildMailtoUrl(request));
    return opened ? 'opened' : 'no-handler';
  } catch {
    return 'no-handler';
  }
}
