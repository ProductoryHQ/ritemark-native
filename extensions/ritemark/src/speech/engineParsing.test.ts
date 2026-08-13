/**
 * Sprint 108 R3/R4/R9 — engine output parsing.
 *
 * Covers the halves of both engines that can be tested without spawning a
 * 1.6 GB model or spending money: whisper's JSON sidecar and progress lines,
 * and Scribe's word stream and error bodies.
 *
 * The whisper fixtures below are the real shapes recorded in audit A2.
 */
import assert from 'node:assert/strict';
import { parseWhisperJson, parseProgressLine, tokensToWords } from './engines/whisperLocalEngine';
import { scribeWordsToTranscriptWords, extractApiMessage, mapHttpError } from './engines/elevenLabsEngine';

async function run(): Promise<void> {
  // ── whisper: progress lines (stderr, padded for two digits) ──

  assert.equal(parseProgressLine('whisper_print_progress_callback: progress =  65%'), 65);
  assert.equal(parseProgressLine('whisper_print_progress_callback: progress = 100%'), 100);
  assert.equal(parseProgressLine('ggml_metal_device_init: GPU name:   Apple M4 Pro'), null);
  assert.equal(parseProgressLine(''), null);

  // ── whisper: tokens merge into words, confidence is the weakest link ──

  const words = tokensToWords([
    { text: '[_BEG_]', p: 0.9 },
    { text: ' Mer', offsets: { from: 100, to: 200 }, p: 0.9 },
    { text: 'ike', offsets: { from: 200, to: 340 }, p: 0.4 },
    // Timestamp tokens close with a digit, not an underscore. Letting these
    // through glued "[_TT_212]" onto the previous word and — with their low
    // probability — painted it amber in the workbench.
    { text: '[_TT_212]', p: 0.11 },
    { text: ' and', offsets: { from: 350, to: 460 }, p: 0.99 },
    { text: '[_EOT_]', p: 0.5 },
  ]);

  assert.equal(words.length, 2, 'special tokens are dropped, sub-word pieces merge');
  assert.ok(
    words.every((word) => !/\[_/.test(word.text)),
    'no decoder token survives into the transcript',
  );
  assert.equal(words[0].text, 'Merike');
  assert.equal(words[0].start, 0.1, 'ms offsets become seconds');
  assert.equal(words[0].end, 0.34);
  assert.equal(words[0].confidence, 0.4, 'a word is only as certain as its least certain piece');
  assert.equal(words[1].text, 'and');

  // ── whisper: the full sidecar ──

  const parsed = parseWhisperJson(
    JSON.stringify({
      result: { language: 'en' },
      transcription: [
        {
          offsets: { from: 0, to: 4240 },
          text: ' Today we are looking at why version control matters.',
          tokens: [
            { text: ' Today', offsets: { from: 100, to: 340 }, p: 0.88 },
            { text: ' we', offsets: { from: 340, to: 480 }, p: 0.97 },
          ],
        },
        { offsets: { from: 4240, to: 8240 }, text: '   ' },
      ],
    }),
  );

  assert.equal(parsed.language, 'en');
  assert.equal(parsed.segments.length, 1, 'whitespace-only segments are dropped');
  assert.equal(parsed.segments[0].start, 0);
  assert.equal(parsed.segments[0].end, 4.24);
  assert.equal(parsed.segments[0].text, 'Today we are looking at why version control matters.');
  assert.equal(parsed.segments[0].words?.length, 2);

  assert.throws(() => parseWhisperJson('not json'), /could not be read/, 'malformed output is a coded error');

  const empty = parseWhisperJson(JSON.stringify({ result: {}, transcription: [] }));
  assert.deepEqual(empty.segments, [], 'an empty transcription parses to no segments');
  assert.equal(empty.language, null);

  // ── ElevenLabs: word stream ──

  const scribe = scribeWordsToTranscriptWords([
    { text: 'So', start: 0.1, end: 0.4, type: 'word', speaker_id: 'speaker_0', logprob: -0.02 },
    { text: ' ', start: 0.4, end: 0.45, type: 'spacing' },
    { text: '(laughter)', start: 0.5, end: 1.0, type: 'audio_event' },
    { text: 'Merike', start: 1.0, end: 1.6, type: 'word', speaker_id: 'speaker_1', logprob: -2.3 },
    { text: '', start: 2.0, end: 2.1, type: 'word' },
  ]);

  assert.equal(scribe.length, 2, 'spacing, audio events and empty words are dropped');
  assert.equal(scribe[0].speaker, 'speaker_0');
  assert.ok(
    scribe[0].confidence !== undefined && scribe[0].confidence > 0.97,
    'a near-zero logprob is near-certain',
  );
  assert.ok(
    scribe[1].confidence !== undefined && scribe[1].confidence < 0.15,
    'a strongly negative logprob is low confidence — the R9 highlight case',
  );
  assert.ok(
    scribe.every((word) => word.confidence === undefined || (word.confidence >= 0 && word.confidence <= 1)),
    'confidence is on the same 0..1 scale as whisper',
  );

  // ── ElevenLabs: error bodies come in two shapes ──

  assert.equal(extractApiMessage(JSON.stringify({ detail: 'Invalid API key' })), 'Invalid API key');
  assert.equal(extractApiMessage(JSON.stringify({ detail: { message: 'Quota exceeded' } })), 'Quota exceeded');
  assert.equal(extractApiMessage('<html>502</html>'), '<html>502</html>', 'non-JSON falls back to the raw body');

  assert.equal(mapHttpError(401, '{}').code, 'invalid-api-key');
  assert.equal(mapHttpError(403, '{}').code, 'invalid-api-key');
  assert.equal(mapHttpError(429, '{}').code, 'rate-limited');
  assert.equal(mapHttpError(429, '{}').retryable, true);
  assert.equal(mapHttpError(402, '{}').code, 'quota-exceeded');
  assert.equal(
    mapHttpError(400, JSON.stringify({ detail: 'You have run out of credit' })).code,
    'quota-exceeded',
    'quota can arrive as a 400 with a message',
  );
  assert.equal(mapHttpError(503, '{}').code, 'network');
  assert.equal(mapHttpError(503, '{}').retryable, true);
  assert.equal(mapHttpError(418, '{}').code, 'unknown');

  // No raw status codes or JSON leak into user-facing copy.
  for (const status of [401, 429, 402, 503]) {
    const message = mapHttpError(status, JSON.stringify({ detail: 'raw' })).message;
    assert.ok(!message.includes('{'), `message for ${status} leaked a JSON body`);
    assert.ok(!message.includes(String(status)), `message for ${status} leaked the status code`);
  }

  console.log('engineParsing.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
