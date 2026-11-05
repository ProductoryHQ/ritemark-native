/**
 * #656 — whether a recording has any sound at all, before an engine gets it.
 *
 * Jarmo recorded 236 s from the wrong macOS input: 16 kHz mono with every
 * sample exactly 0. Ritemark sent it to ElevenLabs, which answered "found no
 * speech". A file like that is never sent to an engine, on the device or in
 * the cloud; the panel says what happened instead.
 *
 * "No sound" is dictation's rule (`webview/src/hooks/dictationLevel.ts`): no
 * sample reaches -80 dBFS. Digital silence and a muted microphone (about
 * -92 dBFS) stay under it; the quietest real speech measured (FLEURS) peaks
 * near -42 dBFS, about 40 dB above it. A file with one audible sample anywhere
 * is not silent, so a quiet recording is never refused.
 *
 * Only PCM and float WAV is read (Ritemark's own recordings, and afconvert's
 * output for other formats on the Mac); anything else is `unknown` and goes on
 * as before. The scan stops at the first audible sample, so a normal recording
 * is read for a fraction of a second; only a silent one is read to the end.
 */

import { promises as fsp } from 'fs';
import type { FileHandle } from 'fs/promises';
import { parseWavHeader } from './audioPrep';

/** -80 dBFS, as `MUTED_PEAK` in `webview/src/hooks/dictationLevel.ts`. */
export const SOUND_PEAK = 1e-4;

export type SoundCheck = 'silent' | 'sound' | 'unknown';

const HEADER_BYTES = 64 * 1024;
const BLOCK_BYTES = 1 << 20;
const PCM = 1;
const FLOAT = 3;

/** Reads one sample's magnitude, as a fraction of full scale, at `offset`. */
type Magnitude = (buffer: Buffer, offset: number) => number;

function magnitudeReader(audioFormat: number, bitsPerSample: number): Magnitude | null {
  if (audioFormat === PCM) {
    switch (bitsPerSample) {
      case 8: return (b, o) => Math.abs(b.readUInt8(o) - 128) / 128;
      case 16: return (b, o) => Math.abs(b.readInt16LE(o)) / 32768;
      case 24: return (b, o) => Math.abs(b.readIntLE(o, 3)) / 8388608;
      case 32: return (b, o) => Math.abs(b.readInt32LE(o)) / 2147483648;
      default: return null;
    }
  }
  if (audioFormat === FLOAT) {
    switch (bitsPerSample) {
      case 32: return (b, o) => Math.abs(b.readFloatLE(o));
      case 64: return (b, o) => Math.abs(b.readDoubleLE(o));
      default: return null;
    }
  }
  return null;
}

/**
 * Answers already read, by path, for the file's size and modification time: a silent file is read to its end, and
 * the panel (when the file is staged) and the job (before any engine) both ask. A file that changes is read again.
 */
const checked = new Map<string, { size: number; mtimeMs: number; result: 'silent' | 'sound' }>();
const CHECKED_MAX = 32;

/** Whether a WAV file has any sound (see the file comment). Never throws. */
export async function wavSound(filePath: string): Promise<SoundCheck> {
  let stat: { size: number; mtimeMs: number };
  try {
    stat = await fsp.stat(filePath);
  } catch {
    return 'unknown';
  }
  const known = checked.get(filePath);
  if (known && known.size === stat.size && known.mtimeMs === stat.mtimeMs) return known.result;
  const result = await scanWav(filePath);
  checked.delete(filePath);
  if (result !== 'unknown') {
    checked.set(filePath, { size: stat.size, mtimeMs: stat.mtimeMs, result });
    if (checked.size > CHECKED_MAX) checked.delete(checked.keys().next().value as string);
  }
  return result;
}

async function scanWav(filePath: string): Promise<SoundCheck> {
  let handle: FileHandle | undefined;
  try {
    handle = await fsp.open(filePath, 'r');
    const header = Buffer.alloc(HEADER_BYTES);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const format = parseWavHeader(header.subarray(0, bytesRead));
    const magnitude = magnitudeReader(format.audioFormat, format.bitsPerSample);
    const sampleBytes = format.bitsPerSample / 8;
    if (!magnitude || format.channels < 1) return 'unknown';

    const fileSize = (await handle.stat()).size;
    const onDisk = fileSize - format.dataOffset;
    const declared = format.dataLength > 0 ? format.dataLength : onDisk;
    const frameBytes = sampleBytes * format.channels;
    const total = Math.floor(Math.min(declared, onDisk) / frameBytes) * frameBytes;
    if (total <= 0) return 'unknown';

    const block = Buffer.alloc(Math.floor(BLOCK_BYTES / frameBytes) * frameBytes);
    let done = 0;
    while (done < total) {
      const want = Math.min(block.length, total - done);
      const read = await handle.read(block, 0, want, format.dataOffset + done);
      const usable = Math.floor(read.bytesRead / sampleBytes) * sampleBytes;
      if (usable <= 0) break;
      for (let offset = 0; offset < usable; offset += sampleBytes) {
        if (magnitude(block, offset) >= SOUND_PEAK) return 'sound';
      }
      done += usable;
    }
    return done > 0 ? 'silent' : 'unknown';
  } catch {
    return 'unknown';
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Where the sound input is chosen, by name, or null where Ritemark can't say. */
export function soundSettingsName(platform: NodeJS.Platform): string | null {
  if (platform === 'darwin') return 'System Settings ▸ Sound';
  if (platform === 'win32') return 'Settings ▸ System ▸ Sound';
  return null;
}

/**
 * What the panel says about a silent file. A recording made here adds where
 * the input is chosen, since a wrong or muted input is what records silence.
 */
export function silentRecordingMessage(options: { recordedHere?: boolean; platform?: NodeJS.Platform } = {}): string {
  const said = 'This recording is silent from start to end, so there is nothing to transcribe.';
  const where = options.recordedHere ? soundSettingsName(options.platform ?? process.platform) : null;
  return where ? `${said} Check the input in ${where}, then record again.` : said;
}
