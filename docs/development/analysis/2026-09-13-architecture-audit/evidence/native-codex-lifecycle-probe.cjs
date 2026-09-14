// Actual Ritemark CodexAppServer + CodexManager against the pinned native binary.
// Only discovery root/configuration and child environment are supplied by the
// harness. JSON-RPC, timers, process signals and lifecycle code are unchanged.
require('../../../../../extensions/ritemark/node_modules/tsx/dist/cjs/index.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const Module = require('node:module');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '../../../../..');
const extensionRoot = path.join(root, 'extensions/ritemark');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-audit-native-'));
const runtimeProfile = path.join(fixture, 'runtime-profile');
fs.mkdirSync(runtimeProfile);
// CODEX_HOME is the native program's intended profile setting, provided only to
// its child environment; the harness/host environment and user profile are unchanged.
const childEnv = {
  PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
  TMPDIR: fixture,
  CODEX_HOME: runtimeProfile,
  LANG: 'en_US.UTF-8',
};
fs.writeFileSync(path.join(runtimeProfile, 'config.toml'), 'cli_auth_credentials_store = "file"\n');
const report = {
  baseline: '30ea2ab32d15be161991d1bb8924a4c4ca331f8c',
  method: 'Actual source client/manager and bundled darwin-arm64 binary. Explicit discovery root, fake VS Code configuration, isolated child profile/environment. Real 300 ms RPC deadline and owned-child SIGSTOP/SIGCONT/SIGKILL. No login, model turn, user file tool or network-dependent RPC.',
  fixture, platform: process.platform, arch: process.arch, node: process.version,
  events: [], children: [], cases: [], completed: false,
};
const started = performance.now();
const event = (kind, fields = {}) => report.events.push({ atMs: Math.round(performance.now() - started), kind, ...fields });
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'vscode') return { workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) } };
  const loaded = originalLoad.call(this, request, parent, isMain);
  if (parent?.filename.endsWith('/codex/codexManager.ts') && request === '../utils/bundledAgentRuntime') {
    return { ...loaded, findBundledAgentRuntime: (kind, options) => loaded.findBundledAgentRuntime(kind, { ...options, extensionRoot }) };
  }
  return loaded;
};
const { CodexAppServer } = require(path.join(extensionRoot, 'src/codex/codexAppServer.ts'));
const { CodexManager } = require(path.join(extensionRoot, 'src/codex/codexManager.ts'));
const originalSpawn = CodexManager.prototype.spawnResolvedBinary;
const originalSpawnSync = CodexManager.prototype.spawnResolvedBinarySync;
const children = [];
CodexManager.prototype.spawnResolvedBinary = function (binaryPath, args, options = {}) {
  const child = originalSpawn.call(this, binaryPath, args, { ...options, cwd: fixture, env: childEnv });
  children.push(child);
  const record = { pid: child.pid, binaryPath, args, exited: false };
  report.children.push(record);
  child.once('exit', (code, signal) => { Object.assign(record, { exited: true, code, signal }); event('child-exit', { pid: child.pid, code, signal }); });
  event('child-spawn', { pid: child.pid, args });
  return child;
};
CodexManager.prototype.spawnResolvedBinarySync = function (binaryPath, args, options = {}) {
  return originalSpawnSync.call(this, binaryPath, args, { ...options, cwd: fixture, env: childEnv });
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check, timeout = 5000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) { if (check()) return; await sleep(20); }
  throw new Error('Observation deadline exceeded; inspect the existing child before any retry');
}
function running(child) { return child.exitCode === null && child.signalCode === null; }
async function outcome(promise) {
  try { return { ok: true, value: await promise }; }
  catch (error) { return { ok: false, error: String(error.message ?? error) }; }
}
let server;
async function main() {
  try {
    const binaryPath = path.join(extensionRoot, 'binaries/agents/darwin-arm64/codex-app-server');
    report.binary = { path: binaryPath, bytes: fs.statSync(binaryPath).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(binaryPath)).digest('hex') };
    server = new CodexAppServer({ trace: (scope, message, payload) => {
      if (['rpc:request', 'rpc:error', 'app-server'].includes(scope)) event(scope, { message, ...(scope === 'rpc:request' ? { id: payload?.id } : {}) });
    } });
    server.on('exit', code => event('client-exit', { code }));
    const status = await server.manager.getBinaryStatus();
    report.binary.status = { available: status.available, runnable: status.runnable, version: status.version, runtimeSource: status.runtimeSource, launchMode: status.launchMode, compatibility: status.compatibility };
    assert.equal(status.binaryPath, binaryPath);
    assert.equal(status.runnable, true);
    const initialized = await Promise.all([server.ensureInitialized(), server.ensureInitialized(), server.ensureInitialized()]);
    assert.equal(children.length, 1);
    assert.equal(report.events.filter(e => e.kind === 'rpc:request' && e.message === 'initialize').length, 1);
    report.cases.push({ name: 'concurrent initialization', passed: true, callers: initialized.length, childCount: children.length, initializeRequests: 1 });
    const read = () => server.rpc('thread/list', { limit: 1 }, 300);
    const initialList = await read();
    assert.equal(initialList.data.length, 0);
    report.cases.push({ name: 'isolated native JSON-RPC read', passed: true, persistedThreads: initialList.data.length });
    let child = children.at(-1);
    child.kill('SIGSTOP');
    await sleep(50);
    const deadlineStarted = performance.now();
    const timeoutResult = await outcome(read());
    const deadlineElapsedMs = Math.round(performance.now() - deadlineStarted);
    assert.equal(timeoutResult.ok, false);
    assert.match(timeoutResult.error, /timed out after 300ms/);
    assert.equal(server.pendingRequests.size, 0);
    child.kill('SIGCONT');
    const afterTimeout = await read();
    assert.equal(afterTimeout.data.length, 0);
    report.cases.push({ name: 'paused native child RPC timeout and resumed read', passed: true, deadlineElapsedMs, timeoutResult, pendingRequestsAfterTimeout: 0, lateReplyDoesNotCorruptNextRead: true });
    child.kill('SIGSTOP');
    await sleep(50);
    const pending = outcome(server.rpc('thread/list', { limit: 1 }, 3000));
    assert.equal(server.pendingRequests.size, 1);
    child.kill('SIGKILL');
    const killedResult = await pending;
    await waitFor(() => !running(child));
    assert.equal(killedResult.ok, false);
    assert.match(killedResult.error, /exited unexpectedly/);
    assert.equal(server.pendingRequests.size, 0);
    assert.equal(server.initializePromise, null);
    await server.ensureInitialized();
    const replacement = children.at(-1);
    assert.notEqual(replacement.pid, child.pid);
    assert.equal((await read()).data.length, 0);
    report.cases.push({ name: 'native crash with outstanding RPC, then reinitialize', passed: true, killedPid: child.pid, replacementPid: replacement.pid, pendingResult: killedResult, pendingRequestsAfterExit: 0 });
    child = replacement;
    const disposeStarted = performance.now();
    server.dispose();
    const logicalStoppedImmediately = !server.isRunning();
    await waitFor(() => !running(child));
    report.cases.push({ name: 'normal native dispose', passed: true, logicalStoppedImmediately, observedExitWithinMs: Math.round(performance.now() - disposeStarted), code: child.exitCode, signal: child.signalCode });
    report.completed = true;
  } catch (error) {
    report.error = String(error.stack ?? error);
    process.exitCode = 1;
  } finally {
    // Kill only children launched by this harness; never search/kill by binary name.
    for (const child of children) if (running(child)) { child.kill('SIGCONT'); child.kill('SIGTERM'); }
    await sleep(300);
    for (const child of children) if (running(child)) child.kill('SIGKILL');
    await Promise.all(children.map(child => waitFor(() => !running(child)).catch(error => { report.cleanupError = String(error); })));
    report.allOwnedChildrenExited = children.every(child => !running(child));
    Module._load = originalLoad;
    CodexManager.prototype.spawnResolvedBinary = originalSpawn;
    CodexManager.prototype.spawnResolvedBinarySync = originalSpawnSync;
    fs.writeFileSync(path.join(__dirname, 'native-codex-lifecycle-probe.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ completed: report.completed, cases: report.cases, allOwnedChildrenExited: report.allOwnedChildrenExited, error: report.error }, null, 2));
  }
}
main();
