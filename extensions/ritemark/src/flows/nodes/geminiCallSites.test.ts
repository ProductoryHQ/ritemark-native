/**
 * Sprint 141 R12 (#558), R5 and R4: what a Flow's Gemini steps and the model probe
 * send, and what the person reads back. `fetch` is mocked; no request reaches
 * Google and no real key is used.
 * Run: npx tsx src/flows/nodes/geminiCallSites.test.ts
 */

// ── Minimal vscode stub (the CodexRuntime.test.ts technique) ─────────────────
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
  window: { showErrorMessage: () => undefined },
  Uri: { parse: (s: string) => s, file: (s: string) => s },
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
import { DEFAULT_MODELS, GEMINI_MODEL_IDS } from '../../ai/modelConfig';
import { discoverGemini } from '../../ai/modelCatalog/providerDiscovery';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { executeLLMNode, setExtensionContext } = require('./LLMNodeExecutor') as typeof import('./LLMNodeExecutor');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { executeImageNode, setImageNodeExtensionContext } = require('./ImageNodeExecutor') as typeof import('./ImageNodeExecutor');
import { FlowStepError, MAX_TOKENS_SENTENCE, modelRefusedSentence } from './geminiStep';
import { flowModelDefaults } from '../flowModelDefaults';
import { resolveAll } from '../../ai/modelCatalog/resolver';
import { BUNDLED_CATALOG } from '../../ai/modelCatalog/bundledCatalog';
import type { FlowNode, ExecutionContext } from '../types';

const KEY = 'test-placeholder-not-a-key';
const fakeContext = { secrets: { get: async (name: string) => (name === 'google-ai-key' ? KEY : undefined) } } as unknown as vscode.ExtensionContext;
setExtensionContext(fakeContext);
setImageNodeExtensionContext(fakeContext);

interface Call { url: string; headers: Record<string, string>; body?: unknown }
let calls: Call[] = [];
let respond: (call: Call) => Response = () => new Response('{}', { status: 500 });
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const call: Call = {
    url: String(input),
    headers: { ...(init?.headers as Record<string, string>) },
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
  };
  calls.push(call);
  return respond(call);
}) as typeof fetch;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function assertKeyInHeaderOnly(call: Call): void {
  assert.equal(call.headers['x-goog-api-key'], KEY, 'the key is in x-goog-api-key');
  assert.ok(!call.url.includes(KEY), `the URL holds no key: ${call.url}`);
  assert.ok(!/[?&]key=/.test(call.url), `no key= in ${call.url}`);
}

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rm141-'));
const context = { workspacePath: workspace, inputs: {}, outputs: new Map(), inputLabels: {}, nodeLabels: {} } as unknown as ExecutionContext;

function llmNode(model: string | undefined, maxTokens?: number): FlowNode {
  return {
    id: 'llm-1',
    type: 'llm-prompt',
    position: { x: 0, y: 0 },
    data: { label: 'Step', provider: 'gemini', ...(model ? { model } : {}), systemPrompt: '', userPrompt: 'Hello', ...(maxTokens ? { maxTokens } : {}) },
  } as unknown as FlowNode;
}

let failures = 0;
async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  calls = [];
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

