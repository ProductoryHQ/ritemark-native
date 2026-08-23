import type { ConversationLifecycleV1 } from './types';

export const PARALLEL_RUNTIME_ATTACHMENT_LIMIT = 5;
export const SINGLE_RUNTIME_ATTACHMENT_LIMIT = 1;
export const RUNTIME_ATTACHMENT_CAPACITY_MESSAGE =
  'Five conversations are already working or waiting for you. Finish, answer, or stop one before starting another.';
export const SINGLE_RUNTIME_ATTACHMENT_CAPACITY_MESSAGE =
  'Another conversation is still working or waiting for you. Finish, answer, or stop it before starting this one.';

export interface RuntimeAttachmentCandidate {
  conversationId: string;
  lifecycle: ConversationLifecycleV1;
  lastUsedAt: number;
}

export type RuntimeAttachmentCapacityDecision =
  | { kind: 'available' }
  | { kind: 'evict'; conversationId: string }
  | { kind: 'blocked'; message: string };

export function decideRuntimeAttachmentCapacity(input: {
  attachments: RuntimeAttachmentCandidate[];
  incomingConversationId: string;
  currentConversationId: string | null;
  capacity: number;
}): RuntimeAttachmentCapacityDecision {
  const incomingAttached = input.attachments.some(
    (item) => item.conversationId === input.incomingConversationId,
  );
  if (input.attachments.length < input.capacity
    || (incomingAttached && input.attachments.length <= input.capacity)) {
    return { kind: 'available' };
  }

  const releasable = input.attachments
    .filter((item) => item.conversationId !== input.currentConversationId)
    .filter((item) => item.conversationId !== input.incomingConversationId)
    .filter((item) => item.lifecycle.state === 'idle' || item.lifecycle.state === 'interrupted')
    .sort((a, b) => a.lastUsedAt - b.lastUsedAt || a.conversationId.localeCompare(b.conversationId));
  if (releasable[0]) return { kind: 'evict', conversationId: releasable[0].conversationId };

  return {
    kind: 'blocked',
    message: input.capacity === 1
      ? SINGLE_RUNTIME_ATTACHMENT_CAPACITY_MESSAGE
      : RUNTIME_ATTACHMENT_CAPACITY_MESSAGE,
  };
}
