#!/usr/bin/env node
// #544 reproducer: time the bundled Codex app-server's first turn, with the
// person's own ~/.codex MCP servers (as Ritemark starts it today) or with
// extra `-c` overrides. Never writes ~/.codex/config.toml: the cwd must be a
// folder Codex already trusts. Prints a JSON timeline.
//
// node codex-first-turn.mjs <app-server binary> <cwd> [label] [-c key=value ...]
import { spawn } from 'node:child_process';

const [bin, cwd, label = 'run', ...extra] = process.argv.slice(2);
const t0 = Date.now();
const ms = () => Date.now() - t0;
const timeline = [];
const note = (what, detail) => timeline.push({ at: ms(), what, ...(detail === undefined ? {} : { detail }) });

const child = spawn(bin, extra, { stdio: ['pipe', 'pipe', 'pipe'] });
let buffer = '';
let nextId = 1;
const pending = new Map();
const stderrLines = [];
child.stderr.on('data', (d) => { for (const l of String(d).split('\n')) if (l.trim()) stderrLines.push({ at: ms(), line: l.slice(0, 300) }); });
child.stdout.on('data', (data) => {
  buffer += data;
  let i;
  while ((i = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, i); buffer = buffer.slice(i + 1);
    if (!line.trim()) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id !== undefined && pending.has(msg.id) && (msg.result !== undefined || msg.error !== undefined)) {
      const { resolve, method } = pending.get(msg.id); pending.delete(msg.id);
      note(`response ${method}`, msg.error ? { error: msg.error } : undefined);
      resolve(msg);
      continue;
    }
    if (msg.method && msg.id !== undefined) {
      // A server request (approval etc.): decline, record it.
      note(`server-request ${msg.method}`);
      child.stdin.write(JSON.stringify({ id: msg.id, result: { decision: 'decline' } }) + '\n');
      continue;
    }
    if (msg.method) {
      const p = msg.params ?? {};
      const brief = /mcp|error|warning|retry/i.test(msg.method) ? p
        : msg.method === 'item/started' || msg.method === 'item/completed' ? { type: p.item?.type, name: p.item?.server ? `${p.item.server}/${p.item.tool}` : undefined }
        : msg.method === 'turn/completed' ? { status: p.turn?.status, error: p.turn?.error?.message?.slice(0, 200) }
        : undefined;
      if (msg.method === 'item/agentMessage/delta') { if (!timeline.some((e) => e.what === 'first agentMessage delta')) note('first agentMessage delta'); }
      else note(msg.method, brief);
      if (msg.method === 'turn/completed') done();
    }
  }
});
const rpc = (method, params) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, { resolve, method });
  note(`request ${method}`);
  child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
});
let finished = false;
function done() {
  if (finished) return; finished = true;
  child.kill('SIGTERM');
  console.log(JSON.stringify({ label, extra, totalMs: ms(), timeline, stderrTail: stderrLines.slice(-15) }, null, 1));
  setTimeout(() => process.exit(0), 300);
}
setTimeout(() => { note('TIMEOUT 600s'); done(); }, 600_000);

const init = await rpc('initialize', { clientInfo: { name: 'ritemark-native', title: 'Ritemark Native', version: '1.4.0' }, capabilities: { experimentalApi: true } });
child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
const thread = await rpc('thread/start', {
  cwd, approvalPolicy: 'never', sandbox: 'read-only',
  experimentalRawEvents: false, persistExtendedHistory: false,
});
if (thread.error) { note('thread/start failed'); done(); }
const threadId = thread.result?.thread?.id;
await rpc('turn/start', { threadId, input: [{ type: 'text', text: 'Reply with the single word: ok. Do not use any tools.', text_elements: [] }], model: null, collaborationMode: null });
