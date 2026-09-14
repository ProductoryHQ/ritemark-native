// Actual Codex flow executor with a deterministic fake app-server transport.
// No binary or model request is started. Timeout clock is accelerated below.
require('../../../../../extensions/ritemark/node_modules/tsx/dist/cjs/index.cjs');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const fs = require('node:fs/promises');
const path = require('node:path');
const originalLoad = Module._load;
const originalTimeout = global.setTimeout;
let scenario, lastServer;
class FakeAppServer extends EventEmitter {
  constructor() { super(); this.disposed = false; this.interrupted = false; lastServer = this; }
  async ensureInitialized() {}
  async getAccount() { return { account: { id: 'synthetic' } }; }
  async threadStart() { return { thread: { id: 'thread' } }; }
  async turnStart() {
    const finish = () => {
      this.emit('item/agentMessage/delta', { delta: 'Synthetic completed result' });
      this.emit('turn/completed', { turn: { id: 'turn', status: 'completed', error: null } });
    };
    if (scenario === 'before-response') finish(); else setImmediate(finish);
    return { turn: { id: 'turn' } };
  }
  async turnInterrupt() { this.interrupted = true; }
  sendApprovalResponse() {}
  dispose() { this.disposed = true; }
}
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith('/flows/nodes/CodexNodeExecutor.ts')) {
    if (request === '../../codex') return { CodexAppServer: FakeAppServer };
    if (request === '../../features/featureGate') return { isEnabled: () => true };
  }
  return originalLoad.call(this, request, parent, isMain);
};
global.setTimeout = function(fn, ms, ...args) {
  return originalTimeout(fn, ms === 60000 ? 20 : ms, ...args);
};
async function main() {
  try {
    const { executeCodexNode } = require('../../../../../extensions/ritemark/src/flows/nodes/CodexNodeExecutor.ts');
    const trials = [];
    for (scenario of ['after-response', 'before-response']) {
      const result = await executeCodexNode({ id: 'synthetic', data: { prompt: 'Synthetic audit prompt', model: '', timeout: 1 } }, { workspacePath: '/synthetic', inputs: {}, outputs: new Map(), inputLabels: new Map(), nodeLabels: new Map() });
      trials.push({ eventOrder: scenario, result, disposed: lastServer.disposed, interrupted: lastServer.interrupted });
    }
    const report = { method: 'Actual CodexNodeExecutor, fake EventEmitter transport, synthetic successful completion delivered before/after awaited turnStart response. The 60-second timeout is accelerated to 20 ms. This tests ordering tolerance, not an observation of native protocol ordering.', trials };
    await fs.writeFile(path.join(__dirname, 'flow-lifecycle-probe.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { Module._load = originalLoad; global.setTimeout = originalTimeout; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
