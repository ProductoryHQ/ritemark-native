/**
 * Sprint 129 R8/R6 — dictation keeps every word and stops with a reason.
 * Run: npx tsx src/voiceDictation/controller.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  BACKLOG_NOTICE,
  BACKLOG_STOP_SECONDS,
  DictationController,
  MAX_CALL_SECONDS,
  buildPcmWav,
  parsePcmWav,
} from './controller';
import type { TranscriptionResult } from './whisperCpp';

const BYTES_PER_SECOND = 32000;

/** `seconds` of PCM whose every byte is `tag`, so a call's contents show its order. */
function pcm(seconds: number, tag: number): Buffer {
  return Buffer.alloc(seconds * BYTES_PER_SECOND, tag);
}

function chunk(seconds: number, tag: number): string {
  return buildPcmWav(pcm(seconds, tag)).toString('base64');
}

/** The distinct tags in a call, in order, with seconds of each. */
function contents(wav: Buffer): string {
  const data = parsePcmWav(wav)!;
  const runs: string[] = [];
  let start = 0;
  for (let i = 1; i <= data.length; i += 1) {
    if (i === data.length || data[i] !== data[start]) {
      runs.push(`${data[start]}:${(i - start) / BYTES_PER_SECOND}s`);
      start = i;
    }
  }
  return runs.join(' ');
}

interface Call { wav: Buffer; finish: (result: TranscriptionResult) => void }

function harness(overrides: { modelExists?: boolean } = {}) {
  const messages: Array<Record<string, unknown>> = [];
  const calls: Call[] = [];
  const state = { autoFinish: false };
  let waiting: (() => void) | null = null;
  const controller = new DictationController(
    { postMessage: async (message: unknown) => { messages.push(message as Record<string, unknown>); return true; } },
    { extensionPath: '/nowhere' },
    {
      binaryPath: () => '/nowhere/whisper-cli',
      modelPath: () => '/nowhere/model.bin',
      modelExists: () => overrides.modelExists ?? true,
      transcribe: (wav) => new Promise<TranscriptionResult>((resolve) => {
        calls.push({ wav, finish: resolve });
        if (state.autoFinish) resolve(ok(`t${calls.length}`));
        waiting?.();
      }),
    },
  );
  /** Resolves once the controller has started call number `n` (1-based). */
  const callStarted = (n: number) => new Promise<void>((resolve) => {
    const check = () => { if (calls.length >= n) { waiting = null; resolve(); } };
    waiting = check;
    check();
  });
  const texts = () => messages.filter(m => m.type === 'dictation:transcription').map(m => m.text);
  const errors = () => messages.filter(m => m.type === 'dictation:error').map(m => m.error);
  return { controller, messages, calls, state, callStarted, texts, errors };
}

function ok(text: string): TranscriptionResult {
  return { success: true, text };
}

