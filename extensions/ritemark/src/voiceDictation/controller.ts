// Voice dictation controller
// Manages audio collection and whisper.cpp transcription
//
// UX DESIGN (Option A - Incremental):
// - Audio chunks arrive every few seconds from webview
// - Each chunk is transcribed as soon as the engine is free
// - Text appears in editor while recording
// - User sees progress as they speak
//
// Sprint 129 R8: no audio is dropped. A chunk that arrives while a transcription
// runs waits, and the waiting audio is transcribed as one call of up to
// MAX_CALL_SECONDS. Whisper pads every call to a 30 s window, so a call costs
// about the same whatever its length, and joining audio lets a slow computer
// keep up instead of losing words. Stop finishes everything already captured.
//
// Sprint 129 R12 ("speak, then text", computers without Apple's GPU): nothing is
// inserted while the user speaks. Full MAX_CALL_SECONDS pieces are transcribed in
// the background and their text is held; after Stop the rest is transcribed and
// all text goes in at once. A long dictation then waits about one call after
// Stop, not as long as it lasted.

import type * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  AVAILABLE_MODELS,
  dictationModeFor,
  getModelPath,
  getWhisperBinaryPath,
  isSilenceHallucination,
  transcribeWav,
  WHISPER_TARGETS,
  type DictationMode,
  type TranscriptionResult,
  type WhisperOptions,
  type WhisperReadiness,
} from './whisperCpp';

/** 16 kHz mono 16-bit PCM, what the webview sends and whisper wants. */
const SAMPLE_RATE = 16000;
const BYTES_PER_SECOND = SAMPLE_RATE * 2;
/** One call stays inside Whisper's 30 s window. */
export const MAX_CALL_SECONDS = 28;
/** Live dictation only: waiting audio beyond this means the computer cannot keep up. */
export const BACKLOG_STOP_SECONDS = 60;

export const BACKLOG_NOTICE = "Dictation can't keep up on this computer, so it stopped listening. The rest of what you said will appear in a moment.";

/** Where the last call's duration is kept, for the next wait estimate (R12). */
const CALL_MS_KEY = 'ritemark.dictation.lastCallMs';

/** 100 ms of 16 kHz audio. */
const FRAME_SAMPLES = 1600;
/** RMS of -65 dBFS: above it a frame is audible. A muted microphone sits near -92 dBFS. */
const AUDIBLE_FRAME_RMS = 18;
/** RMS of -50 dBFS: above it a frame is clearly voiced. Quiet real speech peaks near -49 dBFS. */
const VOICED_FRAME_RMS = 104;
/** Fewer audible 100 ms frames than this: silence, never sent to whisper. */
const MIN_AUDIBLE_FRAMES = 3;
/** Under 1 s of voiced frames: weak audio, where whisper's silence phrases are dropped. */
const STRONG_VOICED_FRAMES = 10;

export interface AudioLevel {
  /** 100 ms frames above -65 dBFS RMS. */
  audible: number;
  /** 100 ms frames above -50 dBFS RMS. */
  voiced: number;
}

/**
 * Sprint 129 (Windows test, bug C): how much of the audio could be speech.
 * Whisper invents words for silence: a hardware-muted microphone (about -92 dBFS)
 * came out as "Kõik põhjad, kõik põhjad." on Windows; zeros gave "Kõige!" / "you"
 * on the Mac. The thresholds were checked on 100 FLEURS Estonian clips, whose
 * quietest speech peaks near -49 dBFS (a frame at -40 dBFS, the first threshold
 * tried, would have dropped real speech).
 */
export function audioLevel(pcm: Buffer): AudioLevel {
  const samples = Math.floor(pcm.length / 2);
  const level = { audible: 0, voiced: 0 };
  for (let start = 0; start < samples; start += FRAME_SAMPLES) {
    const end = Math.min(samples, start + FRAME_SAMPLES);
    let sum = 0;
    for (let i = start; i < end; i += 1) {
      const v = pcm.readInt16LE(i * 2);
      sum += v * v;
    }
    const rms = Math.sqrt(sum / (end - start));
    if (rms > AUDIBLE_FRAME_RMS) level.audible += 1;
    if (rms > VOICED_FRAME_RMS) level.voiced += 1;
  }
  return level;
}

