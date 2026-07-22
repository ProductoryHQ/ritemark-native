// verify-opencode.mjs — behavioural probes against the bundled OpenCode binary.
//
// Driven by scripts/verify-agent-runtimes.sh. Speaks ACP through the same SDK
// the extension uses, so a pass means the shipped path works rather than a mock
// of it.
//
// Prints machine-readable lines the caller greps:
//   RESULT gate-pauses PASS|FAIL
//   RESULT gate-denies PASS|FAIL
//   RESULT gate-allows PASS|FAIL
//   RESULT cancel      PASS|FAIL|SKIP
//
// Everything else on stdout is human context for the matrix.
import { spawn } from 'node:child_process';
import { Writable, Readable } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [, , BIN, EXT] = process.argv;
if (!BIN || !EXT) {
  console.error('usage: verify-opencode.mjs <opencode-binary> <extension-dir>');
  process.exit(2);
}

// Ritemark injects exactly this. If OpenCode ever ignores it, the gate is gone —
// note that with the variable ABSENT, OpenCode's own default is "*": "allow".
const OPENCODE_PERMISSION = '{"edit":"ask","bash":"ask","webfetch":"ask"}';
const acp = await import(`${EXT}/node_modules/@agentclientprotocol/sdk/dist/acp.js`);

function tmpws(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(dir, 'README.md'), '# verification workspace\n');
  return dir;
}

async function connect(ws) {
  const proc = spawn(BIN, ['acp'], {
    cwd: ws,
    env: { ...process.env, OPENCODE_PERMISSION },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const state = { prompts: [], chunks: 0, wroteViaProxy: false, decision: 'deny' };
  const conn = new acp.ClientSideConnection(() => ({
    requestPermission: async (p) => {
      state.prompts.push(p.toolCall?.title ?? p.toolCall?.kind ?? 'unknown');
      const opts = p.options ?? [];
      const pick = state.decision === 'allow'
        ? (opts.find((o) => o.kind === 'allow_once') ?? opts[0])
        : (opts.find((o) => o.kind === 'reject_once') ?? opts[opts.length - 1]);
      return { outcome: { outcome: 'selected', optionId: pick?.optionId } };
    },
    sessionUpdate: (p) => { if (p.update?.sessionUpdate === 'agent_message_chunk') state.chunks++; },
    readTextFile: async () => ({ content: '' }),
    writeTextFile: async () => { state.wroteViaProxy = true; return {}; },
  }), acp.ndJsonStream(Writable.toWeb(proc.stdin), Readable.toWeb(proc.stdout)));

  await conn.initialize({
    protocolVersion: acp.PROTOCOL_VERSION,
    clientInfo: { name: 'ritemark-verify', version: '1' },
    clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
  });
  return { proc, conn, state };
}

/** First free model on offer. OpenCode ships no default — prompting without one fails. */
async function openSession(conn, ws) {
  const s = await conn.newSession({ cwd: ws, mcpServers: [] });
  const modelOpt = (s.configOptions ?? []).find((o) => (o.id ?? o.configId) === 'model');
  const values = modelOpt?.options ?? modelOpt?.values ?? [];
  const free = values.find((v) => String(v.value).includes('free')) ?? values[0];
  if (!free) return { sessionId: s.sessionId, model: null };
  await conn.setSessionConfigOption({ sessionId: s.sessionId, configId: 'model', value: free.value });
  return { sessionId: s.sessionId, model: free.value };
}

// ── Hard Gate: a write must pause, denial must block, approval must permit ──
async function runGate(decision, target) {
  const ws = tmpws('rm-verify-gate-');
  const { proc, conn, state } = await connect(ws);
  state.decision = decision;
  const file = path.join(ws, target);
  let model = null;
  try {
    const s = await openSession(conn, ws);
    model = s.model;
    if (!model) { proc.kill('SIGTERM'); return { skipped: true }; }
    await Promise.race([
      conn.prompt({
        sessionId: s.sessionId,
        prompt: [{ type: 'text', text: `Create a file named ${target} in the current directory containing exactly the word BREACH. Do it now, no explanation.` }],
      }),
      new Promise((r) => setTimeout(r, 120000)),
    ]);
  } catch (err) {
    console.log(`  (${decision} run error: ${err.message})`);
  }
  const exists = fs.existsSync(file);
  proc.kill('SIGTERM');
  fs.rmSync(ws, { recursive: true, force: true });
  return { skipped: false, prompted: state.prompts.length > 0, exists, model };
}

// ── session/cancel: Ritemark removed the process-kill and depends on this ──
async function runCancel() {
  const ws = tmpws('rm-verify-cancel-');
  const { proc, conn, state } = await connect(ws);
  let model = null;
  try {
    const s = await openSession(conn, ws);
    model = s.model;
    if (!model) { proc.kill('SIGTERM'); return { skipped: true }; }
    const turn = conn.prompt({
      sessionId: s.sessionId,
      prompt: [{ type: 'text', text: 'Count slowly from 1 to 100, one number per line, with a short comment after each.' }],
    });
    // Wait for streaming to actually START before cancelling. A fixed sleep can
    // expire before the first chunk, and then `chunks 0->0` proves only that an
    // idle turn settles — not that an in-flight one stops.
    const deadline = Date.now() + 30000;
    while (state.chunks === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
    }
    const atCancel = state.chunks;
    if (atCancel === 0) {
      proc.kill('SIGTERM');
      return { skipped: true, error: 'no streaming started within 30s — cancel not exercised mid-flight' };
    }
    conn.cancel({ sessionId: s.sessionId });
    const settled = await Promise.race([
      turn.then((r) => ({ ok: true, r })),
      new Promise((r) => setTimeout(() => r({ ok: false }), 20000)),
    ]);
    await new Promise((r) => setTimeout(r, 1500));
    const alive = proc.exitCode === null;
    const out = { skipped: false, settled: settled.ok, stopReason: settled.r?.stopReason, atCancel, after: state.chunks, alive };
    proc.kill('SIGTERM');
    fs.rmSync(ws, { recursive: true, force: true });
    return out;
  } catch (err) {
    proc.kill('SIGTERM');
    return { skipped: true, error: err.message };
  }
}

const deny = await runGate('deny', 'denied.txt');
const allow = await runGate('allow', 'allowed.txt');

if (deny.skipped || allow.skipped) {
  console.log('no model available — permission gate NOT exercised');
  console.log('RESULT gate-pauses FAIL');
  console.log('RESULT gate-denies FAIL');
} else {
  console.log(`deny run : prompted=${deny.prompted} fileWritten=${deny.exists} model=${deny.model}`);
  console.log(`allow run: prompted=${allow.prompted} fileWritten=${allow.exists}`);
  console.log(`RESULT gate-pauses ${deny.prompted && allow.prompted ? 'PASS' : 'FAIL'}`);
  console.log(`RESULT gate-denies ${!deny.exists ? 'PASS' : 'FAIL'}`);
  console.log(`RESULT gate-allows ${allow.exists ? 'PASS' : 'FAIL'}`);
}

const cancel = await runCancel();
if (cancel.skipped) {
  console.log(`cancel: not exercised${cancel.error ? ` (${cancel.error})` : ''}`);
  console.log('RESULT cancel SKIP');
} else {
  console.log(`cancel: stopReason=${cancel.stopReason} chunks ${cancel.atCancel}->${cancel.after} processAlive=${cancel.alive}`);
  const ok = cancel.settled && cancel.stopReason === 'cancelled' && cancel.alive;
  console.log(`RESULT cancel ${ok ? 'PASS' : 'FAIL'}`);
}
process.exit(0);
