/**
 * Sprint 129 R8/R6 — dictation keeps every word and stops with a reason.
 * R12 — "speak, then text": nothing goes in until Stop, then all of it.
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
  dictationProblemFor,
  audioLevel,
  parsePcmWav,
  type AudioLevel,
} from './controller';
import type { DictationMode, TranscriptionResult } from './whisperCpp';

const BYTES_PER_SECOND = 32000;
/** Clearly voiced audio, and silence, for tests that are not about the level check. */
const LOUD: AudioLevel = { audible: 50, voiced: 50 };
const SILENT: AudioLevel = { audible: 0, voiced: 0 };
const WEAK: AudioLevel = { audible: 20, voiced: 2 };

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

function harness(overrides: { modelExists?: boolean; mode?: DictationMode; recallCallMs?: number; modelPath?: string; callMs?: number; audioLevel?: (pcm: Buffer) => AudioLevel } = {}) {
  const messages: Array<Record<string, unknown>> = [];
  const notices: string[] = [];
  const calls: Call[] = [];
  const state = { autoFinish: false };
  let waiting: (() => void) | null = null;
  let clock = 0;
  const remembered: number[] = [];
  const controller = new DictationController(
    { postMessage: async (message: unknown) => { messages.push(message as Record<string, unknown>); return true; } },
    { extensionPath: '/nowhere' },
    {
      binaryPath: () => '/nowhere/whisper-cli',
      modelPath: () => overrides.modelPath ?? '/nowhere/model.bin',
      modelExists: () => overrides.modelExists ?? true,
      notify: (message) => { notices.push(message); },
      mode: overrides.mode ?? 'live',
      recallCallMs: () => overrides.recallCallMs,
      rememberCallMs: (ms) => { remembered.push(ms); },
      // Every call "takes" callMs: the clock moves on when a call starts.
      now: () => clock,
      // The tagged test audio is not speech-like; the speech check has its own tests.
      audioLevel: overrides.audioLevel ?? (() => LOUD),
      transcribe: (wav) => new Promise<TranscriptionResult>((resolve) => {
        clock += overrides.callMs ?? 0;
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
  const problems = () => messages.filter(m => m.type === 'dictation:problem').map(m => m.problem);
  const statuses = () => messages.filter(m => m.type === 'dictation:status').map(m => m.status);
  return { controller, messages, notices, calls, state, callStarted, texts, problems, statuses, remembered };
}

function ok(text: string): TranscriptionResult {
  return { success: true, text };
}

async function run(): Promise<void> {
  // R6: which dialog each engine result calls for.
  assert.equal(dictationProblemFor('missing', 'win32', 'x64'), 'engine-missing');
  assert.equal(dictationProblemFor('missing', 'linux', 'x64'), 'engine-unavailable', 'no build for this computer');
  assert.equal(dictationProblemFor('blocked', 'win32', 'x64'), 'engine-blocked');
  assert.equal(dictationProblemFor('cpu-unsupported'), 'engine-cpu');
  assert.equal(dictationProblemFor('failed'), 'engine-failed');

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
    assert.deepEqual(h.notices, [BACKLOG_NOTICE], 'a toast, not the dialog');
    assert.ok(h.messages.some(m => m.type === 'dictation:stop-capture'), 'the webview is told to stop the microphone');
    assert.deepEqual(h.problems(), []);
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
    assert.deepEqual(h.problems(), ['engine-cpu']);
    assert.equal(h.controller.isActive(), false);
  }

  // The model was removed mid-session.
  {
    const h = harness({ modelExists: false });
    h.controller.startDictation('en');
    await h.controller.handleAudioChunk(chunk(5, 1));
    assert.deepEqual(h.problems(), ['model-missing']);
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
      { modelPath: () => model, notify: () => undefined, mode: 'live', audioLevel: () => LOUD },
    );
    controller.startDictation('en');
    await controller.handleAudioChunk(chunk(5, 1));
    const problem = messages.find(m => m.type === 'dictation:problem');
    assert.ok(problem, 'the dialog is shown');
    assert.ok(['engine-missing', 'engine-unavailable'].includes(String(problem!.problem)));
    fs.rmSync(empty, { recursive: true, force: true });
  }

  // Live: Stop says the last words are on their way, without an estimate.
  {
    const h = harness();
    h.controller.startDictation('en');
    void h.controller.handleAudioChunk(chunk(3, 1));
    await h.callStarted(1);
    const stopped = h.controller.stopDictation();
    const finishing = h.messages.find(m => m.status === 'finishing');
    assert.ok(finishing, 'finishing while the last call runs');
    assert.equal(finishing!.waitSeconds, undefined, 'live mode gives no estimate');
    h.calls[0].finish(ok('done'));
    await stopped;
    assert.equal(h.messages.at(-1)?.status, 'idle');
  }

  // A Stop with nothing to do still answers idle, without "finishing".
  {
    const h = harness();
    await h.controller.stopDictation();
    assert.deepEqual(h.statuses(), ['idle']);
  }

  // R12: nothing is inserted while recording; 28 s pieces run in the background;
  // after Stop the rest is transcribed and all text goes in at once, in order.
  {
    const h = harness({ mode: 'deferred', callMs: 21_000 });
    h.controller.startDictation('et');
    for (let tag = 1; tag <= 5; tag += 1) void h.controller.handleAudioChunk(chunk(5, tag)); // 25 s
    assert.equal(h.calls.length, 0, 'less than a piece: nothing runs yet');
    void h.controller.handleAudioChunk(chunk(5, 6)); // 30 s: one full piece
    await h.callStarted(1);
    assert.equal(contents(h.calls[0].wav), '1:5s 2:5s 3:5s 4:5s 5:5s 6:3s');
    h.calls[0].finish(ok('esimene osa'));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.texts(), [], 'held while the user speaks');
    void h.controller.handleAudioChunk(chunk(4, 7)); // the final chunk, then Stop
    const stopped = h.controller.stopDictation();
    await h.callStarted(2);
    assert.equal(contents(h.calls[1].wav), '6:2s 7:4s', 'the rest, exactly where the piece stopped');
    h.calls[1].finish(ok('teine osa'));
    await stopped;
    assert.deepEqual(h.texts(), ['esimene osa teine osa'], 'one insertion after Stop');
    assert.ok(!h.statuses().includes('processing'), 'never "processing" while the user speaks');
    assert.deepEqual(h.statuses(), ['listening', 'finishing', 'idle']);
    assert.equal(h.messages.find(m => m.status === 'finishing')!.waitSeconds, 30, 'last call 21 s, rounded up to 10 s');
    assert.deepEqual(h.remembered, [21_000, 21_000], 'each call is remembered for the next estimate');
  }

  // R12: the estimate comes from an earlier session, and counts the call still running.
  {
    const h = harness({ mode: 'deferred', recallCallMs: 22_000 });
    h.controller.startDictation('et');
    for (let i = 0; i < 6; i += 1) void h.controller.handleAudioChunk(chunk(5, 1)); // 30 s
    await h.callStarted(1);
    void h.controller.handleAudioChunk(chunk(5, 2));
    const stopped = h.controller.stopDictation();
    assert.equal(h.messages.find(m => m.status === 'finishing')!.waitSeconds, 50, 'running call + one more: 44 s, shown as 50');
    h.state.autoFinish = true;
    h.calls[0].finish(ok('a'));
    await stopped;
    assert.deepEqual(h.texts(), ['a t2']);
  }

  // R12: before anything was measured, no number.
  {
    const h = harness({ mode: 'deferred' });
    h.state.autoFinish = true;
    h.controller.startDictation('et');
    void h.controller.handleAudioChunk(chunk(3, 1));
    await h.controller.stopDictation();
    assert.equal(h.messages.find(m => m.status === 'finishing')!.waitSeconds, null, 'null: nothing measured yet');
    assert.deepEqual(h.texts(), ['t1']);
  }

  // R12: no "can't keep up" stop when nothing is live; a slow computer only waits longer.
  {
    const h = harness({ mode: 'deferred' });
    h.controller.startDictation('et');
    for (let i = 0; i < 20; i += 1) void h.controller.handleAudioChunk(chunk(5, 1)); // 100 s
    await h.callStarted(1);
    assert.deepEqual(h.notices, []);
    assert.ok(!h.messages.some(m => m.type === 'dictation:stop-capture'));
    h.state.autoFinish = true;
    h.calls[0].finish(ok('t1'));
    await h.controller.stopDictation();
    const transcribed = h.calls.reduce((sum, call) => sum + parsePcmWav(call.wav)!.length, 0);
    assert.equal(transcribed, 100 * BYTES_PER_SECOND, 'every second transcribed');
    assert.equal(h.texts().length, 1);
  }

  // R12: if the engine fails part-way, what was transcribed goes in before the dialog.
  {
    const h = harness({ mode: 'deferred' });
    h.controller.startDictation('et');
    for (let i = 0; i < 12; i += 1) void h.controller.handleAudioChunk(chunk(5, 1)); // 60 s
    await h.callStarted(1);
    h.calls[0].finish(ok('jõudsin öelda'));
    await h.callStarted(2);
    h.calls[1].finish({ success: false, text: '', error: 'exit 1', failure: 'failed' });
    await new Promise(resolve => setImmediate(resolve));
    const order = h.messages.filter(m => m.type !== 'dictation:status').map(m => m.type);
    assert.deepEqual(order, ['dictation:transcription', 'dictation:problem']);
    assert.deepEqual(h.texts(), ['jõudsin öelda']);
  }

  // QA B1: a transcriber that throws (a full disk, a process that can't start)
  // stops dictation with a reason, and Stop still answers idle.
  for (const mode of ['live', 'deferred'] as const) {
    const messages: Array<Record<string, unknown>> = [];
    const controller = new DictationController(
      { postMessage: async (message: unknown) => { messages.push(message as Record<string, unknown>); return true; } },
      { extensionPath: '/nowhere' },
      {
        binaryPath: () => '/nowhere/whisper-cli', modelPath: () => '/nowhere/model.bin', modelExists: () => true,
        notify: () => undefined, mode, recallCallMs: () => undefined, rememberCallMs: () => undefined, now: () => 0, audioLevel: () => LOUD,
        transcribe: async () => { throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }); },
      },
    );
    controller.startDictation('et');
    await controller.handleAudioChunk(chunk(mode === 'deferred' ? 30 : 5, 1));
    await controller.stopDictation();
    assert.deepEqual(messages.filter(m => m.type === 'dictation:problem').map(m => m.problem), ['engine-failed'], `${mode}: the dialog explains`);
    assert.equal(messages.at(-1)?.status, 'idle', `${mode}: Stop still answers idle`);
    assert.equal(controller.isActive(), false);
  }

  // Failed calls do not feed the wait estimate.
  {
    const h = harness({ mode: 'deferred', callMs: 500, recallCallMs: 21_000 });
    h.controller.startDictation('et');
    for (let i = 0; i < 6; i += 1) void h.controller.handleAudioChunk(chunk(5, 1)); // 30 s
    await h.callStarted(1);
    h.calls[0].finish({ success: false, text: '', error: 'exit 1' }); // a quick failure, no engine problem
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.remembered, [], 'a failed call is not remembered');
    h.state.autoFinish = true;
    void h.controller.handleAudioChunk(chunk(3, 2));
    const stopped = h.controller.stopDictation();
    assert.equal(h.messages.find(m => m.status === 'finishing')!.waitSeconds, 30, 'still the earlier 21 s, rounded');
    await stopped;
  }

  // Windows test, bug C: the level check, against measured levels.
  {
    const tone = (seconds: number, amplitude: number) => {
      const b = Buffer.alloc(seconds * BYTES_PER_SECOND);
      for (let i = 0; i < seconds * 16000; i += 1) b.writeInt16LE(Math.round(Math.sin(i / 8) * amplitude), i * 2);
      return b;
    };
    const noise = (seconds: number, amplitude: number) => {
      const b = Buffer.alloc(seconds * BYTES_PER_SECOND);
      for (let i = 0; i < seconds * 16000; i += 1) b.writeInt16LE(Math.round((Math.random() * 2 - 1) * amplitude), i * 2);
      return b;
    };
    assert.deepEqual(audioLevel(Buffer.alloc(28 * BYTES_PER_SECOND)), { audible: 0, voiced: 0 }, 'zeros');
    assert.equal(audioLevel(noise(10, 1)).audible, 0, 'a hardware-muted mic (about -92 dBFS)');
    const hiss = audioLevel(noise(10, 60));
    assert.ok(hiss.audible > 0 && hiss.voiced === 0, 'faint hiss (about -60 dBFS) is audible but not voiced');
    // FLEURS: the quietest real speech peaks near -49 dBFS RMS; a -48 dBFS tone stands in for it.
    assert.ok(audioLevel(tone(2, 170)).voiced >= 10, 'quiet speech is voiced (a -40 dBFS bar would have dropped it)');
  }

  // Bug C: silent audio is never transcribed, and Stop says nothing was heard.
  for (const mode of ['live', 'deferred'] as const) {
    const h = harness({ mode, audioLevel: () => SILENT });
    h.controller.startDictation('et');
    for (let i = 0; i < 7; i += 1) void h.controller.handleAudioChunk(chunk(5, 1)); // 35 s
    await h.controller.stopDictation();
    assert.equal(h.calls.length, 0, `${mode}: no whisper call for silence`);
    assert.deepEqual(h.texts(), [], `${mode}: nothing invented`);
    assert.deepEqual(h.problems(), ['mic-silent'], `${mode}: "Ritemark heard nothing"`);
    assert.equal(h.messages.at(-1)?.status, 'idle');
  }

  // Bug C (re-test): weak audio that comes out as whisper's silence phrase is dropped,
  // and counts as nothing heard; real words from quiet speech stay.
  {
    const h = harness({ mode: 'deferred', audioLevel: () => WEAK });
    h.controller.startDictation('et');
    void h.controller.handleAudioChunk(chunk(12, 1));
    const stopped = h.controller.stopDictation();
    await h.callStarted(1);
    h.calls[0].finish(ok('Kõige! Kõige!'));
    await stopped;
    assert.deepEqual(h.texts(), [], '"Kõige! Kõige!" from a muted mic is not inserted');
    assert.deepEqual(h.problems(), ['mic-silent']);
  }
  {
    const h = harness({ mode: 'deferred', audioLevel: () => WEAK });
    h.state.autoFinish = true;
    h.controller.startDictation('et');
    void h.controller.handleAudioChunk(chunk(5, 1));
    h.state.autoFinish = false;
    const stopped = h.controller.stopDictation();
    await h.callStarted(1);
    h.calls[0].finish(ok('Tere hommikust.'));
    await stopped;
    assert.deepEqual(h.texts(), ['Tere hommikust.'], 'quiet real speech stays');
    assert.deepEqual(h.problems(), []);
  }
  {
    const h = harness({ mode: 'deferred' });
    h.controller.startDictation('en');
    void h.controller.handleAudioChunk(chunk(5, 1));
    const stopped = h.controller.stopDictation();
    await h.callStarted(1);
    h.calls[0].finish(ok('Thank you.'));
    await stopped;
    assert.deepEqual(h.texts(), ['Thank you.'], 'a clearly spoken "Thank you." stays');
  }

  // Bug C: pauses between sentences are skipped, speech is transcribed, no "heard nothing".
  {
    let n = 0;
    const h = harness({ audioLevel: () => ((n += 1) % 2 === 1 ? LOUD : SILENT) });
    h.state.autoFinish = true;
    h.controller.startDictation('et');
    for (let i = 0; i < 4; i += 1) await h.controller.handleAudioChunk(chunk(5, i + 1));
    await h.controller.stopDictation();
    assert.equal(h.calls.length, 2, 'only the chunks with speech');
    assert.deepEqual(h.problems(), []);
  }

  // Bug D: an engine failure after recording says when it happened.
  {
    const h = harness({ mode: 'deferred' });
    h.controller.startDictation('en');
    void h.controller.handleAudioChunk(chunk(3, 1));
    const stopped = h.controller.stopDictation();
    await h.callStarted(1);
    h.calls[0].finish({ success: false, text: '', error: 'Whisper binary not found', failure: 'missing' });
    await stopped;
    const problem = h.messages.find(m => m.type === 'dictation:problem')!;
    assert.equal(problem.problem, 'engine-missing');
    assert.equal(problem.stage, 'transcribing', 'the dialog says "Dictation Stopped"');
  }

  // The running call counts only with what is left of it.
  {
    const h = harness({ mode: 'deferred', recallCallMs: 20_000, callMs: 0 });
    h.controller.startDictation('et');
    for (let i = 0; i < 6; i += 1) void h.controller.handleAudioChunk(chunk(5, 1)); // a 28 s piece starts
    await h.callStarted(1);
    void h.controller.handleAudioChunk(chunk(5, 2));
    const stopped = h.controller.stopDictation(); // running call just started: 20 s left + 1 queued call
    assert.equal(h.messages.find(m => m.status === 'finishing')!.waitSeconds, 40);
    h.state.autoFinish = true;
    h.calls[0].finish(ok('a'));
    await stopped;
  }

  // R13: the model dialog names the size of the model this computer uses.
  {
    const h = harness({ modelExists: false, modelPath: '/nowhere/ggml-large-v3-turbo-q8_0.bin' });
    h.controller.startDictation('en');
    await h.controller.handleAudioChunk(chunk(5, 1));
    assert.equal(h.messages.find(m => m.type === 'dictation:problem')?.detail, '834 MB');
  }

  console.log('controller.test.ts: all tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
