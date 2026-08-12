/**
 * Sprint 108 R12 — session storage.
 *
 * D5 put sessions in hidden app storage, so the guarantees under test here are
 * the ones the user cannot see for themselves: corrections survive, a moved
 * recording does not destroy its transcript, and deleting a session touches
 * nothing but the session.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SessionStore, sessionIdForPath, fingerprintFile } from './SessionStore';
import type { TranscriptSession } from './types';

function session(audioPath: string, overrides: Partial<TranscriptSession> = {}): TranscriptSession {
  return {
    id: sessionIdForPath(audioPath),
    audioPath,
    audioFingerprint: '1:2',
    durationSec: 100,
    createdAt: '2026-08-12T09:00:00.000Z',
    updatedAt: '2026-08-12T09:00:00.000Z',
    engine: 'whisper-local',
    language: 'en',
    speakerSeparation: 'none',
    speakers: [],
    segments: [{ id: 's0', start: 0, end: 5, text: 'Hello.' }],
    peaks: [0.5],
    ...overrides,
  };
}

async function run(): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-sessions-'));
  const audioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-audio-'));

  try {
    const store = new SessionStore(path.join(dir, 'sessions'));

    // ── ids are stable and path-derived ──

    assert.equal(sessionIdForPath('/a/b/call.m4a'), sessionIdForPath('/a/b/call.m4a'), 'same path, same id');
    assert.notEqual(sessionIdForPath('/a/b/call.m4a'), sessionIdForPath('/a/c/call.m4a'), 'path is part of identity');
    assert.match(sessionIdForPath('/a/b/my call (1).m4a'), /^[a-zA-Z0-9-_]+$/, 'ids are filename-safe');

    // ── save and restore ──

    const audioPath = path.join(audioDir, 'call.m4a');
    fs.writeFileSync(audioPath, 'not really audio');

    await store.save(session(audioPath));
    const loaded = await store.getForAudio(audioPath);
    assert.ok(loaded, 'a saved session is found again by its audio path');
    assert.equal(loaded.segments[0].text, 'Hello.');

    assert.equal(await store.get('does-not-exist'), null, 'a missing session is null, not a throw');

    // ── corrections persist ──

    await store.save({
      ...loaded,
      speakerSeparation: 'diarized',
      speakers: [{ id: 'speaker_0', label: 'Kadri', colorIndex: 0 }],
    });
    const renamed = await store.getForAudio(audioPath);
    assert.equal(renamed?.speakers[0].label, 'Kadri', 'a rename survives a reload');
    assert.ok(
      renamed && renamed.updatedAt >= loaded.updatedAt,
      'updatedAt moves forward on save',
    );

    // ── listing ──

    const second = path.join(audioDir, 'later.m4a');
    fs.writeFileSync(second, 'audio');
    await store.save(session(second, { createdAt: '2026-08-13T09:00:00.000Z' }));

    const all = await store.list();
    assert.equal(all.length, 2);
    assert.equal(all[0].audioPath, second, 'newest first');

    // A corrupt session file must not hide the rest of the library.
    fs.writeFileSync(path.join(dir, 'sessions', 'broken.session.json'), '{ not json');
    assert.equal((await store.list()).length, 2, 'an unreadable session is skipped, not fatal');

    // ── moved audio ──

    fs.rmSync(second);
    const states = await store.listWithAudioState();
    const missing = states.find((entry) => entry.audioPath === second);
    assert.equal(missing?.audioMissing, true, 'a vanished recording is flagged');
    assert.equal(missing?.segments.length, 1, 'but its transcript is untouched');

    const movedTo = path.join(audioDir, 'moved.m4a');
    fs.writeFileSync(movedTo, 'audio');
    const relinked = await store.relink(sessionIdForPath(second), movedTo);
    assert.equal(relinked?.audioPath, movedTo, 'relink points the session at the new location');
    assert.equal(relinked?.audioMissing, false);
    assert.equal(relinked?.audioFingerprint, fingerprintFile(movedTo), 'the fingerprint follows the file');

    // ── size and deletion ──

    assert.ok((await store.sizeBytes()) > 0, 'the store can report its own footprint for Settings');

    await store.delete(sessionIdForPath(audioPath));
    assert.equal(await store.getForAudio(audioPath), null, 'the session is gone');
    assert.ok(fs.existsSync(audioPath), 'deleting a session must never delete the recording');

    await store.clear();
    assert.deepEqual(await store.list(), [], 'clear empties the store');
    assert.ok(fs.existsSync(audioPath), 'clear still leaves the audio alone');

    console.log('SessionStore.test.ts: all tests passed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(audioDir, { recursive: true, force: true });
  }
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
