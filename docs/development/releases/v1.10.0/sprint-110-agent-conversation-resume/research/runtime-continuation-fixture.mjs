#!/usr/bin/env node

/**
 * Sprint 110 Phase 0 live continuation fixture.
 *
 * This is deliberately isolated from Ritemark production adapters. It measures
 * the pinned provider protocol before the sprint freezes a native/fallback
 * decision. The fixture never asks an agent to use tools or mutate the
 * workspace. Provider identifiers and response bodies are not printed; only
 * capability metadata and token-recall outcomes become audit evidence.
 *
 * Usage:
 *   node runtime-continuation-fixture.mjs --provider claude \
 *     --extension-dir /path/to/extensions/ritemark --workspace /path/to/project
 *   node runtime-continuation-fixture.mjs --provider codex ...
 *   node runtime-continuation-fixture.mjs --provider acp ...
 *   node runtime-continuation-fixture.mjs --provider codex --matrix isolation ...
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';

const args = parseArgs(process.argv.slice(2));
const provider = args.provider;
const extensionDir = path.resolve(args['extension-dir'] ?? 'extensions/ritemark');
const workspace = path.resolve(args.workspace ?? process.cwd());
const platformDir = `${process.platform === 'darwin' ? 'darwin' : process.platform}-${process.arch === 'x64' ? 'x64' : process.arch}`;
const binaryDir = path.resolve(args['binary-dir'] ?? path.join(extensionDir, 'binaries', 'agents', platformDir));
const timeoutMs = Number(args.timeout ?? 180_000);
const matrix = args.matrix ?? 'resume';

if (!['claude', 'codex', 'acp'].includes(provider)) {
  fail('Usage: --provider claude|codex|acp is required');
}
if (!['resume', 'isolation'].includes(matrix)) {
  fail('Usage: --matrix resume|isolation');
}
if (!fs.existsSync(workspace)) fail(`Workspace does not exist: ${workspace}`);

const token = `RM110-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
const seedPrompt = `Remember this exact audit token for our next turn: ${token}. Reply only ACK. Do not use tools.`;
const recallPrompt = 'What exact audit token did I give you in the previous turn? Reply with only that token. Do not use tools.';
const startedAt = new Date().toISOString();

async function runClaude() {
  const sdkPath = path.join(extensionDir, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.mjs');
  const binary = path.join(binaryDir, 'claude');
  requireFiles([sdkPath, binary]);
  const { query } = await import(pathToFileURL(sdkPath).href);

  const first = await collectClaude(query, binary, seedPrompt);
  if (!first.sessionId) {
    return { status: 'FAIL', nativeApi: 'resume', reason: 'No session_id in Claude stream', first };
  }
  const resumed = await collectClaude(query, binary, recallPrompt, first.sessionId);
  const invalid = await collectClaude(query, binary, recallPrompt, crypto.randomUUID()).catch((error) => ({
    rejected: true,
    errorClass: classifyError(error),
  }));
  const recalled = resumed.text.includes(token);
  return {
    status: recalled ? 'PASS' : 'FAIL',
    nativeApi: 'query.options.resume',
    processBoundary: 'new SDK query / new Claude subprocess',
    sessionIdCaptured: true,
    recallMatched: recalled,
    first: scrubClaude(first),
    resumed: scrubClaude(resumed),
    invalidDescriptor: invalid.rejected ? invalid : scrubClaude(invalid),
  };
}

async function runClaudeIsolation() {
  const sdkPath = path.join(extensionDir, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.mjs');
  const binary = path.join(binaryDir, 'claude');
  requireFiles([sdkPath, binary]);
  const { query } = await import(pathToFileURL(sdkPath).href);
  const tokenA = `RM110-A-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const tokenB = `RM110-B-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const [firstA, firstB] = await Promise.all([
    collectClaude(query, binary, `Remember only this audit token: ${tokenA}. Reply ACK. Do not use tools.`),
    collectClaude(query, binary, `Remember only this audit token: ${tokenB}. Reply ACK. Do not use tools.`),
  ]);
  const [resumedA, resumedB] = await Promise.all([
    collectClaude(query, binary, 'Reply with only the audit token from our previous turn.', firstA.sessionId),
    collectClaude(query, binary, 'Reply with only the audit token from our previous turn.', firstB.sessionId),
  ]);
  const isolated = resumedA.text.includes(tokenA) && !resumedA.text.includes(tokenB)
    && resumedB.text.includes(tokenB) && !resumedB.text.includes(tokenA);
  return {
    status: isolated ? 'PASS' : 'FAIL',
    matrix: 'two-session-isolation',
    processBoundary: 'two new Claude subprocesses per stage',
    descriptorsDistinct: firstA.sessionId !== firstB.sessionId,
    conversationARecalledOwnTokenOnly: resumedA.text.includes(tokenA) && !resumedA.text.includes(tokenB),
    conversationBRecalledOwnTokenOnly: resumedB.text.includes(tokenB) && !resumedB.text.includes(tokenA),
  };
}

async function collectClaude(query, binary, prompt, resume) {
  let sessionId = null;
  let text = '';
  let resultSubtype = null;
  const stream = query({
    prompt,
    options: {
      cwd: workspace,
      pathToClaudeCodeExecutable: binary,
      allowedTools: [],
      maxTurns: 1,
      permissionMode: 'default',
      canUseTool: async () => ({ behavior: 'deny', message: 'Audit fixture does not permit tools.' }),
      ...(resume ? { resume } : {}),
    },
  });
  for await (const message of withTimeout(stream, timeoutMs, 'Claude stream timed out')) {
    if (message.session_id) sessionId = message.session_id;
    if (message.type === 'assistant') text += assistantText(message);
    if (message.type === 'result') {
      resultSubtype = message.subtype ?? null;
      if (typeof message.result === 'string') text += message.result;
    }
  }
  return { sessionId, text, resultSubtype };
}

function assistantText(message) {
  const content = message.message?.content;
  if (!Array.isArray(content)) return '';
  return content.filter((block) => block?.type === 'text').map((block) => block.text ?? '').join('');
}

function scrubClaude(value) {
  return {
    sessionIdPresent: Boolean(value.sessionId),
    resultSubtype: value.resultSubtype ?? null,
    emittedText: Boolean(value.text),
    tokenPresent: value.text?.includes(token) ?? false,
  };
}

async function runCodex() {
  const binary = path.join(binaryDir, 'codex-app-server');
  requireFiles([binary]);

  const firstClient = await CodexFixture.start(binary, workspace, timeoutMs);
  let threadId;
  let firstTurn;
  try {
    const account = await firstClient.rpc('account/read', { refreshToken: false });
    const started = await firstClient.rpc('thread/start', {
      cwd: workspace,
      approvalPolicy: 'never',
      sandbox: 'read-only',
      baseInstructions: 'Do not use tools. Answer the user directly and concisely.',
      experimentalRawEvents: false,
      persistExtendedHistory: false,
    });
    threadId = started.thread?.id;
    if (!threadId) throw new Error('thread/start returned no thread id');
    firstTurn = await firstClient.turn(threadId, seedPrompt);
    firstTurn.account = { authenticated: Boolean(account?.account), requiresOpenaiAuth: account?.requiresOpenaiAuth ?? null };
  } finally {
    await firstClient.close();
  }

  const secondClient = await CodexFixture.start(binary, workspace, timeoutMs);
  try {
    const read = await secondClient.rpc('thread/read', { threadId, includeTurns: true });
    const resumed = await secondClient.rpc('thread/resume', {
      threadId,
      cwd: workspace,
      approvalPolicy: 'never',
      sandbox: 'read-only',
    });
    const resumedId = resumed.thread?.id ?? resumed.id ?? null;
    const secondTurn = await secondClient.turn(threadId, recallPrompt);
    const invalid = await secondClient.rpc('thread/resume', {
      threadId: crypto.randomUUID(),
      cwd: workspace,
      approvalPolicy: 'never',
      sandbox: 'read-only',
    }).then(() => ({ rejected: false })).catch((error) => ({ rejected: true, errorClass: classifyError(error) }));
    const recalled = secondTurn.text.includes(token);
    return {
      status: recalled ? 'PASS' : 'FAIL',
      nativeApi: 'thread/read + thread/resume',
      processBoundary: 'app-server process restart',
      threadIdCaptured: true,
      threadReadFound: Boolean(read?.thread?.id ?? read?.id),
      resumeReturnedSameId: resumedId === threadId,
      recallMatched: recalled,
      firstTurn: scrubTurn(firstTurn),
      resumedTurn: scrubTurn(secondTurn),
      invalidDescriptor: invalid,
    };
  } finally {
    await secondClient.close();
  }
}

async function runCodexIsolation() {
  const binary = path.join(binaryDir, 'codex-app-server');
  requireFiles([binary]);
  const tokenA = `RM110-A-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const tokenB = `RM110-B-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const first = await CodexFixture.start(binary, workspace, timeoutMs);
  let threadA;
  let threadB;
  try {
    [threadA, threadB] = await Promise.all([startCodexThread(first), startCodexThread(first)]);
    await Promise.all([
      first.turn(threadA, `Remember only this audit token: ${tokenA}. Reply ACK. Do not use tools.`),
      first.turn(threadB, `Remember only this audit token: ${tokenB}. Reply ACK. Do not use tools.`),
    ]);
  } finally {
    await first.close();
  }
  const second = await CodexFixture.start(binary, workspace, timeoutMs);
  try {
    await Promise.all([
      second.rpc('thread/resume', { threadId: threadA, cwd: workspace, approvalPolicy: 'never', sandbox: 'read-only' }),
      second.rpc('thread/resume', { threadId: threadB, cwd: workspace, approvalPolicy: 'never', sandbox: 'read-only' }),
    ]);
    const [recalledA, recalledB] = await Promise.all([
      second.turn(threadA, 'Reply with only the audit token from our previous turn.'),
      second.turn(threadB, 'Reply with only the audit token from our previous turn.'),
    ]);
    const isolated = recalledA.text.includes(tokenA) && !recalledA.text.includes(tokenB)
      && recalledB.text.includes(tokenB) && !recalledB.text.includes(tokenA);
    return {
      status: isolated ? 'PASS' : 'FAIL',
      matrix: 'two-thread-isolation',
      processBoundary: 'app-server process restart',
      descriptorsDistinct: threadA !== threadB,
      conversationARecalledOwnTokenOnly: recalledA.text.includes(tokenA) && !recalledA.text.includes(tokenB),
      conversationBRecalledOwnTokenOnly: recalledB.text.includes(tokenB) && !recalledB.text.includes(tokenA),
    };
  } finally {
    await second.close();
  }
}

async function startCodexThread(client) {
  const started = await client.rpc('thread/start', {
    cwd: workspace,
    approvalPolicy: 'never',
    sandbox: 'read-only',
    baseInstructions: 'Do not use tools. Answer the user directly and concisely.',
    experimentalRawEvents: false,
    persistExtendedHistory: false,
  });
  if (!started.thread?.id) throw new Error('thread/start returned no thread id');
  return started.thread.id;
}

class CodexFixture {
  static async start(binary, cwd, timeout) {
    const client = new CodexFixture(binary, cwd, timeout);
    await client.initialize();
    return client;
  }

  constructor(binary, cwd, timeout) {
    this.timeout = timeout;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.notifications = [];
    this.stderr = [];
    this.buffer = '';
    this.proc = spawn(binary, [], { cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stdout.on('data', (chunk) => this.onData(chunk));
    this.proc.stderr.on('data', (chunk) => this.stderr.push(String(chunk).trim()));
    this.proc.on('exit', (code, signal) => {
      const stderr = this.stderr.at(-1);
      for (const { reject } of this.pending.values()) reject(new Error(`Codex exited (${code ?? signal})${stderr ? `: ${stderr}` : ''}`));
      this.pending.clear();
    });
  }

  async initialize() {
    await this.rpc('initialize', {
      clientInfo: { name: 'ritemark-s110-audit', title: 'Ritemark Sprint 110 audit', version: '1' },
      capabilities: { experimentalApi: true },
    });
    this.notify('initialized', {});
  }

  rpc(method, params) {
    const id = this.nextId++;
    this.send({ jsonrpc: '2.0', id, method, params });
    return deadline(new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })), this.timeout, `${method} timed out`);
  }

  notify(method, params) {
    this.send({ jsonrpc: '2.0', method, params });
  }

  async turn(threadId, text) {
    const notificationStart = this.notifications.length;
    const started = await this.rpc('turn/start', {
      threadId,
      input: [{ type: 'text', text, text_elements: [] }],
      model: null,
      collaborationMode: null,
    });
    const turnId = started.turn?.id;
    if (!turnId) throw new Error('turn/start returned no turn id');
    const completed = await deadline(this.waitFor('turn/completed', (p) => p.threadId === threadId && p.turn?.id === turnId), this.timeout, 'turn/completed timed out');
    const textParts = this.notifications.slice(notificationStart)
      .filter((entry) => entry.method === 'item/agentMessage/delta' && entry.params?.threadId === threadId)
      .map((entry) => entry.params?.delta ?? '');
    return { turnId, status: completed.turn?.status ?? null, text: textParts.join('') };
  }

  waitFor(method, predicate) {
    const existing = this.notifications.find((entry) => entry.method === method && predicate(entry.params));
    if (existing) return Promise.resolve(existing.params);
    return new Promise((resolve) => {
      const listener = (entry) => {
        if (entry.method === method && predicate(entry.params)) {
          this.listeners.delete(listener);
          resolve(entry.params);
        }
      };
      this.listeners.add(listener);
    });
  }

  onData(chunk) {
    this.buffer += String(chunk);
    let newline;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.id !== undefined && (message.result !== undefined || message.error)) {
        const pending = this.pending.get(message.id);
        if (!pending) continue;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
        else pending.resolve(message.result);
      } else if (message.id !== undefined && message.method) {
        this.send({ jsonrpc: '2.0', id: message.id, result: { decision: 'decline' } });
      } else if (message.method) {
        const entry = { method: message.method, params: message.params };
        this.notifications.push(entry);
        for (const listener of this.listeners) listener(entry);
      }
    }
  }

  send(message) {
    this.proc.stdin.write(`${JSON.stringify(message)}\n`);
  }

  async close() {
    if (this.proc.exitCode !== null) return;
    this.proc.kill('SIGTERM');
    await deadline(new Promise((resolve) => this.proc.once('exit', resolve)), 5_000, 'Codex process did not exit').catch(() => this.proc.kill('SIGKILL'));
  }
}

async function runAcp() {
  const sdkPath = path.join(extensionDir, 'node_modules', '@agentclientprotocol', 'sdk', 'dist', 'acp.js');
  const binary = path.join(binaryDir, 'opencode');
  requireFiles([sdkPath, binary]);
  const acp = await import(pathToFileURL(sdkPath).href);

  const first = await openAcp(acp, binary);
  let sessionId;
  let model;
  let firstTurn;
  try {
    const created = await first.conn.newSession({ cwd: workspace, mcpServers: [] });
    sessionId = created.sessionId;
    const candidates = acpModelCandidates(created).slice(0, 6);
    if (candidates.length === 0) {
      return {
        status: 'SKIP',
        nativeApi: 'session/resume + session/load',
        capabilities: summarizeAcpCapabilities(first.initializeResult),
        reason: 'No model option advertised; live semantic recall not exercised',
      };
    }
    const attempts = [];
    for (const candidate of candidates) {
      try {
        await first.conn.setSessionConfigOption({ sessionId, configId: 'model', value: candidate });
        first.clearUpdates();
        const response = await deadline(first.conn.prompt({ sessionId, prompt: [{ type: 'text', text: seedPrompt }] }), timeoutMs, 'ACP first prompt timed out');
        model = candidate;
        firstTurn = { response, text: first.agentText() };
        break;
      } catch (error) {
        attempts.push({ model: candidate, errorClass: classifyError(error) });
      }
    }
    if (!model) {
      return {
        status: 'SKIP',
        nativeApi: 'session/resume + session/load',
        capabilities: summarizeAcpCapabilities(first.initializeResult),
        reason: 'Advertised models were unavailable or unauthenticated; live semantic recall not exercised',
        modelAttempts: attempts,
      };
    }
  } finally {
    await first.close();
  }

  const resumedClient = await openAcp(acp, binary);
  try {
    resumedClient.clearUpdates();
    const resumed = await resumedClient.conn.resumeSession({ sessionId, cwd: workspace, mcpServers: [] });
    resumedClient.clearUpdates();
    const response = await deadline(resumedClient.conn.prompt({ sessionId, prompt: [{ type: 'text', text: recallPrompt }] }), timeoutMs, 'ACP resumed prompt timed out');
    const recalledText = resumedClient.agentText();
    const invalid = await resumedClient.conn.resumeSession({ sessionId: crypto.randomUUID(), cwd: workspace, mcpServers: [] })
      .then(() => ({ rejected: false }))
      .catch((error) => ({ rejected: true, errorClass: classifyError(error) }));

    const loader = await openAcp(acp, binary);
    let loadEvidence;
    try {
      loader.clearUpdates();
      await loader.conn.loadSession({ sessionId, cwd: workspace, mcpServers: [] });
      loadEvidence = {
        replayedUpdateCount: loader.updates.length,
        replayedAgentText: Boolean(loader.agentText()),
      };
    } catch (error) {
      loadEvidence = { rejected: true, errorClass: classifyError(error) };
    } finally {
      await loader.close();
    }

    const recalled = recalledText.includes(token);
    return {
      status: recalled ? 'PASS' : 'FAIL',
      nativeApi: 'session/resume; session/load measured separately',
      processBoundary: 'OpenCode ACP process restart',
      capabilities: summarizeAcpCapabilities(resumedClient.initializeResult),
      sessionIdCaptured: Boolean(sessionId),
      selectedModel: model,
      recallMatched: recalled,
      firstTurn: scrubAcpTurn(firstTurn),
      resumedTurn: scrubAcpTurn({ response, text: recalledText }),
      loadSession: loadEvidence,
      invalidDescriptor: invalid,
      resumeMetadataReturned: Boolean(resumed && Object.keys(resumed).length),
    };
  } finally {
    await resumedClient.close();
  }
}

async function runAcpIsolation() {
  const sdkPath = path.join(extensionDir, 'node_modules', '@agentclientprotocol', 'sdk', 'dist', 'acp.js');
  const binary = path.join(binaryDir, 'opencode');
  requireFiles([sdkPath, binary]);
  const acp = await import(pathToFileURL(sdkPath).href);
  const tokenA = `RM110-A-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const tokenB = `RM110-B-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const first = await openAcp(acp, binary);
  let sessionA;
  let sessionB;
  let selectedModel;
  try {
    const createdA = await first.conn.newSession({ cwd: workspace, mcpServers: [] });
    const createdB = await first.conn.newSession({ cwd: workspace, mcpServers: [] });
    sessionA = createdA.sessionId;
    sessionB = createdB.sessionId;
    for (const candidate of acpModelCandidates(createdA).slice(0, 6)) {
      try {
        await first.conn.setSessionConfigOption({ sessionId: sessionA, configId: 'model', value: candidate });
        first.clearUpdates();
        await deadline(first.conn.prompt({ sessionId: sessionA, prompt: [{ type: 'text', text: `Remember only this audit token: ${tokenA}. Reply ACK. Do not use tools.` }] }), timeoutMs, 'ACP isolation prompt A timed out');
        selectedModel = candidate;
        break;
      } catch { /* try the next advertised model */ }
    }
    if (!selectedModel) {
      return { status: 'SKIP', matrix: 'two-session-isolation', reason: 'No advertised model completed the seed prompt' };
    }
    await first.conn.setSessionConfigOption({ sessionId: sessionB, configId: 'model', value: selectedModel });
    await deadline(first.conn.prompt({ sessionId: sessionB, prompt: [{ type: 'text', text: `Remember only this audit token: ${tokenB}. Reply ACK. Do not use tools.` }] }), timeoutMs, 'ACP isolation prompt B timed out');
  } finally {
    await first.close();
  }
  const second = await openAcp(acp, binary);
  try {
    await Promise.all([
      second.conn.resumeSession({ sessionId: sessionA, cwd: workspace, mcpServers: [] }),
      second.conn.resumeSession({ sessionId: sessionB, cwd: workspace, mcpServers: [] }),
    ]);
    second.clearUpdates();
    const [responseA, responseB] = await Promise.all([
      second.conn.prompt({ sessionId: sessionA, prompt: [{ type: 'text', text: 'Reply with only the audit token from our previous turn.' }] }),
      second.conn.prompt({ sessionId: sessionB, prompt: [{ type: 'text', text: 'Reply with only the audit token from our previous turn.' }] }),
    ]);
    const textA = second.agentText(sessionA);
    const textB = second.agentText(sessionB);
    const isolated = responseA.stopReason === 'end_turn' && responseB.stopReason === 'end_turn'
      && textA.includes(tokenA) && !textA.includes(tokenB)
      && textB.includes(tokenB) && !textB.includes(tokenA);
    return {
      status: isolated ? 'PASS' : 'FAIL',
      matrix: 'two-session-isolation',
      processBoundary: 'OpenCode ACP process restart',
      descriptorsDistinct: sessionA !== sessionB,
      selectedModel,
      conversationARecalledOwnTokenOnly: textA.includes(tokenA) && !textA.includes(tokenB),
      conversationBRecalledOwnTokenOnly: textB.includes(tokenB) && !textB.includes(tokenA),
    };
  } finally {
    await second.close();
  }
}

