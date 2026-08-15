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

    // Ids are path-derived, so a relink MUST re-key: every lookup goes through
    // sessionIdForPath(currentPath). Without this the transcript survives on
    // disk but the recording opens as "not transcribed yet".
    assert.equal(relinked?.id, sessionIdForPath(movedTo), 'the session is re-keyed to the new path');
    const foundAtNewPath = await store.getForAudio(movedTo);
    assert.ok(foundAtNewPath, 'and is found by the path it now lives at');
    assert.equal(foundAtNewPath.segments.length, 1, 'with its transcript intact');
    assert.equal(await store.get(sessionIdForPath(second)), null, 'the stale entry is gone — no duplicate');

    // ── the library is project-scoped ──
    //
    // Sessions live in GLOBAL storage, so without this filter every folder
    // shows every other folder's recordings.
    const projectA = path.join(dir, 'project-a');
    const projectB = path.join(dir, 'project-b');
    const inA = path.join(audioDir, 'a.m4a');
    const inB = path.join(audioDir, 'b.m4a');
    fs.writeFileSync(inA, 'audio');
    fs.writeFileSync(inB, 'audio');
    await store.save(session(inA, { workspaceRoot: projectA }));
    await store.save(session(inB, { workspaceRoot: projectB }));

    const forA = await store.listForWorkspace(projectA);
    assert.deepEqual(
      forA.map((entry) => path.basename(entry.audioPath)),
      ['a.m4a'],
      'a project sees only its own recordings',
    );
    assert.equal((await store.listForWorkspace(projectB)).length, 1);
    assert.equal(
      (await store.listForWorkspace(path.join(dir, 'never-used'))).length,
      0,
      'an unrelated folder sees nothing',
    );

    // A recording transcribed with no folder open belongs to the no-folder case,
    // and must not leak into a project.
    const loose = path.join(audioDir, 'loose.m4a');
    fs.writeFileSync(loose, 'audio');
    await store.save(session(loose, { workspaceRoot: null }));
    assert.equal(
      (await store.listForWorkspace(projectA)).length,
      1,
      'a folderless recording does not appear inside a project',
    );
    // Sessions written before project scoping existed have no `workspaceRoot`,
    // so they land in the no-folder case too. That is the migration we want:
    // nothing is lost, and nothing pollutes a project it was not made in.
    const folderless = await store.listForWorkspace(null);
    assert.ok(
      folderless.some((entry) => path.basename(entry.audioPath) === 'loose.m4a'),
      'a folderless recording is visible with no folder open',
    );
    assert.ok(
      folderless.every((entry) => (entry.workspaceRoot ?? null) === null),
      'and only folderless ones are',
    );

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
