// Exercise the unchanged Ritemark persistent session against the isolated SDK.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const evidence = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const { auditRoot } = JSON.parse(await fs.readFile(path.join(evidence, 'audit-environment.json'), 'utf8'));
const require = createRequire(path.join(auditRoot, 'candidate-extension/package.json'));
const Module = require('module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) { return request === 'vscode' ? '__s116_vscode_stub__' : resolve.call(this, request, ...rest); };
require.cache.__s116_vscode_stub__ = { id: '__s116_vscode_stub__', filename: '__s116_vscode_stub__', loaded: true, exports: {} };
const { AgentSession } = require(path.join(auditRoot, 'candidate-extension/src/agent/AgentRunner.ts'));
const fixture = path.join(auditRoot, 'workspace/claude-session-cancel.txt');
await fs.writeFile(fixture, 'S116_BEFORE\n');
const result = { capturedAt: new Date().toISOString(), adapter: 'unchanged AgentSession', sdk: '0.3.270', binary: '2.1.270', checks: [] };
const checkpoints = [];
const session = new AgentSession({ workspacePath: path.dirname(fixture), pathToClaudeCodeExecutable: path.join(auditRoot, 'binaries/darwin-arm64/claude'), tools: ['Read', 'Edit'], allowedTools: ['Read'], settingSources: [], approvalMode: 'ask', extraSystemPromptAppend: 'Synthetic audit. Touch only claude-session-cancel.txt. Never use shell, network, browser or subagents.', onSessionCheckpoint: id => checkpoints.push(id) });
function bounded(promise) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('audit timeout')), 60000); })]).finally(() => clearTimeout(timer));
}
try {
  let approvalRequested = false;
  const first = await bounded(session.sendMessage({ prompt: 'Read claude-session-cancel.txt, then use Edit to replace S116_BEFORE with S116_AFTER.', thinkingEffort: 'low', onProgress() {}, onToolApproval() { approvalRequested = true; session.interrupt(); } }));
  result.checks.push({ name: 'cancel while approval pending', status: approvalRequested && first.error === 'Execution cancelled' && (await fs.readFile(fixture, 'utf8')).trim() === 'S116_BEFORE' ? 'PASS' : 'FAIL', approvalRequested, error: first.error ?? null, fixtureUnchanged: (await fs.readFile(fixture, 'utf8')).trim() === 'S116_BEFORE' });
  const errors = [];
  const second = await bounded(session.sendMessage({ prompt: 'The previous turn was cancelled. Do not edit anything or use tools. Reply S116_CANCEL_FOLLOWUP_OK only.', thinkingEffort: 'low', onProgress(type, message) { if (type === 'error') errors.push(message.slice(0, 200)); }, onToolApproval() { session.interrupt(); } }));
  result.checks.push({ name: 'immediate follow-up after cancellation', status: !second.error && second.text.includes('S116_CANCEL_FOLLOWUP_OK') ? 'PASS' : 'FAIL', error: second.error ?? null, outputMatched: second.text.includes('S116_CANCEL_FOLLOWUP_OK'), errorEvents: errors, checkpointCount: checkpoints.length, sameSession: checkpoints.length > 0 && new Set(checkpoints).size === 1 });
} catch (error) { result.checks.push({ name: 'session audit', status: 'FAIL', error: error.message.slice(0, 300) }); }
finally { session.close(); }
await fs.writeFile(path.join(evidence, 'claude-session-cancel.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (result.checks.some(check => check.status === 'FAIL')) process.exitCode = 1;
