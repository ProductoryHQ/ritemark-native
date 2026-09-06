/**
 * Sprint 108 R3 — on-device transcription with the bundled whisper.cpp.
 *
 * This is a SIBLING of `voiceDictation/whisperCpp.ts`, not a replacement.
 * Dictation transcribes 5-second chunks with `--no-timestamps` under a 30-second
 * timeout; file transcription needs the opposite on every count. Live dictation
 * is deliberately untouched (R3).
 *
 * Flag set and behaviour fixed by audit A2 (research/whisper-longrun-audit.md):
 * 60 minutes of audio in ~154s (23.5x realtime), progress on stderr in 5% steps,
 * clean SIGTERM — and the trap that undecodable audio exits 0.
 */

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import type { Platform } from '../../utils/platform';
import type {
  EngineCapabilities,
  EngineReadiness,
  TranscribeOptions,
  TranscriptionEngine,
} from '../TranscriptionEngine';
import { TranscriptionError } from '../types';
import type { SpeakerSeparation, TranscriptSegment, TranscriptWord, TranscriptionResult } from '../types';

/** whisper.cpp decodes these itself — verified in A1. */
const NATIVE_FORMATS = ['.mp3', '.wav', '.flac', '.ogg'];

/** Whisper reports probabilities per token; these merge into per-word confidence. */
interface WhisperToken {
  text: string;
  offsets?: { from: number; to: number };
  p?: number;
}

interface WhisperSegment {
  offsets?: { from: number; to: number };
  text?: string;
  tokens?: WhisperToken[];
}

interface WhisperJson {
  result?: { language?: string };
  transcription?: WhisperSegment[];
}

/**
 * Special tokens are decoder bookkeeping, not speech.
 *
 * Two shapes occur and they do not end the same way: `[_BEG_]` and `[_EOT_]`
 * close with an underscore, but the timestamp tokens are `[_TT_212]`. An
 * earlier version required a trailing `_`, so every timestamp token survived
 * into the word list, glued itself onto the preceding word, and — carrying a
 * low probability — showed up in the workbench as an amber "uncertain" mark on
 * text like `software.[_TT_212]`.
 */
function isSpecialToken(text: string): boolean {
  return /^\s*\[_[^\]]*\]\s*$/.test(text);
}

/**
 * Merge whisper's sub-word tokens into words.
 *
 * A token that starts with whitespace begins a new word; the rest continue the
 * previous one. Word confidence is the MINIMUM of its tokens' probabilities —
 * a word is only as trustworthy as its least certain piece.
 */
export function tokensToWords(tokens: WhisperToken[]): TranscriptWord[] {
  const words: TranscriptWord[] = [];

  for (const token of tokens) {
    const raw = token.text ?? '';
    if (!raw.trim() || isSpecialToken(raw)) continue;

    const startsWord = /^\s/.test(raw) || words.length === 0;
    const start = (token.offsets?.from ?? 0) / 1000;
    const end = (token.offsets?.to ?? 0) / 1000;
    const confidence = typeof token.p === 'number' ? token.p : undefined;

    if (startsWord) {
      words.push({
        text: raw.trim(),
        start,
        end,
        ...(confidence !== undefined ? { confidence } : {}),
      });
      continue;
    }

    const previous = words[words.length - 1];
    previous.text += raw.trim();
    previous.end = end || previous.end;
    if (confidence !== undefined) {
      previous.confidence =
        previous.confidence === undefined ? confidence : Math.min(previous.confidence, confidence);
    }
  }

  return words;
}

/**
 * Parse whisper's `-ojf` sidecar into segments.
 *
 * Exported for unit testing — it is the half of this engine that can be tested
 * without spawning a 1.6 GB model.
 */
export function parseWhisperJson(raw: string): { segments: TranscriptSegment[]; language: string | null } {
  let parsed: WhisperJson;
  try {
    parsed = JSON.parse(raw) as WhisperJson;
  } catch {
    throw new TranscriptionError('unreadable-audio', 'The transcription output could not be read.');
  }

  const segments: TranscriptSegment[] = [];
  for (const segment of parsed.transcription ?? []) {
    const text = (segment.text ?? '').trim();
    if (!text) continue;

    const words = tokensToWords(segment.tokens ?? []);
    segments.push({
      id: `seg-${segments.length}`,
      start: (segment.offsets?.from ?? 0) / 1000,
      end: (segment.offsets?.to ?? 0) / 1000,
      text,
      ...(words.length ? { words } : {}),
    });
  }

  return { segments, language: parsed.result?.language ?? null };
}

/** whisper-cli prints `progress =  65%` to stderr, padded for two digits. */
export function parseProgressLine(line: string): number | null {
  const match = /progress\s*=\s*(\d+)\s*%/.exec(line);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
}

export interface WhisperLocalEngineDeps {
  /** Absolute path to the bundled `whisper-cli`. */
  binaryPath: string;
  /** Absolute path to the downloaded ggml model. */
  modelPath: string;
  /** Where the JSON sidecar is written. */
  workDir: string;
  threads?: number;
}

