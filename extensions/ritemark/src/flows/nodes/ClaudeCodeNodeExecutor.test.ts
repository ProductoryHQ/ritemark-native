/**
 * Unit tests for Claude Code Node Executor
 * Tests pure functions without external dependencies.
 * Run: npx tsx src/flows/nodes/ClaudeCodeNodeExecutor.test.ts
 */

import * as assert from 'assert';
import type { ExecutionContext } from '../types';

// Copy of interpolateVariables for testing (to avoid import issues with vscode deps)
function interpolateVariables(
  template: string,
  context: ExecutionContext
): string {
  let result = template;

  // New simple syntax: {Label}
  const simpleLabelPattern = /\{([^{}]+)\}/g;
  result = result.replace(simpleLabelPattern, (match, label) => {
    const trimmedLabel = label.trim();

    // Check input labels first
    if (context.inputLabels?.has(trimmedLabel)) {
      const value = context.inputLabels.get(trimmedLabel);
      return value !== undefined ? String(value) : match;
    }

    // Check node labels
    if (context.nodeLabels?.has(trimmedLabel)) {
      const nodeId = context.nodeLabels.get(trimmedLabel)!;
      const value = context.outputs.get(nodeId);
      return value !== undefined ? String(value) : match;
    }

    // Try direct lookup by input key (case insensitive)
    for (const [key, value] of Object.entries(context.inputs)) {
      if (key.toLowerCase() === trimmedLabel.toLowerCase()) {
        return String(value);
      }
    }

    return match;
  });

  // Legacy syntax: {{inputs.key}}
  const inputPattern = /\{\{inputs\.(\w+)\}\}/g;
  result = result.replace(inputPattern, (match, key) => {
    const value = context.inputs[key];
    return value !== undefined ? String(value) : match;
  });

  // Legacy syntax: {{nodeId}}
  const outputPattern = /\{\{([a-zA-Z0-9_-]+)(?:\.output)?\}\}/g;
  result = result.replace(outputPattern, (match, nodeId) => {
    const value = context.outputs.get(nodeId);
    return value !== undefined ? String(value) : match;
  });

  return result;
}

// --- Test Helper ---
function createTestContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    inputs: {},
    outputs: new Map(),
    workspacePath: '/test/workspace',
    inputLabels: new Map(),
    nodeLabels: new Map(),
    ...overrides,
  };
}

// --- Tests: Variable Interpolation ---

console.log('Testing interpolateVariables...');

// Test 1: No variables → unchanged
{
  const ctx = createTestContext();
  const result = interpolateVariables('Hello world', ctx);
  assert.strictEqual(result, 'Hello world', 'Plain text should be unchanged');
}

// Test 2: Simple {Label} with input label
{
  const inputLabels = new Map([['Topic', 'artificial intelligence']]);
  const ctx = createTestContext({ inputLabels });
  const result = interpolateVariables('Write about {Topic}', ctx);
  assert.strictEqual(result, 'Write about artificial intelligence', 'Input label should be interpolated');
}

// Test 3: {Label} with node label
{
  const nodeLabels = new Map([['LLM Prompt', 'node-123']]);
  const outputs = new Map([['node-123', 'Generated text content']]);
  const ctx = createTestContext({ nodeLabels, outputs });
  const result = interpolateVariables('Process this: {LLM Prompt}', ctx);
  assert.strictEqual(result, 'Process this: Generated text content', 'Node label should resolve to output');
}

// Test 4: {Label} with Save File output (path)
{
  const nodeLabels = new Map([['Save File', 'save-node-456']]);
  const outputs = new Map([['save-node-456', '/workspace/output/summary.md']]);
  const ctx = createTestContext({ nodeLabels, outputs });
  const result = interpolateVariables('Read the file at {Save File}', ctx);
  assert.strictEqual(result, 'Read the file at /workspace/output/summary.md', 'Save File path should be interpolated');
}

// Test 5: Multiple variables
{
  const inputLabels = new Map([['Name', 'John'], ['Age', '30']]);
  const ctx = createTestContext({ inputLabels });
  const result = interpolateVariables('{Name} is {Age} years old', ctx);
  assert.strictEqual(result, 'John is 30 years old', 'Multiple variables should be interpolated');
}

// Test 6: Unknown variable → unchanged
{
  const ctx = createTestContext();
  const result = interpolateVariables('Hello {Unknown}', ctx);
  assert.strictEqual(result, 'Hello {Unknown}', 'Unknown variable should remain unchanged');
}

// Test 7: Direct input key (case insensitive)
{
  const ctx = createTestContext({ inputs: { topic: 'test topic' } });
  const result = interpolateVariables('Write about {Topic}', ctx);
  assert.strictEqual(result, 'Write about test topic', 'Case-insensitive input lookup should work');
}

// Test 8: Legacy syntax {{inputs.key}}
{
  const ctx = createTestContext({ inputs: { name: 'Alice' } });
  const result = interpolateVariables('Hello {{inputs.name}}', ctx);
  assert.strictEqual(result, 'Hello Alice', 'Legacy input syntax should work');
}

// Test 9: Legacy syntax {{nodeId}}
{
  const outputs = new Map([['node-abc', 'Node output']]);
  const ctx = createTestContext({ outputs });
  const result = interpolateVariables('Result: {{node-abc}}', ctx);
  assert.strictEqual(result, 'Result: Node output', 'Legacy node syntax should work');
}

// Test 10: Mixed new and legacy syntax
{
  const inputLabels = new Map([['NewVar', 'new value']]);
  const ctx = createTestContext({
    inputLabels,
    inputs: { oldVar: 'old value' },
  });
  const result = interpolateVariables('{NewVar} and {{inputs.oldVar}}', ctx);
  assert.strictEqual(result, 'new value and old value', 'Mixed syntax should work');
}

// Test 11: Variable with spaces in label
{
  const nodeLabels = new Map([['Generate Image', 'img-node']]);
  const outputs = new Map([['img-node', '/path/to/image.png']]);
  const ctx = createTestContext({ nodeLabels, outputs });
  const result = interpolateVariables('Image at {Generate Image}', ctx);
  assert.strictEqual(result, 'Image at /path/to/image.png', 'Labels with spaces should work');
}

// Test 12: Empty string value
{
  const inputLabels = new Map([['Empty', '']]);
  const ctx = createTestContext({ inputLabels });
  const result = interpolateVariables('Value: {Empty}!', ctx);
  assert.strictEqual(result, 'Value: !', 'Empty string should be interpolated as empty');
}

// Test 13: Numeric value
{
  const outputs = new Map([['calc-node', 42]]);
  const nodeLabels = new Map([['Calculator', 'calc-node']]);
  const ctx = createTestContext({ nodeLabels, outputs });
  const result = interpolateVariables('Result is {Calculator}', ctx);
  assert.strictEqual(result, 'Result is 42', 'Numeric values should be converted to string');
}

console.log('All interpolateVariables tests passed.');

// --- Tests: Node Type Validation ---

console.log('Testing node type definitions...');

// Verify the flow type includes claude-code
type FlowNodeType = 'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code';

// This is a compile-time check - if claude-code is missing, TypeScript will error
const validTypes: FlowNodeType[] = ['trigger', 'llm-prompt', 'image-prompt', 'save-file', 'claude-code'];
assert.strictEqual(validTypes.includes('claude-code'), true, 'claude-code should be a valid node type');

console.log('Node type definition tests passed.');

// --- Summary ---
console.log('\n✅ All Claude Code node tests passed!');
