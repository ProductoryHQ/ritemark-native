/**
 * #1120: the update notices offer two buttons in sentence case, so VS Code's
 * "Source: Ritemark" label fits beside them.
 */
import * as assert from 'assert';

const shown: unknown[][] = [];
let answer: string | undefined;
const vscodeMod = {
  window: {
    showInformationMessage: async (...args: unknown[]) => { shown.push(args); return answer; },
  },
  ProgressLocation: { Notification: 15 },
};
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === 'vscode') return '__vscode_stub_1120__';
  return originalResolve.call(this, request, ...rest);
};
(require as any).cache['__vscode_stub_1120__'] = {
  id: '__vscode_stub_1120__', filename: '__vscode_stub_1120__', loaded: true, exports: vscodeMod,
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { showFullUpdateNotification, showExtensionUpdateNotification } = require('./updateNotification');

const manifest = { version: '2.4.0', releaseNotes: '', files: [] } as any;

(async () => {
  shown.length = 0; answer = undefined;
  assert.equal(await showFullUpdateNotification(manifest), 'later', 'closing the notice is Later');
  assert.deepEqual(shown[0].slice(2), ['Download installer', 'Later'], 'a full update offers two buttons');

  answer = 'Download installer';
  assert.equal(await showFullUpdateNotification(manifest), 'install');

  shown.length = 0; answer = 'Install update';
  assert.equal(await showExtensionUpdateNotification(manifest), 'install');
  assert.deepEqual(shown[0].slice(2), ['Install update', 'Later'], 'an extension update offers two buttons');

  answer = 'Later';
  assert.equal(await showExtensionUpdateNotification(manifest), 'later');

  for (const call of shown) {
    for (const label of call.slice(2) as string[]) {
      assert.ok(!/\s[A-Z]/.test(label), `"${label}" is in sentence case`);
    }
  }
  console.log('updateNotification: all assertions passed');
})().catch((error) => { console.error(error); process.exit(1); });
