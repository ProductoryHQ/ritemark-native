import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../testing/tempDir';
import { GUIDANCE_KEY, GuidanceStore, type MementoLike } from './guidanceStore';

function profile(initial?: unknown): MementoLike {
  let record = initial;
  return {
    get: <T>(key: string) => key === GUIDANCE_KEY ? record as T | undefined : undefined,
    update: async (key, value) => {
      assert.equal(key, GUIDANCE_KEY);
      await new Promise<void>((resolve) => setImmediate(resolve));
      record = JSON.parse(JSON.stringify(value));
    },
  };
}

const today = { day: '2026-11-25', appRun: 'second' };

test('S11: migrate legacy days on upgrade, count only file saves once per local day, and cap at three', async () => {
  const state = profile({
    v: 1, projects: {}, release: { id: '2.3', savedDays: ['2026-11-20', '2026-11-19', '2026-11-20'] },
  });
  const first = new GuidanceStore(state, '2.4.0');
  const second = new GuidanceStore(state, '2.4.0');
  assert.deepEqual(first.release(), { id: '2.4', savedDays: [] });
  await first.answerFeedback('not-now');
  assert.deepEqual(first.read().savedDays, ['2026-11-19', '2026-11-20']);
  const date = new Date(2026, 10, 25);
  await first.noteDocumentSaved('untitled', date, false);
  await second.noteDocumentSaved('vscode-remote', date, false);
  assert.equal(first.read().savedDays.length, 2);
  await first.noteDocumentSaved('file', date, false);
  assert.equal(first.read().savedDays.length, 2);
  assert.deepEqual(first.release().savedDays, []);
  await Promise.all([first.noteDocumentSaved('file', date, true), second.noteDocumentSaved('file', date, true)]);
  assert.deepEqual(first.release().savedDays, ['2026-11-25']);
  await first.noteSavedDay('2026-11-26');
  const upgraded = new GuidanceStore(state, '2.5.0');
  assert.deepEqual(upgraded.release(), { id: '2.5', savedDays: [] });
  assert.deepEqual(upgraded.read().savedDays, ['2026-11-19', '2026-11-20', '2026-11-25']);
});

test('S6: either threshold earns a later app run and an available slot, including after update', async () => {
  for (const signal of [{ savedDays: ['2026-11-19', '2026-11-20', '2026-11-21'] }, { positiveReaction: true }]) {
    const state = profile({ ...signal, v: 1, projects: {} });
    const fresh = new GuidanceStore(state, '2.4.0');
    await fresh.initializeAppRun('first', false);
    const reloaded = new GuidanceStore(state, '2.4.0');
    await reloaded.initializeAppRun('first', true);
    assert.equal(await reloaded.homeEligible({ ...today, appRun: 'first' }), false);
    const upgraded = new GuidanceStore(state, '2.4.1');
    await upgraded.initializeAppRun(today.appRun, true);
    assert.equal(await upgraded.homeEligible({ ...today, whatMoved: true }), false);
    await upgraded.noteReadyShown(today.day);
    assert.equal(await upgraded.homeEligible({ ...today, readyRequest: true }), false);
    assert.equal(await upgraded.homeEligible(today), true);
  }
  const previousInstall = new GuidanceStore(profile({ positiveReaction: true }), '2.4.0');
  await previousInstall.initializeAppRun(today.appRun, true);
  assert.equal(await previousInstall.homeEligible(today), true);
});

test('S7: separate windows share a reservation that survives a stale Memento write', async () => {
  const storage = makeTempDir('rm-home-');
  const initial = { positiveReaction: true, firstAppRun: null };
  const mementos = [profile(initial), profile(initial)];
  const windows = mementos.map((state) => new GuidanceStore(state, '2.4.0', '2.4.0', storage));
  const results = await Promise.all(windows.map((store) => store.reserveHomePresentation(today)));
  assert.equal(results.filter(Boolean).length, 1);
  const winnerIndex = results.indexOf(true);
  const winner = windows[winnerIndex];
  const loser = windows[1 - winnerIndex];
  await loser.noteReadyShown(today.day);
  // Simulate VS Code delivering the loser's whole Memento to the winner.
  await mementos[winnerIndex].update(GUIDANCE_KEY, loser.read());
  const reloaded = new GuidanceStore(mementos[winnerIndex], '2.4.0-ext.1', '2.4.0', storage);
  assert.deepEqual(await reloaded.openHomePresentation(today.appRun), today);
  assert.equal(await reloaded.openHomePresentation('later'), undefined);
  assert.equal(await reloaded.reserveHomePresentation(today), false);
  await winner.endHomePresentation('dismiss');
  assert.equal(await reloaded.openHomePresentation(today.appRun), undefined);
  assert.deepEqual(JSON.parse(await fs.readFile(join(storage, 'home-presentations', '2.4.0'), 'utf8')), {
    ...today, dismissed: true,
  });

  for (const release of ['2.4.1', '2.4.2']) {
    assert.equal(await new GuidanceStore(profile(initial), release, release, storage).reserveHomePresentation(today), true);
  }
  const next = new GuidanceStore(profile(initial), '2.4.3', '2.4.3', storage);
  assert.equal(await next.homeEligible(today), false, 'the winner still uses one of the three slots');
  await winner.endHomePresentation('star');
  await loser.noteReadyShown('2026-11-26');
  assert.equal(await next.homeEligible({ ...today, day: '2027-11-25' }), false, 'Star survives after all slots age out');
});

