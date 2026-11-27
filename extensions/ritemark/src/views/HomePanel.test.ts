/**
 * Sprint 143 (#556, R1, S2): disposing Home's host lets go of everything it
 * subscribed to, the project list included, and its panel, even when one
 * subscription throws.
 *
 * Run: npx tsx src/views/HomePanel.test.ts
 */

import assert from 'node:assert/strict';
import Module from 'node:module';

const disposed: string[] = [];
function disposable(name: string, throws = false): { dispose(): void } {
  return {
    dispose() {
      disposed.push(name);
      if (throws) throw new Error(`${name} failed`);
    },
  };
}

let watcherCount = 0;
let throwingWatcher = -1;
let focusListener: ((state: { focused: boolean }) => void) | undefined;
const vscodeStub = {
  RelativePattern: class { constructor(public base: unknown, public pattern: string) {} },
  Uri: { file: (fsPath: string) => ({ fsPath, toString: () => `file://${fsPath}` }) },
  workspace: {
    createFileSystemWatcher: () => {
      const index = watcherCount++;
      return {
        ...disposable(`watcher ${index}`, index === throwingWatcher),
        onDidCreate: () => disposable(`watcher ${index} create`),
        onDidDelete: () => disposable(`watcher ${index} delete`),
        onDidChange: () => disposable(`watcher ${index} change`),
      };
    },
  },
  window: {
    onDidChangeWindowState: (listener: typeof focusListener) => {
      focusListener = listener;
      return disposable('window focus');
    },
  },
  extensions: { onDidChange: () => disposable('extensions') },
  commands: { executeCommand: async (id: string) => { executed.push(id); } },
};
const executed: string[] = [];
let configListener: ((event: { affectsConfiguration(section: string): boolean }) => void) | undefined;
(vscodeStub.workspace as Record<string, unknown>).onDidChangeConfiguration = (listener: typeof configListener) => {
  configListener = listener;
  return disposable('configuration');
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? vscodeStub : load(request, ...rest));

