/** Messages between the shared AI turn footer and its host. */
export interface AnswerFeedbackTarget {
  conversationId: string;
  turnId: string;
}

export type AnswerReaction = 'up' | 'down' | 'none';

export interface AnswerReactionMessage extends AnswerFeedbackTarget {
  type: 'agent:answerReaction';
  reaction: AnswerReaction;
}

export interface AnswerReactionResult extends AnswerFeedbackTarget {
  type: 'agent:answerReactionResult';
  reaction: AnswerReaction;
  accepted: boolean;
  sent: boolean;
}

export interface AnswerReactionsMessage {
  type: 'agent:answerReactions';
  conversationId: string;
  reactions: StoredAnswerReaction[];
}

export interface SendAnswerFeedbackMessage extends AnswerFeedbackTarget {
  type: 'agent:sendAnswerFeedback';
  text: string;
}

export interface AnswerFeedbackResult extends AnswerFeedbackTarget {
  type: 'agent:answerFeedbackResult';
  sent: boolean;
}

export interface OpenAnswerFeedbackMessage {
  type: 'agent:openFeedback';
  options:
    | { from: 'thumb'; kind: 'ai-issue'; turn: AnswerFeedbackTarget; withAnswer: true; text: string }
    | { from: 'failure_card'; quote?: { title: string; line: string } };
}

export interface StoredAnswerReaction {
  turnId: string;
  reaction: Exclude<AnswerReaction, 'none'>;
  sent: boolean;
}
