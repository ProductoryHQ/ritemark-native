/**
 * Sprint 129 R3/R6/R7 — finding, probing and naming the bundled whisper engine.
 * Run: npx tsx src/voiceDictation/whisperCpp.test.ts
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as path from 'path';
import {
  describeWhisperFailure,
  dictationArgs,
  getWhisperBinaryPath,
  parseDictationStdout,
  probeWhisper,
  resetWhisperProbeCache,
  whisperThreads,
  withFileRetry,
} from './whisperCpp';

const ext = { extensionPath: path.join('/', 'app', 'ritemark') };

/** A spawn stand-in that ends the way `outcome` says, on the next tick. */
function fakeSpawn(outcome: { exit?: [number | null, NodeJS.Signals | null]; error?: string }) {
  const calls: string[][] = [];
  const spawn = ((_file: string, args: string[]) => {
    calls.push(args);
    const child = new EventEmitter() as EventEmitter & { kill: () => boolean };
    child.kill = () => true;
    setImmediate(() => {
      if (outcome.error) child.emit('error', Object.assign(new Error(outcome.error), { code: outcome.error }));
      else child.emit('exit', ...(outcome.exit ?? [0, null]));
    });
    return child;
  }) as unknown as typeof import('child_process').spawn;
  return { spawn, calls };
}

async function run(): Promise<void> {
  // R3: one resolver, never throws, .exe on Windows.
  assert.equal(getWhisperBinaryPath(ext, 'darwin', 'arm64'), path.join(ext.extensionPath, 'binaries', 'darwin-arm64', 'whisper-cli'));
  assert.equal(getWhisperBinaryPath(ext, 'darwin', 'x64'), path.join(ext.extensionPath, 'binaries', 'darwin-x64', 'whisper-cli'));
  assert.equal(getWhisperBinaryPath(ext, 'win32', 'x64'), path.join(ext.extensionPath, 'binaries', 'win32-x64', 'whisper-cli.exe'));
  assert.doesNotThrow(() => getWhisperBinaryPath(ext, 'linux', 'x64'), 'a platform without a build gets a path, not an exception');

  // R9: all logical threads without a GPU (A2); Apple silicon keeps 4.
  assert.equal(whisperThreads('win32', 'x64', 16), 16);
  assert.equal(whisperThreads('darwin', 'x64', 8), 8);
  assert.equal(whisperThreads('darwin', 'arm64', 14), 4);
  assert.equal(whisperThreads('win32', 'x64', 0), 1);
  const args = dictationArgs({ modelPath: 'm', audioPath: 'a.wav', language: 'et', threads: 6 });
  assert.deepEqual(args.slice(0, 6), ['--model', 'm', '--language', 'et', '--threads', '6']);
  assert.equal(args.at(-1), 'a.wav');

  // R6: failures by how they happened.
  assert.equal(describeWhisperFailure({ spawnErrorCode: 'ENOENT' }), 'missing');
  assert.equal(describeWhisperFailure({ spawnErrorCode: 'EACCES' }), 'blocked');
  assert.equal(describeWhisperFailure({ spawnErrorCode: 'EPERM' }), 'blocked');
  assert.equal(describeWhisperFailure({ spawnErrorCode: 'UNKNOWN' }), 'failed');
  assert.equal(describeWhisperFailure({ signal: 'SIGILL' }), 'cpu-unsupported', 'macOS: illegal instruction');
  assert.equal(describeWhisperFailure({ exitCode: 3221225501 }), 'cpu-unsupported', 'Windows: STATUS_ILLEGAL_INSTRUCTION');
  assert.equal(describeWhisperFailure({ exitCode: -1073741795 }), 'cpu-unsupported', 'the same code read as signed');
  assert.equal(describeWhisperFailure({ exitCode: 3221225781 }), 'failed', 'Windows: DLL not found');
  assert.equal(describeWhisperFailure({ exitCode: 1 }), 'failed');
  assert.equal(describeWhisperFailure({ exitCode: null, signal: 'SIGABRT' }), 'failed', 'macOS: dyld refused the binary');

  // Dictation stdout: status lines go, dictated words stay.
  assert.equal(
    parseDictationStdout('whisper_init: loading\nmain: processing x.wav\nWe are processing the data.\n'),
    'We are processing the data.',
    'a sentence with "processing" survives (it used to be dropped)',
  );
  assert.equal(parseDictationStdout('system_info: n_threads = 4\n[00:00:00.000 --> 00:00:02.000] hi\n Tere \n'), 'Tere');
  assert.ok(parseDictationStdout('Oo. Oo. Oo. Oo.').length < 'Oo. Oo. Oo. Oo.'.length, 'the hallucination filter still runs');

  // R3: probe — ready is remembered, failures are explained and briefly remembered.
  resetWhisperProbeCache();
  const ok = fakeSpawn({ exit: [0, null] });
  assert.equal(await probeWhisper('/x/whisper-cli', { spawn: ok.spawn, exists: () => true }), 'ready');
  assert.deepEqual(ok.calls, [['--help']]);
  assert.equal(await probeWhisper('/x/whisper-cli', { spawn: ok.spawn, exists: () => true }), 'ready');
  assert.equal(ok.calls.length, 1, 'ready is not probed twice');

  resetWhisperProbeCache();
  assert.equal(await probeWhisper('/x/whisper-cli', { exists: () => false }), 'missing');

  resetWhisperProbeCache();
  const blocked = fakeSpawn({ error: 'EACCES' });
  assert.equal(await probeWhisper('/x/whisper-cli.exe', { spawn: blocked.spawn, exists: () => true }), 'blocked');
  assert.equal(await probeWhisper('/x/whisper-cli.exe', { spawn: blocked.spawn, exists: () => true }), 'blocked');
  assert.equal(blocked.calls.length, 1, 'a failure is not re-probed on every panel render');

  resetWhisperProbeCache();
  const oldCpu = fakeSpawn({ exit: [3221225501, null] });
  assert.equal(await probeWhisper('/x/whisper-cli.exe', { spawn: oldCpu.spawn, exists: () => true }), 'cpu-unsupported');

  resetWhisperProbeCache();
  const legacyHelp = fakeSpawn({ exit: [1, null] });
  assert.equal(await probeWhisper('/x/whisper-cli', { spawn: legacyHelp.spawn, exists: () => true }), 'ready', '--help exiting 1 still means it runs');

  // R7: the model rename waits out a busy file, and gives up on anything else.
  const busy = (code: string) => Object.assign(new Error(code), { code });
  let attempts = 0;
  const slept: number[] = [];
  const sleep = async (ms: number) => { slept.push(ms); };
  assert.equal(await withFileRetry(() => {
    attempts += 1;
    if (attempts < 3) throw busy('EPERM');
    return 'renamed';
  }, { sleep }), 'renamed');
  assert.equal(attempts, 3);
  assert.deepEqual(slept, [100, 200]);

  await assert.rejects(withFileRetry(() => { throw busy('ENOSPC'); }, { sleep }), /ENOSPC/, 'not a busy error: no retry');
  let tries = 0;
  await assert.rejects(withFileRetry(() => { tries += 1; throw busy('EBUSY'); }, { sleep, totalMs: 1000 }), /EBUSY/);
  assert.ok(tries > 1 && tries < 10, 'gives up once the time budget is spent');

  console.log('whisperCpp.test.ts: all tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
