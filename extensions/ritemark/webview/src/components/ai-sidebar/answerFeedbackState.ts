import { create } from 'zustand';
import { vscode } from '../../lib/vscode';
import type {
  AnswerFeedbackResult, AnswerFeedbackTarget, AnswerReaction, AnswerReactionMessage, AnswerReactionResult,
  AnswerReactionsMessage, OpenAnswerFeedbackMessage, OpenAnswerFeedbackResult, SendAnswerFeedbackMessage,
} from '../../../../src/feedback/answerFeedbackProtocol';
import type { AgentConversationTurn, CodexConversationTurn } from './types';
import { codexPlanReplacesStreamingAnswer } from './planText';

export type AnswerTarget = AnswerFeedbackTarget;
type DraftScope = { conversationId: string; latestTurnId: string | undefined; latestQueuedId: string | undefined };
export type OpenFeedbackDraft = AnswerTarget & DraftScope & { trigger: () => HTMLButtonElement | null };

export function feedbackDraftIsOpen(draft: OpenFeedbackDraft | null, scope: DraftScope, turnId: string): boolean {
  return draft !== null && draft.conversationId === scope.conversationId
    && draft.latestTurnId === scope.latestTurnId && draft.latestQueuedId === scope.latestQueuedId && draft.turnId === turnId;
}

export function isCompletedAnswer(turn: AgentConversationTurn | CodexConversationTurn): boolean {
  if (turn.isRunning || !turn.result || turn.result.error || turn.approval || turn.pendingQuestion) return false;
  if ('streamingText' in turn) {
    return (turn.result?.status === 'success' || turn.result?.status === 'completed')
      && (!turn.requiresPlanReview || turn.planHandled === true)
      && turn.streamingText.trim().length > 0
      && !(turn.planSteps?.length && codexPlanReplacesStreamingAnswer(turn));
  }
  return !turn.result.stopped && !turn.pendingPlanApproval && turn.result.text.trim().length > 0;
}

interface FeedbackEntry {
  reaction: AnswerReaction;
  pendingReaction?: AnswerReaction;
  markSent: boolean;
  text: string;
  sending: boolean;
  openingSheet?: number;
  failed: boolean;
  wordsSent: boolean;
}

const EMPTY: FeedbackEntry = { reaction: 'none', markSent: false, text: '', sending: false, failed: false, wordsSent: false };
export const feedbackEntry = (state: FeedbackState, { conversationId, turnId }: AnswerTarget) => state.entries[conversationId]?.[turnId] ?? EMPTY;

interface FeedbackState {
  eligibleTurns: Record<string, ReadonlySet<string>>;
  entries: Record<string, Record<string, FeedbackEntry>>;
  react(target: AnswerTarget, reaction: AnswerReaction): boolean;
  finishReaction(message: AnswerReactionResult): void;
  restoreReactions(message: AnswerReactionsMessage): void;
  edit(target: AnswerTarget, text: string): void;
  send(target: AnswerTarget): boolean;
  finishSend(message: AnswerFeedbackResult): void;
  openWithAnswer(target: AnswerTarget): void;
  finishOpen(message: OpenAnswerFeedbackResult): void;
}

export const answerFeedbackStore = create<FeedbackState>((set, get) => {
  let nextOpenRequestId = 0;
  const pendingOpens = new Map<number, AnswerTarget>();
  const patch = (target: AnswerTarget, update: Partial<FeedbackEntry>) => {
    const { conversationId, turnId } = target;
    set((state) => ({
      entries: {
        ...state.entries,
        [conversationId]: { ...state.entries[conversationId], [turnId]: { ...feedbackEntry(state, target), ...update } },
      },
    }));
  };
  return {
    entries: {},
    eligibleTurns: {},
    react(target, reaction) {
      const entry = feedbackEntry(get(), target);
      if (entry.pendingReaction !== undefined || entry.reaction === reaction) return false;
      patch(target, { pendingReaction: reaction });
      const message: AnswerReactionMessage = { type: 'agent:answerReaction', ...target, reaction };
      vscode.postMessage(message);
      return true;
    },
    finishReaction(message) {
      if (feedbackEntry(get(), message).pendingReaction !== message.reaction) return;
      patch(message, {
        pendingReaction: undefined,
        ...(message.accepted ? { reaction: message.reaction, markSent: message.sent } : {}),
      });
    },
    restoreReactions({ conversationId, reactions, eligibleTurnIds }) {
      const entries = { ...get().entries[conversationId] };
      const marks = new Map(reactions.map((mark) => [mark.turnId, mark]));
      for (const turnId of new Set([...Object.keys(entries), ...marks.keys()])) {
        const entry = entries[turnId] ?? EMPTY;
        if (entry.pendingReaction !== undefined) continue;
        const mark = marks.get(turnId);
        entries[turnId] = { ...entry, reaction: mark?.reaction ?? 'none', markSent: mark?.sent ?? false };
      }
      set((state) => ({
        entries: { ...state.entries, [conversationId]: entries },
        eligibleTurns: { ...state.eligibleTurns, [conversationId]: new Set(eligibleTurnIds) },
      }));
    },
    edit(target, text) {
      patch(target, { text, failed: false });
    },
    send(target) {
      const { sending, openingSheet, text } = feedbackEntry(get(), target);
      const trimmed = text.trim();
      if (sending || openingSheet !== undefined || !trimmed) return false;
      patch(target, { sending: true, failed: false });
      const message: SendAnswerFeedbackMessage = { type: 'agent:sendAnswerFeedback', ...target, text: trimmed };
      vscode.postMessage(message);
      return true;
    },
    finishSend(message) {
      if (!feedbackEntry(get(), message).sending) return;
      patch(message, {
        sending: false,
        failed: !message.sent,
        ...(message.sent ? { text: '', wordsSent: true } : {}),
      });
    },
    openWithAnswer(target) {
      const { text, sending, openingSheet } = feedbackEntry(get(), target);
      if (sending || openingSheet !== undefined) return;
      const requestId = ++nextOpenRequestId;
      pendingOpens.set(requestId, target);
      patch(target, { openingSheet: requestId, failed: false });
      const message: OpenAnswerFeedbackMessage = {
        type: 'agent:openFeedback',
        requestId,
        options: { from: 'thumb', kind: 'ai-issue', turn: target, withAnswer: true, text },
      };
      vscode.postMessage(message);
    },
    finishOpen({ requestId, ok }) {
      const target = pendingOpens.get(requestId);
      if (!target) return;
      pendingOpens.delete(requestId);
      if (feedbackEntry(get(), target).openingSheet !== requestId) return;
      patch(target, { openingSheet: undefined, failed: !ok, ...(ok ? { text: '' } : {}) });
    },
  };
});
