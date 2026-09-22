/**
 * Sprint 118 R3/R4/R6 — the host owner of a direct recording.
 *
 * One session per extension host. The webview captures audio and sends ordered
 * chunks; this controller decides every path, validates every chunk, writes
 * through `WavRecordingSink`, and is the only side that may call a recording
 * saved. A finished file goes to the existing `stageImport` path (R5), so the
 * engine/privacy choice stays where it always was.
 *
 * Rules frozen in Phase 0 (research/capture-and-storage-decisions.md §5):
 *   - a duplicate chunk is acknowledged again and changes nothing; a gap or a
 *     malformed chunk stops the recording honestly and keeps what was written;
 *   - messages for another or finished session are ignored;
 *   - a panel reload or window close mid-recording leaves an interrupted
 *     `.wav.part` that the panel offers to save or discard;
 *   - the 4-hour limit stops and saves; nothing is ever silently dropped.
 *
 * No `vscode` import: pickers, state, trash and the webview are injected, so
 * every rule runs in Node tests.
 */

import * as path from 'path';
import type { RecordingEvent, RecordingRequest } from './protocol';
import {
  decideDestination,
  displayLocation,
  durationFromDataBytes,
  finalPathFor,
  projectRecordingsDir,
  recordingBaseName,
  reserveRecordingPath,
  type WorkspaceFolderInfo,
} from './recordingPaths';
import {
  MAX_DATA_BYTES,
  RECORDING_ERROR_COPY,
  WARN_AFTER_SEC,
  type PartialRecording,
  type RecordingErrorCode,
  type RecordingPhase,
  type RecordingProjection,
  type StopReason,
} from './types';
import { RecordingSinkError, WavRecordingSink, isMissing, promoteFile, rebuildPartial, recoverableDataBytes, type SinkFs } from './WavRecordingSink';

export const PARTIALS_KEY = 'speech:recording:partials:v1';
export const NO_FOLDER_LOCATION_KEY = 'speech:recording:noFolderLocation:v1';

interface PartialEntry {
  id: string;
  partPath: string;
  folderLabel: string;
}

export interface StateStoreLike {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}

export interface RecordingControllerDeps {
  fs: SinkFs;
  state: StateStoreLike;
  newId(): string;
  now(): Date;
  home: string;
  isEnabled(): boolean;
  workspaceFolders(): WorkspaceFolderInfo[];
  activeFilePath(): string | null;
  chooseWorkspaceFolder(folders: WorkspaceFolderInfo[]): Promise<WorkspaceFolderInfo | undefined>;
  /** Folder picker for the no-folder case; resolves to an absolute path. */
  chooseLocation(current: string | null): Promise<string | undefined>;
  /** The existing Transcribe import path (R5). */
  stageImport(finalPath: string): Promise<void>;
  /** Moves a file to the OS trash; the controller falls back to delete. */
  moveToTrash(filePath: string): Promise<void>;
  postEvent(event: RecordingEvent): void;
  /** The OS privacy page for the microphone (R2: the denied state's action). */
  openMicrophoneSettings(): void;
  /** Something the panel shows changed. */
  onChange(): void;
  log?(message: string): void;
}

interface ActiveSession {
  id: string;
  phase: Exclude<RecordingPhase, 'idle'>;
  sink: WavRecordingSink;
  finalPath: string;
  folderLabel: string;
  nextSequence: number;
  warned: boolean;
}

const STOP_NOTICES: Partial<Record<StopReason, string>> = {
  limit: 'The recording reached the 4-hour limit and was saved.',
  suspended: 'The system paused audio input, so the recording was stopped and saved.',
  'device-lost': 'The microphone disconnected, so the recording was stopped and saved.',
  'too-slow': 'Ritemark could not keep up with saving the audio, so the recording was stopped and saved.',
};

export const INTERRUPTED_NOTICE = 'The recording was interrupted when the Transcribe panel closed. You can save what was recorded below.';

export class RecordingController {
  private session: ActiveSession | null = null;
  private starting = false;
  /**
   * Bumped whenever the webview that asked for a recording goes away. A start
   * whose picker resolves after that belongs to nobody and must not open a
   * session the new panel cannot see or stop.
   */
  private viewGeneration = 0;
  private error: RecordingProjection['error'] = null;
  private notice: string | null = null;
  private partials: PartialEntry[];

