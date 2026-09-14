// Actual ACP manager/client/SDK and bundled OpenCode; no prompt or file tool.
require('../../../../../extensions/ritemark/node_modules/tsx/dist/cjs/index.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const cp = require('node:child_process');
const { performance } = require('node:perf_hooks');
const extensionRoot = path.resolve(__dirname, '../../../../../extensions/ritemark');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-audit-acp-'));
const workspace = path.join(fixture, 'workspace');
fs.mkdirSync(workspace);
const childEnv = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', TMPDIR: fixture, LANG: 'en_US.UTF-8' };
for (const kind of ['CONFIG', 'DATA', 'STATE', 'CACHE']) {
  const dir = path.join(fixture, kind.toLowerCase());
  fs.mkdirSync(dir);
  childEnv[`XDG_${kind}_HOME`] = dir;
}
const report = {
  baseline: '30ea2ab32d15be161991d1bb8924a4c4ca331f8c',
  method: 'Actual AcpManager/AcpClient and locked ACP SDK, bundled native OpenCode. Isolated child XDG directories/environment, synthetic workspace and deny-only filesystem/permission callbacks. Concurrent cold session opens, warm control, owned-process crash, restart and dispose. No prompt/model turn or file-tool invocation.',
  fixture, platform: process.platform, node: process.version,
  events: [], children: [], cases: [], completed: false,
};
const started = performance.now();
function event(kind, fields = {}) { report.events.push({ atMs: Math.round(performance.now() - started), kind, ...fields }); }
const children = [];
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'vscode') return { workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) } };
  if (request === './acpTrace' && parent?.filename.endsWith('/acp/acpManager.ts')) return {
    traceAcp: (scope, message, payload) => event(`trace:${scope}`, { message, ...(scope === 'manager' && message === 'stderr' ? { detail: String(payload).slice(0, 1000) } : {}) }),
  };
  if (request === 'child_process' && parent?.filename.endsWith('/acp/acpClient.ts')) return {
    ...cp,
    spawn: (...args) => {
      const child = cp.spawn(...args);
      children.push(child);
      const record = { pid: child.pid, command: args[0], args: args[1], exited: false };
      report.children.push(record);
      child.on('exit', (code, signal) => { Object.assign(record, { exited: true, code, signal }); event('child-exit', { pid: child.pid, code, signal }); });
      return child;
    },
  };
  return originalLoad.call(this, request, parent, isMain);
};
const { AcpManager, OPENCODE_PERMISSION } = require(path.join(extensionRoot, 'src/acp/acpManager.ts'));
const originalBuildEnv = AcpManager.prototype.buildSpawnEnv;
AcpManager.prototype.buildSpawnEnv = () => ({ ...childEnv, OPENCODE_PERMISSION });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check, timeout = 5000) {
  const until = performance.now() + timeout;
  while (performance.now() < until) { if (check()) return; await sleep(20); }
  throw new Error('Observation deadline exceeded for existing child; no automatic restart');
}
async function bounded(promise, timeout = 30000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Harness observation deadline exceeded')), timeout); })]); }
  finally { clearTimeout(timer); }
}
async function outcome(promise) {
  try { return { ok: true, value: await promise }; }
  catch (error) { return { ok: false, error: String(error.message ?? error) }; }
}
const running = child => child.exitCode === null && child.signalCode === null;
let manager;
async function main() {
  try {
    const binaryPath = path.join(extensionRoot, 'binaries/agents/darwin-arm64/opencode');
    report.binary = { path: binaryPath, bytes: fs.statSync(binaryPath).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(binaryPath)).digest('hex') };
    manager = new AcpManager({
      binaryPath, workspaceRoot: workspace,
      requestPermission: async () => { event('unexpected-permission'); return { outcome: { outcome: 'cancelled' } }; },
      approveWrite: async () => { event('unexpected-write-approval'); return false; },
      onProgress: (progress, sessionId) => event('progress', { type: progress.type, message: progress.message, sessionId }),
      fsBackend: { readFile: async () => { throw new Error('No filesystem access expected'); }, writeFile: async () => { throw new Error('No filesystem access expected'); } },
    });
    const simultaneous = await bounded(Promise.all([outcome(manager.start()), outcome(manager.start())]));
    report.cases.push({ name: 'concurrent cold session opens', results: simultaneous, childCount: children.length, liveSessionCount: manager.sessionCount });
    assert.equal(simultaneous[0].ok, true, JSON.stringify(simultaneous));
    assert.equal(simultaneous[1].ok, false, JSON.stringify(simultaneous));
    assert.match(simultaneous[1].error, /not initialized/);
    const warm = await bounded(manager.start());
    assert.notEqual(warm, simultaneous[0].value);
    assert.equal(manager.sessionCount, 2);
    assert.equal(children.length, 1);
    report.cases.push({ name: 'warm session open control', passed: true, distinctSessionIds: true, liveSessionCount: 2, childCount: 1 });
    const first = children.at(-1);
    first.kill('SIGSTOP');
    await sleep(50);
    const pending = outcome(manager.start());
    await sleep(50);
    first.kill('SIGKILL');
    const rejected = await bounded(pending, 5000);
    await waitFor(() => !running(first));
    assert.equal(rejected.ok, false);
    assert.equal(manager.sessionCount, 0);
    assert.equal(manager.isRunning(), false);
    report.cases.push({ name: 'native crash during session open', passed: true, outstandingResult: rejected, liveSessionCountAfterExit: 0 });
    const fresh = await bounded(manager.start());
    const replacement = children.at(-1);
    assert.notEqual(replacement.pid, first.pid);
    assert.notEqual(fresh, warm);
    report.cases.push({ name: 'native restart after confirmed exit', passed: true, firstPid: first.pid, replacementPid: replacement.pid, liveSessionCount: manager.sessionCount });
    const disposedAt = performance.now();
    manager.dispose();
    await waitFor(() => !running(replacement));
    report.cases.push({ name: 'normal dispose', passed: true, observedExitWithinMs: Math.round(performance.now() - disposedAt), liveSessionCount: manager.sessionCount });
    report.completed = true;
  } catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
  finally {
    manager?.dispose();
    for (const child of children) if (running(child)) { child.kill('SIGCONT'); child.kill('SIGTERM'); }
    await sleep(300);
    for (const child of children) if (running(child)) child.kill('SIGKILL');
    await Promise.all(children.map(child => waitFor(() => !running(child)).catch(error => { report.cleanupError = String(error); })));
    report.allOwnedChildrenExited = children.every(child => !running(child));
    Module._load = originalLoad;
    AcpManager.prototype.buildSpawnEnv = originalBuildEnv;
    fs.writeFileSync(path.join(__dirname, 'native-acp-lifecycle-probe.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ completed: report.completed, cases: report.cases, allOwnedChildrenExited: report.allOwnedChildrenExited, error: report.error }, null, 2));
  }
}
main();
