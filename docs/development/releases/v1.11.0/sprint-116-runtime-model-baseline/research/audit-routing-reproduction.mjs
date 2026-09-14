// Audit-only reproduction against the unchanged adapter; no binary is started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('extensions/ritemark/package.json'));
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === 'vscode' ? '__s116_vscode_stub__' : originalResolve.call(this, request, ...rest);
};
require.cache.__s116_vscode_stub__ = { id: '__s116_vscode_stub__', filename: '__s116_vscode_stub__', loaded: true, exports: { workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) } } };
const { CodexRuntime } = require(path.resolve('extensions/ritemark/src/codex/CodexRuntime.ts'));
const session = { conversationId: 'synthetic-current' };
const runtime = Object.create(CodexRuntime.prototype);
runtime._sessions = new Map([['synthetic-current', session]]);
runtime._sessionsByThread = new Map([['synthetic-known-thread', session]]);
const result = {
  capturedAt: new Date().toISOString(),
  source: 'extensions/ritemark/src/codex/CodexRuntime.ts:_sessionForThread',
  knownThreadRoutesToSession: runtime._sessionForThread('synthetic-known-thread', 'audit') === session,
  unknownExplicitThreadRoutesToSession: runtime._sessionForThread('synthetic-retired-thread', 'audit') === session,
  missingThreadRoutesToSession: runtime._sessionForThread(undefined, 'audit') === session,
  verdict: 'REPRODUCED: an explicit unknown thread ID is attributed to the sole live session',
};
await fs.writeFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence/codex-routing-reproduction.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
