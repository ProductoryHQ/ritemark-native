/**
 * Sprint 108 R7/R8/R9 — workbench logic.
 *
 * The thing worth testing here is the follow-along behaviour: which line is
 * highlighted at a given moment, including in the gaps between segments where a
 * naive containment check leaves nothing selected and the transcript appears to
 * lose its place.
 */
import assert from 'node:assert/strict';
import {
  activeSegmentIndex,
  confidenceThreshold,
  formatClock,
  isInteractivePlaybackTarget,
  isLowConfidence,
  resamplePeaks,
  segmentsForSpeaker,
  speakerColor,
  speakerLabelFor,
  SPEAKER_COLORS,
  type WorkbenchSegment,
} from './playback';

function seg(id: string, start: number, end: number, speaker?: string): WorkbenchSegment {
  return { id, start, end, text: id, ...(speaker ? { speaker } : {}) };
}

async function run(): Promise<void> {
  // ── activeSegmentIndex ──

  const segments = [
    seg('a', 0, 2, 's0'),
    seg('b', 2, 5, 's1'),
    seg('c', 7, 9, 's0'), // note the 2s gap after 'b'
    seg('d', 9, 12, 's1'),
  ];

  assert.equal(activeSegmentIndex(segments, 0), 0, 'the first segment is active at zero');
  assert.equal(activeSegmentIndex(segments, 1.5), 0);
  assert.equal(activeSegmentIndex(segments, 2), 1, 'a boundary belongs to the segment starting there');
  assert.equal(activeSegmentIndex(segments, 4.9), 1);
  assert.equal(activeSegmentIndex(segments, 11.9), 3);
  assert.equal(activeSegmentIndex(segments, 999), 3, 'past the end the last line stays highlighted');

  // The gap case: silence between 'b' and 'c' keeps 'b' highlighted rather
  // than deselecting, so the reader does not lose their place.
  assert.equal(activeSegmentIndex(segments, 6), 1, 'a gap keeps the previous line active');

  assert.equal(activeSegmentIndex(segments, -1), -1, 'before the first segment nothing is active');
  assert.equal(activeSegmentIndex([], 5), -1, 'no segments, no selection');

  // Matches a linear scan across the whole timeline — the binary search is an
  // optimisation, not a behaviour change.
  const linear = (time: number): number => {
    let found = -1;
    segments.forEach((segment, index) => {
      if (segment.start <= time) found = index;
    });
    return found;
  };
  for (let t = -1; t <= 13; t += 0.25) {
    assert.equal(activeSegmentIndex(segments, t), linear(t), `mismatch at t=${t}`);
  }

  // ── speakers ──

  assert.equal(segmentsForSpeaker(segments, 's0'), 2);
  assert.equal(segmentsForSpeaker(segments, 's1'), 2);
  assert.equal(segmentsForSpeaker(segments, 'nobody'), 0);

  const speakers = [
    { id: 's0', label: 'Kadri', colorIndex: 0 },
    { id: 's1', label: 'Jarmo', colorIndex: 1 },
  ];
  assert.equal(speakerLabelFor(speakers, 's0'), 'Kadri');
  assert.equal(speakerLabelFor(speakers, undefined), null, 'unattributed segments get no label');
  assert.equal(speakerLabelFor(speakers, 'unknown'), 'unknown', 'an unknown id falls back to itself');

  assert.equal(speakerColor(0), SPEAKER_COLORS[0]);
  assert.equal(speakerColor(SPEAKER_COLORS.length), SPEAKER_COLORS[0], 'the palette wraps');
  assert.ok(speakerColor(37), 'any index yields a colour');

  // Sprint 113 R5: playback shortcuts never consume editing/control keys.
  const element = (
    tagName: string,
    parentElement: unknown = null,
    attrs: Record<string, string> = {},
  ) => ({ tagName, parentElement, getAttribute: (name: string) => attrs[name] ?? null });
  assert.equal(isInteractivePlaybackTarget(element('INPUT')), true);
  assert.equal(isInteractivePlaybackTarget(element('SPAN', element('BUTTON'))), true, 'button descendants are guarded');
  assert.equal(isInteractivePlaybackTarget(element('DIV', null, { contenteditable: 'true' })), true);
  assert.equal(isInteractivePlaybackTarget(element('DIV', null, { role: 'slider' })), true);
  assert.equal(isInteractivePlaybackTarget(element('DIV')), false, 'the workbench surface keeps shortcuts');

  // ── confidence ──

  assert.ok(confidenceThreshold('whisper-local') > 0 && confidenceThreshold('whisper-local') < 1);

  assert.equal(
    isLowConfidence({ text: 'Merike', start: 0, end: 1, confidence: 0.52 }, 'whisper-local'),
    true,
    'an uncertain name is exactly what the mark is for',
  );
  assert.equal(isLowConfidence({ text: 'the', start: 0, end: 1, confidence: 0.99 }, 'whisper-local'), false);

  // Measured against real output: whisper's low-probability tail is mostly
  // short function words at segment boundaries. Marking those trains the
  // reader to ignore the highlight.
  for (const short of ['and', 'The', 'One', 'so', 'I']) {
    assert.equal(
      isLowConfidence({ text: short, start: 0, end: 1, confidence: 0.2 }, 'whisper-local'),
      false,
      `"${short}" is too short to be worth marking however unsure the engine was`,
    );
  }
  assert.equal(
    isLowConfidence({ text: 'Wednesday,', start: 0, end: 1, confidence: 0.52 }, 'whisper-local'),
    true,
    'punctuation does not count against the length rule',
  );

  // R9: an engine that reports nothing must produce NO marks — not a mark on
  // every word because `undefined < threshold` was allowed to be true.
  assert.equal(
    isLowConfidence({ text: 'anything', start: 0, end: 1 }, 'whisper-local'),
    false,
    'a word without confidence data is never marked uncertain',
  );

  // ── clock ──

  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(74), '01:14');
  assert.equal(formatClock(3734), '1:02:14');
  assert.equal(formatClock(-5), '00:00');
  assert.equal(formatClock(Number.NaN), '00:00', 'a NaN currentTime must not render as garbage');

  // ── peaks ──

  const peaks = Array.from({ length: 2000 }, (_, i) => (i % 100) / 100);

  assert.equal(resamplePeaks(peaks, 200).length, 200);
  assert.equal(resamplePeaks(peaks, 1).length, 1);
  assert.deepEqual(resamplePeaks([0.2, 0.4], 10), [0.2, 0.4], 'fewer peaks than bars are returned as-is');
  assert.deepEqual(resamplePeaks([], 100), [], 'no peaks (Windows) yields no bars, not a crash');
  assert.deepEqual(resamplePeaks(peaks, 0), []);

  // Max, not mean: a loud transient must survive downsampling or the waveform
  // stops looking like speech.
  assert.equal(resamplePeaks([0, 0, 1, 0], 2)[1], 1, 'the peak in a bucket wins');
  assert.ok(
    resamplePeaks(peaks, 100).every((value) => value >= 0 && value <= 1),
    'resampling stays in the normalised range',
  );

  console.log('playback.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
