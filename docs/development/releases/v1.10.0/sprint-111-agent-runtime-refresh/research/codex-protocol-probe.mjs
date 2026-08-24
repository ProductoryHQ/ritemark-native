#!/usr/bin/env node

/**
 * Read-only Sprint 111 Codex app-server capability probe.
 *
 * It records only protocol shape and acceptance results. It does not start a
 * turn, print model identifiers, or expose account/profile data.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

const binary = path.resolve(process.argv[2] ?? '');
const workspace = path.resolve(process.argv[3] ?? process.cwd());
if (!process.argv[2]) {
  console.error('Usage: node codex-protocol-probe.mjs /path/to/codex-app-server /path/to/workspace');
  process.exit(2);
}

const proc = spawn(binary, [], { cwd: workspace, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
let buffer = '';
let nextId = 1;
const pending = new Map();
const stderr = [];

proc.stderr.on('data', (chunk) => stderr.push(String(chunk).trim()));
proc.stdout.on('data', (chunk) => {
  buffer += String(chunk);
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id !== undefined && (message.result !== undefined || message.error)) {
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(`${message.error.code}: ${message.error.message}`));
      else request.resolve(message.result);
    } else if (message.id !== undefined && message.method) {
      send({ jsonrpc: '2.0', id: message.id, result: { decision: 'decline' } });
    }
  }
});

function send(message) {
  proc.stdin.write(`${JSON.stringify(message)}\n`);
}

function rpc(method, params) {
  const id = nextId++;
  send({ jsonrpc: '2.0', id, method, params });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function effortValues(model) {
  const raw = model.supportedReasoningEfforts ?? model.supported_reasoning_efforts ?? [];
  return raw.map((entry) => typeof entry === 'string' ? entry : entry.reasoningEffort ?? entry.effort).filter(Boolean);
}

try {
  const initialized = await rpc('initialize', {
    clientInfo: { name: 'ritemark-s111-audit', title: 'Ritemark Sprint 111 audit', version: '1' },
    capabilities: { experimentalApi: true },
  });
  send({ jsonrpc: '2.0', method: 'initialized', params: {} });

  const modelPage = await rpc('model/list', { limit: 100 });
  const models = modelPage.data ?? modelPage.models ?? [];
  const effortSet = [...new Set(models.flatMap(effortValues))].sort();

  const started = await rpc('thread/start', {
    cwd: workspace,
    approvalPolicy: 'untrusted',
    sandbox: 'read-only',
    baseInstructions: 'Do not use tools.',
    experimentalRawEvents: false,
    persistExtendedHistory: false,
  });

  console.log(JSON.stringify({
    status: started.thread?.id ? 'PASS' : 'FAIL',
    serverInfoPresent: Boolean(initialized?.serverInfo),
    modelListAccepted: Array.isArray(models),
    modelCount: models.length,
    supportedReasoningEfforts: effortSet,
    untrustedApprovalPolicyAccepted: Boolean(started.thread?.id),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    status: 'FAIL',
    errorClass: /untrusted|approval/i.test(String(error)) ? 'approval-policy' : 'protocol',
    message: String(error).slice(0, 300),
    stderrPresent: stderr.length > 0,
  }, null, 2));
  process.exitCode = 1;
} finally {
  proc.kill('SIGTERM');
}
