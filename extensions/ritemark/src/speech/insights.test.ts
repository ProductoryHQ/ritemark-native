/**
 * Sprint 108 R10 — insight parsing and citation.
 *
 * The property under test is the one the feature rests on: an insight the user
 * cannot click through to the audio is a claim they must take on faith, so an
 * unresolvable timestamp means the item is DROPPED rather than shown.
 */
import assert from 'node:assert/strict';
import {
  buildInsightsPrompt,
  buildTranscriptText,
  parseInsightsResponse,
  parseTimestamp,
  resolveInsightTime,
} from './insightsParsing';
import type { TranscriptSegment, TranscriptSession } from './types';

const segments: TranscriptSegment[] = [
  { id: 's0', start: 0, end: 12, text: 'So the reason we wanted this call is the reporting piece.', speaker: 'speaker_0' },
  { id: 's1', start: 12, end: 30, text: 'Is that a data problem or a timing problem?', speaker: 'speaker_1' },
  { id: 's2', start: 41, end: 60, text: 'Honestly, timing.', speaker: 'speaker_0' },
];

function session(overrides: Partial<TranscriptSession> = {}): TranscriptSession {
  return {
    id: 'x',
    audioPath: '/a/call.m4a',
    audioFingerprint: '1:2',
    durationSec: 60,
    createdAt: '2026-08-13T09:00:00.000Z',
    updatedAt: '2026-08-13T09:00:00.000Z',
    engine: 'elevenlabs',
    language: 'en',
    speakerSeparation: 'diarized',
    speakers: [
      { id: 'speaker_0', label: 'Kadri', colorIndex: 0 },
      { id: 'speaker_1', label: 'Jarmo', colorIndex: 1 },
    ],
    segments,
    peaks: [],
    ...overrides,
  };
}

const NOW = '2026-08-13T10:00:00.000Z';

async function run(): Promise<void> {
  // ── timestamps ──

  assert.equal(parseTimestamp('12:04'), 724);
  assert.equal(parseTimestamp('1:02:14'), 3734);
  assert.equal(parseTimestamp('00:00'), 0);
  assert.equal(parseTimestamp(724), 724);
  assert.equal(parseTimestamp('724'), 724);
  assert.equal(parseTimestamp('nonsense'), null);
  assert.equal(parseTimestamp(''), null);
  assert.equal(parseTimestamp(null), null);
  assert.equal(parseTimestamp(undefined), null);
  assert.equal(parseTimestamp(-5), null);
  assert.equal(parseTimestamp('12:99'), null, 'impossible clock values are not times');

  // ── snapping ──

  assert.equal(resolveInsightTime(segments, 5), 0, 'a cited moment snaps to the start of its line');
  assert.equal(resolveInsightTime(segments, 20), 12);
  assert.equal(resolveInsightTime(segments, 41), 41);
  assert.equal(resolveInsightTime(segments, 35), 12, 'a gap resolves to the line before it');
  assert.equal(resolveInsightTime(segments, 65), 41, 'just past the end is still citable');
  assert.equal(resolveInsightTime(segments, 5000), null, 'a wildly out-of-range citation is rejected');
  assert.equal(resolveInsightTime(segments, null), null);
  assert.equal(resolveInsightTime([], 5), null);

  // ── parsing a good response ──

  const good = JSON.stringify({
    summary: '  Reporting is trusted on Monday and untrusted by Wednesday.  ',
    decisions: [{ text: 'Reframed as a versioning problem', at: '00:41' }],
    actions: [{ text: 'Draft a one-page proposal', owner: 'Jarmo', at: '00:12' }],
    questions: [{ text: 'Is the September date fixed?', at: '00:20' }],
    quotes: [{ text: 'Honestly, timing.', owner: 'Kadri', at: '00:41' }],
  });

  const parsed = parseInsightsResponse(good, segments, 'claude-opus-5', NOW);

  assert.equal(parsed.model, 'claude-opus-5');
  assert.equal(parsed.generatedAt, NOW);
  assert.equal(parsed.summary, 'Reporting is trusted on Monday and untrusted by Wednesday.', 'summary is trimmed');
  assert.equal(parsed.items.length, 4);

  assert.deepEqual(
    parsed.items.map((item) => item.at),
    [12, 12, 41, 41],
    'items are ordered by the moment they cite',
  );
  assert.ok(
    parsed.items.every((item) => segments.some((segment) => segment.start === item.at)),
    'every surviving item points at a real segment start',
  );

  const action = parsed.items.find((item) => item.kind === 'action');
  assert.equal(action?.owner, 'Jarmo');
  assert.equal(parsed.items.filter((item) => item.kind === 'quote').length, 1);

  // ── the case that matters: uncitable items are dropped ──

  const messy = JSON.stringify({
    summary: 'Fine.',
    decisions: [
      { text: 'Real decision', at: '00:12' },
      { text: 'Cited an hour into a one-minute recording', at: '58:00' },
      { text: 'No timestamp at all' },
      { text: 'Unparseable timestamp', at: 'later' },
      { text: '   ', at: '00:12' },
    ],
  });

  const cleaned = parseInsightsResponse(messy, segments, 'm', NOW);
  assert.equal(cleaned.items.length, 1, 'only the citable, non-empty item survives');
  assert.equal(cleaned.items[0].text, 'Real decision');

  // ── model output habits ──

  const fenced = '```json\n' + good + '\n```';
  assert.equal(
    parseInsightsResponse(fenced, segments, 'm', NOW).items.length,
    4,
    'a fenced response still parses',
  );

  const chatty = `Sure! Here are the insights:\n\n${good}\n\nLet me know if you want more.`;
  assert.equal(
    parseInsightsResponse(chatty, segments, 'm', NOW).items.length,
    4,
    'prose around the JSON does not cost the user their memo',
  );

  const brokenJson = parseInsightsResponse('not json at all', segments, 'm', NOW);
  assert.deepEqual(brokenJson.items, [], 'unparseable output yields no items rather than throwing');
  assert.equal(brokenJson.summary, undefined);

  assert.deepEqual(
    parseInsightsResponse(JSON.stringify({ decisions: 'not an array' }), segments, 'm', NOW).items,
    [],
    'a wrong-shaped field is ignored, not crashed on',
  );

  // ── prompt ──

  const transcript = buildTranscriptText(session());
  assert.ok(transcript.includes('[00:00] Kadri: So the reason'), 'lines carry timestamp and speaker');
  assert.ok(transcript.includes('[00:41] Kadri: Honestly, timing.'));

  const diarizedPrompt = buildInsightsPrompt(session());
  assert.ok(diarizedPrompt.includes('Speaker names are given where known.'));

  const anonPrompt = buildInsightsPrompt(session({ speakerSeparation: 'none', speakers: [] }));
  assert.ok(
    anonPrompt.includes('do NOT attribute anything to a named person'),
    'without diarization the model is told not to invent attribution (D3)',
  );
  assert.ok(anonPrompt.includes('"at": "MM:SS"'), 'the shape asks for a timestamp on every item');

  console.log('insights.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
