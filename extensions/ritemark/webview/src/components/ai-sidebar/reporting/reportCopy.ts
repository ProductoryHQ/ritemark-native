/**
 * Every user-visible string in the report flow — Sprint 126 (RQ4).
 *
 * WHY ONE MODULE: the honesty requirement is a property of the words, and
 * words scattered through JSX cannot be asserted. Ritemark hands the report to
 * a mail client; it never observes the mail arriving. So nothing here may say
 * "sent", "delivered", "received", or thank the user for a report that may
 * still be sitting unsent in their drafts. `reportCopy.test.ts` enforces that
 * against this module, which only works while this module is the only source.
 */
import { REPORT_RECIPIENT } from './composeReport';

export const REPORT_COPY = {
  /** Status bar item and its tooltip. */
  statusBarLabel: 'Report AI issue',
  statusBarTooltip: 'Report inappropriate or harmful AI output',

  /** Entry inside the AI Information dialog. */
  informationEntryLabel: 'Report AI output',
  informationEntryDetail:
    'Tell us about generated output that is inappropriate or harmful. You choose exactly what is included.',

  /** The composition window. */
  dialogTitle: 'Report AI output',
  dialogDescription:
    'Paste or describe the output you are reporting. Ritemark includes only the lines below and what you write here — nothing from your conversation, documents, or account.',
  bodyLabel: 'What went wrong?',
  bodyPlaceholder: 'Paste the AI output you are reporting, and say what is wrong with it.',
  contextLabel: 'Included with your report',

  /** Actions. Named for what happens, not for a delivery we cannot see. */
  primaryAction: 'Open email to report',
  cancelAction: 'Cancel',
  copyAction: 'Copy report',
  copiedAction: 'Copied',

  /** After the mail handler was opened. */
  handoffTitle: 'Your email app is opening',
  handoffDetail: `The report is not on its way yet — check it in your email app and send it to ${REPORT_RECIPIENT}.`,

  /**
   * Shown when no mail handler exists. RQ3 makes this a first-class state,
   * not an error: a reviewer on a clean Windows machine will land here, and
   * they must still end up with a complete, copyable report.
   */
  fallbackTitle: 'No email app is set up on this computer',
  fallbackDetail: `Copy the report below and email it to ${REPORT_RECIPIENT} yourself.`,
  fallbackRecipientLabel: 'Send to',

  /** Shown when the report is too long for a mail handler to carry safely. */
  tooLongTitle: 'This report is too long to open in an email app',
  tooLongDetail: `Copy it below and email it to ${REPORT_RECIPIENT} yourself, so nothing is cut off.`,
} as const;

/**
 * Words that would claim a delivery Ritemark cannot observe. Asserted absent
 * from every string above. "Send" as an instruction to the user is fine —
 * "sent" as a claim about what already happened is not.
 */
export const DELIVERY_CLAIM_WORDS = [
  'sent',
  'delivered',
  'received',
  'submitted',
  'thanks for your report',
  'thank you for your report',
] as const;
