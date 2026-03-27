/**
 * Structural regression tests for Codex flow node wiring.
 *
 * These assert that every runtime path which switches on flow node types
 * includes a codex case, so new node types do not end up half-wired.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const FLOWS_DIR = __dirname;
const WEBVIEW_FLOWS_DIR = path.resolve(FLOWS_DIR, '../../webview/src/components/flows');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(FLOWS_DIR, relativePath), 'utf8');
}

function readWebview(relativePath: string): string {
  return fs.readFileSync(path.join(WEBVIEW_FLOWS_DIR, relativePath), 'utf8');
}

console.log('Testing Codex flow runtime coverage...');

const flowExecutor = read('FlowExecutor.ts');
assert.ok(flowExecutor.includes("case 'codex':"), 'FlowExecutor.ts must handle codex nodes');
console.log('  ✓ FlowExecutor handles codex');

const flowEditorProvider = read('FlowEditorProvider.ts');
assert.ok(flowEditorProvider.includes("case 'codex':"), 'FlowEditorProvider.ts must handle codex nodes');
assert.ok(flowEditorProvider.includes("type: 'flow:codexProgress'"), 'FlowEditorProvider.ts must post codex progress updates');
console.log('  ✓ FlowEditorProvider handles codex');

const flowTestRunner = read('FlowTestRunner.ts');
assert.ok(flowTestRunner.includes("case 'codex':"), 'FlowTestRunner.ts must handle codex nodes');
console.log('  ✓ FlowTestRunner handles codex');

const executionPanel = readWebview('ExecutionPanel.tsx');
assert.ok(executionPanel.includes("'codex'"), 'ExecutionPanel.tsx must recognize codex step types');
assert.ok(executionPanel.includes("case 'flow:codexProgress':"), 'ExecutionPanel.tsx must accept codex progress updates');
console.log('  ✓ ExecutionPanel recognizes codex');

console.log('\n✅ Codex flow runtime coverage tests passed!');
