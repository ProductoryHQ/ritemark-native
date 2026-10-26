/**
 * Sprint 140 (R10–R14, E3; S51–S58): the feedback door's rules. Its words in one table, the e-mail route's
 * words free of any delivery claim (Sprint 126's honesty test), the route from the two boxes, the last answer
 * shortened at a sentence end and marked, and the e-mail carrying exactly what the sheet showed.
 * Run: npx tsx src/feedback/feedback.test.ts
 */

import assert from 'node:assert/strict';
import { composeReport, LAST_ANSWER_LABEL, REPORT_RECIPIENT, reportSubject, type ReportContextV1 } from '../reporting/composeReport';
import { DELIVERY_CLAIM_WORDS } from '../reporting/reportCopy';
import { buildMailtoUrl, MAILTO_MAX_URL_CHARS } from '../reporting/reportTransport';
import { emailRouteStrings, FEEDBACK_COPY } from './feedbackCopy';
import { answerForSheet, mailKindOf, mailUrlOf, routeOf, SHORTENED_MARK, shortenAnswer } from './feedbackRoute';

const context: ReportContextV1 = { appVersion: '2.1.0', platform: 'darwin', occurredAt: '2026-11-03T10:00:00.000Z' };

// ── The words (experience 34; D5, D6, D10) ──

assert.equal(FEEDBACK_COPY.door.label, 'Send feedback');
assert.equal(FEEDBACK_COPY.door.tooltip, 'Send feedback or report an AI issue', 'R10: the tooltip names AI issues (Store policy 11.16)');
assert.equal(FEEDBACK_COPY.sheet.feedback.lede, 'What worked, what got in the way, what you wish Ritemark did. It goes to the people who make Ritemark.');
assert.equal(FEEDBACK_COPY.sheet.aiIssue.title, 'Report an AI issue');
assert.equal(FEEDBACK_COPY.sheet.aiIssue.placeholder, 'What happened?');
assert.equal(FEEDBACK_COPY.sheet.answerNote, 'This opens your e-mail app instead, so we can write back to you. Ritemark never asks for your address.');
assert.equal(FEEDBACK_COPY.sheet.straight.foot, 'Your documents and chats are never included.');
assert.equal(FEEDBACK_COPY.sheet.email.foot, 'Only what you see here goes.');
assert.equal(FEEDBACK_COPY.sheet.email.via, 'This opens your e-mail app with a message to info@productory.eu, so you see exactly what goes and send it yourself.');
assert.equal(FEEDBACK_COPY.sheet.failed, "It didn't go. Your message is still here: try again, or open it in e-mail.", 'D5');
assert.equal(FEEDBACK_COPY.toast.accepted, "Thank you. It's with the people who make Ritemark.", 'D6: only when the service accepted it');
assert.equal(FEEDBACK_COPY.handoff.opened.report, "Your report is in a new e-mail to info@productory.eu. It isn't on its way until you press Send there.");
assert.equal(FEEDBACK_COPY.sheet.shortenedNote, 'Shortened to fit an e-mail. Copy takes the whole answer.', 'D10');
assert.equal(REPORT_RECIPIENT, 'info@productory.eu', 'the shape\'s decision 7');

// Sprint 126's honesty rule over every e-mail-route string: no word claims a delivery Ritemark cannot see (S58)
for (const words of emailRouteStrings()) {
  for (const claim of DELIVERY_CLAIM_WORDS) {
    assert.ok(!new RegExp(`\\b${claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(words), `"${words}" claims "${claim}"`);
  }
  assert.ok(!/thank you/i.test(words), `"${words}" thanks for something that may not have gone`);
}
// Nothing anywhere says sent with an exclamation mark or a tick (D6)
assert.ok(!JSON.stringify(FEEDBACK_COPY).includes('!'), 'no exclamation marks');

// ── The route (R11, S51, S52) ──

assert.equal(routeOf({ aiIssue: false, wantAnswer: false }), 'straight');
assert.equal(routeOf({ aiIssue: true, wantAnswer: false }), 'email');
assert.equal(routeOf({ aiIssue: false, wantAnswer: true }), 'email');
assert.equal(mailKindOf({ aiIssue: true }), 'ai-issue');
assert.equal(mailKindOf({ aiIssue: false }), 'feedback');
assert.equal(reportSubject(context, 'feedback'), 'Ritemark 2.1.0 — feedback');
assert.equal(reportSubject(context), 'Ritemark 2.1.0 — AI output report', 'Sprint 126\'s subject for an AI issue');

// ── The last answer in the e-mail: exactly as shown, nothing else from the chat (R12, S55) ──

const mail = composeReport(context, 'It rewrote the learning goals.', 'The goals are:\n\n- one\n- two');
assert.equal(mail, [
  'Ritemark 2.1.0 (darwin)',
  'Reported 2026-11-03T10:00:00.000Z',
  '',
  'It rewrote the learning goals.',
  '',
  LAST_ANSWER_LABEL,
  '> The goals are:',
  '>',
  '> - one',
  '> - two',
].join('\n'));
assert.equal(composeReport(context, 'Just this.'), 'Ritemark 2.1.0 (darwin)\nReported 2026-11-03T10:00:00.000Z\n\nJust this.', 'unticked: no answer');
assert.equal(composeReport(context, 'Just this.', '   '), composeReport(context, 'Just this.'), 'an empty answer adds nothing');

// ── Shortening (D10, S56) ──

const fitsIn = (n: number) => (candidate: string) => candidate.length <= n;
assert.deepEqual(shortenAnswer('One. Two.', fitsIn(100)), { text: 'One. Two.', shortened: false });
assert.deepEqual(shortenAnswer('First sentence here. Second one is longer. Third.', fitsIn(35)), { text: `First sentence here. ${SHORTENED_MARK}`, shortened: true }, 'cut at a sentence end, marked');
assert.deepEqual(shortenAnswer('Line one\nLine two that is long', fitsIn(20)), { text: `Line one ${SHORTENED_MARK}`, shortened: true }, 'a line end is a sentence end');
assert.deepEqual(shortenAnswer('No sentence end in this long run of words', fitsIn(30)), { text: `No sentence end in ${SHORTENED_MARK}`, shortened: true }, 'no sentence fits: cut at a word');
const long = Array.from({ length: 200 }, (_, i) => `Sentence number ${i} says something.`).join(' ');
const shown = answerForSheet(context, long);
assert.equal(shown.shortened, true);
assert.ok(shown.text.endsWith(`says something. ${SHORTENED_MARK}`), 'ends at a sentence, marked');
assert.ok(mailUrlOf(context, 'ai-issue', 'x'.repeat(600), shown.text).length <= MAILTO_MAX_URL_CHARS, 'fits with room for the person\'s words');
assert.ok(buildMailtoUrl({ recipient: REPORT_RECIPIENT, subject: reportSubject(context), body: composeReport(context, 'short', shown.text) }).length <= MAILTO_MAX_URL_CHARS, 'a short message and the shown answer fit');
assert.deepEqual(answerForSheet(context, 'A short answer.'), { text: 'A short answer.', shortened: false });

console.log('feedback: all assertions passed');