export type DictationEngineProblem =
  | 'mic-silent'
  | 'engine-missing'
  | 'engine-blocked'
  | 'engine-cpu'
  | 'engine-failed'
  | 'engine-unavailable'
  | 'model-missing';

/** Which dialog a whisper readiness result calls for. */
export function dictationProblemFor(
  readiness: Exclude<WhisperReadiness, 'ready'>,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): DictationEngineProblem {
  switch (readiness) {
    case 'missing':
      return WHISPER_TARGETS.includes(`${platform}-${arch}`) ? 'engine-missing' : 'engine-unavailable';
    case 'blocked':
      return 'engine-blocked';
    case 'cpu-unsupported':
      return 'engine-cpu';
    case 'failed':
      return 'engine-failed';
  }
}

/**
 * The PCM samples of a 16 kHz mono 16-bit WAV, or null for anything else.
 *
 * Walks the RIFF chunks instead of assuming a 44-byte header.
 */
export function parsePcmWav(wav: Buffer): Buffer | null {
  if (wav.length < 12 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }
  let offset = 12;
  let formatOk = false;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ' && body + 16 <= wav.length) {
      formatOk = wav.readUInt16LE(body) === 1          // PCM
        && wav.readUInt16LE(body + 2) === 1            // mono
        && wav.readUInt32LE(body + 4) === SAMPLE_RATE
        && wav.readUInt16LE(body + 14) === 16;         // bits per sample
    } else if (id === 'data') {
      if (!formatOk) return null;
      const end = Math.min(body + size, wav.length);
      return wav.subarray(body, end - ((end - body) % 2));
    }
    offset = body + size + (size % 2);
  }
  return null;
}

