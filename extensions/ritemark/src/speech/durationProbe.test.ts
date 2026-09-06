/**
 * Sprint 108 R4 — duration probing.
 *
 * The load-bearing behaviour is the NULL: a cost estimate shown before an
 * upload must never be invented, so "unknown" has to survive all the way out
 * rather than being rounded to zero somewhere.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseAfinfoDuration, probeDurationSec } from './durationProbe';

/** 16 kHz mono 16-bit WAV of a known length. */
function writeWav(filePath: string, seconds: number): void {
  const sampleRate = 16000;
  const sampleCount = Math.round(sampleRate * seconds);
  const data = Buffer.alloc(sampleCount * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(filePath, Buffer.concat([header, data]));
}

async function run(): Promise<void> {
  // ── afinfo output parsing ──

  assert.equal(
    parseAfinfoDuration(
      [
        'File:           /tmp/call.m4a',
        'File type ID:   m4af',
        'Data format:     1 ch,  44100 Hz, aac',
        'estimated duration: 113.024000 sec',
        'audio bytes: 1449984',
      ].join('\n'),
    ),
    113.024,
  );

  assert.equal(parseAfinfoDuration('estimated duration: 3634.5 sec'), 3634.5);
  assert.equal(parseAfinfoDuration('File: /tmp/x.m4a\nno duration here'), null);
  assert.equal(parseAfinfoDuration(''), null);
  assert.equal(parseAfinfoDuration('estimated duration: 0.000000 sec'), null, 'a zero-length file is not a duration');
  assert.equal(parseAfinfoDuration('estimated duration: abc sec'), null);

  // ── real files ──

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-duration-'));
  try {
    const wavPath = path.join(dir, 'five.wav');
    writeWav(wavPath, 5);

    const seconds = await probeDurationSec(wavPath);
    assert.ok(seconds !== null, 'a WAV always has a readable duration, on any platform');
    assert.ok(Math.abs(seconds - 5) < 0.05, `expected ~5s, got ${seconds}`);

    // Unreadable input yields null rather than a throw — the caller shows
    // "length unknown" and the flow continues.
    const junk = path.join(dir, 'junk.wav');
    fs.writeFileSync(junk, 'this is not a wav file');
    assert.equal(await probeDurationSec(junk), null);

    assert.equal(await probeDurationSec(path.join(dir, 'missing.wav')), null, 'a missing file is unknown, not fatal');

    const unknownFormat = path.join(dir, 'notes.txt');
    fs.writeFileSync(unknownFormat, 'hello');
    assert.equal(await probeDurationSec(unknownFormat), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('durationProbe.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
