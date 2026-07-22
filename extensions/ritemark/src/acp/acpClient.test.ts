/**
 * Tests for AcpClient — Sprint 76 R1.
 *
 * Run: npx tsx src/acp/acpClient.test.ts
 *
 * Approach (same spirit as codexManager.test.ts's "scripted JSON-RPC over fake
 * stdio"): we spawn a tiny scripted ACP agent as a real child process. The
 * agent is a Node script that speaks ndjson JSON-RPC and is driven by env vars,
 * so the real @agentclientprotocol/sdk wire layer is exercised end-to-end —
 * handshake, prompt with streaming updates, permission round-trip, malformed
 * JSON resilience, and process-exit handling.
 */

import assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { AcpClient, type AcpClientHandlers } from './acpClient';

// ── Scripted agent ──────────────────────────────────────────────────────────
// A minimal ACP agent that responds to JSON-RPC requests from the client. It
// supports the handshake, session/new, and a session/prompt that streams a
// thought + message chunk, optionally requests a permission, then returns a
// PromptResponse. Behaviour is toggled via env vars set per test.
const AGENT_SCRIPT = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\\n'); }
function result(id, res) { send({ jsonrpc: '2.0', id, result: res }); }
function notify(method, params) { send({ jsonrpc: '2.0', method, params }); }

// Emit a malformed JSON line up front to prove the client survives it.
if (process.env.AGENT_EMIT_GARBAGE === '1') {
  process.stdout.write('this is not json\\n');
}

rl.on('line', async (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.method === 'initialize') {
    result(msg.id, {
      protocolVersion: 1,
      agentCapabilities: {},
      authMethods: [],
      agentInfo: { name: 'ScriptedAgent', version: '0.0.1' },
    });
  } else if (msg.method === 'session/new') {
    result(msg.id, { sessionId: 'ses_test_1', configOptions: [] });
  } else if (msg.method === 'session/set_config_option') {
    result(msg.id, { configOptions: [] });
  } else if (msg.method === 'session/prompt') {
    const sid = msg.params.sessionId;
    notify('session/update', { sessionId: sid, update: { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'thinking…' } } });
    if (process.env.AGENT_REQUEST_PERMISSION === '1') {
      const resp = await request('session/request_permission', {
        sessionId: sid,
        toolCall: { toolCallId: 't1', title: 'edit', status: 'pending' },
        options: [
          { optionId: 'once', kind: 'allow_once', name: 'Allow once' },
          { optionId: 'reject', kind: 'reject_once', name: 'Reject' },
        ],
      });
      notify('session/update', { sessionId: sid, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'perm=' + JSON.stringify(resp.outcome) } } });
    } else {
      notify('session/update', { sessionId: sid, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello' } } });
    }
    result(msg.id, { stopReason: 'end_turn', usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 } });
  } else if (msg.method === 'session/cancel') {
    // Simulate OpenCode 1.15.13: method not found.
    send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found: session/cancel' } });
  }
});

