/**
 * The slide the person is on, in the chip's words and the AI's line (17 November; the chip's look: the Experience lead).
 * Run: `npx tsx src/decks/currentSlide.test.ts`
 */
import { strict as assert } from 'node:assert';
import {
  currentSlideChipLabel,
  currentSlideChipTooltip,
  currentSlideContextLine,
  currentSlideNote,
  slideNumbersText,
  slideTitleLine,
  type CurrentSlide,
} from './currentSlide';

const one: CurrentSlide = { deck: 'Training', count: 13, slides: [{ number: 5, id: 'k3f9', title: 'Agenda' }] };
const untitled: CurrentSlide = { deck: 'Training', count: 13, slides: [{ number: 5, id: 'k3f9' }] };
const several = (numbers: number[]): CurrentSlide => ({ deck: 'Training', count: 13, slides: numbers.map(number => ({ number, id: `s${number}` })) });

// The chip: one slide, its title truncating in the chip itself (the 140 px is the chip's CSS).
assert.equal(currentSlideChipLabel(one), 'Slide 5 · Agenda');
assert.equal(currentSlideChipLabel(untitled), 'Slide 5', 'a slide with no title reads "Slide 5"');
assert.equal(currentSlideChipLabel({ ...one, slides: [{ number: 1, title: '   ' }] }), 'Slide 1');
// Several slides selected on the strip.
assert.equal(currentSlideChipLabel(several([3, 4, 5])), 'Slides 3–5');
assert.equal(currentSlideChipLabel(several([2, 5, 7])), 'Slides 2, 5, 7');
assert.equal(currentSlideChipLabel(several([2, 5])), 'Slides 2, 5');
assert.equal(currentSlideChipLabel(several([1, 3, 5, 7, 9, 11])), '6 slides');
assert.equal(currentSlideChipLabel(several([1, 2, 3, 4, 5, 6])), 'Slides 1–6', 'a run in order of any length');

// The tooltip names the deck and the AI the composer will send to.
assert.equal(currentSlideChipTooltip(one, 'Claude'), "Training, slide 5 of 13. Claude reads 'this slide' as this one.");
assert.equal(currentSlideChipTooltip(one, 'ChatGPT'), "Training, slide 5 of 13. ChatGPT reads 'this slide' as this one.");
assert.equal(currentSlideChipTooltip(several([3, 4, 5]), 'Claude'), 'Training, slides 3–5 of 13.');
assert.equal(currentSlideChipTooltip(several([2, 5, 7]), 'Claude'), 'Training, slides 2, 5, 7 of 13.');
assert.equal(currentSlideChipTooltip(several([1, 3, 5, 7]), 'Claude'), 'Training, 4 of 13 slides.');

// The AI's line.
assert.equal(currentSlideContextLine(one), "The person is on slide 5 of 13 ('Agenda', id k3f9) in Training.");
assert.equal(currentSlideContextLine(untitled), 'The person is on slide 5 of 13 (id k3f9) in Training.');
assert.equal(currentSlideContextLine({ deck: 'Training', count: 2, slides: [{ number: 2 }] }), 'The person is on slide 2 of 2 in Training.');
assert.equal(
  currentSlideContextLine({ deck: 'Training', count: 13, slides: [{ number: 3, id: 'a1', title: 'A' }, { number: 4, id: 'b2' }, { number: 5 }] }),
  "The person has selected 3 slides of 13 in Training: 3 ('A', id a1), 4 (id b2), 5.",
);
assert.equal(currentSlideNote(one), "[Current slide: The person is on slide 5 of 13 ('Agenda', id k3f9) in Training.]");
assert.equal(currentSlideNote(undefined), null, 'a Text document has no slide line');
assert.equal(currentSlideNote(null), null);
assert.equal(currentSlideNote({ deck: 'Training', count: 3, slides: [] }), null);

// Titles are one short line; numbers in words.
assert.equal(slideTitleLine('Two\n  lines '), 'Two lines');
assert.equal(slideTitleLine(42), '');
assert.equal(slideTitleLine('x'.repeat(300)).length, 120);
assert.equal(slideNumbersText([]), null);
assert.equal(slideNumbersText([7]), '7');

console.log('currentSlide tests passed');