  constructor(private readonly deps: RecordingControllerDeps) {
    this.partials = deps.state.get<PartialEntry[]>(PARTIALS_KEY) ?? [];
  }

  /** For tests and diagnostics. */
  get activeSessionId(): string | null {
    return this.session?.id ?? null;
  }

  // ---------------------------------------------------------------- messages

  /**
   * Handle one decoded request. The synchronous part of a chunk (sequence
   * check, write queued) completes before this returns, so callers may fire
   * requests without awaiting and chunks are still written in order.
   */
  handle(request: RecordingRequest): Promise<void> {
    switch (request.type) {
      case 'transcribe:record/start':
        return this.start();
      case 'transcribe:record/changeLocation':
        return this.changeLocation();
      case 'transcribe:record/captureStarted':
        if (this.session?.id === request.sessionId && this.session.phase === 'preparing') {
          this.session.phase = 'recording';
          this.deps.onChange();
        }
        return Promise.resolve();
      case 'transcribe:record/chunk':
        return this.chunk(request);
      case 'transcribe:record/stop':
        return this.stop(request.sessionId, request.finalSequence, request.reason);
      case 'transcribe:record/cancel':
        return this.cancel(request.sessionId);
      case 'transcribe:record/captureFailed':
        return this.captureFailed(request.sessionId, request.code);
      case 'transcribe:record/recover':
        return this.recover(request.partialId);
      case 'transcribe:record/discard':
        return this.discard(request.partialId);
      case 'transcribe:record/dismissNotice':
        this.notice = null;
        this.error = null;
        this.deps.onChange();
        return Promise.resolve();
      case 'transcribe:record/openMicrophoneSettings':
        this.deps.openMicrophoneSettings();
        return Promise.resolve();
    }
  }

  /** A `transcribe:record/*` message failed validation (R3): stop honestly. */
  handleMalformed(): Promise<void> {
    this.deps.log?.('[recording] malformed recording message');
    return this.hostStop('unexpected');
  }

  // ---------------------------------------------------------------- start

  private async start(): Promise<void> {
    if (this.starting) return; // a picker is already open; that start answers
    if (!this.deps.isEnabled()) {
      // The flag gates new recordings only; a session in progress always finishes.
      this.deps.postEvent({ type: 'transcribe:record/notStarted' });
      return;
    }
    if (this.session) {
      this.deps.postEvent({ type: 'transcribe:record/notStarted' });
      this.setError('already-recording');
      return;
    }
    this.starting = true;
    this.error = null;
    this.notice = null;
    const generation = this.viewGeneration;
    try {
      const target = await this.resolveDestination();
      if (!target || generation !== this.viewGeneration) {
        // The user closed a picker, or the panel that asked is gone: nothing happened.
        this.deps.postEvent({ type: 'transcribe:record/notStarted' });
        this.deps.onChange();
        return;
      }
      let sink: WavRecordingSink;
      let finalPath: string;
      try {
        await this.deps.fs.mkdirp(target.dir);
        const reserved = await reserveRecordingPath(target.dir, recordingBaseName(this.deps.now()), (p) => this.deps.fs.exists(p));
        sink = await WavRecordingSink.create(this.deps.fs, reserved.partPath);
        finalPath = reserved.finalPath;
      } catch (error) {
        this.deps.log?.(`[recording] destination failed: ${String(error)}`);
        this.deps.postEvent({ type: 'transcribe:record/notStarted' });
        this.setError('destination-unavailable');
        return;
      }
      if (generation !== this.viewGeneration) {
        await sink.discard().catch(() => {});
        this.deps.postEvent({ type: 'transcribe:record/notStarted' });
        return;
      }
      const id = this.deps.newId();
      this.session = { id, phase: 'preparing', sink, finalPath, folderLabel: target.label, nextSequence: 0, warned: false };
      // Registered before any audio exists, so a crash always leaves a known
      // partial for recovery (R6).
      await this.setPartials([...this.partials, { id, partPath: sink.partPath, folderLabel: target.label }]);
      this.deps.postEvent({ type: 'transcribe:record/begin', sessionId: id });
      this.deps.onChange();
    } finally {
      this.starting = false;
    }
  }

