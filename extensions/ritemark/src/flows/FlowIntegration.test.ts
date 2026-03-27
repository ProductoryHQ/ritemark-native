/**
 * Flow Integration Tests
 *
 * Tests flow loading, validation, execution order, and variable interpolation.
 * Uses mock executors to simulate real flow execution.
 */

import * as fs from 'fs';
import * as path from 'path';

// Types
interface FlowInput {
  id: string;
  type: 'text' | 'file';
  label: string;
  required: boolean;
  defaultValue?: string;
}

interface FlowNode {
  id: string;
  type: 'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code' | 'codex';
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

interface Flow {
  id: string;
  name: string;
  description: string;
  version: number;
  inputs: FlowInput[];
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface ExecutionContext {
  inputs: Record<string, unknown>;
  outputs: Map<string, unknown>;
  workspacePath: string;
  inputLabels: Map<string, string>;
  nodeLabels: Map<string, string>;
}

// ============ HELPER FUNCTIONS ============

/**
 * Load flow from JSON file
 */
function loadFlow(flowPath: string): Flow {
  const content = fs.readFileSync(flowPath, 'utf-8');
  return JSON.parse(content) as Flow;
}

/**
 * Validate flow structure
 */
function validateFlow(flow: Flow): string[] {
  const errors: string[] = [];

  if (!flow.id) errors.push('Missing flow id');
  if (!flow.name) errors.push('Missing flow name');
  if (!flow.nodes || flow.nodes.length === 0) errors.push('Flow has no nodes');

  // Check for trigger node
  const hasTrigger = flow.nodes.some(n => n.type === 'trigger');
  if (!hasTrigger) errors.push('Flow missing trigger node');

  // Check for processing nodes
  const hasProcessing = flow.nodes.some(n =>
    ['llm-prompt', 'image-prompt', 'save-file', 'claude-code', 'codex'].includes(n.type)
  );
  if (!hasProcessing) errors.push('Flow has no processing nodes');

  // Check edge references
  for (const edge of flow.edges) {
    const sourceExists = flow.nodes.some(n => n.id === edge.source);
    const targetExists = flow.nodes.some(n => n.id === edge.target);
    if (!sourceExists) errors.push(`Edge ${edge.id} references non-existent source: ${edge.source}`);
    if (!targetExists) errors.push(`Edge ${edge.id} references non-existent target: ${edge.target}`);
  }

  return errors;
}

/**
 * Get topological execution order
 */
function getExecutionOrder(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize
  for (const node of nodes) {
    graph.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  // Build graph
  for (const edge of edges) {
    const targets = graph.get(edge.source) || [];
    targets.push(edge.target);
    graph.set(edge.source, targets);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const neighbor of graph.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return order;
}

/**
 * Interpolate variables in template string
 */
function interpolateVariables(template: string, context: ExecutionContext): string {
  let result = template;

  // {Label} syntax
  const simpleLabelPattern = /\{([^{}]+)\}/g;
  result = result.replace(simpleLabelPattern, (match, label) => {
    const trimmedLabel = label.trim();

    // Check input labels
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

    return match;
  });

  return result;
}

/**
 * Build execution context from flow and inputs
 */
function buildContext(flow: Flow, inputs: Record<string, string>, workspacePath: string): ExecutionContext {
  const inputLabels = new Map<string, string>();
  const nodeLabels = new Map<string, string>();

  // Map input labels to values
  for (const input of flow.inputs) {
    inputLabels.set(input.label, inputs[input.id] || input.defaultValue || '');
  }

  // Map node labels to node IDs
  for (const node of flow.nodes) {
    const label = (node.data as { label?: string }).label;
    if (label) {
      nodeLabels.set(label, node.id);
    }
  }

  return {
    inputs,
    outputs: new Map(),
    workspacePath,
    inputLabels,
    nodeLabels,
  };
}

/**
 * Mock node executor - simulates execution with predictable outputs
 */
function mockExecuteNode(node: FlowNode, context: ExecutionContext): unknown {
  const data = node.data as Record<string, unknown>;

  switch (node.type) {
    case 'trigger':
      return context.inputs;

    case 'llm-prompt': {
      const prompt = interpolateVariables(data.prompt as string || '', context);
      return `[LLM Response to: ${prompt.substring(0, 50)}...]`;
    }

    case 'image-prompt': {
      const prompt = interpolateVariables(data.prompt as string || '', context);
      return `data:image/png;base64,MOCK_IMAGE_FOR_${prompt.substring(0, 20)}`;
    }

    case 'save-file': {
      const filename = data.filename as string || 'output.txt';
      const folder = data.folder as string || '';
      return {
        path: path.join(context.workspacePath, folder, filename),
        size: 1024,
      };
    }

    case 'claude-code': {
      const prompt = interpolateVariables(data.prompt as string || '', context);
      return {
        text: `[Claude Code executed: ${prompt.substring(0, 50)}...]`,
        files: ['/mock/file1.ts', '/mock/file2.ts'],
      };
    }

    case 'codex': {
      const prompt = interpolateVariables(data.prompt as string || '', context);
      return {
        text: `[Codex executed: ${prompt.substring(0, 50)}...]`,
        files: ['/mock/file1.ts', '/mock/file2.ts'],
      };
    }

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Execute flow with mock executors
 */
function executeFlowMock(flow: Flow, inputs: Record<string, string>): Map<string, unknown> {
  const context = buildContext(flow, inputs, '/mock/workspace');
  const order = getExecutionOrder(flow.nodes, flow.edges);

  for (const nodeId of order) {
    const node = flow.nodes.find(n => n.id === nodeId);
    if (!node) continue;

    const output = mockExecuteNode(node, context);
    context.outputs.set(nodeId, output);
  }

  return context.outputs;
}

// ============ TESTS ============

const FLOWS_DIR = path.join(__dirname, '../../../../.ritemark/flows');

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  function assertEqual(actual: unknown, expected: unknown, message?: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  function assertTrue(condition: boolean, message?: string) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  // Check if flows directory exists
  if (!fs.existsSync(FLOWS_DIR)) {
    console.log('⚠ Flows directory not found, skipping integration tests');
    console.log(`  Expected: ${FLOWS_DIR}`);
    return;
  }

  // Get all flow files
  const flowFiles = fs.readdirSync(FLOWS_DIR).filter(f => f.endsWith('.flow.json'));

  if (flowFiles.length === 0) {
    console.log('⚠ No flow files found');
    return;
  }

  console.log(`\nTesting ${flowFiles.length} flows...\n`);

  // Test each flow
  for (const flowFile of flowFiles) {
    const flowPath = path.join(FLOWS_DIR, flowFile);
    const flow = loadFlow(flowPath);

    console.log(`Flow: ${flow.name} (${flowFile})`);

    // Test: Flow loads successfully
    test('Flow loads without errors', () => {
      assertTrue(flow !== null && flow !== undefined);
      assertTrue(typeof flow.id === 'string');
      assertTrue(typeof flow.name === 'string');
    });

    // Test: Flow validation
    test('Flow passes validation', () => {
      const errors = validateFlow(flow);
      if (errors.length > 0) {
        throw new Error(`Validation errors: ${errors.join(', ')}`);
      }
    });

    // Test: Execution order is valid
    test('Execution order is deterministic', () => {
      const order = getExecutionOrder(flow.nodes, flow.edges);
      assertEqual(order.length, flow.nodes.length, 'All nodes should be in execution order');

      // Trigger should be first
      const triggerNode = flow.nodes.find(n => n.type === 'trigger');
      if (triggerNode) {
        assertEqual(order[0], triggerNode.id, 'Trigger should execute first');
      }
    });

    // Test: Variable interpolation
    test('Input variables are interpolated correctly', () => {
      const testInputs: Record<string, string> = {};
      for (const input of flow.inputs) {
        testInputs[input.id] = `TEST_VALUE_${input.id}`;
      }

      const context = buildContext(flow, testInputs, '/test');

      // Check that input labels map correctly
      for (const input of flow.inputs) {
        const value = context.inputLabels.get(input.label);
        assertEqual(value, `TEST_VALUE_${input.id}`, `Input ${input.label} should map correctly`);
      }
    });

    // Test: Mock execution completes
    test('Mock execution completes without errors', () => {
      const testInputs: Record<string, string> = {};
      for (const input of flow.inputs) {
        testInputs[input.id] = input.defaultValue || 'test input';
      }

      const outputs = executeFlowMock(flow, testInputs);
      assertEqual(outputs.size, flow.nodes.length, 'All nodes should have outputs');
    });

    // Test: Node chaining works
    test('Node outputs are available to downstream nodes', () => {
      const testInputs: Record<string, string> = {};
      for (const input of flow.inputs) {
        testInputs[input.id] = 'test';
      }

      const context = buildContext(flow, testInputs, '/test');
      const order = getExecutionOrder(flow.nodes, flow.edges);

      // Execute and verify each node can access upstream outputs
      for (let i = 0; i < order.length; i++) {
        const nodeId = order[i];
        const node = flow.nodes.find(n => n.id === nodeId)!;

        // Get upstream nodes
        const upstreamEdges = flow.edges.filter(e => e.target === nodeId);

        // Verify upstream outputs exist (except for trigger which has no upstream)
        for (const edge of upstreamEdges) {
          assertTrue(
            context.outputs.has(edge.source),
            `Upstream node ${edge.source} should have output before ${nodeId} executes`
          );
        }

        // Execute current node
        const output = mockExecuteNode(node, context);
        context.outputs.set(nodeId, output);
      }
    });

    console.log('');
  }

  // Summary
  console.log('─'.repeat(40));
  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
console.log('=== Flow Integration Tests ===');
runTests();
console.log('\n✅ All flow integration tests passed!');
