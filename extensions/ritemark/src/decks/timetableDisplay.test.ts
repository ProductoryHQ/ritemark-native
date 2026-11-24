import assert from 'node:assert/strict';
import { readTimetable } from './timetable';
import { slideCountWithMinutes, slideMinutesText, timetableStatus } from './timetableDisplay';

const front = '---\nritemark-length: 180\n---\n\n';
const slide = (minutes?: number) => '```slide points\ntitle: Practice\n'
  + (minutes === undefined ? '' : `time: ${minutes}\n`) + '```\n\n';

const over = readTimetable(front + Array.from({ length: 17 }, (_, index) =>
  slide(index >= 15 ? undefined : index === 5 ? 25 : index === 0 ? 35 : 10)).join(''));
assert.equal(slideCountWithMinutes('Slide 6 of 17', over.slides[5]), 'Slide 6 of 17 · 25 min');
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
assert.equal(slideCountWithMinutes('Slide 17 of 17', over.slides[16]), 'Slide 17 of 17');
assert.equal(slideCountWithMinutes('Slide 1 of 1', untimed.slides[0]), 'Slide 1 of 1');
assert.equal(slideCountWithMinutes('No slides yet', undefined), 'No slides yet');
const exercise = (time = '') => '\x60\x60\x60slide exercise\ntitle: Practice\ntag: 20 min\n' + time + '\x60\x60\x60\n';
const section = '\x60\x60\x60slide section\ntitle: Practice\n\x60\x60\x60\n';
const exerciseTiming = readTimetable(section + exercise());
assert.equal(slideCountWithMinutes('Slide 1 of 2', exerciseTiming.slides[0]), 'Slide 1 of 2 · 20 min');
assert.equal(slideCountWithMinutes('Slide 2 of 2', exerciseTiming.slides[1]), 'Slide 2 of 2 · 20 min');
const overridden = readTimetable(exercise('time: 0\n')).slides[0];
assert.equal(overridden.labelMinutes, 20);
assert.equal(slideCountWithMinutes('Slide 1 of 1', overridden), 'Slide 1 of 1 · 0 min');
console.log('timetable display: bar, over/under session, untimed deck and zero minutes passed');