  private async resolveDestination(): Promise<{ dir: string; label: string } | null> {
    const decision = decideDestination({
      workspaceFolders: this.deps.workspaceFolders(),
      activeFilePath: this.deps.activeFilePath(),
      rememberedLocation: this.deps.state.get<string>(NO_FOLDER_LOCATION_KEY) ?? null,
      home: this.deps.home,
    });
    if (decision.kind === 'folder') return { dir: decision.dir, label: decision.label };
    if (decision.kind === 'choose-workspace-folder') {
      const folder = await this.deps.chooseWorkspaceFolder(decision.folders);
      return folder ? projectRecordingsDir(folder) : null;
    }
    // No folder open and none chosen yet: ask before recording (Jarmo, 2026-09-22).
    const chosen = await this.deps.chooseLocation(null);
    if (!chosen) return null;
    await this.deps.state.update(NO_FOLDER_LOCATION_KEY, chosen);
    return { dir: chosen, label: displayLocation(chosen, this.deps.home) };
  }

  private async changeLocation(): Promise<void> {
    if (this.session || this.starting || !this.deps.isEnabled()) return;
    const current = this.deps.state.get<string>(NO_FOLDER_LOCATION_KEY) ?? null;
    const chosen = await this.deps.chooseLocation(current);
    if (!chosen) return;
    await this.deps.state.update(NO_FOLDER_LOCATION_KEY, chosen);
    this.deps.onChange();
  }

  // ---------------------------------------------------------------- chunks

  private chunk(request: Extract<RecordingRequest, { type: 'transcribe:record/chunk' }>): Promise<void> {
    const session = this.session;
    // Another session, a finished one, or one already finalizing: ignore (R3).
    if (!session || session.id !== request.sessionId || session.phase === 'finalizing') return Promise.resolve();
    if (request.sequence < session.nextSequence) {
      // Already written: acknowledge again, change nothing.
      this.deps.postEvent({ type: 'transcribe:record/ack', sessionId: session.id, sequence: request.sequence });
      return Promise.resolve();
    }
    if (request.sequence > session.nextSequence) {
      this.deps.log?.(`[recording] gap: expected ${session.nextSequence}, got ${request.sequence}`);
      return this.hostStop('unexpected');
    }
    const pcm = Buffer.from(request.pcm, 'base64');
    if (pcm.length !== request.sampleCount * 2) {
      this.deps.log?.(`[recording] chunk ${request.sequence} is ${pcm.length} bytes, expected ${request.sampleCount * 2}`);
      return this.hostStop('unexpected');
    }
    if (session.phase === 'preparing') {
      session.phase = 'recording';
      this.deps.onChange();
    }
    const atLimit = session.sink.dataBytes + pcm.length >= MAX_DATA_BYTES;
    const accepted = atLimit ? pcm.subarray(0, MAX_DATA_BYTES - session.sink.dataBytes) : pcm;
    session.nextSequence++;
    // Queued synchronously, so chunks are written in exactly the accepted order.
    const written = accepted.length > 0 ? session.sink.append(accepted) : Promise.resolve();
    return written.then(
      () => {
        if (this.session !== session) return;
        this.deps.postEvent({ type: 'transcribe:record/ack', sessionId: session.id, sequence: request.sequence });
        if (atLimit) return this.hostStop(null, 'limit');
        if (!session.warned && session.sink.durationSec >= WARN_AFTER_SEC) {
          session.warned = true;
          this.deps.onChange();
        }
      },
      (error: unknown) => {
        this.deps.log?.(`[recording] write failed: ${String(error)}`);
        return this.hostStop('write-failed');
      },
    );
  }

  /**
   * The host ends the session itself: tell the webview to stop capturing,
   * then keep what was written. A write failure leaves the `.part` for
   * recovery; anything else is finalized and staged like a normal Stop.
   */
  private async hostStop(code: RecordingErrorCode | null, reason: StopReason = 'user'): Promise<void> {
    const session = this.session;
    if (!session || session.phase === 'finalizing') return;
    this.deps.postEvent({ type: 'transcribe:record/ended', sessionId: session.id });
    if (code === 'write-failed') {
      session.phase = 'finalizing';
      this.endSession(session);
      await session.sink.checkpoint().catch(() => {});
      this.setError('write-failed');
      return;
    }
    await this.finish(session, reason, code ?? undefined);
  }

