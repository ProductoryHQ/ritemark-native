import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConversationController } from './ConversationController';
import { ConversationStore, ConversationStoreError } from './ConversationStore';
import { LegacyConversationMigrator } from './LegacyConversationMigrator';
import { resolveProjectScope, unassignedLegacyScope } from './projectScope';
import type { ConversationHostEvent } from './protocol';

function uuid(value: number): string {
  return `10000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}

async function run(): Promise<void> {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-conversation-controller-'));
  const scope = resolveProjectScope({ folderUris: ['file:///fixtures/project'], platform: 'darwin' });
  const otherScope = resolveProjectScope({ folderUris: ['file:///fixtures/other'], platform: 'darwin' });
  let nextId = 1;
  const randomId = () => uuid(nextId++);
  const store = new ConversationStore(temp, {
    randomId,
    now: () => new Date('2026-08-22T14:00:00.000Z'),
  });
  const emitted: ConversationHostEvent[] = [];
  const dispatchOrder: string[] = [];
  const stopped: string[] = [];
  let hostAuthorityMarks = 0;
  const controller = new ConversationController({
    store,
    migrator: new LegacyConversationMigrator(store),
    markHostAuthority: async () => { hostAuthorityMarks += 1; },
    currentScope: () => scope,
    randomId,
    now: () => new Date('2026-08-22T14:00:00.000Z'),
    emit: (event) => emitted.push(event),
    stopConversation: async (conversationId) => { stopped.push(conversationId); },
    dispatchAcceptedTurn: async (_request, record) => {
      const durable = await store.get(record.conversationId);
      assert.ok(durable, 'the accepted user turn exists before runtime dispatch');
      assert.equal(durable.events[0].kind, 'user-message');
      assert.equal(durable.events[1].kind, 'dispatch-receipt');
      if (durable.events[1].kind === 'dispatch-receipt') {
        assert.equal(durable.events[1].dispatchState, 'not-sent');
      }
      dispatchOrder.push(record.conversationId);
    },
  });

  try {
    assert.equal(await controller.currentRolloutMode(), 'host-canonical');

    const emptyMigration = await controller.handle({
      type: 'legacy/import-batch',
      requestId: 'empty-migration',
      records: [],
    });
    assert.equal(emptyMigration.ok, true);
    assert.equal(hostAuthorityMarks, 1, 'an empty legacy inventory still completes monotonic host cutover');

    const failedMigration = await controller.handle({
      type: 'legacy/import-batch',
      requestId: 'failed-migration',
      records: [{
        sourceKey: 'ritemark-chat-invalid',
        sourceId: 'invalid',
        data: {},
      }],
    });
    assert.equal(failedMigration.ok, true);
    assert.equal(
      hostAuthorityMarks,
      1,
      'a non-empty inventory whose every candidate fails must retain legacy authority',
    );

    const invalid = await controller.handle({
      type: 'conversation/list',
      requestId: 'invalid',
      injectedScopeId: otherScope.scopeId,
    });
    assert.equal(invalid.ok, false, 'unknown webview fields are rejected');

    const first = await controller.handle({
      type: 'conversation/accept-turn',
      requestId: 'first',
      turnId: 'ui-turn-1',
      agentId: 'codex',
      text: 'Create a durable first conversation',
      thinkingEffort: 'high',
      attachments: [{ id: 'a1', name: 'brief.md', kind: 'text', mediaType: 'text/markdown', sizeBytes: 10, data: 'secret body' }],
    });
    assert.equal(first.ok, true);
    if (!first.ok || !('conversation' in first.data)) throw new Error('missing first record');
    const firstRecord = first.data.conversation;
    if (!firstRecord) throw new Error('missing first projection');
    assert.deepEqual(firstRecord.events[0].kind === 'user-message' ? firstRecord.events[0].attachments : [], [{
      name: 'brief.md', kind: 'text', mediaType: 'text/markdown', sizeBytes: 10,
    }], 'attachment bytes never enter the durable projection');
    assert.equal(JSON.stringify(firstRecord).includes('secret body'), false);
    assert.equal(firstRecord.events[0].turnId, 'ui-turn-1', 'host and webview share one turn identity');
    assert.equal(
      firstRecord.events[0].kind === 'user-message' ? firstRecord.events[0].thinkingEffort : null,
      'high',
      'accepted turn persists its immutable effort snapshot',
    );
    assert.equal(firstRecord.composerPreferences.thinkingEffortByRuntime.codex, 'high');
    assert.equal(
      firstRecord.events.some((event) => event.kind === 'dispatch-receipt'),
      false,
      'host-only dispatch certainty never crosses into the webview projection',
    );
    assert.deepEqual(dispatchOrder, [firstRecord.conversationId]);

    const changedPreference = await controller.handle({
      type: 'conversation/set-composer-preference',
      requestId: 'set-effort-preference',
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      agentId: 'claude-code',
      thinkingEffort: 'max',
    });
    assert.equal(changedPreference.ok, true);
    if (!changedPreference.ok || !('conversation' in changedPreference.data)) throw new Error('missing preference projection');
    assert.equal(changedPreference.data.conversation.composerPreferences.thinkingEffortByRuntime['claude-code'], 'max');

    const unknownEffort = await controller.handle({
      type: 'conversation/set-composer-preference',
      requestId: 'bad-effort-preference',
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      agentId: 'codex',
      thinkingEffort: 'enormous',
    });
    assert.equal(unknownEffort.ok, false, 'unknown effort values fail closed at the typed protocol boundary');

    await controller.markRuntimeDispatch({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'codex',
      turnId: 'ui-turn-1',
      state: 'ambiguous',
    });
    const acceptedDispatch = await controller.markRuntimeDispatch({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'codex',
      turnId: 'ui-turn-1',
      state: 'accepted',
    });
    const acceptedAgain = await controller.markRuntimeDispatch({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'codex',
      turnId: 'ui-turn-1',
      state: 'accepted',
    });
    assert.equal(acceptedAgain.revision, acceptedDispatch.revision, 'duplicate provider acceptance is idempotent');
    assert.deepEqual(
      acceptedDispatch.events
        .filter((event) => event.kind === 'dispatch-receipt')
        .map((event) => event.kind === 'dispatch-receipt' ? event.dispatchState : null),
      ['not-sent', 'ambiguous', 'accepted'],
    );

    const checkpointedFirst = await controller.checkpointRuntimeContinuation({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'codex',
      descriptor: {
        descriptorVersion: 1,
        runtimeId: 'codex',
        nativeReference: 'host-only-thread-id',
        scopeId: scope.scopeId,
        runtimeVersion: '0.144.4',
        adapterContractVersion: 1,
        modelId: 'gpt-5.6-codex',
        compatibilityFingerprint: 'host-only-hmac',
        coveredThroughEventId: null,
        capturedAt: '2026-08-22T13:59:00.000Z',
      },
    });
    assert.equal(JSON.stringify(checkpointedFirst).includes('host-only-thread-id'), true);

    const completedFirst = await controller.completeRuntimeTurn({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'codex',
      text: 'The durable history implementation is ready.',
      status: 'completed',
      generateTitle: async ({ userPrompt, assistantResponse }) => {
        assert.equal(userPrompt, 'Create a durable first conversation');
        assert.equal(assistantResponse, 'The durable history implementation is ready.');
        return 'Durable project chat history';
      },
    });
    assert.equal(completedFirst.title, 'Durable project chat history');
    assert.equal(completedFirst.events.at(-1)?.kind, 'assistant-message');
    assert.equal(
      completedFirst.continuations?.codex?.coveredThroughEventId,
      completedFirst.events.find((event) => event.kind === 'assistant-message')?.eventId,
      'coverage advances atomically with a completed assistant final',
    );
    const transcriptRestored = await controller.recordTranscriptRestored({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'codex',
      turnId: 'ui-turn-1',
      truncated: false,
      unansweredPriorRequest: false,
    });
    const restoredBoundary = transcriptRestored.events.find(
      (event) => event.kind === 'boundary' && event.boundaryKind === 'context-restored',
    );
    assert.equal(
      restoredBoundary?.kind === 'boundary' ? restoredBoundary.message : null,
      'Continuing with Codex. Previous messages were included as context.',
      'fallback disclosure is one compact durable line associated with the next turn',
    );
    await controller.activateRuntimeContinuation({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'codex',
      turnId: 'ui-turn-1',
    });
    const continuedFirst = await controller.completeRuntimeTurn({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'codex',
      turnId: 'ui-turn-1',
      text: 'The approved plan was implemented.',
      status: 'completed',
    });
    assert.equal(
      continuedFirst.events.filter((event) => event.kind === 'assistant-message' && event.turnId === 'ui-turn-1').length,
      2,
      'an internal continuation appends to the existing user turn',
    );

    const quietSwitch = await controller.acceptRuntimeTurn({
      conversationId: firstRecord.conversationId,
      turnId: 'quiet-runtime-switch',
      agentId: 'claude-code',
      text: 'Continue this completed conversation with Claude',
    });
    const quietSwitchBoundaries = quietSwitch.events.filter(
      (event) => event.kind === 'boundary'
        && event.turnId === 'quiet-runtime-switch'
        && event.boundaryKind === 'context-restored',
    );
    assert.equal(quietSwitchBoundaries.length, 1, 'the first send after a runtime switch persists one quiet boundary');
    assert.equal(
      quietSwitchBoundaries[0]?.kind === 'boundary' ? quietSwitchBoundaries[0].message : null,
      'Continuing with Claude. Previous messages were included as context.',
    );
    await controller.completeRuntimeTurn({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'claude-code',
      turnId: 'quiet-runtime-switch',
      text: 'Claude continued successfully.',
      status: 'completed',
    });

    const oldRuntimeTurn = await controller.acceptRuntimeTurn({
      conversationId: firstRecord.conversationId,
      turnId: 'handoff-old',
      agentId: 'codex',
      text: 'A request whose runtime will stop responding',
    });
    await controller.checkpointRuntimeContinuation({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'codex',
      descriptor: {
        descriptorVersion: 1,
        runtimeId: 'codex',
        nativeReference: 'ambiguous-old-thread',
        scopeId: scope.scopeId,
        runtimeVersion: '0.144.4',
        adapterContractVersion: 1,
        modelId: 'gpt-5.6-codex',
        compatibilityFingerprint: 'old-runtime-hmac',
        coveredThroughEventId: oldRuntimeTurn.events.find(
          (event) => event.kind === 'assistant-message',
        )?.eventId ?? null,
        capturedAt: '2026-08-22T14:02:00.000Z',
      },
    });
    const handoffTurn = await controller.acceptRuntimeTurn({
      conversationId: firstRecord.conversationId,
      turnId: 'handoff-new',
      agentId: 'claude-code',
      text: 'Solve it yourself',
    });
    assert.deepEqual(handoffTurn.lifecycle, { state: 'working', activeTurnId: 'handoff-new' });
    assert.equal(handoffTurn.continuations?.codex, undefined, 'handoff invalidates the unanswered runtime descriptor');
    const interruptedHandoffBoundaries = handoffTurn.events.filter(
      (event) => event.kind === 'boundary'
        && event.turnId === 'handoff-new'
        && event.boundaryKind === 'context-restored',
    );
    assert.equal(interruptedHandoffBoundaries.length, 1, 'an interrupted cross-runtime handoff still renders one boundary');
    assert.match(
      interruptedHandoffBoundaries[0]?.kind === 'boundary' ? interruptedHandoffBoundaries[0].message : '',
      /Continuing with Claude.*previous agent did not return a saved answer/i,
    );

    const beforeLateFinalRevision = handoffTurn.revision;
    const afterLateFinal = await controller.completeRuntimeTurn({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'codex',
      turnId: 'handoff-old',
      text: 'This late result must be ignored.',
      status: 'completed',
    });
    assert.equal(afterLateFinal.revision, beforeLateFinalRevision, 'late old-runtime final is idempotently ignored');
    assert.deepEqual(afterLateFinal.lifecycle, { state: 'working', activeTurnId: 'handoff-new' });
    assert.equal(afterLateFinal.events.some(
      (event) => event.kind === 'assistant-message' && event.content.includes('late result'),
    ), false);
    await controller.completeRuntimeTurn({
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      runtimeId: 'claude-code',
      turnId: 'handoff-new',
      text: 'The new runtime completed the handoff.',
      status: 'completed',
    });

    const renamedFirst = await controller.handle({
      type: 'conversation/rename',
      requestId: 'rename',
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      title: '  My   durable history  ',
    });
    assert.equal(renamedFirst.ok, true);
    assert.equal((await store.get(firstRecord.conversationId))?.title, 'My durable history');

    const second = await controller.handle({
      type: 'conversation/accept-turn',
      requestId: 'second',
      agentId: 'claude-code',
      text: 'Create an independent second conversation',
    });
    assert.equal(second.ok, true);
    if (!second.ok || !('conversation' in second.data) || !second.data.conversation) throw new Error('missing second record');
    assert.notEqual(second.data.conversation.conversationId, firstRecord.conversationId);
    assert.equal((await store.list(scope.scopeId)).length, 2, 'two accepted conversations remain independent');

    const secondRecord = second.data.conversation;
    let releaseGeneratedTitle: ((title: string) => void) | undefined;
    let markGenerationStarted: (() => void) | undefined;
    const generationStarted = new Promise<void>((resolve) => { markGenerationStarted = resolve; });
    const delayedTitle = new Promise<string>((resolve) => { releaseGeneratedTitle = resolve; });
    const completingSecond = controller.completeRuntimeTurn({
      conversationId: secondRecord.conversationId,
      bindingGeneration: secondRecord.bindingGeneration,
      runtimeId: 'claude-code',
      text: 'The second response is complete.',
      status: 'completed',
      generateTitle: () => {
        markGenerationStarted?.();
        return delayedTitle;
      },
    });
    await generationStarted;
    const manualRename = await controller.handle({
      type: 'conversation/rename',
      requestId: 'manual-wins',
      conversationId: secondRecord.conversationId,
      bindingGeneration: secondRecord.bindingGeneration,
      title: 'Chosen by the user',
    });
    assert.equal(manualRename.ok, true);
    releaseGeneratedTitle?.('Generated title arrives late');
    await completingSecond;
    assert.equal((await store.get(secondRecord.conversationId))?.title, 'Chosen by the user', 'manual rename wins a title-generation race');

    await controller.checkpointRuntimeContinuation({
      conversationId: secondRecord.conversationId,
      bindingGeneration: secondRecord.bindingGeneration,
      runtimeId: 'claude-code',
      descriptor: {
        descriptorVersion: 1,
        runtimeId: 'claude-code',
        nativeReference: 'claude-session-id',
        scopeId: scope.scopeId,
        runtimeVersion: '2.1.217',
        adapterContractVersion: 1,
        modelId: 'claude-opus-4-1',
        compatibilityFingerprint: 'claude-host-hmac',
        coveredThroughEventId: secondRecord.events.find((event) => event.kind === 'assistant-message')?.eventId ?? null,
        capturedAt: '2026-08-22T14:01:00.000Z',
      },
    });
    await controller.activateRuntimeContinuation({
      conversationId: secondRecord.conversationId,
      bindingGeneration: secondRecord.bindingGeneration,
      runtimeId: 'claude-code',
      turnId: secondRecord.events[0].turnId,
    });
    const failedSecond = await controller.completeRuntimeTurn({
      conversationId: secondRecord.conversationId,
      bindingGeneration: secondRecord.bindingGeneration,
      runtimeId: 'claude-code',
      text: '',
      status: 'failed',
      error: 'runtime unavailable',
    });
    assert.equal(failedSecond.continuations?.['claude-code'], undefined, 'a no-final failure invalidates only that runtime descriptor');
    assert.ok(failedSecond.continuations?.codex === undefined, 'failure does not synthesize descriptors for other runtimes');

    const other = await store.create({
      conversationId: uuid(800),
      scopeId: otherScope.scopeId,
      scope: otherScope.descriptor,
      title: 'Other project',
    });
    const hidden = await controller.handle({ type: 'conversation/get', requestId: 'hidden', conversationId: other.conversationId });
    assert.equal(hidden.ok, false, 'the host rejects cross-project IDs');

    const deletion = await controller.handle({
      type: 'conversation/delete',
      requestId: 'delete',
      conversationId: firstRecord.conversationId,
      bindingGeneration: firstRecord.bindingGeneration,
      stopRunning: true,
    });
    assert.equal(deletion.ok, true);
    if (!deletion.ok || !('undoToken' in deletion.data)) throw new Error('missing undo token');
    await assert.rejects(
      controller.checkpoint({
        conversationId: firstRecord.conversationId,
        bindingGeneration: firstRecord.bindingGeneration,
        title: 'Late callback',
      }),
      (error: unknown) => error instanceof ConversationStoreError && error.code === 'not-found',
    );

    const restored = await controller.handle({
      type: 'conversation/undo-delete',
      requestId: 'undo',
      undoToken: deletion.data.undoToken,
    });
    assert.equal(restored.ok, true);
    if (!restored.ok || !('conversation' in restored.data) || !restored.data.conversation) throw new Error('missing restored record');
    await assert.rejects(
      controller.checkpoint({
        conversationId: firstRecord.conversationId,
        bindingGeneration: firstRecord.bindingGeneration,
        title: 'Pre-delete callback',
      }),
      (error: unknown) => error instanceof ConversationStoreError && error.code === 'stale-binding',
    );

    const running = await controller.handle({
      type: 'conversation/accept-turn',
      requestId: 'running',
      agentId: 'codex',
      text: 'Keep this runtime active until deletion',
    });
    assert.equal(running.ok, true);
    if (!running.ok || !('conversation' in running.data) || !running.data.conversation) throw new Error('missing running record');
    const runningRecord = running.data.conversation;
    const runningDeletion = await controller.handle({
      type: 'conversation/delete',
      requestId: 'delete-running',
      conversationId: runningRecord.conversationId,
      bindingGeneration: runningRecord.bindingGeneration,
      stopRunning: true,
    });
    assert.equal(runningDeletion.ok, true);
    if (!runningDeletion.ok || !('undoToken' in runningDeletion.data)) throw new Error('missing running undo token');
    assert.deepEqual(stopped, [runningRecord.conversationId]);
    const restoredRunning = await controller.handle({
      type: 'conversation/undo-delete',
      requestId: 'undo-running',
      undoToken: runningDeletion.data.undoToken,
    });
    assert.equal(restoredRunning.ok, true);
    if (!restoredRunning.ok || !('conversation' in restoredRunning.data) || !restoredRunning.data.conversation) throw new Error('missing restored running record');
    assert.deepEqual(restoredRunning.data.conversation.lifecycle, {
      state: 'interrupted',
      turnId: runningRecord.lifecycle.state === 'working' ? runningRecord.lifecycle.activeTurnId : null,
      reason: 'deleted-running',
    });
    assert.equal(restoredRunning.data.conversation.events.at(-1)?.kind, 'boundary');

    const unknownScope = unassignedLegacyScope();
    const unknown = await store.create({
      scopeId: unknownScope.scopeId,
      scope: unknownScope.descriptor,
      title: 'Recovered legacy conversation',
    });
    const moved = await controller.handle({
      type: 'conversation/move-unassigned',
      requestId: 'move-recovered',
      conversationId: unknown.conversationId,
      bindingGeneration: unknown.bindingGeneration,
    });
    assert.equal(moved.ok, true);
    if (!moved.ok || !('conversation' in moved.data) || !moved.data.conversation) throw new Error('missing moved record');
    assert.equal(moved.data.conversation.scopeId, scope.scopeId);
    assert.notEqual(moved.data.conversation.identityColorSlot, firstRecord.identityColorSlot, 'moving into a project avoids an occupied identity color');

    const preferenceRequests = ['medium', 'low'] as const;
    const preferenceResults = await Promise.all(preferenceRequests.map((thinkingEffort, index) => controller.handle({
      type: 'conversation/set-composer-preference',
      requestId: `rapid-effort-${index}`,
      conversationId: moved.data.conversation.conversationId,
      bindingGeneration: moved.data.conversation.bindingGeneration,
      agentId: 'codex',
      thinkingEffort,
    })));
    assert.ok(preferenceResults.every((preferenceResult) => preferenceResult.ok), 'rapid range changes serialize without stale-revision loss');
    const afterRapidChanges = await store.get(moved.data.conversation.conversationId);
    assert.equal(afterRapidChanges?.composerPreferences.thinkingEffortByRuntime.codex, 'low', 'the final range position wins');

    const queuedTurn = await controller.acceptRuntimeTurn({
      conversationId: moved.data.conversation.conversationId,
      agentId: 'codex',
      text: 'Run the effort captured when this turn was queued',
      thinkingEffort: 'high',
    });
    const queuedUserEvent = [...queuedTurn.events].reverse().find((event) => event.kind === 'user-message');
    assert.equal(queuedUserEvent?.kind === 'user-message' ? queuedUserEvent.thinkingEffort : null, 'high', 'queued turn keeps its immutable effort snapshot');
    assert.equal(queuedTurn.composerPreferences.thinkingEffortByRuntime.codex, 'low', 'dispatching a queued turn does not overwrite the current Composer draft preference');

    const unknownToDelete = await store.create({
      scopeId: unknownScope.scopeId,
      scope: unknownScope.descriptor,
      title: 'Delete from recovery',
    });
    const recoveryDeletion = await controller.handle({
      type: 'conversation/delete',
      requestId: 'delete-recovery',
      conversationId: unknownToDelete.conversationId,
      bindingGeneration: unknownToDelete.bindingGeneration,
      stopRunning: false,
      recovery: true,
    });
    assert.equal(recoveryDeletion.ok, true);
    if (!recoveryDeletion.ok || !('undoToken' in recoveryDeletion.data)) throw new Error('missing recovery undo token');
    assert.equal(recoveryDeletion.data.recovery, true);
    const recoveryUndo = await controller.handle({
      type: 'conversation/undo-delete',
      requestId: 'undo-recovery',
      undoToken: recoveryDeletion.data.undoToken,
      recovery: true,
    });
    assert.equal(recoveryUndo.ok, true);
    if (!recoveryUndo.ok || !('conversation' in recoveryUndo.data) || !recoveryUndo.data.conversation) throw new Error('missing recovery restore');
    assert.equal(recoveryUndo.data.conversation.scopeId, unknownScope.scopeId);
    assert.equal(recoveryUndo.data.recovery, true);

    const shutdownActive = await controller.handle({
      type: 'conversation/accept-turn',
      requestId: 'shutdown-active',
      agentId: 'opencode',
      text: 'Persist an honest restart boundary',
    });
    assert.equal(shutdownActive.ok, true);
    if (!shutdownActive.ok || !('conversation' in shutdownActive.data) || !shutdownActive.data.conversation) throw new Error('missing shutdown record');
    await controller.interruptRuntimeAttachments([shutdownActive.data.conversation.conversationId], 'restart');
    const interruptedAtShutdown = await store.get(shutdownActive.data.conversation.conversationId);
    assert.equal(interruptedAtShutdown?.lifecycle.state, 'interrupted');
    if (interruptedAtShutdown?.lifecycle.state === 'interrupted') {
      assert.equal(interruptedAtShutdown.lifecycle.reason, 'restart');
    }
    assert.equal(interruptedAtShutdown?.events[interruptedAtShutdown.events.length - 1]?.kind, 'boundary');

    assert.ok(emitted.some((event) => event.type === 'conversation/changed'));
    controller.dispose();
    const afterDispose = await controller.handle({ type: 'conversation/list', requestId: 'disposed' });
    assert.equal(afterDispose.ok, false);
    assert.equal((await store.list(scope.scopeId)).length, 5, 'controller disposal does not delete durable conversations');

    console.log('ConversationController.test.ts: all tests passed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

run().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
