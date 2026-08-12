/**
 * Sprint 108 R5 — audio preparation, host-side.
 *
 * Audit A1 (research/audio-transfer-audit.md) killed the original design. The
 * bundled whisper-cli decodes mp3/wav/flac/ogg itself, so those formats are
 * passed straight through; only m4a/aac need converting, and macOS `afconvert`
 * does that in ~1.2s for a 60-minute file. Nothing decodes in the webview and
 * no audio bytes cross the bridge.
 */

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { TranscriptionError } from './types';

/** Formats we accept from the user. */
export const AUDIO_EXTENSIONS = ['.m4a', '.mp3', '.wav', '.flac', '.ogg', '.aac'];

/**
 * Rejected with guidance rather than silently failing (D6): shipping ffmpeg
 * would add tens of megabytes and a new notarisation surface.
 */
export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'];

/** Sample rate whisper.cpp wants. */
const ENGINE_SAMPLE_RATE = 16000;
/** Lower rate is plenty for drawing ~2000 buckets, and halves the bytes read. */
const PEAKS_SAMPLE_RATE = 8000;

export const DEFAULT_PEAK_BUCKETS = 2000;

export type InputKind = 'audio' | 'video' | 'unsupported';

export function classifyInput(filePath: string): InputKind {
  const ext = path.extname(filePath).toLowerCase();
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return 'unsupported';
}

/** Throws a coded, user-facing error for anything we cannot transcribe. */
export function assertSupportedInput(filePath: string): void {
  const kind = classifyInput(filePath);
  if (kind === 'audio') return;

  if (kind === 'video') {
    throw new TranscriptionError(
      'video-not-supported',
      'Video files are not supported yet. Export the audio track as .m4a or .mp3 and try again.',
    );
  }
  throw new TranscriptionError(
    'unsupported-format',
    `${path.extname(filePath) || 'That file type'} is not an audio format Ritemark can read. Supported: ${AUDIO_EXTENSIONS.join(', ')}.`,
  );
}

/** `afconvert` is a macOS system binary; Windows has neither it nor a local engine. */
export function canConvertLocally(): boolean {
  return process.platform === 'darwin' && fs.existsSync('/usr/bin/afconvert');
}

export interface PreparedAudio {
  /** What the engine should read. */
  path: string;
  /** True when `path` is a temp file the caller must clean up. */
  isTemp: boolean;
  /**
   * A 16 kHz mono WAV suitable for peak extraction, when one exists. Null on
   * platforms that cannot convert (Windows), where the player falls back to a
   * plain seek bar instead of a waveform.
   */
  wavForPeaks: string | null;
}

/**
 * Get the audio into a shape the engine accepts.
 *
 * `accepts` comes from the engine, so the cloud engine (which takes the
 * original file) never triggers a conversion.
 */
export async function prepareAudio(options: {
  sourcePath: string;
  accepts: string[];
  workDir: string;
  jobId: string;
}): Promise<PreparedAudio> {
  const { sourcePath, accepts, workDir, jobId } = options;
  assertSupportedInput(sourcePath);

  if (!fs.existsSync(sourcePath)) {
    throw new TranscriptionError('unreadable-audio', `The file ${path.basename(sourcePath)} could not be found.`);
  }

  const ext = path.extname(sourcePath).toLowerCase();
  const engineAcceptsSource = accepts.includes(ext);

  if (engineAcceptsSource) {
    // Pass-through. Peaks still want PCM, so convert separately when we can —
    // failure here costs a waveform, never the transcript.
    let wavForPeaks: string | null = null;
    if (canConvertLocally()) {
      const peaksPath = path.join(workDir, `ritemark-peaks-${jobId}.wav`);
      try {
        await convertToWav(sourcePath, peaksPath, PEAKS_SAMPLE_RATE);
        wavForPeaks = peaksPath;
      } catch {
        wavForPeaks = null;
      }
    }
    return { path: sourcePath, isTemp: false, wavForPeaks };
  }

  if (!canConvertLocally()) {
    throw new TranscriptionError(
      'unsupported-format',
      `${ext} files need converting before they can be transcribed on this device. Use .mp3 or .wav, or transcribe with ElevenLabs.`,
    );
  }

  const converted = path.join(workDir, `ritemark-audio-${jobId}.wav`);
  await convertToWav(sourcePath, converted, ENGINE_SAMPLE_RATE);
  return { path: converted, isTemp: true, wavForPeaks: converted };
}

/**
 * Spawn `afconvert` to produce mono 16-bit little-endian PCM.
 *
 * Success is judged on the output file, not just the exit code — the same trap
 * audit A2 found in whisper-cli, and not one worth being bitten by twice.
 */
