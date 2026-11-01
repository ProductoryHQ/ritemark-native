/**
 * Sprint 145 R5 (#580): every Flow step without its key says the Experience lead's sentence (experiences 13 and 31),
 * in a run's error as plain text and in the step's panel with a link to Settings at that key.
 *
 * The four places that said something else: the OpenAI image step (`ImageNodeExecutor`), the AI step on OpenAI and
 * on Gemini (`LLMNodeExecutor`, whose "LLM error:" prefix used to wrap any message), and the OpenAI image step's
 * model list (`FlowEditorProvider`). An AI step's panel had no key check at all; the host now answers its model list
 * with the sentence and the link when the provider's key is missing, checking only that a key exists.
 *
 * No key is stored or sent: the secret store answers "none", or a placeholder, and `fetch` fails the test if called.
 * Run: npx tsx src/flows/stepNeedsKey.test.ts
 */

// ── Minimal vscode stub (the geminiCallSites.test.ts technique) ──────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};
const vscodeMod = {
  workspace: {
    getConfiguration: () => ({ get: (_key: string, def: unknown) => def }),
    fs: { writeFile: async () => undefined },
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
import {
  GOOGLE_AI_KEY_NEEDED,
  OPENAI_KEY_NEEDED,
  STEP_KEY_SECRETS,
  StepNeedsKeyError,
  stepKeyAnswer,
  stepKeyCopy,
} from './flowModelDefaults';
import type { FlowNode, ExecutionContext } from './types';
// Modules that import vscode load after the stub (an `import` would be hoisted above it)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isSettingsSection } = require('../settings/RitemarkSettingsProvider') as typeof import('../settings/RitemarkSettingsProvider');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { initAPIKeyManager, getAPIKeyManager } = require('../ai/apiKeyManager') as typeof import('../ai/apiKeyManager');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { executeLLMNode, setExtensionContext } = require('./nodes/LLMNodeExecutor') as typeof import('./nodes/LLMNodeExecutor');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { executeImageNode, setImageNodeExtensionContext } = require('./nodes/ImageNodeExecutor') as typeof import('./nodes/ImageNodeExecutor');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FlowEditorProvider } = require('./FlowEditorProvider') as typeof import('./FlowEditorProvider');

const PLACEHOLDER = 'test-placeholder-not-a-key';
const stored = new Map<string, string>();
const secretListeners = new Set<(event: { key: string }) => void>();
const extensionContext = {
  secrets: {
    get: async (name: string) => stored.get(name),
    store: async () => undefined,
    delete: async () => undefined,
    onDidChange: (listener: (event: { key: string }) => void) => {
      secretListeners.add(listener);
      return { dispose: () => secretListeners.delete(listener) };
    },
  },
  subscriptions: [],
} as unknown as vscode.ExtensionContext;
initAPIKeyManager(extensionContext);
setExtensionContext(extensionContext);
setImageNodeExtensionContext(extensionContext);

globalThis.fetch = (async (input: string | URL) => {
  throw new Error(`no request is made without a key: ${String(input)}`);
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

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rm145-key-'));
const context = { workspacePath: workspace, inputs: {}, outputs: new Map(), inputLabels: {}, nodeLabels: {} } as unknown as ExecutionContext;
const llmStep = (provider: 'openai' | 'gemini') => ({
  id: 'llm-1', type: 'llm-prompt', position: { x: 0, y: 0 },
  data: { label: 'Write', provider, systemPrompt: '', userPrompt: 'Hello' },
}) as unknown as FlowNode;
const imageStep = (provider: 'openai' | 'gemini') => ({
  id: 'img-1', type: 'image-prompt', position: { x: 0, y: 0 },
  data: { label: 'Picture', provider, prompt: 'A watercolour' },
}) as unknown as FlowNode;

const OPENAI_SENTENCE = 'This step needs an OpenAI API key to run. Add it in Settings';
const GOOGLE_SENTENCE = 'This step needs a Google AI API key to run. Add it in Settings';

/** What the host posts back for one `flow:getModels`. */
async function modelsAnswer(provider: 'openai' | 'gemini', modelType: 'llm' | 'image'): Promise<Record<string, unknown>> {
  const posted: Array<Record<string, unknown>> = [];
  const webview = { postMessage: async (message: Record<string, unknown>) => { posted.push(message); return true; } };
  const host = new FlowEditorProvider(extensionContext) as unknown as {
    fetchModels(provider: string, modelType: string, webview: unknown): Promise<void>;
  };
  await host.fetchModels(provider, modelType, webview);
  assert.equal(posted.length, 1, 'one answer');
  assert.equal(posted[0].type, 'flow:models');
  assert.ok(!JSON.stringify(posted[0]).includes(PLACEHOLDER), 'no key in the answer');
  return posted[0];
}

const errorOutput = console.error;

async function main(): Promise<void> {
  console.log('Sprint 145 R5: a step without its key');

  await test("the copy: the Experience lead's words, word for word", () => {
    assert.equal(`${OPENAI_KEY_NEEDED.text} ${OPENAI_KEY_NEEDED.action}`, OPENAI_SENTENCE);
    assert.equal(OPENAI_KEY_NEEDED.tooltip, 'Open Settings at the OpenAI API key');
    assert.equal(OPENAI_KEY_NEEDED.settingsSection, 'openai-api-key');
    assert.equal(`${GOOGLE_AI_KEY_NEEDED.text} ${GOOGLE_AI_KEY_NEEDED.action}`, GOOGLE_SENTENCE);
    assert.equal(GOOGLE_AI_KEY_NEEDED.tooltip, 'Open Settings at the Google AI API key');
    assert.equal(GOOGLE_AI_KEY_NEEDED.settingsSection, 'google-ai-key');
    for (const copy of [OPENAI_KEY_NEEDED, GOOGLE_AI_KEY_NEEDED]) {
      assert.ok(!/⚠|not configured|Command Palette/.test(`${copy.text} ${copy.action}`), 'no warning sign, no old words');
    }
  });

  await test('each key has its own Settings section, and Settings opens there', () => {
    // The copy's sections are ones `ritemark.aiSettings` opens (it drops any other, and Settings opens at the top)
    for (const copy of [OPENAI_KEY_NEEDED, GOOGLE_AI_KEY_NEEDED]) {
      assert.equal(isSettingsSection(copy.settingsSection), true, `Settings has a section ${copy.settingsSection}`);
    }
    assert.equal(stepKeyCopy('openai'), OPENAI_KEY_NEEDED);
    assert.equal(stepKeyCopy('gemini'), GOOGLE_AI_KEY_NEEDED);
    assert.equal(isSettingsSection('openai-api-key'), true, "ritemark.aiSettings accepts the OpenAI key's section");
    assert.equal(isSettingsSection('google-ai-key'), true);
    assert.equal(isSettingsSection('anthropic-api-key'), false, 'only the sections the page has');
  });

  await test("the keys' secret names are the ones Settings and the key manager store", async () => {
    stored.set(STEP_KEY_SECRETS.openai, PLACEHOLDER);
    try {
      assert.equal(await getAPIKeyManager().hasAPIKey(), true, "the OpenAI name is apiKeyManager's");
    } finally {
      stored.clear();
    }
    assert.equal(STEP_KEY_SECRETS.gemini, 'google-ai-key', "Settings' Google AI key");
  });

  await test('the error a run shows is the plain sentence', () => {
    assert.equal(new StepNeedsKeyError(OPENAI_KEY_NEEDED).message, OPENAI_SENTENCE);
    assert.equal(new StepNeedsKeyError(GOOGLE_AI_KEY_NEEDED).message, GOOGLE_SENTENCE);
    assert.deepEqual(stepKeyAnswer(OPENAI_KEY_NEEDED), {
      error: OPENAI_KEY_NEEDED.text,
      errorAction: { label: 'Add it in Settings', tooltip: 'Open Settings at the OpenAI API key', settingsSection: 'openai-api-key' },
    });
  });

  await test('an AI step on OpenAI with no key fails with the sentence, no "LLM error:"', async () => {
    const err = await errorOf(() => executeLLMNode(llmStep('openai'), context));
    assert.ok(err instanceof StepNeedsKeyError, `a StepNeedsKeyError (got ${err.name}: ${err.message})`);
    assert.equal(err.message, OPENAI_SENTENCE);
  });

  await test('an AI step on Gemini with no key fails with the sentence', async () => {
    const err = await errorOf(() => executeLLMNode(llmStep('gemini'), context));
    assert.ok(err instanceof StepNeedsKeyError, `a StepNeedsKeyError (got ${err.name}: ${err.message})`);
    assert.equal(err.message, GOOGLE_SENTENCE);
  });

  await test('the OpenAI image step with no key fails with the sentence', async () => {
    const err = await errorOf(() => executeImageNode(imageStep('openai'), context));
    assert.ok(err instanceof StepNeedsKeyError, `a StepNeedsKeyError (got ${err.name}: ${err.message})`);
    assert.equal(err.message, OPENAI_SENTENCE);
  });

  await test('the Google image step with no key: as in Sprint 144', async () => {
    const err = await errorOf(() => executeImageNode(imageStep('gemini'), context));
    assert.equal(err.message, GOOGLE_SENTENCE);
  });

  // The panels' answers (`flow:getModels`). The catalog isn't started here, so the LLM list is the bundled one and
  // no probe runs.
  console.error = (...args: unknown[]) => { if (!String(args[0]).includes('[FlowEditorProvider]')) errorOutput(...args); };

  await test("an AI step's panel on OpenAI, no key: the list, the sentence and the link to the OpenAI key", async () => {
    const answer = await modelsAnswer('openai', 'llm');
    assert.equal(answer.modelType, 'llm');
    assert.ok(Array.isArray(answer.models) && answer.models.length > 0, 'the picker keeps its list');
    assert.equal(answer.error, OPENAI_KEY_NEEDED.text);
    assert.deepEqual(answer.errorAction, { label: 'Add it in Settings', tooltip: 'Open Settings at the OpenAI API key', settingsSection: 'openai-api-key' });
  });

  await test("an AI step's panel on Gemini, no key: the link to the Google AI key", async () => {
    const answer = await modelsAnswer('gemini', 'llm');
    assert.ok(Array.isArray(answer.models) && answer.models.length > 0, 'the picker keeps its list');
    assert.equal(answer.error, GOOGLE_AI_KEY_NEEDED.text);
    assert.deepEqual(answer.errorAction, { label: 'Add it in Settings', tooltip: 'Open Settings at the Google AI API key', settingsSection: 'google-ai-key' });
  });

  await test("the OpenAI image step's panel, no key: the sentence, not \"OpenAI API key not configured\"", async () => {
    const answer = await modelsAnswer('openai', 'image');
    assert.equal(answer.error, OPENAI_KEY_NEEDED.text);
    assert.deepEqual(answer.errorAction, { label: 'Add it in Settings', tooltip: 'Open Settings at the OpenAI API key', settingsSection: 'openai-api-key' });
  });

  await test("the Google image step's panel, no key: as in Sprint 144, with the tooltip from the copy", async () => {
    const answer = await modelsAnswer('gemini', 'image');
    assert.equal(answer.error, GOOGLE_AI_KEY_NEEDED.text);
    assert.deepEqual(answer.errorAction, { label: 'Add it in Settings', tooltip: 'Open Settings at the Google AI API key', settingsSection: 'google-ai-key' });
  });

  await test("an AI step's panel with its key: no sentence", async () => {
    stored.set('openai-api-key', PLACEHOLDER);
    stored.set('google-ai-key', PLACEHOLDER);
    try {
      for (const provider of ['openai', 'gemini'] as const) {
        const answer = await modelsAnswer(provider, 'llm');
        assert.equal(answer.error, undefined, `${provider}: no error`);
        assert.equal(answer.errorAction, undefined, `${provider}: no link`);
      }
    } finally {
      stored.clear();
    }
  });

  await test("a key added or removed in Settings: an open flow's panels ask again", async () => {
    const posted: Array<Record<string, unknown>> = [];
    let disposed: (() => void) | undefined;
    const panel = {
      webview: {
        asWebviewUri: (uri: unknown) => uri,
        cspSource: 'test',
        options: {},
        html: '',
        onDidReceiveMessage: () => ({ dispose() {} }),
        postMessage: async (message: Record<string, unknown>) => { posted.push(message); return true; },
      },
      onDidDispose: (listener: () => void) => { disposed = listener; return { dispose() {} }; },
    };
    const host = new FlowEditorProvider(extensionContext);
    await host.resolveCustomTextEditor({} as vscode.TextDocument, panel as unknown as vscode.WebviewPanel, {} as vscode.CancellationToken);
    const fire = (key: string) => { for (const listener of [...secretListeners]) listener({ key }); };
    fire('openai-api-key');
    fire('google-ai-key');
    fire('anthropic-api-key');
    assert.deepEqual(posted.map((m) => m.type), ['flow:keysChanged', 'flow:keysChanged'], 'only the two Flow keys');
    assert.deepEqual(posted.map((m) => m.provider), ['openai', 'gemini'], "each names its provider, never the key's value");
    disposed?.();
    assert.equal(secretListeners.size, 0, 'a closed editor stops listening');
  });

  console.error = errorOutput;
  fs.rmSync(workspace, { recursive: true, force: true });

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('stepNeedsKey.test.ts passed');
}

void main();