async function openAcp(acp, binary) {
  const proc = spawn(binary, ['acp'], {
    cwd: workspace,
    env: { ...process.env, OPENCODE_PERMISSION: '{"edit":"deny","bash":"deny","webfetch":"deny"}' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const state = { updates: [], stderr: [] };
  proc.stderr.on('data', (chunk) => state.stderr.push(String(chunk).trim()));
  const conn = new acp.ClientSideConnection(() => ({
    requestPermission: async (request) => {
      const reject = request.options?.find((option) => option.kind === 'reject_once') ?? request.options?.at(-1);
      return { outcome: { outcome: 'selected', optionId: reject?.optionId } };
    },
    sessionUpdate: (notification) => state.updates.push(notification),
    readTextFile: async () => ({ content: '' }),
    writeTextFile: async () => { throw new Error('Audit fixture blocks file writes'); },
  }), acp.ndJsonStream(Writable.toWeb(proc.stdin), Readable.toWeb(proc.stdout)));
  const initializeResult = await deadline(conn.initialize({
    protocolVersion: acp.PROTOCOL_VERSION,
    clientInfo: { name: 'ritemark-s110-audit', version: '1' },
    clientCapabilities: { fs: { readTextFile: true, writeTextFile: false } },
  }), 30_000, 'ACP initialize timed out');
  return {
    proc,
    conn,
    state,
    initializeResult,
    updates: state.updates,
    clearUpdates() { state.updates.length = 0; },
    agentText(sessionId) {
      return state.updates
        .filter((entry) => entry.update?.sessionUpdate === 'agent_message_chunk' && (!sessionId || entry.sessionId === sessionId))
        .map((entry) => entry.update?.content?.text ?? '')
        .join('');
    },
    async close() {
      if (proc.exitCode !== null) return;
      proc.kill('SIGTERM');
      await deadline(new Promise((resolve) => proc.once('exit', resolve)), 5_000, 'ACP process did not exit').catch(() => proc.kill('SIGKILL'));
    },
  };
}

function acpModelCandidates(created) {
  const option = (created.configOptions ?? []).find((item) => (item.id ?? item.configId) === 'model');
  const raw = option?.options ?? option?.values ?? [];
  const values = raw.flatMap((item) => Array.isArray(item.options) ? item.options : [item]).map((item) => item.value).filter(Boolean);
  const ordered = [option?.currentValue, ...values.filter((value) => String(value).includes('free')), ...values].filter(Boolean);
  return [...new Set(ordered)];
}

function summarizeAcpCapabilities(init) {
  return {
    loadSession: init?.agentCapabilities?.loadSession ?? null,
    resume: Boolean(init?.agentCapabilities?.sessionCapabilities?.resume),
    list: Boolean(init?.agentCapabilities?.sessionCapabilities?.list),
    fork: Boolean(init?.agentCapabilities?.sessionCapabilities?.fork),
    close: Boolean(init?.agentCapabilities?.sessionCapabilities?.close),
  };
}

function scrubTurn(turn) {
  return {
    turnIdPresent: Boolean(turn.turnId),
    status: turn.status ?? null,
    emittedText: Boolean(turn.text),
    tokenPresent: turn.text?.includes(token) ?? false,
    ...(turn.account ? { account: turn.account } : {}),
  };
}

function scrubAcpTurn(turn) {
  return {
    stopReason: turn.response?.stopReason ?? null,
    emittedText: Boolean(turn.text),
    tokenPresent: turn.text?.includes(token) ?? false,
  };
}

function classifyError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/not found|unknown|invalid|does not exist|no rollout/i.test(message)) return 'not-found-or-invalid';
  if (/auth|login|credential|unauthorized/i.test(message)) return 'authentication';
  if (/unavailable|upstream request failed/i.test(message)) return 'runtime-unavailable';
  if (/timeout/i.test(message)) return 'timeout';
  return 'protocol-error';
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[A-F0-9]{10,}/gi, '[redacted]').slice(0, 400);
}

