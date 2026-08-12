/**
 * Sprint 108 R5 — format gating and waveform peaks.
 *
 * The conversion path itself (afconvert) is exercised by the Phase 0 audit and
 * by dev-mode QA; what is unit-tested here is the gate that decides what we
 * accept, and the WAV reader that turns PCM into a waveform.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
  assertSupportedInput,
  classifyInput,
  computePeaks,
  parseWavHeader,
} from './audioPrep';
import { TranscriptionError } from './types';

/** Build a mono 16-bit WAV, optionally with a LIST chunk before `data`. */
function buildWav(samples: number[], options: { sampleRate?: number; withListChunk?: boolean } = {}): Buffer {
  const sampleRate = options.sampleRate ?? 16000;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, index) => data.writeInt16LE(value, index * 2));

  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8); // PCM
  fmt.writeUInt16LE(1, 10); // mono
  fmt.writeUInt32LE(sampleRate, 12);
  fmt.writeUInt32LE(sampleRate * 2, 16);
  fmt.writeUInt16LE(2, 20);
  fmt.writeUInt16LE(16, 22);

  const chunks: Buffer[] = [fmt];

  if (options.withListChunk) {
    const listBody = Buffer.from('INFOhello world!', 'ascii');
    const list = Buffer.alloc(8 + listBody.length);
    list.write('LIST', 0, 'ascii');
    list.writeUInt32LE(listBody.length, 4);
    listBody.copy(list, 8);
    chunks.push(list);
  }

  const dataHeader = Buffer.alloc(8);
  dataHeader.write('data', 0, 'ascii');
  dataHeader.writeUInt32LE(data.length, 4);
  chunks.push(dataHeader, data);

  const body = Buffer.concat(chunks);
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'ascii');
  riff.writeUInt32LE(4 + body.length, 4);
  riff.write('WAVE', 8, 'ascii');
  return Buffer.concat([riff, body]);
}

async function run(): Promise<void> {
  // ── classification ──

  for (const ext of AUDIO_EXTENSIONS) {
    assert.equal(classifyInput(`/tmp/recording${ext}`), 'audio', `${ext} should be accepted`);
    assert.equal(classifyInput(`/tmp/RECORDING${ext.toUpperCase()}`), 'audio', 'extensions are case-insensitive');
  }
  for (const ext of VIDEO_EXTENSIONS) {
    assert.equal(classifyInput(`/tmp/clip${ext}`), 'video');
  }
  assert.equal(classifyInput('/tmp/notes.txt'), 'unsupported');
  assert.equal(classifyInput('/tmp/noextension'), 'unsupported');

  // ── refusals carry a code and a next action, never a raw failure ──

  assert.throws(
    () => assertSupportedInput('/tmp/standup.mp4'),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptionError);
      assert.equal(error.code, 'video-not-supported');
      assert.match(error.message, /Export the audio track/, 'the message says what to do instead');
      return true;
    },
  );

  assert.throws(
    () => assertSupportedInput('/tmp/notes.txt'),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptionError);
      assert.equal(error.code, 'unsupported-format');
      assert.match(error.message, /Supported:/, 'the message lists what would work');
      return true;
    },
  );

  assert.doesNotThrow(() => assertSupportedInput('/tmp/meeting.m4a'));

  // ── WAV header walking ──

  const plain = parseWavHeader(buildWav([0, 1, 2]));
  assert.equal(plain.bitsPerSample, 16);
  assert.equal(plain.channels, 1);
  assert.equal(plain.sampleRate, 16000);
  assert.equal(plain.dataOffset, 44, 'the common case is the classic 44-byte header');

  const withList = parseWavHeader(buildWav([0, 1, 2], { withListChunk: true }));
  assert.ok(
    withList.dataOffset > 44,
    'a LIST chunk pushes the data further out — the reason chunks are walked instead of assumed',
  );
  assert.equal(withList.dataLength, 6);

  assert.throws(() => parseWavHeader(Buffer.from('not a wav file at all')), /readable WAV/);

  // ── peaks ──

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-peaks-'));
  try {
    // Two halves: quiet, then full scale.
    const samples = [...Array(500).fill(3276), ...Array(500).fill(32767)];
    const wavPath = path.join(dir, 'tone.wav');
    fs.writeFileSync(wavPath, buildWav(samples));

    const peaks = await computePeaks(wavPath, 10);
    assert.equal(peaks.length, 10, 'the requested bucket count is honoured');
    assert.ok(
      peaks.every((peak) => peak >= 0 && peak <= 1),
      'peaks are normalised to 0..1 so the renderer needs no scale',
    );
    assert.ok(peaks[0] < 0.2, 'the quiet half reads quiet');
    assert.ok(peaks[9] > 0.9, 'the loud half reads loud');

    const listWavPath = path.join(dir, 'with-list.wav');
    fs.writeFileSync(listWavPath, buildWav(samples, { withListChunk: true }));
    const listPeaks = await computePeaks(listWavPath, 10);
    assert.equal(listPeaks.length, 10);
    assert.ok(listPeaks[9] > 0.9, 'peaks survive a non-standard header');

    const silent = path.join(dir, 'silence.wav');
    fs.writeFileSync(silent, buildWav([]));
    assert.deepEqual(await computePeaks(silent, 10), [], 'an empty file yields no peaks rather than throwing');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('audioPrep.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
