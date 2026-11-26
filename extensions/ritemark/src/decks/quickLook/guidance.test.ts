import assert from 'node:assert/strict';
import test from 'node:test';
import { QuickLookGuidance, previewId, settingsConfirmed, thumbnailId } from './guidance';
import { parsePluginkitState } from './pluginkitState';

test('pluginkit requires one explicit election for the exact ID', () => {
  assert.equal(parsePluginkitState(`  + \t${thumbnailId}(2.4.0)\n`, thumbnailId), 'on');
  assert.equal(parsePluginkitState(`-    ${thumbnailId}(2.4.0)\n`, thumbnailId), 'off');
  for (const output of [
    '', `? ${thumbnailId}(2.4.0)`, `  ${thumbnailId}(2.4.0)`, `+ ${previewId}`,
    `- ${thumbnailId}\n+ ${thumbnailId}`, `- ${thumbnailId}\nunexpected text`,
    `- ${thumbnailId}.other`,
  ]) assert.equal(parsePluginkitState(output, thumbnailId), 'unknown', output);
});

function setup(platform = 'darwin', confirmed = true) {
  const state = new Map<string, boolean>();
  const queries: string[] = [];
  let opens = 0;
  let output = '-';
  const profile = {
    get: <T>(key: string) => state.get(key) as T | undefined,
    update: async (key: string, value: boolean) => { state.set(key, value); },
  };
  const window = () => new QuickLookGuidance(platform, profile, async id => {
    queries.push(id);
    return `${id === thumbnailId ? output : '+'} ${id}(2.4.0)`;
  }, Promise.resolve(confirmed), () => {}, async () => { opens++; });
  return { window, queries, opens: () => opens, election: (value: string) => { output = value; } };
}

for (const action of [false, true]) {
  test(`deck save enables the note and ${action ? 'Open System Settings' : 'Not now'} retires it across windows`, async () => {
    const profile = setup();
    const first = profile.window();
    await first.refresh();
    assert.deepEqual(profile.queries, [thumbnailId, previewId]);
    assert.equal(await first.eligible(), false);
    await first.deckSaved();
    assert.deepEqual(profile.queries, [thumbnailId, previewId, thumbnailId, previewId]);
    assert.equal(await first.eligible(), true);
    await Promise.all([first.retire(action), first.retire(action)]);
    assert.equal(await first.eligible(), false);
    assert.equal(profile.opens(), Number(action));
    const next = profile.window();
    await next.refresh();
    await next.deckSaved();
    assert.equal(await next.eligible(), false);
  });
}

test('only confirmed macOS versions and an explicitly disabled thumbnail can show guidance', async () => {
  assert.equal(settingsConfirmed('darwin', '15.7.1', [15]), true);
  assert.equal(settingsConfirmed('darwin', '26.1', [15]), false);
  assert.equal(settingsConfirmed('darwin', '15.7 trailing', [15]), false);
  assert.equal(settingsConfirmed('linux', '15', [15]), false);
  const unconfirmed = setup('darwin', false).window();
  await unconfirmed.deckSaved();
  assert.equal(await unconfirmed.eligible(), false);
  const profile = setup();
  const guidance = profile.window();
  for (const election of ['+', '?', '-']) {
    profile.election(election);
    await guidance.deckSaved();
    assert.equal(await guidance.eligible(), election === '-');
  }
});

test('Windows and Linux never query at start or on save', async () => {
  for (const platform of ['win32', 'linux']) {
    const profile = setup(platform);
    const guidance = profile.window();
    await guidance.refresh();
    await guidance.deckSaved();
    assert.deepEqual(profile.queries, []);
    assert.equal(await guidance.eligible(), false);
  }
});
