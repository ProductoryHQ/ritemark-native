/**
 * Sprint 140 (R10–R14, E3; S51–S58): the feedback door's rules. Its words in one table, the e-mail route's
 * words free of any delivery claim (Sprint 126's honesty test), the route from the two boxes, the last answer
 * shortened at a sentence end and marked, and the e-mail carrying exactly what the sheet showed.
 * Run: npx tsx src/feedback/feedback.test.ts
 */

import assert from 'node:assert/strict';
import Module from 'node:module';
import { test } from 'node:test';
import type { FeedbackSheetSpec } from './feedbackSheet';
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
assert.equal(FEEDBACK_COPY.card.failed, "It didn't go. Your words are still here: try again, or open it in e-mail.", 'the first-week card\'s send that did not go');
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

test('feedback command validates the open and binds submissions to its card and turn', async () => {
  const handlers = new Map<string, (...args: any[]) => any>();
  const events: unknown[] = [];
  let spec: FeedbackSheetSpec;
  let dismiss: () => void;
  let mailBody: string | null = null;
  const loader = Module as unknown as { _load(id: string, ...args: unknown[]): unknown };
  const load = loader._load;
  loader._load = function (id, ...args) {
    if (id === 'vscode') return {
      commands: {
        registerCommand: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler),
        executeCommand: (_name: string, opened: FeedbackSheetSpec) => {
          spec = opened;
          return new Promise<void>(resolve => { dismiss = resolve; });
        },
      },
      env: { openExternal: async (uri: string) => { mailBody = new URL(uri).searchParams.get('body'); return true; } },
      Uri: { parse: (uri: string) => uri },
    };
    if (id === '../analytics/posthog') return {
      trackEvent: (name: string, properties: unknown) => events.push({ name, properties }),
      sendFeedback: async (batch: unknown[]) => { events.push(...batch); return true; },
    };
    return load.call(this, id, ...args);
  };
  let feedback: typeof import('./feedbackSheet');
  try {
    feedback = require('./feedbackSheet');
  } finally {
    loader._load = load;
  }
  const turn = { conversationId: 'chat-elsewhere', turnId: 'chosen' };
  feedback.registerFeedback({ subscriptions: [] } as never, {
    appVersion: '2.4.0',
    lastAnswer: async () => ({ title: 'Last chat', text: 'Last answer.' }),
    answerOfTurn: async ref => ref.turnId === turn.turnId && ref.conversationId === turn.conversationId
      ? { title: 'Chosen chat', text: 'Chosen answer.' } : null,
    openReportWindow: async () => {},
  });
  async function open(options: unknown) {
    const closed = handlers.get(feedback.FEEDBACK_OPEN_COMMAND)!(options);
    await Promise.resolve();
    await Promise.resolve();
    return { spec, close: async () => { dismiss(); await closed; } };
  }
  const bad = await open({ from: 'unknown', quote: { title: 1, line: 'words' }, text: {}, turn: { conversationId: 'chat', turnId: ' ' } });
  assert.deepEqual(events.pop(), { name: 'feedback_opened', properties: { from: 'command' } });
  assert.equal(bad.spec.quote, undefined);
  assert.equal(bad.spec.text, undefined);
  assert.equal(bad.spec.lastAnswer?.quote, 'Last answer.');
  await bad.close();
  for (const line of ['', '  ', 'https://user:pass@example.com', '/Users/example', 'C:\\Example', '~/file', '~/', '/tmp/file']) {
    const badQuote = await open({ quote: { title: 'Card', line } });
    assert.equal(badQuote.spec.quote, undefined, line);
    await badQuote.close();
  }
  const bounded = await open({ from: 'thumb', text: 'x'.repeat(2001), quote: { title: 'word '.repeat(40), line: 'abc '.repeat(150) } });
  assert.deepEqual(events.pop(), { name: 'feedback_opened', properties: { from: 'thumb' } });
  assert.deepEqual(bounded.spec.quote, { title: `${'word '.repeat(24).trimEnd()}…`, line: `${'abc '.repeat(125).trimEnd()}…` });
  assert.equal(bounded.spec.text?.length, 2000);
  await bounded.close();

  const missing = await open({ kind: 'ai-issue', turn: { ...turn, turnId: 'missing' } });
  assert.equal(missing.spec.lastAnswer, null);
  await missing.close();
  const selected = await open({ kind: 'ai-issue', from: 'failure_card', turn, quote: { title: ' Card ', line: ' Details ' } });
  assert.equal(selected.spec.lastAnswer?.quote, 'Chosen answer.');
  assert.deepEqual(events.pop(), { name: 'feedback_opened', properties: { from: 'failure_card' } });
  const submit = handlers.get(feedback.FEEDBACK_SUBMIT_COMMAND)!;
  const base = { token: selected.spec.token, text: ' My words. ', aiIssue: false, wantAnswer: false, withAnswer: false };
  assert.equal(await submit({ ...base, route: 'straight', text: ' ', includeQuote: true }), null);
  for (const includeQuote of [true, false]) {
    const message = includeQuote ? 'My words.\n\nFrom the card:\nCard\nDetails' : 'My words.';
    assert.deepEqual(await submit({ ...base, route: 'straight', includeQuote }), { route: 'straight', outcome: 'accepted' });
    assert.deepEqual(events.pop(), { name: 'feedback_sent', properties: { message, from: 'failure_card' } });
    const email = await submit({ ...base, route: 'email', includeQuote, aiIssue: true, withAnswer: true });
    assert.equal(email.shown, message);
    assert.equal(mailBody, email.copyText);
    assert.ok(email.copyText.endsWith(`${message}\n\n${LAST_ANSWER_LABEL}\n> Chosen answer.`));
  }
  const fullField = 'x'.repeat(8000);
  const longMail = await submit({ ...base, route: 'email', text: fullField, includeQuote: true });
  assert.equal(longMail.outcome, 'too-long');
  assert.ok(longMail.copyText.endsWith(fullField + '\n\nFrom the card:\nCard\nDetails'));
  await selected.close();
  assert.equal(await submit({ ...base, route: 'straight', includeQuote: true }), null);

  const oldDoor = await open({ from: 'help' });
  await submit({ ...base, token: oldDoor.spec.token, route: 'straight', includeQuote: true });
  assert.deepEqual(events.pop(), { name: 'feedback_sent', properties: { message: 'My words.', from: 'sheet' } });
  await oldDoor.close();
});