async function main(): Promise<void> {
  await test('S49: a Gemini LLM step sends the key in the header, and answers', async () => {
    respond = () => json(200, { candidates: [{ content: { parts: [{ text: 'Hi there' }] }, finishReason: 'STOP' }] });
    const answer = await executeLLMNode(llmNode(GEMINI_MODEL_IDS.FLASH_3_8), context);
    assert.equal(answer, 'Hi there');
    assert.equal(calls.length, 1);
    assertKeyInHeaderOnly(calls[0]);
    assert.ok(calls[0].url.endsWith(`/v1beta/models/${GEMINI_MODEL_IDS.FLASH_3_8}:generateContent`));
  });

  await test('S13 (R4): a step with no model runs on the catalog default, which is the editor\'s', async () => {
    respond = () => json(200, { candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
    await executeLLMNode(llmNode(undefined), context);
    const editorDefault = flowModelDefaults(() => '').flowLLMGemini;
    assert.equal(editorDefault, DEFAULT_MODELS.flowLLMGemini);
    assert.ok(calls[0].url.includes(`/models/${editorDefault}:generateContent`), calls[0].url);
  });

  await test('S16 (R5): the documented 404 for a refused model reads as one sentence', async () => {
    respond = () => json(404, { error: { code: 404, status: 'NOT_FOUND', message: `models/${GEMINI_MODEL_IDS.FLASH_2_5} is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.` } });
    const err = await errorOf(() => executeLLMNode(llmNode(GEMINI_MODEL_IDS.FLASH_2_5), context));
    assert.ok(err instanceof FlowStepError);
    assert.equal(err.message, modelRefusedSentence('Gemini 2.5 Flash'));
    assert.ok(!err.message.includes('{'), 'no JSON');
  });

  await test('S54 (R5 revised): "no longer available to new users" reads the same', async () => {
    respond = () => json(404, { error: { code: 404, status: 'NOT_FOUND', message: `This model models/${GEMINI_MODEL_IDS.FLASH_2_5} is no longer available to new users. Please update your code to use a newer model.` } });
    const err = await errorOf(() => executeLLMNode(llmNode(GEMINI_MODEL_IDS.FLASH_2_5), context));
    assert.equal(err.message, modelRefusedSentence('Gemini 2.5 Flash'));
  });

  await test('S17 (R5): another Google error shows Google\'s own sentence once', async () => {
    respond = () => json(500, { error: { code: 500, status: 'INTERNAL', message: 'An internal error has occurred. Please retry or report in https://developers.generativeai.google/guide/troubleshooting' } });
    const err = await errorOf(() => executeLLMNode(llmNode(GEMINI_MODEL_IDS.FLASH_3_8), context));
    assert.equal(err.message, 'LLM error: An internal error has occurred. Please retry or report in https://developers.generativeai.google/guide/troubleshooting');
  });

  await test('S18 (R5): a 404 that names another resource is not a model refusal (negative)', async () => {
    respond = () => json(404, { error: { code: 404, status: 'NOT_FOUND', message: 'Requested entity was not found.' } });
    const err = await errorOf(() => executeLLMNode(llmNode(GEMINI_MODEL_IDS.FLASH_3_8), context));
    assert.ok(!(err instanceof FlowStepError));
    assert.equal(err.message, 'LLM error: Requested entity was not found.');
  });

  await test('S18 (R5): a rate limit keeps today\'s sentence (negative)', async () => {
    respond = () => json(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'rate_limit exceeded for requests per minute' } });
    const err = await errorOf(() => executeLLMNode(llmNode(GEMINI_MODEL_IDS.FLASH_3_8), context));
    assert.equal(err.message, 'API rate limit exceeded. Please wait and try again.');
  });

  await test('S55 (R5 revised): an answer cut off at Max tokens with no text says so', async () => {
    respond = () => json(200, { candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }] });
    const err = await errorOf(() => executeLLMNode(llmNode(GEMINI_MODEL_IDS.FLASH_3_8), context));
    assert.equal(err.message, MAX_TOKENS_SENTENCE);
  });

  await test('S51: no Gemini step error carries the key', async () => {
    respond = () => { throw new TypeError('fetch failed'); };
    const err = await errorOf(() => executeLLMNode(llmNode(GEMINI_MODEL_IDS.FLASH_3_8), context));
    assert.ok(!err.message.includes(KEY));
  });

  await test('S49: the Gemini image step sends the key in the header', async () => {
    respond = () => json(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Bad request' } });
    const node = { id: 'img-1', type: 'image-prompt', position: { x: 0, y: 0 }, data: { label: 'Image', provider: 'gemini', prompt: 'A cat' } } as unknown as FlowNode;
    const err = await errorOf(() => executeImageNode(node, context));
    assert.equal(err.message, 'Bad request');
    assertKeyInHeaderOnly(calls[0]);
    assert.ok(calls[0].url.endsWith(':generateContent'));
  });

  await test('S49: the Imagen step sends the key in the header', async () => {
    respond = () => json(404, { error: { code: 404, status: 'NOT_FOUND', message: 'Imagen models are shut down' } });
    const node = { id: 'img-2', type: 'image-prompt', position: { x: 0, y: 0 }, data: { label: 'Image', provider: 'gemini', model: 'imagen-test', prompt: 'A cat' } } as unknown as FlowNode;
    await errorOf(() => executeImageNode(node, context));
    assertKeyInHeaderOnly(calls[0]);
    assert.ok(calls[0].url.endsWith('/v1beta/models/imagen-test:predict'));
  });

  await test('S49/S52: the model probe sends the header and reads every page', async () => {
    respond = (call) => (call.url.includes('pageToken=')
      ? json(200, { models: [{ name: `models/${GEMINI_MODEL_IDS.ARGON_4}`, supportedGenerationMethods: ['generateContent'] }] })
      : json(200, { models: [{ name: `models/${GEMINI_MODEL_IDS.FLASH_3_8}`, supportedGenerationMethods: ['generateContent'] }, { name: 'models/text-embedding', supportedGenerationMethods: ['embedContent'] }], nextPageToken: 'next' }));
    const models = await discoverGemini(KEY);
    assert.deepEqual(models?.map((m) => m.id), [GEMINI_MODEL_IDS.FLASH_3_8, GEMINI_MODEL_IDS.ARGON_4]);
    assert.equal(calls.length, 2);
    calls.forEach(assertKeyInHeaderOnly);
  });

  await test('S14 (R4): a feed default reaches the editor through the catalog', () => {
    const feed = {
      schemaVersion: 1 as const,
      updatedAt: '2099-01-01T00:00:00Z',
      providers: { gemini: { defaults: { 'flow-llm': GEMINI_MODEL_IDS.FLASH_3_8 }, models: BUNDLED_CATALOG.providers.gemini!.models } },
    };
    const resolved = resolveAll({}, feed, null, BUNDLED_CATALOG, '2.1.0');
    const defaults = flowModelDefaults((provider) => resolved[provider].defaults['flow-llm'] ?? '');
    assert.equal(defaults.flowLLMGemini, GEMINI_MODEL_IDS.FLASH_3_8);
    assert.equal(defaults.flowImageGemini, DEFAULT_MODELS.flowImageGemini, 'image defaults stay DEFAULT_MODELS\'');
  });

  fs.rmSync(workspace, { recursive: true, force: true });
  if (failures > 0) {
    console.error(`\ngeminiCallSites: ${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('\ngeminiCallSites: all tests passed');
}

void main();
