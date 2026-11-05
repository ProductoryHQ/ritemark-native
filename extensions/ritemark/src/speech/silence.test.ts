/**
 * #656 — a recording with no sound is found before any engine gets it.
 *
 * What a user would lose if this were wrong: a silent file sent to ElevenLabs
 * (paid for, and answered "found no speech"), or — worse — a quiet but real
 * recording refused. Every file here is synthetic; no microphone is opened.
 * Run: npx tsx src/speech/silence.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SOUND_PEAK, silentRecordingMessage, soundSettingsName, wavSound } from './silence';

type Format = { audioFormat?: number; bits?: number; channels?: number; rate?: number; extensible?: boolean; listChunk?: number };

/** A WAV with `data` as its samples' bytes, written the way the given format says. */
function wavBytes(data: Buffer, format: Format = {}): Buffer {
  const { audioFormat = 1, bits = 16, channels = 1, rate = 16_000, extensible = false, listChunk = 0 } = format;
  const blockAlign = (bits / 8) * channels;
  const fmt = Buffer.alloc(extensible ? 40 : 16);
  fmt.writeUInt16LE(extensible ? 0xfffe : audioFormat, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * blockAlign, 8);
  fmt.writeUInt16LE(blockAlign, 12);
  fmt.writeUInt16LE(bits, 14);
  if (extensible) {
    fmt.writeUInt16LE(22, 16);
    fmt.writeUInt16LE(bits, 18);
    fmt.writeUInt16LE(audioFormat, 24); // the sub-format GUID starts with the format code
  }
  const chunk = (id: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.write(id, 0, 'ascii');
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const body = Buffer.concat([
    Buffer.from('WAVE', 'ascii'),
    chunk('fmt ', fmt),
    ...(listChunk > 0 ? [chunk('LIST', Buffer.alloc(listChunk, 0x41))] : []),
    chunk('data', data),
  ]);
  const riff = Buffer.alloc(8);
  riff.write('RIFF', 0, 'ascii');
  riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

/** 16-bit mono samples from a generator. */
function pcm16(count: number, sample: (i: number) => number): Buffer {
  const out = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i++) out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample(i)))), i * 2);
  return out;
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

