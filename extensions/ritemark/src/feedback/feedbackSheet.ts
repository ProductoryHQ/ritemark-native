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
 *   last answer only when the person ticked it and saw it.
 *
 * Without the sheet (a shell older than 2.1), AI issues fall back to 2.0's
 * report window on the AI's sheet, and feedback to a one-line box.
 */

import * as vscode from 'vscode';
import { sendFeedback, trackEvent } from '../analytics/posthog';
import { composeReport, narrowReportContext, REPORT_RECIPIENT, reportSubject, type ReportContextV1 } from '../reporting/composeReport';
import { openReportMail, type ReportTransportOutcome } from '../reporting/reportTransport';
import { FEEDBACK_COPY } from './feedbackCopy';
import { answerForSheet, mailKindOf, routeOf } from './feedbackRoute';

export const FEEDBACK_OPEN_COMMAND = 'ritemark.feedback.open';
export const FEEDBACK_SUBMIT_COMMAND = '_ritemark.feedback.submit';
/** Registered by patch 018 in the workbench. */
export const FEEDBACK_SHEET_COMMAND = '_ritemark.feedbackSheet';

export type FeedbackDoor = 'status_bar' | 'help' | 'ai_info' | 'command';
export interface FeedbackOpenOptions {
  from: FeedbackDoor;
  kind?: 'feedback' | 'ai-issue';
}

/** What the workbench's sheet is given. */
export interface FeedbackSheetSpec {
  token: string;
  kind: 'feedback' | 'ai-issue';
  aiIssue: boolean;
  isMac: boolean;
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
}

export type FeedbackSubmitResult =
  | { route: 'straight'; outcome: 'accepted' | 'failed' }
  | { route: 'email'; outcome: ReportTransportOutcome | 'invalid'; kindLabel: string; shown: string; copyText: string };

export interface FeedbackDependencies {
  appVersion: string;
  /** The open chat's last answer on the AI's sheet, from its record; null without one. */
  lastAnswer(): Promise<{ title: string; text: string } | null>;
  /** 2.0's report window, for a shell without the sheet. */
  openReportWindow(): Promise<void>;
}

const DOORS: readonly FeedbackDoor[] = ['status_bar', 'help', 'ai_info', 'command'];

function decodeOpen(raw: unknown): FeedbackOpenOptions {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    from: DOORS.includes(value.from as FeedbackDoor) ? (value.from as FeedbackDoor) : 'command',
    kind: value.kind === 'ai-issue' ? 'ai-issue' : 'feedback',
  };
}

function decodeSubmit(raw: unknown): FeedbackSubmitRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.token !== 'string' || typeof value.text !== 'string' || value.text.length > 8_000) return null;
  if (value.route !== 'straight' && value.route !== 'email') return null;
  const flags = ['aiIssue', 'wantAnswer', 'withAnswer'] as const;
  if (!flags.every((flag) => typeof value[flag] === 'boolean')) return null;
  return { token: value.token, route: value.route, text: value.text, aiIssue: value.aiIssue as boolean, wantAnswer: value.wantAnswer as boolean, withAnswer: value.withAnswer as boolean };
}

/** One open sheet's context: the answer it showed and the time the report carries. */
interface OpenSheet {
  token: string;
  context: ReportContextV1;
  answer: { shown: string; whole: string } | null;
}

export function registerFeedback(context: vscode.ExtensionContext, deps: FeedbackDependencies): void {
  let open: OpenSheet | null = null;

  const openSheet = async (raw?: unknown): Promise<void> => {
    const options = decodeOpen(raw);
    void trackEvent('feedback_opened', { from: options.from });
    const reportContext = narrowReportContext({ appVersion: deps.appVersion, platform: process.platform, occurredAt: new Date().toISOString() });
    const last = await deps.lastAnswer().catch(() => null);
    const answer = last ? answerForSheet(reportContext, last.text) : null;
    const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    open = { token, context: reportContext, answer: last && answer ? { shown: answer.text, whole: last.text.trim() } : null };
    const spec: FeedbackSheetSpec = {
      token,
      kind: options.kind ?? 'feedback',
      aiIssue: options.kind === 'ai-issue',
      isMac: process.platform === 'darwin',
      lastAnswer: last && answer ? { chatTitle: last.title, quote: answer.text, shortened: answer.shortened } : null,
      words: FEEDBACK_COPY,
    };
    let result: { outcome?: string } | undefined;
    try {
      result = await vscode.commands.executeCommand<{ outcome?: string }>(FEEDBACK_SHEET_COMMAND, spec);
    } catch {
      // A shell without the sheet (patch 018 before 2.1): 2.0's ways, so nothing is lost (R16).
      if (spec.aiIssue) {
        await deps.openReportWindow();
        return;
      }
      const text = await vscode.window.showInputBox({ title: FEEDBACK_COPY.sheet.feedback.title, prompt: FEEDBACK_COPY.sheet.feedback.lede, ignoreFocusOut: true });
      if (!text?.trim()) return;
      const sent = await sendFeedback([{ name: 'feedback_sent', properties: { message: text.trim() } }]);
      if (sent) void vscode.window.showInformationMessage(FEEDBACK_COPY.toast.accepted);
      else void vscode.window.showWarningMessage(FEEDBACK_COPY.sheet.failed);
      return;
    } finally {
      // The sheet answered: its buttons can no longer send under this token.
      if (open?.token === token) open = null;
    }
    if (result?.outcome === 'sent') void vscode.window.showInformationMessage(FEEDBACK_COPY.toast.accepted);
  };

  const submit = async (raw: unknown): Promise<FeedbackSubmitResult | null> => {
    const request = decodeSubmit(raw);
    const sheet = open;
    if (!request || !sheet || request.token !== sheet.token || !request.text.trim()) return null;
    const text = request.text.trim();
    // The sheet's own "Open in e-mail" after a send that did not go (D5) asks for the e-mail route with no box ticked.
    if (request.route === 'straight' && routeOf(request) === 'straight') {
      // The message and nothing else: no address, no document, no chat, no path (R11).
      const accepted = await sendFeedback([{ name: 'feedback_sent', properties: { message: text } }]);
      return { route: 'straight', outcome: accepted ? 'accepted' : 'failed' };
    }
    const kind = mailKindOf(request);
    const withAnswer = request.aiIssue && request.withAnswer && sheet.answer !== null;
    const body = composeReport(sheet.context, text, withAnswer ? sheet.answer!.shown : undefined);
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
      copyText: composeReport(sheet.context, text, withAnswer ? sheet.answer!.whole : undefined),
    };
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(FEEDBACK_OPEN_COMMAND, openSheet),
    vscode.commands.registerCommand(FEEDBACK_SUBMIT_COMMAND, submit),
  );
}

/** The first-week card's send (R14, D11): the straight route, from Home, marked with the question it answers. */
export async function sendWeekLine(text: string): Promise<boolean> {
  return sendFeedback([{ name: 'feedback_sent', properties: { message: text.trim(), asked: 'made_this_week' } }]);
}
