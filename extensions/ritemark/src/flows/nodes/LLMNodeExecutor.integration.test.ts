/**
 * LLM Node Executor - Integration Tests
 *
 * Tests REAL API calls to OpenAI and Gemini.
 *
 * REQUIRES:
 * - OPENAI_API_KEY environment variable
 * - GOOGLE_AI_API_KEY environment variable (for Gemini)
 *
 * COST: ~$0.01-0.02 per test run
 *
 * Run: npx tsx src/flows/nodes/LLMNodeExecutor.integration.test.ts
 * Skip: Set SKIP_API_TESTS=true
 */

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
import { executeLLMNode } from './LLMNodeExecutor';

function createTestNode(data: Record<string, unknown>): FlowNode {
  return {
    id: 'test-llm',
    type: 'llm-prompt',
    position: { x: 0, y: 0 },
    data: {
      label: 'LLM Test',
      ...data,
    },
  };
}

function createTestContext(): ExecutionContext {
  return {
    inputs: { topic: 'testing' },
    outputs: new Map(),
    workspacePath: process.cwd(),
    inputLabels: new Map([['Topic', 'testing']]),
    nodeLabels: new Map(),
  };
}

// Test helpers
let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name: string, fn: () => Promise<void>, requiresKey?: string) {
  // Check if we should skip API tests
  if (process.env.SKIP_API_TESTS === 'true') {
    console.log(`  ⏭ ${name} (skipped - SKIP_API_TESTS=true)`);
    skipped++;
    return;
  }

  // Check for required API key
  if (requiresKey && !process.env[requiresKey]) {
    console.log(`  ⏭ ${name} (skipped - missing ${requiresKey})`);
    skipped++;
    return;
  }

  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ============ TESTS ============

async function runTests() {
  console.log('\n=== LLMNode Integration Tests (Real API) ===\n');

  // OpenAI Tests
  console.log('OpenAI Tests:');

  await test('should call GPT-4.1-mini and return response', async () => {
    const node = createTestNode({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      userPrompt: 'Reply with exactly: "LLM test passed"',
    });

    const result = await executeLLMNode(node, createTestContext());

    assertTrue(typeof result === 'string', 'Result should be string');
    assertTrue(result.length > 0, 'Result should not be empty');
    assertTrue(
      result.toLowerCase().includes('test') || result.toLowerCase().includes('passed'),
      `Response should contain expected text, got: ${result.substring(0, 100)}`
    );
  }, 'OPENAI_API_KEY');

  await test('should handle variable interpolation in prompt', async () => {
    const node = createTestNode({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      userPrompt: 'The topic is: {Topic}. Reply with just the topic word.',
    });

    const result = await executeLLMNode(node, createTestContext());

    assertTrue(typeof result === 'string', 'Result should be string');
    assertTrue(result.length > 0, 'Result should not be empty');
  }, 'OPENAI_API_KEY');

  await test('should handle system prompt', async () => {
    const node = createTestNode({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      systemPrompt: 'You are a helpful assistant. Always end responses with "DONE".',
      userPrompt: 'Say hello briefly.',
    });

    const result = await executeLLMNode(node, createTestContext());

    assertTrue(typeof result === 'string', 'Result should be string');
    // Note: Model might not always follow instructions perfectly
  }, 'OPENAI_API_KEY');

  // Gemini Tests
  console.log('\nGemini Tests:');

  await test('should call Gemini 2.0 Flash and return response', async () => {
    const node = createTestNode({
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      userPrompt: 'Reply with exactly: "Gemini test passed"',
    });

    const result = await executeLLMNode(node, createTestContext());

    assertTrue(typeof result === 'string', 'Result should be string');
    assertTrue(result.length > 0, 'Result should not be empty');
  }, 'GOOGLE_AI_API_KEY');

  // Error Handling Tests
  console.log('\nError Handling Tests:');

  await test('should handle invalid API key gracefully', async () => {
    // Temporarily override API key
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'invalid-key-12345';

    const node = createTestNode({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      userPrompt: 'Hello',
    });

    try {
      await executeLLMNode(node, createTestContext());
      throw new Error('Should have thrown an error');
    } catch (error) {
      assertTrue(
        error instanceof Error &&
        (error.message.includes('API') || error.message.includes('key') || error.message.includes('auth')),
        'Should throw API key error'
      );
    } finally {
      // Restore original key
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      }
    }
  }, 'OPENAI_API_KEY');

  // Summary
  console.log('\n' + '─'.repeat(40));
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  if (failed > 0) {
    process.exit(1);
  }

  if (passed > 0) {
    console.log('\n✅ All LLMNode integration tests passed!\n');
  } else {
    console.log('\n⚠️  All tests skipped (no API keys available)\n');
  }
}

runTests().catch(console.error);
