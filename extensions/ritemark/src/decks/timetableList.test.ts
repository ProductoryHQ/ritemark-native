import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeDeckRequest, DeckProtocolError } from './deckProtocol';
import { BUILT_IN_THEME } from './deckTheme';
import { publicDeck } from './page/publicDeck';
import { sessionTimeEdit } from './present/presentProtocol';
import { frontMatterValue, lengthMinutesOf } from './present/presentSession';
import { clockMinutes, readTimetable, sessionLengthFromEnd } from './timetable';
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
  count: '6 slides', total: '30 min', start: null, end: null, comparison: null, over: false, untimed: '2 slides have no time yet',
});
assert.equal(timetableFoot({ ...elapsed, sessionMinutes: 45 }).comparison, '15 min under');
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
const apply = (text: string, field: 'start' | 'end', value: string) => {
  const request = decodeDeckRequest({ type: 'deck/session-time', field, value });
  assert.equal(request.type, 'deck/session-time');
  const edit = sessionTimeEdit(text, request.field, request.value);
  assert.ok(edit);
  return text.slice(0, edit.start) + edit.text + text.slice(edit.end);
};
assert.throws(() => decodeDeckRequest({ type: 'deck/session-time', field: 'end', value: '24:00' }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/session-time', field: 'length', value: '09:00' }), DeckProtocolError);
const written = apply(apply(deck, 'start', '09:00'), 'end', '09:20');
assert.equal(written, deck.replace('deck: 2', 'deck: 2\nritemark-start: 09:00\nritemark-length: 20'));
assert.equal(sessionTimeEdit(written, 'end', '09:20'), null);
const crlf = '\uFEFF' + deck.replace(/\n/g, '\r\n');
assert.equal(apply(crlf, 'start', '09:00'), crlf.replace('deck: 2', 'deck: 2\r\nritemark-start: 09:00'));
assert.equal(frontMatterValue(written, 'ritemark-start'), '09:00');
assert.equal(lengthMinutesOf(frontMatterValue(written, 'ritemark-length')), 20);
const clock = readTimetable(written);
assert.deepEqual(timetableRows(clock).map(row => row.start), ['09:00', null, '09:05', '09:30', '09:30', '09:30']);
assert.deepEqual(timetableFoot(clock), {
  count: '6 slides', total: '30 min', start: '09:00', end: '09:20', comparison: '10 min over', over: true, untimed: '2 slides have no time yet',
});
assert.equal(timetableFoot({ ...clock, sessionMinutes: 30 }).comparison, 'fits');
assert.equal(timetableFoot({ ...clock, sessionMinutes: 45 }).comparison, '15 min under');
assert.equal(clockMinutes('24:00'), null);
assert.equal(clockMinutes('9:00'), null);
assert.equal(sessionLengthFromEnd(clockMinutes('23:45'), clockMinutes('00:15')!), 30);
assert.equal(timetableFoot({ ...clock, sessionStart: clockMinutes('23:45') }).end, '00:05');
assert.equal(sessionLengthFromEnd(clockMinutes('09:00'), clockMinutes('09:00')!), 1440);

const options = { folderName: 'Training', theme: BUILT_IN_THEME };
assert.deepEqual(publicDeck(written.replace('time: 5', 'time: 12'), options), publicDeck(deck, options));
console.log('timetable list: rows, Return, session, foot and public page passed');
