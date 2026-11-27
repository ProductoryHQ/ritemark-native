import type { AgentId } from '../agent/types';
import type { FeedbackEvent } from '../analytics/consent';
import { isConversationId, type AssistantMessageEventV1, type ConversationRecordV1 } from '../conversations/types';
import type { GuidanceStore } from '../guidance/guidanceStore';
import type {
  AnswerFeedbackResult,
  AnswerFeedbackTarget,
  AnswerReaction,
  AnswerReactionResult,
  AnswerReactionsMessage,
  OpenAnswerFeedbackMessage,
} from './answerFeedbackProtocol';

// The feedback sheet's prefill limit also bounds the inline field.
const MAX_FEEDBACK_TEXT = 2_000;

function recordOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}

function decodeReference(raw: unknown): AnswerFeedbackTarget | null {
  const { conversationId, turnId } = recordOf(raw);
  if (typeof conversationId !== 'string' || !isConversationId(conversationId) || typeof turnId !== 'string' || !turnId.trim()) return null;
  return { conversationId, turnId };
}

export function decodeSidebarFeedbackOpen(raw: unknown): OpenAnswerFeedbackMessage['options'] | null {
  const { from, kind, turn, withAnswer, text, quote } = recordOf(raw);
  if (from === 'failure_card') {
    const { title, line } = recordOf(quote);
    // The sheet independently validates the quote's contents and bounds.
    return typeof title === 'string' && typeof line === 'string' ? { from, quote: { title, line } } : { from };
  }
  if (from !== 'thumb' || kind !== 'ai-issue' || withAnswer !== true || typeof text !== 'string' || text.length > MAX_FEEDBACK_TEXT) return null;
  const ref = decodeReference(turn);
  return ref ? { from, kind, turn: ref, withAnswer, text } : null;
}

/** A continuation may change a previously completed turn back to working or failed. */
export function findCompletedAnswer(
  record: ConversationRecordV1,
  turnId: string,
): (AssistantMessageEventV1 & { runtimeId: AgentId }) | null {
  const { lifecycle, events } = record;
  if ((lifecycle.state === 'working' || lifecycle.state === 'needs-user') && lifecycle.activeTurnId === turnId) return null;
  if (lifecycle.state === 'interrupted' && lifecycle.turnId === turnId) return null;
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.turnId !== turnId) continue;
    if (event.kind === 'boundary' && event.boundaryKind !== 'context-restored') return null;
    if (event.kind === 'assistant-message') {
      return event.terminalStatus === 'completed' && event.content.trim() && event.runtimeId !== 'legacy-ritemark'
        ? { ...event, runtimeId: event.runtimeId }
        : null;
    }
  }
  return null;
}

interface AnswerFeedbackDependencies {
  guidance: GuidanceStore;
  activeConversation(): string | null;
  readConversation(conversationId: string): Promise<ConversationRecordV1>;
  trackAnswerReaction(reaction: AnswerReaction, ai: AgentId): Promise<boolean>;
  sendFeedback(events: ReadonlyArray<FeedbackEvent>): Promise<boolean>;
}

export class AnswerFeedbackHost {
  private readonly reacting = new Set<string>();
  private readonly sending = new Set<string>();

  constructor(private readonly deps: AnswerFeedbackDependencies) {}

  async snapshot(conversationId: string): Promise<AnswerReactionsMessage | null> {
    if (!isConversationId(conversationId) || this.deps.activeConversation() !== conversationId) return null;
    const reactions = this.deps.guidance.answerReactionsOf(conversationId);
    if (!reactions.length) return { type: 'agent:answerReactions', conversationId, reactions };
    const record = await this.deps.readConversation(conversationId).catch(() => null);
    if (!record || record.conversationId !== conversationId || this.deps.activeConversation() !== conversationId) return null;
    return { type: 'agent:answerReactions', conversationId, reactions: this.deps.guidance.answerReactionsOf(conversationId) };
  }

  async react(raw: unknown): Promise<AnswerReactionResult | null> {
    const ref = decodeReference(raw);
    const { reaction } = recordOf(raw);
    if (!ref || (reaction !== 'up' && reaction !== 'down' && reaction !== 'none')) return null;
    const result: AnswerReactionResult = { type: 'agent:answerReactionResult', ...ref, reaction, accepted: false, sent: false };
    const key = JSON.stringify([ref.conversationId, ref.turnId]);
    if (this.reacting.has(key)) return result;
    this.reacting.add(key);
    try {
      const answer = await this.activeAnswer(ref);
      if (!answer) return result;
      result.accepted = await this.deps.guidance.changeAnswerReaction(ref, reaction);
      if (!result.accepted) return result;
      if (reaction === 'up') await this.deps.guidance.notePositiveReaction();
      result.sent = await this.deps.trackAnswerReaction(reaction, answer.runtimeId);
      if (result.sent && reaction !== 'none') await this.deps.guidance.noteAnswerReactionSent(ref, reaction);
    } catch {
      // Report only the mark and delivery state reached before a storage or transport failure.
    } finally {
      this.reacting.delete(key);
    }
    return result;
  }

  async send(raw: unknown): Promise<AnswerFeedbackResult | null> {
    const ref = decodeReference(raw);
    if (!ref) return null;
    const result: AnswerFeedbackResult = { type: 'agent:answerFeedbackResult', ...ref, sent: false };
    const { text } = recordOf(raw);
    if (typeof text !== 'string' || text.length > MAX_FEEDBACK_TEXT || !text.trim()) return result;
    const key = JSON.stringify([ref.conversationId, ref.turnId]);
    if (this.sending.has(key)) return result;
    this.sending.add(key);
    try {
      if (await this.activeAnswer(ref)) {
        result.sent = await this.deps.sendFeedback([
          { name: 'feedback_sent', properties: { message: text.trim(), from: 'thumb' } },
        ]);
      }
    } catch {
      // An unsent message stays available for retry in the webview.
    } finally {
      this.sending.delete(key);
    }
    return result;
  }

  async activeAnswer(ref: AnswerFeedbackTarget): Promise<ReturnType<typeof findCompletedAnswer>> {
    if (this.deps.activeConversation() !== ref.conversationId) return null;
    const record = await this.deps.readConversation(ref.conversationId).catch(() => null);
    return record?.conversationId === ref.conversationId && this.deps.activeConversation() === ref.conversationId
      ? findCompletedAnswer(record, ref.turnId)
      : null;
  }
}
