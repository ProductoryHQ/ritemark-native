// Unchanged CodexSession + JSON-RPC client, with only binary selection replaced
// by an explicit audited executable path. No product input is changed.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const evidence = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const variant = ['retry', 'params', 'warmup', 'prototype', 'final'].includes(process.argv[2]) ? process.argv[2] : 'default';
const { auditRoot } = JSON.parse(await fs.readFile(path.join(evidence, 'audit-environment.json'), 'utf8'));
const models = JSON.parse(await fs.readFile(path.join(evidence, 'candidate-effort-models.json'), 'utf8')).codex;
const adapterRoot = path.resolve(process.env.S116_ADAPTER_ROOT ?? 'extensions/ritemark');
if (process.env.S116_ADAPTER_ROOT && !adapterRoot.startsWith(auditRoot + path.sep)) {
  throw new Error('Audit adapter override must remain in the isolated audit directory');
}
const require = createRequire(path.join(adapterRoot, 'package.json'));
const Module = require('module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) { return request === 'vscode' ? '__s116_vscode_stub__' : resolve.call(this, request, ...rest); };
require.cache.__s116_vscode_stub__ = { id: '__s116_vscode_stub__', filename: '__s116_vscode_stub__', loaded: true, exports: { workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) } } };
const { CodexRuntime, CodexSession } = require(path.join(adapterRoot, 'src/codex/CodexRuntime.ts'));
const { CodexAppServer } = require(path.join(adapterRoot, 'src/codex/codexAppServer.ts'));
const protocol = [];
const app = new CodexAppServer({ trace(scope, method) { if (scope.startsWith('rpc:') && scope !== 'rpc:event') { const row = { scope, method }; protocol.push(row); console.log(JSON.stringify(row)); } } });
const rpc = app.rpc.bind(app);
app.rpc = (method, params, timeout, options) => rpc(method, params, Math.min(timeout ?? 30000, 30000), options);
let proc;
const processDiagnostics = { stderrTail: [], exit: null };
app.manager = {
  async ensureRunning() {
    if (proc) return;
    proc = spawn(path.join(auditRoot, 'binaries/darwin-arm64/codex-app-server'), [], { cwd: path.join(auditRoot, 'workspace'), stdio: ['pipe', 'pipe', 'pipe'] });
    proc.stdout.on('data', data => app.handleStdout(String(data)));
    proc.stderr.on('data', chunk => {
      const lines = String(chunk)
        .replace(/(authorization|api[_-]?key|token|secret)(["'=:\s]+)[^\s",}]+/gi, '$1$2<redacted>')
        .split('\n').filter(Boolean).map(line => line.slice(0, 1000));
      processDiagnostics.stderrTail.push(...lines);
      processDiagnostics.stderrTail = processDiagnostics.stderrTail.slice(-80);
    });
    proc.on('exit', (code, signal) => {
      processDiagnostics.exit = { code, signal };
      app.handleExit(code);
    });
  },
  send(text) {
    if (variant === 'params') {
      const message = JSON.parse(text);
      if (message.method === 'initialized' && message.params === undefined) { message.params = {}; text = JSON.stringify(message); }
    }
    proc.stdin.write(text + '\n');
  },
  isRunning() { return !!proc && proc.exitCode === null; },
  async getBinaryStatus() { return { available: true, runnable: true, version: '0.154.0', diagnostics: ['Explicitly selected audited candidate binary'] }; },
  dispose() { proc?.kill('SIGTERM'); },
};
const runtime = new CodexRuntime();
runtime._appServer = app;
runtime._auth = { isAuthenticated: () => true };
runtime._setupEventListeners();
const interrupts = [];
const interrupt = app.turnInterrupt.bind(app);
app.turnInterrupt = async (...args) => { try { await interrupt(...args); interrupts.push({ accepted: true }); } catch (error) { interrupts.push({ accepted: false, error: error.message.slice(0, 250) }); throw error; } };
const events = [];
const completions = [];
app.on('item/agentMessage/delta', event => events.push(event));
app.on('turn/completed', event => completions.push(event));
const session = new CodexSession('synthetic-cancel-audit', { workspacePath: path.join(auditRoot, 'workspace'), model: models.find(model => model.isDefault).id, codexApprovalPolicy: 'never', codexSandboxMode: 'read-only', onProgress() {}, onApprovalRequest() {} }, runtime);
runtime._sessions.set(session.conversationId, session);
const result = { capturedAt: new Date().toISOString(), adapter: variant === 'final' ? 'Sprint 116 product CodexSession + CodexAppServer' : process.env.S116_ADAPTER_ROOT ? 'isolated Sprint 116 prototype CodexSession + CodexAppServer' : 'unchanged CodexSession + CodexAppServer', binary: '0.154.0', variant, auditTransportAdjustment: variant === 'params' ? 'Add empty params object to initialized notification only' : variant === 'warmup' ? 'Read account and models before first thread/start' : null, protocol, checks: [], processDiagnostics };
function completion(id) {
  const found = completions.find(event => event.turn.id === id);
  if (found) return Promise.resolve(found);
  return new Promise((resolve, reject) => {
    const listener = event => { if (event.turn.id === id) { clearTimeout(timer); app.off('turn/completed', listener); resolve(event); } };
    const timer = setTimeout(() => { app.off('turn/completed', listener); reject(new Error('completion timeout')); }, 60000);
    app.on('turn/completed', listener);
  });
}
try {
  if (variant === 'warmup') { await app.getAccount(); await app.rpc('model/list', { limit: 100 }); }
  await session.prompt({ prompt: 'List integers from 1 to 1500. Do not use tools.', thinkingEffort: 'low' });
  const firstId = session._turnId;
  await session.cancel();
  let secondId;
  try {
    await session.prompt({ prompt: 'The previous turn was cancelled. Reply S116_CANCEL_FOLLOWUP_OK only. Do not use tools.', thinkingEffort: 'low' });
    secondId = session._turnId;
  } catch (error) { result.checks.push({ name: 'immediate resend', status: 'FAIL', error: error.message.slice(0, 300) }); }
  const first = await completion(firstId);
  result.checks.push({ name: 'cancel immediately after turn/start', status: first.turn.status === 'interrupted' && interrupts.some(item => item.accepted) ? 'PASS' : 'FAIL', interrupts, terminalStatus: first.turn.status });
  if (secondId) {
    const second = await completion(secondId);
    const output = events.filter(event => event.turnId === secondId).map(event => event.delta).join('');
    result.checks.push({ name: 'immediate resend', status: second.turn.status === 'completed' && output.includes('S116_CANCEL_FOLLOWUP_OK') ? 'PASS' : 'FAIL', terminalStatus: second.turn.status, outputMatched: output.includes('S116_CANCEL_FOLLOWUP_OK') });
  }
} catch (error) { result.checks.push({ name: 'session audit', status: 'FAIL', error: error.message.slice(0, 300) }); }
finally { app.dispose(); }
await fs.writeFile(path.join(evidence, `codex-session-cancel${variant === 'default' ? '' : '-' + variant}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (result.checks.some(check => check.status === 'FAIL')) process.exitCode = 1;
