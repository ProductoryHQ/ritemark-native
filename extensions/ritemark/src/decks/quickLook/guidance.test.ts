import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import Module from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { QuickLookGuidance, previewId, settingsConfirmed, settingsHelp, thumbnailId } from './guidance';
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

function setup(platform = 'darwin', confirmed = true, available = async () => true) {
  const state = new Map<string, boolean>();
  const queries: string[] = [];
  let opens = 0;
  let changes = 0;
  let output = '-';
  const profile = {
    get: <T>(key: string) => state.get(key) as T | undefined,
    update: async (key: string, value: boolean) => { state.set(key, value); },
  };
  const window = (beforeQuery = async () => {}) => new QuickLookGuidance(platform, profile, async id => {
    queries.push(id);
    await beforeQuery();
    return `${output} ${id}(2.4.0)`;
  }, async () => confirmed, () => { changes++; }, async () => { opens++; }, available);
  return { window, queries, opens: () => opens, changes: () => changes, election: (value: string) => { output = value; } };
}

for (const action of [false, true]) {
  test(`deck save enables the note and ${action ? 'Open System Settings' : 'Not now'} retires it across windows`, async () => {
    const profile = setup();
    const first = profile.window();
    await first.refresh();
    assert.deepEqual(profile.queries, [thumbnailId]);
    assert.equal(await first.eligible(), false);
    await first.deckSaved();
    assert.deepEqual(profile.queries, [thumbnailId, thumbnailId]);
    assert.equal(await first.eligible(), true);
    await Promise.all([first.retire(action), first.retire(action)]);
    assert.equal(await first.eligible(), false);
    assert.equal(profile.opens(), Number(action));
    const next = profile.window();
    await next.refresh();
    await next.deckSaved();
    assert.equal(await next.eligible(), false);
    assert.deepEqual(profile.queries, [thumbnailId, thumbnailId]);
  });
}

test('Open from a second window still opens Settings after the first window retires the note', async () => {
  const profile = setup();
  const first = profile.window();
  const second = profile.window();
  await first.deckSaved();
  await second.refresh();
  assert.equal(await second.eligible(), true);
  await first.retire(false);
  assert.equal(await second.eligible(), false);
  const before = profile.changes();
  await second.retire(true);
  assert.equal(profile.opens(), 1);
  assert.equal(profile.changes(), before + 1);
});

test('Open during a pending Not now action still opens Settings once', async () => {
  const profile = setup();
  const guidance = profile.window();
  await guidance.deckSaved();
  await Promise.all([guidance.retire(false), guidance.retire(true), guidance.retire(true)]);
  assert.equal(profile.opens(), 1);
  assert.equal(await guidance.eligible(), false);
});

test('Open still retires and redraws the note during a save-triggered query', async () => {
  const profile = setup();
  let reachedQuery: () => void;
  let finishQuery: () => void;
  const queryStarted = new Promise<void>(resolve => { reachedQuery = resolve; });
  const queryPending = new Promise<void>(resolve => { finishQuery = resolve; });
  const guidance = profile.window(async () => {
    if (profile.queries.length === 2) {
      reachedQuery();
      await queryPending;
    }
  });
  await guidance.deckSaved();
  assert.equal(await guidance.eligible(), true);
  const saving = guidance.deckSaved();
  await queryStarted;
  assert.equal(await guidance.eligible(), false);
  const before = profile.changes();
  await guidance.retire(true);
  assert.equal(profile.opens(), 1);
  assert.equal(profile.changes(), before + 1);
  finishQuery!();
  await saving;
  assert.equal(await guidance.eligible(), false);
});

