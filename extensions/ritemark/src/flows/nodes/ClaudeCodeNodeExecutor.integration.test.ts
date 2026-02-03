/**
 * Claude Code Node Executor - Integration Tests
 *
 * Tests REAL Claude Code SDK calls.
 *
 * REQUIRES:
 * - Claude Code authenticated (run `claude` in terminal first)
 *
 * COST: ~$0.05-0.10 per test run (Claude Code API calls)
 *
 * Run: npx tsx src/flows/nodes/ClaudeCodeNodeExecutor.integration.test.ts
 * Skip: Set SKIP_API_TESTS=true
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
import { executeClaudeCodeNode } from './ClaudeCodeNodeExecutor';

function createTestNode(data: Record<string, unknown>): FlowNode {
  return {
    id: 'test-claude-code',
    type: 'claude-code',
    position: { x: 0, y: 0 },
    data: {
      label: 'Claude Code Test',
      timeout: 2, // 2 minutes max
      ...data,
    },
  };
}

function createTestContext(workspacePath: string): ExecutionContext {
  return {
    inputs: { filename: 'test-output.txt' },
    outputs: new Map(),
    workspacePath,
    inputLabels: new Map([['Filename', 'test-output.txt']]),
    nodeLabels: new Map(),
  };
}

// Test helpers
let tempDir: string;
let passed = 0;
let failed = 0;
let skipped = 0;

function beforeEach() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-code-test-'));
}

function afterEach() {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function test(name: string, fn: () => Promise<void>, timeoutMs = 120000) {
  // Check if we should skip API tests
  if (process.env.SKIP_API_TESTS === 'true') {
    console.log(`  ⏭ ${name} (skipped - SKIP_API_TESTS=true)`);
    skipped++;
    return;
  }

  beforeEach();
  try {
    // Add timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Test timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    await Promise.race([fn(), timeoutPromise]);
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

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ============ TESTS ============

async function runTests() {
  console.log('\n=== ClaudeCodeNode Integration Tests (Real SDK) ===\n');
  console.log('Note: These tests require Claude Code authentication.\n');

  await test('should execute simple prompt and return result', async () => {
    const node = createTestNode({
      prompt: 'Reply with exactly the text "Claude Code integration test passed" and nothing else. Do not use any tools.',
    });

    const result = await executeClaudeCodeNode(node, createTestContext(tempDir));

    assertTrue(typeof result.text === 'string', 'Result should have text');
    assertTrue(!result.error, `Should not have error: ${result.error}`);
    assertTrue(
      result.text.toLowerCase().includes('test') || result.text.toLowerCase().includes('passed') || result.text.toLowerCase().includes('claude'),
      `Response should contain expected text, got: ${result.text.substring(0, 200)}`
    );
  }, 60000);

  await test('should create a file when asked', async () => {
    const testFile = path.join(tempDir, 'created-by-claude.txt');

    const node = createTestNode({
      prompt: `Create a file at ${testFile} with the content "Hello from Claude Code". Use the Write tool.`,
    });

    const result = await executeClaudeCodeNode(node, createTestContext(tempDir));

    assertTrue(!result.error, `Should not have error: ${result.error}`);

    // Check if file was created
    assertTrue(fs.existsSync(testFile), 'File should be created');

    const content = fs.readFileSync(testFile, 'utf-8');
    assertTrue(content.includes('Hello') || content.includes('Claude'), 'File should have expected content');

    // Check files array
    assertTrue(Array.isArray(result.files), 'Result should have files array');
  }, 90000);

  await test('should handle variable interpolation', async () => {
    const node = createTestNode({
      prompt: 'The filename input is: {Filename}. Just confirm you received this value by saying it back.',
    });

    const result = await executeClaudeCodeNode(node, createTestContext(tempDir));

    assertTrue(!result.error, `Should not have error: ${result.error}`);
    assertTrue(result.text.length > 0, 'Should have response text');
  }, 60000);

  await test('should respect timeout', async () => {
    const node = createTestNode({
      prompt: 'This is a simple test that should complete quickly. Just say "done".',
      timeout: 1, // 1 minute
    });

    const startTime = Date.now();
    const result = await executeClaudeCodeNode(node, createTestContext(tempDir));
    const elapsed = Date.now() - startTime;

    assertTrue(!result.error, `Should not have error: ${result.error}`);
    assertTrue(elapsed < 60000, 'Should complete within timeout');
  }, 90000);

  await test('should report progress via callback', async () => {
    const progressMessages: Array<{ type: string; message: string }> = [];

    const node = createTestNode({
      prompt: 'Read the current directory using the Bash tool with "ls -la".',
    });

    const onProgress = (progress: { type: string; message: string }) => {
      progressMessages.push(progress);
    };

    const result = await executeClaudeCodeNode(
      node,
      createTestContext(tempDir),
      undefined,
      onProgress
    );

    assertTrue(!result.error, `Should not have error: ${result.error}`);
    assertTrue(progressMessages.length > 0, 'Should have received progress messages');

    // Should have init message
    const hasInit = progressMessages.some(p => p.type === 'init');
    assertTrue(hasInit, 'Should have init progress message');
  }, 90000);

  await test('should handle errors gracefully', async () => {
    const node = createTestNode({
      prompt: '', // Empty prompt should fail
    });

    try {
      await executeClaudeCodeNode(node, createTestContext(tempDir));
      throw new Error('Should have thrown an error');
    } catch (error) {
      assertTrue(
        error instanceof Error && error.message.includes('prompt'),
        'Should throw error about missing prompt'
      );
    }
  }, 10000);

  // Summary
  console.log('\n' + '─'.repeat(40));
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  if (failed > 0) {
    process.exit(1);
  }

  if (passed > 0) {
    console.log('\n✅ All ClaudeCodeNode integration tests passed!\n');
  } else {
    console.log('\n⚠️  All tests skipped\n');
  }
}

runTests().catch(console.error);
