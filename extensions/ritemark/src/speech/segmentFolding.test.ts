/**
 * Sprint 108 R4 — word-to-segment folding.
 *
 * The two rules under test are the ones videomark learned the hard way
 * (research/elevenlabs-prior-art.md): majority-vote speakers, and a break on
 * speaker change.
 */
import assert from 'node:assert/strict';
import { foldWordsIntoSegments, joinWords, majoritySpeaker, DEFAULT_FOLD_OPTIONS } from './segmentFolding';
import type { TranscriptWord } from './types';

function word(text: string, start: number, end: number, speaker?: string): TranscriptWord {
  return { text, start, end, ...(speaker ? { speaker } : {}) };
}

async function run(): Promise<void> {
  // ── majoritySpeaker ──

  assert.equal(
    majoritySpeaker([word('a', 0, 1, 's0'), word('b', 1, 2, 's0'), word('c', 2, 3, 's1')]),
    's0',
    'the majority voice wins',
  );

  // The flicker case: a one-word interjection must not relabel the segment.
  assert.equal(
    majoritySpeaker([word('mhm', 0, 0.2, 's1'), word('so', 0.3, 0.6, 's0'), word('anyway', 0.6, 1, 's0')]),
    's0',
  );

  assert.equal(majoritySpeaker([word('a', 0, 1)]), undefined, 'no labels means no speaker');

  // ── joinWords ──

  assert.equal(joinWords([word('Hello', 0, 1), word(',', 1, 1), word('world', 1, 2)]), 'Hello, world');
  assert.equal(joinWords([word('Yes', 0, 1), word('.', 1, 1)]), 'Yes.', 'no space before punctuation');

  // ── speaker change forces a break ──

  const exchange = foldWordsIntoSegments(
    [
      word('So', 0.0, 0.3, 's0'),
      word('the', 0.3, 0.5, 's0'),
      word('reporting', 0.5, 1.0, 's0'),
      word('Right', 1.05, 1.4, 's1'),
      word('understood', 1.4, 2.0, 's1'),
    ],
    DEFAULT_FOLD_OPTIONS,
  );

  assert.equal(exchange.length, 2, 'a fast exchange splits into one segment per voice');
  assert.equal(exchange[0].speaker, 's0');
  assert.equal(exchange[1].speaker, 's1');
  assert.equal(exchange[0].text, 'So the reporting');
  assert.equal(exchange[1].text, 'Right understood');

  // ── a breath ends a segment ──

  const paused = foldWordsIntoSegments(
    [
      word('First', 0, 0.4, 's0'),
      word('thought', 0.4, 0.8, 's0'),
      word('Second', 2.0, 2.4, 's0'), // 1.2s gap, well past the 0.7s threshold
      word('thought', 2.4, 2.8, 's0'),
    ],
    DEFAULT_FOLD_OPTIONS,
  );
  assert.equal(paused.length, 2, 'a pause splits a single speaker turn');

  // ── short affirmations do not each become a segment ──

  const shortSentences = foldWordsIntoSegments(
    [word('Yes.', 0, 0.3, 's0'), word('No.', 0.35, 0.6, 's0'), word('Maybe.', 0.65, 1.0, 's0')],
    DEFAULT_FOLD_OPTIONS,
  );
  assert.equal(shortSentences.length, 1, 'sentence-end only breaks once a turn has body');

  // ── runaway guard ──

  const monologue: TranscriptWord[] = [];
  for (let i = 0; i < 200; i++) {
    monologue.push(word(`word${i}`, i * 0.3, i * 0.3 + 0.25, 's0'));
  }
  const chunks = foldWordsIntoSegments(monologue, { breathSeconds: 10, maxSegmentSeconds: 30 });
  assert.ok(chunks.length > 1, 'an unbroken monologue still gets chunked');
  for (const segment of chunks) {
    assert.ok(
      segment.end - segment.start <= 30.5,
      `segment ${segment.id} ran to ${segment.end - segment.start}s, past the guard`,
    );
  }

  // ── words survive folding (the "speaker label silently died" trap) ──

  const withWords = foldWordsIntoSegments([word('a', 0, 0.2, 's0'), word('b', 0.2, 0.4, 's0')]);
  assert.equal(withWords[0].words?.length, 2, 'per-word data is preserved for R9 highlighting');

  assert.deepEqual(foldWordsIntoSegments([]), [], 'no words, no segments');

  console.log('segmentFolding.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
