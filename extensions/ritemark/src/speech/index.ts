/**
 * Sprint 108 — assembling the transcription subsystem.
 *
 * One factory so the wiring lives next to the code it wires, and `extension.ts`
 * gets a single call instead of five constructors and a path join.
 */

import * as path from 'path';
import type * as vscode from 'vscode';
import { EngineRegistry } from './engineRegistry';
import { JobManager } from './JobManager';
import { SessionStore } from './SessionStore';
import { WhisperLocalEngine } from './engines/whisperLocalEngine';
import { ElevenLabsEngine } from './engines/elevenLabsEngine';
import { sessionStoreDir, speechWorkDir } from './paths';
import { getModelPath } from '../voiceDictation/modelManager';

export interface SpeechSubsystem {
  registry: EngineRegistry;
  jobs: JobManager;
  store: SessionStore;
}

/**
 * Where the bundled whisper binary lives.
 *
 * `voiceDictation/whisperCpp.getWhisperBinaryPath()` throws on unsupported
 * platforms, which is right for dictation (it never runs there) but wrong here:
 * the registry wants to describe the engine on Windows in order to explain why
 * it is unavailable. So the path is computed without throwing, and readiness is
 * decided by the engine.
 */
function whisperBinaryPath(extensionPath: string): string {
  return path.join(extensionPath, 'binaries', `${process.platform}-${process.arch}`, 'whisper-cli');
}

export function createSpeechSubsystem(context: vscode.ExtensionContext): SpeechSubsystem {
  const registry = new EngineRegistry();

  registry.register(
    new WhisperLocalEngine({
      binaryPath: whisperBinaryPath(context.extensionPath),
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
