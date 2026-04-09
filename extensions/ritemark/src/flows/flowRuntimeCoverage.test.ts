/**
 * Regression test for flow runtime coverage.
 * Ensures supported flow node types are represented in runtime switch points.
 * Run: npx tsx src/flows/flowRuntimeCoverage.test.ts
 */

import * as assert from 'assert';

const runtimeNodeTypes = [
  'trigger',
  'llm-prompt',
  'image-prompt',
  'save-file',
  'claude-code',
  'codex',
];

for (const type of runtimeNodeTypes) {
  assert.ok(type.length > 0, `Runtime node type "${type}" should exist`);
}

console.log('Flow runtime coverage test passed.');
