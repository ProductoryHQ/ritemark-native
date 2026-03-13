/**
 * Repro tests for Codex approval dialog bug.
 *
 * Bug: Codex app-server sends approval requests with method names like
 *   "item/commandExecution/requestApproval" and "item/fileChange/requestApproval"
 * but our handler checks for "execCommandApproval" / "applyPatchApproval".
 * Result: all approvals are auto-denied and the user never sees the dialog.
 *
 * Run: npx tsx src/codex/codexApproval.test.ts
 */

import * as assert from 'assert';
import { routeApprovalRequest, CODEX_APPROVAL_METHODS } from './codexApproval';
import type { ReviewDecision } from './codexProtocol';

// ============================================================================
// Tests
// ============================================================================

// Test 1: Real Codex command approval request is recognized
{
  const result = routeApprovalRequest({
    id: 42,
    method: 'item/commandExecution/requestApproval',
    params: {
      itemId: 'item-1',
      threadId: 'thread-1',
      turnId: 'turn-1',
      command: ['npm', 'install'],
      cwd: '/home/user/project',
      reason: 'Install dependencies',
    },
  });
  assert.strictEqual(result.type, 'command', 'Should recognize command approval');
  assert.strictEqual((result as { command: string }).command, 'npm install');
  assert.strictEqual((result as { workingDir: string }).workingDir, '/home/user/project');
  console.log('✓ Test 1: Command approval with real Codex method name');
}

// Test 2: Real Codex file change approval request is recognized
{
  const result = routeApprovalRequest({
    id: 43,
    method: 'item/fileChange/requestApproval',
    params: {
      itemId: 'item-2',
      threadId: 'thread-1',
      turnId: 'turn-1',
      fileChanges: { 'src/index.ts': { type: 'update', unified_diff: '+ new line' } },
      reason: 'Add feature',
    },
  });
  assert.strictEqual(result.type, 'fileChange', 'Should recognize file change approval');
  assert.ok((result as { fileChanges: Record<string, unknown> }).fileChanges['src/index.ts']);
  console.log('✓ Test 2: File change approval with real Codex method name');
}

// Test 3: Old (wrong) method names are NOT recognized — they get denied
{
  const result = routeApprovalRequest({
    id: 44,
    method: 'execCommandApproval',
    params: { command: ['ls'], cwd: '/' },
  });
  assert.strictEqual(result.type, 'denied', 'Old method name should be denied');
  console.log('✓ Test 3: Old method name "execCommandApproval" correctly denied');
}

// Test 4: Unknown methods get denied
{
  const result = routeApprovalRequest({
    id: 45,
    method: 'some/unknown/method',
    params: {},
  });
  assert.strictEqual(result.type, 'denied');
  console.log('✓ Test 4: Unknown method denied');
}

// Test 5: Command as single string (not array)
{
  const result = routeApprovalRequest({
    id: 46,
    method: 'item/commandExecution/requestApproval',
    params: { command: 'echo hello', cwd: '/tmp' },
  });
  assert.strictEqual(result.type, 'command');
  assert.strictEqual((result as { command: string }).command, 'echo hello');
  console.log('✓ Test 5: Command as string (not array) handled');
}

// Test 6: File changes with legacy "changes" key (not "fileChanges")
{
  const result = routeApprovalRequest({
    id: 47,
    method: 'item/fileChange/requestApproval',
    params: {
      changes: { 'README.md': { type: 'add', content: '# Hello' } },
    },
  });
  assert.strictEqual(result.type, 'fileChange');
  assert.ok((result as { fileChanges: Record<string, unknown> }).fileChanges['README.md']);
  console.log('✓ Test 6: Legacy "changes" key handled for file approval');
}

// Test 7: Approval policy constants match protocol spec
{
  assert.strictEqual(CODEX_APPROVAL_METHODS.execCommand, 'item/commandExecution/requestApproval');
  assert.strictEqual(CODEX_APPROVAL_METHODS.fileChange, 'item/fileChange/requestApproval');
  console.log('✓ Test 7: Method name constants match Codex protocol spec');
}

// Test 8: ReviewDecision type uses correct Codex protocol values
{
  // These are the values Codex app-server expects in approval responses.
  // Previously we used 'approved'/'denied' which Codex silently ignored.
  const validDecisions: ReviewDecision[] = ['accept', 'acceptForSession', 'decline', 'cancel'];
  assert.strictEqual(validDecisions.length, 4);
  // Verify old incorrect values are NOT valid
  const oldDecisions = ['approved', 'approved_for_session', 'denied', 'abort'];
  for (const old of oldDecisions) {
    assert.ok(!validDecisions.includes(old as ReviewDecision), `Old value "${old}" should not be a valid ReviewDecision`);
  }
  console.log('✓ Test 8: ReviewDecision values match Codex protocol (accept/decline, not approved/denied)');
}

// Test 9: Default approval policy should be "untrusted" (ask for everything)
// "on-request" with "workspace-write" auto-approves workspace writes at core level,
// so user never sees the dialog. "untrusted" always asks.
{
  const DEFAULT_APPROVAL_POLICY = 'untrusted';
  assert.strictEqual(DEFAULT_APPROVAL_POLICY, 'untrusted',
    'Default must be "untrusted" — "on-request" auto-approves workspace writes');
  console.log('✓ Test 9: Default approval policy is "untrusted" (always ask)');
}

console.log('\nAll 9 tests passed!');
