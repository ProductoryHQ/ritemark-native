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

import type * as vscode from 'vscode';
import * as fs from 'fs';
import {
  getModelPath,
  getWhisperBinaryPath,
  transcribeWav,
  whisperProblemMessage,
  type TranscriptionResult,
  type WhisperOptions,
} from './whisperCpp';

/** 16 kHz mono 16-bit PCM, what the webview sends and whisper wants. */
const SAMPLE_RATE = 16000;
const BYTES_PER_SECOND = SAMPLE_RATE * 2;
/** One call stays inside Whisper's 30 s window. */
export const MAX_CALL_SECONDS = 28;
/** Waiting audio beyond this means the computer cannot keep up. */
export const BACKLOG_STOP_SECONDS = 60;

export const BACKLOG_NOTICE = "Dictation can't keep up on this computer. Everything you said so far has been added.";

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
}

export class DictationController {
  private isRecording = false;
  private language = 'en';
  private pending: Buffer[] = [];
  private pendingBytes = 0;
  private draining: Promise<void> | null = null;
  private readonly deps: DictationDeps;

  constructor(
    private webview: Pick<vscode.Webview, 'postMessage'>,
    context: Pick<vscode.ExtensionContext, 'extensionPath'>,
    deps: Partial<DictationDeps> = {}
  ) {
    this.deps = {
      transcribe: transcribeWav,
      binaryPath: () => getWhisperBinaryPath(context),
      modelPath: () => getModelPath(),
      modelExists: (modelPath) => fs.existsSync(modelPath),
      ...deps,
    };
  }

  /**
   * Start recording - just sets up state, audio comes via handleAudioChunk
   */
  startDictation(language: string): void {
    this.language = language || 'en';
    this.isRecording = true;
    this.pending = [];
    this.pendingBytes = 0;

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

    if (this.pendingBytes > BACKLOG_STOP_SECONDS * BYTES_PER_SECOND) {
      // Stop taking audio; what was captured is still transcribed and inserted.
      this.isRecording = false;
      this.webview.postMessage({ type: 'dictation:error', error: BACKLOG_NOTICE });
    }

    return this.ensureDraining();
  }

  /**
   * Stop recording. Audio already captured — including the final chunk the
   * webview sends just before this — is transcribed before the button goes idle.
   */
  async stopDictation(): Promise<void> {
    if (!this.isRecording && !this.draining) {
      return;
    }

    this.isRecording = false;
    await this.ensureDraining();

    this.webview.postMessage({
      type: 'dictation:status',
      status: 'idle'
    });
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.isRecording = false;
    this.pending = [];
    this.pendingBytes = 0;
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

  /** Transcribe waiting audio in order until none is left. */
  private async drain(): Promise<void> {
    while (this.pendingBytes > 0) {
      const pcm = this.takePending(MAX_CALL_SECONDS * BYTES_PER_SECOND);

      this.webview.postMessage({
        type: 'dictation:status',
        status: 'processing'
      });

      const modelPath = this.deps.modelPath();
      if (!this.deps.modelExists(modelPath)) {
        this.fail('Speech model not downloaded. Click the mic button to download.');
        return;
      }

      const result = await this.deps.transcribe(buildPcmWav(pcm), {
        binaryPath: this.deps.binaryPath(),
        modelPath,
        language: this.language,
      });

      if (!result.success) {
        console.error('[DictationController] Transcription error:', result.error);
        // R6: an engine that cannot run stops dictation with a reason, instead
        // of "listening" while every chunk fails.
        if (result.failure) {
          this.fail(whisperProblemMessage(result.failure));
          return;
        }
        continue;
      }

      // Send result to webview (only if we got actual text)
      if (result.text.trim().length > 0) {
        this.webview.postMessage({
          type: 'dictation:transcription',
          text: result.text.trim()
        });
      }

      // Back to listening state if still recording
      if (this.isRecording) {
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

  private fail(message: string): void {
    this.isRecording = false;
    this.pending = [];
    this.pendingBytes = 0;
    this.webview.postMessage({
      type: 'dictation:error',
      error: message
    });
  }
}
