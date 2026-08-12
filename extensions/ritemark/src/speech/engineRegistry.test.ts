/**
 * Sprint 108 R13 — platform gating and engine selection.
 *
 * The Windows story (D4) is enforced here: the on-device engine is not hidden
 * on Windows, it is reported as present-but-unavailable with a reason, so the
 * UI can say why instead of showing a dead control.
 */
import assert from 'node:assert/strict';
import { EngineRegistry } from './engineRegistry';
import type { EngineReadiness, TranscriptionEngine } from './TranscriptionEngine';
import type { Platform } from '../utils/platform';
import { TranscriptionError } from './types';

function fakeEngine(overrides: Partial<TranscriptionEngine> & { id: string }): TranscriptionEngine {
  return {
    label: overrides.id,
    isLocal: false,
    platforms: ['darwin', 'win32'] as Platform[],
    capabilities: { diarization: false, confidence: true, wordTimestamps: true },
    speakerSeparation: 'none',
    acceptsExtensions: ['.wav'],
    isReady: async (): Promise<EngineReadiness> => ({ ready: true }),
    estimateCostUsd: () => null,
    transcribe: async () => ({ segments: [], language: null, speakerSeparation: 'none' }),
    ...overrides,
  };
}

async function run(): Promise<void> {
  const local = fakeEngine({
    id: 'whisper-local',
    label: 'On-device · Whisper',
    isLocal: true,
    platforms: ['darwin'],
  });
  const cloud = fakeEngine({
    id: 'elevenlabs',
    label: 'ElevenLabs Scribe',
    platforms: ['darwin', 'win32', 'linux'],
    capabilities: { diarization: true, confidence: true, wordTimestamps: true },
    speakerSeparation: 'diarized',
  });

  // ── macOS: both engines usable ──

  const mac = new EngineRegistry('darwin');
  mac.register(local);
  mac.register(cloud);

  assert.equal(mac.all().length, 2);
  assert.equal(mac.supported().length, 2);
  assert.equal(mac.get('whisper-local').id, 'whisper-local');

  // ── Windows: local is present but unavailable ──

  const win = new EngineRegistry('win32');
  win.register(local);
  win.register(cloud);

  assert.equal(win.supported().length, 1, 'only the cloud engine can run');
  assert.equal(win.supported()[0].id, 'elevenlabs');

  assert.throws(
    () => win.get('whisper-local'),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptionError);
      assert.equal(error.code, 'engine-unavailable');
      return true;
    },
    'asking for an unsupported engine is a coded refusal',
  );

  const statuses = await win.statuses();
  assert.equal(statuses.length, 2, 'unsupported engines are still reported — the user needs to know why');
  const localStatus = statuses.find((entry) => entry.id === 'whisper-local');
  assert.equal(localStatus?.supportedOnPlatform, false);
  assert.equal(localStatus?.readiness.ready, false);
  assert.match(
    localStatus?.readiness.ready === false ? localStatus.readiness.reason : '',
    /Windows/,
    'the reason names the platform',
  );

  const cloudStatus = statuses.find((entry) => entry.id === 'elevenlabs');
  assert.equal(cloudStatus?.supportedOnPlatform, true);
  assert.equal(cloudStatus?.diarization, true, 'the card can advertise speaker separation');

  assert.throws(() => mac.get('nope'), /not available/, 'unknown engines refuse cleanly');

  // ── preference: privacy first, then whatever is ready ──

  assert.equal((await mac.preferred())?.id, 'whisper-local', 'a ready local engine is the default (D6)');
  assert.equal((await mac.preferred('elevenlabs'))?.id, 'elevenlabs', 'the last choice wins when still ready');
  assert.equal((await win.preferred('whisper-local'))?.id, 'elevenlabs', 'an unusable last choice falls back');

  const notReadyLocal = fakeEngine({
    id: 'whisper-local',
    isLocal: true,
    platforms: ['darwin'],
    isReady: async (): Promise<EngineReadiness> => ({
      ready: false,
      reason: 'Model not downloaded — 1.5 GB, one time.',
      action: 'download-model',
    }),
  });

  const noModel = new EngineRegistry('darwin');
  noModel.register(notReadyLocal);
  noModel.register(cloud);
  assert.equal((await noModel.preferred())?.id, 'elevenlabs', 'an unready local engine is not preselected');

  const nothingReady = new EngineRegistry('darwin');
  nothingReady.register(notReadyLocal);
  assert.equal(await nothingReady.preferred(), null, 'with nothing ready there is no preselection');

  console.log('engineRegistry.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
