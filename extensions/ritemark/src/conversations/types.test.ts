import assert from 'node:assert/strict';
import { decodeConversationRecordV1, type ConversationRecordV1 } from './types';
import { resolveProjectScope } from './projectScope';

const scope = resolveProjectScope({ folderUris: ['file:///fixtures/project'], platform: 'darwin' });

function record(): ConversationRecordV1 {
  return {
    schemaVersion: 1,
    conversationId: '00000000-0000-4000-8000-000000000001',
    scopeId: scope.scopeId,
    scope: scope.descriptor,
    title: 'Plan the release',
    identityColorSlot: 0,
    createdAt: '2026-08-22T10:00:00.000Z',
    lastActivityAt: '2026-08-22T10:01:00.000Z',
    revision: 1,
    bindingGeneration: 0,
    lifecycle: { state: 'idle' },
    runtimeSummary: ['codex'],
    events: [{
      kind: 'user-message',
      eventId: 'event-1',
      turnId: 'turn-1',
      sequence: 0,
      occurredAt: '2026-08-22T10:00:00.000Z',
      runtimeId: 'codex',
      text: 'Plan it',
      mode: 'agent',
      attachments: [{ name: 'brief.md', kind: 'file', mediaType: 'text/markdown', sizeBytes: 123 }],
    }],
  };
}

function run(): void {
  assert.deepEqual(decodeConversationRecordV1(JSON.parse(JSON.stringify(record()))), record());
  assert.throws(() => decodeConversationRecordV1({ ...record(), schemaVersion: 2 }), /schemaVersion must be 1/);
  assert.throws(() => decodeConversationRecordV1({ ...record(), conversationId: '../escape' }), /conversationId must be a UUID/);
  assert.throws(() => decodeConversationRecordV1({ ...record(), scopeId: 'project-a' }), /scopeId must be a ps1 scope id/);
  assert.throws(() => decodeConversationRecordV1({ ...record(), identityColorSlot: 24 }), /identityColorSlot must be an integer from 0 to 23/);
  assert.throws(() => decodeConversationRecordV1({ ...record(), runtimeSummary: [] }), /include every event runtime/);
  const duplicate = record();
  duplicate.events.push({ ...duplicate.events[0], sequence: 1 });
  assert.throws(() => decodeConversationRecordV1(duplicate), /unique eventId values/);
  console.log('types.test.ts: all tests passed');
}

run();
