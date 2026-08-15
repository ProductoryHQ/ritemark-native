/**
 * Sprint 108 — where the transcription subsystem keeps its files.
 *
 * One place, because two callers need to agree: the Settings page reports and
 * clears the store, and the job pipeline writes to it. A drifting second copy
 * of this join would leave "Clear transcription data" pointing at an empty
 * directory while the real sessions stayed on disk.
 */

import * as os from 'os';
import * as path from 'path';

/** Sessions live under the extension's global storage (D5). */
export function sessionStoreDir(globalStorageFsPath: string): string {
  return path.join(globalStorageFsPath, 'transcripts');
}

/**
 * Scratch space for converted WAVs and whisper's JSON sidecar.
 *
 * The system temp dir, not global storage: these are per-job and deleted when
 * the job ends, and an hour of 16 kHz mono is ~110 MB that should never look
 * like part of the user's data.
 */
export function speechWorkDir(): string {
  return os.tmpdir();
}