test('only confirmed macOS versions and an explicitly disabled thumbnail can show guidance', async () => {
  assert.equal(settingsConfirmed('darwin', '15.7.1', [15]), true);
  assert.equal(settingsConfirmed('darwin', '26.1', [15]), false);
  assert.equal(settingsConfirmed('darwin', '15.7 trailing', [15]), false);
  assert.equal(settingsConfirmed('linux', '15', [15]), false);
  const unconfirmedProfile = setup('darwin', false);
  const unconfirmed = unconfirmedProfile.window();
  await unconfirmed.refresh();
  await unconfirmed.deckSaved();
  assert.equal(await unconfirmed.eligible(), false);
  assert.deepEqual(unconfirmedProfile.queries, []);
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

test('saving stops querying and hides an eligible note after Quick Look becomes unavailable', async () => {
  let available = true;
  const profile = setup('darwin', true, async () => available);
  const guidance = profile.window();
  await guidance.deckSaved();
  assert.equal(await guidance.eligible(), true);
  available = false;
  const before = profile.changes();
  await guidance.deckSaved();
  assert.deepEqual(profile.queries, [thumbnailId]);
  assert.equal(await guidance.eligible(), false);
  assert.equal(profile.changes(), before + 1);
});

test('registration and Help share the Quick Look start gate, with version-neutral Help on unconfirmed macOS', async (t) => {
  const contents = await mkdtemp(join(tmpdir(), 'ritemark-quick-look-guidance-'));
  t.after(() => rm(contents, { recursive: true, force: true }));
  const appRoot = join(contents, 'Resources', 'app');
  await mkdir(appRoot, { recursive: true });
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { ...platform, value: 'darwin' });
  t.after(() => { Object.defineProperty(process, 'platform', platform); });
  const devOverride = process.env.RITEMARK_QUICKLOOK_DEV;
  delete process.env.RITEMARK_QUICKLOOK_DEV;
  t.after(() => {
    if (devOverride !== undefined) process.env.RITEMARK_QUICKLOOK_DEV = devOverride;
  });
  const moduleLoader = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
  const load = moduleLoader._load;
  t.mock.method(moduleLoader, '_load', mockLoad);
  let quickLook = true;
  let decks = true;
  let print = false;
  let printChecks = 0;
  const messages: string[][] = [];
  const commands = new Map<string, () => Promise<void>>();
  const calls: string[] = [];
  const disposable = { dispose() {} };
  const vscodeStub = {
    EventEmitter: class { event() { return disposable; } fire() {} },
    commands: {
      getCommands: async () => {
        printChecks++;
        return print ? ['_ritemark.printHtmlToPdf'] : [];
      },
      registerCommand: (id: string, run: () => Promise<void>) => { commands.set(id, run); return disposable; },
    },
    workspace: { onDidSaveTextDocument: () => disposable },
    env: { appRoot },
    window: { showInformationMessage: async (...words: string[]) => { messages.push(words); } },
  };
  function mockLoad(request: string, ...rest: unknown[]) {
    if (request === 'vscode') return vscodeStub;
    if (request === '../../features') return { isEnabled: (id: string) => id === 'decks' ? decks : quickLook };
    if (request === 'child_process') return {
      execFile: (file: string, _args: string[], _options: unknown, callback: (error: null, result: { stdout: string }) => void) => {
        calls.push(file);
        assert.equal(file, '/usr/bin/sw_vers');
        callback(null, { stdout: '12.7.6\n' });
      },
    };
    return load(request, ...rest);
  }
  const { registerQuickLookGuidance } = require('./registerGuidance') as typeof import('./registerGuidance');
  const context = () => ({ subscriptions: [], globalState: { get: () => undefined, update: async () => {} } }) as never;
  const showHelp = () => commands.get('_ritemark.deckQuickLook.showHelp')!();

  // Test each gate independently by first satisfying the bundle and print prerequisites.
  const plugins = join(contents, 'PlugIns');
  await mkdir(join(plugins, 'RitemarkDeckThumbnail.appex'), { recursive: true });
  const preview = join(plugins, 'RitemarkDeckPreview.appex');
  await mkdir(preview);
  const guidance = registerQuickLookGuidance(context());
  assert.ok(guidance);
  assert.equal(printChecks, 0, 'registration does not synchronously query the renderer');
  await guidance.refresh();
  await showHelp();
  assert.ok(printChecks > 0, 'availability queries the renderer after registration');
  print = true;
  await rm(preview, { recursive: true });
  await guidance.refresh();
  await showHelp();
  await mkdir(preview);
  for (const switchOff of [
    (enabled: boolean) => { quickLook = enabled; },
    (enabled: boolean) => { decks = enabled; },
    (enabled: boolean) => { print = enabled; },
  ]) {
    switchOff(false);
    await guidance.refresh();
    await showHelp();
    switchOff(true);
  }
  assert.deepEqual(calls, []);
  assert.deepEqual(messages, []);

  await guidance.deckSaved();
  await showHelp();
  assert.equal(settingsHelp, "To show your decks' first slides in Finder, turn on Ritemark's Quick Look extension in your Mac's settings, under Extensions.");
  assert.deepEqual(messages, [[settingsHelp]]);
  assert.deepEqual(calls, ['/usr/bin/sw_vers']);
  decks = false;
  await showHelp();
  assert.equal(messages.length, 1);
});
