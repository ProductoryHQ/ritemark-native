/**
 * Sprint 108 R2 — the transcription job pipeline.
 *
 * Runs independently of any webview: closing the Transcribe panel or the
 * workbench tab must not cancel a 60-minute job. Jobs are single-flight (one
 * engine run at a time — whisper peaks at ~2.5 GB RSS, per audit A2) and every
 * in-flight job is persisted, so quitting mid-job produces an honest
 * "Interrupted" row on restart instead of a job that silently vanished.
 *
 * Imports `vscode` as a TYPE only, so the whole state machine is testable with
 * a fake Memento — the pattern `daemon/DaemonResultStore.ts` already uses.
 */

import * as path from 'path';
import type { Memento } from 'vscode';
import type { EngineRegistry } from './engineRegistry';
import type { SessionStore } from './SessionStore';
import { fingerprintFile, sessionIdForPath } from './SessionStore';
import { cleanupTemp, computePeaks, prepareAudio } from './audioPrep';
import { TranscriptionError } from './types';
import type {
  EngineId,
  JobProgress,
  Speaker,
  TranscriptSession,
  TranscriptionJob,
  TranscriptionErrorInfo,
} from './types';

const INFLIGHT_KEY = 'speech:inflightJobs';

export interface EnqueueRequest {
  audioPath: string;
  engineId: EngineId;
  /** Folder open at import time — scopes the library to the project (null = none). */
  workspaceRoot: string | null;
  /** Measured in the webview from the audio element — exact and cross-platform. */
  durationSec: number;
  language: string | null;
}

export type JobEvent =
  | { type: 'job-updated'; job: TranscriptionJob }
  | { type: 'job-completed'; job: TranscriptionJob; session: TranscriptSession }
  | { type: 'job-failed'; job: TranscriptionJob; error: TranscriptionErrorInfo };

export interface JobManagerDeps {
  registry: EngineRegistry;
  store: SessionStore;
  /** Directory for temp WAVs and JSON sidecars. */
  workDir: string;
  /** `globalState`, for the interrupted-job record only — sessions go to disk. */
  state: Memento;
}

export class JobManager {
  private readonly jobs = new Map<string, TranscriptionJob>();
  /**
   * Per-job request. Keyed rather than threaded through `pump`, because the
   * pump loop outlives the enqueue call that started it — reusing that call's
   * request would silently apply the first job's language to every job queued
   * behind it.
   */
  private readonly requests = new Map<string, EnqueueRequest>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly listeners = new Set<(event: JobEvent) => void>();
  private readonly queue: string[] = [];
  private running = false;
  private counter = 0;

  constructor(private readonly deps: JobManagerDeps) {}

  onEvent(listener: (event: JobEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): TranscriptionJob[] {
    return [...this.jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  get(jobId: string): TranscriptionJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Turn any job that was mid-flight when the app closed into an explicit
   * `interrupted` row (R2). Called once during activation.
   */
  async recoverInterrupted(): Promise<TranscriptionJob[]> {
    const stored = this.deps.state.get<TranscriptionJob[]>(INFLIGHT_KEY, []);
    const recovered: TranscriptionJob[] = [];

    for (const job of stored) {
      const interrupted: TranscriptionJob = {
        ...job,
        state: 'interrupted',
        endedAt: new Date().toISOString(),
        error: {
          code: 'unknown',
          message: 'Ritemark closed while this recording was being transcribed.',
          retryable: true,
        },
      };
      this.jobs.set(interrupted.id, interrupted);
      recovered.push(interrupted);
    }

    await this.deps.state.update(INFLIGHT_KEY, []);
    for (const job of recovered) this.emit({ type: 'job-updated', job });
    return recovered;
  }

  enqueue(request: EnqueueRequest): TranscriptionJob {
    const id = `job-${Date.now().toString(36)}-${++this.counter}`;
    const job: TranscriptionJob = {
      id,
      audioPath: request.audioPath,
      audioName: path.basename(request.audioPath),
      durationSec: request.durationSec,
      engine: request.engineId,
      state: 'queued',
      progress: { phase: 'queued', percent: null },
      startedAt: new Date().toISOString(),
    };

    this.jobs.set(id, job);
    this.requests.set(id, request);
    this.queue.push(id);
    this.emit({ type: 'job-updated', job });

    void this.pump();
    return job;
  }

  /** Stops the run, kills the child process, and cleans up temp files. */
  cancel(jobId: string): void {
    const controller = this.controllers.get(jobId);
    if (controller) {
      controller.abort();
      return;
    }

    // Not started yet — drop it from the queue so it never runs.
    const queuedAt = this.queue.indexOf(jobId);
    if (queuedAt >= 0) {
      this.queue.splice(queuedAt, 1);
      const job = this.jobs.get(jobId);
      if (job) this.finish(job, { ...job, state: 'cancelled', endedAt: new Date().toISOString() });
    }
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      while (this.queue.length > 0) {
        const jobId = this.queue.shift();
        if (!jobId) break;
        const job = this.jobs.get(jobId);
        const request = this.requests.get(jobId);
        if (!job || !request || job.state !== 'queued') continue;
        await this.run(job, request);
      }
    } finally {
      this.running = false;
    }
  }

  private async run(job: TranscriptionJob, request: EnqueueRequest): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(job.id, controller);

    const tempFiles: Array<string | null> = [];

    try {
      const engine = this.deps.registry.get(job.engine);

      this.update(job.id, { state: 'preparing', progress: { phase: 'preparing', percent: null } });
      await this.persistInflight();

      const prepared = await prepareAudio({
        sourcePath: job.audioPath,
        accepts: engine.acceptsExtensions,
        workDir: this.deps.workDir,
        jobId: job.id,
      });
      if (prepared.isTemp) tempFiles.push(prepared.path);
      if (prepared.wavForPeaks && prepared.wavForPeaks !== prepared.path) tempFiles.push(prepared.wavForPeaks);

      throwIfAborted(controller.signal);

      // A missing waveform is a cosmetic loss; it must never fail a transcript.
      const peaks = prepared.wavForPeaks ? await computePeaks(prepared.wavForPeaks).catch(() => []) : [];

      this.update(job.id, { state: 'transcribing', progress: { phase: 'transcribing', percent: 0 } });

      const result = await engine.transcribe({
        audioPath: prepared.path,
        sourcePath: job.audioPath,
        durationSec: job.durationSec,
        language: request.language,
        signal: controller.signal,
        onProgress: (progress: JobProgress) => {
          const current = this.jobs.get(job.id);
          if (!current || isTerminal(current.state)) return;
          this.update(job.id, { state: progress.phase, progress });
        },
      });

      throwIfAborted(controller.signal);
      this.update(job.id, { state: 'saving', progress: { phase: 'saving', percent: null } });

      const session = buildSession({
        audioPath: job.audioPath,
        durationSec: job.durationSec,
        engineId: job.engine,
        workspaceRoot: request.workspaceRoot,
        peaks,
        result,
      });
      await this.deps.store.save(session);

      const done = this.update(job.id, {
        state: 'done',
        progress: { phase: 'saving', percent: 100 },
        endedAt: new Date().toISOString(),
        sessionId: session.id,
      });

      await this.persistInflight();
      if (done) this.emit({ type: 'job-completed', job: done, session });
    } catch (error) {
      const info = toErrorInfo(error, controller.signal.aborted);
      const failed = this.update(job.id, {
        state: info.code === 'cancelled' ? 'cancelled' : 'failed',
        endedAt: new Date().toISOString(),
        error: info,
      });
      await this.persistInflight();
      if (failed && info.code !== 'cancelled') {
        this.emit({ type: 'job-failed', job: failed, error: info });
      }
    } finally {
      this.controllers.delete(job.id);
      this.requests.delete(job.id);
      await cleanupTemp(tempFiles);
    }
  }

  private update(jobId: string, patch: Partial<TranscriptionJob>): TranscriptionJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    const next = { ...job, ...patch };
    this.jobs.set(jobId, next);
    this.emit({ type: 'job-updated', job: next });
    return next;
  }

