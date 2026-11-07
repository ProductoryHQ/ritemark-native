/**
 * Sprint 155 (security review of #681, finding 2): a Flow step's error never carries the test key, not even the
 * masked form OpenAI's "Incorrect API key provided: sk-proj-****abcd" shows.
 *
 * A step's error goes to the Flow editor (`flow:stepError`, `flow:error`), a scheduled run's `lastError` and the run
 * history, so it is redacted where the step fails: `executeLLMNode` and `executeImageNode`. OpenAI answers 401 with
 * its own body (a fake `fetch`); the key is a fake one, in the test-key snapshot.
 *
 * Run: npx tsx src/flows/flowTestKeyErrors.test.ts
 */

// ── Minimal vscode stub (the geminiCallSites.test.ts technique) ──────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};
const vscodeMod = {
  workspace: {
    getConfiguration: () => ({ get: (_key: string, def: unknown) => def }),
    fs: { writeFile: async () => undefined, createDirectory: async () => undefined },
    workspaceFolders: undefined,
  },
  window: { showErrorMessage: () => undefined, registerCustomEditorProvider: () => ({ dispose() {} }) },
  commands: { executeCommand: async () => undefined },
  Uri: { parse: (s: string) => s, file: (s: string) => s, joinPath: (...parts: string[]) => parts.join('/') },
  EventEmitter: class { event = () => ({ dispose() {} }); fire() {} dispose() {} },
  Disposable: class { constructor(private readonly fn: () => void) {} dispose() { this.fn(); } },
};
const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') return '__vscode_stub__';
  return originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__', filename: '__vscode_stub__', loaded: true, children: [], paths: [], exports: vscodeMod,
};

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type * as vscode from 'vscode';
import type { FlowNode, ExecutionContext } from './types';
// Modules that import vscode load after the stub (an `import` would be hoisted above it)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { snapshotTestKeys } = require('../ai/providerKeys') as typeof import('../ai/providerKeys');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { initAPIKeyManager } = require('../ai/apiKeyManager') as typeof import('../ai/apiKeyManager');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { executeLLMNode, setExtensionContext } = require('./nodes/LLMNodeExecutor') as typeof import('./nodes/LLMNodeExecutor');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { executeImageNode, setImageNodeExtensionContext } = require('./nodes/ImageNodeExecutor') as typeof import('./nodes/ImageNodeExecutor');

// Assembled at run time so no key-shaped literal sits in the repo
const KEY = ['sk', 'proj', 'test', 'not', 'a', 'key', '0123456789abcd'].join('-');
const TAIL = KEY.slice(-4);
const MASKED = `sk-proj-${'*'.repeat(36)}${TAIL}`;

// Nothing saved; the key is the test environment's (the snapshot `activate` takes in the test channel)
const extensionContext = {
  secrets: { get: async () => undefined, store: async () => undefined, delete: async () => undefined, onDidChange: () => ({ dispose() {} }) },
  subscriptions: [],
} as unknown as vscode.ExtensionContext;
initAPIKeyManager(extensionContext);
setExtensionContext(extensionContext);
setImageNodeExtensionContext(extensionContext);

const requests: string[] = [];
globalThis.fetch = (async (input: string | URL | Request) => {
  requests.push(String(input instanceof Request ? input.url : input));
  return new Response(JSON.stringify({
    error: {
      message: `Incorrect API key provided: ${MASKED}. You can find your API key at https://platform.openai.com/account/api-keys.`,
      type: 'invalid_request_error',
      param: null,
      code: 'invalid_api_key',
    },
  }), { status: 401, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

let failures = 0;
async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}\n       ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function errorOf(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run();
  } catch (err) {
    return err as Error;
  }
  throw new Error('expected the step to fail');
}

function assertNoKey(err: Error): void {
  for (const text of [err.message, String(err.stack ?? '')]) {
    assert.ok(!text.includes(KEY), 'the key itself');
    assert.ok(!text.includes(MASKED) && !new RegExp(`\\*{3,}${TAIL}`).test(text), `the masked key: ${err.message}`);
  }
  assert.ok(err.message.includes('[test key]'), `says which key, without it: ${err.message}`);
}

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rm155-flowkey-'));
const context = { workspacePath: workspace, inputs: {}, outputs: new Map(), inputLabels: {}, nodeLabels: {} } as unknown as ExecutionContext;

async function main(): Promise<void> {
  console.log('Sprint 155: a Flow step error without the test key');
  snapshotTestKeys({ RITEMARK_BUILD_CHANNEL: 'test', RITEMARK_TEST_KEY_OPENAI: KEY });

  await test("an AI step on OpenAI: OpenAI's 401 reaches the run as [test key]", async () => {
    const step = {
      id: 'llm-1', type: 'llm-prompt', position: { x: 0, y: 0 },
      data: { label: 'Write', provider: 'openai', systemPrompt: '', userPrompt: 'Hello' },
    } as unknown as FlowNode;
    const err = await errorOf(() => executeLLMNode(step, context));
    assert.ok(requests.length > 0, 'the request was made with the test key');
    assertNoKey(err);
  });

  await test("the OpenAI image step: OpenAI's 401 reaches the run as [test key]", async () => {
    requests.length = 0;
    const step = {
      id: 'img-1', type: 'image-prompt', position: { x: 0, y: 0 },
      data: { label: 'Picture', provider: 'openai', prompt: 'A watercolour' },
    } as unknown as FlowNode;
    const err = await errorOf(() => executeImageNode(step, context));
    assert.ok(requests.length > 0, 'the request was made with the test key');
    assertNoKey(err);
  });

  await test("the Flow editor redacts what it posts too (flow:stepError, flow:error)", () => {
    const source = fs.readFileSync(path.join(__dirname, 'FlowEditorProvider.ts'), 'utf8');
    const step = source.indexOf("type: 'flow:stepError'");
    assert.ok(step > 0, 'the step error is posted');
    const run = source.slice(step - 400, source.indexOf("type: 'flow:error'", step) + 200);
    assert.ok(run.includes('redactTestKeys('), 'the step error is redacted before it is posted');
    assert.ok(!/error: [^\n]*err instanceof Error \? err\.message/.test(run), 'no raw message posted');
  });

  fs.rmSync(workspace, { recursive: true, force: true });
  if (failures > 0) {
    console.error(`flowTestKeyErrors: ${failures} failed`);
    process.exit(1);
  }
  console.log('flowTestKeyErrors: all passed');
}

main().catch((error) => { console.error(error); process.exit(1); });
