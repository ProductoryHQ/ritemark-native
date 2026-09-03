import assert from 'node:assert/strict';
import { decodeConversationRecordV1, type ConversationRecordV1 } from './types';
import { resolveProjectScope } from './projectScope';
import type { RuntimeContinuationDescriptorV1 } from '../runtime/continuation';

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
    composerPreferences: { thinkingEffortByRuntime: {} },
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
      thinkingEffort: 'auto',
    }],
  };
}

function descriptor(overrides: Partial<RuntimeContinuationDescriptorV1> = {}): RuntimeContinuationDescriptorV1 {
  return {
    descriptorVersion: 1,
    runtimeId: 'codex',
    nativeReference: 'thread-secret',
    scopeId: scope.scopeId,
    runtimeVersion: '0.144.4',
    adapterContractVersion: 1,
    modelId: 'gpt-5.6-codex',
    compatibilityFingerprint: 'host-hmac',
    coveredThroughEventId: 'assistant-1',
    capturedAt: '2026-08-22T10:01:00.000Z',
    ...overrides,
  };
}

function run(): void {
  assert.deepEqual(decodeConversationRecordV1(JSON.parse(JSON.stringify(record()))), record());
  const preSprint112 = JSON.parse(JSON.stringify(record())) as Record<string, unknown>;
  delete preSprint112.composerPreferences;
  delete (preSprint112.events as Array<Record<string, unknown>>)[0].thinkingEffort;
  const upgraded = decodeConversationRecordV1(preSprint112);
  assert.deepEqual(upgraded.composerPreferences, { thinkingEffortByRuntime: {} });
  assert.equal(upgraded.events[0].kind === 'user-message' && upgraded.events[0].thinkingEffort, 'auto');
  assert.throws(() => decodeConversationRecordV1({ ...record(), schemaVersion: 2 }), /schemaVersion must be 1/);
  assert.throws(() => decodeConversationRecordV1({ ...record(), conversationId: '../escape' }), /conversationId must be a UUID/);
  assert.throws(() => decodeConversationRecordV1({ ...record(), scopeId: 'project-a' }), /scopeId must be a ps1 scope id/);
  assert.throws(() => decodeConversationRecordV1({ ...record(), identityColorSlot: 24 }), /identityColorSlot must be an integer from 0 to 23/);

  const affectedRcRecord = record();
  const affectedUser = affectedRcRecord.events[0];
  if (affectedUser.kind !== 'user-message') throw new Error('missing user fixture');
  affectedUser.runtimeId = 'claude-code';
  affectedRcRecord.title = 'Failed to authenticate: OAuth session expired';
  affectedRcRecord.runtimeSummary = ['claude-code'];
  affectedRcRecord.events.push({
    kind: 'assistant-message',
    eventId: 'assistant-auth',
    turnId: affectedUser.turnId,
    sequence: 1,
    occurredAt: '2026-09-03T05:10:24.405Z',
    runtimeId: 'claude-code',
    content: 'Failed to authenticate: OAuth session expired and could not be refreshed',
    terminalStatus: 'completed',
    appliedThinkingEffort: null,
  });
  affectedRcRecord.continuations = {
    'claude-code': {
      ...descriptor(),
      runtimeId: 'claude-code',
      coveredThroughEventId: 'assistant-auth',
    },
  };
  const repairedRcRecord = decodeConversationRecordV1(JSON.parse(JSON.stringify(affectedRcRecord)));
  const repairedAuth = repairedRcRecord.events[1];
  assert.deepEqual(repairedAuth, {
    ...affectedRcRecord.events[1],
    content: '',
    terminalStatus: 'failed',
    error: 'Failed to authenticate: OAuth session expired and could not be refreshed',
    failureKind: 'authentication',
  }, 'affected RC records recover into a durable OAuth failure instead of model text');
  assert.equal(repairedRcRecord.title, 'Plan it', 'a provider error can no longer remain the conversation title');
  assert.deepEqual(repairedRcRecord.lifecycle, {
    state: 'interrupted',
    turnId: affectedUser.turnId,
    reason: 'failed',
  });
  assert.equal(repairedRcRecord.continuations, undefined, 'the invalid auth session cannot be resumed');

  const explanatoryAnswer = structuredClone(affectedRcRecord);
  const explanatoryEvent = explanatoryAnswer.events[1];
  if (explanatoryEvent.kind !== 'assistant-message') throw new Error('missing assistant fixture');
  explanatoryEvent.content = 'I can explain why you saw “Failed to authenticate: OAuth session expired”.';
  const decodedExplanation = decodeConversationRecordV1(explanatoryAnswer).events[1];
  assert.equal(
    decodedExplanation.kind === 'assistant-message' ? decodedExplanation.terminalStatus : null,
    'completed',
    'normal Claude prose that discusses auth remains a completed answer',
  );
  assert.throws(() => decodeConversationRecordV1({ ...record(), runtimeSummary: [] }), /include every event runtime/);
  const duplicate = record();
  duplicate.events.push({ ...duplicate.events[0], sequence: 1 });
  assert.throws(() => decodeConversationRecordV1(duplicate), /unique eventId values/);

  const resumable = record();
  resumable.events.push(
    {
      kind: 'dispatch-receipt',
      eventId: 'receipt-not-sent',
      turnId: 'turn-1',
      sequence: 1,
      occurredAt: '2026-08-22T10:00:01.000Z',
      runtimeId: 'codex',
      dispatchState: 'not-sent',
    },
    {
      kind: 'dispatch-receipt',
      eventId: 'receipt-ambiguous',
      turnId: 'turn-1',
      sequence: 2,
      occurredAt: '2026-08-22T10:00:02.000Z',
      runtimeId: 'codex',
      dispatchState: 'ambiguous',
    },
    {
      kind: 'dispatch-receipt',
      eventId: 'receipt-accepted',
      turnId: 'turn-1',
      sequence: 3,
      occurredAt: '2026-08-22T10:00:03.000Z',
      runtimeId: 'codex',
      dispatchState: 'accepted',
    },
    {
      kind: 'assistant-message',
      eventId: 'assistant-1',
      turnId: 'turn-1',
      sequence: 4,
      occurredAt: '2026-08-22T10:01:00.000Z',
      runtimeId: 'codex',
      content: 'Done',
      terminalStatus: 'completed',
      appliedThinkingEffort: null,
    },
  );
  resumable.continuations = { codex: descriptor() };
  assert.deepEqual(decodeConversationRecordV1(resumable), resumable);

  const skippedReceipt = structuredClone(resumable);
  skippedReceipt.events = skippedReceipt.events.filter(
    (event) => event.kind !== 'dispatch-receipt' || event.dispatchState !== 'ambiguous',
  );
  assert.throws(() => decodeConversationRecordV1(skippedReceipt), /ordered as not-sent, ambiguous, accepted/);

  const receiptBeforeUser = structuredClone(resumable);
  receiptBeforeUser.events[0] = { ...receiptBeforeUser.events[1], sequence: 0 };
  receiptBeforeUser.events[1] = { ...resumable.events[0], sequence: 1 };
  assert.throws(() => decodeConversationRecordV1(receiptBeforeUser), /follow a matching user message/);

  const wrongMapKey = structuredClone(resumable);
  wrongMapKey.continuations = { 'claude-code': descriptor() };
  assert.throws(() => decodeConversationRecordV1(wrongMapKey), /equal to map key claude-code/);

  const wrongScope = structuredClone(resumable);
  wrongScope.continuations = { codex: descriptor({ scopeId: `ps1-${'f'.repeat(40)}` }) };
  assert.throws(() => decodeConversationRecordV1(wrongScope), /equal to record scopeId/);

  const wrongWatermark = structuredClone(resumable);
  wrongWatermark.continuations = { codex: descriptor({ coveredThroughEventId: 'event-1' }) };
  assert.throws(() => decodeConversationRecordV1(wrongWatermark), /a completed assistant event in the canonical transcript/);

  const crossRuntimeWatermark = structuredClone(resumable);
  const crossRuntimeAssistant = crossRuntimeWatermark.events.find(
    (event) => event.eventId === 'assistant-1',
  );
  if (!crossRuntimeAssistant || crossRuntimeAssistant.kind !== 'assistant-message') {
    throw new Error('missing cross-runtime assistant fixture');
  }
  crossRuntimeAssistant.runtimeId = 'claude-code';
  crossRuntimeWatermark.runtimeSummary = ['codex', 'claude-code'];
  crossRuntimeWatermark.continuations = { codex: descriptor({ coveredThroughEventId: 'assistant-1' }) };
  assert.doesNotThrow(
    () => decodeConversationRecordV1(crossRuntimeWatermark),
    'a native session may cover canonical fallback context authored by another runtime',
  );

  const legacy = JSON.parse(JSON.stringify(record())) as Record<string, unknown>;
  legacy.continuation = {
    runtimeId: 'codex',
    nativeReference: 'old-thread',
    compatibilityVersion: 1,
    capturedAt: '2026-08-22T10:00:00.000Z',
  };
  const migratedLegacy = decodeConversationRecordV1(legacy);
  assert.equal(migratedLegacy.continuations?.codex?.runtimeVersion, 'legacy-unknown');
  assert.equal(migratedLegacy.continuations?.codex?.compatibilityFingerprint, 'legacy-incompatible');
  assert.equal(migratedLegacy.continuations?.codex?.coveredThroughEventId, null);
  console.log('types.test.ts: all tests passed');
}

run();