async function run(): Promise<void> {
  // WAV in and out.
  const round = parsePcmWav(buildPcmWav(pcm(1, 7)));
  assert.equal(round?.length, BYTES_PER_SECOND);
  const stereo = buildPcmWav(pcm(1, 1));
  stereo.writeUInt16LE(2, 22);
  assert.equal(parsePcmWav(stereo), null, 'stereo is refused');
  const cd = buildPcmWav(pcm(1, 1));
  cd.writeUInt32LE(44100, 24);
  assert.equal(parsePcmWav(cd), null, '44.1 kHz is refused');
  assert.equal(parsePcmWav(Buffer.from('not a wav at all')), null);
  const withList = Buffer.concat([
    Buffer.from('RIFF\0\0\0\0WAVE', 'ascii'),
    buildPcmWav(pcm(1, 5)).subarray(12, 36),             // fmt chunk
    Buffer.from('LIST\x04\0\0\0abcd', 'latin1'),          // an extra chunk before data
    buildPcmWav(pcm(1, 5)).subarray(36),                  // data chunk
  ]);
  assert.equal(parsePcmWav(withList)?.length, BYTES_PER_SECOND, 'extra chunks before data are skipped');

  // Audio that arrives while busy waits and is joined, in order; nothing is dropped.
  {
    const h = harness();
    h.controller.startDictation('et');
    void h.controller.handleAudioChunk(chunk(5, 1));
    await h.callStarted(1);
    void h.controller.handleAudioChunk(chunk(5, 2));
    void h.controller.handleAudioChunk(chunk(5, 3));
    assert.equal(h.calls.length, 1, 'no second process while the first runs');
    h.calls[0].finish(ok('üks'));
    await h.callStarted(2);
    assert.equal(contents(h.calls[1].wav), '2:5s 3:5s', 'the waiting chunks become one call, in order');
    h.calls[1].finish(ok('kaks kolm'));
    await h.controller.stopDictation();
    assert.deepEqual(h.texts(), ['üks', 'kaks kolm']);
    assert.equal(h.messages.at(-1)?.status, 'idle');
  }

  // One call never exceeds MAX_CALL_SECONDS; the rest waits for the next one.
  {
    const h = harness();
    h.controller.startDictation('en');
    void h.controller.handleAudioChunk(chunk(5, 1));
    await h.callStarted(1);
    for (let tag = 2; tag <= 8; tag += 1) void h.controller.handleAudioChunk(chunk(5, tag)); // 35 s waiting
    h.calls[0].finish(ok('a'));
    await h.callStarted(2);
    assert.equal(parsePcmWav(h.calls[1].wav)!.length, MAX_CALL_SECONDS * BYTES_PER_SECOND);
    assert.equal(contents(h.calls[1].wav), '2:5s 3:5s 4:5s 5:5s 6:5s 7:3s');
    h.calls[1].finish(ok('b'));
    await h.callStarted(3);
    assert.equal(contents(h.calls[2].wav), '7:2s 8:5s', 'the split chunk continues exactly where it stopped');
    h.calls[2].finish(ok('c'));
    await h.controller.stopDictation();
    assert.deepEqual(h.texts(), ['a', 'b', 'c']);
  }

  // Stop keeps the last words: the final chunk is transcribed before idle.
  {
    const h = harness();
    h.controller.startDictation('en');
    void h.controller.handleAudioChunk(chunk(5, 1));
    await h.callStarted(1);
    void h.controller.handleAudioChunk(chunk(2, 9)); // the webview's final chunk, sent just before stop
    const stopped = h.controller.stopDictation();
    h.calls[0].finish(ok('first'));
    await h.callStarted(2);
    assert.equal(contents(h.calls[1].wav), '9:2s');
    h.calls[1].finish(ok('last words'));
    await stopped;
    assert.deepEqual(h.texts(), ['first', 'last words']);
    assert.equal(h.messages.at(-1)?.status, 'idle', 'idle only after the last text');
    void h.controller.handleAudioChunk(chunk(5, 4));
    assert.equal(h.calls.length, 2, 'audio after stop is ignored');
  }

  // A computer far too slow: stop listening, but insert everything captured.
  {
    const h = harness();
    h.controller.startDictation('en');
    void h.controller.handleAudioChunk(chunk(5, 1));
    await h.callStarted(1);
    const chunks = Math.floor(BACKLOG_STOP_SECONDS / 5) + 1; // just over the limit
    for (let i = 0; i < chunks; i += 1) void h.controller.handleAudioChunk(chunk(5, 2));
    assert.deepEqual(h.errors(), [BACKLOG_NOTICE]);
    void h.controller.handleAudioChunk(chunk(5, 3));
    h.state.autoFinish = true;
    h.calls[0].finish(ok('t1'));
    await h.controller.stopDictation();
    const transcribed = h.calls.slice(1).reduce((sum, call) => sum + parsePcmWav(call.wav)!.length, 0);
    assert.equal(transcribed, chunks * 5 * BYTES_PER_SECOND, 'every captured second was transcribed');
    assert.ok(!h.calls.some(call => contents(call.wav).includes('3:')), 'nothing after the stop was taken');
    assert.equal(h.texts().length, h.calls.length, 'each call inserted its text');
  }

  // R6: an engine that cannot run stops dictation with words.
  {
    const h = harness();
    h.controller.startDictation('en');
    void h.controller.handleAudioChunk(chunk(5, 1));
    await h.callStarted(1);
    void h.controller.handleAudioChunk(chunk(5, 2));
    h.calls[0].finish({ success: false, text: '', error: 'exit 3221225501', failure: 'cpu-unsupported' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.calls.length, 1, 'waiting audio is not sent to a broken engine');
    assert.match(String(h.errors()[0]), /newer processor/);
    assert.equal(h.controller.isActive(), false);
  }

  // The model was removed mid-session.
  {
    const h = harness({ modelExists: false });
    h.controller.startDictation('en');
    await h.controller.handleAudioChunk(chunk(5, 1));
    assert.match(String(h.errors()[0]), /Speech model not downloaded/);
    assert.equal(h.calls.length, 0);
  }

  // The silent failure on Intel Macs (audit §4): no engine for this computer
  // used to mean "listening" forever. With the real transcriber and no binary,
  // dictation now stops and says why.
  {
    const messages: Array<Record<string, unknown>> = [];
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'dictation-no-engine-'));
    const model = path.join(empty, 'model.bin');
    fs.writeFileSync(model, 'x');
    const controller = new DictationController(
      { postMessage: async (message: unknown) => { messages.push(message as Record<string, unknown>); return true; } },
      { extensionPath: empty },
      { modelPath: () => model },
    );
    controller.startDictation('en');
    await controller.handleAudioChunk(chunk(5, 1));
    const error = messages.find(m => m.type === 'dictation:error');
    assert.ok(error, 'an error is shown');
    assert.match(String(error!.error), /missing from this installation|not available on this computer/);
    fs.rmSync(empty, { recursive: true, force: true });
  }

  console.log('controller.test.ts: all tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
