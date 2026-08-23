import assert from 'node:assert/strict';
import {
  decideRuntimeAttachmentCapacity,
  RUNTIME_ATTACHMENT_CAPACITY_MESSAGE,
  SINGLE_RUNTIME_ATTACHMENT_CAPACITY_MESSAGE,
} from './runtimeAttachmentPolicy';

const idle = { state: 'idle' } as const;
const working = (id: string) => ({ state: 'working', activeTurnId: id } as const);
const waiting = (id: string) => ({ state: 'needs-user', activeTurnId: id, attentionKind: 'question' } as const);

assert.deepEqual(decideRuntimeAttachmentCapacity({
  attachments: [{ conversationId: 'a', lifecycle: idle, lastUsedAt: 1 }],
  incomingConversationId: 'a',
  currentConversationId: 'a',
  capacity: 1,
}), { kind: 'available' });

assert.deepEqual(decideRuntimeAttachmentCapacity({
  attachments: [
    { conversationId: 'incoming', lifecycle: idle, lastUsedAt: 2 },
    { conversationId: 'old-idle', lifecycle: idle, lastUsedAt: 1 },
  ],
  incomingConversationId: 'incoming',
  currentConversationId: 'incoming',
  capacity: 1,
}), { kind: 'evict', conversationId: 'old-idle' }, 'reducing capacity also trims already-attached conversations');

assert.deepEqual(decideRuntimeAttachmentCapacity({
  attachments: [
    { conversationId: 'current', lifecycle: idle, lastUsedAt: 0 },
    { conversationId: 'older', lifecycle: idle, lastUsedAt: 1 },
    { conversationId: 'newer', lifecycle: idle, lastUsedAt: 2 },
  ],
  incomingConversationId: 'incoming',
  currentConversationId: 'current',
  capacity: 3,
}), { kind: 'evict', conversationId: 'older' }, 'current is protected and the oldest non-current idle attachment is released');

assert.deepEqual(decideRuntimeAttachmentCapacity({
  attachments: [
    { conversationId: 'a', lifecycle: working('ta'), lastUsedAt: 1 },
    { conversationId: 'b', lifecycle: waiting('tb'), lastUsedAt: 2 },
  ],
  incomingConversationId: 'incoming',
  currentConversationId: 'incoming',
  capacity: 2,
}), { kind: 'blocked', message: RUNTIME_ATTACHMENT_CAPACITY_MESSAGE });

assert.deepEqual(decideRuntimeAttachmentCapacity({
  attachments: [{ conversationId: 'a', lifecycle: working('ta'), lastUsedAt: 1 }],
  incomingConversationId: 'incoming',
  currentConversationId: 'incoming',
  capacity: 1,
}), { kind: 'blocked', message: SINGLE_RUNTIME_ATTACHMENT_CAPACITY_MESSAGE });

console.log('runtimeAttachmentPolicy.test.ts: all tests passed');