/** A 16 kHz mono 16-bit WAV around `pcm`. */
export function buildPcmWav(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(BYTES_PER_SECOND, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export interface DictationDeps {
  transcribe: (wav: Buffer, options: WhisperOptions) => Promise<TranscriptionResult>;
  binaryPath: () => string;
  modelPath: () => string;
  modelExists: (modelPath: string) => boolean;
  /** A passing notice (VS Code toast) that needs no decision. */
  notify: (message: string) => void;
  /** Sprint 129 R12: live text, or all of it after Stop. */
  mode: DictationMode;
  /** The last call's duration on this computer, from an earlier session. */
  recallCallMs: () => number | undefined;
  rememberCallMs: (ms: number) => void;
  now: () => number;
  /** How much of the audio could be speech; silence is never transcribed. */
  audioLevel: (pcm: Buffer) => AudioLevel;
}

export class DictationController {
  private isRecording = false;
  private language = 'en';
  private pending: Buffer[] = [];
  private pendingBytes = 0;
  private draining: Promise<void> | null = null;
  /** Deferred mode: text transcribed while recording, inserted after Stop. */
  private held: string[] = [];
  private lastCallMs: number | undefined;
  /** When the running call started, for the wait estimate. */
  private callStartedAt: number | null = null;
  /** This dictation produced text, or had clearly voiced audio; how much was captured. */
  private producedText = false;
  private strongAudio = false;
  private capturedBytes = 0;
  /** A problem was already reported for this dictation. */
  private reported = false;
  private readonly deps: DictationDeps;

  constructor(
    private webview: Pick<vscode.Webview, 'postMessage'>,
    context: Pick<vscode.ExtensionContext, 'extensionPath'> & Partial<Pick<vscode.ExtensionContext, 'globalState'>>,
    deps: Partial<DictationDeps> = {}
  ) {
    this.deps = {
      transcribe: transcribeWav,
      binaryPath: () => getWhisperBinaryPath(context),
      modelPath: () => getModelPath(),
      modelExists: (modelPath) => fs.existsSync(modelPath),
      // Loaded lazily so the unit tests run without VS Code.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      notify: (message) => { void (require('vscode') as typeof vscode).window.showInformationMessage(message); },
      mode: dictationModeFor(),
      recallCallMs: () => context.globalState?.get<number>(CALL_MS_KEY),
      rememberCallMs: (ms) => { void context.globalState?.update(CALL_MS_KEY, ms); },
      now: () => Date.now(),
      audioLevel,
      ...deps,
    };
    this.lastCallMs = this.deps.recallCallMs();
  }

  /**
   * Start recording - just sets up state, audio comes via handleAudioChunk
   */
  startDictation(language: string): void {
    this.language = language || 'en';
    this.isRecording = true;
    this.pending = [];
    this.pendingBytes = 0;
    this.held = [];
    this.producedText = false;
    this.strongAudio = false;
    this.capturedBytes = 0;
    this.reported = false;

    this.webview.postMessage({
      type: 'dictation:status',
      status: 'listening'
    });
  }

  /**
   * Handle incoming audio chunk (base64 WAV from webview).
   * Queues it and starts transcribing if the engine is free.
   */
  handleAudioChunk(base64Audio: string): Promise<void> {
    if (!this.isRecording) {
      return Promise.resolve();
    }

    const pcm = parsePcmWav(Buffer.from(base64Audio, 'base64'));
    // Skip unreadable or near-empty chunks (likely silence or errors)
    if (!pcm || pcm.length < 1000) {
      if (!pcm) console.warn('[DictationController] Ignoring audio that is not 16 kHz mono 16-bit WAV');
      return this.draining ?? Promise.resolve();
    }

    this.pending.push(pcm);
    this.pendingBytes += pcm.length;
    this.capturedBytes += pcm.length;

    if (this.deps.mode === 'live' && this.pendingBytes > BACKLOG_STOP_SECONDS * BYTES_PER_SECOND) {
      // Stop taking audio; what was captured is still transcribed and inserted.
      // A toast, not the dialog: the user is watching their words still arrive.
      // Deferred mode has no such stop: a slow computer only makes the wait
      // after Stop longer.
      this.isRecording = false;
      this.deps.notify(BACKLOG_NOTICE);
      this.webview.postMessage({ type: 'dictation:stop-capture' });
    }

    return this.hasWork() ? this.ensureDraining() : (this.draining ?? Promise.resolve());
  }

  /**
   * Stop recording. Audio already captured — including the final chunk the
   * webview sends just before this — is transcribed before the button goes idle.
   */
  async stopDictation(): Promise<void> {
    this.isRecording = false;
    try {
      if (this.draining || this.pendingBytes > 0) {
        // The webview shows that text is still on its way (R8/R12).
        this.webview.postMessage({
          type: 'dictation:status',
          status: 'finishing',
          // null: nothing measured yet on this computer (the webview says "up to a minute")
          waitSeconds: this.deps.mode === 'deferred' ? (this.estimateWaitSeconds() ?? null) : undefined,
        });
        await this.ensureDraining();
      }
      this.flushHeld();
      if (!this.producedText && !this.strongAudio && !this.reported && this.capturedBytes >= BYTES_PER_SECOND) {
        // Only silence came in: a muted microphone, or one the system blocks.
        this.reported = true;
        this.webview.postMessage({ type: 'dictation:problem', problem: 'mic-silent' });
      }
    } finally {
      // Always answered, so the webview's button never waits for good.
      this.webview.postMessage({
        type: 'dictation:status',
        status: 'idle'
      });
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.isRecording = false;
    this.pending = [];
    this.pendingBytes = 0;
    this.held = [];
  }

  /**
   * Check if dictation is currently active (recording or processing)
   */
  isActive(): boolean {
    return this.isRecording || this.draining !== null;
  }

  private ensureDraining(): Promise<void> {
    if (!this.draining) {
      this.draining = this.drain().finally(() => {
        this.draining = null;
      });
    }
    return this.draining;
  }

  /**
   * Whether there is audio to transcribe now. While a deferred recording runs,
   * only full pieces are: shorter ones wait for more speech or for Stop.
   */
  private hasWork(): boolean {
    if (this.pendingBytes === 0) return false;
    return this.deps.mode === 'live' || !this.isRecording || this.pendingBytes >= MAX_CALL_SECONDS * BYTES_PER_SECOND;
  }

  /**
   * Seconds until the text is in, from the last call's duration on this
   * computer, rounded up to 10 s; undefined before anything was measured.
   */
  private estimateWaitSeconds(): number | undefined {
    if (!this.lastCallMs) return undefined;
    // The running call is part done; count only what is left of it (Windows
    // test: counting it whole showed "about 70" for a 50 s wait).
    const running = this.callStartedAt === null ? 0 : Math.max(0, this.lastCallMs - (this.deps.now() - this.callStartedAt));
    const queued = Math.ceil(this.pendingBytes / (MAX_CALL_SECONDS * BYTES_PER_SECOND)) * this.lastCallMs;
    return Math.max(10, Math.ceil((running + queued) / 10_000) * 10);
  }

  /** Deferred mode: insert the held text, in the order it was spoken. */
  private flushHeld(): void {
    if (this.held.length === 0) return;
    this.webview.postMessage({ type: 'dictation:transcription', text: this.held.join(' ') });
    this.held = [];
  }

  /** Transcribe waiting audio in order until none is left. */
  private async drain(): Promise<void> {
    while (this.hasWork()) {
      const pcm = this.takePending(MAX_CALL_SECONDS * BYTES_PER_SECOND);
      const live = this.deps.mode === 'live';

      const level = this.deps.audioLevel(pcm);
      if (level.audible < MIN_AUDIBLE_FRAMES) {
        // Silence: nothing to transcribe (whisper would invent words for it).
        if (live && this.isRecording) {
          this.webview.postMessage({ type: 'dictation:status', status: 'listening' });
        }
        continue;
      }
      const weak = level.voiced < STRONG_VOICED_FRAMES;
      if (!weak) this.strongAudio = true;

      if (live) {
        this.webview.postMessage({
          type: 'dictation:status',
          status: 'processing'
        });
      }

      const modelPath = this.deps.modelPath();
      if (!this.deps.modelExists(modelPath)) {
        this.fail('model-missing', AVAILABLE_MODELS[path.basename(modelPath)]?.sizeDisplay);
        return;
      }

      const started = this.deps.now();
      this.callStartedAt = started;
      let result: TranscriptionResult;
      try {
        result = await this.deps.transcribe(buildPcmWav(pcm), {
          binaryPath: this.deps.binaryPath(),
          modelPath,
          language: this.language,
        });
      } catch (error) {
        // The temp file could not be written (full disk), or the process
        // could not be started: stop with a reason, never hang (QA B1).
        console.error('[DictationController] Transcription threw:', error);
        this.fail('engine-failed');
        return;
      } finally {
        this.callStartedAt = null;
      }
      if (result.success) {
        // Only real calls feed the wait estimate; a quick failure would skew it.
        this.lastCallMs = this.deps.now() - started;
        this.deps.rememberCallMs(this.lastCallMs);
      }

      if (!result.success) {
        console.error('[DictationController] Transcription error:', result.error);
        // R6: an engine that cannot run stops dictation with a reason, instead
        // of "listening" while every chunk fails.
        if (result.failure) {
          this.fail(dictationProblemFor(result.failure));
          return;
        }
        continue;
      }

      let text = result.text.trim();
      if (weak && isSilenceHallucination(text)) {
        // Weak audio that came out as "Kõige! Kõige!": whisper's silence phrase.
        text = '';
      }
      if (text.length > 0) this.producedText = true;
      if (text.length > 0 && !live) {
        this.held.push(text);
      } else if (text.length > 0) {
        this.webview.postMessage({
          type: 'dictation:transcription',
          text
        });
      }

      // Back to listening state if still recording
      if (live && this.isRecording) {
        this.webview.postMessage({
          type: 'dictation:status',
          status: 'listening'
        });
      }
    }
  }

  /** Take up to `maxBytes` of waiting audio, oldest first. */
  private takePending(maxBytes: number): Buffer {
    const taken: Buffer[] = [];
    let size = 0;
    while (this.pending.length > 0 && size < maxBytes) {
      const next = this.pending[0];
      const room = maxBytes - size;
      if (next.length <= room) {
        taken.push(next);
        size += next.length;
        this.pending.shift();
      } else {
        const cut = room - (room % 2);
        if (cut === 0) break;
        taken.push(next.subarray(0, cut));
        this.pending[0] = next.subarray(cut);
        size += cut;
      }
    }
    this.pendingBytes -= size;
    return Buffer.concat(taken, size);
  }

  private fail(problem: DictationEngineProblem, detail?: string): void {
    // What was already transcribed goes in before the dialog explains (R12).
    this.flushHeld();
    this.isRecording = false;
    this.pending = [];
    this.pendingBytes = 0;
    this.reported = true;
    this.webview.postMessage({
      type: 'dictation:problem',
      problem,
      detail,
      // Speech was captured and could not be turned into text: the dialog says
      // "Dictation Stopped", not "Can't Start" (Windows test, bug D).
      stage: 'transcribing',
    });
  }
}
