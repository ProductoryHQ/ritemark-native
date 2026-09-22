/**
 * Sprint 118 R3 — the one validated webview → host recording protocol.
 *
 * Every request is decoded against an exact key set: an unknown or missing
 * field rejects the whole message. The webview never names a file path; the
 * host owns every path and addresses partial recordings by an opaque id (R4).
 */

import { MAX_CHUNK_SAMPLES, type RecordingErrorCode, type StopReason } from './types';

export type RecordingRequest =
  | { type: 'transcribe:record/start' }
  | { type: 'transcribe:record/changeLocation' }
  | { type: 'transcribe:record/captureStarted'; sessionId: string }
  | { type: 'transcribe:record/chunk'; sessionId: string; sequence: number; sampleCount: number; pcm: string }
  | { type: 'transcribe:record/stop'; sessionId: string; finalSequence: number; reason: StopReason }
  | { type: 'transcribe:record/cancel'; sessionId: string }
  | { type: 'transcribe:record/captureFailed'; sessionId: string; code: CaptureFailureCode }
  | { type: 'transcribe:record/recover'; partialId: string }
  | { type: 'transcribe:record/discard'; partialId: string }
  | { type: 'transcribe:record/dismissNotice' }
  | { type: 'transcribe:record/openMicrophoneSettings' };

/** Failures the webview can report before any audio exists (R2). */
export type CaptureFailureCode = Extract<
  RecordingErrorCode,
  'os-denied' | 'no-device' | 'device-busy' | 'internal-config' | 'unexpected'
>;

/**
 * Host → webview events that are not part of the state projection.
 * `notStarted` answers a start that produced no session (picker closed,
 * folder unusable, feature off), so the webview can release the audio
 * context it created inside the click. `ended` tells the webview to stop
 * capturing whenever the host closed the session itself (limit, gap, write
 * failure); why is carried by the projection.
 */
export type RecordingEvent =
  | { type: 'transcribe:record/begin'; sessionId: string }
  | { type: 'transcribe:record/notStarted' }
  | { type: 'transcribe:record/ack'; sessionId: string; sequence: number }
  | { type: 'transcribe:record/ended'; sessionId: string };

const STOP_REASONS: readonly StopReason[] = ['user', 'limit', 'suspended', 'device-lost', 'too-slow'];
const CAPTURE_FAILURES: readonly CaptureFailureCode[] = ['os-denied', 'no-device', 'device-busy', 'internal-config', 'unexpected'];
const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
/** Base64 of the largest allowed chunk, rounded up. */
const MAX_PCM_CHARS = Math.ceil((MAX_CHUNK_SAMPLES * 2) / 3) * 4;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

type Raw = Record<string, unknown>;

function exactKeys(message: Raw, keys: string[]): boolean {
  const actual = Object.keys(message);
  return actual.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(message, key));
}

const isId = (value: unknown): value is string => typeof value === 'string' && ID_PATTERN.test(value);
const isCount = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export function isRecordingMessage(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && typeof (raw as Raw).type === 'string'
    && ((raw as Raw).type as string).startsWith('transcribe:record/');
}

/** Returns the typed request, or null for anything malformed. */
export function decodeRecordingRequest(raw: unknown): RecordingRequest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const message = raw as Raw;
  switch (message.type) {
    case 'transcribe:record/start':
    case 'transcribe:record/changeLocation':
    case 'transcribe:record/dismissNotice':
    case 'transcribe:record/openMicrophoneSettings':
      return exactKeys(message, ['type']) ? { type: message.type } : null;
    case 'transcribe:record/captureStarted':
    case 'transcribe:record/cancel':
      return exactKeys(message, ['type', 'sessionId']) && isId(message.sessionId)
        ? { type: message.type, sessionId: message.sessionId }
        : null;
    case 'transcribe:record/chunk':
      if (!exactKeys(message, ['type', 'sessionId', 'sequence', 'sampleCount', 'pcm'])) return null;
      if (!isId(message.sessionId) || !isCount(message.sequence, 0, 10_000_000) || !isCount(message.sampleCount, 1, MAX_CHUNK_SAMPLES)) return null;
      if (typeof message.pcm !== 'string' || message.pcm.length > MAX_PCM_CHARS || !BASE64_PATTERN.test(message.pcm)) return null;
      return { type: 'transcribe:record/chunk', sessionId: message.sessionId, sequence: message.sequence, sampleCount: message.sampleCount, pcm: message.pcm };
    case 'transcribe:record/stop':
      if (!exactKeys(message, ['type', 'sessionId', 'finalSequence', 'reason'])) return null;
      if (!isId(message.sessionId) || !isCount(message.finalSequence, -1, 10_000_000)) return null;
      if (!STOP_REASONS.includes(message.reason as StopReason)) return null;
      return { type: 'transcribe:record/stop', sessionId: message.sessionId, finalSequence: message.finalSequence, reason: message.reason as StopReason };
    case 'transcribe:record/captureFailed':
      if (!exactKeys(message, ['type', 'sessionId', 'code']) || !isId(message.sessionId)) return null;
      if (!CAPTURE_FAILURES.includes(message.code as CaptureFailureCode)) return null;
      return { type: 'transcribe:record/captureFailed', sessionId: message.sessionId, code: message.code as CaptureFailureCode };
    case 'transcribe:record/recover':
    case 'transcribe:record/discard':
      return exactKeys(message, ['type', 'partialId']) && isId(message.partialId)
        ? { type: message.type, partialId: message.partialId }
        : null;
    default:
      return null;
  }
}
