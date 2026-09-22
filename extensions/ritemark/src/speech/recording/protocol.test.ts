/**
 * Sprint 118 R3 — the recording protocol accepts exactly its message shapes.
 *
 * The webview is untrusted input: a path, an extra field, an oversized chunk
 * or a made-up stop reason rejects the whole message.
 */
import assert from 'node:assert/strict';
import { decodeRecordingRequest, isRecordingMessage } from './protocol';
import { MAX_CHUNK_SAMPLES } from './types';

const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
const pcm = Buffer.alloc(32_000).toString('base64');

function run(): void {
  // --- routing
  assert.ok(isRecordingMessage({ type: 'transcribe:record/start' }));
  assert.ok(!isRecordingMessage({ type: 'transcribe:start' }));
  assert.ok(!isRecordingMessage(null));
  assert.ok(!isRecordingMessage({ type: 7 }));

  // --- bare messages
  for (const type of ['transcribe:record/start', 'transcribe:record/changeLocation', 'transcribe:record/dismissNotice', 'transcribe:record/openMicrophoneSettings']) {
    assert.deepEqual(decodeRecordingRequest({ type }), { type });
    assert.equal(decodeRecordingRequest({ type, path: '/etc' }), null, `${type} takes no fields`);
  }

  // --- session messages
  assert.deepEqual(decodeRecordingRequest({ type: 'transcribe:record/captureStarted', sessionId: id }), { type: 'transcribe:record/captureStarted', sessionId: id });
  assert.deepEqual(decodeRecordingRequest({ type: 'transcribe:record/cancel', sessionId: id }), { type: 'transcribe:record/cancel', sessionId: id });
  assert.equal(decodeRecordingRequest({ type: 'transcribe:record/cancel' }), null, 'missing session id');
  assert.equal(decodeRecordingRequest({ type: 'transcribe:record/cancel', sessionId: '../../x' }), null, 'ids are opaque tokens, never paths');
  assert.equal(decodeRecordingRequest({ type: 'transcribe:record/cancel', sessionId: 'short' }), null);

  // --- chunks
  const chunk = { type: 'transcribe:record/chunk', sessionId: id, sequence: 0, sampleCount: 16_000, pcm };
  assert.deepEqual(decodeRecordingRequest(chunk), chunk);
  assert.equal(decodeRecordingRequest({ ...chunk, extra: 1 }), null, 'unknown field');
  assert.equal(decodeRecordingRequest({ ...chunk, sequence: -1 }), null);
  assert.equal(decodeRecordingRequest({ ...chunk, sequence: 1.5 }), null);
  assert.equal(decodeRecordingRequest({ ...chunk, sequence: '0' }), null);
  assert.equal(decodeRecordingRequest({ ...chunk, sampleCount: 0 }), null);
  assert.equal(decodeRecordingRequest({ ...chunk, sampleCount: MAX_CHUNK_SAMPLES + 1 }), null, 'chunks are bounded');
  assert.equal(decodeRecordingRequest({ ...chunk, pcm: Buffer.alloc(MAX_CHUNK_SAMPLES * 2 + 3).toString('base64') }), null, 'payload is bounded');
  assert.equal(decodeRecordingRequest({ ...chunk, pcm: 'not base64!' }), null);
  assert.equal(decodeRecordingRequest({ ...chunk, pcm: [1, 2] }), null);
  assert.ok(decodeRecordingRequest({ ...chunk, sampleCount: MAX_CHUNK_SAMPLES, pcm: Buffer.alloc(MAX_CHUNK_SAMPLES * 2).toString('base64') }), 'the largest chunk fits');

  // --- stop
  const stop = { type: 'transcribe:record/stop', sessionId: id, finalSequence: 12, reason: 'user' };
  assert.deepEqual(decodeRecordingRequest(stop), stop);
  assert.ok(decodeRecordingRequest({ ...stop, finalSequence: -1 }), 'stop before the first chunk');
  assert.equal(decodeRecordingRequest({ ...stop, finalSequence: -2 }), null);
  for (const reason of ['limit', 'suspended', 'device-lost', 'too-slow']) {
    assert.ok(decodeRecordingRequest({ ...stop, reason }), reason);
  }
  assert.equal(decodeRecordingRequest({ ...stop, reason: 'bored' }), null);

  // --- capture failures: only the ones that can happen before audio exists
  for (const code of ['os-denied', 'no-device', 'device-busy', 'internal-config', 'unexpected']) {
    assert.ok(decodeRecordingRequest({ type: 'transcribe:record/captureFailed', sessionId: id, code }), code);
  }
  assert.equal(decodeRecordingRequest({ type: 'transcribe:record/captureFailed', sessionId: id, code: 'write-failed' }), null);

  // --- partials are addressed by id
  assert.deepEqual(decodeRecordingRequest({ type: 'transcribe:record/recover', partialId: id }), { type: 'transcribe:record/recover', partialId: id });
  assert.deepEqual(decodeRecordingRequest({ type: 'transcribe:record/discard', partialId: id }), { type: 'transcribe:record/discard', partialId: id });
  assert.equal(decodeRecordingRequest({ type: 'transcribe:record/discard', partialId: '/Users/x/a.wav.part' }), null);
  assert.equal(decodeRecordingRequest({ type: 'transcribe:record/discard', partialId: id, path: '/x' }), null);

  assert.equal(decodeRecordingRequest({ type: 'transcribe:record/unknown' }), null);
  assert.equal(decodeRecordingRequest('transcribe:record/start'), null);

  console.log('protocol.test.ts: all tests passed');
}

run();
