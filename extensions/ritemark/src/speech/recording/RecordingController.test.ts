/**
 * Sprint 118 R3/R4/R5/R6 — the host side of a direct recording.
 *
 * Runs the controller against a real temporary folder. What is under test is
 * what a user would lose if it were wrong: where the file goes, that a Stop
 * always ends in a valid WAV handed to the existing import path, that nothing
 * is overwritten, and that every interruption leaves audio that can be saved.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { RecordingEvent, RecordingRequest } from './protocol';
import { INTERRUPTED_NOTICE, NO_FOLDER_LOCATION_KEY, PARTIALS_KEY, RecordingController, type RecordingControllerDeps } from './RecordingController';
import { isValidWavHeader, wavHeader, type WorkspaceFolderInfo } from './recordingPaths';
import { MAX_DATA_BYTES, WAV_HEADER_BYTES } from './types';
import { nodeSinkFs, type SinkFs, type SinkFile } from './WavRecordingSink';

const NAME = 'Recording 2026-09-22 14.05';

interface Harness {
  controller: RecordingController;
  deps: RecordingControllerDeps;
  store: Map<string, unknown>;
  events: RecordingEvent[];
  staged: string[];
  trashed: string[];
  locationAsks: Array<string | null>;
  folderAsks: number;
  settingsOpened: number;
  set: {
    folders(folders: WorkspaceFolderInfo[]): void;
    active(file: string | null): void;
    pickLocation(dir: string | undefined): void;
    pickFolder(folder: WorkspaceFolderInfo | undefined): void;
    enabled(on: boolean): void;
  };
}

function harness(root: string, opts: { fs?: SinkFs; store?: Map<string, unknown>; folders?: WorkspaceFolderInfo[] } = {}): Harness {
  const store = opts.store ?? new Map<string, unknown>();
  const trashDir = path.join(root, '.Trash');
  fs.mkdirSync(trashDir, { recursive: true });
  let folders = opts.folders ?? [];
  let active: string | null = null;
  let pickLocation: string | undefined;
  let pickFolder: WorkspaceFolderInfo | undefined;
  let enabled = true;
  let ids = 0;
  const h: Harness = {
    store,
    events: [],
    staged: [],
    trashed: [],
    locationAsks: [],
    folderAsks: 0,
    settingsOpened: 0,
    set: {
      folders: (f) => { folders = f; },
      active: (f) => { active = f; },
      pickLocation: (d) => { pickLocation = d; },
      pickFolder: (f) => { pickFolder = f; },
      enabled: (on) => { enabled = on; },
    },
  } as unknown as Harness;
  h.deps = {
    fs: opts.fs ?? nodeSinkFs,
    state: { get: <T>(key: string) => store.get(key) as T | undefined, update: async (key, value) => { store.set(key, value); } },
    newId: () => `session-${String(++ids).padStart(4, '0')}-${Math.random().toString(16).slice(2, 8)}`,
    now: () => new Date(2026, 8, 22, 14, 5),
    home: root,
    isEnabled: () => enabled,
    workspaceFolders: () => folders,
    activeFilePath: () => active,
    chooseWorkspaceFolder: async () => { h.folderAsks++; return pickFolder; },
    chooseLocation: async (current) => { h.locationAsks.push(current); return pickLocation; },
    stageImport: async (p) => { h.staged.push(p); },
    moveToTrash: async (p) => {
      h.trashed.push(p);
      fs.renameSync(p, path.join(trashDir, `${h.trashed.length}-${path.basename(p)}`));
    },
    postEvent: (e) => h.events.push(e),
    openMicrophoneSettings: () => { h.settingsOpened++; },
    onChange: () => {},
  };
  h.controller = new RecordingController(h.deps);
  return h;
}

const pcmOf = (samples: number, value: number) => Buffer.alloc(samples * 2, value).toString('base64');

function chunk(sessionId: string, sequence: number, samples = 16_000, value = sequence + 1): RecordingRequest {
  return { type: 'transcribe:record/chunk', sessionId, sequence, sampleCount: samples, pcm: pcmOf(samples, value) };
}

async function begin(h: Harness): Promise<string> {
  await h.controller.handle({ type: 'transcribe:record/start' });
  const event = h.events.filter((e) => e.type === 'transcribe:record/begin').pop();
  assert.ok(event, 'start posts begin');
  return event.sessionId;
}

const acks = (h: Harness, sessionId: string) =>
  h.events.filter((e) => e.type === 'transcribe:record/ack' && e.sessionId === sessionId).map((e) => (e as { sequence: number }).sequence);
const ended = (h: Harness, sessionId: string) => h.events.some((e) => e.type === 'transcribe:record/ended' && e.sessionId === sessionId);

function assertValidWav(file: string, dataBytes: number): void {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.length, WAV_HEADER_BYTES + dataBytes, `${path.basename(file)} length`);
  assert.ok(isValidWavHeader(bytes.subarray(0, WAV_HEADER_BYTES), dataBytes), `${path.basename(file)} header`);
}

/** A filesystem that records sizes and headers but stores no audio, for the four-hour limit. */
function sparseFs(): SinkFs {
  const files = new Map<string, { size: number; header: Buffer }>();
  const handle = (entry: { size: number; header: Buffer }): SinkFile => ({
    async write(buffer, position) {
      if (position === 0) entry.header = Buffer.from(buffer.subarray(0, WAV_HEADER_BYTES));
      entry.size = Math.max(entry.size, position + buffer.length);
    },
    async read(buffer) { return entry.header.copy(buffer); },
    async truncate(length) { entry.size = length; },
    async sync() {},
    async close() {},
  });
  return {
    async open(p, mode) {
      if (mode === 'create') {
        if (files.has(p)) throw new Error('EEXIST');
        files.set(p, { size: 0, header: Buffer.alloc(0) });
      }
      const entry = files.get(p);
      if (!entry) throw new Error('ENOENT');
      return handle(entry);
    },
    async size(p) { const e = files.get(p); if (!e) throw new Error('ENOENT'); return e.size; },
    async exists(p) { return files.has(p); },
    async rename(from, to) { const e = files.get(from); if (!e) throw new Error('ENOENT'); files.delete(from); files.set(to, e); },
    async remove(p) { files.delete(p); },
    async mkdirp() {},
  };
}

