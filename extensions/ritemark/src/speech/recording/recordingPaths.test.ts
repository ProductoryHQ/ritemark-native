/**
 * Sprint 118 R4 — where a recording goes and what it is called.
 *
 * The destination rules were decided by Jarmo on 2026-09-22 (Phase 0 §5); the
 * WAV header is the exact shape every saved recording must have.
 */
import assert from 'node:assert/strict';
import * as path from 'path';
import {
  decideDestination,
  displayLocation,
  durationFromDataBytes,
  finalPathFor,
  isInside,
  isValidWavHeader,
  recordingBaseName,
  reserveRecordingPath,
  wavHeader,
} from './recordingPaths';

async function run(): Promise<void> {
  const home = path.join(path.sep, 'Users', 'maria');
  const notes = { name: 'Notes', path: path.join(home, 'Notes') };
  const work = { name: 'Work', path: path.join(home, 'Work') };

  // --- containment
  assert.ok(isInside(path.join(notes.path, 'a.md'), notes.path));
  assert.ok(isInside(notes.path, notes.path));
  assert.ok(!isInside(path.join(home, 'NotesOld', 'a.md'), notes.path), 'a sibling with a shared prefix is not inside');
  assert.ok(!isInside(home, notes.path));

  // --- one folder open → <folder>/recordings
  assert.deepEqual(
    decideDestination({ workspaceFolders: [notes], activeFilePath: null, rememberedLocation: '/elsewhere', home }),
    { kind: 'folder', dir: path.join(notes.path, 'recordings'), label: 'Notes/recordings' },
    'a project always wins over the remembered no-folder location',
  );

  // --- several folders → the active file's folder, otherwise ask
  assert.deepEqual(
    decideDestination({ workspaceFolders: [notes, work], activeFilePath: path.join(work.path, 'plan.md'), rememberedLocation: null, home }),
    { kind: 'folder', dir: path.join(work.path, 'recordings'), label: 'Work/recordings' },
  );
  assert.deepEqual(
    decideDestination({ workspaceFolders: [notes, work], activeFilePath: path.join(home, 'Downloads', 'x.md'), rememberedLocation: null, home }),
    { kind: 'choose-workspace-folder', folders: [notes, work] },
    'an active file outside every folder does not pick one',
  );
  assert.equal(decideDestination({ workspaceFolders: [notes, work], activeFilePath: null, rememberedLocation: null, home }).kind, 'choose-workspace-folder');

  // --- no folder → ask first, then use the remembered choice
  assert.deepEqual(decideDestination({ workspaceFolders: [], activeFilePath: null, rememberedLocation: null, home }), { kind: 'choose-location' });
  const remembered = path.join(home, 'Recordings');
  assert.deepEqual(
    decideDestination({ workspaceFolders: [], activeFilePath: null, rememberedLocation: remembered, home }),
    { kind: 'folder', dir: remembered, label: path.join('~', 'Recordings') },
  );

  // --- display
  assert.equal(displayLocation(path.join(home, 'Music', 'Rec'), home), path.join('~', 'Music', 'Rec'));
  assert.equal(displayLocation(path.join(path.sep, 'Volumes', 'Rec'), home), path.join(path.sep, 'Volumes', 'Rec'));
  assert.equal(displayLocation('/x', ''), '/x', 'no home: shown as is');

  // --- names
  assert.equal(recordingBaseName(new Date(2026, 8, 2, 9, 5)), 'Recording 2026-09-02 09.05');
  assert.doesNotMatch(recordingBaseName(new Date()), /[:/\\]/, 'the name is safe on every filesystem');

  const dir = path.join(notes.path, 'recordings');
  const base = 'Recording 2026-09-22 14.05';
  const taken = new Set<string>();
  const exists = async (p: string) => taken.has(p);
  assert.deepEqual(await reserveRecordingPath(dir, base, exists), {
    finalPath: path.join(dir, `${base}.wav`),
    partPath: path.join(dir, `${base}.wav.part`),
  });
  taken.add(path.join(dir, `${base}.wav`));
  assert.equal((await reserveRecordingPath(dir, base, exists)).finalPath, path.join(dir, `${base} (2).wav`), 'an existing recording is never overwritten');
  taken.add(path.join(dir, `${base} (2).wav.part`));
  assert.equal((await reserveRecordingPath(dir, base, exists)).finalPath, path.join(dir, `${base} (3).wav`), 'an interrupted partial also holds its name');
  await assert.rejects(reserveRecordingPath(dir, base, async () => true), /No free recording name/);

  assert.equal(finalPathFor('/r/a.wav.part'), '/r/a.wav');
  assert.equal(finalPathFor('/r/a.wav'), '/r/a.wav');

  // --- WAV header: 16 kHz mono PCM16
  const header = wavHeader(32_000);
  assert.equal(header.length, 44);
  assert.equal(header.toString('ascii', 0, 4), 'RIFF');
  assert.equal(header.readUInt32LE(4), 36 + 32_000);
  assert.equal(header.toString('ascii', 8, 16), 'WAVEfmt ');
  assert.equal(header.readUInt16LE(20), 1, 'PCM');
  assert.equal(header.readUInt16LE(22), 1, 'mono');
  assert.equal(header.readUInt32LE(24), 16_000);
  assert.equal(header.readUInt32LE(28), 32_000, 'byte rate');
  assert.equal(header.readUInt16LE(32), 2, 'block align');
  assert.equal(header.readUInt16LE(34), 16);
  assert.equal(header.toString('ascii', 36, 40), 'data');
  assert.equal(header.readUInt32LE(40), 32_000);
  assert.ok(isValidWavHeader(header, 32_000));
  assert.ok(!isValidWavHeader(header, 32_002), 'a header for another length is rejected');
  assert.ok(!isValidWavHeader(wavHeader(0), 32_000), 'the placeholder header is not a finished file');
  assert.ok(!isValidWavHeader(header.subarray(0, 40), 32_000));

  assert.equal(durationFromDataBytes(32_000 * 90), 90);

  console.log('recordingPaths.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
