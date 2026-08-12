/**
 * Sprint 108 R2 — the job pipeline state machine.
 *
 * A FakeMemento stands in for `globalState` (the pattern
 * `daemon/DaemonResultStore.test.ts` uses) and a fake engine stands in for a
 * 1.6 GB model, so the queue, cancellation and restart-recovery paths can be
 * tested without spawning anything.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Memento } from 'vscode';
import { JobManager, buildSession, toErrorInfo } from './JobManager';
import { EngineRegistry } from './engineRegistry';
import { SessionStore } from './SessionStore';
import { TranscriptionError } from './types';
import type { JobEvent } from './JobManager';
import type { EngineReadiness, TranscribeOptions, TranscriptionEngine } from './TranscriptionEngine';
import type { TranscriptionJob, TranscriptionResult } from './types';

class FakeMemento implements Memento {
  private readonly data = new Map<string, unknown>();
  keys(): readonly string[] {
    return [...this.data.keys()];
  }
  get<T>(key: string, defaultValue?: T): T {
    return (this.data.has(key) ? this.data.get(key) : defaultValue) as T;
  }
  async update(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }
}

/** Minimal valid mono 16-bit WAV so the real audioPrep gate is exercised. */
function writeWav(filePath: string): void {
  const data = Buffer.alloc(3200 * 2);
  for (let i = 0; i < 3200; i++) data.writeInt16LE(i % 2 === 0 ? 12000 : -12000, i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(filePath, Buffer.concat([header, data]));
}

interface FakeEngineOptions {
  onTranscribe?: (options: TranscribeOptions) => Promise<TranscriptionResult>;
}

function fakeEngine(options: FakeEngineOptions = {}): TranscriptionEngine {
  return {
    id: 'whisper-local',
    label: 'fake',
    isLocal: true,
    platforms: ['darwin', 'win32', 'linux'],
    capabilities: { diarization: true, confidence: true, wordTimestamps: true },
    speakerSeparation: 'diarized',
    acceptsExtensions: ['.wav'],
    isReady: async (): Promise<EngineReadiness> => ({ ready: true }),
    estimateCostUsd: () => null,
    transcribe:
      options.onTranscribe ??
      (async (): Promise<TranscriptionResult> => ({
        segments: [
          { id: 's0', start: 0, end: 2, text: 'Hello there.', speaker: 'speaker_0' },
          { id: 's1', start: 2, end: 4, text: 'Hello back.', speaker: 'speaker_1' },
        ],
        language: 'en',
        speakerSeparation: 'diarized',
      })),
  };
}

function setup(engine: TranscriptionEngine, dir: string): { manager: JobManager; store: SessionStore; events: JobEvent[] } {
  const registry = new EngineRegistry('darwin');
  registry.register(engine);
  const store = new SessionStore(path.join(dir, 'sessions'));
  const manager = new JobManager({ registry, store, workDir: dir, state: new FakeMemento() });
  const events: JobEvent[] = [];
  manager.onEvent((event) => events.push(event));
  return { manager, store, events };
}

function waitFor(predicate: () => boolean, label: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = (): void => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`timed out waiting for ${label}`));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

