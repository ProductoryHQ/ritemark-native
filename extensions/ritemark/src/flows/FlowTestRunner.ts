/**
 * Flow Test Runner
 *
 * Automated testing system for Ritemark Flows.
 * Runs test flows from .flows/tests/ and validates outputs.
 *
 * Modes:
 * - mock: Uses mock responses (fast, free)
 * - live: Uses real API calls (slow, costs money)
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Flow, FlowNode, ExecutionContext } from './types';
import { executeLLMNode } from './nodes/LLMNodeExecutor';
import { executeImageNode } from './nodes/ImageNodeExecutor';
import { executeSaveFileNode } from './nodes/SaveFileNodeExecutor';
import { executeClaudeCodeNode } from './nodes/ClaudeCodeNodeExecutor';

interface TestExpectation {
  type?: 'string' | 'object' | 'number';
  minLength?: number;
  maxLength?: number;
  hasProperty?: string;
  contains?: string;
}

interface TestConfig {
  inputs: Record<string, string>;
  expectations: Record<string, TestExpectation>;
  tags?: string[];
  skip?: boolean;
}

interface TestResult {
  flowId: string;
  flowName: string;
  success: boolean;
  duration: number;
  nodeResults: Array<{
    nodeId: string;
    label: string;
    success: boolean;
    output?: unknown;
    error?: string;
  }>;
  error?: string;
}

export class FlowTestRunner {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Flow Tests');
  }

  /**
   * Run all test flows
   */
  async runAllTests(mode: 'mock' | 'live' = 'live'): Promise<TestResult[]> {
    this.outputChannel.clear();
    this.outputChannel.show();
    this.log('═'.repeat(60));
    this.log(`  Ritemark Flow Test Runner - Mode: ${mode.toUpperCase()}`);
    this.log('═'.repeat(60));
    this.log('');

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      this.log('ERROR: No workspace folder found');
      return [];
    }

    const testsDir = path.join(workspacePath, '.flows', 'tests');

    // Check if tests directory exists
    try {
      await fs.access(testsDir);
    } catch {
      this.log(`ERROR: Tests directory not found: ${testsDir}`);
      this.log('Create test flows in .flows/tests/ directory');
      return [];
    }

    // Find all test flows
    const files = await fs.readdir(testsDir);
    const testFiles = files.filter(f => f.endsWith('.flow.json'));

    if (testFiles.length === 0) {
      this.log('No test flows found in .flows/tests/');
      return [];
    }

    this.log(`Found ${testFiles.length} test flow(s)`);
    this.log('');

    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const file of testFiles) {
      const flowPath = path.join(testsDir, file);
      const result = await this.runTestFlow(flowPath, workspacePath, mode);
      results.push(result);

      if (result.success) {
        passed++;
        this.log(`✓ ${result.flowName}`);
      } else {
        failed++;
        this.log(`✗ ${result.flowName}`);
        if (result.error) {
          this.log(`  Error: ${result.error}`);
        }
        for (const nodeResult of result.nodeResults) {
          if (!nodeResult.success) {
            this.log(`  - ${nodeResult.label}: ${nodeResult.error}`);
          }
        }
      }
    }

    this.log('');
    this.log('─'.repeat(60));
    this.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    this.log('─'.repeat(60));

    // Show summary notification
    if (failed === 0) {
      vscode.window.showInformationMessage(`Flow Tests: All ${passed} tests passed!`);
    } else {
      vscode.window.showWarningMessage(`Flow Tests: ${failed} of ${passed + failed} tests failed`);
    }

    return results;
  }

  /**
   * Run a single test flow
   */
  private async runTestFlow(
    flowPath: string,
    workspacePath: string,
    mode: 'mock' | 'live'
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Load flow
      const content = await fs.readFile(flowPath, 'utf-8');
      const flow: Flow & { _test?: TestConfig } = JSON.parse(content);

      const testConfig = flow._test;
      if (!testConfig) {
        return {
          flowId: flow.id,
          flowName: flow.name,
          success: false,
          duration: Date.now() - startTime,
          nodeResults: [],
          error: 'No _test configuration in flow file',
        };
      }

      if (testConfig.skip) {
        return {
          flowId: flow.id,
          flowName: flow.name,
          success: true,
          duration: 0,
          nodeResults: [],
        };
      }

      // Check for expensive tags in mock mode
      if (mode === 'mock' && testConfig.tags?.includes('expensive')) {
        return {
          flowId: flow.id,
          flowName: flow.name + ' (skipped - expensive)',
          success: true,
          duration: 0,
          nodeResults: [],
        };
      }

      // Build input labels map
      const inputLabels = new Map<string, string>();
      const triggerNode = flow.nodes.find(n => n.type === 'trigger');
      if (triggerNode) {
        const triggerInputs = (triggerNode.data as { inputs?: Array<{ id: string; label: string }> }).inputs || [];
        for (const input of triggerInputs) {
          const value = testConfig.inputs[input.label] ?? testConfig.inputs[input.id];
          if (value !== undefined) {
            inputLabels.set(input.label, String(value));
          }
        }
      }

      // Build node labels map
      const nodeLabels = new Map<string, string>();
      for (const node of flow.nodes) {
        const label = (node.data as { label?: string }).label;
        if (label) {
          nodeLabels.set(label, node.id);
        }
      }

      // Build execution context
      const context: ExecutionContext = {
        inputs: testConfig.inputs,
        outputs: new Map(),
        workspacePath,
        inputLabels,
        nodeLabels,
      };

      // Get execution order
      const order = this.getExecutionOrder(flow.nodes, flow.edges);

      const nodeResults: TestResult['nodeResults'] = [];

      // Execute nodes
      for (const nodeId of order) {
        const node = flow.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        const label = (node.data as { label?: string }).label || node.id;

        try {
          let output: unknown;

          if (mode === 'mock') {
            // Mock mode - return fake data
            output = this.getMockOutput(node);
          } else {
            // Live mode - actually execute
            output = await this.executeNode(node, context);
          }

          context.outputs.set(nodeId, output);

          // Validate expectations
          const expectation = testConfig.expectations[nodeId];
          if (expectation) {
            this.validateExpectation(output, expectation, label);
          }

          nodeResults.push({
            nodeId,
            label,
            success: true,
            output,
          });
        } catch (err) {
          nodeResults.push({
            nodeId,
            label,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });

          return {
            flowId: flow.id,
            flowName: flow.name,
            success: false,
            duration: Date.now() - startTime,
            nodeResults,
            error: `Node "${label}" failed`,
          };
        }
      }

      return {
        flowId: flow.id,
        flowName: flow.name,
        success: true,
        duration: Date.now() - startTime,
        nodeResults,
      };
    } catch (err) {
      return {
        flowId: path.basename(flowPath),
        flowName: path.basename(flowPath),
        success: false,
        duration: Date.now() - startTime,
        nodeResults: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: FlowNode,
    context: ExecutionContext
  ): Promise<unknown> {
    switch (node.type) {
      case 'trigger':
        return context.inputs;

      case 'llm-prompt':
        return await executeLLMNode(node, context);

      case 'image-prompt':
        return await executeImageNode(node, context);

      case 'save-file':
        return await executeSaveFileNode(node, context);

      case 'claude-code':
        return await executeClaudeCodeNode(node, context);

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * Get mock output for a node (for fast testing)
   */
  private getMockOutput(node: FlowNode): unknown {
    switch (node.type) {
      case 'trigger':
        return {};

      case 'llm-prompt':
        return 'Mock LLM response for testing purposes.';

      case 'image-prompt':
        return {
          url: 'file:///mock/image.png',
          localPath: '/mock/image.png',
        };

      case 'save-file':
        return {
          path: '/mock/output.md',
          success: true,
        };

      case 'claude-code':
        return {
          text: 'Mock Claude Code response for testing purposes.',
          files: ['/mock/generated-file.md'],
        };

      default:
        return null;
    }
  }

  /**
   * Validate output against expectations
   */
  private validateExpectation(
    output: unknown,
    expectation: TestExpectation,
    nodeLabel: string
  ): void {
    if (expectation.type === 'string') {
      if (typeof output !== 'string') {
        throw new Error(`Expected string, got ${typeof output}`);
      }
      if (expectation.minLength && output.length < expectation.minLength) {
        throw new Error(`Output too short: ${output.length} < ${expectation.minLength}`);
      }
      if (expectation.maxLength && output.length > expectation.maxLength) {
        throw new Error(`Output too long: ${output.length} > ${expectation.maxLength}`);
      }
      if (expectation.contains && !output.includes(expectation.contains)) {
        throw new Error(`Output doesn't contain "${expectation.contains}"`);
      }
    }

    if (expectation.type === 'object') {
      if (typeof output !== 'object' || output === null) {
        throw new Error(`Expected object, got ${typeof output}`);
      }
      if (expectation.hasProperty && !(expectation.hasProperty in output)) {
        throw new Error(`Missing property: ${expectation.hasProperty}`);
      }
    }
  }

  /**
   * Get execution order using topological sort
   */
  private getExecutionOrder(
    nodes: FlowNode[],
    edges: { source: string; target: string }[]
  ): string[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      graph.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    for (const edge of edges) {
      const targets = graph.get(edge.source) || [];
      targets.push(edge.target);
      graph.set(edge.source, targets);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);

      for (const neighbor of graph.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return order;
  }

  private log(message: string): void {
    this.outputChannel.appendLine(message);
  }
}

// Singleton instance
let testRunner: FlowTestRunner | null = null;

export function getFlowTestRunner(): FlowTestRunner {
  if (!testRunner) {
    testRunner = new FlowTestRunner();
  }
  return testRunner;
}

/**
 * Register the test command
 */
export function registerFlowTestCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.flows.runTests', async () => {
      const mode = await vscode.window.showQuickPick(
        [
          { label: 'Live', description: 'Run with real API calls (costs money)', value: 'live' as const },
          { label: 'Mock', description: 'Run with mock responses (fast, free)', value: 'mock' as const },
        ],
        { placeHolder: 'Select test mode' }
      );

      if (mode) {
        const runner = getFlowTestRunner();
        await runner.runAllTests(mode.value);
      }
    })
  );
}