export class WhisperLocalEngine implements TranscriptionEngine {
  readonly id = 'whisper-local';
  readonly label = 'On-device · Whisper';
  readonly isLocal = true;
  /** #133: no Windows build of whisper-cli ships yet. */
  readonly platforms: Platform[] = ['darwin'];
  readonly capabilities: EngineCapabilities = {
    // D3: whisper.cpp offers only English-only tinydiarize or a stereo split.
    // Neither is real diarization, and we do not guess.
    diarization: false,
    confidence: true,
    wordTimestamps: true,
  };
  readonly speakerSeparation: SpeakerSeparation = 'none';
  readonly acceptsExtensions = NATIVE_FORMATS;

  constructor(private readonly deps: WhisperLocalEngineDeps) {}

  async isReady(): Promise<EngineReadiness> {
    if (process.platform !== 'darwin') {
      return {
        ready: false,
        reason: 'On-device transcription is not available on Windows yet.',
        action: 'none',
      };
    }
    if (!fs.existsSync(this.deps.binaryPath)) {
      return { ready: false, reason: 'The on-device transcription engine is missing from this build.', action: 'none' };
    }
    if (!fs.existsSync(this.deps.modelPath)) {
      return { ready: false, reason: 'Model not downloaded — 1.5 GB, one time.', action: 'download-model' };
    }
    return { ready: true };
  }

  /** Local transcription costs nothing but electricity. */
  estimateCostUsd(): number | null {
    return null;
  }

  async transcribe(options: TranscribeOptions): Promise<TranscriptionResult> {
    const readiness = await this.isReady();
    if (!readiness.ready) {
      throw new TranscriptionError('engine-unavailable', readiness.reason);
    }

    const outBase = path.join(this.deps.workDir, `ritemark-transcript-${Date.now()}`);
    const jsonPath = `${outBase}.json`;

    const args = [
      '-m', this.deps.modelPath,
      '-f', options.audioPath,
      '-ojf',                       // segments + per-token probability + ms offsets
      '-of', outBase,
      '-pp',                        // progress on stderr, 5% steps
      '-t', String(this.deps.threads ?? 4),
      '-l', options.language ?? 'auto',
    ];

    options.onProgress({ phase: 'transcribing', percent: 0 });

    try {
      await this.runWhisper(args, options);
      return await this.readResult(jsonPath);
    } finally {
      await fsp.rm(jsonPath, { force: true }).catch(() => undefined);
    }
  }

  private runWhisper(args: string[], options: TranscribeOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = childProcess.spawn(this.deps.binaryPath, args, {
        env: {
          ...process.env,
          // The dylibs sit beside the binary; without this it cannot load them.
          DYLD_LIBRARY_PATH: path.dirname(this.deps.binaryPath),
        },
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      let stderrTail = '';
      let cancelled = false;

      const onAbort = (): void => {
        cancelled = true;
        // A2: SIGTERM terminates cleanly and leaves no orphan.
        child.kill('SIGTERM');
      };
      options.signal.addEventListener('abort', onAbort, { once: true });

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        stderrTail = (stderrTail + text).slice(-4000);
        for (const line of text.split('\n')) {
          const percent = parseProgressLine(line);
          if (percent !== null) options.onProgress({ phase: 'transcribing', percent });
        }
      });

      child.on('error', (error) => {
        options.signal.removeEventListener('abort', onAbort);
        reject(new TranscriptionError('engine-unavailable', `Transcription could not start: ${error.message}`));
      });

      child.on('exit', (code, signal) => {
        options.signal.removeEventListener('abort', onAbort);

        if (cancelled || signal === 'SIGTERM') {
          reject(new TranscriptionError('cancelled', 'Transcription cancelled.'));
          return;
        }
        if (code === 2) {
          reject(new TranscriptionError('unreadable-audio', 'The audio file could not be found.'));
          return;
        }
        if (code === 3) {
          reject(new TranscriptionError('model-missing', 'The transcription model could not be loaded.', true));
          return;
        }
        if (code !== 0) {
          reject(
            new TranscriptionError('unknown', `Transcription failed (exit ${code}). ${firstErrorLine(stderrTail)}`, true),
          );
          return;
        }
        resolve();
      });
    });
  }

  /**
   * A2's trap: whisper-cli exits 0 when a file exists but cannot be decoded.
   * Success therefore requires a parseable sidecar with at least one segment —
   * never the exit code alone, or a corrupt recording becomes a silent empty
   * "successful" transcript.
   */
  private async readResult(jsonPath: string): Promise<TranscriptionResult> {
    if (!fs.existsSync(jsonPath)) {
      throw new TranscriptionError(
        'unreadable-audio',
        'That recording could not be read as audio. It may be incomplete or in an unsupported format.',
      );
    }

    const { segments, language } = parseWhisperJson(await fsp.readFile(jsonPath, 'utf-8'));
    if (segments.length === 0) {
      throw new TranscriptionError(
        'unreadable-audio',
        'No speech was found in that recording. If the file plays normally, it may be in an unsupported format.',
      );
    }

    return { segments, language, speakerSeparation: 'none' };
  }
}

function firstErrorLine(stderr: string): string {
  const line = stderr
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('error:'));
  return line ?? '';
}
