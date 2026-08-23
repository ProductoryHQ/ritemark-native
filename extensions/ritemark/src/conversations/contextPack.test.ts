import assert from 'node:assert/strict';
import { buildNormalizedContextPack, truncateContextMessage } from './contextPack';
import { resolveProjectScope } from './projectScope';
import type { ConversationEventV1, ConversationRecordV1 } from './types';

const scope = resolveProjectScope({ folderUris: ['file:///fixtures/project'], platform: 'darwin' });

function base(events: ConversationEventV1[]): ConversationRecordV1 {
  return {
    schemaVersion: 1,
    conversationId: '00000000-0000-4000-8000-000000000001',
    scopeId: scope.scopeId,
    scope: scope.descriptor,
    title: 'Fallback fixture',
    identityColorSlot: 0,
    createdAt: '2026-08-23T10:00:00.000Z',
    lastActivityAt: '2026-08-23T10:10:00.000Z',
    revision: 1,
    bindingGeneration: 0,
    lifecycle: { state: 'working', activeTurnId: 'turn-current' },
    runtimeSummary: ['codex', 'claude-code'],
    events,
  };
}

function event(kind: ConversationEventV1['kind'], sequence: number, overrides: Record<string, unknown>): ConversationEventV1 {
  const common = {
    kind,
    eventId: `event-${sequence}`,
    turnId: `turn-${sequence}`,
    sequence,
    occurredAt: new Date(Date.UTC(2026, 7, 23, 10, 0, sequence)).toISOString(),
    runtimeId: 'codex',
    ...overrides,
  };
  return common as ConversationEventV1;
}

function fixture(): ConversationRecordV1 {
  return base([
    event('user-message', 0, { turnId: 'turn-purpose', text: 'Build durable history', mode: 'agent', attachments: [{ name: 'secret.pdf', kind: 'pdf', mediaType: 'application/pdf', sizeBytes: 999 }] }),
    event('dispatch-receipt', 1, { turnId: 'turn-purpose', dispatchState: 'accepted' }),
    event('activity', 2, { turnId: 'turn-purpose', title: 'Read secret.pdf', status: 'done', fileReferences: ['secret.pdf'], planSteps: [] }),
    event('assistant-message', 3, { turnId: 'turn-purpose', content: 'History is durable.', terminalStatus: 'completed' }),
    event('user-message', 4, { turnId: 'turn-unanswered', text: 'Codex is down; keep this request', mode: 'agent', attachments: [] }),
    event('dispatch-receipt', 5, { turnId: 'turn-unanswered', dispatchState: 'not-sent' }),
    event('dispatch-receipt', 6, { turnId: 'turn-unanswered', dispatchState: 'ambiguous' }),
    event('attention', 7, { turnId: 'turn-unanswered', attentionKind: 'approval', prompt: 'Allow write?', summary: null, attentionState: 'pending' }),
    event('assistant-message', 8, { turnId: 'turn-unanswered', content: 'partial provider text', terminalStatus: 'failed' }),
    event('user-message', 9, { turnId: 'turn-current', runtimeId: 'claude-code', text: 'Solve it yourself', mode: 'agent', attachments: [] }),
    event('dispatch-receipt', 10, { turnId: 'turn-current', runtimeId: 'claude-code', dispatchState: 'not-sent' }),
  ]);
}

function run(): void {
  const record = fixture();
  const pack = buildNormalizedContextPack(record, { beforeEventId: 'event-9' });
  assert.ok(pack);
  assert.match(pack.text, /Build durable history/);
  assert.match(pack.text, /History is durable/);
  assert.match(pack.text, /Codex is down; keep this request/);
  assert.match(pack.text, /dispatch=ambiguous · unanswered/);
  assert.doesNotMatch(pack.text, /Solve it yourself/);
  assert.doesNotMatch(pack.text, /partial provider text/);
  assert.doesNotMatch(pack.text, /Allow write/);
  assert.doesNotMatch(pack.text, /Read secret\.pdf/);
  assert.doesNotMatch(pack.text, /999/);
  assert.equal(pack.coveredThroughEventId, 'event-3');

  const delta = buildNormalizedContextPack(record, {
    afterEventId: 'event-3',
    beforeEventId: 'event-9',
  });
  assert.ok(delta);
  assert.doesNotMatch(delta.text, /Build durable history/);
  assert.match(delta.text, /Codex is down; keep this request/);

  const largeEvents: ConversationEventV1[] = [];
  for (let index = 0; index < 10; index += 1) {
    largeEvents.push(event('user-message', index * 2, {
      turnId: `large-${index}`,
      text: `${index}:${'🙂'.repeat(4000)}`,
      mode: 'agent',
      attachments: [],
    }));
    largeEvents.push(event('assistant-message', index * 2 + 1, {
      turnId: `large-${index}`,
      content: `answer-${index}:${'x'.repeat(16000)}`,
      terminalStatus: 'completed',
    }));
  }
  const largeRecord = base(largeEvents);
  const first = buildNormalizedContextPack(largeRecord);
  const second = buildNormalizedContextPack(largeRecord);
  assert.ok(first && second);
  assert.equal(first.text, second.text, 'same record yields byte-for-byte deterministic context');
  assert.ok(Buffer.byteLength(first.text, 'utf8') <= 32_000);
  assert.equal(first.truncated, true);
  assert.ok(first.omittedEventCount > 0);
  assert.match(first.text, /0:/, 'first user purpose is retained');
  assert.match(first.text, /answer-9:/, 'newest complete turn is retained');
  assert.match(first.text, /middle of this message omitted/);
  assert.equal(first.text.includes('\uFFFD'), false, 'UTF-8 truncation does not split a code point');

  const truncated = truncateContextMessage(`head-${'õ'.repeat(100)}-tail`, 80);
  assert.ok(Buffer.byteLength(truncated, 'utf8') <= 80);
  assert.match(truncated, /^head-/);
  assert.match(truncated, /-tail$/);

  assert.equal(buildNormalizedContextPack(base([
    event('activity', 0, { title: 'tool only', status: null, fileReferences: [], planSteps: [] }),
  ])), null);

  console.log('contextPack.test.ts: all tests passed');
}

run();
