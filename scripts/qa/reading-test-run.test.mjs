import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scoreRun } from './reading-test-run.mjs';

const facts = JSON.parse(`{
  "folder": "Review",
  "documents": [
    {"file": "Brief/Charter.docx", "words": ["blue cabinet"]},
    {"file": "Visits/Visit form.pdf", "words": ["three counters"], "unreadReason": "scan"}
  ],
  "passwordDocument": "Locked appendix.docx",
  "deck": {
    "file": "Pilot deck.pptx",
    "slides": [
      {"number": 1, "words": ["quiet room"], "noteWords": ["tally sheet"]},
      {"number": 2, "words": ["side entrance"], "noteWords": ["folding ramp"]},
      {"number": 3, "words": ["next Tuesday"], "noteWords": ["amber folder"]},
      {"number": 4, "words": ["red boxes"], "noteWords": ["call bell"]},
      {"number": 5, "words": ["6200"], "noteWords": []},
      {"number": 6, "words": ["six chairs"], "noteWords": ["white binder"]}
    ]
  }
}`);

const answer = `Charter recommends the blue cabinet.
Visit form is an image-only scan.
Locked appendix has a password. Please provide the password.
Pilot deck describes the pilot.
Slide 1 — quiet room. Speaker notes: tally sheet.
Slide 2 — side entrance. Speaker notes: folding ramp.
Slide 3 — next Tuesday. Speaker notes: amber folder.
Slide 4 — red boxes. Speaker notes: call bell.
Slide 5 — 6200 in reserve. Speaker notes: none.
Slide 6 — six chairs. Speaker notes: white binder.`;

const sample = {
  answer: answer.replace('Charter', '[Charter](Brief/Charter.docx#q=blue%20cabinet)'),
  visibleAnswer: answer,
  stepLabels: ['Looked in Review: 2 Word documents', 'Read Charter.docx', "Couldn't open Locked appendix.docx · it has a password"],
  links: [
    { label: 'Charter', expectedFile: 'Brief/Charter.docx', opensRightDocument: true, hasPassage: true },
    { label: 'Pilot deck', expectedFile: 'Pilot deck.pptx', opensRightDocument: true, hasPassage: true },
  ],
};

test('reading harness accepts document evidence, justified unread files, and correctly assigned notes', () => {
  const result = scoreRun(sample, facts);
  assert.deepEqual(result.criteria, { 1: 'pass', 2: 'pass', 3: 'pass', 4: 'to check', 5: 'pass', 6: 'pass' });
  assert.deepEqual(result.coverage.map(({ result }) => result), ['read', 'unread', 'unread', 'read']);
  assert.match(result.passwordLine, /provide the password/);
});

test('reading harness catches unsubstantiated coverage, misplaced notes, command labels, and bad source style', () => {
  const result = scoreRun({
    ...sample,
    visibleAnswer: answer.replace('blue cabinet', 'blue cabinets')
      .replace('image-only scan', 'unread')
      .replace('Please provide the password.', 'It remains closed.')
      .replace('tally sheet.', 'tally sheet and folding ramp.')
      .replace('Speaker notes: none.', 'Speaker notes: call bell.') + '\nSource 2 [Charter.docx] C:\\Work\\Charter.docx',
    stepLabels: [...sample.stepLabels, 'Read Brief/Charter.docx', 'pdftotext Visit.pdf -'],
    links: [{ label: '2', expectedFile: 'Pilot deck.pptx', opensRightDocument: false }],
  }, facts);
  assert.deepEqual(result.criteria, { 1: 'fail', 2: 'fail', 3: 'fail', 4: 'fail', 5: 'fail', 6: 'fail' });
  assert.deepEqual(result.badSteps, ['Read Brief/Charter.docx', 'pdftotext Visit.pdf -']);
  assert.equal(result.slides[0].notes, false);
  assert.equal(result.slides[4].notes, false);
});

test('each read source needs a link and duplicate slide rows fail the notes check', () => {
  const result = scoreRun({
    ...sample,
    visibleAnswer: answer + '\nSlide 1 — quiet room. Speaker notes: tally sheet.',
    links: sample.links.slice(0, 1),
  }, facts);
  assert.equal(result.criteria[2], 'fail');
  assert.equal(result.criteria[4], 'fail');
});