  // ---------------------------------------------------------------- stop

  private async stop(sessionId: string, finalSequence: number, reason: StopReason): Promise<void> {
    const session = this.session;
    if (!session || session.id !== sessionId || session.phase === 'finalizing') return;
    // Transport is ordered, so every chunk the webview sent has arrived by now.
    // A mismatch means one was lost: save what we have and say so.
    const lost = finalSequence !== session.nextSequence - 1;
    if (lost) this.deps.log?.(`[recording] stop at ${finalSequence}, but ${session.nextSequence - 1} received`);
    await this.finish(session, reason, lost ? 'unexpected' : undefined);
  }

  private async finish(session: ActiveSession, reason: StopReason, errorCode?: RecordingErrorCode): Promise<void> {
    session.phase = 'finalizing';
    this.deps.onChange();
    let finalPath: string;
    try {
      await session.sink.finalize();
      finalPath = await promoteFile(this.deps.fs, session.sink.partPath, session.finalPath);
    } catch (error) {
      this.endSession(session);
      if (error instanceof RecordingSinkError && error.code === 'no-audio') {
        await this.forgetPartial(session.id);
        this.setError('no-audio');
      } else {
        // The `.part` stays registered, so the panel offers to save it.
        this.deps.log?.(`[recording] finalize failed: ${String(error)}`);
        this.setError('write-failed');
      }
      return;
    }
    await this.forgetPartial(session.id);
    this.endSession(session);
    this.notice = errorCode ? `${RECORDING_ERROR_COPY[errorCode]} What was recorded is saved.` : STOP_NOTICES[reason] ?? null;
    this.deps.onChange();
    await this.deps.stageImport(finalPath);
  }

  private async cancel(sessionId: string): Promise<void> {
    const session = this.session;
    if (!session || session.id !== sessionId || session.phase === 'finalizing') return;
    session.phase = 'finalizing';
    this.endSession(session);
    try {
      if (session.sink.dataBytes > 0) {
        // Cancelled audio goes to the trash rather than vanishing (R6).
        await session.sink.checkpoint();
        await this.trash(session.sink.partPath);
      } else {
        await session.sink.discard();
      }
    } catch (error) {
      this.deps.log?.(`[recording] cancel cleanup failed: ${String(error)}`);
    }
    await this.forgetPartial(session.id);
    this.deps.onChange();
  }

  private async captureFailed(sessionId: string, code: RecordingErrorCode): Promise<void> {
    const session = this.session;
    if (!session || session.id !== sessionId || session.phase === 'finalizing') return;
    session.phase = 'finalizing';
    this.endSession(session);
    await session.sink.discard().catch(() => {});
    await this.forgetPartial(session.id);
    this.setError(code);
  }

  /**
   * The webview that owned the capture is gone (reload, panel disposed).
   * Capture ended with it; keep what was written as an interrupted recording
   * the panel offers to save or discard (R6).
   */
  async detach(): Promise<void> {
    this.viewGeneration++;
    const session = this.session;
    if (!session || session.phase === 'finalizing') return;
    session.phase = 'finalizing';
    this.endSession(session);
    await session.sink.checkpoint().catch(() => {});
    if (session.sink.dataBytes === 0) {
      await this.deps.fs.remove(session.sink.partPath).catch(() => {});
      await this.forgetPartial(session.id);
    } else {
      this.notice = INTERRUPTED_NOTICE;
    }
    this.deps.onChange();
  }

  /** Extension shutdown: close the file with a correct header, keep the entry. */
  async dispose(): Promise<void> {
    this.viewGeneration++;
    const session = this.session;
    if (!session) return;
    this.endSession(session);
    await session.sink.checkpoint().catch(() => {});
  }

  // ---------------------------------------------------------------- recovery

