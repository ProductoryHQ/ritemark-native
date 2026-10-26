/**
 * The feedback sheet's rules (Sprint 140, R11, R12; experience 34): which
 * route a message takes, and the AI's last answer shortened to fit an e-mail
 * link (D10). Pure: no `vscode` import.
 */

import { buildMailtoUrl, MAILTO_MAX_URL_CHARS } from '../reporting/reportTransport';
import { composeReport, REPORT_RECIPIENT, reportSubject, type ReportContextV1, type ReportKind } from '../reporting/composeReport';

/** Straight from Ritemark (neither box ticked), or through the person's own e-mail app (either box). */
export type FeedbackRoute = 'straight' | 'email';

export function routeOf(boxes: { aiIssue: boolean; wantAnswer: boolean }): FeedbackRoute {
  return boxes.aiIssue || boxes.wantAnswer ? 'email' : 'straight';
}

/** What the e-mail is about, for its subject and the hand-off's words. */
export function mailKindOf(boxes: { aiIssue: boolean }): ReportKind {
  return boxes.aiIssue ? 'ai-issue' : 'feedback';
}

/** D10: the mark at a cut, in the quote and in the e-mail alike. */
export const SHORTENED_MARK = '[shortened]';

/**
 * Room kept in the e-mail link for the person's own words when the answer is
 * shortened, before they have finished typing. A message that still does not
 * fit takes the too-long outcome, where Copy carries everything.
 */
export const MESSAGE_RESERVE_CHARS = 600;

/** The answer's text cut at a sentence end so that `fits` holds, marked "[shortened]"; unchanged when it fits. */
export function shortenAnswer(answer: string, fits: (candidate: string) => boolean): { text: string; shortened: boolean } {
  const whole = answer.trim();
  if (fits(whole)) return { text: whole, shortened: false };
  // Sentence ends: a full stop, question or exclamation mark, or a line end, then space or the end.
  const ends: number[] = [];
  const pattern = /[.!?](?=\s|$)|\n/g;
  for (let match = pattern.exec(whole); match; match = pattern.exec(whole)) ends.push(match.index + 1);
  for (let index = ends.length - 1; index >= 0; index -= 1) {
    const candidate = `${whole.slice(0, ends[index]).trimEnd()} ${SHORTENED_MARK}`;
    if (fits(candidate)) return { text: candidate, shortened: true };
  }
  // Not even the first sentence fits: cut at a word.
  let cut = whole;
  while (cut.length > 0 && !fits(`${cut} ${SHORTENED_MARK}`)) cut = cut.slice(0, Math.max(0, cut.lastIndexOf(' ', cut.length - 2))).trimEnd();
  return { text: cut ? `${cut} ${SHORTENED_MARK}` : SHORTENED_MARK, shortened: true };
}

/** The e-mail's link for this context, message and answer. */
export function mailUrlOf(context: ReportContextV1, kind: ReportKind, message: string, answer?: string): string {
  return buildMailtoUrl({ recipient: REPORT_RECIPIENT, subject: reportSubject(context, kind), body: composeReport(context, message, answer) });
}

/** The answer as the sheet shows it: shortened so that it fits with room kept for the person's words. */
export function answerForSheet(context: ReportContextV1, answer: string): { text: string; shortened: boolean } {
  const reserve = 'x'.repeat(MESSAGE_RESERVE_CHARS);
  return shortenAnswer(answer, (candidate) => mailUrlOf(context, 'ai-issue', reserve, candidate).length <= MAILTO_MAX_URL_CHARS);
}
