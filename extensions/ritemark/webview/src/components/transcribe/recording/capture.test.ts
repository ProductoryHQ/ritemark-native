/**
 * Sprint 118 R1–R3/R7 — webview capture logic.
 *
 * What a user would lose if this were wrong: audio stretched or squeezed by
 * the fallback resampler, samples lost at chunk boundaries, time or size that
 * claims more than the host confirmed, or a denied microphone blamed on the
 * wrong thing.
 */
import assert from 'node:assert/strict';
import {
  CHUNK_SAMPLES,
  ChunkLedger,
  Int16Chunker,
  MAX_UNACKED_CHUNKS,
  StreamingResampler,
  classifyCaptureError,
  floatToInt16,
  formatElapsed,
  formatSavedSize,
  int16ToBase64,
} from './capture';

function sine(rate: number, seconds: number, hz = 440): Float32Array {
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i++) out[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / rate);
  return out;
}

/** Feed `input` through `r` in ScriptProcessor-sized buffers. */
function stream(r: StreamingResampler, input: Float32Array, block = 4096): Float32Array {
  const parts: Float32Array[] = [];
  for (let i = 0; i < input.length; i += block) parts.push(r.push(input.subarray(i, i + block)));
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function run(): void {
  // --- resampler: duration is exact across buffer boundaries
  for (const rate of [48_000, 44_100, 96_000, 22_050, 8_000]) {
    const out = stream(new StreamingResampler(rate), sine(rate, 60));
    assert.ok(Math.abs(out.length - 16_000 * 60) <= 1, `${rate} Hz → 60 s is ${out.length} samples`);
  }
  const same = new StreamingResampler(16_000);
  assert.ok(same.passthrough);
  const input = sine(16_000, 0.1);
  const copied = same.push(input);
  assert.deepEqual(Array.from(copied), Array.from(input));
  assert.notEqual(copied.buffer, input.buffer, 'passthrough copies: the audio system reuses its buffer');

  // A constant signal stays constant; a tone keeps its level.
  const dc = stream(new StreamingResampler(44_100), new Float32Array(44_100).fill(0.25));
  assert.ok(dc.every((v) => Math.abs(v - 0.25) < 1e-6), 'box filter preserves level');
  const tone = stream(new StreamingResampler(48_000), sine(48_000, 1, 440));
  const peak = tone.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(peak > 0.48 && peak <= 0.5, `440 Hz survives downsampling (peak ${peak.toFixed(3)})`);
  // Above the new Nyquist (8 kHz) the box filter attenuates instead of folding at full level.
  const high = stream(new StreamingResampler(48_000), sine(48_000, 1, 15_000));
  const highPeak = high.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(highPeak < 0.2, `15 kHz is attenuated (peak ${highPeak.toFixed(3)})`);
  assert.throws(() => new StreamingResampler(0));

  // --- float → int16
  assert.deepEqual(Array.from(floatToInt16(new Float32Array([0, 1, -1, 2, -2, 0.5]))), [0, 32767, -32768, 32767, -32768, 16384]);

  // --- base64 is little-endian PCM16
  const b64 = int16ToBase64(new Int16Array([1, -2, 256]));
  assert.deepEqual(Array.from(Buffer.from(b64, 'base64')), [1, 0, 0xfe, 0xff, 0, 1]);
  const big = new Int16Array(CHUNK_SAMPLES * 2).map((_, i) => i % 1000);
  assert.equal(Buffer.from(int16ToBase64(big), 'base64').length, big.length * 2, 'large chunks encode without a stack overflow');

  // --- chunker: nothing lost or duplicated at boundaries
  const chunker = new Int16Chunker(10);
  const seen: number[] = [];
  let next = 0;
  for (const size of [3, 7, 12, 1, 9, 4]) {
    const block = new Int16Array(size).map(() => next++);
    for (const chunk of chunker.push(block)) {
      assert.equal(chunk.length, 10);
      seen.push(...chunk);
    }
  }
  const rest = chunker.flush();
  assert.ok(rest);
  seen.push(...rest);
  assert.deepEqual(seen, Array.from({ length: next }, (_, i) => i));
  assert.equal(chunker.flush(), null, 'flush empties');
  const held = new Int16Chunker(4);
  const [first] = held.push(new Int16Array([1, 2, 3, 4]));
  held.push(new Int16Array([9, 9, 9, 9]));
  assert.deepEqual(Array.from(first), [1, 2, 3, 4], 'an emitted chunk is never overwritten');

  // --- ledger: only confirmed audio counts
  const ledger = new ChunkLedger();
  assert.equal(ledger.lastSequence, -1);
  assert.equal(ledger.send(16_000), 0);
  assert.equal(ledger.send(16_000), 1);
  assert.equal(ledger.send(8_000), 2);
  assert.equal(ledger.ackedSeconds, 0, 'nothing confirmed yet');
  assert.ok(ledger.ack(1));
  assert.ok(!ledger.ack(1), 'a duplicate ack counts once');
  assert.ok(!ledger.ack(7));
  assert.ok(ledger.ack(0));
  assert.equal(ledger.ackedSeconds, 2);
  assert.equal(ledger.inFlight, 1);
  assert.equal(ledger.lastSequence, 2);
  for (let i = 0; i < MAX_UNACKED_CHUNKS - 1; i++) ledger.send(16_000);
  assert.ok(!ledger.overBound, `${MAX_UNACKED_CHUNKS} in flight is allowed`);
  ledger.send(16_000);
  assert.ok(ledger.overBound, 'one more is too slow');

  // --- failures are named for what the user can do
  const ok = { delegated: true, audioInputs: 1 };
  assert.equal(classifyCaptureError('NotAllowedError', ok), 'os-denied');
  assert.equal(classifyCaptureError('NotAllowedError', { delegated: false, audioInputs: 1 }), 'internal-config', 'a packaging bug is not blamed on settings');
  assert.equal(classifyCaptureError('NotFoundError', { delegated: true, audioInputs: 0 }), 'no-device');
  assert.equal(classifyCaptureError('NotFoundError', ok), 'os-denied', 'devices exist but the OS refused (Phase 0 S6)');
  assert.equal(classifyCaptureError('NotFoundError', { delegated: true, audioInputs: -1 }), 'os-denied');
  assert.equal(classifyCaptureError('NotReadableError', ok), 'device-busy');
  assert.equal(classifyCaptureError('AbortError', ok), 'device-busy');
  assert.equal(classifyCaptureError('TypeError', ok), 'unexpected');
  assert.equal(classifyCaptureError(undefined, ok), 'unexpected');

  // --- display
  assert.equal(formatElapsed(0), '0:00');
  assert.equal(formatElapsed(7.9), '0:07');
  assert.equal(formatElapsed(754), '12:34');
  assert.equal(formatElapsed(3723), '1:02:03');
  assert.equal(formatElapsed(-3), '0:00');
  assert.equal(formatSavedSize(1), 'Less than 0.1 MB saved');
  assert.equal(formatSavedSize(60), 'About 1.9 MB saved');
  assert.equal(formatSavedSize(754), 'About 24 MB saved');

  console.log('capture.test.ts: all tests passed');
}

run();
