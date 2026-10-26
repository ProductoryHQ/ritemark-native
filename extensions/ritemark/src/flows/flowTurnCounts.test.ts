/**
 * Sprint 139 (R7, S41): a Flow's Claude and ChatGPT steps count as agent_used, source flow.
 *
 * Run: npx tsx src/flows/flowTurnCounts.test.ts
 */

import assert from 'node:assert/strict';
import { countedAgentStep } from './flowTurnCounts';

async function run(): Promise<void> {
  const counted: Array<{ key: string; runtimeId: string; source: string; outcome: string }> = [];
  const count = (key: string, runtimeId: string, source: string, outcome: string) => { counted.push({ key, runtimeId, source, outcome }); };

  // A step that answers.
  assert.deepEqual(await countedAgentStep('claude-code', undefined, async () => ({ text: 'Done', files: [] }), count), { text: 'Done', files: [] });
  // A step that ends with its error in the result (ChatGPT's timeout), and one that throws a refused model.
  await countedAgentStep('codex', undefined, async () => ({ text: '', error: 'ChatGPT timed out after 5 minutes' }), count);
  await assert.rejects(
    countedAgentStep('codex', undefined, async () => { throw new Error('{"type":"error","status":400,"error":{"message":"The \'gpt-x\' model is not supported when using Codex with a ChatGPT account."}}'); }, count),
  );
  // A stopped Flow.
  const stop = new AbortController();
  stop.abort();
  await assert.rejects(countedAgentStep('claude-code', stop.signal, async () => { throw new Error('Execution cancelled'); }, count));

  assert.deepEqual(counted.map(({ runtimeId, source, outcome }) => ({ runtimeId, source, outcome })), [
    { runtimeId: 'claude-code', source: 'flow', outcome: 'arrived' },
    { runtimeId: 'codex', source: 'flow', outcome: 'provider_error' },
    { runtimeId: 'codex', source: 'flow', outcome: 'model' },
    { runtimeId: 'claude-code', source: 'flow', outcome: 'stopped' },
  ]);
  assert.ok(counted.every((entry) => entry.key.startsWith('flow:')), 'each step is its own turn');
  assert.equal(new Set(counted.map((entry) => entry.key)).size, counted.length);

  console.log('flowTurnCounts.test.ts: all tests passed');
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
