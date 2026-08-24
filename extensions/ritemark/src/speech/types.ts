/**
 * Sprint 108 — shared types for the transcription subsystem.
 *
 * Time is in SECONDS everywhere, as a float. whisper-cli reports milliseconds
 * and ElevenLabs reports seconds; both are normalised at the engine boundary so
 * nothing downstream — least of all the player, which speaks `HTMLMediaElement`
 * seconds — has to remember which engine produced a session.
 */

/** Engines are runtimes, not models. See technical-plan.md § Architecture. */
export type EngineId = 'whisper-local' | 'elevenlabs';

/**
 * Whether the transcript knows who spoke.
 *
 * Sprint 108 R3/D3: the on-device engine cannot separate speakers, and we do
 * not guess. `'none'` is a first-class state the UI must show honestly, not an
 * empty speaker list that reads as "nobody talked".
 */
export type SpeakerSeparation = 'none' | 'diarized';

export interface TranscriptWord {
  text: string;
  /** Seconds from the start of the recording. */
  start: number;
  end: number;
  /** Engine speaker id (e.g. `speaker_0`); absent when unattributed. */
  speaker?: string;
  /**
   * 0..1, higher is better. Both engines provide this (audit A2 found
   * per-token `p` in whisper's `-ojf` output), so R9 works on both.
   */
  confidence?: number;
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  /** Majority-vote speaker across the segment's words. */
  speaker?: string;
  words?: TranscriptWord[];
}

export interface Speaker {
  /** Engine id — stable within a session, and what segments reference. */
  id: string;
  /** What the user sees. Starts as "Speaker 1", renamed via R8. */
  label: string;
  /** Palette index, so colours stay stable across reopens. */
  colorIndex: number;
}

export interface TranscriptInsights {
  generatedAt: string;
  model: string;
  /** Optional so Sprint 108 sessions remain loadable without migration. */
  language?: import('./insightsLanguage').InsightsLanguageMetadata;
  summary?: string;
  items: Array<{
    kind: 'decision' | 'action' | 'quote' | 'question';
    text: string;
    /** Seconds — resolved to a real segment, or the item is dropped (R10). */
    at: number;
    owner?: string;
  }>;
}

export interface TranscriptSession {
  id: string;
  /** Absolute path to the audio, which is never copied into app storage. */
  audioPath: string;
  /** size+mtime fingerprint, so a moved file can be relinked (R12). */
  audioFingerprint: string;
  audioMissing?: boolean;

  durationSec: number;
  createdAt: string;
  updatedAt: string;
  /**
   * The folder that was open when this recording was transcribed.
   *
   * Sessions live in GLOBAL storage (D5), so without this the library would be
   * machine-wide: every project would show every other project's recordings.
   * The recording itself often lives outside the folder (Downloads, a shared
   * drive), so the project is recorded at transcription time rather than
   * inferred from the audio path. `null` means no folder was open.
   */
  workspaceRoot?: string | null;

  engine: EngineId;
  /** BCP-47-ish code the engine detected or was told. */
  language: string | null;
  speakerSeparation: SpeakerSeparation;
  /** USD, when a paid engine was used. */
  costUsd?: number;

  speakers: Speaker[];
  segments: TranscriptSegment[];
  /** ~2000 normalised 0..1 peaks for the waveform, computed once at import. */
  peaks: number[];

  insights?: TranscriptInsights;
  /** Where the last markdown export landed, if any. */
  exportPath?: string;
}

/** What an engine returns. The session is assembled from this by JobManager. */
export interface TranscriptionResult {
  segments: TranscriptSegment[];
  /** Set when the engine knows the length better than our probe did. */
  durationSec?: number;
  language: string | null;
  speakerSeparation: SpeakerSeparation;
  costUsd?: number;
}

export type JobPhase =
  | 'queued'
  | 'preparing'
  | 'uploading'
  | 'transcribing'
  | 'saving';

export type JobState =
  | JobPhase
  | 'done'
  | 'failed'
  | 'cancelled'
  /** Found unfinished at startup — never silently dropped (R2). */
  | 'interrupted';

export interface JobProgress {
  phase: JobPhase;
  /**
   * 0..100, or `null` when the phase genuinely has no measurable progress.
   *
   * Null is load-bearing: a diarized ElevenLabs request cannot be windowed
   * (windowing renumbers speakers), so there is no server-side percentage
   * during processing. We show elapsed time rather than invent one.
   */
  percent: number | null;
}

export interface TranscriptionJob {
  id: string;
  audioPath: string;
  audioName: string;
  durationSec: number;
  engine: EngineId;
  state: JobState;
  progress: JobProgress;
  startedAt: string;
  endedAt?: string;
  sessionId?: string;
  error?: TranscriptionErrorInfo;
}

export type TranscriptionErrorCode =
  | 'unsupported-format'
  | 'video-not-supported'
  | 'unreadable-audio'
  | 'engine-unavailable'
  | 'model-missing'
  | 'no-api-key'
  | 'invalid-api-key'
  | 'rate-limited'
  | 'quota-exceeded'
  | 'offline'
  | 'network'
  | 'cancelled'
  | 'unknown';

export interface TranscriptionErrorInfo {
  code: TranscriptionErrorCode;
  /** User-facing. Every one of these gets designed copy (R13). */
  message: string;
  /** True when retrying the same input could plausibly succeed. */
  retryable: boolean;
}

/**
 * Errors that carry a code through to the UI. Anything else is mapped to
 * `unknown` at the job boundary rather than leaking a stack trace.
 */
export class TranscriptionError extends Error {
  constructor(
    readonly code: TranscriptionErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }

  toInfo(): TranscriptionErrorInfo {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}
