import assert from 'node:assert/strict';
import { readTimetable } from './timetable';
import { slideMinutesText, timetableStatus } from './timetableDisplay';

const front = '---\nritemark-length: 180\n---\n\n';
const slide = (minutes?: number) => '```slide points\ntitle: Practice\n'
  + (minutes === undefined ? '' : `time: ${minutes}\n`) + '```\n\n';

const over = readTimetable(front + Array.from({ length: 17 }, (_, index) =>
  slide(index >= 15 ? undefined : index === 5 ? 25 : index === 0 ? 35 : 10)).join(''));
assert.equal(`Slide 6 of 17 · ${slideMinutesText(over.slides[5])}`, 'Slide 6 of 17 · 25 min');
assert.deepEqual(timetableStatus(over), {
  text: '17 slides · 3 h 10 min · 10 min over 3 h',
  over: true,
  tooltip: '2 slides have no time yet',
});

assert.deepEqual(timetableStatus(readTimetable(front + slide(170))), {
  text: '1 slide · 2 h 50 min · 10 min under 3 h',
  over: false,
  tooltip: 'Deck length',
});

const untimed = readTimetable(front + slide());
assert.equal(timetableStatus(untimed), null);
assert.equal(slideMinutesText(untimed.slides[0]), null);
assert.equal(slideMinutesText(readTimetable(slide(0)).slides[0]), '0 min');
console.log('timetable display: bar, over/under session, untimed deck and zero minutes passed');
