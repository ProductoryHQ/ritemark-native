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

export function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
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