// Minimal client→agent request correlation for request_permission.
let nextId = 10000;
const pending = new Map();
function request(method, params) {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    send({ jsonrpc: '2.0', id, method, params });
  });
}
rl.on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id !== undefined && msg.result !== undefined && pending.has(msg.id)) {
    const resolve = pending.get(msg.id);
    pending.delete(msg.id);
    resolve(msg.result);
  }
});
`;

function writeAgentScript(): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'acp-test-')), 'agent.cjs');
  fs.writeFileSync(file, AGENT_SCRIPT, 'utf8');
  return file;
}

function noopHandlers(overrides: Partial<AcpClientHandlers> = {}): AcpClientHandlers {
  return {
    requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
    sessionUpdate: () => {},
    readTextFile: async () => ({ content: '' }),
    writeTextFile: async () => ({}),
    ...overrides,
  };
}

async function run() {
  const agentScript = writeAgentScript();
  const nodeBin = process.execPath;

  // ── handshake + session + prompt round-trip with streaming updates ──
  {
    const updates: string[] = [];
    const client = new AcpClient({
      command: nodeBin,
      args: [agentScript],
      cwd: os.tmpdir(),
      handlers: noopHandlers({
        sessionUpdate: (params) => {
          const u = params.update as { sessionUpdate: string; content?: { text?: string } };
          updates.push(`${u.sessionUpdate}:${u.content?.text ?? ''}`);
        },
      }),
    });

    const init = await client.initialize();
    assert.strictEqual(init.protocolVersion, 1, 'handshake should negotiate protocol v1');

    const session = await client.newSession(os.tmpdir());
    assert.strictEqual(session.sessionId, 'ses_test_1', 'session id from agent');

    const result = await client.prompt(session.sessionId, 'hi');
    assert.strictEqual(result.stopReason, 'end_turn', 'prompt resolves with stop reason');
    assert.strictEqual(result.usage?.totalTokens, 7, 'usage echoed from agent');
    assert.ok(updates.includes('agent_thought_chunk:thinking…'), `streamed thought, got: ${updates}`);
    assert.ok(updates.includes('agent_message_chunk:Hello'), `streamed message, got: ${updates}`);

    client.dispose();
  }

  // ── permission request / response round-trip ──
  {
    let asked = false;
    const updates: string[] = [];
    const client = new AcpClient({
      command: nodeBin,
      args: [agentScript],
      cwd: os.tmpdir(),
      env: { ...process.env, AGENT_REQUEST_PERMISSION: '1' },
      handlers: noopHandlers({
        requestPermission: async (params) => {
          asked = true;
          assert.strictEqual(params.toolCall.title, 'edit', 'permission carries tool title');
          return { outcome: { outcome: 'selected', optionId: 'once' } };
        },
        sessionUpdate: (params) => {
          const u = params.update as { sessionUpdate: string; content?: { text?: string } };
          if (u.content?.text) updates.push(u.content.text);
        },
      }),
    });

    await client.initialize();
    const session = await client.newSession(os.tmpdir());
    await client.prompt(session.sessionId, 'edit a file');
    assert.ok(asked, 'requestPermission handler was invoked');
    assert.ok(
      updates.some((t) => t.includes('selected') && t.includes('once')),
      `agent received the selected outcome, got: ${updates}`,
    );
    client.dispose();
  }

  // ── malformed JSON resilience: client survives a garbage line ──
  {
    const client = new AcpClient({
      command: nodeBin,
      args: [agentScript],
      cwd: os.tmpdir(),
      env: { ...process.env, AGENT_EMIT_GARBAGE: '1' },
      handlers: noopHandlers(),
    });
    const init = await client.initialize();
    assert.strictEqual(init.protocolVersion, 1, 'handshake succeeds despite a leading garbage line');
    client.dispose();
  }

  // ── process-exit handling: onExit fires on unexpected exit ──
  {
    let exitCode: number | null | undefined;
    const exited = new Promise<void>((resolve) => {
      const client = new AcpClient({
        command: nodeBin,
        // Exit immediately after init so the client sees an unexpected exit.
        args: ['-e', 'process.stdin.on("data", () => process.exit(3))'],
        cwd: os.tmpdir(),
        handlers: noopHandlers(),
        onExit: (code) => {
          exitCode = code;
          resolve();
        },
      });
      // Spawn directly (skip initialize handshake, which the stub can't answer).
      // initialize() spawns and sends the handshake request; the stub exits on
      // the first stdin chunk, triggering onExit.
      client.initialize().catch(() => { /* handshake will never resolve */ });
    });
    await Promise.race([
      exited,
      new Promise((_, reject) => setTimeout(() => reject(new Error('onExit not fired')), 5000)),
    ]);
    assert.strictEqual(exitCode, 3, 'onExit reports the agent exit code');
  }

  // ── cancel falls back to killing the process (OpenCode -32601) ──
  {
    const client = new AcpClient({
      command: nodeBin,
      args: [agentScript],
      cwd: os.tmpdir(),
      handlers: noopHandlers(),
    });
    await client.initialize();
    const session = await client.newSession(os.tmpdir());
    assert.ok(client.isRunning(), 'agent running before cancel');
    await client.cancel(session.sessionId);
    // Sprint 100: OpenCode 1.18.4 implements session/cancel, so cancel no longer
    // kills the process. The subprocess is shared by every conversation, and
    // discarding a warm one would force a cold start on the next prompt.
    assert.ok(client.isRunning(), 'cancel must leave the shared process running');
    client.dispose();
  }


  console.log('acpClient.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
