import assert from 'node:assert/strict';
import { buildActivePlanViewModel } from './activePlan';
import { applyCodexPlanApproval, applyCodexPlanUpdate, buildCodexApprovedPlanPrompt, finalizeCodexTurnResult, getActiveApprovedPlanForCodex, shouldRequestPlanMode } from './lifecycle';
import type { CodexConversationTurn } from './types';

function makeTurn(overrides: Partial<CodexConversationTurn>): CodexConversationTurn {
  return {
    id: overrides.id || 'turn-1',
    userPrompt: overrides.userPrompt || 'Improve the document',
    requestedPlanMode: overrides.requestedPlanMode,
    activeFilePath: overrides.activeFilePath,
    attachments: overrides.attachments,
    streamingText: overrides.streamingText || '',
    activities: overrides.activities || [],
    approval: overrides.approval,
    pendingQuestion: overrides.pendingQuestion,
    executionContinuation: overrides.executionContinuation,
    requiresPlanReview: overrides.requiresPlanReview,
    planText: overrides.planText,
    planExplanation: overrides.planExplanation,
    planSteps: overrides.planSteps,
    planHandled: overrides.planHandled ?? false,
    planDecision: overrides.planDecision,
    result: overrides.result,
    isRunning: overrides.isRunning ?? false,
    timestamp: overrides.timestamp ?? 1,
  };
}

function testActivePlanFallbackPromotesFirstItemToInProgress() {
  const model = buildActivePlanViewModel(
    `
Plan:
1. Review current section order
2. Add missing approval limits
3. Tighten wording in exceptions
    `,
    undefined,
    true
  );

  assert.ok(model, 'fallback plan text should build a view model');
  assert.equal(model?.summary, '1 in progress · 2 pending');
  assert.equal(model?.steps[0].status, 'inProgress');
  assert.equal(model?.steps[1].status, 'pending');
}

function testActivePlanUsesStructuredStatusesWhenAvailable() {
  const model = buildActivePlanViewModel('', [
    { step: 'Review section order', status: 'completed' },
    { step: 'Add missing approval limits', status: 'inProgress' },
    { step: 'Tighten wording in exceptions', status: 'pending' },
  ]);

  assert.ok(model, 'structured plan should build a view model');
  assert.equal(model?.summary, '1 in progress · 1 pending · 1 done');
  assert.deepEqual(
    model?.steps.map((step) => step.status),
    ['completed', 'inProgress', 'pending']
  );
}

function testActivePlanParsesMarkdownChecklistStatuses() {
  const model = buildActivePlanViewModel(
    `Working checklist:
- [x] Review structure
- [x] Identify overlaps
- [ ] Draft rewrite outline`,
    undefined,
    false
  );

  assert.ok(model, 'markdown checklist should build a view model');
  assert.equal(model?.summary, '1 pending · 2 done');
  assert.deepEqual(
    model?.steps.map((step) => step.status),
    ['completed', 'completed', 'pending']
  );
}

function testActivePlanPrefersChecklistBlockOverLaterHeadings() {
  const model = buildActivePlanViewModel(
    `Jätkan — siin on konkreetne pakett.

### Töö-checklist
- ✅ Struktuur
- ✅ Sisu täpsus
- ▶️ Täpne uus sõnastus

---

## 6) Alkoholi reegli dubleerimise vähendamine

Soovitus: jäta detailne alkoholireegel ainult p 5 alla.`,
    undefined,
    false
  );

  assert.ok(model, 'emoji checklist should build a view model');
  assert.equal(model?.summary, '1 in progress · 2 done');
  assert.deepEqual(
    model?.steps.map((step) => step.label),
    ['Struktuur', 'Sisu täpsus', 'Täpne uus sõnastus']
  );
  assert.deepEqual(
    model?.steps.map((step) => step.status),
    ['completed', 'completed', 'inProgress']
  );
}

function testCodexPlanApprovalCreatesContinuationTurn() {
  const turns = [
    makeTurn({
      id: 'plan-turn',
      userPrompt: 'Refactor the document',
      planText: '1. Review structure\n2. Edit sections',
      result: { status: 'completed' },
      timestamp: 10,
    }),
  ];

  const { conversation, prompt } = applyCodexPlanApproval(turns, 'plan-turn', () => 'continuation-turn');

  assert.ok(prompt, 'plan approval should emit a continuation prompt');
  assert.match(prompt || '', /Continue the task now instead of re-planning/);
  assert.match(prompt || '', /update step statuses as you progress/);
  assert.equal(conversation.length, 2, 'approval should append a continuation turn');
  assert.equal(conversation[0].planHandled, true);
  assert.equal(conversation[0].planDecision, 'approved');
  assert.equal(conversation[1].id, 'continuation-turn');
  assert.equal(conversation[1].userPrompt, 'Continue with approved plan');
  assert.equal(conversation[1].isRunning, true);
}

