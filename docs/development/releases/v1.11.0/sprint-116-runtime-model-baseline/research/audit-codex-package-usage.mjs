import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const researchDir = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.join(researchDir, 'evidence');
const { auditRoot } = JSON.parse(await fs.readFile(path.join(evidenceDir, 'audit-environment.json'), 'utf8'));
const sourceRoot = path.join(auditRoot, 'full-packages', 'darwin-arm64');
const stageRoot = path.join(auditRoot, 'instrumented-codex-package-audit');
if (!stageRoot.startsWith(`${auditRoot}${path.sep}`)) throw new Error('Unsafe audit stage path');
await fs.rm(stageRoot, { recursive: true, force: true });
await fs.cp(sourceRoot, stageRoot, { recursive: true });

const usageLog = path.join(stageRoot, 'resource-usage.log');
for (const resource of ['codex-path/rg', 'codex-resources/zsh/bin/zsh']) {
  const resourcePath = path.join(stageRoot, resource);
  const realPath = `${resourcePath}.real`;
  await fs.rename(resourcePath, realPath);
  const name = path.basename(resource);
  await fs.writeFile(resourcePath, `#!/bin/sh\nprintf '${name}\\n' >> '${usageLog}'\nexec \"$(dirname \"$0\")/${name}.real\" \"$@\"\n`, { mode: 0o755 });
}

const codexHome = path.join(auditRoot, 'package-layout-codex-home');
await fs.rm(codexHome, { recursive: true, force: true });
const sessions = path.join(codexHome, 'sessions', '2026', '09', '13');
await fs.mkdir(sessions, { recursive: true });
await fs.writeFile(path.join(sessions, 'synthetic.jsonl'), '{"synthetic":"haystack"}\n');

const child = spawn(path.join(stageRoot, 'bin', 'codex-app-server'), [], {
  cwd: auditRoot,
  env: { ...process.env, CODEX_HOME: codexHome, PATH: '/usr/bin:/bin:/usr/sbin:/sbin' },
  stdio: ['pipe', 'pipe', 'pipe'],
});
let buffer = '';
let stderr = '';
let nextId = 0;
const pending = new Map();
child.stderr.on('data', chunk => { stderr += String(chunk); });
child.stdout.on('data', chunk => {
  buffer += String(chunk);
  while (buffer.includes('\n')) {
    const index = buffer.indexOf('\n');
    const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
    let message; try { message = JSON.parse(line); } catch { continue; }
    if (message.id === undefined) continue;
    const request = pending.get(message.id);
    if (!request) continue;
    pending.delete(message.id);
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  }
});
function rpc(method, params) {
  const id = ++nextId;
  const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`${method} timeout`)), 30000))]);
}

let result;
try {
  await rpc('initialize', { clientInfo: { name: 'ritemark-s116-package-audit', version: '1' }, capabilities: { experimentalApi: true } });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} })}\n`);
  const search = await rpc('thread/search', { searchTerm: 'needle-that-is-not-present', limit: 5 });
  const usage = (await fs.readFile(usageLog, 'utf8')).trim().split(/\r?\n/).filter(Boolean);
  result = {
    capturedAt: new Date().toISOString(),
    status: usage.includes('rg') ? 'PASS' : 'FAIL',
    packageRoot: stageRoot,
    path: '/usr/bin:/bin:/usr/sbin:/sbin',
    codexHome: 'isolated temporary home',
    threadSearchReturned: Array.isArray(search.data),
    resourceSelections: usage,
    zshSelection: 'Static upstream InstallContext path verified; shell execution remains part of the authenticated behavior matrix.',
  };
} catch (error) {
  result = { capturedAt: new Date().toISOString(), status: 'FAIL', error: error.message, stderr: stderr.slice(-2000) };
} finally {
  child.kill('SIGTERM');
}
await fs.writeFile(path.join(evidenceDir, 'codex-package-usage.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
if (result.status !== 'PASS') process.exitCode = 1;
