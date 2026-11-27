/**
 * The feedback door (Sprint 140, R10–R13; experience 34): one command,
 * `ritemark.feedback.open`, behind every way in (the status bar, Help, AI
 * information, All commands). It asks the workbench (patch 018,
 * `ritemarkFeedbackSheet.ts`) for the sheet over the whole window, with its
 * words from `feedbackCopy.ts`, and answers the sheet's buttons through
 * `_ritemark.feedback.submit`:
 *
 * - straight (neither box ticked): the message alone, through 2.0's feedback
 *   path (`sendFeedback`), sent with usage data on or off; "sent" only when the
 *   service accepted it;
 * - e-mail (either box ticked): Sprint 126's transport (`mailto:` to
 *   info@productory.eu, the length bound, three outcomes, Copy), with the AI's
 *   answer only when the person ticked it and saw it.
 *
 * Without the sheet (a shell older than 2.1), AI issues fall back to 2.0's
 * report window on the AI's sheet, and feedback to a one-line box.
 */

import { createHash } from 'node:crypto';
import * as vscode from 'vscode';
import { sendFeedback, trackEvent } from '../analytics/posthog';
import { composeReport, narrowReportContext, REPORT_RECIPIENT, reportSubject, type ReportContextV1 } from '../reporting/composeReport';
import { openReportMail, type ReportTransportOutcome } from '../reporting/reportTransport';
import type { FeedbackSheetOutcome, OpenAnswerFeedbackResult } from './answerFeedbackProtocol';
import { FEEDBACK_COPY } from './feedbackCopy';
import { isSafeFeedbackQuotePart } from './feedbackQuoteSafety';
import { answerForSheet, mailKindOf, routeOf } from './feedbackRoute';

export const HELP_GITHUB_COMMAND = 'ritemark.help.github';
export const HELP_DISCUSSIONS_COMMAND = 'ritemark.help.discussions';
const GITHUB_URL = 'https://github.com/ProductoryHQ/ritemark-native';

async function openHelpLink(url: string): Promise<boolean> {
  try {
    return await vscode.env.openExternal(vscode.Uri.parse(url, true));
  } catch {
    return false;
  }
}

export const FEEDBACK_OPEN_COMMAND = 'ritemark.feedback.open';
export const FEEDBACK_SUBMIT_COMMAND = '_ritemark.feedback.submit';
/** Registered by patch 018 in the workbench. */
export const FEEDBACK_BRIEF_TOAST_COMMAND = '_ritemark.briefToast';
export const FEEDBACK_SHEET_COMMAND = '_ritemark.feedbackSheet';

export type FeedbackDoor = 'status_bar' | 'help' | 'ai_info' | 'command' | 'thumb' | 'failure_card';

export interface FeedbackCardQuote {
  title: string;
  line: string;
}

export interface FeedbackTurnRef {
  conversationId: string;
  turnId: string;
}
export interface FeedbackOpenOptions {
  from: FeedbackDoor;
  kind?: 'feedback' | 'ai-issue';
  /** The visible card title and line. The sheet controls whether they are included. */
  quote?: FeedbackCardQuote;
  /** Nonempty initial message, overriding a matching window draft. */
  text?: string;
  /** A particular completed answer to offer, independent of the chat currently open. */
  turn?: FeedbackTurnRef;
  /** Preselect the referenced answer and open as an AI issue if the answer is found. */
  withAnswer?: boolean;
}

/** What the workbench's sheet is given. */
export interface FeedbackSheetSpec {
  token: string;
  draftKey: string;
  includeAnswer: boolean;
  kind: 'feedback' | 'ai-issue';
  aiIssue: boolean;
  isMac: boolean;
  quote?: FeedbackCardQuote;
  text?: string;
  lastAnswer: { chatTitle: string; quote: string; shortened: boolean } | null;
  words: typeof FEEDBACK_COPY;
}

export interface FeedbackSubmitRequest {
  token: string;
  route: 'straight' | 'email';
  text: string;
  aiIssue: boolean;
  wantAnswer: boolean;
  withAnswer: boolean;
  withPicture: boolean;
  includeQuote?: boolean;
}

export type FeedbackSubmitResult =
  | { route: 'straight'; outcome: 'accepted' | 'failed' }
  | { route: 'email'; outcome: ReportTransportOutcome | 'invalid'; kindLabel: string; shown: string; copyText: string };

export interface FeedbackDependencies {
  appVersion: string;
  /** The open chat's last answer on the AI's sheet, from its record; null without one. */
  lastAnswer(): Promise<{ title: string; text: string } | null>;
  answerOfTurn(ref: FeedbackTurnRef): Promise<{ title: string; text: string } | null>;
  /** 2.0's report window, for a shell without the sheet. */
  openReportWindow(): Promise<void>;
}

const DOORS: readonly FeedbackDoor[] = ['status_bar', 'help', 'ai_info', 'command', 'thumb', 'failure_card'];

function recordOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}

