import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectMethods, probeMethods } from './lib/verify-codex-methods.mjs';

test('covers every outgoing app-server request, including the handshake', () => {
  assert.deepEqual(collectMethods().sort(), [
    'account/login/start', 'account/logout', 'account/rateLimits/read', 'account/read',
    'initialize', 'thread/read', 'thread/resume', 'thread/start', 'turn/interrupt', 'turn/start',
  ]);
});

// A JSONL peer checks the handshake and returns a response (or goes silent)
// without a Codex install, credentials, or a network connection.
const unknownMethodMessage = 'Invalid request: unknown variant `removed`, expected one of `initialize`, `denied`';
const peer = `
  import { readdirSync, writeFileSync } from 'node:fs';
  import { createInterface } from 'node:readline';
  let initialized = false;
  const home = process.env.CODEX_HOME;
  for await (const line of createInterface({ input: process.stdin })) {
    const { id, method, params } = JSON.parse(line);
    if (method === 'initialized') { initialized = true; continue; }
    let reply;
    if (method === 'initialize') {
      if (readdirSync(home).length || !params.capabilities.experimentalApi || params.clientInfo.name !== 'ritemark-native') process.exit(2);
      writeFileSync(process.argv[1], home);
      reply = { result: {} };
    } else if (!initialized) process.exit(3);
    else if (method === 'ok') reply = { result: null };
    else if (method === 'denied') reply = { error: { code: -32600, message: 'authentication required' } };
    else if (method === 'missing') reply = { error: { code: -32601, message: 'method not found' } };
    else if (method === 'removed') reply = { error: { code: -32600, message: ${JSON.stringify(unknownMethodMessage)} } };
    else if (method === 'silent') continue;
    else if (method === 'crash') process.exit(4);
    else if (method === 'malformed') reply = {};
    console.log(JSON.stringify({ id, ...reply }));
  }
`;

async function probe(methods) {
  const fixture = mkdtempSync(path.join(tmpdir(), 'codex-methods-test-'));
  const marker = path.join(fixture, 'child-home');
  const lines = [];
  try {
    const ok = await probeMethods(process.execPath, ['initialize', ...methods], {
      args: ['--input-type=module', '-e', peer, marker], timeoutMs: 1000, log: line => lines.push(line),
    });
    assert.equal(existsSync(readFileSync(marker, 'utf8')), false, 'temporary CODEX_HOME must be removed');
    return { ok, output: lines.join('\n') };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

test('accepts results and ordinary errors, rejects method-not-found, and continues checking', async () => {
  assert.equal((await probe(['ok', 'denied'])).ok, true);
  const { ok, output } = await probe(['ok', 'missing', 'denied']);
  assert.equal(ok, false);
  assert.match(output, /ok PRESENT.*result/);
  assert.match(output, /missing MISSING.*-32601/);
  assert.match(output, /denied PRESENT.*-32600/);
});

test('0.171.0 identifies an unknown method by advertising its dispatch list', async () => {
  const { ok, output } = await probe(['removed', 'denied']);
  assert.equal(ok, false);
  assert.match(output, /removed MISSING/);
  assert.match(output, /denied PRESENT.*-32600/);
});

for (const [method, reason] of [['silent', /timed out/], ['crash', /closed|exited/], ['malformed', /invalid response/]]) {
  test(`fails when the peer gives no usable answer (${method})`, async () => {
    const { ok, output } = await probe([method]);
    assert.equal(ok, false);
    assert.match(output, reason);
  });
}
