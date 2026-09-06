/**
 * Sprint 108 R2 — the transcription engine interface.
 *
 * Deliberately shaped like `runtime/AgentRuntime.ts` rather than folded into
 * `ai/modelConfig.ts`: an STT engine is a runtime (a child process or an HTTP
 * client, with its own readiness, platform support and failure modes), not an
 * LLM model id. `ai/modelConfig.ts` stays the single registry for LLM models,
 * including the one the insights rail uses (R10).
 */

import type { Platform } from '../utils/platform';
import type { SpeakerSeparation, TranscriptionResult, JobProgress } from './types';

export interface EngineCapabilities {
  /** Whether the engine can tell speakers apart. Whisper cannot (D3). */
  diarization: boolean;
  /** Per-word confidence, driving R9 highlighting. Both engines have it. */
  confidence: boolean;
  wordTimestamps: boolean;
}

export type EngineReadiness =
  | { ready: true }
  | {
      ready: false;
      /** Why not, in user-facing words. */
      reason: string;
      /** The single action that fixes it, if there is one. */
      action?: 'download-model' | 'add-api-key' | 'none';
    };

export interface TranscribeOptions {
  /** Path to the audio the engine should read. Already prepared by audioPrep. */
  audioPath: string;
  /** Original file, for engines that upload rather than decode locally. */
  sourcePath: string;
  durationSec: number;
  /** ISO-639-1, or null to auto-detect. */
  language: string | null;
  signal: AbortSignal;
  onProgress: (progress: JobProgress) => void;
}

export interface TranscriptionEngine {
  readonly id: string;
  readonly label: string;
  /** True when audio never leaves the machine — the privacy claim (N2). */
  readonly isLocal: boolean;
  readonly platforms: Platform[];
  readonly capabilities: EngineCapabilities;
  readonly speakerSeparation: SpeakerSeparation;

  /**
   * Which prepared formats this engine accepts. `audioPrep` uses it to decide
   * whether a file can be passed through or has to be converted first.
   */
  readonly acceptsExtensions: string[];

  /** Can it run right now on this machine? Cheap; called to render engine cards. */
  isReady(): Promise<EngineReadiness>;

  /** USD, or null when the engine is free. Shown before any upload (R4/N7). */
  estimateCostUsd(durationSec: number): number | null;

  transcribe(options: TranscribeOptions): Promise<TranscriptionResult>;
}
