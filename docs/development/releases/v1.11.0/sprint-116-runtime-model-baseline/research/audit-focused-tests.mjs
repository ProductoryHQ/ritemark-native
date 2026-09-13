// Run existing tests without changing product inputs; retain bounded audit logs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const evidence = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const extension = path.resolve(process.argv[2] ?? 'extensions/ritemark');
const label = process.argv[3] ?? 'baseline';
const tests = [
  'src/runtime/continuation.test.ts', 'src/runtime/thinkingEffort.test.ts',
  'src/runtime/runtimeErrorPresentation.test.ts',
  'src/agent/AgentRunner.test.ts', 'src/agent/ClaudeCodeRuntime.test.ts',
  'src/codex/codexApproval.test.ts', 'src/codex/CodexRuntime.test.ts',
  'src/acp/acpClient.test.ts', 'src/acp/acpManager.test.ts', 'src/acp/AcpRuntime.test.ts',
  'src/ai/modelCatalog/modelCatalog.test.ts', 'src/utils/bundledAgentRuntime.test.ts',
  'src/views/agentSidebarBootstrap.test.ts',
  'webview/src/components/ai-sidebar/modelPresentation.test.ts',
  'webview/src/components/ai-sidebar/runtimeAvailability.test.ts',
  'webview/src/components/ai-sidebar/bootstrapState.test.ts',
  'webview/src/components/ai-sidebar/conversationRouting.test.ts',
  'webview/src/components/ai-sidebar/runtimeSwitching.test.ts',
  'webview/src/components/ai-sidebar/continuationPresentation.test.ts',
  'webview/src/components/ai-sidebar/thinkingEffortGeometry.test.ts',
];
const commands = [{ name: 'TypeScript compile (no emit)', args: ['node_modules/typescript/bin/tsc', '--noEmit', '-p', '.'] }];
// Node's loader avoids the tsx CLI's unnecessary IPC listening socket.
if (label === 'baseline') commands.push(...tests.map(file => ({ name: file, args: ['--import', 'tsx', file] })));
const results = [];
for (const { name, args } of commands) {
  const result = spawnSync(process.execPath, args, { cwd: extension, encoding: 'utf8', timeout: 90000, maxBuffer: 2000000, env: process.env });
  const row = { name, capturedAt: new Date().toISOString(), command: [process.execPath, ...args], status: result.status === 0 ? 'PASS' : 'FAIL', exitCode: result.status, error: result.error?.message, stdout: result.stdout, stderr: result.stderr };
  results.push(row);
  console.log(JSON.stringify({ label, name, status: row.status, ...(row.status === 'FAIL' ? { detail: `${result.stdout}\n${result.stderr}`.slice(-1800) } : {}) }));
}
fs.writeFileSync(path.join(evidence, `${label}-tests.json`), JSON.stringify({ capturedAt: new Date().toISOString(), node: process.version, extension, results }, null, 2) + '\n');
if (results.some(row => row.status !== 'PASS')) process.exitCode = 1;
