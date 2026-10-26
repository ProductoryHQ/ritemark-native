/**
 * Every word of the feedback door (Sprint 140, R10–R14; experience 34; the
 * Experience lead's D5, D6 and D10, 26 October), in one table. The workbench's
 * sheet (patch 018) draws what it is given, so these words can change without
 * an app release.
 *
 * Honesty (Sprint 126's rule, experience 34 decision 6): Ritemark says sent
 * only when the service accepted the message. The e-mail route's words never
 * claim delivery; `feedbackCopy.test.ts` checks them against
 * `DELIVERY_CLAIM_WORDS`.
 */

import { REPORT_RECIPIENT } from '../reporting/composeReport';

export const FEEDBACK_COPY = {
  door: {
    label: 'Send feedback',
    tooltip: 'Send feedback or report an AI issue',
  },
  sheet: {
    feedback: {
      title: 'Send feedback',
      lede: 'What worked, what got in the way, what you wish Ritemark did. It goes to the people who make Ritemark.',
      placeholder: '',
    },
    aiIssue: {
      title: 'Report an AI issue',
      lede: 'Tell us what the AI said or did that was wrong, unsafe or not what you asked for.',
      placeholder: 'What happened?',
    },
    aiBox: 'This is about something the AI said or did',
    answerBox: "I'd like an answer",
    answerNote: 'This opens your e-mail app instead, so we can write back to you. Ritemark never asks for your address.',
    lastAnswerBox: "Add the AI's last answer in this chat",
    /** Followed by the chat's title in quotes. */
    lastAnswerNoteBefore: 'Only that answer, from "',
    lastAnswerNoteAfter: '". You see it here before it\'s sent.',
    shortenedNote: 'Shortened to fit an e-mail. Copy takes the whole answer.',
    straight: { button: 'Send', foot: 'Your documents and chats are never included.' },
    email: {
      button: 'Open in e-mail',
      foot: 'Only what you see here goes.',
      via: `This opens your e-mail app with a message to ${REPORT_RECIPIENT}, so you see exactly what goes and send it yourself.`,
    },
    cancel: 'Cancel',
    sending: 'Sending…',
    /** D5: the straight route did not go (offline, the service unreachable, the kill switch). */
    failed: "It didn't go. Your message is still here: try again, or open it in e-mail.",
    tryAgain: 'Try again',
    openInEmail: 'Open in e-mail',
  },
  handoff: {
    opened: {
      title: 'Your e-mail app is opening',
      report: `Your report is in a new e-mail to ${REPORT_RECIPIENT}. It isn't on its way until you press Send there.`,
      message: `Your message is in a new e-mail to ${REPORT_RECIPIENT}. It isn't on its way until you press Send there.`,
    },
    noHandler: {
      title: 'No e-mail app answered',
      lede: `Copy it and send it to ${REPORT_RECIPIENT} from any e-mail.`,
    },
    tooLong: {
      title: 'This is too long for an e-mail link',
      lede: `Copy it and send it to ${REPORT_RECIPIENT} yourself, so nothing is cut off.`,
    },
    foot: `Didn't open? Copy it and send it to ${REPORT_RECIPIENT}.`,
    copy: 'Copy',
    copied: 'Copied',
    done: 'Done',
    kindReport: 'Report an AI issue',
    kindMessage: 'Send feedback',
  },
  /** Each sheet button's hover hint, and why Send waits (QA, 26 October). */
  hints: {
    cancel: 'Closes this without sending anything',
    send: 'Sends your words to the people who make Ritemark',
    openInEmail: 'Opens your e-mail app with this message, to send it yourself',
    tryAgain: 'Sends it again',
    writeFirst: 'Write something first',
    copy: 'Copies the whole message, to send it yourself',
    done: 'Closes this',
  },
  /** D6: the thank-you claims only what Ritemark knows (here: the service accepted it). */
  toast: {
    accepted: "Thank you. It's with the people who make Ritemark.",
  },
  card: {
    heading: 'What did you make with Ritemark this week?',
    lede: 'One line is plenty. It goes to the people who make Ritemark, and we read every one.',
    placeholder: 'A proposal, notes, a module…',
    send: 'Send',
    notNow: 'Not now',
    /** The card's send that did not go: Try again (primary), Open in e-mail and Not now (the Experience lead, 26 October). */
    failed: "It didn't go. Your words are still here: try again, or open it in e-mail.",
  },
} as const;

/** The e-mail route's words: none may claim a delivery Ritemark cannot see. */
export function emailRouteStrings(): string[] {
  const { sheet, handoff } = FEEDBACK_COPY;
  return [
    sheet.email.button,
    sheet.email.foot,
    sheet.email.via,
    sheet.answerNote,
    sheet.shortenedNote,
    sheet.openInEmail,
    handoff.opened.title,
    handoff.opened.report,
    handoff.opened.message,
    handoff.noHandler.title,
    handoff.noHandler.lede,
    handoff.tooLong.title,
    handoff.tooLong.lede,
    handoff.foot,
    handoff.copy,
    handoff.copied,
    handoff.done,
    FEEDBACK_COPY.hints.openInEmail,
    FEEDBACK_COPY.hints.copy,
    FEEDBACK_COPY.hints.done,
  ];
}
