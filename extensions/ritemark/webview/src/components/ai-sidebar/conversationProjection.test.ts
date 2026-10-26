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
  composerPreferences: { thinkingEffortByRuntime: { codex: 'high' } },
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
    {
      kind: 'boundary', eventId: 'boundary-1', turnId: 'turn-1', sequence: 3,
      occurredAt: '2026-08-23T10:03:01.000Z', runtimeId: 'codex',
      boundaryKind: 'context-restored',
      message: 'Continuing with Codex. Previous messages were included as context.',
    },
  ],
};

const restored = projectionToConversation(projection);
assert.equal(restored.codexConversation.length, 1);
assert.equal(restored.codexConversation[0].userPrompt, 'Visible user request');
assert.equal(restored.codexConversation[0].streamingText, 'Proposed plan\n\nImplemented result');
assert.equal(restored.codexConversation[0].result?.status, 'completed');
assert.deepEqual(restored.transcriptBoundaries, [{
  id: 'boundary-1',
  turnId: 'turn-1',
  runtimeId: 'codex',
  timestamp: Date.parse('2026-08-23T10:03:01.000Z'),
  message: 'Continuing with Codex. Previous messages were included as context.',
}]);

const authProjection = structuredClone(projection);
authProjection.revision += 2;
authProjection.lifecycle = { state: 'interrupted', turnId: 'turn-auth', reason: 'failed' };
authProjection.runtimeSummary.push('claude-code');
authProjection.events.push(
  {
    kind: 'user-message', eventId: 'user-auth', turnId: 'turn-auth', sequence: 4,
    occurredAt: '2026-08-23T10:04:00.000Z', runtimeId: 'claude-code',
    text: 'Continue with Claude', mode: 'agent', attachments: [],
  },
  {
    kind: 'boundary', eventId: 'boundary-auth', turnId: 'turn-auth', sequence: 5,
    occurredAt: '2026-08-23T10:04:01.000Z', runtimeId: 'claude-code',
    boundaryKind: 'failed',
    message: 'Claude did not accept your API key. Update it in AI Settings, then resend your message.',
    failureKind: 'api-key-authentication',
  },
);
const restoredAuth = projectionToConversation(authProjection);
const restoredAuthTurn = restoredAuth.agentConversation[restoredAuth.agentConversation.length - 1];
assert.equal(restoredAuthTurn?.result?.failureKind, 'api-key-authentication');
assert.equal(
  restoredAuthTurn?.result?.error,
  'Claude did not accept your API key. Update it in AI Settings, then resend your message.',
  'reload restores the friendly error and API-key recovery category from the canonical boundary',
);

// Sprint 136 (#488): a restored Claude turn keeps its working time, and an
// older record without one gets no metrics, so the status line says "Done".
const timedProjection = structuredClone(projection);
timedProjection.runtimeSummary = ['claude-code'];
timedProjection.events = [
  {
    kind: 'user-message', eventId: 'user-t1', turnId: 'turn-t1', sequence: 0,
    occurredAt: '2026-08-23T10:00:00.000Z', runtimeId: 'claude-code',
    text: 'Sum up the brief', mode: 'agent', attachments: [],
  },
  {
    kind: 'assistant-message', eventId: 'assistant-t1', turnId: 'turn-t1', sequence: 1,
    occurredAt: '2026-08-23T10:00:30.000Z', runtimeId: 'claude-code',
    content: 'The brief asks for four modules.', terminalStatus: 'completed', activeDurationMs: 8000,
  },
  {
    kind: 'user-message', eventId: 'user-t2', turnId: 'turn-t2', sequence: 2,
    occurredAt: '2026-08-23T10:01:00.000Z', runtimeId: 'claude-code',
    text: 'And the budget?', mode: 'agent', attachments: [],
  },
  {
    kind: 'assistant-message', eventId: 'assistant-t2', turnId: 'turn-t2', sequence: 3,
    occurredAt: '2026-08-23T10:01:20.000Z', runtimeId: 'claude-code',
    content: 'It is in Budget.csv.', terminalStatus: 'completed',
  },
];
const timed = projectionToConversation(timedProjection);
assert.equal(timed.agentConversation[0].result?.metrics?.durationMs, 8000, 'the saved working time comes back');
assert.equal(timed.agentConversation[1].result?.metrics, undefined, 'no saved time: no metrics, never a zero');

// Sprint 139 (#376, S21): a restored failed turn says the same sentence and draws the same card.
const failedProjection = structuredClone(projection);
failedProjection.lifecycle = { state: 'interrupted', turnId: 'turn-model', reason: 'failed' };
failedProjection.runtimeSummary = ['codex', 'claude-code'];
failedProjection.events.push(
  {
    kind: 'user-message', eventId: 'user-model', turnId: 'turn-model', sequence: 4,
    occurredAt: '2026-08-23T10:05:00.000Z', runtimeId: 'codex', text: 'Again', mode: 'agent', attachments: [],
  },
  {
    kind: 'boundary', eventId: 'boundary-model', turnId: 'turn-model', sequence: 5,
    occurredAt: '2026-08-23T10:05:01.000Z', runtimeId: 'codex', boundaryKind: 'failed',
    message: "ChatGPT couldn't use GPT-6.1 Sol. It isn't available in Ritemark right now.",
    errorKind: 'model', errorDetail: { model: 'gpt-6.1-sol' },
  },
  {
    kind: 'user-message', eventId: 'user-net', turnId: 'turn-net', sequence: 6,
    occurredAt: '2026-08-23T10:06:00.000Z', runtimeId: 'claude-code', text: 'Hi', mode: 'agent', attachments: [],
  },
  {
    kind: 'boundary', eventId: 'boundary-net', turnId: 'turn-net', sequence: 7,
    occurredAt: '2026-08-23T10:06:01.000Z', runtimeId: 'claude-code', boundaryKind: 'failed',
    message: "Ritemark couldn't reach Claude. Check your connection, then send your message again.", errorKind: 'network',
  },
);
const restoredFailed = projectionToConversation(failedProjection);
assert.deepEqual(restoredFailed.codexConversation[1].result, {
  status: 'failed',
  error: "ChatGPT couldn't use GPT-6.1 Sol. It isn't available in Ritemark right now.",
  errorKind: 'model',
  errorDetail: { model: 'gpt-6.1-sol' },
}, "ChatGPT's restored failure keeps its sentence and card (2.0 restored only the status)");
assert.equal(restoredFailed.agentConversation[0].result?.errorKind, 'network');
assert.equal(restoredFailed.codexConversation[0].result?.error, undefined, 'a completed turn carries no failure');

console.log('conversationProjection.test.ts: all tests passed');
