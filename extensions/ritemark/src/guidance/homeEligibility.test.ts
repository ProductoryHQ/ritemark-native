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
  await Promise.all([first.noteDocumentSaved('file', date, false), second.noteDocumentSaved('file', date, true)]);
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
    assert.equal(reloaded.homeEligible({ ...today, appRun: 'first' }), false);
    const upgraded = new GuidanceStore(state, '2.4.1');
    await upgraded.initializeAppRun(today.appRun, true);
    assert.equal(upgraded.homeEligible({ ...today, whatMoved: true }), false);
    await upgraded.noteReadyShown(today.day);
    assert.equal(upgraded.homeEligible({ ...today, readyRequest: true }), false);
    assert.equal(upgraded.homeEligible(today), true);
  }
  const previousInstall = new GuidanceStore(profile({ positiveReaction: true }), '2.4.0');
  await previousInstall.initializeAppRun(today.appRun, true);
  assert.equal(previousInstall.homeEligible(today), true);
});

test('S7: one reservation per public release on a shared Memento, including concurrent calls', async () => {
  const state = profile({ positiveReaction: true });
  const storage = makeTempDir('rm-home-');
  const first = new GuidanceStore(state, '2.4.0', '2.4.0', storage);
  const second = new GuidanceStore(state, '2.4.0-ext.1', '2.4.0', storage);
  await first.initializeAppRun(today.appRun, true);
  assert.deepEqual(await Promise.all([first.reserveHomePresentation(today), second.reserveHomePresentation(today)]), [true, false]);
  assert.equal(await first.reserveHomePresentation(today), false);
  assert.deepEqual(first.read().home, { presentations: [{ releaseId: '2.4.0', day: today.day }] });
  await first.endHomePresentation('dismiss');
  assert.equal(second.read().home?.presentations[0].dismissed, true);
  const next = new GuidanceStore(state, '2.4.1', '2.4.1', storage);
  assert.equal(await next.reserveHomePresentation(today), true);
  await next.endHomePresentation('star');
  assert.equal(new GuidanceStore(state, '2.5.0').homeEligible(today), false);
});

test('S7: the fourth release waits for the rolling calendar-year allowance', async () => {
  const state = profile({ positiveReaction: true, firstAppRun: null });
  const storage = makeTempDir('rm-home-');
  for (const [version, day] of [['2.4.0', '2025-11-26'], ['2.4.1', '2026-01-01'], ['2.4.2', '2026-03-01']]) {
    assert.equal(await new GuidanceStore(state, version, version, storage).reserveHomePresentation({ ...today, day }), true);
  }
  const fourth = new GuidanceStore(state, '2.4.3', '2.4.3', storage);
  assert.equal(await fourth.reserveHomePresentation(today), false);
  assert.equal(await fourth.reserveHomePresentation({ ...today, day: '2026-11-26' }), true);
});

test('S7: two eligible windows with separate Mementos compete for one release marker', async () => {
  const storage = makeTempDir('rm-home-');
  const initial = { positiveReaction: true, firstAppRun: null };
  const windows = [profile(initial), profile(initial)].map((state) => new GuidanceStore(state, '2.4.0', '2.4.0', storage));
  assert.ok(windows.every((store) => store.homeEligible(today)));
  const results = await Promise.all(windows.map((store) => store.reserveHomePresentation(today)));
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(windows.filter((store) => store.read().home).length, 1);
});

test('S7: a marker survives an earlier run and a new release can create its own', async () => {
  const storage = makeTempDir('rm-home-');
  const folder = join(storage, 'home-presentations');
  await fs.mkdir(folder);
  await fs.writeFile(join(folder, '2.4.0'), '');
  const state = profile({
    positiveReaction: true, firstAppRun: null,
    home: { presentations: [{ releaseId: '2.3.0', day: '2026-10-01' }] },
  });
  const same = new GuidanceStore(state, '2.4.0', '2.4.0', storage);
  assert.equal(same.homeEligible(today), true);
  assert.equal(await same.reserveHomePresentation(today), false);
  const next = new GuidanceStore(state, '2.4.1', '2.4.1', storage);
  assert.equal(next.homeEligible(today), true);
  assert.equal(await next.reserveHomePresentation(today), true);
  assert.deepEqual((await fs.readdir(folder)).sort(), ['2.4.0', '2.4.1']);
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
  assert.equal(store.homeEligible(today), true);
  assert.equal(await store.reserveHomePresentation(today), false);
  assert.equal(store.read().home, undefined);
  assert.equal(warn.mock.callCount(), 1);
});
