/**
 * Unit tests for flow execution validation.
 * Run: npx tsx webview/src/components/flows/ExecutionPanel.test.ts
 */

import * as assert from 'assert';
import type { Flow } from './stores/flowEditorStore';
import { validateFlowForExecution } from './executionValidation';

function createFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: 'test-flow',
    name: 'Test Flow',
    description: '',
    version: 1,
    created: '2026-03-29T13:00:00.000Z',
    modified: '2026-03-29T13:00:00.000Z',
    inputs: [],
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: { label: 'Trigger', inputs: [] },
      },
    ],
    edges: [],
    ...overrides,
  };
}

console.log('Testing flow execution validation...');

assert.deepStrictEqual(validateFlowForExecution(createFlow({ nodes: [], edges: [] })), [
  'Flow has no nodes',
]);
console.log('  ✓ Empty flow is rejected');

assert.deepStrictEqual(validateFlowForExecution(createFlow()), [
  'Flow only has a Trigger node - add more nodes to process',
  'Flow needs at least one node after Trigger',
]);
console.log('  ✓ Trigger-only flow is rejected');

assert.deepStrictEqual(
  validateFlowForExecution(
    createFlow({
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { label: 'Trigger', inputs: [] },
        },
        {
          id: 'codex-1',
          type: 'codex',
          position: { x: 0, y: 200 },
          data: { label: 'Codex', prompt: 'Create file', model: '', timeout: 5 },
        },
      ],
      edges: [{ id: 'edge-1', source: 'trigger-1', target: 'codex-1' }],
    })
  ),
  []
);
console.log('  ✓ Trigger + Codex flow is allowed');

console.log('\n✅ All execution validation tests passed!');
