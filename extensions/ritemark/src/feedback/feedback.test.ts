/**
 * Sprint 140 (R10–R14, E3; S51–S58): the feedback door's rules. Its words in one table, the e-mail route's
 * words free of any delivery claim (Sprint 126's honesty test), the route from the two boxes, the last answer
 * shortened at a sentence end and marked, and the e-mail carrying exactly what the sheet showed.
 * Run: npx tsx src/feedback/feedback.test.ts
 */

import assert from 'node:assert/strict';
import Module from 'node:module';
import { test } from 'node:test';
import type { FeedbackSheetOutcome } from './answerFeedbackProtocol';
import type { FeedbackSheetSpec } from './feedbackSheet';
import { composeReport, LAST_ANSWER_LABEL, REPORT_RECIPIENT, reportSubject, type ReportContextV1 } from '../reporting/composeReport';
import { DELIVERY_CLAIM_WORDS } from '../reporting/reportCopy';
import { buildMailtoUrl, fitsInMailto, MAILTO_MAX_URL_CHARS } from '../reporting/reportTransport';
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

test('feedback command validates the open and binds submissions to its card and turn', async t => {
  const handlers = new Map<string, (...args: any[]) => any>();
  const events: unknown[] = [];
  let spec: FeedbackSheetSpec;
  let shows = 0;
  let lastReads = 0;
  let dismiss: (result: FeedbackSheetOutcome) => void;
  let rejectSheet = false;
  let inputBoxes = 0;
  let deliver: ((accepted: boolean) => void) | undefined;
  let deferSend = false;
  const toasts: string[] = [];
  const warnings: string[] = [];
  let mailBody: string | null = null;
  const loader = Module as unknown as { _load(id: string, ...args: unknown[]): unknown };
  const load = loader._load;
  loader._load = function (id, ...args) {
    if (id === 'vscode') return {
      commands: {
        registerCommand: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler),
        executeCommand: (name: string, opened: FeedbackSheetSpec | string) => {
          if (name === '_ritemark.briefToast') {
            toasts.push(opened as string);
            return Promise.resolve(true);
          }
          if (rejectSheet) return Promise.reject(new Error('Sheet command rejected'));
          shows++;
          spec = opened as FeedbackSheetSpec;
          return new Promise<FeedbackSheetOutcome>(resolve => { dismiss = resolve; });
        },
      },
      window: {
        showInputBox: async () => { inputBoxes++; },
        showWarningMessage: (message: string) => warnings.push(message),
      },
      env: { openExternal: async (uri: string) => { mailBody = new URL(uri).searchParams.get('body'); return true; } },
      Uri: { parse: (uri: string) => uri },
    };
    if (id === '../analytics/posthog') return {
      trackEvent: (name: string, properties: unknown) => events.push({ name, properties }),
      sendFeedback: async (batch: unknown[]) => {
        events.push(...batch);
        return deferSend ? new Promise<boolean>(resolve => { deliver = resolve; }) : true;
      },
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
    lastAnswer: async () => { lastReads++; return { title: 'Last chat', text: 'Last answer.' }; },
    answerOfTurn: async ref => ref.turnId === turn.turnId && ref.conversationId === turn.conversationId
      ? { title: 'Chosen chat', text: 'Chosen answer.' } : null,
    openReportWindow: async () => {},
  });
  async function open(options: unknown) {
    const closed = handlers.get(feedback.FEEDBACK_OPEN_COMMAND)!(options);
    await Promise.resolve();
    await Promise.resolve();
    return { spec, close: async (result: FeedbackSheetOutcome = 'cancelled') => { dismiss(result); return closed; } };
  }
  const bad = await open({ from: 'unknown', quote: { title: 1, line: 'words' }, text: {}, turn: { conversationId: 'chat', turnId: ' ' } });
  assert.deepEqual(events.pop(), { name: 'feedback_opened', properties: { from: 'command' } });
  assert.equal(bad.spec.quote, undefined);
  assert.equal(bad.spec.text, undefined);
  await t.test('malformed or absent contextual turn references never read the newest answer', async () => {
    assert.equal(bad.spec.lastAnswer, null);
    assert.equal(lastReads, 0);
  });
  await bad.close();
  for (const options of [{ turn: undefined }, { turn: null }, { from: 'thumb' }, { from: 'failure_card' }]) {
    const reads = lastReads;
    const opened = await open(options);
    await t.test(`no newest answer for ${JSON.stringify(options)}`, () => {
      assert.equal(opened.spec.lastAnswer, null);
      assert.equal(lastReads, reads);
    });
    await opened.close();
  }

  const start = handlers.get(feedback.FEEDBACK_OPEN_COMMAND)!;
  await t.test('thumb opens relay the outcome and fail when the answer or sheet is unavailable', async () => {
    const options = { from: 'thumb', kind: 'ai-issue', turn, text: 'My words', withAnswer: true };
    const opening = start(options);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(spec.lastAnswer?.quote, 'Chosen answer.');
    const duplicate = await start(options);
    dismiss('cancelled');
    assert.equal(await opening, 'cancelled');
    assert.equal(duplicate, 'failed', 'the sheet already open did not take the second draft');
    for (const outcome of ['sent', 'mailed'] as const) {
      const sheet = await open(options);
      assert.equal(await sheet.close(outcome), outcome);
    }
    const shown = shows;
    assert.equal(await start({ ...options, turn: { ...turn, turnId: 'missing' } }), 'failed');
    assert.equal(shows, shown, 'a vanished answer is not replaced with a different answer');
    rejectSheet = true;
    const priorInputBoxes = inputBoxes;
    try {
      assert.equal(await start(options), 'failed');
      assert.equal(inputBoxes, priorInputBoxes, 'a plain input box cannot take the answer');
    } finally {
      rejectSheet = false;
    }
  });

  await t.test('ignores a second open during the answer read and while the sheet is shown', async () => {
    const before = shows;
    const first = start({ from: 'help' });
    const pending = start({ from: 'command' });
    await Promise.resolve();
    await Promise.resolve();
    assert.ok(shows > before, 'the first sheet is now shown');
    const shown = start({ from: 'ai_info' });
    await Promise.resolve();
    await Promise.resolve();
    const seen = shows - before;
    dismiss('cancelled');
    assert.equal(seen, 1);
    await Promise.all([first, pending, shown]);
  });
  await t.test('a rejected sheet command releases the opening guard after the fallback', async () => {
    const before = shows;
    rejectSheet = true;
    await start({ from: 'help' });
    rejectSheet = false;
    assert.equal(inputBoxes, 1);
    const reopened = await open({ from: 'help' });
    await reopened.close();
    assert.equal(shows, before + 1);
  });

  for (const line of [
    '', '  ', 'https://user:pass@example.com', '/Users/example', 'C:\\Example', '~/file', '~/', '/tmp/file',
    '“/Users/x/a.docx”', '‘/Users/…’', '«/home/x»', '</Users/x>', '{/Users/x}', '…/Documents/a.docx',
    'https://ghp_token@github.com/…',
    'https://file+.vscode-resource.vscode-cdn.net/Users/x/…', 'vscode-file://vscode-app/Users/…',
    'smb://server/share/…', 'https://x.com,/Users/x/a.docx', 'https://x.com/(/Users/…)',
    'Error 404: /v1/Users/x', 'HTTP 500: /v2/home/x/secret', '?api_key=sk-…',
    '/Volumes/drive/file', '/private/path', '/var/folders/x', '/mnt/share', '/media/drive', '/root/file',
    'C:/Example', String.raw`\\server\share`, 'file:relative', 'smb:share',
    '/etc/passwd', '/opt/acme/customer.csv', '/workspace/project/private.docx', 'Could not read /data/2025/report.pdf.',
    ...['key', 'api_key', 'apikey', 'token', 'access_token', 'sig', 'signature', 'password', 'secret']
      .map(key => `https://x.com/path?version=1&${key}=example`),
  ]) {
    const badQuote = await open({ quote: { title: 'Card', line } });
    await t.test(`rejects quote ${line}`, () => assert.equal(badQuote.spec.quote, undefined));
    await badQuote.close();
  }
  for (const line of [
    'Please run /login', 'Error 404: /v1/messages', 'POST /v1/messages failed',
    String.raw`{"error":"Use \"quotes\""}`, 'See https://example.com/help',
    'See https://ritemark.app/docs/guide.html', 'Version 2.4.0 failed', 'and/or 3/4 of the slides',
  ]) {
    const opened = await open({ quote: { title: 'Card', line } });
    await t.test(`allows quote ${line}`, () => assert.equal(opened.spec.quote?.line, line));
    await opened.close();
  }
  for (const title of ['😀'.repeat(80), 'a'.repeat(117) + '😀 word'.repeat(10), 'a'.repeat(117) + '\uD83D word'.repeat(10)]) {
    const opened = await open({ quote: { title, line: 'Details' } });
    await t.test('truncated emoji stays intact and safe for mailto', () => {
      assert.ok(opened.spec.quote!.title.endsWith('…'));
      assert.doesNotThrow(() => fitsInMailto({ recipient: REPORT_RECIPIENT, subject: 'Feedback', body: opened.spec.quote!.title }));
    });
    await opened.close();
  }
  const keys = [];
  for (const options of [{}, { from: 'help', text: '' }, { quote: { title: 'Card', line: 'Details' } }, { quote: { title: ' Card ', line: 'Details' } }, { quote: { title: 'Card', line: 'Other details' } }, { turn }, { turn: { ...turn, turnId: 'another' } }]) {
    const opened = await open(options);
    keys.push(Reflect.get(opened.spec, 'draftKey'));
    await opened.close();
  }
  await t.test('draft keys identify plain opens, individual cards and individual turns', () => {
    assert.deepEqual(keys.slice(0, 2), ['', '']);
    assert.match(keys[2], /^card:[a-f0-9]+$/);
    assert.equal(keys[2], keys[3]);
    assert.notEqual(keys[2], keys[4]);
    assert.match(keys[5], /^turn:/);
    assert.notEqual(keys[5], keys[6]);
  });
  const bounded = await open({ from: 'thumb', text: 'x'.repeat(2001), quote: { title: 'word '.repeat(40), line: 'abc '.repeat(150) } });
  assert.deepEqual(events.pop(), { name: 'feedback_opened', properties: { from: 'thumb' } });
  assert.deepEqual(bounded.spec.quote, { title: `${'word '.repeat(24).trimEnd()}…`, line: `${'abc '.repeat(125).trimEnd()}…` });
  assert.equal(bounded.spec.text?.length, 2000);
  await bounded.close();

  const missing = await open({ kind: 'ai-issue', turn: { ...turn, turnId: 'missing' } });
  assert.equal(missing.spec.lastAnswer, null);
  await missing.close();
  for (const options of [{}, { withAnswer: false }, { withAnswer: 'true' }, { kind: 'ai-issue' }]) {
    const offered = await open({ from: 'failure_card', turn, ...options });
    const kind = options.kind ?? 'feedback';
    await t.test(`a found turn offers an unticked answer for ${JSON.stringify(options)}`, () => {
      assert.equal(offered.spec.lastAnswer?.quote, 'Chosen answer.');
      assert.equal(offered.spec.kind, kind);
      assert.equal(offered.spec.aiIssue, kind === 'ai-issue');
      assert.equal(offered.spec.includeAnswer, false);
    });
    await offered.close();
  }
  const selected = await open({ from: 'failure_card', turn, withAnswer: true, quote: { title: ' Card ', line: ' Details ' } });
  await t.test('withAnswer true opens a found turn as an AI issue with its answer selected', () => {
    assert.equal(selected.spec.lastAnswer?.quote, 'Chosen answer.');
    assert.equal(selected.spec.kind, 'ai-issue');
    assert.equal(selected.spec.aiIssue, true);
    assert.equal(selected.spec.includeAnswer, true);
  });
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

  for (const accepted of [true, false]) {
    await t.test(`the host reports a pending straight send after dismissal (${accepted ? 'accepted' : 'failed'})`, async () => {
      const sheet = await open({ from: 'help' });
      deferSend = true;
      const sending = submit({ ...base, token: sheet.spec.token, route: 'straight' });
      await sheet.close();
      const reopened = await open({ from: 'help' });
      toasts.length = 0;
      warnings.length = 0;
      deliver!(accepted);
      deferSend = false;
      assert.deepEqual(await sending, { route: 'straight', outcome: accepted ? 'accepted' : 'failed' });
      await reopened.close();
      assert.deepEqual(toasts, accepted ? [FEEDBACK_COPY.toast.accepted] : []);
      assert.deepEqual(warnings, accepted ? [] : [FEEDBACK_COPY.sheet.failed]);
    });
  }
  await t.test('an accepted straight send with its sheet still open gets one toast on close', async () => {
    const sheet = await open({ from: 'help' });
    toasts.length = 0;
    assert.deepEqual(await submit({ ...base, token: sheet.spec.token, route: 'straight' }), { route: 'straight', outcome: 'accepted' });
    assert.deepEqual(toasts, []);
    await sheet.close('sent');
    assert.deepEqual(toasts, [FEEDBACK_COPY.toast.accepted]);
  });
});
