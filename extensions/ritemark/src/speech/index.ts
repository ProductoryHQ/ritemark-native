/**
 * Sprint 108 — assembling the transcription subsystem.
 *
 * One factory so the wiring lives next to the code it wires, and `extension.ts`
 * gets a single call instead of five constructors and a path join.
 */

import type * as vscode from 'vscode';
import { EngineRegistry } from './engineRegistry';
import { JobManager } from './JobManager';
import { SessionStore } from './SessionStore';
import { WhisperLocalEngine } from './engines/whisperLocalEngine';
import { ElevenLabsEngine } from './engines/elevenLabsEngine';
import { sessionStoreDir, speechWorkDir } from './paths';
import { getModelPath, getWhisperBinaryPath } from '../voiceDictation/whisperCpp';

export interface SpeechSubsystem {
  registry: EngineRegistry;
  jobs: JobManager;
  store: SessionStore;
}

export function createSpeechSubsystem(context: vscode.ExtensionContext): SpeechSubsystem {
  const registry = new EngineRegistry();

  registry.register(
    new WhisperLocalEngine({
      // Sprint 129 R3: the same resolver dictation uses; it never throws, and
      // the engine's readiness check explains a computer it cannot run on.
      binaryPath: getWhisperBinaryPath(context),
      modelPath: getModelPath(),
      workDir: speechWorkDir(),
    }),
  );

  registry.register(
    new ElevenLabsEngine({
      // `secrets.get` returns a Thenable, not a Promise — awaited here so the
      // engine's contract stays a plain Promise.
      getApiKey: async () => context.secrets.get('elevenlabs-api-key'),
    }),
  );

  const store = new SessionStore(sessionStoreDir(context.globalStorageUri.fsPath));
  const jobs = new JobManager({
    registry,
    store,
    workDir: speechWorkDir(),
    state: context.globalState,
  });

  return { registry, jobs, store };
}

export { EngineRegistry, JobManager, SessionStore };
export * from './types';
