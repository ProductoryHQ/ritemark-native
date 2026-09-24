#!/usr/bin/env node
// Offline smoke check for a Claude Code version, before it goes into
// canary.claudeCodeVersions: does the real CLI accept a model declared through
// settings.modelPicker, and does it send that model with the declared output
// budget? A local HTTP server stands in for the API. No key is used, and
// nothing leaves the machine except the npm downloads.
//
//   node scripts/model-catalog/canary-smoke.mjs [<claude-code version> ...]
//
// With no version it checks every configured one. It relies on an undocumented
// CLI switch (_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL) so the local server gets
// first-party request handling; if a CLI version drops it, rely on a dry run of
// the live canary instead (see feeds/README.md).

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canaryWithQuery, prepareRuntime } from './canary.mjs';

const MODEL = 'claude-opus-99';
const BUDGET = 64000;

function streamedReply(model) {
  const events = [
    ['message_start', { type: 'message_start', message: { id: 'msg_smoke', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 12, output_tokens: 1 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'OK' } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }],
    ['message_stop', { type: 'message_stop' }],
  ];
  return events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
}

/** A stand-in for the Messages API that answers as `serveAs` (or the requested model). */
async function startStandIn() {
  const state = { serveAs: null, requests: [] };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (req.method === 'POST' && req.url.startsWith('/v1/messages/count_tokens')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ input_tokens: 12 }));
      } else if (req.method === 'POST' && req.url.startsWith('/v1/messages')) {
        const json = JSON.parse(body);
        state.requests.push({ model: json.model, max_tokens: json.max_tokens, tools: (json.tools ?? []).length, stream: json.stream === true });
        const model = state.serveAs ?? json.model;
        if (json.stream) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.end(streamedReply(model));
        } else {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ id: 'msg_smoke', type: 'message', role: 'assistant', model, content: [{ type: 'text', text: 'OK' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 12, output_tokens: 1 } }));
        }
      } else {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'canary smoke stand-in' } }));
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { state, server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function smoke(cliVersion, sdkVersion, standIn) {
  const { cliPath, sdkPath } = prepareRuntime({ cliVersion, sdkVersion, cacheDir: join(tmpdir(), 'catalog-runtimes') });
  const { query } = await import(pathToFileURL(sdkPath).href);
  const local = (args) => query({
    ...args,
    options: { ...args.options, env: { ...args.options.env, ANTHROPIC_BASE_URL: standIn.baseUrl, _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: '1', CLAUDE_CODE_MAX_RETRIES: '0' } },
  });
  const run = () => canaryWithQuery({ query: local, cliPath, modelId: MODEL, label: 'Opus 99', maxOutputTokens: BUDGET, apiKey: 'sk-ant-smoke-not-a-real-key', timeoutMs: 90_000 });

  standIn.state.serveAs = null;
  standIn.state.requests = [];
  const pass = await run();
  const main = standIn.state.requests.find((request) => request.stream);
  standIn.state.serveAs = 'claude-opus-5';
  const wrong = await run();

  const problems = [];
  if (!pass.ok) problems.push(`canary failed: ${pass.reason}`);
  if (main?.model !== MODEL) problems.push(`the CLI requested ${main?.model ?? 'nothing'}`);
  if (main?.max_tokens !== BUDGET) problems.push(`the CLI sent max_tokens ${main?.max_tokens}`);
  if (main?.tools !== 0) problems.push(`the CLI offered ${main?.tools} tools`);
  if (wrong.ok) problems.push('a reply from another model was accepted');
  return { cliVersion, ok: problems.length === 0, problems, request: main ?? null };
}

const config = JSON.parse(readFileSync('feeds/model-catalog.config.json', 'utf8'));
const versions = process.argv.slice(2).length > 0 ? process.argv.slice(2) : config.canary.claudeCodeVersions;
const standIn = await startStandIn();
let failed = false;
try {
  for (const version of versions) {
    const result = await smoke(version, config.canary.agentSdkVersion, standIn);
    failed ||= !result.ok;
    console.log(JSON.stringify(result));
  }
} finally {
  standIn.server.close();
}
process.exit(failed ? 1 : 0);
