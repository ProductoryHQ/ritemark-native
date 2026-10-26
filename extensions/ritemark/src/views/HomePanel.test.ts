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
  extensions: { onDidChange: () => disposable('extensions') },
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? vscodeStub : load(request, ...rest));

async function main(): Promise<void> {
  const { HomeHost } = await import('./HomePanel');
  const { ProjectList } = await import('../projects/ProjectList');

  function host(): { home: InstanceType<typeof HomeHost>; list: InstanceType<typeof ProjectList> } {
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
      openConversation: async () => undefined,
      onProjectsChanged: () => undefined,
      guidance: null,
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

  console.log('HomePanel tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
