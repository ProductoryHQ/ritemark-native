import type { AgentConversationTurn, CodexConversationTurn } from './types';
import { extractPlanDisplayText } from './planText';

export interface ActiveApprovedPlan {
  key: string;
  planText: string;
  planSteps?: CodexConversationTurn['planSteps'];
  isRunning: boolean;
  allCompleted?: boolean;
}

export function buildCodexApprovedPlanPrompt(originalPrompt: string, planText: string): string {
  return [
    'The user approved this plan. Continue the task now instead of re-planning.',
    'Do not ask for plan approval again unless the plan must materially change.',
    'Keep the approved plan as a short working checklist and update step statuses as you progress when the protocol supports it.',
    '',
    'Original task context:',
    originalPrompt,
    '',
    'Approved plan:',
    planText,
  ].join('\n');
}

export function shouldRequestPlanMode(prompt: string): boolean {
  if (/^The user approved this plan\./i.test(prompt.trim())) {
    return false;
  }
  return /\bplan mode\b/i.test(prompt)
    || /\bwork in plan\b/i.test(prompt)
    || /\benter plan mode\b/i.test(prompt);
}

export function applyCodexPlanApproval(
  turns: CodexConversationTurn[],
  turnId: string,
  createId: () => string
): { conversation: CodexConversationTurn[]; prompt: string | null } {
  const approvedTurn = turns.find((turn) => turn.id === turnId);
  if (!approvedTurn) {
    return { conversation: turns, prompt: null };
  }

  const prompt = buildCodexApprovedPlanPrompt(
    approvedTurn.userPrompt,
    approvedTurn.planText || approvedTurn.streamingText || ''
  );

  const continuationTurn: CodexConversationTurn = {
    id: createId(),
    userPrompt: 'Continue with approved plan',
    requestedPlanMode: false,
    activeFilePath: approvedTurn.activeFilePath,
    attachments: approvedTurn.attachments,
    streamingText: '',
    activities: [],
    pendingQuestion: undefined,
    executionContinuation: true,
    requiresPlanReview: false,
    planText: '',
    planExplanation: undefined,
    planSteps: [],
    planHandled: false,
    planDecision: undefined,
    isRunning: true,
    timestamp: Date.now(),
  };

  const conversation = turns.map((turn) =>
    turn.id === turnId
      ? { ...turn, planHandled: true, planDecision: 'approved' as const }
      : turn
  );

  return {
    conversation: [...conversation, continuationTurn],
    prompt,
  };
}

export function finalizeCodexTurnResult(
  turn: CodexConversationTurn,
  result: { status?: string; error?: string }
): CodexConversationTurn {
  const fallbackPlanText = (!turn.planText || !turn.planText.trim())
    ? turn.streamingText
    : turn.planText;
  const displayPlanText = extractPlanDisplayText(fallbackPlanText);
  const shouldRequirePlanReview = Boolean(
    !result.error
    && !turn.executionContinuation
    && turn.requestedPlanMode
    && !turn.planHandled
    && !turn.requiresPlanReview
    && displayPlanText
  );

  return {
    ...turn,
    isRunning: false,
    pendingQuestion: undefined,
    planText: fallbackPlanText,
    requiresPlanReview: turn.requiresPlanReview || shouldRequirePlanReview,
    result: { status: result.status || 'success', error: result.error },
  };
}

export function applyCodexPlanUpdate(
  turn: CodexConversationTurn,
  update: {
    explanation?: string | null;
    plan: NonNullable<CodexConversationTurn['planSteps']>;
  }
): CodexConversationTurn {
  return {
    ...turn,
    planText: turn.planText || '',
    planExplanation: update.explanation || undefined,
    planSteps: update.plan,
    requiresPlanReview: turn.executionContinuation ? false : true,
    planHandled: turn.executionContinuation ? turn.planHandled : false,
    planDecision: turn.executionContinuation ? turn.planDecision : undefined,
  };
}

export function getActiveApprovedPlanForCodex(turns: CodexConversationTurn[]): ActiveApprovedPlan | null {
  const approvedTurn = [...turns].reverse().find((turn) =>
    turn.planHandled
    && turn.planDecision === 'approved'
    && Boolean((turn.planText || turn.streamingText).trim())
  );

  if (!approvedTurn) {
    return null;
  }

  const latestTurn = turns[turns.length - 1];
  const livePlanSource = latestTurn && latestTurn.timestamp >= approvedTurn.timestamp
    ? latestTurn
    : approvedTurn;

  return {
    key: approvedTurn.id,
    planText: livePlanSource.planText
      || livePlanSource.streamingText
      || approvedTurn.planText
      || approvedTurn.streamingText
      || '',
    planSteps: livePlanSource.planSteps || approvedTurn.planSteps,
    isRunning: Boolean(livePlanSource.isRunning),
  };
}

export function getActiveApprovedPlanForClaude(turns: AgentConversationTurn[]): ActiveApprovedPlan | null {
  const approvedTurn = [...turns].reverse().find((turn) =>
    turn.isPlan
    && turn.planHandled
    && turn.planDecision === 'approved'
    && Boolean(turn.planText?.trim())
  );

  if (!approvedTurn) {
    return null;
  }

  const completedResultText = approvedTurn.result && !approvedTurn.result.error
    ? approvedTurn.result.text.trim()
    : '';

  return {
    key: approvedTurn.id,
    planText: completedResultText || approvedTurn.planText || '',
    isRunning: Boolean(approvedTurn.isRunning),
    allCompleted: Boolean(completedResultText) && !approvedTurn.isRunning,
  };
}
