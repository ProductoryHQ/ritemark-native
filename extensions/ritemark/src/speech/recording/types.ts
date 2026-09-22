/**
 * Sprint 118 — direct recording in Transcribe: shared types and the frozen
 * Phase 0 constants (research/capture-and-storage-decisions.md §5).
 *
 * Capture is not transcription: a finished recording is a plain WAV file that
 * goes through the existing `_stageImport` path like any imported file (R5).
 */

/** 16 kHz, mono, signed 16-bit little-endian PCM (Phase 0 §5). */
export const SAMPLE_RATE = 16_000;
export const CHANNELS = 1;
export const BITS_PER_SAMPLE = 16;
export const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
export const BYTES_PER_SECOND = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE; // 32,000
export const WAV_HEADER_BYTES = 44;

/** One chunk carries about one second; two seconds is the hard ceiling. */
export const MAX_CHUNK_SAMPLES = SAMPLE_RATE * 2;
/** Unacknowledged chunks the webview may have in flight (Phase 0 §5). */
export const MAX_UNACKED_CHUNKS = 4;
/** Warn at two hours, stop at four (Jarmo, 2026-09-22). */
export const WARN_AFTER_SEC = 2 * 60 * 60;
export const MAX_DURATION_SEC = 4 * 60 * 60;
export const MAX_DATA_BYTES = MAX_DURATION_SEC * BYTES_PER_SECOND;

/** In-project folder for recordings (Phase 0 §2.1). */
export const PROJECT_RECORDINGS_FOLDER = 'recordings';
export const PARTIAL_SUFFIX = '.part';

/** Why a capture ended without the user pressing Stop (R6/S4). */
export type StopReason =
  | 'user'
  | 'limit'
  | 'suspended'
  | 'device-lost'
  | 'too-slow';

/** Distinct, safe failure copy keys (R2). Raw errors never reach the user. */
export type RecordingErrorCode =
  | 'os-denied'
  | 'no-device'
  | 'device-busy'
  | 'internal-config'
  | 'device-lost'
  | 'suspended'
  | 'too-slow'
  | 'write-failed'
  | 'no-audio'
  | 'destination-unavailable'
  | 'already-recording'
  | 'unexpected';

export const RECORDING_ERROR_COPY: Record<RecordingErrorCode, string> = {
  'os-denied': 'Microphone access is denied for Ritemark.',
  'no-device': 'No microphone was found.',
  'device-busy': 'Ritemark could not open this microphone.',
  'internal-config': 'Recording is blocked by an internal configuration error in this build. Please update Ritemark or report this issue.',
  'device-lost': 'The microphone disconnected.',
  suspended: 'The system paused audio input, so the recording was stopped.',
  'too-slow': 'Ritemark could not keep up with saving the audio, so the recording was stopped.',
  'write-failed': 'Recording stopped because the file could not be written.',
  'no-audio': 'No audio was captured, so nothing was saved.',
  'destination-unavailable': 'Ritemark could not use the folder for recordings.',
  'already-recording': 'A recording is already in progress. Stop or cancel it first.',
  unexpected: 'Recording stopped unexpectedly.',
};

/** A `.part` file left behind by an interrupted recording (R6). */
export interface PartialRecording {
  /** Opaque host id; the webview never sends a path (R4). */
  id: string;
  fileName: string;
  folderLabel: string;
  durationSec: number;
}

export type RecordingPhase =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'finalizing';

/** What the Transcribe panel shows about recording. Contains no audio. */
export interface RecordingProjection {
  enabled: boolean;
  phase: RecordingPhase;
  sessionId: string | null;
  fileName: string | null;
  folderLabel: string | null;
  /** From samples actually written, never the wall clock (S4). */
  durationSec: number;
  warnLong: boolean;
  /** Where a recording goes when no folder is open, if chosen before. */
  noFolderLocation: string | null;
  hasProject: boolean;
  error: { code: RecordingErrorCode; message: string } | null;
  /** The last recording stopped for a reason other than the user (shown once). */
  notice: string | null;
  partials: PartialRecording[];
}