async function run(): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-jobs-'));

  try {
    const audioPath = path.join(dir, 'meeting.wav');
    writeWav(audioPath);

    // ── happy path ──
    {
      const { manager, store, events } = setup(fakeEngine(), dir);
      const job = manager.enqueue({ audioPath, engineId: 'whisper-local', durationSec: 4, language: null });

      assert.equal(job.state, 'queued');
      assert.equal(job.audioName, 'meeting.wav');

      await waitFor(() => manager.get(job.id)?.state === 'done', 'the job to finish');

      const finished = manager.get(job.id);
      assert.equal(finished?.state, 'done');
      assert.ok(finished?.sessionId, 'a finished job points at its session');
      assert.ok(finished?.endedAt, 'and records when it ended');

      const completed = events.find((event) => event.type === 'job-completed');
      assert.ok(completed, 'completion is announced so the panel and the exporter can react');

      const saved = await store.getForAudio(audioPath);
      assert.ok(saved, 'the session is persisted');
      assert.equal(saved.segments.length, 2);
      assert.equal(saved.speakerSeparation, 'diarized');
      assert.equal(saved.speakers.length, 2, 'speakers are derived from the segments');
      assert.deepEqual(
        saved.speakers.map((speaker) => speaker.label),
        ['Speaker 1', 'Speaker 2'],
        'labels start numbered in first-appearance order',
      );

      const phases = events
        .filter((event): event is Extract<JobEvent, { type: 'job-updated' }> => event.type === 'job-updated')
        .map((event) => event.job.state);
      assert.ok(phases.includes('preparing'), 'the preparing phase is observable');
      assert.ok(phases.includes('saving'), 'so is saving');
    }

    // ── progress passes through, including the indeterminate case ──
    {
      const { manager } = setup(
        fakeEngine({
          onTranscribe: async (options) => {
            options.onProgress({ phase: 'uploading', percent: 42 });
            options.onProgress({ phase: 'transcribing', percent: null });
            return { segments: [{ id: 's0', start: 0, end: 1, text: 'Hi.' }], language: 'en', speakerSeparation: 'none' };
          },
        }),
        dir,
      );

      const seen: Array<number | null> = [];
      manager.onEvent((event) => {
        if (event.type === 'job-updated') seen.push(event.job.progress.percent);
      });

      const job = manager.enqueue({ audioPath, engineId: 'whisper-local', durationSec: 4, language: null });
      await waitFor(() => manager.get(job.id)?.state === 'done', 'progress job to finish');

      assert.ok(seen.includes(42), 'a real percentage reaches the UI');
      assert.ok(
        seen.includes(null),
        'so does an indeterminate phase — a diarized Scribe request has no server-side percentage',
      );
    }

    // ── cancellation ──
    {
      let observedAbort = false;
      const { manager } = setup(
        fakeEngine({
          onTranscribe: (options) =>
            new Promise<TranscriptionResult>((_resolve, reject) => {
              options.signal.addEventListener('abort', () => {
                observedAbort = true;
                reject(new TranscriptionError('cancelled', 'Transcription cancelled.'));
              });
            }),
        }),
        dir,
      );

      const job = manager.enqueue({ audioPath, engineId: 'whisper-local', durationSec: 4, language: null });
      await waitFor(() => manager.get(job.id)?.state === 'transcribing', 'the job to start transcribing');

      manager.cancel(job.id);
      await waitFor(() => manager.get(job.id)?.state === 'cancelled', 'the job to cancel');

      assert.ok(observedAbort, 'the engine is told to stop, so a child process can be killed');
      assert.equal(manager.get(job.id)?.state, 'cancelled');
    }

    // ── failures carry a code, not a stack trace ──
    {
      const { manager, events } = setup(
        fakeEngine({
          onTranscribe: async () => {
            throw new TranscriptionError('invalid-api-key', 'ElevenLabs rejected the API key.');
          },
        }),
        dir,
      );

      const job = manager.enqueue({ audioPath, engineId: 'whisper-local', durationSec: 4, language: null });
      await waitFor(() => manager.get(job.id)?.state === 'failed', 'the job to fail');

      assert.equal(manager.get(job.id)?.error?.code, 'invalid-api-key');
      assert.ok(events.some((event) => event.type === 'job-failed'), 'failure is announced');
    }

    // ── a video file is refused before anything runs ──
    {
      const videoPath = path.join(dir, 'clip.mp4');
      fs.writeFileSync(videoPath, 'not audio');
      const { manager } = setup(fakeEngine(), dir);

      const job = manager.enqueue({ audioPath: videoPath, engineId: 'whisper-local', durationSec: 4, language: null });
      await waitFor(() => manager.get(job.id)?.state === 'failed', 'the video job to fail');
      assert.equal(manager.get(job.id)?.error?.code, 'video-not-supported');
    }

    // ── queueing: one engine run at a time ──
    {
      let concurrent = 0;
      let maxConcurrent = 0;
      const { manager } = setup(
        fakeEngine({
          onTranscribe: async () => {
            concurrent++;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            await new Promise((resolve) => setTimeout(resolve, 60));
            concurrent--;
            return { segments: [{ id: 's0', start: 0, end: 1, text: 'Hi.' }], language: 'en', speakerSeparation: 'none' };
          },
        }),
        dir,
      );

      const first = manager.enqueue({ audioPath, engineId: 'whisper-local', durationSec: 4, language: null });
      const second = manager.enqueue({ audioPath, engineId: 'whisper-local', durationSec: 4, language: null });

      await waitFor(
        () => manager.get(first.id)?.state === 'done' && manager.get(second.id)?.state === 'done',
        'both queued jobs to finish',
      );
      assert.equal(maxConcurrent, 1, 'whisper peaks at ~2.5 GB — two at once would be a memory problem');
    }

    // ── each queued job keeps its OWN request ──
    //
    // The pump loop outlives the enqueue call that starts it, so a naive
    // implementation applies the first job's language to everything queued
    // behind it — and the second recording comes back transcribed as the wrong
    // language with no visible cause.
    {
      const languages: Array<string | null> = [];
      const { manager } = setup(
        fakeEngine({
          onTranscribe: async (options) => {
            languages.push(options.language);
            await new Promise((resolve) => setTimeout(resolve, 40));
            return { segments: [{ id: 's0', start: 0, end: 1, text: 'Hi.' }], language: 'en', speakerSeparation: 'none' };
          },
        }),
        dir,
      );

      const first = manager.enqueue({ audioPath, engineId: 'whisper-local', durationSec: 4, language: 'en' });
      const second = manager.enqueue({ audioPath, engineId: 'whisper-local', durationSec: 4, language: 'et' });

      await waitFor(
        () => manager.get(first.id)?.state === 'done' && manager.get(second.id)?.state === 'done',
        'both language-tagged jobs to finish',
      );
      assert.deepEqual(languages, ['en', 'et'], 'the second job transcribes in ITS language, not the first job\'s');
    }

    // ── restart recovery ──
    {
      const state = new FakeMemento();
      const inflight: TranscriptionJob[] = [
        {
          id: 'job-old',
          audioPath,
          audioName: 'meeting.wav',
          durationSec: 4,
          engine: 'whisper-local',
          state: 'transcribing',
          progress: { phase: 'transcribing', percent: 40 },
          startedAt: '2026-08-12T09:00:00.000Z',
        },
      ];
      await state.update('speech:inflightJobs', inflight);

      const registry = new EngineRegistry('darwin');
      registry.register(fakeEngine());
      const manager = new JobManager({
        registry,
        store: new SessionStore(path.join(dir, 'sessions')),
        workDir: dir,
        state,
      });

      const recovered = await manager.recoverInterrupted();
      assert.equal(recovered.length, 1);
      assert.equal(recovered[0].state, 'interrupted', 'a job cut off by a quit is never silently dropped');
      assert.equal(recovered[0].error?.retryable, true, 'and it can be retried');
      assert.deepEqual(state.get('speech:inflightJobs', []), [], 'the record is cleared once recovered');
    }

    // ── buildSession / toErrorInfo ──
    {
      const built = buildSession({
        audioPath,
        durationSec: 10,
        engineId: 'elevenlabs',
        peaks: [0.2, 0.4],
        result: {
          segments: [
            { id: 's0', start: 0, end: 1, text: 'a', speaker: 'speaker_1' },
            { id: 's1', start: 1, end: 2, text: 'b', speaker: 'speaker_0' },
          ],
          language: 'et',
          speakerSeparation: 'diarized',
          costUsd: 0.17,
        },
      });

      assert.deepEqual(
        built.speakers.map((speaker) => speaker.id),
        ['speaker_1', 'speaker_0'],
        'speakers are ordered by first appearance, not engine numbering',
      );
      assert.deepEqual(built.speakers.map((speaker) => speaker.colorIndex), [0, 1], 'colours are pinned at build time');
      assert.equal(built.costUsd, 0.17);
      assert.equal(built.language, 'et');

      assert.equal(toErrorInfo(new TranscriptionError('offline', 'no net'), false).code, 'offline');
      assert.equal(toErrorInfo(new Error('boom'), true).code, 'cancelled', 'an abort reads as cancelled');
      assert.equal(toErrorInfo(new Error('boom'), false).code, 'unknown');
      assert.equal(toErrorInfo('a string', false).retryable, true);
    }

    console.log('JobManager.test.ts: all tests passed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
