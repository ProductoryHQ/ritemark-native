/**
 * Regression tests for the plan-approval flow (Sprint 74, R1 / issue #86).
 *
 * Run with: npx tsx webview/src/components/ai-sidebar/planText.test.ts
 */
import assert from 'node:assert/strict';
import { extractPlanDisplayText, planTurnNeedsApproval } from './planText';

// ── extractPlanDisplayText ──────────────────────────────────────────────────

function testFullMultiSectionPlanIsPreserved() {
  // Regression #86: the old implementation returned only the LAST list/heading
  // block, so a 3-section plan rendered as just its final section.
  const plan = [
    '# Fix ExitPlanMode Approval Bug',
    '',
    'Intro paragraph explaining the approach.',
    '',
    '1. Audit store.ts',
    '2. Fix AgentResponse.tsx',
    '',
    '## Risks',
    '',
    '- Double-render risk during running phase',
  ].join('\n');

  const result = extractPlanDisplayText(plan);
  assert.equal(result, plan, 'full plan text must be preserved, not just the last block');
  assert.ok(result.includes('# Fix ExitPlanMode Approval Bug'), 'heading must be present');
  assert.ok(result.includes('1. Audit store.ts'), 'numbered steps must be present');
  assert.ok(result.includes('Double-render risk'), 'trailing section must be present');
}

function testWhitespaceIsTrimmed() {
  assert.equal(extractPlanDisplayText('  \n\nSome plan\n\n  '), 'Some plan');
}

function testEmptyPlanReturnsEmptyString() {
  assert.equal(extractPlanDisplayText(''), '');
  assert.equal(extractPlanDisplayText('   \n  '), '');
}

// ── planTurnNeedsApproval ───────────────────────────────────────────────────

function testApprovalShownOnlyWhilePendingRequestExists() {
  // The agent is blocked at ExitPlanMode → approval UI must show.
  assert.equal(
    planTurnNeedsApproval({ isPlan: true, planHandled: false, pendingPlanApproval: { toolUseId: 'tu-1' } }),
    true,
    'approval UI must show while pendingPlanApproval is set'
  );
}

function testNoApprovalAfterRequestCleared() {
  // Regression #86: after agent-result clears pendingPlanApproval, the buttons
  // must NOT render — clicking them would silently do nothing.
  assert.equal(
    planTurnNeedsApproval({ isPlan: true, planHandled: false, pendingPlanApproval: undefined }),
    false,
    'approval UI must NOT show after pendingPlanApproval is cleared (dead buttons)'
  );
}

function testNoApprovalAfterPlanHandled() {
  assert.equal(
    planTurnNeedsApproval({ isPlan: true, planHandled: true, pendingPlanApproval: { toolUseId: 'tu-1' } }),
    false,
    'approval UI must NOT show after the plan was already handled'
  );
}

function testNoApprovalForNonPlanTurns() {
  assert.equal(
    planTurnNeedsApproval({ isPlan: false, planHandled: false, pendingPlanApproval: { toolUseId: 'tu-1' } }),
    false,
    'approval UI must NOT show for non-plan turns'
  );
}

function main() {
  testFullMultiSectionPlanIsPreserved();
  testWhitespaceIsTrimmed();
  testEmptyPlanReturnsEmptyString();
  testApprovalShownOnlyWhilePendingRequestExists();
  testNoApprovalAfterRequestCleared();
  testNoApprovalAfterPlanHandled();
  testNoApprovalForNonPlanTurns();
  console.log('planText tests passed.');
}

main();
