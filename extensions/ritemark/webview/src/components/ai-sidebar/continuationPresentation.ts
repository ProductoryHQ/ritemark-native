import type { ConversationContinuationNotice } from './conversationState';

const runtimeLabels: Record<ConversationContinuationNotice['runtimeId'], string> = {
  'claude-code': 'Claude',
  codex: 'Codex',
  opencode: 'OpenCode',
};

export interface ContinuationPresentation {
  title: string;
  details: string[];
}

/** One source for the truthful user-facing continuation copy frozen in Sprint 110. */
export function continuationPresentation(
  notice: ConversationContinuationNotice,
): ContinuationPresentation {
  if (notice.mode === 'context-unavailable') {
    return {
      title: 'You can read this conversation, but the agent can’t use its earlier context.',
      details: [],
    };
  }
  return {
    title: `${runtimeLabels[notice.runtimeId]} isn’t available.`,
    details: ['Sign in, choose another agent, or start a new conversation.'],
  };
}
