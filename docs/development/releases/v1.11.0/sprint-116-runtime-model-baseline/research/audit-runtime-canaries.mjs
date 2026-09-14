// Synthetic, bounded Phase 0 probes in the isolated audit workspace.
// Emits protocol/capability facts and fixture outcomes only, never account data.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
const evidence = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const { auditRoot } = JSON.parse(await fs.readFile(path.join(evidence, 'audit-environment.json'), 'utf8'));
const bin = path.resolve(process.env.S116_AUDIT_BINARY_DIR ?? path.join(auditRoot, 'binaries/darwin-arm64'));
if (!bin.startsWith(auditRoot + path.sep)) throw new Error('Audit binary override must remain in the isolated audit directory');
const cwd = path.join(auditRoot, 'workspace');
const modules = path.join(auditRoot, 'candidate-extension/node_modules');
const provider = process.argv[2];
const only = process.argv[3];
const suffix = process.argv[4] ?? (only ? 'retry' : '');
if (!/^[a-z0-9-]*$/.test(suffix)) throw new Error('Invalid evidence suffix');
const results = { provider, capturedAt: new Date().toISOString(), auditBinaryDir: bin, checks: [] };
function bounded(promise, label, ms = 90000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: timeout`)), ms); })]).finally(() => clearTimeout(timer));
}
async function check(name, fn) {
  if (only && name !== only && name !== 'initialization') return;
  try { const result = await fn(); results.checks.push({ name, ...result }); }
  catch (error) { results.checks.push({ name, status: 'FAIL', error: error.message.slice(0, 300) }); }
  await fs.writeFile(path.join(evidence, `${provider}-canaries${suffix ? '-' + suffix : ''}.json`), JSON.stringify(results, null, 2) + '\n');
  const last = results.checks.at(-1);
  console.log(JSON.stringify({ provider, name: last.name, status: last.status, error: last.error }));
}

class CodexClient {
  constructor() {
    this.pending = new Map(); this.events = []; this.listeners = new Set(); this.requests = []; this.stderr = []; this.seq = 0; this.buffer = '';
    this.proc = spawn(path.join(bin, 'codex-app-server'), [], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stderr.on('data', chunk => {
      // Retain bounded diagnostics only. Redact credential-shaped values and
      // omit stdout/event payloads, which may contain conversation text.
      const sanitized = String(chunk)
        .replace(/(authorization|api[_-]?key|token|secret)(["'=:\s]+)[^\s",}]+/gi, '$1$2<redacted>')
        .split('\n').filter(Boolean).map(line => line.slice(0, 1000));
      this.stderr.push(...sanitized);
      this.stderr = this.stderr.slice(-80);
    });
    this.proc.stdout.on('data', chunk => {
      this.buffer += String(chunk);
      while (this.buffer.includes('\n')) {
        const index = this.buffer.indexOf('\n'); const line = this.buffer.slice(0, index); this.buffer = this.buffer.slice(index + 1);
        let message; try { message = JSON.parse(line); } catch { continue; }
        if (message.method && message.id !== undefined) {
          this.requests.push({ method: message.method, keys: Object.keys(message.params ?? {}).sort() });
          let result = { decision: 'decline' };
          if (message.method === 'item/tool/requestUserInput') {
            result = { answers: Object.fromEntries((message.params.questions ?? []).map(q => [q.id, { answers: [q.options?.[0]?.label ?? 'A'] }])) };
          }
          this.send({ jsonrpc: '2.0', id: message.id, result });
        } else if (message.id !== undefined) {
          const p = this.pending.get(message.id); if (!p) continue;
          this.pending.delete(message.id);
          message.error ? p.reject(new Error(`RPC ${p.method}: ${message.error.code} ${message.error.message}`)) : p.resolve(message.result);
        } else if (message.method) {
          this.events.push(message); for (const listener of this.listeners) listener(message);
        }
      }
    });
  }
  send(message) { this.proc.stdin.write(JSON.stringify(message) + '\n'); }
  rpc(method, params) {
    const id = ++this.seq;
    return bounded(new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject, method }); this.send({ jsonrpc: '2.0', id, method, params }); }), method, 30000);
  }
  async init() {
    await this.rpc('initialize', { clientInfo: { name: 'ritemark-s116-audit', version: '1' }, capabilities: { experimentalApi: true } });
    this.send({ jsonrpc: '2.0', method: 'initialized', params: {} });
    const models = await this.rpc('model/list', { limit: 100 });
    this.model = models.data.find(m => m.isDefault)?.id ?? models.data[0].id;
  }
  completed(threadId, turnId) {
    const match = event => event.method === 'turn/completed' && event.params?.threadId === threadId && event.params?.turn?.id === turnId;
    const found = this.events.find(match); if (found) return Promise.resolve(found.params.turn);
    return bounded(new Promise(resolve => { const listener = event => { if (match(event)) { this.listeners.delete(listener); resolve(event.params.turn); } }; this.listeners.add(listener); }), 'turn/completed');
  }
  streaming(threadId, turnId) {
    const match = event => /item\/.*\/delta$/.test(event.method) && event.params?.threadId === threadId && event.params?.turnId === turnId;
    const found = this.events.find(match); if (found) return Promise.resolve(found.method);
    return bounded(new Promise(resolve => { const listener = event => { if (match(event)) { this.listeners.delete(listener); resolve(event.method); } }; this.listeners.add(listener); }), 'first streaming delta', 60000);
  }
  async start(policy = 'never', sandbox = 'workspace-write') {
    const result = await this.rpc('thread/start', { cwd, model: this.model, approvalPolicy: policy, sandbox, baseInstructions: 'This is an isolated synthetic runtime audit. Only touch the named fixture in this directory. Never use shell, network, browser, plugins, or subagents.', experimentalRawEvents: false, persistExtendedHistory: false });
    return result.thread.id;
  }
  async turn(threadId, text, extra = {}) {
    const result = await this.rpc('turn/start', { threadId, input: [{ type: 'text', text, text_elements: [] }], model: this.model, effort: 'low', ...extra });
    return this.completed(threadId, result.turn.id);
  }
  close() { this.proc.kill('SIGTERM'); }
  diagnostics() {
    return {
      stderrTail: this.stderr,
      eventMethods: [...new Set(this.events.map(event => event.method))],
      serverRequestMethods: [...new Set(this.requests.map(request => request.method))],
    };
  }
}

async function codex() {
  const client = new CodexClient();
  try {
    await client.init(); results.model = client.model;
    await check('file tools through code-mode host', async () => {
      const file = path.join(cwd, 'codex-fixture.txt'); await fs.writeFile(file, 'S116_BEFORE\n');
      const id = await client.start();
      const turn = await client.turn(id, 'Read codex-fixture.txt and replace S116_BEFORE with S116_AFTER using file tools. Do not use shell. Reply DONE.');
      const changed = (await fs.readFile(file, 'utf8')).trim() === 'S116_AFTER';
      return { status: changed && turn.status === 'completed' ? 'PASS' : 'FAIL', terminalStatus: turn.status, fixtureChanged: changed, itemTypes: [...new Set(client.events.filter(e => e.params?.threadId === id).map(e => e.params?.item?.type).filter(Boolean))] };
    });
    await check('explicit cancellation', async () => {
      const id = await client.start('never', 'read-only');
      const result = await client.rpc('turn/start', { threadId: id, model: client.model, effort: 'low', input: [{ type: 'text', text: 'List integers from 1 to 2000. Do not use tools.', text_elements: [] }] });
      // A turn/start response is an acceptance receipt, not proof execution is
      // active. Wait for actual streamed work before evaluating cancellation.
      const activeEvent = await client.streaming(id, result.turn.id);
      await client.rpc('turn/interrupt', { threadId: id, turnId: result.turn.id });
      const turn = await client.completed(id, result.turn.id);
      return { status: turn.status === 'interrupted' ? 'PASS' : 'FAIL', terminalStatus: turn.status, activeEvent };
    });
    await check('read-only plan question contract', async () => {
      const id = await client.start('untrusted', 'read-only'); const offset = client.requests.length;
      const turn = await client.turn(id, 'Use request_user_input to ask whether the synthetic output should be A or B, then acknowledge the selected choice. Do not edit files.', { collaborationMode: { mode: 'plan', settings: { model: client.model, reasoning_effort: 'low', developer_instructions: null } } });
      const requests = client.requests.slice(offset);
      return { status: turn.status === 'completed' && requests.some(r => r.method === 'item/tool/requestUserInput') ? 'PASS' : 'NOT_OBSERVED', terminalStatus: turn.status, requests };
    });
  } finally {
    results.diagnostics = client.diagnostics();
    await fs.writeFile(path.join(evidence, `${provider}-canaries${suffix ? '-' + suffix : ''}.json`), JSON.stringify(results, null, 2) + '\n');
    client.close();
  }
}

async function claude() {
  const { query } = await import(pathToFileURL(path.join(modules, '@anthropic-ai/claude-agent-sdk/sdk.mjs')));
  await check('explicit cancellation', async () => {
    const stream = query({ prompt: 'List the integers from 1 to 2000. Do not use tools.', options: {
      cwd, pathToClaudeCodeExecutable: path.join(bin, 'claude'), settingSources: [], tools: [], effort: 'low', maxTurns: 1, includePartialMessages: true,
    } });
    let interrupt;
    let terminal;
    let streamed = false;
    try {
      await bounded((async () => {
        for await (const event of stream) {
          if (event.type === 'stream_event' && event.event?.type === 'content_block_delta' && !streamed) {
            streamed = true;
            interrupt = stream.interrupt();
          }
          if (event.type === 'result') terminal = { subtype: event.subtype, isError: event.is_error, stopReason: event.stop_reason };
        }
      })(), 'Claude cancellation');
      const acknowledgement = interrupt ? await bounded(interrupt, 'interrupt acknowledgement', 10000) : undefined;
      return { status: streamed && terminal && interrupt ? 'PASS_PROTOCOL' : 'NOT_OBSERVED', streamed, interruptAcknowledged: !!interrupt, acknowledgementKeys: Object.keys(acknowledgement ?? {}), terminal, limitation: 'Direct SDK cancellation; full Ritemark UI terminal-state verification remains open.' };
    } finally { stream.close(); }
  });
  for (const permit of [true, false]) await check(permit ? 'approved fixture edit' : 'denied fixture edit', async () => {
    const file = path.join(cwd, permit ? 'claude-allow.txt' : 'claude-deny.txt'); await fs.writeFile(file, 'S116_BEFORE\n');
    const approvals = []; let terminal; let selectedModel;
    const stream = query({ prompt: `Read ${path.basename(file)} and replace S116_BEFORE with S116_AFTER. Use only Read/Edit; if editing is denied, stop immediately and report that it was denied.`, options: {
      cwd, pathToClaudeCodeExecutable: path.join(bin, 'claude'), settingSources: [], tools: ['Read', 'Edit'], allowedTools: ['Read'], permissionMode: 'default', effort: 'low', maxTurns: 4,
      canUseTool: async (name, input) => {
        const allowed = name === 'Edit' && permit && path.resolve(input.file_path ?? '') === file;
        approvals.push({ name, allowed });
        return allowed ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'Audit fixture denies this edit; stop.' };
      },
    } });
    try {
      await bounded((async () => { for await (const event of stream) { if (event.type === 'system' && event.subtype === 'init') selectedModel = event.model; if (event.type === 'result') terminal = { subtype: event.subtype, isError: event.is_error }; } })(), 'Claude tool turn');
    } finally { stream.close(); }
    const changed = (await fs.readFile(file, 'utf8')).trim() === 'S116_AFTER';
    return { status: changed === permit && approvals.length > 0 && !terminal?.isError ? 'PASS' : 'FAIL', selectedModel, requestedEffort: 'low', approvals, fixtureChanged: changed, terminal };
  });
}

async function acp() {
  const sdk = await import(pathToFileURL(path.join(modules, '@agentclientprotocol/sdk/dist/acp.js')));
  const proc = spawn(path.join(bin, 'opencode'), ['acp'], { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, OPENCODE_PERMISSION: '{"edit":"ask","bash":"ask","webfetch":"ask"}' } });
  const stderr = [];
  const updates = [];
  proc.stderr.on('data', chunk => {
    const sanitized = String(chunk)
      .replace(/(authorization|api[_-]?key|token|secret)(["'=:\s]+)[^\s",}]+/gi, '$1$2<redacted>')
      .split('\n').filter(Boolean).map(line => line.slice(0, 1000));
    stderr.push(...sanitized);
    stderr.splice(0, Math.max(0, stderr.length - 80));
  });
  const conn = new sdk.ClientSideConnection(() => ({ sessionUpdate(update) { updates.push(update); }, requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }), readTextFile: async () => ({ content: '' }), writeTextFile: async () => { throw new Error('Audit denies writes'); } }), sdk.ndJsonStream(Writable.toWeb(proc.stdin), Readable.toWeb(proc.stdout)));
  let initialized;
  let session;
  let selectedModel;
  async function ensureSession() {
    if (session) return;
    initialized = await bounded(conn.initialize({ protocolVersion: sdk.PROTOCOL_VERSION, clientInfo: { name: 'ritemark-s116-audit', version: '1' }, clientCapabilities: { fs: { readTextFile: true, writeTextFile: false } } }), 'ACP initialize', 30000);
    session = await bounded(conn.newSession({ cwd, mcpServers: [] }), 'ACP session/new', 30000);
    const modelOption = (session.configOptions ?? []).find(option => (option.id ?? option.configId) === 'model');
    selectedModel = modelOption?.currentValue;
    if (selectedModel) {
      await conn.setSessionConfigOption({ sessionId: session.sessionId, configId: 'model', value: selectedModel });
    }
  }
  try {
    await check('ACP initialize and session capabilities', async () => {
      await ensureSession();
      return { status: 'PASS', protocolVersion: initialized.protocolVersion, agentInfo: initialized.agentInfo, capabilities: initialized.agentCapabilities, modelState: session.models, configOptions: session.configOptions, selectedModel, authenticatedTurn: 'Free provider route only; no BYOK credentials in audit environment' };
    });
    await check('ACP free-route streaming cancellation', async () => {
      await ensureSession();
      const turn = conn.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: 'text', text: 'Count from 1 to 500, one integer per line. Do not use tools.' }],
      });
      const deadline = Date.now() + 60000;
      while (!updates.some(event => event.update?.sessionUpdate === 'agent_message_chunk') && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      const chunksAtCancel = updates.filter(event => event.update?.sessionUpdate === 'agent_message_chunk').length;
      if (chunksAtCancel === 0) {
        return { status: 'NOT_OBSERVED', selectedModel, reason: 'No stream started within 60 seconds' };
      }
      await conn.cancel({ sessionId: session.sessionId });
      const terminal = await bounded(turn, 'ACP cancelled prompt terminal', 30000);
      await new Promise(resolve => setTimeout(resolve, 500));
      const chunksAfter = updates.filter(event => event.update?.sessionUpdate === 'agent_message_chunk').length;
      return {
        status: terminal.stopReason === 'cancelled' && proc.exitCode === null ? 'PASS' : 'FAIL',
        selectedModel,
        stopReason: terminal.stopReason,
        chunksAtCancel,
        chunksAfter,
        processAlive: proc.exitCode === null,
      };
    });
  } finally {
    results.diagnostics = { stderrTail: stderr };
    await fs.writeFile(path.join(evidence, `${provider}-canaries${suffix ? '-' + suffix : ''}.json`), JSON.stringify(results, null, 2) + '\n');
    proc.kill('SIGTERM');
  }
}

try { if (provider === 'codex') await codex(); else if (provider === 'claude') await claude(); else if (provider === 'acp') await acp(); else throw new Error('Expected codex, claude, or acp'); }
catch (error) { await check('initialization', async () => { throw error; }); }
if (results.checks.some(check => check.status === 'FAIL')) process.exitCode = 1;
