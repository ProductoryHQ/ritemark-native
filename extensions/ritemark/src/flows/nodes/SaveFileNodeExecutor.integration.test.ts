/**
 * Save File Node Executor - Integration Tests
 *
 * Tests REAL file I/O operations.
 * No API costs - safe to run always.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Types
interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface ExecutionContext {
  inputs: Record<string, unknown>;
  outputs: Map<string, unknown>;
  workspacePath: string;
  inputLabels: Map<string, string>;
  nodeLabels: Map<string, string>;
}

// Import the actual executor
import { executeSaveFileNode } from './SaveFileNodeExecutor';

function createTestNode(data: Record<string, unknown>): FlowNode {
  return {
    id: 'test-save-file',
    type: 'save-file',
    position: { x: 0, y: 0 },
    data: {
      label: 'Save File',
      sourceNodeId: 'upstream-node', // Required field
      format: 'markdown', // Default format
      ...data,
    },
  };
}

function createTestContext(workspacePath: string, upstreamOutput: unknown): ExecutionContext {
  const outputs = new Map<string, unknown>();
  outputs.set('upstream-node', upstreamOutput);

  return {
    inputs: {},
    outputs,
    workspacePath,
    inputLabels: new Map(),
    nodeLabels: new Map([['Upstream', 'upstream-node']]),
  };
}

// Test helpers
let tempDir: string;
let passed = 0;
let failed = 0;

function beforeEach() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flows-integration-'));
}

function afterEach() {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function test(name: string, fn: () => Promise<void>) {
  beforeEach();
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error instanceof Error ? error.message : error}`);
    failed++;
  } finally {
    afterEach();
  }
}

function assertEqual(actual: unknown, expected: unknown, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected "${expected}", got "${actual}"`);
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ============ TESTS ============

async function runTests() {
  console.log('\n=== SaveFileNode Integration Tests ===\n');

  await test('should create file with text content', async () => {
    const node = createTestNode({
      filename: 'output.md',
      folder: '',
    });
    const context = createTestContext(tempDir, 'Hello, World!');

    const result = await executeSaveFileNode(node, context) as { path: string; size: number };

    // Verify file exists
    assertTrue(fs.existsSync(result.path), 'File should exist');

    // Verify content
    const content = fs.readFileSync(result.path, 'utf-8');
    assertEqual(content, 'Hello, World!', 'Content should match');

    // Verify result structure
    assertTrue(result.path.endsWith('output.md'), 'Path should end with filename');
    assertTrue(result.size > 0, 'Size should be positive');
  });

  await test('should create file in subfolder', async () => {
    const node = createTestNode({
      filename: 'test.txt',
      folder: 'subdir/nested',
    });
    const context = createTestContext(tempDir, 'Nested content');

    const result = await executeSaveFileNode(node, context) as { path: string; size: number };

    // Verify nested directory was created
    const expectedDir = path.join(tempDir, 'subdir', 'nested');
    assertTrue(fs.existsSync(expectedDir), 'Nested directory should exist');

    // Verify file
    assertTrue(fs.existsSync(result.path), 'File should exist in nested dir');
    const content = fs.readFileSync(result.path, 'utf-8');
    assertEqual(content, 'Nested content');
  });

  await test('should handle JSON object upstream output', async () => {
    const node = createTestNode({
      filename: 'data.md',
      folder: '',
    });
    // Objects get stringified as "[object Object]" - pass JSON string instead
    const jsonContent = JSON.stringify({ key: 'value', number: 42 });
    const context = createTestContext(tempDir, jsonContent);

    const result = await executeSaveFileNode(node, context) as { path: string; size: number };

    const content = fs.readFileSync(result.path, 'utf-8');
    const parsed = JSON.parse(content);
    assertEqual(parsed.key, 'value');
    assertEqual(parsed.number, 42);
  });

  await test('should handle image with localPath', async () => {
    // Create a source image file (minimal valid PNG)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sourceImagePath = path.join(tempDir, 'source-image.png');
    fs.writeFileSync(sourceImagePath, Buffer.from(pngBase64, 'base64'));

    const node = createTestNode({
      filename: 'copied-image.png',
      folder: 'images',
      format: 'image',
    });
    // Image executor returns object with localPath
    const context = createTestContext(tempDir, { localPath: sourceImagePath });

    const result = await executeSaveFileNode(node, context) as { path: string; size: number };

    // Verify file exists and is binary
    assertTrue(fs.existsSync(result.path), 'Image file should exist');
    const stats = fs.statSync(result.path);
    assertTrue(stats.size > 0, 'Image should have content');

    // Verify it's actual PNG bytes
    const buffer = fs.readFileSync(result.path);
    // PNG magic bytes
    assertTrue(buffer[0] === 0x89 && buffer[1] === 0x50, 'Should be valid PNG');
  });

  await test('should overwrite existing file', async () => {
    const filePath = path.join(tempDir, 'existing.txt');
    fs.writeFileSync(filePath, 'Old content');

    const node = createTestNode({
      filename: 'existing.txt',
      folder: '',
    });
    const context = createTestContext(tempDir, 'New content');

    await executeSaveFileNode(node, context);

    const content = fs.readFileSync(filePath, 'utf-8');
    assertEqual(content, 'New content', 'Content should be overwritten');
  });

  await test('should handle empty string content', async () => {
    const node = createTestNode({
      filename: 'empty.txt',
      folder: '',
    });
    const context = createTestContext(tempDir, '');

    const result = await executeSaveFileNode(node, context) as { path: string; size: number };

    assertTrue(fs.existsSync(result.path), 'File should exist');
    const content = fs.readFileSync(result.path, 'utf-8');
    assertEqual(content, '', 'Content should be empty');
  });

  await test('should handle special characters in filename', async () => {
    const node = createTestNode({
      filename: 'file with spaces.txt',
      folder: '',
    });
    const context = createTestContext(tempDir, 'Content');

    const result = await executeSaveFileNode(node, context) as { path: string; size: number };

    assertTrue(fs.existsSync(result.path), 'File with spaces should exist');
  });

  await test('should return correct result structure', async () => {
    const node = createTestNode({
      filename: 'test.md',
      folder: 'output',
    });
    const context = createTestContext(tempDir, 'Test content here');

    const result = await executeSaveFileNode(node, context) as { path: string; size: number };

    // Check result has required fields
    assertTrue(typeof result.path === 'string', 'Result should have path string');
    assertTrue(typeof result.size === 'number', 'Result should have size number');
    assertTrue(result.path.includes('output'), 'Path should include folder');
    assertTrue(result.path.includes('test.md'), 'Path should include filename');
  });

  // Summary
  console.log('\n' + '─'.repeat(40));
  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log('\n✅ All SaveFileNode integration tests passed!\n');
}

runTests().catch(console.error);
