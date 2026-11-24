import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeDeckRequest, DeckProtocolError } from './deckProtocol';
import { BUILT_IN_THEME } from './deckTheme';
import { deckDigest, publicDeck } from './page/publicDeck';
import { sessionTimeEdit } from './present/presentProtocol';
import { frontMatterValue, lengthMinutesOf } from './present/presentSession';
import { clockMinutes, readTimetable, SESSION_LENGTH, SESSION_START, sessionLengthFromEnd, type SessionTimeField } from './timetable';
import { nextMinutesRow, timetableFoot, timetableRows } from './timetableDisplay';

const slide = (kind: string, ...lines: string[]) => ['\x60\x60\x60slide' + kind, ...lines, '\x60\x60\x60', ''].join('\n');
const deck = [
  '---\ndeck: 2\n---\n',
  slide('', '---', 'time: 5', '---', '# Welcome'),
  slide(' section', 'title: Practice'),
  slide(' exercise', 'title: Try it', 'tag: 25 min'),
  slide('', '---', 'skip: true', 'time: 30', '---', '# Backup'),
  slide('', '# Untimed'),
  slide('', '# Questions'),
].join('\n');

const elapsed = readTimetable(deck);
const starts = timetableRows(elapsed);
assert.deepEqual(starts.map(({ start, minutes, sectionMinutes, skipped }) => [start, minutes, sectionMinutes, skipped]), [
  ['0:00', 5, null, false],
  [null, null, 25, false],
  ['0:05', 25, null, false],
  ['0:30', 30, null, true],
  ['0:30', null, null, false],
  ['0:30', null, null, false],
]);
assert.deepEqual(timetableFoot(elapsed), {
  count: '6 slides', total: '30 min', start: null, length: null, end: null, comparison: null, over: false, untimed: '2 slides have no time yet',
});
for (const [sessionMinutes, length, comparison] of [
  [20, '20 min', '10 min over'],
  [30, '30 min', 'fits'],
  [45, '45 min', '15 min under'],
  [60, '1 h', '30 min under'],
  [90, '1 h 30 min', '1 h under'],
] as const) {
  const foot = timetableFoot({ ...elapsed, sessionMinutes });
  assert.deepEqual([foot.start, foot.length, foot.end, foot.comparison, foot.over],
    [null, length, null, comparison, sessionMinutes < 30]);
}
assert.equal(timetableFoot({ ...elapsed, untimedCount: 1 }).untimed, '1 slide has no time yet');

// Return and Shift+Return skip only the section sums. Skipped slides still have an editable cell.
assert.equal(nextMinutesRow(elapsed.slides, 0, false), 2);
assert.equal(nextMinutesRow(elapsed.slides, 2, true), 0);
assert.equal(nextMinutesRow(elapsed.slides, 2, false), 3);
assert.equal(nextMinutesRow(elapsed.slides, 3, true), 2);
assert.equal(nextMinutesRow(elapsed.slides, 0, true), null);
assert.equal(nextMinutesRow(elapsed.slides, 5, false), null);
const source = readFileSync(new URL('../../webview/src/components/decks/SlideStrip.tsx', import.meta.url), 'utf8');
assert.match(source, /event\.currentTarget\.blur\(\)\s*if \(!cancel\.current\) onMove\(event\.shiftKey\)/);
assert.match(source, /const next = nextMinutesRow\(timing\.slides, index, backwards\)[\s\S]*?data-minutes-row[^\n]+\.focus\(\)/);