export function convertToWav(source: string, dest: string, sampleRate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(
      '/usr/bin/afconvert',
      ['-f', 'WAVE', '-d', `LEI16@${sampleRate}`, '-c', '1', source, dest],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('error', (error) => {
      reject(new TranscriptionError('unreadable-audio', `Could not convert the audio: ${error.message}`));
    });

    child.on('exit', (code) => {
      const produced = fs.existsSync(dest) && fs.statSync(dest).size > 44;
      if (code === 0 && produced) {
        resolve();
        return;
      }
      reject(
        new TranscriptionError(
          'unreadable-audio',
          `${path.basename(source)} could not be read as audio. It may be incomplete or corrupted.${
            stderr.trim() ? ` (${stderr.trim().split('\n')[0]})` : ''
          }`,
        ),
      );
    });
  });
}

interface WavFormat {
  dataOffset: number;
  dataLength: number;
  bitsPerSample: number;
  channels: number;
  sampleRate: number;
}

/**
 * Parse a RIFF header by walking its chunks.
 *
 * The 44-byte-header assumption holds for most writers and then quietly breaks
 * on the one that emits a LIST chunk, so the chunks are walked properly.
 */
export function parseWavHeader(header: Buffer): WavFormat {
  if (header.length < 12 || header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE') {
    throw new TranscriptionError('unreadable-audio', 'The converted audio was not a readable WAV file.');
  }

  let offset = 12;
  let fmt: Omit<WavFormat, 'dataOffset' | 'dataLength'> | null = null;

  while (offset + 8 <= header.length) {
    const id = header.toString('ascii', offset, offset + 4);
    const size = header.readUInt32LE(offset + 4);
    const body = offset + 8;

    if (id === 'fmt ' && body + 16 <= header.length) {
      fmt = {
        channels: header.readUInt16LE(body + 2),
        sampleRate: header.readUInt32LE(body + 4),
        bitsPerSample: header.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      if (!fmt) break;
      return { ...fmt, dataOffset: body, dataLength: size };
    }

    offset = body + size + (size % 2);
  }

  throw new TranscriptionError('unreadable-audio', 'The converted audio had no readable PCM data.');
}

/**
 * Stream a 16-bit mono WAV and reduce it to `buckets` normalised 0..1 peaks.
 *
 * Streamed rather than read whole: an hour of 16 kHz mono is ~110 MB, and this
 * runs in the extension host next to the user's editor.
 */
export async function computePeaks(wavPath: string, buckets = DEFAULT_PEAK_BUCKETS): Promise<number[]> {
  const handle = await fsp.open(wavPath, 'r');
  try {
    const header = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const format = parseWavHeader(header.subarray(0, bytesRead));

    if (format.bitsPerSample !== 16) {
      throw new TranscriptionError('unreadable-audio', 'Expected 16-bit PCM while reading the waveform.');
    }

    const fileSize = (await handle.stat()).size;
    const available = Math.min(format.dataLength || fileSize - format.dataOffset, fileSize - format.dataOffset);
    const totalSamples = Math.floor(available / 2 / Math.max(1, format.channels));
    if (totalSamples <= 0) return [];

    const samplesPerBucket = Math.max(1, Math.floor(totalSamples / buckets));
    const peaks: number[] = [];

    const CHUNK_SAMPLES = 1 << 16;
    const chunk = Buffer.alloc(CHUNK_SAMPLES * 2 * Math.max(1, format.channels));

    let position = format.dataOffset;
    let bucketMax = 0;
    let inBucket = 0;
    let consumed = 0;

    while (consumed < totalSamples) {
      const read = await handle.read(chunk, 0, chunk.length, position);
      if (read.bytesRead <= 0) break;
      position += read.bytesRead;

      const frameBytes = 2 * Math.max(1, format.channels);
      const frames = Math.floor(read.bytesRead / frameBytes);

      for (let i = 0; i < frames && consumed < totalSamples; i++) {
        // Mono in practice; if a stereo file ever arrives, the left channel is
        // a truthful enough waveform for a scrubber.
        const value = Math.abs(chunk.readInt16LE(i * frameBytes)) / 32768;
        if (value > bucketMax) bucketMax = value;
        inBucket++;
        consumed++;

        if (inBucket >= samplesPerBucket) {
          peaks.push(Number(bucketMax.toFixed(3)));
          bucketMax = 0;
          inBucket = 0;
        }
      }
    }

    if (inBucket > 0) peaks.push(Number(bucketMax.toFixed(3)));
    return peaks;
  } finally {
    await handle.close();
  }
}

/** Best-effort temp cleanup; a leftover temp file must never fail a job. */
export async function cleanupTemp(paths: Array<string | null | undefined>): Promise<void> {
  await Promise.all(
    paths.filter((p): p is string => Boolean(p)).map((p) => fsp.rm(p, { force: true }).catch(() => undefined)),
  );
}
