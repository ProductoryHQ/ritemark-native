/**
 * Sprint 99 D2: browser tool calls are serialized across conversations.
 *
 * One integrated browser, one active tab — so without this, chat A's navigate can
 * land between chat B's navigate and its snapshot, and B reasons about A's page.
 *
 * Run: npx tsx src/browser/browserActionSerialization.test.ts
 */

// ── vscode stub: executeCommand records its interleaving ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};

const order: string[] = [];
let delayFor: (command: string) => number = () => 0;

const vscodeMod = {
  commands: {
    executeCommand: async (command: string, args?: Record<string, unknown>) => {
      const tag = String(args?.tag ?? command);
      order.push(`start:${tag}`);
      await new Promise((r) => setTimeout(r, delayFor(command)));
      order.push(`end:${tag}`);
      return { summary: tag };
    },
  },
};
const _originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') { return '__vscode_stub__'; }
  return _originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__', filename: '__vscode_stub__', loaded: true, children: [], paths: [], exports: vscodeMod,
};

import * as assert from 'assert';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tools = require('./BrowserActionTools') as typeof import('./BrowserActionTools');

async function run() {
  // Two conversations firing browser actions at the same moment. The slow one
  // goes first, so an unserialized implementation would interleave visibly.
  {
    order.length = 0;
    delayFor = (cmd) => (cmd.includes('Navigate') ? 40 : 0);

    const a = tools.browserNavigate({ url: 'https://a.example', tag: 'A-navigate' } as never);
    const b = tools.browserScroll({ direction: 'down', tag: 'B-snapshot' } as never);
    await Promise.all([a, b]);

    assert.deepStrictEqual(
      order,
      ['start:A-navigate', 'end:A-navigate', 'start:B-snapshot', 'end:B-snapshot'],
      'B must not start until A has finished — otherwise B acts on a page A is mid-navigating',
    );
    console.log('✓ Test 1: concurrent browser actions run one at a time');
  }

  // A failing action must not wedge the queue for everyone else.
  {
    order.length = 0;
    delayFor = () => 0;
    const boom = vscodeMod.commands.executeCommand;
    let first = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vscodeMod.commands as any).executeCommand = async (command: string, args?: Record<string, unknown>) => {
      if (first) { first = false; throw new Error('workbench exploded'); }
      return boom(command, args);
    };

    const failed = await tools.browserClick({ ref: 'x', tag: 'fails' } as never);
    const after = await tools.browserClick({ ref: 'y', tag: 'after' } as never);

    assert.ok(failed.error, 'the failing action reports its error');
    assert.strictEqual(after.summary, 'after', 'a later action still runs after a failure');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vscodeMod.commands as any).executeCommand = boom;
    console.log('✓ Test 2: a failed action does not wedge the queue');
  }

  console.log('\nAll 2 browser serialization tests passed!');
}

run().catch((err) => { console.error(err); process.exit(1); });