// The host applies the presenter's plain-value edit, changing only the two session lines.
const apply = (text: string, field: SessionTimeField, value: string) => {
  const request = decodeDeckRequest({ type: 'deck/session-time', field, value });
  assert.equal(request.type, 'deck/session-time');
  const edit = sessionTimeEdit(text, request.field, request.value);
  assert.ok(edit);
  return text.slice(0, edit.start) + edit.text + text.slice(edit.end);
};
assert.throws(() => decodeDeckRequest({ type: 'deck/session-time', field: 'end', value: '24:00' }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/session-time', field: 'length', value: '09:00' }), DeckProtocolError);
const startOnly = apply(deck, 'start', '09:00');
assert.deepEqual(timetableFoot(readTimetable(startOnly)), {
  count: '6 slides', total: '30 min', start: '09:00', length: null, end: null,
  comparison: null, over: false, untimed: '2 slides have no time yet',
});
const lengthOnly = apply(deck, 'length', '60');
assert.equal(lengthMinutesOf(frontMatterValue(lengthOnly, SESSION_LENGTH)), 60);
assert.equal(lengthOnly, deck.replace('deck: 2', 'deck: 2\nritemark-length: 60'));
for (const value of ['0', '1441', '2.5']) {
  assert.throws(() => decodeDeckRequest({ type: 'deck/session-time', field: 'length', value }), DeckProtocolError);
  assert.equal(sessionTimeEdit(deck, 'length', value), null);
}
for (const value of ['1', '1440']) {
  assert.equal(lengthMinutesOf(frontMatterValue(apply(deck, 'length', value), SESSION_LENGTH)), Number(value));
}
const written = apply(apply(deck, 'start', '09:00'), 'end', '09:20');
assert.equal(written, deck.replace('deck: 2', 'deck: 2\nritemark-start: 09:00\nritemark-length: 20'));
assert.equal(sessionTimeEdit(written, 'end', '09:20'), null);
for (const value of ['09:00', '08:59', '']) assert.equal(sessionTimeEdit(written, 'end', value), null);
assert.equal(sessionTimeEdit(lengthOnly, 'end', '12:00'), null);
assert.equal(apply(written, 'start', ''), written.replace('ritemark-start: 09:00\n', ''));
assert.equal(apply(written, 'length', ''), startOnly);
assert.equal(sessionTimeEdit(deck, 'start', ''), null);
assert.equal(sessionTimeEdit(deck, 'length', ''), null);
const unusualFront = '\uFEFF--- \r\n# keep this\nritemark-start: "09:00" \r\nritemark-length: 20\nlook: bordered \r\n---\r\nbody\nritemark-start: keep this too';
assert.equal(apply(unusualFront, 'start', ''), unusualFront.replace('ritemark-start: "09:00" \r\n', ''));
assert.equal(apply(unusualFront, 'length', ''), unusualFront.replace('ritemark-length: 20\n', ''));
assert.equal(apply('---\nritemark-length: 1\n---', 'length', ''), '---\n---');
const crlf = '\uFEFF' + deck.replace(/\n/g, '\r\n');
assert.equal(apply(crlf, 'start', '09:00'), crlf.replace('deck: 2', 'deck: 2\r\nritemark-start: 09:00'));
assert.equal(frontMatterValue(written, SESSION_START), '09:00');
assert.equal(lengthMinutesOf(frontMatterValue(written, SESSION_LENGTH)), 20);
const clock = readTimetable(written);
assert.deepEqual(timetableRows(clock).map(row => row.start), ['09:00', null, '09:05', '09:30', '09:30', '09:30']);
assert.deepEqual(timetableFoot(clock), {
  count: '6 slides', total: '30 min', start: '09:00', length: '20 min', end: '09:20', comparison: '10 min over', over: true, untimed: '2 slides have no time yet',
});
assert.equal(timetableFoot({ ...clock, sessionMinutes: 30 }).comparison, 'fits');
assert.equal(timetableFoot({ ...clock, sessionMinutes: 45 }).comparison, '15 min under');
assert.equal(clockMinutes('24:00'), null);
assert.equal(clockMinutes('9:00'), null);
assert.equal(sessionLengthFromEnd(clockMinutes('23:45'), clockMinutes('00:15')!), null);
assert.equal(timetableFoot({ ...clock, sessionStart: clockMinutes('23:45') }).end, '00:05');
assert.equal(sessionLengthFromEnd(clockMinutes('09:00'), clockMinutes('09:00')!), null);

// The foot selects the words and controls for each of the three forms.
assert.match(source, /Session\{' '\}/);
assert.match(source, /foot\.start === null && <SessionTime field="length" display=\{foot\.length\}/);
assert.match(source, /<SessionTime field="start" value=\{foot\.start\}/);
assert.match(source, /foot\.start !== null && <> to <SessionTime field="end" value=\{foot\.end\}/);
for (const word of ['Length', 'Start', 'End']) assert.ok(source.includes(`placeholder: '${word}'`));
assert.match(source, /aria-invalid=\{!valid\}/);
assert.match(source, /field === 'length' \? draft === '' \|\| lengthMinutesOf\(draft\) !== null/);
assert.match(source, /\{foot\.count\} · \{foot\.total\}/);

const options = { folderName: 'Training', theme: BUILT_IN_THEME };
assert.deepEqual(publicDeck(written.replace('time: 5', 'time: 12'), options), publicDeck(deck, options));
const digest = (text: string) => deckDigest(publicDeck(text, options));
assert.equal(digest(written), digest(apply(written, 'start', '10:00')), 'changing only the start keeps the page digest');
assert.equal(digest(written), digest(apply(written, 'length', '45')), 'changing only the length keeps the page digest');
assert.equal(digest(written), digest(apply(written, 'start', '')), 'clearing the start keeps the page digest');
assert.equal(digest(written), digest(apply(written, 'length', '')), 'clearing the length keeps the page digest');
console.log('timetable list: rows, Return, session, foot and public page passed');