async function main(): Promise<void> {
  const { HomeHost } = await import('./HomePanel');
  const { ProjectList } = await import('../projects/ProjectList');

  let decksOn = false;
  function host(withQuickLook = false): { home: InstanceType<typeof HomeHost>; list: InstanceType<typeof ProjectList> } {
    const list = new ProjectList('/nowhere/list.json', {} as never);
    const home = new HomeHost({
      context: {
        globalState: { get: () => undefined, update: async () => undefined },
        globalStorageUri: { fsPath: '/nowhere/global' },
      } as never,
      folder: { uri: { fsPath: '/projects/Harbour', toString: () => 'file:///projects/Harbour' }, name: 'Harbour', index: 0 } as never,
      projectList: list,
      waiting: { invalidate: () => undefined } as never,
      switcher: {} as never,
      board: () => null,
      boardEnabled: () => false,
      decksEnabled: () => decksOn,
      openConversation: async () => undefined,
      onProjectsChanged: () => undefined,
      guidance: null,
      quickLookGuidance: withQuickLook ? { onDidChange: () => disposable('Quick Look guidance') } as never : undefined,
    });
    (home as unknown as { panel: { dispose(): void } }).panel = disposable('panel');
    return { home, list };
  }
  const listeners = (list: InstanceType<typeof ProjectList>) => (list as unknown as { listeners: Set<unknown> }).listeners.size;

  // Everything is let go: both watchers and their events, the extensions listener, the project list, the panel.
  {
    disposed.length = 0;
    watcherCount = 0;
    const { home, list } = host();
    assert.equal(listeners(list), 1, 'Home listens to the project list');
    home.dispose();
    assert.equal(listeners(list), 0, 'the project list has no listener left');
    assert.ok(disposed.includes('extensions'), 'the extensions listener is disposed');
    assert.ok(disposed.includes('configuration'), 'the settings listener (the decks flag) is disposed');
    assert.ok(disposed.includes('watcher 0') && disposed.includes('watcher 1'), 'both watchers are disposed');
    assert.equal(disposed[disposed.length - 1], 'panel', 'the panel is disposed last');
  }

  // One subscription that throws doesn't stop the rest, or the panel.
  {
    disposed.length = 0;
    watcherCount = 0;
    throwingWatcher = 0;
    const { home, list } = host();
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { errors.push(args); };
    try {
      home.dispose();
    } finally {
      console.error = original;
    }
    assert.equal(errors.length, 1, 'the failure is logged once');
    assert.equal(listeners(list), 0);
    assert.ok(disposed.includes('extensions'));
    assert.equal(disposed[disposed.length - 1], 'panel');
    throwingWatcher = -1;
  }

  // Sprint 159: the Deck card runs New → Deck's command while the flag is on, and nothing with it off
  {
    const { home } = host();
    const handle = (home as unknown as { handle(request: unknown): Promise<void> }).handle.bind(home);
    executed.length = 0;
    decksOn = true;
    await handle({ type: 'home/start', kind: 'deck' });
    assert.deepEqual(executed, ['ritemark.decks.new'], 'the Deck card is New → Deck');
    executed.length = 0;
    decksOn = false;
    await handle({ type: 'home/start', kind: 'deck' });
    assert.deepEqual(executed, [], 'with the flag off, nothing runs');
    await handle({ type: 'home/start', kind: 'table' });
    assert.deepEqual(executed, ['ritemark.newTable'], 'Table runs as before');
    // The flag changing redraws Home; another setting does not
    let redraws = 0;
    (home as unknown as { scheduleRedraw: (delay?: number) => void }).scheduleRedraw = () => { redraws++; };
    configListener?.({ affectsConfiguration: (section) => section === 'ritemark.features.decks' });
    configListener?.({ affectsConfiguration: (section) => section === 'editor.fontSize' });
    assert.equal(redraws, 1, 'only the decks flag redraws Home');
    home.dispose();
  }

  // A second window re-reads the profile's retirement when its visible Home gains focus.
  {
    const { home } = host(true);
    const panel = home as unknown as { panel: { visible: boolean }; scheduleRedraw(delay: number): void };
    const redraws: number[] = [];
    panel.scheduleRedraw = delay => { redraws.push(delay); };
    focusListener?.({ focused: true });
    panel.panel.visible = true;
    focusListener?.({ focused: false });
    assert.deepEqual(redraws, []);
    focusListener?.({ focused: true });
    assert.deepEqual(redraws, [0]);
    home.dispose();
    assert.ok(disposed.includes('window focus'));
  }

  // Eligibility can change between slot decisions while Home's other content redraws.
  {
    const { home } = host(true);
    const internal = home as unknown as {
      deps: {
        context: { globalState: { get(key: string): boolean | undefined; update(key: string, value: boolean): Promise<void> } };
        quickLookGuidance: { eligible(): Promise<boolean> };
      };
      panel: { visible: boolean };
      slotGuidance(recent: { empty: boolean; pointers: Set<string> }): Promise<{ card: string } | null>;
      homeVisibilityChanged(visible: boolean): void;
      handle(request: unknown): Promise<void>;
    };
    const values = new Map<string, boolean>();
    internal.deps.context.globalState = {
      get: key => values.get(key),
      update: async (key, value) => { values.set(key, value); },
    };
    let saved = false;
    internal.deps.quickLookGuidance.eligible = async () => saved;
    const card = async () => (await internal.slotGuidance({ empty: false, pointers: new Set() }))?.card;
    const show = (visible: boolean) => {
      internal.panel.visible = visible;
      internal.homeVisibilityChanged(visible);
    };

    show(true);
    assert.equal(await card(), undefined);
    saved = true;
    assert.equal(await card(), undefined, 'a first deck save does not fill an open slot');
    show(false);
    show(true);
    assert.equal(await card(), 'quick-look', 'reopening Home decides the slot again');

    values.set('ritemark.updatedFrom1x', true);
    show(false);
    show(true);
    assert.equal(await card(), 'what-moved');
    await internal.handle({ type: 'home/what-moved-seen' });
    assert.equal(await card(), 'quick-look', 'ending a card decides the slot again');
    home.dispose();
  }

  // Only a delivered ready card in a visible Home records the day and impression.
  {
    const { home } = host();
    const internal = home as unknown as {
      deps: { guidance: { readyCardShown(): Promise<void> } };
      ready: boolean;
      panel: { visible: boolean; webview: { postMessage(): Promise<boolean> }; dispose(): void };
      state(): Promise<{ guidance: { card: string }; missing: object | null }>;
      push(): Promise<void>;
    };
    let impressions = 0;
    let delivered = false;
    const state = { guidance: { card: 'ready-request' }, missing: null as object | null };
    internal.deps.guidance = { readyCardShown: async () => { impressions++; } };
    internal.ready = true;
    internal.panel.visible = true;
    internal.panel.webview = { postMessage: async () => delivered };
    internal.state = async () => state;
    await internal.push();
    delivered = true;
    internal.panel.visible = false;
    await internal.push();
    internal.panel.visible = true;
    state.missing = {};
    await internal.push();
    state.missing = null;
    state.guidance.card = 'quick-look';
    await internal.push();
    assert.equal(impressions, 0);
    state.guidance.card = 'ready-request';
    await internal.push();
    assert.equal(impressions, 1);
    home.dispose();
  }

  // Opening a visible slot claims the card once before two redraws can hand it to Home.
  for (const claimed of [false, true]) {
    const { home } = host();
    type Action = import('../projects/protocol').OpenSourceAction;
    type State = { guidance: { card: 'open-source' } | null; missing: object | null };
    const internal = home as unknown as {
      deps: { guidance: { presentOpenSource(): Promise<boolean>; actOnOpenSource(action: Action): Promise<boolean> } };
      ready: boolean;
      panel: { visible: boolean; webview: { postMessage(value: { state: State }): Promise<boolean> }; dispose(): void };
      state(): Promise<State>;
      push(): Promise<void>;
      handle(request: { type: 'home/open-source-action'; action: Action }): Promise<void>;
    };
    let claims = 0;
    let opened = 0;
    let ended = false;
    let browserAccepted = false;
    let missing: object | null = null;
    const displayed: (string | undefined)[] = [];
    internal.deps.guidance = {
      presentOpenSource: async () => { claims++; return claimed; },
      actOnOpenSource: async (action) => {
        opened++;
        ended = browserAccepted && action === 'star';
        return browserAccepted;
      },
    };
    internal.ready = true;
    internal.panel.visible = false;
    internal.panel.webview = { postMessage: async ({ state }) => { displayed.push(state.guidance?.card); return true; } };
    internal.state = async () => ({ guidance: ended ? null : { card: 'open-source' }, missing });
    await internal.push();
    assert.equal(claims, 0, 'a hidden Home does not claim a presentation');
    assert.equal(displayed.at(-1), undefined);
    internal.panel.visible = true;
    missing = {};
    await internal.push();
    assert.equal(claims, 0, 'a missing project does not claim a presentation');
    missing = null;
    await Promise.all([internal.push(), internal.push()]);
    assert.equal(claims, 1);
    assert.deepEqual(displayed.slice(-2), Array(2).fill(claimed ? 'open-source' : undefined));
    const star = { type: 'home/open-source-action', action: 'star' } as const;
    await internal.handle(star);
    assert.equal(opened, claimed ? 1 : 0, 'only the Home that claimed the card can act on it');
    if (claimed) {
      await internal.push();
      assert.equal(displayed.at(-1), 'open-source', 'a refused open leaves the card');
      browserAccepted = true;
      const pushesBeforeDiscussions = displayed.length;
      await internal.handle({ ...star, action: 'discussions' });
      assert.equal(opened, 2, 'Discussions opens from the current presentation');
      assert.equal(displayed.length, pushesBeforeDiscussions, 'Discussions keeps the current slot');
      await internal.handle(star);
      assert.equal(opened, 3, 'Star still works after Discussions');
      assert.equal(displayed.at(-1), undefined, 'accepted Star refreshes the slot');
    }
    home.dispose();
  }

  console.log('HomePanel tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