function testActiveApprovedPlanPrefersLiveExecutionSteps() {
  const approvedTurn = makeTurn({
    id: 'plan-turn',
    planHandled: true,
    planDecision: 'approved',
    planText: '1. Review structure\n2. Edit sections',
    timestamp: 10,
  });

  const liveExecutionTurn = makeTurn({
    id: 'exec-turn',
    userPrompt: 'Continue with approved plan',
    planSteps: [
      { step: 'Review structure', status: 'completed' },
      { step: 'Edit sections', status: 'inProgress' },
    ],
    planText: '1. Review structure\n2. Edit sections',
    isRunning: true,
    timestamp: 20,
  });

  const activePlan = getActiveApprovedPlanForCodex([approvedTurn, liveExecutionTurn]);

  assert.ok(activePlan, 'approved plan should be derivable');
  assert.equal(activePlan?.isRunning, true);
  assert.deepEqual(
    activePlan?.planSteps?.map((step) => step.status),
    ['completed', 'inProgress']
  );
}

function testActiveApprovedPlanUsesLiveStreamingFallback() {
  const approvedTurn = makeTurn({
    id: 'plan-turn',
    planHandled: true,
    planDecision: 'approved',
    planText: '1. Review structure\n2. Edit sections',
    timestamp: 10,
  });

  const liveExecutionTurn = makeTurn({
    id: 'exec-turn',
    userPrompt: 'Continue with approved plan',
    streamingText: `Working checklist:
- [x] Review structure
- [ ] Edit sections`,
    isRunning: true,
    timestamp: 20,
  });

  const activePlan = getActiveApprovedPlanForCodex([approvedTurn, liveExecutionTurn]);

  assert.ok(activePlan, 'approved plan should be derivable');
  assert.equal(activePlan?.isRunning, true);
  const model = buildActivePlanViewModel(activePlan?.planText || '', activePlan?.planSteps, activePlan?.isRunning);
  assert.equal(model?.summary, '1 pending · 1 done');
  assert.deepEqual(
    model?.steps.map((step) => step.status),
    ['completed', 'pending']
  );
}

function testBuildCodexApprovedPlanPromptKeepsOriginalRequest() {
  const prompt = buildCodexApprovedPlanPrompt(
    'Update the policy document',
    '1. Review structure\n2. Edit sections'
  );

  assert.match(prompt, /Original task context:/);
  assert.match(prompt, /Update the policy document/);
  assert.match(prompt, /Approved plan:/);
}

function testApprovedContinuationPlanUpdateDoesNotReenterReview() {
  const continuationTurn = makeTurn({
    id: 'exec-turn',
    userPrompt: 'Continue with approved plan',
    executionContinuation: true,
    isRunning: true,
    timestamp: 20,
  });

  const updatedTurn = applyCodexPlanUpdate(continuationTurn, {
    explanation: 'Continue execution using the approved plan.',
    plan: [
      { step: 'Review structure', status: 'completed' },
      { step: 'Edit sections', status: 'inProgress' },
    ],
  });

  assert.equal(
    updatedTurn.requiresPlanReview,
    false,
    'approved continuation turn must stay in execute mode instead of re-entering plan review'
  );
  assert.deepEqual(
    updatedTurn.planSteps?.map((step) => step.status),
    ['completed', 'inProgress']
  );
}

function testPlanModeResultWithoutStructuredUpdateStillRequiresReview() {
  const turn = makeTurn({
    id: 'plan-turn',
    userPrompt: 'Work in plan mode first. Ask one question, then make a short 3-step plan.',
    requestedPlanMode: true,
    streamingText: `3-step plan

1. Review the current structure
2. Propose a clearer section order
3. Add a compact validation checklist`,
    isRunning: true,
    timestamp: 30,
  });

  const finalizedTurn = finalizeCodexTurnResult(turn, { status: 'completed' });

  assert.equal(
    finalizedTurn.requiresPlanReview,
    true,
    'a plan-mode turn that ends with plain-text plan output must still enter review even without codex-plan-update'
  );
  assert.equal(finalizedTurn.isRunning, false);
}

function testPlanModePromptDetection() {
  assert.equal(shouldRequestPlanMode('Work in plan mode first.'), true);
  assert.equal(shouldRequestPlanMode('Enter plan mode and propose steps.'), true);
  assert.equal(
    shouldRequestPlanMode(buildCodexApprovedPlanPrompt('Work in plan mode first.', '1. Do work')),
    false,
    'approved-plan continuation prompt must not accidentally re-enter plan mode'
  );
  assert.equal(shouldRequestPlanMode('Just edit the file directly.'), false);
}

function main() {
  testActivePlanFallbackPromotesFirstItemToInProgress();
  testActivePlanUsesStructuredStatusesWhenAvailable();
  testActivePlanParsesMarkdownChecklistStatuses();
  testActivePlanPrefersChecklistBlockOverLaterHeadings();
  testCodexPlanApprovalCreatesContinuationTurn();
  testActiveApprovedPlanPrefersLiveExecutionSteps();
  testActiveApprovedPlanUsesLiveStreamingFallback();
  testBuildCodexApprovedPlanPromptKeepsOriginalRequest();
  testApprovedContinuationPlanUpdateDoesNotReenterReview();
  testPlanModeResultWithoutStructuredUpdateStillRequiresReview();
  testPlanModePromptDetection();
  console.log('Webview lifecycle tests passed.');
}

main();
