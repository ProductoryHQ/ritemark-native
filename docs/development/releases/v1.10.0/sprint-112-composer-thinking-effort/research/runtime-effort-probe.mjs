#!/usr/bin/env node

/**
 * Read-only Sprint 112 effort-capability probe for the exact Sprint 111 pins.
 *
 * Prints model capability metadata only. It does not send a user prompt or
 * record credentials, account data, conversation ids, or provider output.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [codexBinaryArg, claudeSdkArg, claudeBinaryArg, workspaceArg] = process.argv.slice(2);
if (!codexBinaryArg || !claudeSdkArg || !claudeBinaryArg) {
  console.error('Usage: node runtime-effort-probe.mjs CODEX_BINARY CLAUDE_SDK CLAUDE_BINARY [WORKSPACE]');
  process.exit(2);
}

const codexBinary = path.resolve(codexBinaryArg);
const claudeSdk = path.resolve(claudeSdkArg);
const claudeBinary = path.resolve(claudeBinaryArg);
const workspace = path.resolve(workspaceArg ?? process.cwd());

async function probeCodex() {
  const proc = spawn(codexBinary, [], {
    cwd: workspace,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let buffer = '';
  let nextId = 1;
  const pending = new Map();

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
        proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { decision: 'decline' } })}\n`);
      }
    }
  });

  function rpc(method, params) {
    const id = nextId++;
    proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  try {
    await rpc('initialize', {
      clientInfo: { name: 'ritemark-s112-audit', title: 'Ritemark Sprint 112 audit', version: '1' },
      capabilities: { experimentalApi: true },
    });
    proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} })}\n`);
    const page = await rpc('model/list', { limit: 100 });
    const models = page.data ?? page.models ?? [];
    return models.map((model) => ({
      id: model.id ?? model.model ?? model.slug,
      displayName: model.displayName ?? model.name ?? null,
      isDefault: model.isDefault ?? false,
      defaultReasoningEffort: model.defaultReasoningEffort ?? model.default_reasoning_effort ?? null,
      supportedReasoningEfforts: (model.supportedReasoningEfforts ?? model.supported_reasoning_efforts ?? [])
        .map((entry) => typeof entry === 'string' ? entry : entry.reasoningEffort ?? entry.effort)
        .filter(Boolean),
    }));
  } finally {
    proc.kill('SIGTERM');
  }
}

async function* blockingPrompt() {
  await new Promise(() => {});
}

async function probeClaude() {
  const sdk = await import(pathToFileURL(claudeSdk).href);
  const stream = sdk.query({
    prompt: blockingPrompt(),
    options: {
      cwd: workspace,
      pathToClaudeCodeExecutable: claudeBinary,
      settingSources: [],
      permissionMode: 'default',
    },
  });
  try {
    const models = await stream.supportedModels();
    return models.map((model) => ({
      id: model.value,
      resolvedModel: model.resolvedModel ?? null,
      displayName: model.displayName,
      supportsEffort: model.supportsEffort ?? false,
      supportedEffortLevels: model.supportedEffortLevels ?? [],
      supportsAdaptiveThinking: model.supportsAdaptiveThinking ?? false,
    }));
  } finally {
    stream.close();
  }
}

function withTimeout(promise, label, ms = 15_000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

const [codexResult, claudeResult] = await Promise.allSettled([
  withTimeout(probeCodex(), 'Codex probe'),
  withTimeout(probeClaude(), 'Claude probe'),
]);
const codex = codexResult.status === 'fulfilled' ? codexResult.value : { error: codexResult.reason?.message ?? String(codexResult.reason) };
const claude = claudeResult.status === 'fulfilled' ? claudeResult.value : { error: claudeResult.reason?.message ?? String(claudeResult.reason) };
console.log(JSON.stringify({
  capturedAt: new Date().toISOString(),
  codex,
  claude,
}, null, 2));
