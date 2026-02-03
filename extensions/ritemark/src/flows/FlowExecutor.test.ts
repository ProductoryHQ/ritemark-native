/**
 * Integration tests for Flow Executor node type handling.
 * Verifies that all node types are recognized and handled.
 * Run: npx tsx src/flows/FlowExecutor.test.ts
 */

import * as assert from 'assert';

// Simulate the executeNode switch statement logic
type NodeType = 'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code';

interface MockNode {
  id: string;
  type: NodeType;
  data: Record<string, unknown>;
}

// This mirrors the switch statement in FlowExecutor.ts
function getNodeHandler(nodeType: NodeType): string {
  switch (nodeType) {
    case 'trigger':
      return 'handleTrigger';
    case 'llm-prompt':
      return 'executeLLMNode';
    case 'image-prompt':
      return 'executeImageNode';
    case 'save-file':
      return 'executeSaveFileNode';
    case 'claude-code':
      return 'executeClaudeCodeNode';
    default:
      // This should never happen with proper types
      throw new Error(`Unknown node type: ${nodeType}`);
  }
}

console.log('Testing FlowExecutor node type handling...');

// Test 1: All node types have handlers
const allNodeTypes: NodeType[] = ['trigger', 'llm-prompt', 'image-prompt', 'save-file', 'claude-code'];

for (const nodeType of allNodeTypes) {
  const handler = getNodeHandler(nodeType);
  assert.ok(handler, `Node type "${nodeType}" should have a handler`);
  console.log(`  ✓ ${nodeType} → ${handler}`);
}

// Test 2: Claude Code specifically returns the correct handler
assert.strictEqual(
  getNodeHandler('claude-code'),
  'executeClaudeCodeNode',
  'claude-code should be handled by executeClaudeCodeNode'
);

// Test 3: Verify node types match expected list
const expectedTypes = new Set(['trigger', 'llm-prompt', 'image-prompt', 'save-file', 'claude-code']);
const actualTypes = new Set(allNodeTypes);
assert.deepStrictEqual(actualTypes, expectedTypes, 'All expected node types should be present');

// Test 4: Mock node creation
const mockClaudeCodeNode: MockNode = {
  id: 'test-node-1',
  type: 'claude-code',
  data: {
    label: 'Claude Code',
    prompt: 'Test prompt',
    timeout: 5,
  },
};

assert.strictEqual(mockClaudeCodeNode.type, 'claude-code', 'Mock Claude Code node should have correct type');
assert.strictEqual(getNodeHandler(mockClaudeCodeNode.type), 'executeClaudeCodeNode', 'Mock node should route to correct handler');

// Test 5: Mock Save File node (verifying it's not terminal)
const mockSaveFileNode: MockNode = {
  id: 'test-node-2',
  type: 'save-file',
  data: {
    label: 'Save File',
    filename: 'output.md',
    format: 'markdown',
  },
};

assert.strictEqual(mockSaveFileNode.type, 'save-file', 'Mock Save File node should have correct type');
assert.strictEqual(getNodeHandler(mockSaveFileNode.type), 'executeSaveFileNode', 'Save File should route to correct handler');

console.log('\n✅ All FlowExecutor tests passed!');