  private async recover(partialId: string): Promise<void> {
    const entry = this.partials.find((p) => p.id === partialId);
    if (!entry || this.session?.id === partialId) return;
    let finalPath: string;
    try {
      await rebuildPartial(this.deps.fs, entry.partPath);
      finalPath = await promoteFile(this.deps.fs, entry.partPath, finalPathFor(entry.partPath));
    } catch (error) {
      if (error instanceof RecordingSinkError && error.code === 'no-audio') {
        await this.deps.fs.remove(entry.partPath).catch(() => {});
        await this.forgetPartial(entry.id);
        this.setError('no-audio');
        return;
      }
      this.deps.log?.(`[recording] recovery failed: ${String(error)}`);
      this.setError('write-failed');
      return;
    }
    await this.forgetPartial(entry.id);
    this.notice = null;
    this.deps.onChange();
    await this.deps.stageImport(finalPath);
  }

  private async discard(partialId: string): Promise<void> {
    const entry = this.partials.find((p) => p.id === partialId);
    if (!entry || this.session?.id === partialId) return;
    await this.trash(entry.partPath);
    await this.forgetPartial(entry.id);
    this.notice = null;
    this.deps.onChange();
  }

  private async trash(filePath: string): Promise<void> {
    try {
      await this.deps.moveToTrash(filePath);
    } catch (error) {
      this.deps.log?.(`[recording] trash failed, deleting: ${String(error)}`);
      await this.deps.fs.remove(filePath).catch(() => {});
    }
  }

  // ---------------------------------------------------------------- state

  /** Forget entries whose file is gone; remove partials with no audio (R6). */
  private async visiblePartials(): Promise<PartialRecording[]> {
    const shown: PartialRecording[] = [];
    const keep: PartialEntry[] = [];
    for (const entry of this.partials) {
      if (this.session?.id === entry.id) {
        keep.push(entry);
        continue;
      }
      let size: number;
      try {
        size = await this.deps.fs.size(entry.partPath);
      } catch (error) {
        // Gone for good (moved or deleted outside Ritemark): forget it. Anything
        // else — permissions, an unmounted or syncing folder — may clear, so the
        // entry is kept and offered again once the file is readable.
        if (!isMissing(error)) {
          this.deps.log?.(`[recording] cannot read interrupted recording: ${String(error)}`);
          keep.push(entry);
        }
        continue;
      }
      const dataBytes = recoverableDataBytes(size);
      if (dataBytes === 0) {
        await this.deps.fs.remove(entry.partPath).catch(() => {});
        continue;
      }
      keep.push(entry);
      shown.push({
        id: entry.id,
        fileName: path.basename(finalPathFor(entry.partPath)),
        folderLabel: entry.folderLabel,
        durationSec: durationFromDataBytes(dataBytes),
      });
    }
    if (keep.length !== this.partials.length) await this.setPartials(keep);
    return shown;
  }

  async projection(): Promise<RecordingProjection> {
    const enabled = this.deps.isEnabled();
    const session = this.session;
    const location = this.deps.state.get<string>(NO_FOLDER_LOCATION_KEY);
    return {
      enabled,
      phase: session?.phase ?? 'idle',
      sessionId: session?.id ?? null,
      fileName: session ? path.basename(session.finalPath) : null,
      folderLabel: session?.folderLabel ?? null,
      durationSec: session?.sink.durationSec ?? 0,
      warnLong: session?.warned ?? false,
      noFolderLocation: location ? displayLocation(location, this.deps.home) : null,
      hasProject: this.deps.workspaceFolders().length > 0,
      error: this.error,
      notice: this.notice,
      partials: enabled ? await this.visiblePartials() : [],
    };
  }

  private endSession(session: ActiveSession): void {
    if (this.session === session) this.session = null;
  }

  private setError(code: RecordingErrorCode): void {
    this.error = { code, message: RECORDING_ERROR_COPY[code] };
    this.deps.onChange();
  }

  private async forgetPartial(id: string): Promise<void> {
    if (!this.partials.some((p) => p.id === id)) return;
    await this.setPartials(this.partials.filter((p) => p.id !== id));
  }

  private async setPartials(next: PartialEntry[]): Promise<void> {
    this.partials = next;
    await this.deps.state.update(PARTIALS_KEY, next);
  }
}