async function* withTimeout(iterable, timeout, label) {
  const iterator = iterable[Symbol.asyncIterator]();
  while (true) {
    const next = await deadline(iterator.next(), timeout, label);
    if (next.done) return;
    yield next.value;
  }
}

function deadline(promise, timeout, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), timeout); }),
  ]).finally(() => clearTimeout(timer));
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const [key, inline] = item.slice(2).split('=', 2);
    parsed[key] = inline ?? argv[++index];
  }
  return parsed;
}

function requireFiles(files) {
  for (const file of files) if (!fs.existsSync(file)) fail(`Required fixture dependency missing: ${file}`);
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

async function main() {
  let result;
  try {
    if (provider === 'claude') result = matrix === 'isolation' ? await runClaudeIsolation() : await runClaude();
    if (provider === 'codex') result = matrix === 'isolation' ? await runCodexIsolation() : await runCodex();
    if (provider === 'acp') result = matrix === 'isolation' ? await runAcpIsolation() : await runAcp();
  } catch (error) {
    const errorClass = classifyError(error);
    result = {
      status: errorClass === 'authentication' ? 'SKIP' : 'FAIL',
      stage: 'fixture-execution',
      errorClass,
      reason: safeErrorMessage(error),
    };
  }

  const output = {
    fixture: 'sprint-110-runtime-continuation-v1',
    provider,
    startedAt,
    finishedAt: new Date().toISOString(),
    platform: `${process.platform}-${process.arch}`,
    ...result,
  };
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = result.status === 'FAIL' ? 1 : 0;
}

await main();