test('S7: Star works without a presentation and is idempotent', async () => {
  const storage = makeTempDir('rm-home-');
  const store = new GuidanceStore(profile({ positiveReaction: true, firstAppRun: null }), '2.4.0', '2.4.0', storage);
  assert.equal(await store.homeEligible(today), true);
  await store.endHomePresentation('star');
  await store.endHomePresentation('star');
  assert.deepEqual(await fs.readdir(join(storage, 'home-presentations')), ['starred']);
  assert.equal(await store.homeEligible(today), false);
});

test('S7: the rolling allowance uses marker days and falls back to mtime for empty or invalid JSON', async () => {
  const state = profile({ positiveReaction: true, firstAppRun: null });
  const storage = makeTempDir('rm-home-');
  const folder = join(storage, 'home-presentations');
  await fs.mkdir(folder);
  const file = join(folder, '2.4.0');
  await fs.writeFile(file, '');
  const mtime = new Date(2025, 10, 26, 12);
  await fs.utimes(file, mtime, mtime);
  for (const [version, day] of [['2.4.1', '2026-01-01'], ['2.4.2', '2026-03-01']]) {
    assert.equal(await new GuidanceStore(state, version, version, storage).reserveHomePresentation({ ...today, day }), true);
  }
  const fourth = new GuidanceStore(state, '2.4.3', '2.4.3', storage);
  assert.equal(await fourth.reserveHomePresentation(today), false);
  await fs.writeFile(file, '{');
  await fs.utimes(file, mtime, mtime);
  assert.equal(await fourth.reserveHomePresentation(today), false);
  assert.equal(await fourth.reserveHomePresentation({ ...today, day: '2026-11-26' }), true);
});

test('S7: legacy Home history migrates into markers and is omitted from subsequent Memento writes', async () => {
  const storage = makeTempDir('rm-home-');
  const folder = join(storage, 'home-presentations');
  await fs.mkdir(folder);
  await fs.writeFile(join(folder, '2.3.0'), '');
  const state = profile({
    positiveReaction: true, firstAppRun: null,
    home: { starred: true, presentations: [
      { releaseId: '2.3.0', day: '2026-10-01', dismissed: true },
      { releaseId: '2.3.1', day: '2026-10-22' },
    ] },
  });
  const store = new GuidanceStore(state, '2.4.0', '2.4.0', storage);
  await store.noteReadyShown(today.day);
  assert.equal(state.get<{ home?: unknown }>(GUIDANCE_KEY)?.home, undefined);
  assert.deepEqual((await fs.readdir(folder)).sort(), ['2.3.0', '2.3.1', 'starred']);
  assert.deepEqual(JSON.parse(await fs.readFile(join(folder, '2.3.0'), 'utf8')), {
    day: '2026-10-01', appRun: '', dismissed: true,
  });
  assert.equal(await store.homeEligible(today), false);
});

test('S7: a failed JSON write still consumes the release if the exclusive create succeeded', async (t) => {
  const storage = makeTempDir('rm-home-');
  const store = new GuidanceStore(profile({ positiveReaction: true, firstAppRun: null }), '2.4.0', '2.4.0', storage);
  const open = fs.open;
  t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    const marker = await open(...args);
    t.mock.method(marker, 'writeFile', async () => { throw new Error('Write failed'); });
    return marker;
  });
  const warn = t.mock.method(console, 'warn', () => {});
  assert.equal(await store.reserveHomePresentation(today), true);
  assert.equal(await store.reserveHomePresentation(today), false);
  assert.equal(warn.mock.callCount(), 1);
});

test('S7: an unwritable marker folder suppresses presentation and warns', async (t) => {
  const storage = makeTempDir('rm-home-');
  const folder = join(storage, 'home-presentations');
  await fs.mkdir(folder);
  if (process.platform === 'win32' || process.getuid?.() === 0) {
    t.mock.method(fs, 'open', async () => {
      throw Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    });
  } else {
    await fs.chmod(folder, 0o500);
    t.after(() => fs.chmod(folder, 0o700));
  }
  const warn = t.mock.method(console, 'warn', () => {});
  const store = new GuidanceStore(profile({ positiveReaction: true, firstAppRun: null }), '2.4.0', '2.4.0', storage);
  assert.equal(await store.homeEligible(today), true);
  assert.equal(await store.reserveHomePresentation(today), false);
  assert.deepEqual(await fs.readdir(folder), []);
  assert.equal(warn.mock.callCount(), 1);
});
