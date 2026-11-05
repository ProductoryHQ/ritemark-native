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
  SilenceWatch,
  StreamingResampler,
  classifyCaptureError,
  inputDeviceName,
  displayPath,
  floatToInt16,
  fullPath,
  shortFolder,
  formatElapsed,
  formatSavedSize,
  int16ToBase64,
} from './capture';

/** A seeded generator, so the noise buffers are the same on every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Gaussian-ish noise at `rmsDbfs` (sum of uniforms), like a room heard by a working microphone. */
function noise(rate: number, seconds: number, rmsDbfs: number, seed = 7): Float32Array {
  const random = seeded(seed);
  const rms = 10 ** (rmsDbfs / 20);
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i++) {
    const g = random() + random() + random() + random() - 2; // variance 1/3
    out[i] = g * rms * Math.sqrt(3);
  }
  return out;
}

/** A hardware-muted microphone: 99% non-zero, but never above 2.6e-5 (about -92 dBFS; dictationLevel.test.ts). */
function mutedFloor(rate: number, seconds: number): Float32Array {
  const random = seeded(11);
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i++) out[i] = (random() * 2 - 1) * 2.6e-5;
  return out;
}

/** Feed a SilenceWatch in ScriptProcessor-sized buffers; returns `silent` after each buffer. */
function watch(w: SilenceWatch, input: Float32Array, rate: number, block = 4096): boolean[] {
  const states: boolean[] = [];
  for (let i = 0; i < input.length; i += block) {
    w.push(input.subarray(i, i + block), rate);
    states.push(w.silent);
  }
  return states;
}

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

  // --- paths short enough for the sidebar
  assert.equal(shortFolder('~/Documents/Recordings'), '~/Documents/Recordings');
  assert.equal(shortFolder('Notes/recordings'), 'Notes/recordings');
  assert.equal(shortFolder('/Volumes/Work'), '/Volumes/Work');
  assert.equal(shortFolder('/private/tmp/claude-501/scratchpad/spike118/voice2'), '…/spike118/voice2');
  assert.equal(shortFolder('~/Library/Mobile Documents/Meetings/2026'), '…/Meetings/2026');
  assert.equal(shortFolder('C:\\Users\\maria\\OneDrive\\Recordings\\2026'), '…\\Recordings\\2026');
  assert.equal(shortFolder('~\\Documents\\Recordings'), '~\\Documents\\Recordings');
  assert.equal(displayPath('Notes/recordings', 'Recording 2026-09-22 14.05.wav'), 'Notes/recordings/Recording 2026-09-22 14.05.wav');
  assert.equal(displayPath('/a/b/c/d/e', 'x.wav'), '…/d/e/x.wav');
  assert.equal(displayPath('D:\\Audio\\Team\\Weekly\\2026', 'x.wav'), '…\\Weekly\\2026\\x.wav');
  assert.equal(fullPath('D:\\Audio', 'x.wav'), 'D:\\Audio\\x.wav');
  assert.equal(fullPath('~/Voice', 'x.wav'), '~/Voice/x.wav');

  // --- #656: no sound from the microphone (synthetic buffers; no microphone is ever opened)
  for (const rate of [16_000, 48_000, 44_100]) {
    // All zeros, as Jarmo's 236 s from the wrong input: silent after 3 s, not before.
    {
      const w = new SilenceWatch();
      const states = watch(w, new Float32Array(rate * 2.9), rate);
      assert.ok(states.every((silent) => !silent), `${rate}: 2.9 s of zeros is not yet "no sound"`);
      watch(w, new Float32Array(Math.ceil(rate * 0.2)), rate);
      assert.equal(w.silent, true, `${rate}: 3 s of zeros is "no sound"`);
      watch(w, new Float32Array(rate * 60), rate);
      assert.equal(w.silent, true, `${rate}: and stays so while the zeros go on`);
    }
    // A low floor: a muted microphone's -92 dBFS is still "no sound".
    {
      const w = new SilenceWatch();
      watch(w, mutedFloor(rate, 4), rate);
      assert.equal(w.silent, true, `${rate}: a muted microphone's floor is "no sound"`);
    }
    // Real-looking noise: a quiet room through a working microphone (-70 and -60 dBFS RMS) is never "no sound".
    for (const level of [-70, -60]) {
      const w = new SilenceWatch();
      const states = watch(w, noise(rate, 30, level), rate);
      assert.ok(states.every((silent) => !silent), `${rate}: room noise at ${level} dBFS RMS is sound`);
    }
    // Speech after silence turns the line off at once; a pause shorter than 3 s never turns it on.
    {
      const w = new SilenceWatch();
      watch(w, new Float32Array(rate * 4), rate);
      assert.equal(w.silent, true);
      assert.equal(w.push(sine(rate, 0.1), rate), true, `${rate}: sound arriving is a change`);
      assert.equal(w.silent, false, `${rate}: sound clears "no sound"`);
      const pause = watch(w, new Float32Array(Math.floor(rate * 2.5)), rate);
      assert.ok(pause.every((silent) => !silent), `${rate}: a 2.5 s pause in speech is not "no sound"`);
      watch(w, sine(rate, 0.05), rate);
      watch(w, new Float32Array(Math.floor(rate * 2.5)), rate);
      assert.equal(w.silent, false, `${rate}: the count starts again after each sound`);
    }
  }
  {
    // `push` reports a change only when `silent` flips, so the panel redraws twice, not on every buffer.
    const w = new SilenceWatch();
    const changes = [
      ...Array.from({ length: 20 }, () => w.push(new Float32Array(4096), 16_000)),
      w.push(sine(16_000, 0.1), 16_000),
      w.push(sine(16_000, 0.1), 16_000),
    ].filter(Boolean).length;
    assert.equal(changes, 2);
  }

  // --- #656: the input's name, from the track's label; nothing rather than a guess
  assert.equal(inputDeviceName('MacBook Pro Microphone (Built-in)'), 'MacBook Pro Microphone');
  assert.equal(inputDeviceName('Default - MacBook Pro Microphone (Built-in)'), 'MacBook Pro Microphone');
  assert.equal(inputDeviceName('Blue Yeti Stereo Microphone (046d:0ab7)'), 'Blue Yeti Stereo Microphone');
  assert.equal(inputDeviceName('BlackHole 2ch (Virtual)'), 'BlackHole 2ch (Virtual)', 'a virtual input says so');
  assert.equal(inputDeviceName('AirPods Pro (Bluetooth)'), 'AirPods Pro (Bluetooth)');
  assert.equal(inputDeviceName('Default - Microphone Array (Realtek(R) Audio)'), 'Microphone Array (Realtek(R) Audio)');
  assert.equal(inputDeviceName('Communications - Headset Microphone (Jabra Evolve 65)'), 'Headset Microphone (Jabra Evolve 65)');
  assert.equal(inputDeviceName('Fake Default Audio Input'), 'Fake Default Audio Input');
  assert.equal(inputDeviceName(''), null, 'no label before permission');
  assert.equal(inputDeviceName('   '), null);
  assert.equal(inputDeviceName('Default'), null, 'a generic name is not a device');
  assert.equal(inputDeviceName(undefined), null);
  assert.equal(inputDeviceName(42), null);

  console.log('capture.test.ts: all tests passed');
}

run();
