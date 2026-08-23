import assert from 'node:assert/strict';
import type { ConversationProjectionV1 } from '../../../../src/conversations/protocol';
import { projectionToConversation } from './conversationProjection';

const projection: ConversationProjectionV1 = {
  schemaVersion: 1,
  conversationId: '00000000-0000-4000-8000-000000000001',
  scopeId: 'ps1-0000000000000000000000000000000000000000',
  scope: { kind: 'single-root', workspaceFileUri: null, folderUris: ['file:///project'] },
  title: 'Visible title',
  identityColorSlot: 0,
  createdAt: '2026-08-23T10:00:00.000Z',
  lastActivityAt: '2026-08-23T10:03:00.000Z',
  revision: 3,
  bindingGeneration: 0,
  lifecycle: { state: 'idle' },
  runtimeSummary: ['codex'],
  events: [
    {
      kind: 'user-message', eventId: 'user-1', turnId: 'turn-1', sequence: 0,
      occurredAt: '2026-08-23T10:00:00.000Z', runtimeId: 'codex',
      text: 'Visible user request', mode: 'plan', attachments: [],
    },
    {
      kind: 'assistant-message', eventId: 'assistant-1', turnId: 'turn-1', sequence: 1,
      occurredAt: '2026-08-23T10:01:00.000Z', runtimeId: 'codex',
      content: 'Proposed plan', terminalStatus: 'completed',
    },
    {
      kind: 'assistant-message', eventId: 'assistant-2', turnId: 'turn-1', sequence: 2,
      occurredAt: '2026-08-23T10:03:00.000Z', runtimeId: 'codex',
      content: 'Implemented result', terminalStatus: 'completed',
    },
  ],
};

const restored = projectionToConversation(projection);
assert.equal(restored.codexConversation.length, 1);
assert.equal(restored.codexConversation[0].userPrompt, 'Visible user request');
assert.equal(restored.codexConversation[0].streamingText, 'Proposed plan\n\nImplemented result');
assert.equal(restored.codexConversation[0].result?.status, 'completed');
assert.equal(restored.restoredTranscript, true);

console.log('conversationProjection.test.ts: all tests passed');
