/**
 * Sprint 108 R1/R4 — how long is this recording?
 *
 * Needed BEFORE transcription, because the ElevenLabs confirm step has to state
 * the duration and the estimated cost (N7). Deliberately returns `null` rather
 * than guessing: "length unknown" is honest, an invented number on a spend
 * decision is not.
 *
 * Two sources, in order:
 *   1. `afinfo` — a macOS system binary that reads every format we accept.
 *   2. The WAV header — cross-platform, and the only path Windows has.
 *
 * On Windows with a compressed file this returns null, and the cost line falls
 * back to the hourly rate without a total. That is a real gap; closing it would
 * mean parsing MP4 `mvhd` and MP3 frame headers by hand, which is not worth it
 * while ElevenLabs reports the true duration back to us after the upload.
 */

import * as childProcess from 'child_process';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { parseWavHeader } from './audioPrep';

/** `estimated duration: 113.024000 sec` */
export function parseAfinfoDuration(output: string): number | null {
  const match = /estimated duration:\s*([\d.]+)\s*sec/i.exec(output);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function afinfoDuration(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const child = childProcess.spawn('/usr/bin/afinfo', [filePath], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let stdout = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    child.on('error', () => resolve(null));
    child.on('exit', () => resolve(parseAfinfoDuration(stdout)));

    // afinfo is a metadata read; if it has not answered in five seconds
    // something is wrong with the file and "unknown" is the right answer.
    setTimeout(() => {
      child.kill();
      resolve(null);
    }, 5000);
  });
}

async function wavHeaderDuration(filePath: string): Promise<number | null> {
  let handle;
  try {
    handle = await fsp.open(filePath, 'r');
    const header = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const format = parseWavHeader(header.subarray(0, bytesRead));
    const bytesPerSecond = format.sampleRate * format.channels * (format.bitsPerSample / 8);
    if (!bytesPerSecond) return null;

    const dataLength = format.dataLength || (await handle.stat()).size - format.dataOffset;
    const seconds = dataLength / bytesPerSecond;
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

/** Duration in seconds, or null when it genuinely cannot be determined. */
export async function probeDurationSec(filePath: string): Promise<number | null> {
  if (process.platform === 'darwin') {
    const fromAfinfo = await afinfoDuration(filePath);
    if (fromAfinfo !== null) return fromAfinfo;
  }
  if (path.extname(filePath).toLowerCase() === '.wav') {
    return wavHeaderDuration(filePath);
  }
  return null;
}
