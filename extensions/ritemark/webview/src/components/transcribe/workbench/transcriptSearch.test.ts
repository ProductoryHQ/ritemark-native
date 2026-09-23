/**
 * Sprint 123 (#283) — finding text in a transcript.
 *
 * What a person loses if this is wrong: a word they can see is not found, the
 * count is off, Next jumps to the wrong place, or the highlight lands one
 * letter out — or a word the engine was unsure about loses its marking.
 *
 * Run with `npx tsx webview/src/components/transcribe/workbench/transcriptSearch.test.ts`.
 */
import { strict as assert } from 'node:assert';
import type { WorkbenchSegment } from './playback';
import {
  findTranscriptMatches,
  matchCountLabel,
  normalizeQuery,
  segmentRuns,
  splitRunsAtMatches,
  stepMatch,
} from './transcriptSearch';

const ENGINE = 'whisper-local';

const plain = (id: string, text: string): WorkbenchSegment => ({ id, start: 0, end: 1, text });
/** A segment with one word the engine was unsure about, so it renders word by word. */
const unsure: WorkbenchSegment = {
  id: 'u',
  start: 0,
  end: 1,
  text: 'Meeting with Merike about carriers',
  words: [
    { text: 'Meeting', start: 0, end: 0.2, confidence: 0.99 },
    { text: 'with', start: 0.2, end: 0.3, confidence: 0.99 },
    { text: 'Merike', start: 0.3, end: 0.5, confidence: 0.2 },
    { text: 'about', start: 0.5, end: 0.6, confidence: 0.99 },
    { text: 'carriers', start: 0.6, end: 0.9, confidence: 0.99 },
  ],
};

const segments = [
  plain('a', 'The carrier API is late.'),
  plain('b', 'Carriers need the portal; the CARRIER team agrees.'),
  unsure,
  plain('d', 'Nothing here.'),
];

{
  // --- what a segment is searched as
  assert.deepEqual(segmentRuns(segments[0], ENGINE), [{ text: 'The carrier API is late.', lowConfidence: false }]);
  const runs = segmentRuns(unsure, ENGINE);
  assert.equal(runs.length, 5, 'word by word when a word was uncertain');
  assert.deepEqual(runs[2], { text: 'Merike ', lowConfidence: true });
  assert.equal(runs.map((run) => run.text).join(''), 'Meeting with Merike about carriers ');
}

{
  // --- matching: case-insensitive, in reading order, across segments
  const matches = findTranscriptMatches(segments, ENGINE, 'carrier');
  assert.deepEqual(
    matches.map((m) => [m.segmentIndex, m.start, m.end]),
    [[0, 4, 11], [1, 0, 7], [1, 30, 37], [2, 26, 33]],
  );
  assert.equal(findTranscriptMatches(segments, ENGINE, '  CARRIER  ').length, 4, 'surrounding space and case do not matter');
  assert.equal(findTranscriptMatches(segments, ENGINE, '').length, 0, 'an empty query finds nothing');
  assert.equal(findTranscriptMatches(segments, ENGINE, '   ').length, 0);
  assert.equal(findTranscriptMatches(segments, ENGINE, 'zebra').length, 0);

  // A match may cross word boundaries in a word-by-word segment.
  const across = findTranscriptMatches(segments, ENGINE, 'with merike');
  assert.deepEqual(across.map((m) => [m.segmentIndex, m.start, m.end]), [[2, 8, 19]]);

  // Non-overlapping: "aa" in "aaaa" is found twice, not three times.
  assert.equal(findTranscriptMatches([plain('x', 'aaaa')], ENGINE, 'aa').length, 2);
}

{
  // --- Estonian letters are ordinary letters, and case folds on them too
  const et = [plain('e', 'Õhtune ülevaade: ÄRA unusta ööd.')];
  assert.equal(findTranscriptMatches(et, ENGINE, 'õhtune').length, 1);
  assert.equal(findTranscriptMatches(et, ENGINE, 'ära').length, 1);
  assert.equal(findTranscriptMatches(et, ENGINE, 'ÖÖD').length, 1);
  assert.equal(findTranscriptMatches(et, ENGINE, 'ohtune').length, 0, 'õ is not o');
  // A character whose lower case is longer keeps offsets aligned.
  const turkish = [plain('t', 'İstanbul carrier')];
  assert.deepEqual(findTranscriptMatches(turkish, ENGINE, 'carrier').map((m) => [m.start, m.end]), [[9, 16]]);
  assert.equal(normalizeQuery('  Ära  '), 'ära');
}

{
  // --- moving between matches wraps at both ends
  assert.equal(stepMatch(0, 4, 1), 1);
  assert.equal(stepMatch(3, 4, 1), 0, 'Next after the last goes to the first');
  assert.equal(stepMatch(0, 4, -1), 3, 'Previous before the first goes to the last');
  assert.equal(stepMatch(-1, 4, 1), 0);
  assert.equal(stepMatch(-1, 4, -1), 3);
  assert.equal(stepMatch(2, 0, 1), -1, 'nothing to move to');
}

{
  // --- the count
  assert.equal(matchCountLabel(0, 12, 'carrier'), '1 of 12');
  assert.equal(matchCountLabel(11, 12, 'carrier'), '12 of 12');
  assert.equal(matchCountLabel(-1, 0, 'zebra'), 'No matches');
  assert.equal(matchCountLabel(-1, 0, '   '), '', 'nothing to say about an empty field');
}

{
  // --- splitting what is shown at match boundaries
  const runs = segmentRuns(segments[1], ENGINE);
  const ranges = findTranscriptMatches([segments[1]], ENGINE, 'carrier').map(({ start, end }) => ({ start, end }));
  const [only] = splitRunsAtMatches(runs, ranges, 1);
  assert.deepEqual(only.pieces, [
    { text: 'Carrier', kind: 'match' },
    { text: 's need the portal; the ', kind: 'text' },
    { text: 'CARRIER', kind: 'current' },
    { text: ' team agrees.', kind: 'text' },
  ]);
  assert.equal(only.pieces.map((p) => p.text).join(''), segments[1].text, 'no character lost or added');

  // Across words: the uncertain word keeps its own run, now in pieces.
  const wordRuns = segmentRuns(unsure, ENGINE);
  const acrossRanges = findTranscriptMatches([unsure], ENGINE, 'th meri').map(({ start, end }) => ({ start, end }));
  const split = splitRunsAtMatches(wordRuns, acrossRanges, 0);
  assert.deepEqual(split[1].pieces, [{ text: 'wi', kind: 'text' }, { text: 'th ', kind: 'current' }]);
  assert.deepEqual(split[2].pieces, [{ text: 'Meri', kind: 'current' }, { text: 'ke ', kind: 'text' }]);
  assert.equal(split[2].run.lowConfidence, true, 'the unsure-word marking stays on its word');
  assert.deepEqual(split[0].pieces, [{ text: 'Meeting ', kind: 'text' }], 'untouched words are one piece');

  // No ranges: every run is one plain piece.
  assert.deepEqual(splitRunsAtMatches(runs, [], -1)[0].pieces, [{ text: segments[1].text, kind: 'text' }]);
}

console.log('transcriptSearch.test.ts: all tests passed');
