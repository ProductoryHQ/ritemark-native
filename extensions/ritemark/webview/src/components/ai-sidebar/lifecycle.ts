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

// Sprint 103 R1 (D4): `shouldRequestPlanMode` prompt sniffing removed — the
// Plan chip is the only path into plan-first; prompt text never flips modes.

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
    // Only require plan review if the user explicitly requested plan mode.
    // Codex may send plan updates autonomously — these should be shown as
    // progress indicators, not as blocking approval gates.
    requiresPlanReview: turn.executionContinuation ? false : turn.requestedPlanMode,
    planHandled: turn.executionContinuation ? turn.planHandled : (turn.requestedPlanMode ? false : turn.planHandled),
    planDecision: turn.executionContinuation ? turn.planDecision : (turn.requestedPlanMode ? undefined : turn.planDecision),
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

  // Sprint 103 R7 (audit F11): the banner shows the APPROVED PLAN, never the
  // turn's result text — the result already renders as the response.
  const completedResultText = approvedTurn.result && !approvedTurn.result.error
    ? approvedTurn.result.text.trim()
    : '';

  return {
    key: approvedTurn.id,
    planText: approvedTurn.planText || '',
    isRunning: Boolean(approvedTurn.isRunning),
    allCompleted: Boolean(completedResultText) && !approvedTurn.isRunning,
  };
}