/** nodeSinkFs whose audio writes fail after `okWrites` successful ones. */
function failingFs(okWrites: number): SinkFs {
  return {
    ...nodeSinkFs,
    async open(p, mode) {
      const file = await nodeSinkFs.open(p, mode);
      let n = 0;
      return {
        ...file,
        async write(buffer, position) {
          if (position > 0 && ++n > okWrites) throw new Error('EIO: i/o error');
          return file.write(buffer, position);
        },
      };
    },
  };
}

async function run(): Promise<void> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-recording-')));
  const project = { name: 'Notes', path: path.join(root, 'Notes') };
  fs.mkdirSync(project.path);
  const recordings = path.join(project.path, 'recordings');
  const fresh = () => fs.rmSync(recordings, { recursive: true, force: true });

  try {
    // ------------------------------------------------ happy path in a project
    {
      fresh();
      const h = harness(root, { folders: [project] });
      const id = await begin(h);
      const part = path.join(recordings, `${NAME}.wav.part`);
      assert.ok(fs.existsSync(part), 'the .part exists before any audio');
      assert.equal((h.store.get(PARTIALS_KEY) as unknown[]).length, 1, 'registered for crash recovery at once');
      let view = await h.controller.projection();
      assert.equal(view.phase, 'preparing');
      assert.equal(view.fileName, `${NAME}.wav`);
      assert.equal(view.folderLabel, 'Notes/recordings');
      assert.deepEqual(view.partials, [], 'the live recording is not offered for recovery');

      await h.controller.handle({ type: 'transcribe:record/captureStarted', sessionId: id });
      assert.equal((await h.controller.projection()).phase, 'recording');

      // Fired without awaiting, like the webview bridge does.
      const pending = [0, 1, 2].map((n) => h.controller.handle(chunk(id, n)));
      await Promise.all(pending);
      assert.deepEqual(acks(h, id), [0, 1, 2]);
      view = await h.controller.projection();
      assert.equal(view.durationSec, 3, 'duration comes from audio on disk');

      await h.controller.handle({ type: 'transcribe:record/stop', sessionId: id, finalSequence: 2, reason: 'user' });
      const final = path.join(recordings, `${NAME}.wav`);
      assert.deepEqual(h.staged, [final], 'a finished recording goes to the existing import path');
      assert.ok(!fs.existsSync(part));
      assertValidWav(final, 3 * 32_000);
      const body = fs.readFileSync(final).subarray(WAV_HEADER_BYTES);
      assert.deepEqual([body[0], body[32_000], body[64_000]], [1, 2, 3], 'chunks in order');
      assert.deepEqual(h.store.get(PARTIALS_KEY), [], 'nothing left to recover');
      view = await h.controller.projection();
      assert.equal(view.phase, 'idle');
      assert.equal(view.notice, null, 'a normal stop needs no notice');
      assert.equal(view.error, null);

      // Late or stale messages for the finished session change nothing.
      await h.controller.handle(chunk(id, 3));
      await h.controller.handle({ type: 'transcribe:record/stop', sessionId: id, finalSequence: 3, reason: 'user' });
      assert.deepEqual(acks(h, id), [0, 1, 2]);
      assert.equal(h.staged.length, 1);

      // A second recording in the same minute gets its own name.
      const second = await begin(h);
      await h.controller.handle(chunk(second, 0));
      await h.controller.handle({ type: 'transcribe:record/stop', sessionId: second, finalSequence: 0, reason: 'user' });
      assert.equal(h.staged[1], path.join(recordings, `${NAME} (2).wav`), 'an existing recording is never overwritten');
      assertValidWav(final, 3 * 32_000);
    }

    // ------------------------------------------------ duplicates, gaps, stale sessions
    {
      fresh();
      const h = harness(root, { folders: [project] });
      const id = await begin(h);
      await h.controller.handle(chunk(id, 0));
      await h.controller.handle(chunk(id, 0, 16_000, 99));
      assert.deepEqual(acks(h, id), [0, 0], 'a duplicate is acknowledged again');
      await h.controller.handle(chunk('other-session-0000', 1));
      assert.deepEqual(acks(h, id), [0, 0], 'another session is ignored');
      assert.equal(acks(h, 'other-session-0000').length, 0);

      await h.controller.handle(chunk(id, 2));
      assert.ok(ended(h, id), 'a gap ends the capture');
      const saved = h.staged.pop()!;
      assertValidWav(saved, 32_000);
      assert.equal(fs.readFileSync(saved)[WAV_HEADER_BYTES], 1, 'the duplicate did not replace the original');
      const view = await h.controller.projection();
      assert.equal(view.phase, 'idle');
      assert.match(view.notice ?? '', /stopped unexpectedly.*What was recorded is saved/);
    }
    {
      fresh();
      const h = harness(root, { folders: [project] });
      const id = await begin(h);
      await h.controller.handle(chunk(id, 0));
      await h.controller.handle({ type: 'transcribe:record/chunk', sessionId: id, sequence: 1, sampleCount: 16_000, pcm: pcmOf(100, 1) });
      assert.ok(ended(h, id), 'a chunk whose audio does not match its sample count ends the capture');
      assertValidWav(h.staged.pop()!, 32_000);
    }
    {
      fresh();
      const h = harness(root, { folders: [project] });
      const id = await begin(h);
      await h.controller.handle(chunk(id, 0));
      await h.controller.handle(chunk(id, 1));
      await h.controller.handle({ type: 'transcribe:record/stop', sessionId: id, finalSequence: 2, reason: 'user' });
      assertValidWav(h.staged.pop()!, 64_000);
      assert.match((await h.controller.projection()).notice ?? '', /unexpectedly/, 'a lost final chunk is not hidden');
    }
    {
      fresh();
      const h = harness(root, { folders: [project] });
      const id = await begin(h);
      await h.controller.handle(chunk(id, 0));
      await h.controller.handleMalformed();
      assert.ok(ended(h, id), 'a malformed message ends the capture honestly');
      assertValidWav(h.staged.pop()!, 32_000);
      await h.controller.handleMalformed(); // with no session: harmless
    }

    // ------------------------------------------------ stops the user did not press
    {
      fresh();
      const h = harness(root, { folders: [project] });
      const id = await begin(h);
      await h.controller.handle(chunk(id, 0));
      await h.controller.handle({ type: 'transcribe:record/stop', sessionId: id, finalSequence: 0, reason: 'suspended' });
      assertValidWav(h.staged.pop()!, 32_000);
      assert.match((await h.controller.projection()).notice ?? '', /paused audio input.*saved/);
      await h.controller.handle({ type: 'transcribe:record/dismissNotice' });
      assert.equal((await h.controller.projection()).notice, null);
    }
    {
      fresh();
      const h = harness(root, { folders: [project] });
      const id = await begin(h);
      await h.controller.handle({ type: 'transcribe:record/stop', sessionId: id, finalSequence: -1, reason: 'user' });
      assert.deepEqual(h.staged, [], 'nothing captured, nothing imported');
      const view = await h.controller.projection();
      assert.equal(view.error?.code, 'no-audio');
      assert.deepEqual(view.partials, []);
      assert.deepEqual(h.store.get(PARTIALS_KEY), []);
    }

    // ------------------------------------------------ four-hour limit
    {
      fresh();
      const h = harness(root, { folders: [project], fs: sparseFs() });
      const id = await begin(h);
      await h.controller.handle(chunk(id, 0));
      const session = (h.controller as unknown as { session: { sink: { _dataBytes: number; _writtenBytes: number } } }).session;
      session.sink._dataBytes = MAX_DATA_BYTES - 16_000;
      session.sink._writtenBytes = MAX_DATA_BYTES - 16_000;
      await h.controller.handle(chunk(id, 1, 16_000));
      assert.deepEqual(acks(h, id), [0, 1]);
      assert.ok(ended(h, id), 'the host stops at four hours even if the webview does not');
      assert.equal(h.staged.length, 1);
      assert.match((await h.controller.projection()).notice ?? '', /4-hour limit/);
    }
    {
      fresh();
      const h = harness(root, { folders: [project], fs: sparseFs() });
      const id = await begin(h);
      const session = (h.controller as unknown as { session: { sink: { _dataBytes: number; _writtenBytes: number } } }).session;
      session.sink._dataBytes = 2 * 3600 * 32_000 - 32_000;
      session.sink._writtenBytes = 2 * 3600 * 32_000 - 32_000;
      assert.equal((await h.controller.projection()).warnLong, false);
      await h.controller.handle(chunk(id, 0));
      assert.equal((await h.controller.projection()).warnLong, true, 'warned at two hours');
      assert.ok(!ended(h, id), 'the warning does not stop the recording');
      await h.controller.handle({ type: 'transcribe:record/cancel', sessionId: id });
    }

    // ------------------------------------------------ one session at a time
    {
      fresh();
      const h = harness(root, { folders: [project] });
      const id = await begin(h);
      await h.controller.handle({ type: 'transcribe:record/start' });
      assert.equal(h.events.filter((e) => e.type === 'transcribe:record/begin').length, 1);
      assert.equal(h.controller.activeSessionId, id);
      assert.equal((await h.controller.projection()).error?.code, 'already-recording');
      await h.controller.handle({ type: 'transcribe:record/cancel', sessionId: id });
    }

    // ------------------------------------------------ cancel and capture failures
    {
      fresh();
      const h = harness(root, { folders: [project] });
      const id = await begin(h);
      await h.controller.handle(chunk(id, 0));
      const part = path.join(recordings, `${NAME}.wav.part`);
      assert.ok(fs.existsSync(part));
      await h.controller.handle({ type: 'transcribe:record/cancel', sessionId: id });
      assert.deepEqual(h.trashed, [part], 'cancelled audio goes to the trash, not into nothing');
      assert.deepEqual(h.staged, []);
      assert.equal((await h.controller.projection()).phase, 'idle');
      assert.deepEqual(h.store.get(PARTIALS_KEY), []);

      const quiet = await begin(h);
      await h.controller.handle({ type: 'transcribe:record/cancel', sessionId: quiet });
      assert.equal(h.trashed.length, 1, 'an empty recording is simply removed');
      assert.ok(!fs.existsSync(part));

      const denied = await begin(h);
      await h.controller.handle({ type: 'transcribe:record/captureFailed', sessionId: denied, code: 'os-denied' });
      assert.ok(!fs.existsSync(part), 'a denied microphone leaves no file');
      const view = await h.controller.projection();
      assert.equal(view.error?.code, 'os-denied');
      assert.equal(view.error?.message, 'Microphone access is denied for Ritemark.');
      await h.controller.handle({ type: 'transcribe:record/openMicrophoneSettings' });
      assert.equal(h.settingsOpened, 1, 'the denied state can open the OS privacy page');
      assert.deepEqual(h.store.get(PARTIALS_KEY), []);

      // A new start clears the old error.
      const next = await begin(h);
      assert.equal((await h.controller.projection()).error, null);
      await h.controller.handle({ type: 'transcribe:record/cancel', sessionId: next });
    }

    // ------------------------------------------------ panel reload mid-recording, then recover
    {
      fresh();
      const h = harness(root, { folders: [project] });
      const id = await begin(h);
      await h.controller.handle(chunk(id, 0));
      await h.controller.handle(chunk(id, 1));
      await h.controller.detach();
      let view = await h.controller.projection();
      assert.equal(view.phase, 'idle');
      assert.equal(view.notice, INTERRUPTED_NOTICE);
      assert.equal(view.partials.length, 1);
      assert.deepEqual(
        { ...view.partials[0], id: 'x' },
        { id: 'x', fileName: `${NAME}.wav`, folderLabel: 'Notes/recordings', durationSec: 2 },
      );
      await h.controller.handle(chunk(id, 2));
      assert.deepEqual(acks(h, id), [0, 1], 'the detached session takes no more audio');

      await h.controller.handle({ type: 'transcribe:record/recover', partialId: view.partials[0].id });
      const saved = path.join(recordings, `${NAME}.wav`);
      assert.deepEqual(h.staged, [saved], 'the recovered file goes to the same import path');
      assertValidWav(saved, 64_000);
      view = await h.controller.projection();
      assert.deepEqual(view.partials, []);
      assert.equal(view.notice, null);
      fs.rmSync(saved);

      // Detached before any audio: nothing to recover, nothing left behind.
      const empty = await begin(h);
      await h.controller.detach();
      assert.deepEqual((await h.controller.projection()).partials, []);
      assert.ok(!fs.existsSync(path.join(recordings, `${NAME}.wav.part`)));
      assert.equal(h.controller.activeSessionId, null, `session ${empty} ended`);
    }

    // ------------------------------------------------ shutdown, then a crash-torn part after restart
    {
      fresh();
      const store = new Map<string, unknown>();
      const first = harness(root, { folders: [project], store });
      const id = await begin(first);
      await first.controller.handle(chunk(id, 0));
      await first.controller.dispose();
      assertValidWav(path.join(recordings, `${NAME}.wav.part`), 32_000);

      // A second partial that never got a header: the app was killed.
      const tornPart = path.join(recordings, 'Recording 2026-09-21 08.00.wav.part');
      fs.writeFileSync(tornPart, Buffer.concat([wavHeader(0), Buffer.alloc(3201, 5)]));
      store.set(PARTIALS_KEY, [...(store.get(PARTIALS_KEY) as unknown[]), { id: 'crashed-0000', partPath: tornPart, folderLabel: 'Notes/recordings' }]);
      // An entry whose file was deleted outside Ritemark, and one with no audio.
      const gone = path.join(recordings, 'gone.wav.part');
      const hollow = path.join(recordings, 'hollow.wav.part');
      fs.writeFileSync(hollow, wavHeader(0));
      store.set(PARTIALS_KEY, [
        ...(store.get(PARTIALS_KEY) as unknown[]),
        { id: 'gone-00000', partPath: gone, folderLabel: 'Notes/recordings' },
        { id: 'hollow-0000', partPath: hollow, folderLabel: 'Notes/recordings' },
      ]);

      const restarted = harness(root, { folders: [project], store });
      const view = await restarted.controller.projection();
      assert.deepEqual(view.partials.map((p) => p.fileName).sort(), ['Recording 2026-09-21 08.00.wav', `${NAME}.wav`]);
      assert.ok(!fs.existsSync(hollow), 'a partial with no audio is cleaned away');
      assert.equal((store.get(PARTIALS_KEY) as unknown[]).length, 2, 'missing and empty entries are forgotten');

      await restarted.controller.handle({ type: 'transcribe:record/recover', partialId: 'crashed-0000' });
      const recovered = path.join(recordings, 'Recording 2026-09-21 08.00.wav');
      assert.deepEqual(restarted.staged, [recovered]);
      assertValidWav(recovered, 3200);

      const other = view.partials.find((p) => p.fileName === `${NAME}.wav`)!;
      await restarted.controller.handle({ type: 'transcribe:record/discard', partialId: other.id });
      assert.deepEqual(restarted.trashed, [path.join(recordings, `${NAME}.wav.part`)], 'discard moves to the trash');
      assert.deepEqual((await restarted.controller.projection()).partials, []);
      await restarted.controller.handle({ type: 'transcribe:record/recover', partialId: other.id }); // already gone: harmless
      assert.equal(restarted.staged.length, 1);
      fs.rmSync(recovered);
    }

    // ------------------------------------------------ a write failure keeps what reached the disk
    {
      fresh();
      const h = harness(root, { folders: [project], fs: failingFs(1) });
      const id = await begin(h);
      await h.controller.handle(chunk(id, 0));
      await h.controller.handle(chunk(id, 1));
      assert.ok(ended(h, id));
      assert.deepEqual(acks(h, id), [0], 'the failed chunk is never acknowledged');
      let view = await h.controller.projection();
      assert.equal(view.error?.code, 'write-failed');
      assert.equal(view.partials.length, 1, 'the written audio is offered for recovery');
      assert.equal(view.partials[0].durationSec, 1);
      await h.controller.handle({ type: 'transcribe:record/recover', partialId: view.partials[0].id });
      assertValidWav(h.staged.pop()!, 32_000);
      view = await h.controller.projection();
      assert.deepEqual(view.partials, []);
    }

    // ------------------------------------------------ the final rename fails
    {
      fresh();
      let renameFails = true;
      const flaky: SinkFs = {
        ...nodeSinkFs,
        rename: async (from, to) => {
          if (renameFails) throw new Error('EPERM: operation not permitted');
          return nodeSinkFs.rename(from, to);
        },
      };
      const h = harness(root, { folders: [project], fs: flaky });
      const id = await begin(h);
      await h.controller.handle(chunk(id, 0));
      await h.controller.handle({ type: 'transcribe:record/stop', sessionId: id, finalSequence: 0, reason: 'user' });
      assert.deepEqual(h.staged, [], 'a file that was not saved is never imported');
      let view = await h.controller.projection();
      assert.equal(view.phase, 'idle');
      assert.equal(view.error?.code, 'write-failed');
      assert.equal(view.partials.length, 1, 'the complete audio stays offered for saving');
      renameFails = false;
      await h.controller.handle({ type: 'transcribe:record/recover', partialId: view.partials[0].id });
      assertValidWav(h.staged.pop()!, 32_000);
      view = await h.controller.projection();
      assert.deepEqual(view.partials, []);
    }

    // ------------------------------------------------ the final name was taken while recording
    {
      fresh();
      const h = harness(root, { folders: [project] });
      const id = await begin(h);
      await h.controller.handle(chunk(id, 0));
      const taken = path.join(recordings, `${NAME}.wav`);
      fs.writeFileSync(taken, 'someone else');
      await h.controller.handle({ type: 'transcribe:record/stop', sessionId: id, finalSequence: 0, reason: 'user' });
      assert.equal(fs.readFileSync(taken, 'utf8'), 'someone else', 'never overwritten');
      assert.ok(h.staged[0].endsWith(`${NAME} (2).wav`));
    }

    // ------------------------------------------------ no folder open: ask first, remember, change
    {
      fresh();
      const h = harness(root);
      await h.controller.handle({ type: 'transcribe:record/start' });
      assert.deepEqual(h.locationAsks, [null], 'asked where to save before recording');
      assert.equal(h.controller.activeSessionId, null, 'closing the picker records nothing');
      assert.deepEqual(h.events, [{ type: 'transcribe:record/notStarted' }], 'and the webview is told so');
      let view = await h.controller.projection();
      assert.equal(view.error, null);
      assert.equal(view.hasProject, false);
      assert.equal(view.noFolderLocation, null);

      const chosen = path.join(root, 'Voice');
      h.set.pickLocation(chosen);
      const id = await begin(h);
      assert.equal(h.store.get(NO_FOLDER_LOCATION_KEY), chosen);
      assert.ok(fs.existsSync(path.join(chosen, `${NAME}.wav.part`)));
      view = await h.controller.projection();
      assert.equal(view.folderLabel, path.join('~', 'Voice'));
      assert.equal(view.noFolderLocation, path.join('~', 'Voice'));
      await h.controller.handle({ type: 'transcribe:record/changeLocation' });
      assert.equal(h.locationAsks.length, 2, 'no change while recording');
      await h.controller.handle({ type: 'transcribe:record/cancel', sessionId: id });

      await begin(h);
      assert.equal(h.locationAsks.length, 2, 'the remembered location is used without asking again');
      await h.controller.handle({ type: 'transcribe:record/cancel', sessionId: h.controller.activeSessionId! });

      const moved = path.join(root, 'Elsewhere');
      h.set.pickLocation(moved);
      await h.controller.handle({ type: 'transcribe:record/changeLocation' });
      assert.deepEqual(h.locationAsks.slice(-1), [chosen], 'Change starts from the current location');
      assert.equal((await h.controller.projection()).noFolderLocation, path.join('~', 'Elsewhere'));

      // Opening a folder makes the project the destination again.
      h.set.folders([project]);
      await begin(h);
      assert.equal((await h.controller.projection()).folderLabel, 'Notes/recordings');
      await h.controller.handle({ type: 'transcribe:record/cancel', sessionId: h.controller.activeSessionId! });
    }

    // ------------------------------------------------ several folders
    {
      fresh();
      const work = { name: 'Work', path: path.join(root, 'Work') };
      fs.mkdirSync(work.path);
      const h = harness(root, { folders: [project, work] });
      h.set.active(path.join(work.path, 'plan.md'));
      await begin(h);
      assert.equal((await h.controller.projection()).folderLabel, 'Work/recordings', 'the active file picks the folder');
      await h.controller.handle({ type: 'transcribe:record/cancel', sessionId: h.controller.activeSessionId! });

      h.set.active(null);
      await h.controller.handle({ type: 'transcribe:record/start' });
      assert.equal(h.folderAsks, 1);
      assert.equal(h.controller.activeSessionId, null, 'closing the folder pick records nothing');
      h.set.pickFolder(project);
      await begin(h);
      assert.equal((await h.controller.projection()).folderLabel, 'Notes/recordings');
      await h.controller.handle({ type: 'transcribe:record/cancel', sessionId: h.controller.activeSessionId! });
    }

    // ------------------------------------------------ an unusable destination
    {
      fresh();
      const blocked = { name: 'Blocked', path: path.join(root, 'Blocked') };
      fs.mkdirSync(blocked.path);
      fs.writeFileSync(path.join(blocked.path, 'recordings'), 'a file where the folder should be');
      const h = harness(root, { folders: [blocked] });
      await h.controller.handle({ type: 'transcribe:record/start' });
      assert.equal(h.controller.activeSessionId, null);
      assert.equal((await h.controller.projection()).error?.code, 'destination-unavailable');
      assert.deepEqual(h.events, [{ type: 'transcribe:record/notStarted' }], 'the webview is told not to capture');
    }

    // ------------------------------------------------ feature off
    {
      fresh();
      const h = harness(root, { folders: [project] });
      h.set.enabled(false);
      await h.controller.handle({ type: 'transcribe:record/start' });
      assert.deepEqual(h.events, [{ type: 'transcribe:record/notStarted' }]);
      const view = await h.controller.projection();
      assert.equal(view.enabled, false);
      assert.deepEqual(view.partials, []);

      // Turned off mid-recording: the session in progress still finishes.
      h.set.enabled(true);
      const id = await begin(h);
      h.set.enabled(false);
      await h.controller.handle(chunk(id, 0));
      await h.controller.handle({ type: 'transcribe:record/stop', sessionId: id, finalSequence: 0, reason: 'user' });
      assert.deepEqual(acks(h, id), [0]);
      assertValidWav(h.staged.pop()!, 32_000);
    }

    console.log('RecordingController.test.ts: all tests passed');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
