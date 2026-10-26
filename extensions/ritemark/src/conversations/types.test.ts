import assert from 'node:assert/strict';
import { decodeConversationRecordV1, turnActiveDurationMs, withSavedModel, type ConversationRecordV1 } from './types';
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

  // Sprint 136 (#488): a turn's working time survives the store, and a bad one is refused.
  const timed = record();
  timed.events.push({
    kind: 'assistant-message', eventId: 'assistant-timed', turnId: 'turn-1', sequence: 1,
    occurredAt: '2026-08-22T10:00:09.000Z', runtimeId: 'codex',
    content: 'Planned', terminalStatus: 'completed', appliedThinkingEffort: null, activeDurationMs: 8000,
  });
  assert.deepEqual(decodeConversationRecordV1(JSON.parse(JSON.stringify(timed))), timed);
  const badTime = JSON.parse(JSON.stringify(timed)) as { events: Array<Record<string, unknown>> };
  badTime.events[1].activeDurationMs = -1;
  assert.throws(() => decodeConversationRecordV1(badTime), /activeDurationMs/);
  assert.equal(turnActiveDurationMs({ durationMs: 9500, waitedMs: 1500 }), 8000, 'waiting on the person is not working time');
  assert.equal(turnActiveDurationMs({ durationMs: 8000 }), 8000);
  assert.equal(turnActiveDurationMs({ durationMs: 0 }), undefined, "the host's stand-in is no time at all");
  assert.equal(turnActiveDurationMs(undefined), undefined);
  assert.equal(turnActiveDurationMs({ durationMs: 1000, waitedMs: 3000 }), 0, 'never negative');

  // Sprint 139 (E1, E2): a failure's kind and card data survive the store, read leniently.
  const failed = record();
  failed.events.push({
    kind: 'assistant-message', eventId: 'assistant-failed', turnId: 'turn-1', sequence: 1,
    occurredAt: '2026-08-22T10:00:09.000Z', runtimeId: 'codex',
    content: 'Partial', terminalStatus: 'failed', appliedThinkingEffort: null,
    error: "ChatGPT couldn't use GPT-6.1 Sol. It isn't available in Ritemark right now.",
    errorKind: 'model', errorDetail: { model: 'gpt-6.1-sol' },
  });
  failed.events.push({
    kind: 'boundary', eventId: 'boundary-failed', turnId: 'turn-1', sequence: 2,
    occurredAt: '2026-08-22T10:00:10.000Z', runtimeId: 'codex', boundaryKind: 'failed',
    message: "Ritemark couldn't reach ChatGPT. Check your connection, then send your message again.", errorKind: 'network',
  });
  assert.deepEqual(decodeConversationRecordV1(JSON.parse(JSON.stringify(failed))), failed);
  const futureKinds = JSON.parse(JSON.stringify(failed)) as { events: Array<Record<string, unknown>> };
  futureKinds.events[1].errorKind = 'plan-from-a-later-build';
  futureKinds.events[1].errorDetail = { model: 7, somethingNew: true };
  futureKinds.events[2].errorDetail = { billing: 'mars' };
  const readBack = decodeConversationRecordV1(futureKinds);
  const readAssistant = readBack.events[1] as { errorKind?: string; errorDetail?: unknown; error?: string };
  assert.equal(readAssistant.errorKind, undefined, 'an unknown kind is dropped, never a quarantine');
  assert.equal(readAssistant.errorDetail, undefined);
  assert.equal(readAssistant.error, failed.events[1].kind === 'assistant-message' ? failed.events[1].error : '', 'the sentence stays');
  assert.equal((readBack.events[2] as { errorKind?: string }).errorKind, 'network');
  assert.equal((readBack.events[2] as { errorDetail?: unknown }).errorDetail, undefined, 'an unknown provider is dropped');
  const strictStill = JSON.parse(JSON.stringify(failed)) as { events: Array<Record<string, unknown>> };
  strictStill.events[1].failureKind = 'model';
  assert.throws(() => decodeConversationRecordV1(strictStill), /failureKind/, 'failureKind stays strict, as every 2.x build reads it');

  // Sprint 139 (#417, R6, E2): a chat's saved model, read leniently.
  const withModel = record();
  withModel.composerPreferences = { thinkingEffortByRuntime: {}, modelByRuntime: { codex: 'gpt-6-luna', opencode: 'google/gemini-4-argon' } };
  assert.deepEqual(decodeConversationRecordV1(JSON.parse(JSON.stringify(withModel))), withModel);
  const oddModels = JSON.parse(JSON.stringify(withModel)) as { composerPreferences: Record<string, unknown> };
  oddModels.composerPreferences.modelByRuntime = { codex: 42, opencode: 'x'.repeat(300), 'claude-code': 'claude-sonnet-5', gemini: 'flash', '': 'y' };
  assert.deepEqual(
    decodeConversationRecordV1(oddModels).composerPreferences,
    { thinkingEffortByRuntime: {}, modelByRuntime: { 'claude-code': 'claude-sonnet-5' } },
    'what this build can not use is dropped, never a quarantine',
  );
  const notAMap = JSON.parse(JSON.stringify(withModel)) as { composerPreferences: Record<string, unknown> };
  notAMap.composerPreferences.modelByRuntime = ['gpt'];
  assert.deepEqual(decodeConversationRecordV1(notAMap).composerPreferences, { thinkingEffortByRuntime: {} });
  assert.deepEqual(withSavedModel({ thinkingEffortByRuntime: {} }, 'codex', 'gpt-6-luna'), { thinkingEffortByRuntime: {}, modelByRuntime: { codex: 'gpt-6-luna' } });
  const unchanged = { thinkingEffortByRuntime: {}, modelByRuntime: { codex: 'gpt-6-luna' } };
  assert.equal(withSavedModel(unchanged, 'codex', 'gpt-6-luna'), unchanged, 'the same model is no change');
  assert.equal(withSavedModel(unchanged, 'codex', undefined), unchanged);

  console.log('types.test.ts: all tests passed');
}

run();
