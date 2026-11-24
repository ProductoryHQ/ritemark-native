import assert from 'node:assert/strict';
import { legacyToBlocks } from './blocks/legacyToBlocks';
import { slideDataOf, writeSlideData } from './deckFormat';
import { readTimetable } from './timetable';

const slide = (kind: string, ...lines: string[]) => ['\x60\x60\x60slide' + kind, ...lines, '\x60\x60\x60', ''].join('\n');
const exercise = ['[Practice · 25 min]{.label}', '', '# Try it', '', '::: steps', '1. Open the log', ':::'];
const input = [
  '---\ndeck: 2\nritemark-length: "45"\n---\n',
  slide('', '---', 'time: 5', '---', '# Welcome'),
  slide(' section', 'title: Practice', 'time: 90'),
  slide('', ...exercise),
  slide('', '---', 'skip: true', 'time: 30', '---', '# Backup'),
  slide('', '# Untimed', 'time: 60'),
  slide('', '---', 'section: true', '---', '# Wrap-up'),
  slide(' exercise', 'title: Review', 'tag: 20 minutit', 'time: 15'),
  slide('', '---', 'time: 2.5', '---', '::: steps', '1. Wait 10 minutes', ':::'),
  slide('', '---', 'time: 0', '---', '# Close'),
].join('\n');

for (const text of [input, '\uFEFF' + input.replace(/\n/g, '\r\n')]) {
  const { slides, sessionMinutes, totalMinutes, untimedCount } = readTimetable(text);
  assert.equal(sessionMinutes, 45);
  assert.equal(totalMinutes, 45);
  assert.equal(untimedCount, 2);
  assert.deepEqual(slides.map(slide => slide.minutes), [5, null, 25, 30, null, null, 15, null, 0]);
  assert.deepEqual(slides.map(slide => slide.labelMinutes), [null, null, 25, null, null, null, 20, null, null]);
  assert.deepEqual(slides.map(slide => slide.sectionMinutes), [null, 25, null, null, null, 15, null, null, null]);
  assert.deepEqual(slides.map(slide => slide.startMinutes), [0, 5, 5, 30, 30, 30, 30, 45, 45]);
  assert.equal(slides[3].skipped, true);
}
assert.equal(readTimetable(input.replace('"45"', '2.5')).sessionMinutes, null);
assert.equal(readTimetable(slide('', ...exercise)).sessionMinutes, null);

// Library copies use the shared slide writer and convert older slides through legacyToBlocks.
const converted = legacyToBlocks('exercise', 'tag: 25 min\ntime: 15');
const copy = writeSlideData('', converted.markdown, { ...converted.header, id: 'copy' });
assert.match(copy, /^time: 15$/m);
assert.equal(slideDataOf('', copy).time, '15');

console.log('timetable: passed');