async function run(): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-silence-'));
  const file = (name: string, bytes: Buffer) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, bytes);
    return p;
  };

  try {
    assert.equal(SOUND_PEAK, 1e-4, 'dictation\'s floor: -80 dBFS');

    // Jarmo's file: 236 s of 16 kHz mono, every sample exactly 0.
    const jarmo = file('jarmo-236s.wav', wavBytes(Buffer.alloc(236 * 16_000 * 2)));
    assert.equal(fs.statSync(jarmo).size, 44 + 236 * 32_000);
    assert.equal(await wavSound(jarmo), 'silent', 'all zeros is silent');

    // A low floor: a muted microphone's -92 dBFS rounds to ±1 in 16 bits; ±3 is still under -80 dBFS.
    const random = seeded(3);
    assert.equal(await wavSound(file('muted.wav', wavBytes(pcm16(16_000 * 10, () => Math.round((random() * 2 - 1) * 1))))), 'silent');
    assert.equal(await wavSound(file('floor3.wav', wavBytes(pcm16(16_000 * 10, (i) => (i % 2 ? 3 : -3))))), 'silent', '±3 (-80.8 dBFS) is silent');
    assert.equal(await wavSound(file('floor4.wav', wavBytes(pcm16(16_000 * 10, (i) => (i % 2 ? 4 : -4))))), 'sound', '±4 (-78.3 dBFS) reaches the floor');

    // Real-looking noise: a quiet room through a working microphone, -60 dBFS RMS.
    const room = seeded(9);
    const roomRms = 32768 * 10 ** (-60 / 20);
    const roomNoise = (_i: number) => (room() + room() + room() + room() - 2) * roomRms * Math.sqrt(3);
    assert.equal(await wavSound(file('room.wav', wavBytes(pcm16(16_000 * 5, roomNoise)))), 'sound');

    // One audible sample at the very end of 60 s of zeros: not silent. A quiet recording is never refused.
    const late = pcm16(16_000 * 60, () => 0);
    late.writeInt16LE(-50, late.length - 2);
    assert.equal(await wavSound(file('late.wav', wavBytes(late))), 'sound', 'the whole file is read before it is called silent');

    // Speech-like audio: found in the first block.
    assert.equal(await wavSound(file('tone.wav', wavBytes(pcm16(16_000 * 3, (i) => 8000 * Math.sin(i / 7))))), 'sound');

    // Other writers: a LIST chunk before data, stereo with sound in one channel, 24-bit, 8-bit, float, extensible.
    assert.equal(await wavSound(file('list.wav', wavBytes(Buffer.alloc(32_000), { listChunk: 301 }))), 'silent', 'the chunks are walked');
    const stereo = Buffer.alloc(16_000 * 4);
    stereo.writeInt16LE(9000, 16_000 * 2 + 2); // the right channel, half way in
    assert.equal(await wavSound(file('stereo.wav', wavBytes(stereo, { channels: 2 }))), 'sound');
    assert.equal(await wavSound(file('stereo-silent.wav', wavBytes(Buffer.alloc(16_000 * 4), { channels: 2 }))), 'silent');
    const s24 = Buffer.alloc(16_000 * 3);
    assert.equal(await wavSound(file('s24.wav', wavBytes(s24, { bits: 24 }))), 'silent');
    s24.writeIntLE(-2000, 3000 * 3, 3);
    assert.equal(await wavSound(file('s24-sound.wav', wavBytes(s24, { bits: 24 }))), 'sound');
    assert.equal(await wavSound(file('u8.wav', wavBytes(Buffer.alloc(8000, 128), { bits: 8 }))), 'silent', '8-bit silence is 128');
    assert.equal(await wavSound(file('u8-sound.wav', wavBytes(Buffer.alloc(8000, 140), { bits: 8 }))), 'sound');
    const f32 = Buffer.alloc(16_000 * 4);
    for (let i = 0; i < 16_000; i++) f32.writeFloatLE(5e-5, i * 4);
    assert.equal(await wavSound(file('f32.wav', wavBytes(f32, { audioFormat: 3, bits: 32 }))), 'silent', 'float under the floor');
    f32.writeFloatLE(0.2, 100 * 4);
    assert.equal(await wavSound(file('f32-sound.wav', wavBytes(f32, { audioFormat: 3, bits: 32 }))), 'sound');
    assert.equal(await wavSound(file('ext.wav', wavBytes(Buffer.alloc(32_000), { extensible: true }))), 'silent', 'WAVE_FORMAT_EXTENSIBLE PCM');
    assert.equal(await wavSound(file('ext-f32.wav', wavBytes(f32, { extensible: true, audioFormat: 3, bits: 32 }))), 'sound');

    // Anything it can't read goes on as before: never "silent" by mistake.
    assert.equal(await wavSound(file('garbage.wav', Buffer.from('not a wav file at all, just text'))), 'unknown');
    assert.equal(await wavSound(file('empty-data.wav', wavBytes(Buffer.alloc(0)))), 'unknown', 'no samples is not "silent"');
    assert.equal(await wavSound(file('adpcm.wav', wavBytes(Buffer.alloc(3200), { audioFormat: 2, bits: 4 }))), 'unknown', 'a compressed WAV is not decoded');
    assert.equal(await wavSound(path.join(dir, 'missing.wav')), 'unknown');
    // A header that claims more data than the file holds (an interrupted writer): what is there is read.
    const torn = wavBytes(Buffer.alloc(16_000));
    torn.writeUInt32LE(10_000_000, 40);
    assert.equal(await wavSound(file('torn.wav', torn)), 'silent');
    const unsized = wavBytes(pcm16(800, () => 1200));
    unsized.writeUInt32LE(0, 40);
    assert.equal(await wavSound(file('unsized.wav', unsized)), 'sound', 'a data size of 0 means "to the end of the file"');

    // A silent file is read to its end once: the panel and the job both ask, and the second answer is the first
    // one's while the file's size and time are the same. A file that changes is read again.
    {
      const once = file('once.wav', wavBytes(Buffer.alloc(16_000 * 4)));
      const atime = new Date('2026-11-05T18:00:00Z');
      const mtime = new Date('2026-11-05T18:00:00Z');
      fs.utimesSync(once, atime, mtime);
      assert.equal(await wavSound(once), 'silent');
      const loud = wavBytes(pcm16(16_000 * 2, () => 9000));
      assert.equal(loud.length, fs.statSync(once).size);
      fs.writeFileSync(once, loud);
      fs.utimesSync(once, atime, mtime);
      assert.equal(await wavSound(once), 'silent', 'same size and time: the answer already read, the file not read again');
      fs.utimesSync(once, atime, new Date(mtime.getTime() + 5000));
      assert.equal(await wavSound(once), 'sound', 'a new time: read again');
      fs.writeFileSync(once, wavBytes(Buffer.alloc(16_000 * 6)));
      assert.equal(await wavSound(once), 'silent', 'a new size: read again');
      fs.rmSync(once);
      assert.equal(await wavSound(once), 'unknown', 'a file that went is not answered from memory');
    }

    // The words.
    assert.equal(soundSettingsName('darwin'), 'System Settings ▸ Sound');
    assert.equal(soundSettingsName('win32'), 'Settings ▸ System ▸ Sound');
    assert.equal(soundSettingsName('linux'), null);
    assert.equal(silentRecordingMessage(), 'This recording is silent from start to end, so there is nothing to transcribe.');
    assert.equal(
      silentRecordingMessage({ recordedHere: true, platform: 'darwin' }),
      'This recording is silent from start to end, so there is nothing to transcribe. Check the input in System Settings ▸ Sound, then record again.',
    );
    assert.equal(
      silentRecordingMessage({ recordedHere: true, platform: 'win32' }),
      'This recording is silent from start to end, so there is nothing to transcribe. Check the input in Settings ▸ System ▸ Sound, then record again.',
    );
    assert.equal(silentRecordingMessage({ recordedHere: true, platform: 'linux' }), silentRecordingMessage(), 'no settings named where there are none to name');
    assert.equal(silentRecordingMessage({ recordedHere: false, platform: 'darwin' }), silentRecordingMessage(), 'a file from elsewhere is not about this microphone');

    console.log('silence.test.ts: all tests passed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