function boundQuotePart(value: string, limit: number): string {
  if (value.length <= limit) return value.replace(/[\uD800-\uDFFF]/gu, '\uFFFD');
  const prefix = value.slice(0, limit - 1);
  const completeWords = /\s/.test(value[limit - 1]) ? prefix.trimEnd() : prefix.replace(/\s+\S*$/, '').trimEnd();
  return `${(completeWords || prefix).replace(/[\uD800-\uDBFF]$/, '').replace(/[\uD800-\uDFFF]/gu, '\uFFFD')}…`;
}

function decodeQuote(raw: unknown): { quote: FeedbackCardQuote; key: string } | undefined {
  const { title, line } = recordOf(raw);
  if (typeof title !== 'string' || typeof line !== 'string') return;
  const parts = [title, line].map(part => part.trim());
  if (!parts.every(isSafeFeedbackQuotePart)) return;
  return {
    quote: {
      title: boundQuotePart(parts[0].replace(/[\r\n\u2028\u2029]+/g, ' '), 120),
      line: boundQuotePart(parts[1].replace(/[\r\n\u2028\u2029]+/g, ' '), 500),
    },
    key: `card:${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16)}`,
  };
}

function decodeTurn(raw: unknown): FeedbackTurnRef | undefined {
  const { conversationId, turnId } = recordOf(raw);
  if (typeof conversationId !== 'string' || !conversationId.trim() || typeof turnId !== 'string' || !turnId.trim()) return;
  return { conversationId, turnId };
}

function decodeOpen(raw: unknown): FeedbackOpenOptions & { hasTurn: boolean; draftKey: string } {
  const value = recordOf(raw);
  const card = decodeQuote(value.quote);
  const turn = decodeTurn(value.turn);
  const draftKey = turn ? `turn:${JSON.stringify([turn.conversationId, turn.turnId])}` : card?.key ?? '';
  return {
    draftKey,
    hasTurn: Object.prototype.hasOwnProperty.call(value, 'turn'),
    from: DOORS.includes(value.from as FeedbackDoor) ? (value.from as FeedbackDoor) : 'command',
    kind: value.kind === 'ai-issue' ? 'ai-issue' : 'feedback',
    quote: card?.quote,
    text: typeof value.text === 'string' ? value.text.slice(0, 2_000).replace(/[\uD800-\uDBFF]$/, '') : undefined,
    turn,
    withAnswer: value.withAnswer === true,
  };
}

function sentFrom(door: FeedbackDoor): 'sheet' | 'thumb' | 'failure_card' {
  return door === 'thumb' || door === 'failure_card' ? door : 'sheet';
}

function decodeSubmit(raw: unknown): FeedbackSubmitRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.token !== 'string' || typeof value.text !== 'string' || value.text.length > 8_000) return null;
  if (value.route !== 'straight' && value.route !== 'email') return null;
  const flags = ['aiIssue', 'wantAnswer', 'withAnswer'] as const;
  if (!flags.every((flag) => typeof value[flag] === 'boolean')) return null;
  if (value.withPicture !== undefined && typeof value.withPicture !== 'boolean') return null;
  return { token: value.token, route: value.route, text: value.text, aiIssue: value.aiIssue as boolean, wantAnswer: value.wantAnswer as boolean, withAnswer: value.withAnswer as boolean, includeQuote: value.includeQuote === true, withPicture: value.withPicture === true };
}

/** One open sheet's context: the answer it showed and the time the report carries. */
interface OpenSheet {
  token: string;
  context: ReportContextV1;
  from: FeedbackDoor;
  quote?: FeedbackCardQuote;
  answer: { shown: string; whole: string } | null;
}

