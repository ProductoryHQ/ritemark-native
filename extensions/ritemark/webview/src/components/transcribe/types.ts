/**
 * Sprint 108 R1 — the Transcribe panel's view of the world.
 *
 * Mirrors what `TranscribeViewProvider` posts. Kept in one file so the two
 * sides of the bridge have a single shape to agree on.
 */

export type EngineId = 'whisper-local' | 'elevenlabs';

export type JobPhase = 'queued' | 'preparing' | 'uploading' | 'transcribing' | 'saving';

export type JobState = JobPhase | 'done' | 'failed' | 'cancelled' | 'interrupted';

export interface EngineReadiness {
  ready: boolean;
  reason?: string;
  action?: 'download-model' | 'add-api-key' | 'none';
}

export interface EngineStatus {
  id: string;
  label: string;
  isLocal: boolean;
  diarization: boolean;
  supportedOnPlatform: boolean;
  readiness: EngineReadiness;
}

export interface TranscriptionJob {
  id: string;
  audioPath: string;
  audioName: string;
  durationSec: number;
  engine: EngineId;
  state: JobState;
  progress: { phase: JobPhase; percent: number | null };
  startedAt: string;
  endedAt?: string;
  sessionId?: string;
  error?: { code: string; message: string; retryable: boolean };
}

export interface RecordingSummary {
  sessionId: string;
  audioPath: string;
  audioName: string;
  durationSec: number;
  engine: EngineId;
  speakerCount: number;
  speakerSeparation: 'none' | 'diarized';
  createdAt: string;
  audioMissing: boolean;
  exportPath?: string;
  /** Present only when the row comes from a different project. */
  projectName?: string;
}

export interface PendingImport {
  audioPath: string;
  audioName: string;
  /** null when the length genuinely could not be read — never invented. */
  durationSec: number | null;
  estimates: Array<{ engineId: string; costUsd: number | null }>;
}

export interface TranscribeState {
  engines: EngineStatus[];
  jobs: TranscriptionJob[];
  recordings: RecordingSummary[];
  pending: PendingImport | null;
  preferredEngineId: string | null;
  platform: string;
  acceptedExtensions: string[];
  videoExtensions: string[];
  /** Recordings that belong to other projects — never hidden without saying so. */
  otherProjectCount: number;
  showAllProjects: boolean;
  /** False when no folder is open, which is its own kind of "project". */
  hasProject: boolean;
  /** Sprint 118: direct recording, as the host sees it. */
  recording: RecordingProjection;
}

/** Mirrors `src/speech/recording/types.ts` — `RecordingProjection`. */
export interface RecordingProjection {
  enabled: boolean;
  phase: 'idle' | 'preparing' | 'recording' | 'finalizing';
  sessionId: string | null;
  fileName: string | null;
  folderLabel: string | null;
  durationSec: number;
  warnLong: boolean;
  noFolderLocation: string | null;
  hasProject: boolean;
  error: { code: string; message: string } | null;
  notice: string | null;
  partials: InterruptedRecording[];
}

/** A `.wav.part` left by an interrupted recording, addressed by id only. */
export interface InterruptedRecording {
  id: string;
  fileName: string;
  folderLabel: string;
  durationSec: number;
}

export const ACTIVE_STATES: JobState[] = ['queued', 'preparing', 'uploading', 'transcribing', 'saving'];

export function isActiveJob(job: TranscriptionJob): boolean {
  return ACTIVE_STATES.includes(job.state);
}

/** `47 min`, `1 h 12 min`. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return 'Length unknown';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${total} s`;
}

/** v1.13.0 (#371): the library shows when a recording was transcribed as a date: "30 Sep 2026". */
export function formatRecordingDate(iso: string): string {
  const then = new Date(iso);
  if (!Number.isFinite(then.getTime())) return '';
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "1 speaker", "3 speakers". */
export function formatSpeakerCount(count: number): string {
  return `${count} ${count === 1 ? 'speaker' : 'speakers'}`;
}

/** What the user is waiting for, in words rather than a state name. */
export function phaseLabel(job: TranscriptionJob): string {
  switch (job.state) {
    case 'queued':
      return 'Queued';
    case 'preparing':
      return 'Preparing audio';
    case 'uploading':
      return 'Uploading';
    case 'transcribing':
      return 'Transcribing';
    case 'saving':
      return 'Saving';
    default:
      return job.state;
  }
}
