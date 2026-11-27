const webAddress = /\b[a-z][a-z\d+.-]*:\/\/[^\s"'“”‘’«»<>()[\]{},;]+/giu;

/** Check the original visible words before bounding or forwarding a card quote. */
export function isSafeFeedbackQuotePart(part: string): boolean {
  // Scan the original words, including URL paths and query strings, before truncation.
  const localPath = /\/(?:users|home|volumes|private|tmp|var|mnt|media|root|etc|opt|srv|usr|workspaces?)\/|…\/documents\/|~\/|\b[a-z]:[\\/]|\\\\[^\s\\/]+\\|\b(?:file|smb):/i;
  const credentials = /\/\/[^/\s?#@]+@|[?&](?:key|api_key|apikey|token|access_token|sig|signature|password|secret)=/i;
  // Any other absolute path that names a file (`/a/b/c.docx`), outside web addresses (Codex's review of #1135).
  const filePath = /(?:^|[^\p{L}\p{N}_.-])\/(?:[^\s/\\"'“”‘’«»<>()[\]{},;]+\/)+[^\s/\\"'“”‘’«»<>()[\]{},;]*[^\s/\\"'“”‘’«»<>()[\]{},;.]\.[a-z][a-z\d]{0,7}(?![\p{L}\p{N}])/iu;
  return Boolean(part.trim()) && !localPath.test(part) && !credentials.test(part) && !filePath.test(part.replace(webAddress, ' '));
}

export const PUBLISH_FAILURE_TITLE = "Publish didn't go";
export const OFFICE_FAILURE_FEEDBACK_MESSAGE = 'office:openFailureFeedback';
export const DECK_FAILURE_FEEDBACK_MESSAGE = 'deck/open-failure-feedback';

interface FailureCardQuote {
  title: string;
  line: string;
}

const diagnostic = /[\r\n\u2028\u2029]|^\s*(?:[\[{]|(?:\w*Error|Exception)\s*:)|\b(?:bearer\s+\S+|(?:api[_ -]?key|access[_ -]?token|password)\s*[:=]\s*\S+)/i;
// Slashes between name characters also catch a relative path whose filename has spaces.
const localPath = /(?:^|[\s"'“‘(])(?:\/[^/\s]|\.{1,2}[\\/])|[\p{L}\p{N}_.-][\\/][\p{L}\p{N}_.-]/u;

export function isSafeFailureFeedbackPart(part: string): boolean {
  return isSafeFeedbackQuotePart(part) && !diagnostic.test(part) && !localPath.test(part.replace(webAddress, ' '));
}

export function failureFeedbackOptions(title: string, line: string) {
  const quote = [title, line].every(isSafeFailureFeedbackPart) ? { title, line } : undefined;
  return { from: 'failure_card' as const, ...(quote ? { quote } : {}) };
}

/** A preview can ask to quote only the failure its own host last posted. */
export function decodeFailureFeedbackOpen(raw: unknown, shown: FailureCardQuote) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
  const { from, quote } = raw as Record<string, unknown>;
  if (from !== 'failure_card') return;
  if (quote === undefined) return { from };
  if (!quote || typeof quote !== 'object' || Array.isArray(quote)) return;
  const { title, line } = quote as Record<string, unknown>;
  if (title !== shown.title || line !== shown.line) return;
  return failureFeedbackOptions(shown.title, shown.line);
}