export function registerFeedback(context: vscode.ExtensionContext, deps: FeedbackDependencies): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(HELP_GITHUB_COMMAND, () => openHelpLink(GITHUB_URL)),
    vscode.commands.registerCommand(HELP_DISCUSSIONS_COMMAND, () => openHelpLink(`${GITHUB_URL}/discussions`)),
  );
  let open: OpenSheet | null = null;

  let opening = false;
  const openSheet = async (raw?: unknown): Promise<OpenAnswerFeedbackResult['outcome']> => {
    if (opening) return 'failed';
    opening = true;
    try {
      const options = decodeOpen(raw);
      void trackEvent('feedback_opened', { from: options.from });
      const reportContext = narrowReportContext({ appVersion: deps.appVersion, platform: process.platform, occurredAt: new Date().toISOString() });
      const contextual = options.hasTurn || options.from === 'thumb' || options.from === 'failure_card';
      const last = await (options.turn ? deps.answerOfTurn(options.turn)
        : contextual ? Promise.resolve(null) : deps.lastAnswer()).catch(() => null);
      const answer = last ? answerForSheet(reportContext, last.text) : null;
      const addAnswer = options.from === 'thumb' && options.withAnswer;
      if (addAnswer && !answer) return 'failed';
      const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      open = { token, context: reportContext, from: options.from, quote: options.quote, answer: last && answer ? { shown: answer.text, whole: last.text.trim() } : null };
      const includeAnswer = Boolean(options.withAnswer && options.turn && answer);
      const aiIssue = options.kind === 'ai-issue' || includeAnswer;
      const spec: FeedbackSheetSpec = {
        token,
        draftKey: options.draftKey,
        includeAnswer,
        kind: aiIssue ? 'ai-issue' : 'feedback',
        aiIssue,
        isMac: process.platform === 'darwin',
        quote: options.quote,
        text: options.text || undefined,
        lastAnswer: last && answer ? { chatTitle: last.title, quote: answer.text, shortened: answer.shortened } : null,
        words: FEEDBACK_COPY,
      };
      // The sheet resolves with what happened: 'sent', 'mailed' or 'cancelled'.
      let result: FeedbackSheetOutcome | undefined;
      try {
        result = await vscode.commands.executeCommand<FeedbackSheetOutcome>(FEEDBACK_SHEET_COMMAND, spec);
      } catch {
        if (addAnswer) return 'failed'; // The fallback input box cannot take the answer.
        // A shell without the sheet (patch 018 before 2.1): 2.0's ways, so nothing is lost (R16).
        if (spec.aiIssue && !contextual) {
          await deps.openReportWindow();
          return 'failed';
        }
        const text = await vscode.window.showInputBox({ title: FEEDBACK_COPY.sheet.feedback.title, prompt: FEEDBACK_COPY.sheet.feedback.lede, value: options.text, ignoreFocusOut: true });
        if (!text?.trim()) return 'cancelled';
        const sent = await sendFeedback([{ name: 'feedback_sent', properties: { message: text.trim(), from: sentFrom(options.from) } }]);
        if (sent) void showBriefToast(FEEDBACK_COPY.toast.accepted);
        else void vscode.window.showWarningMessage(FEEDBACK_COPY.sheet.failed);
        return sent ? 'sent' : 'failed';
      }
      if (result === 'sent') void showBriefToast(FEEDBACK_COPY.toast.accepted);
      // The existing workbench command reports the outcome when the sheet closes.
      return result === 'sent' || result === 'mailed' || result === 'cancelled' ? result : 'failed';
    } finally {
      open = null;
      opening = false;
    }
  };

  const submit = async (raw: unknown): Promise<FeedbackSubmitResult | null> => {
    const request = decodeSubmit(raw);
    const sheet = open;
    if (!request || !sheet || request.token !== sheet.token || !request.text.trim()) return null;
    const message = request.text.trim();
    const quote = request.includeQuote ? sheet.quote : undefined;
    const cardSuffix = quote ? `\n\n${FEEDBACK_COPY.sheet.fromCard}:\n${quote.title}\n${quote.line}` : '';
    const text = message + cardSuffix;
    // The sheet's own "Open in e-mail" after a send that did not go (D5) asks for the e-mail route with no box ticked.
    if (request.route === 'straight' && routeOf(request) === 'straight') {
      // The message and nothing else: no address, no document, no chat, no path (R11).
      const accepted = await sendFeedback([{ name: 'feedback_sent', properties: { message: text, from: sentFrom(sheet.from) } }]);
      if (open !== sheet) {
        if (accepted) void showBriefToast(FEEDBACK_COPY.toast.accepted);
        else void vscode.window.showWarningMessage(FEEDBACK_COPY.sheet.failed);
      }
      return { route: 'straight', outcome: accepted ? 'accepted' : 'failed' };
    }
    const kind = mailKindOf(request);
    const withAnswer = request.aiIssue && request.withAnswer && sheet.answer !== null;
    const body = composeReport(sheet.context, message, withAnswer ? sheet.answer!.shown : undefined, cardSuffix);
    const outcome = await openReportMail(
      { recipient: REPORT_RECIPIENT, subject: reportSubject(sheet.context, kind), body },
      { openExternal: (url) => vscode.env.openExternal(vscode.Uri.parse(url, true)) },
    );
    return {
      route: 'email',
      outcome,
      kindLabel: kind === 'ai-issue' ? FEEDBACK_COPY.handoff.kindReport : FEEDBACK_COPY.handoff.kindMessage,
      shown: text,
      // D10: Copy carries the whole answer, not the shortened one.
      copyText: composeReport(sheet.context, message, withAnswer ? sheet.answer!.whole : undefined, cardSuffix),
    };
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(FEEDBACK_OPEN_COMMAND, openSheet),
    vscode.commands.registerCommand(FEEDBACK_SUBMIT_COMMAND, submit),
  );
}

/**
 * A toast that goes by itself after a few seconds (patch 018's `_ritemark.briefToast`): the thank-you is 2.0's
 * notification toast, and it does not stay (experience 35, The build checked). A shell without the command gets an
 * ordinary information message.
 */
export async function showBriefToast(text: string): Promise<void> {
  const shown = await vscode.commands.executeCommand<boolean>(FEEDBACK_BRIEF_TOAST_COMMAND, text).then((value) => value === true, () => false);
  if (!shown) void vscode.window.showInformationMessage(text);
}
