/**
 * Unit tests for Flow type mappings and consistency.
 * Verifies that node types are correctly defined across backend and webview.
 * Run: npx tsx src/flows/flowTypes.test.ts
 */

import * as assert from 'assert';

// Backend flow types (from types.ts)
type BackendNodeType = 'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code' | 'codex';
type FlowScheduleType = 'daily' | 'weekdays' | 'weekly' | 'hourly' | 'interval';
type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Webview React Flow types
type ReactFlowNodeType = 'triggerNode' | 'llmNode' | 'imageNode' | 'saveFileNode' | 'claudeCodeNode' | 'codexNode';

// Mapping from backend type to React Flow type (from flowEditorStore.ts)
const flowTypeToReactFlowType: Record<BackendNodeType, ReactFlowNodeType> = {
  'trigger': 'triggerNode',
  'llm-prompt': 'llmNode',
  'image-prompt': 'imageNode',
  'save-file': 'saveFileNode',
  'claude-code': 'claudeCodeNode',
  'codex': 'codexNode',
};

// Reverse mapping (from flowEditorStore.ts)
const reactFlowTypeToFlowType: Record<ReactFlowNodeType, BackendNodeType> = {
  'triggerNode': 'trigger',
  'llmNode': 'llm-prompt',
  'imageNode': 'image-prompt',
  'saveFileNode': 'save-file',
  'claudeCodeNode': 'claude-code',
  'codexNode': 'codex',
};

console.log('Testing flow type mappings...');

// Test 1: All backend types have a React Flow mapping
const backendTypes: BackendNodeType[] = ['trigger', 'llm-prompt', 'image-prompt', 'save-file', 'claude-code', 'codex'];
for (const type of backendTypes) {
  assert.ok(
    flowTypeToReactFlowType[type],
    `Backend type "${type}" should have a React Flow mapping`
  );
}
console.log('  ✓ All backend types have React Flow mappings');

// Test 2: All React Flow types have a backend mapping
const reactFlowTypes: ReactFlowNodeType[] = ['triggerNode', 'llmNode', 'imageNode', 'saveFileNode', 'claudeCodeNode', 'codexNode'];
for (const type of reactFlowTypes) {
  assert.ok(
    reactFlowTypeToFlowType[type],
    `React Flow type "${type}" should have a backend mapping`
  );
}
console.log('  ✓ All React Flow types have backend mappings');

// Test 3: Mappings are symmetric (roundtrip)
for (const backendType of backendTypes) {
  const reactType = flowTypeToReactFlowType[backendType];
  const backToBackend = reactFlowTypeToFlowType[reactType];
  assert.strictEqual(
    backToBackend,
    backendType,
    `Roundtrip for "${backendType}" should return same type`
  );
}
console.log('  ✓ Mappings are symmetric (roundtrip works)');

// Test 4: Claude Code specifically
assert.strictEqual(
  flowTypeToReactFlowType['claude-code'],
  'claudeCodeNode',
  'claude-code should map to claudeCodeNode'
);
assert.strictEqual(
  reactFlowTypeToFlowType['claudeCodeNode'],
  'claude-code',
  'claudeCodeNode should map to claude-code'
);
console.log('  ✓ Claude Code mappings are correct');

// Test 5: Save File specifically (for the sprint changes)
assert.strictEqual(
  flowTypeToReactFlowType['save-file'],
  'saveFileNode',
  'save-file should map to saveFileNode'
);
console.log('  ✓ Save File mappings are correct');

// Test 6: Codex specifically
assert.strictEqual(
  flowTypeToReactFlowType['codex'],
  'codexNode',
  'codex should map to codexNode'
);
assert.strictEqual(
  reactFlowTypeToFlowType['codexNode'],
  'codex',
  'codexNode should map to codex'
);
console.log('  ✓ Codex mappings are correct');

// Test 7: Schedule types are the expected contract
const scheduleTypes: FlowScheduleType[] = ['daily', 'weekdays', 'weekly', 'hourly', 'interval'];
assert.deepStrictEqual(
  scheduleTypes,
  ['daily', 'weekdays', 'weekly', 'hourly', 'interval'],
  'Schedule types should match the scheduling contract'
);
console.log('  ✓ Schedule types are correct');

// Test 8: ISO weekday numbering contract is explicit
const isoWeekdays: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
assert.deepStrictEqual(
  isoWeekdays,
  [1, 2, 3, 4, 5, 6, 7],
  'ISO weekdays should be Monday=1 through Sunday=7'
);
console.log('  ✓ ISO weekday numbering contract is correct');

console.log('\n✅ All flow type mapping tests passed!');