  private finish(job: TranscriptionJob, next: TranscriptionJob): void {
    this.jobs.set(job.id, next);
    this.emit({ type: 'job-updated', job: next });
  }

  /** Only genuinely in-flight jobs are persisted; finished ones need no recovery. */
  private async persistInflight(): Promise<void> {
    const inflight = this.list().filter((job) => !isTerminal(job.state));
    await this.deps.state.update(INFLIGHT_KEY, inflight);
  }

  private emit(event: JobEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // A broken listener (a disposed webview, usually) must not take down
        // the pipeline that is still transcribing.
      }
    }
  }
}

function isTerminal(state: TranscriptionJob['state']): boolean {
  return state === 'done' || state === 'failed' || state === 'cancelled' || state === 'interrupted';
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new TranscriptionError('cancelled', 'Transcription cancelled.');
}

export function toErrorInfo(error: unknown, aborted: boolean): TranscriptionErrorInfo {
  if (error instanceof TranscriptionError) return error.toInfo();
  if (aborted) return { code: 'cancelled', message: 'Transcription cancelled.', retryable: false };
  return {
    code: 'unknown',
    message: error instanceof Error ? error.message : 'Transcription failed for an unknown reason.',
    retryable: true,
  };
}

/**
 * Assemble a session from an engine result.
 *
 * Speaker labels start as "Speaker 1..n" in first-appearance order, which is
 * also the order a listener meets them. `colorIndex` is fixed here so a
 * speaker's colour never shifts between reopens (R8).
 */
export function buildSession(input: {
  audioPath: string;
  durationSec: number;
  engineId: EngineId;
  workspaceRoot?: string | null;
  peaks: number[];
  result: {
    segments: TranscriptSession['segments'];
    durationSec?: number;
    language: string | null;
    speakerSeparation: TranscriptSession['speakerSeparation'];
    costUsd?: number;
  };
}): TranscriptSession {
  const speakerIds: string[] = [];
  for (const segment of input.result.segments) {
    if (segment.speaker && !speakerIds.includes(segment.speaker)) speakerIds.push(segment.speaker);
  }

  const speakers: Speaker[] = speakerIds.map((id, index) => ({
    id,
    label: `Speaker ${index + 1}`,
    colorIndex: index,
  }));

  const now = new Date().toISOString();
  return {
    id: sessionIdForPath(input.audioPath),
    audioPath: input.audioPath,
    audioFingerprint: safeFingerprint(input.audioPath),
    // The engine's own figure wins: our probe cannot read compressed formats
    // on Windows and reports 0 there.
    durationSec: input.result.durationSec ?? input.durationSec,
    createdAt: now,
    updatedAt: now,
    engine: input.engineId,
    workspaceRoot: input.workspaceRoot ?? null,
    language: input.result.language,
    speakerSeparation: input.result.speakerSeparation,
    ...(input.result.costUsd !== undefined ? { costUsd: input.result.costUsd } : {}),
    speakers,
    segments: input.result.segments,
    peaks: input.peaks,
  };
}

function safeFingerprint(filePath: string): string {
  try {
    return fingerprintFile(filePath);
  } catch {
    return '';
  }
}
