import { randomUUID } from 'crypto';
import { unassignedLegacyScope, type ResolvedProjectScopeV1 } from './projectScope';
import {
  ConversationProtocolError,
  parseConversationRequest,
  projectConversation,
  type ConversationHostEvent,
  type ConversationRequest,
  type ConversationResultData,
  type ConversationResultMessage,
} from './protocol';
import { ConversationStore, ConversationStoreError } from './ConversationStore';
import type {
  ConversationCheckpointV1,
  ConversationRecordV1,
  DispatchReceiptStateV1,
} from './types';
import type { ConversationRolloutMode } from './ConversationCutoverState';
import { AGENTS, type AgentId } from '../agent/types';
import type { RuntimeContinuationDescriptorV1 } from '../runtime/continuation';
import type { RuntimeFailureKind } from '../runtime/runtimeErrorPresentation';
import { LegacyConversationMigrator, type LegacyConversationCandidateV1 } from './LegacyConversationMigrator';
import {
  fallbackTitleFromPrompt,
  normalizeGeneratedTitle,
  normalizeManualTitle,
} from './ConversationTitlePolicy';

export interface FirstResponseTitleRequest {
  userPrompt: string;
  assistantResponse: string;
}

export interface ConversationControllerDependencies {
  store: ConversationStore;
  currentScope: () => ResolvedProjectScopeV1;
  selectedConversationId?: () => string | null;
  dispatchAcceptedTurn?: (request: Extract<ConversationRequest, { type: 'conversation/accept-turn' }>, record: ConversationRecordV1) => Promise<void>;
  stopConversation?: (conversationId: string) => Promise<void>;
  emit?: (event: ConversationHostEvent) => void;
  rolloutMode?: () => Promise<ConversationRolloutMode>;
  markHostAuthority?: () => Promise<void>;
  migrator?: LegacyConversationMigrator;
  now?: () => Date;
  randomId?: () => string;
}

function scopeLabel(scope: ResolvedProjectScopeV1): string {
  if (scope.descriptor.kind === 'no-folder') return 'No folder';
  if (scope.descriptor.kind === 'unassigned-legacy') return 'Project unknown';
  if (scope.descriptor.workspaceFileUri) return decodeURIComponent(scope.descriptor.workspaceFileUri.split('/').pop() ?? 'Workspace');
  if (scope.descriptor.folderUris.length === 1) return decodeURIComponent(scope.descriptor.folderUris[0].split('/').pop() ?? 'Project');
  return `${scope.descriptor.folderUris.length} folders`;
}

function result(request: ConversationRequest, data: ConversationResultData): ConversationResultMessage {
  return { type: 'conversation/result', requestId: request.requestId, operation: request.type, ok: true, data };
}

function errorResult(requestId: string, operation: string, error: unknown): ConversationResultMessage {
  if (error instanceof ConversationStoreError) {
    return {
      type: 'conversation/result',
      requestId,
      operation,
      ok: false,
      error: { code: error.code, message: error.message, retryable: error.code === 'storage' },
    };
  }
  if (error instanceof ConversationProtocolError || (error instanceof Error && error.name === 'ConversationCodecError')) {
    return {
      type: 'conversation/result',
      requestId,
      operation,
      ok: false,
      error: { code: 'invalid-request', message: error.message, retryable: false },
    };
  }
  return {
    type: 'conversation/result',
    requestId,
    operation,
    ok: false,
    error: { code: 'internal', message: error instanceof Error ? error.message : 'Conversation operation failed', retryable: false },
  };
}

export class ConversationController {
  private readonly now: () => Date;
  private readonly randomId: () => string;
  private disposed = false;

  dismissDeleteUndo(undoToken: string): void {
    this.dependencies.store.dismissUndo(undoToken);
  }

  constructor(private readonly dependencies: ConversationControllerDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.randomId = dependencies.randomId ?? randomUUID;
  }

  async handle(value: unknown): Promise<ConversationResultMessage> {
    const untrusted = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const requestId = typeof untrusted.requestId === 'string' ? untrusted.requestId : 'invalid';
    const operation = typeof untrusted.type === 'string' ? untrusted.type : 'unknown';
    if (this.disposed) return errorResult(requestId, operation, new Error('Conversation controller is disposed'));
    let request: ConversationRequest;
    try {
      request = parseConversationRequest(value);
    } catch (error) {
      return errorResult(requestId, operation, error);
    }

    try {
      if (request.type === 'conversation/initialize') {
        const scope = this.dependencies.currentScope();
        const rolloutMode = await this.dependencies.rolloutMode?.() ?? 'host-canonical';
        const conversations = await this.dependencies.store.list(scope.scopeId);
        const earlierConversations = await this.dependencies.store.list(unassignedLegacyScope().scopeId);
        const selected = this.dependencies.selectedConversationId?.() ?? null;
        return result(request, {
          scopeId: scope.scopeId,
          scope: scope.descriptor,
          scopeLabel: scopeLabel(scope),
          rolloutMode,
          selectedConversationId: selected && conversations.some((item) => item.conversationId === selected) ? selected : null,
          conversations,
          earlierConversations,
        });
      }
      if (request.type === 'conversation/list') {
        const scope = this.dependencies.currentScope();
        return result(request, {
          conversations: await this.dependencies.store.list(scope.scopeId),
          earlierConversations: await this.dependencies.store.list(unassignedLegacyScope().scopeId),
        });
      }
      if (request.type === 'conversation/get') {
        const record = await this.dependencies.store.get(request.conversationId);
        if (!record) return result(request, { conversation: null });
        this.assertVisibleScope(record, request.recovery === true);
        return result(request, { conversation: projectConversation(record) });
      }
      if (request.type === 'conversation/accept-turn') return this.acceptTurn(request);
      if (request.type === 'conversation/set-composer-preference') {
        const updated = await this.dependencies.store.setComposerThinkingEffort({
          conversationId: request.conversationId,
          scopeId: this.dependencies.currentScope().scopeId,
          bindingGeneration: request.bindingGeneration,
          agentId: request.agentId,
          thinkingEffort: request.thinkingEffort,
        });
        this.emitChanged(updated);
        return result(request, { conversation: projectConversation(updated) });
      }
      if (request.type === 'conversation/rename') {
        const current = await this.requireCurrentScope(request.conversationId);
        const title = normalizeManualTitle(request.title);
        if (!title) throw new ConversationProtocolError('title must contain visible text');
        const renamed = await this.dependencies.store.checkpoint({
          conversationId: current.conversationId,
          bindingGeneration: request.bindingGeneration,
          expectedRevision: current.revision,
          title,
        });
        this.emitChanged(renamed);
        return result(request, { conversation: projectConversation(renamed) });
      }
      if (request.type === 'conversation/delete') {
        const record = await this.requireVisibleScope(request.conversationId, request.recovery === true);
        if (record.lifecycle.state === 'working' || record.lifecycle.state === 'needs-user') {
          if (!request.stopRunning) throw new ConversationStoreError('stale-binding', 'Running work requires Stop and delete');
          await this.dependencies.stopConversation?.(record.conversationId);
        }
        const deleted = await this.dependencies.store.delete(record.conversationId, request.bindingGeneration);
        this.dependencies.emit?.({
          type: 'conversation/changed',
          conversationId: record.conversationId,
          revision: record.revision,
          bindingGeneration: record.bindingGeneration,
        });
        return result(request, {
          ...deleted,
          title: record.title,
          ...(request.recovery === true ? { recovery: true } : {}),
        });
      }
      if (request.type === 'conversation/undo-delete') {
        const expectedScopeId = request.recovery === true
          ? unassignedLegacyScope().scopeId
          : this.dependencies.currentScope().scopeId;
        let record = await this.dependencies.store.restore(request.undoToken, expectedScopeId);
        this.assertVisibleScope(record, request.recovery === true);
        if (record.lifecycle.state === 'working' || record.lifecycle.state === 'needs-user') {
          const turnId = record.lifecycle.activeTurnId;
          const lastEvent = record.events[record.events.length - 1];
          const lastRuntime = record.runtimeSummary[record.runtimeSummary.length - 1];
          record = await this.dependencies.store.checkpoint({
            conversationId: record.conversationId,
            bindingGeneration: record.bindingGeneration,
            expectedRevision: record.revision,
            lifecycle: { state: 'interrupted', turnId, reason: 'deleted-running' },
            appendEvents: [{
              kind: 'boundary',
              eventId: this.randomId(),
              turnId,
              sequence: (lastEvent?.sequence ?? -1) + 1,
              occurredAt: this.now().toISOString(),
              runtimeId: lastEvent?.runtimeId ?? lastRuntime ?? 'legacy-ritemark',
              boundaryKind: 'interrupted',
              message: 'Running work was stopped when this conversation was deleted.',
            }],
          });
        }
        this.emitChanged(record);
        return result(request, { conversation: projectConversation(record), ...(request.recovery === true ? { recovery: true } : {}) });
      }
      if (request.type === 'conversation/move-unassigned') {
        const currentScope = this.dependencies.currentScope();
        const moved = await this.dependencies.store.moveScope(
          request.conversationId,
          request.bindingGeneration,
          unassignedLegacyScope().scopeId,
          currentScope.scopeId,
          currentScope.descriptor,
        );
        this.emitChanged(moved);
        return result(request, { conversation: projectConversation(moved) });
      }
      if (request.type === 'conversation/diagnostics') {
        return result(request, { diagnostics: await this.dependencies.store.getDiagnostics() });
      }

      if (request.type === 'legacy/import-batch') {
        if (!this.dependencies.migrator) return result(request, { accepted: false });
        const migration = await this.dependencies.migrator.importBatch(
          request.records as LegacyConversationCandidateV1[],
          this.dependencies.currentScope(),
        );
        // Completing a clean inventory handshake establishes host authority
        // even for a genuinely empty legacy store. Do not cut over when every
        // non-empty candidate failed: the legacy copy must remain visible so
        // recovery is still possible.
        if (request.records.length === 0
          || migration.created.length > 0
          || migration.deduplicated.length > 0) {
          await this.dependencies.markHostAuthority?.();
        }
        return result(request, { accepted: true, migration });
      }

      return result(request, { accepted: false });
    } catch (error) {
      return errorResult(request.requestId, request.type, error);
    }
  }

  async checkpoint(update: ConversationCheckpointV1): Promise<ConversationRecordV1> {
    if (this.disposed) throw new Error('Conversation controller is disposed');
    await this.requireCurrentScope(update.conversationId);
    const record = await this.dependencies.store.checkpoint(update);
    this.emitChanged(record);
    return record;
  }

  async runtimeConversation(conversationId: string): Promise<ConversationRecordV1> {
    if (this.disposed) throw new Error('Conversation controller is disposed');
    return this.requireCurrentScope(conversationId);
  }

  /** Re-open an existing canonical turn for an approved plan continuation. */
  async activateRuntimeContinuation(input: {
    conversationId: string;
    bindingGeneration: number;
    runtimeId: AgentId;
    turnId: string;
  }): Promise<ConversationRecordV1> {
    const record = await this.mutateLatest(
      input.conversationId,
      input.bindingGeneration,
      (current) => {
        const user = current.events.find(
          (event) => event.kind === 'user-message' && event.turnId === input.turnId,
        );
        if (!user || user.runtimeId !== input.runtimeId) {
          throw new ConversationProtocolError('Continuation has no matching canonical turn');
        }
        if ((current.lifecycle.state === 'working' || current.lifecycle.state === 'needs-user')
          && current.lifecycle.activeTurnId === input.turnId) return null;
        return { lifecycle: { state: 'working', activeTurnId: input.turnId } };
      },
    );
    this.emitChanged(record);
    return record;
  }

  /** Persist an opaque provider checkpoint without exposing it to the webview. */
  async checkpointRuntimeContinuation(input: {
    conversationId: string;
    bindingGeneration: number;
    runtimeId: AgentId;
    descriptor: RuntimeContinuationDescriptorV1 | null;
  }): Promise<ConversationRecordV1> {
    if (input.descriptor && input.descriptor.runtimeId !== input.runtimeId) {
      throw new ConversationProtocolError('Continuation runtime does not match its map key');
    }
    const record = await this.mutateLatest(
      input.conversationId,
      input.bindingGeneration,
      (current) => {
        const existing = current.continuations?.[input.runtimeId];
        if (input.descriptor === null && !existing) return null;
        // A delayed provider callback must not replace a newer checkpoint.
        if (input.descriptor && existing && existing.capturedAt > input.descriptor.capturedAt) return null;
        return { continuationUpdate: { runtimeId: input.runtimeId, descriptor: input.descriptor } };
      },
    );
    this.emitChanged(record);
    return record;
  }

  /**
   * Append the crash-safe transport receipt. `ambiguous` is written before the
   * transport call; `accepted` requires an adapter-approved positive signal.
   */
  async markRuntimeDispatch(input: {
    conversationId: string;
    bindingGeneration: number;
    runtimeId: AgentId;
    turnId: string;
    state: Exclude<DispatchReceiptStateV1, 'not-sent'>;
  }): Promise<ConversationRecordV1> {
    const record = await this.mutateLatest(
      input.conversationId,
      input.bindingGeneration,
      (current) => {
        const user = current.events.find(
          (event) => event.kind === 'user-message' && event.turnId === input.turnId,
        );
        if (!user || user.runtimeId !== input.runtimeId) {
          throw new ConversationProtocolError('Dispatch receipt has no matching user turn');
        }
        const receipts = current.events.filter(
          (event) => event.kind === 'dispatch-receipt' && event.turnId === input.turnId,
        );
        const previous = receipts[receipts.length - 1];
        if (previous?.kind === 'dispatch-receipt' && previous.dispatchState === input.state) return null;
        if (previous?.kind === 'dispatch-receipt' && previous.dispatchState === 'accepted') return null;
        const requiredPrevious = input.state === 'ambiguous' ? 'not-sent' : 'ambiguous';
        if (previous?.kind !== 'dispatch-receipt' || previous.dispatchState !== requiredPrevious) {
          throw new ConversationProtocolError(
            `Dispatch ${input.state} must follow ${requiredPrevious}`,
          );
        }
        return {
          appendEvents: [{
            kind: 'dispatch-receipt',
            eventId: this.randomId(),
            turnId: input.turnId,
            sequence: (current.events[current.events.length - 1]?.sequence ?? -1) + 1,
            occurredAt: this.now().toISOString(),
            runtimeId: input.runtimeId,
            dispatchState: input.state,
          }],
        };
      },
    );
    this.emitChanged(record);
    return record;
  }

  /** Persist the one-time truthful transcript boundary for a fresh session. */
  async recordTranscriptRestored(input: {
    conversationId: string;
    bindingGeneration: number;
    runtimeId: AgentId;
    turnId: string;
    truncated: boolean;
    unansweredPriorRequest: boolean;
  }): Promise<ConversationRecordV1> {
    const record = await this.mutateLatest(
      input.conversationId,
      input.bindingGeneration,
      (current) => {
        const alreadyRecorded = current.events.some(
          (event) => event.kind === 'boundary'
            && event.turnId === input.turnId
            && event.runtimeId === input.runtimeId
            && event.boundaryKind === 'context-restored',
        );
        if (alreadyRecorded) return null;
        const details = [
          `Continuing with ${AGENTS[input.runtimeId].label}. Previous messages were included as context.`,
          ...(input.unansweredPriorRequest
            ? ['The previous agent did not return a saved answer. Your earlier request was included as context.']
            : []),
          ...(input.truncated ? ['Some older messages were left out.'] : []),
        ];
        return {
          appendEvents: [{
            kind: 'boundary',
            eventId: this.randomId(),
            turnId: input.turnId,
            sequence: (current.events[current.events.length - 1]?.sequence ?? -1) + 1,
            occurredAt: this.now().toISOString(),
            runtimeId: input.runtimeId,
            boundaryKind: 'context-restored',
            message: details.join(' '),
          }],
        };
      },
    );
    this.emitChanged(record);
    return record;
  }

  async currentRolloutMode(): Promise<ConversationRolloutMode> {
    if (this.disposed) throw new Error('Conversation controller is disposed');
    return this.dependencies.rolloutMode?.() ?? 'host-canonical';
  }

  /** Compatibility ingress used while the existing composer is moved to the typed protocol. */
  async acceptRuntimeTurn(input: {
    conversationId?: string;
    turnId?: string;
    agentId: AgentId;
    text: string;
    mode?: string | null;
    thinkingEffort?: import('../runtime/thinkingEffort').ThinkingEffort;
    attachments?: Array<{ name: string; kind: string; mediaType: string | null; sizeBytes: number | null }>;
  }): Promise<ConversationRecordV1> {
    const existing = input.conversationId && /^[0-9a-f]{8}-/i.test(input.conversationId)
      ? await this.dependencies.store.get(input.conversationId)
      : null;
    const request: Extract<ConversationRequest, { type: 'conversation/accept-turn' }> = {
      type: 'conversation/accept-turn',
      requestId: this.randomId(),
      ...(existing ? { conversationId: existing.conversationId, bindingGeneration: existing.bindingGeneration } : {}),
      ...(input.turnId ? { turnId: input.turnId } : {}),
      agentId: input.agentId,
      text: input.text,
      mode: input.mode ?? null,
      thinkingEffort: input.thinkingEffort ?? 'auto',
      attachments: (input.attachments ?? []).map((attachment, index) => ({
        id: `compat-${index}`,
        ...attachment,
        data: '',
      })),
    };
    return this.persistAcceptedTurn(request);
  }

  async completeRuntimeTurn(input: {
    conversationId: string;
    bindingGeneration: number;
    runtimeId: AgentId;
    text: string;
    status: 'completed' | 'failed' | 'cancelled';
    error?: string;
    failureKind?: RuntimeFailureKind;
    appliedThinkingEffort?: import('../runtime/thinkingEffort').ExplicitThinkingEffort | null;
    turnId?: string;
    generateTitle?: (request: FirstResponseTitleRequest) => Promise<string | null>;
  }): Promise<ConversationRecordV1> {
    const initial = await this.requireCurrentScope(input.conversationId);
    const firstUserMessage = initial.events.find((event) => event.kind === 'user-message');
    const turnId = input.turnId ?? (
      initial.lifecycle.state === 'working' || initial.lifecycle.state === 'needs-user'
        ? initial.lifecycle.activeTurnId
        : this.randomId()
    );
    const occurredAt = this.now().toISOString();
    const terminalEventId = this.randomId();
    const record = await this.mutateLatest(
      input.conversationId,
      input.bindingGeneration,
      (current) => {
        const activeTurnMatches = (current.lifecycle.state === 'working' || current.lifecycle.state === 'needs-user')
          && current.lifecycle.activeTurnId === turnId;
        const activeUser = current.events.find(
          (event) => event.kind === 'user-message' && event.turnId === turnId,
        );
        // A runtime switched away from this turn. Its late final must not append
        // content or make the newer runtime look idle.
        if (!activeTurnMatches || activeUser?.runtimeId !== input.runtimeId) return null;
        const sequence = (current.events[current.events.length - 1]?.sequence ?? -1) + 1;
        const appendEvents = input.text
          ? [{
              kind: 'assistant-message' as const,
              eventId: terminalEventId,
              turnId,
              sequence,
              occurredAt,
              runtimeId: input.runtimeId,
              content: input.text,
              terminalStatus: input.status,
              ...(input.error ? { error: input.error } : {}),
              ...(input.failureKind ? { failureKind: input.failureKind } : {}),
              appliedThinkingEffort: input.appliedThinkingEffort ?? null,
            }]
          : [{
              kind: 'boundary' as const,
              eventId: terminalEventId,
              turnId,
              sequence,
              occurredAt,
              runtimeId: input.runtimeId,
              boundaryKind: input.status === 'cancelled' ? 'cancelled' as const : 'failed' as const,
              message: input.error || (input.status === 'cancelled' ? 'The turn was cancelled.' : 'The turn failed.'),
              ...(input.failureKind ? { failureKind: input.failureKind } : {}),
            }];
        const assistantEvent = appendEvents[0];
        const currentDescriptor = current.continuations?.[input.runtimeId];
        const continuationUpdate = input.status === 'completed'
          && assistantEvent.kind === 'assistant-message'
          && assistantEvent.terminalStatus === 'completed'
          && currentDescriptor
          ? {
              runtimeId: input.runtimeId,
              descriptor: {
                ...currentDescriptor,
                coveredThroughEventId: assistantEvent.eventId,
                capturedAt: occurredAt,
              },
            }
          : input.status !== 'completed' && currentDescriptor
            ? { runtimeId: input.runtimeId, descriptor: null }
            : undefined;
        return {
          lifecycle: input.status === 'completed'
            ? { state: 'idle' as const }
            : { state: 'interrupted' as const, turnId, reason: input.status === 'cancelled' ? 'cancelled' as const : 'failed' as const },
          appendEvents,
          ...(continuationUpdate ? { continuationUpdate } : {}),
        };
      },
    );
    this.emitChanged(record);
    const isFirstAssistantResponse = input.status === 'completed'
      && Boolean(input.text.trim())
      && record.events.find((event) => event.kind === 'assistant-message')?.eventId === terminalEventId;
    if (isFirstAssistantResponse && firstUserMessage?.kind === 'user-message' && input.generateTitle) {
      return this.generateFirstResponseTitle(record, firstUserMessage.text, input.text, input.generateTitle);
    }
    return record;
  }

  async attentionRuntimeTurn(input: {
    conversationId: string;
    bindingGeneration: number;
    runtimeId: AgentId;
    attentionKind: 'approval' | 'question' | 'plan-review';
    prompt: string;
  }): Promise<ConversationRecordV1> {
    const current = await this.requireCurrentScope(input.conversationId);
    if (current.lifecycle.state !== 'working' && current.lifecycle.state !== 'needs-user') return current;
    const turnId = current.lifecycle.activeTurnId;
    const record = await this.dependencies.store.checkpoint({
      conversationId: current.conversationId,
      bindingGeneration: input.bindingGeneration,
      lifecycle: { state: 'needs-user', activeTurnId: turnId, attentionKind: input.attentionKind },
      appendEvents: [{
        kind: 'attention',
        eventId: this.randomId(),
        turnId,
        sequence: (current.events[current.events.length - 1]?.sequence ?? -1) + 1,
        occurredAt: this.now().toISOString(),
        runtimeId: input.runtimeId,
        attentionKind: input.attentionKind,
        prompt: input.prompt,
        summary: null,
        attentionState: 'pending',
      }],
    });
    this.emitChanged(record);
    return record;
  }

  async interruptRuntimeAttachments(
    conversationIds: Iterable<string>,
    reason: 'restart' | 'runtime-released',
  ): Promise<void> {
    if (this.disposed) return;
    for (const conversationId of new Set(conversationIds)) {
      let current: ConversationRecordV1;
      try {
        current = await this.requireCurrentScope(conversationId);
      } catch (error) {
        if (error instanceof ConversationStoreError && error.code === 'not-found') continue;
        throw error;
      }
      if (current.lifecycle.state !== 'working' && current.lifecycle.state !== 'needs-user') continue;
      const turnId = current.lifecycle.activeTurnId;
      const lastEvent = current.events[current.events.length - 1];
      const lastRuntime = current.runtimeSummary[current.runtimeSummary.length - 1];
      const interruptedRuntime = lastEvent?.runtimeId ?? lastRuntime;
      const continuationRuntime = interruptedRuntime === 'claude-code'
        || interruptedRuntime === 'codex'
        || interruptedRuntime === 'opencode'
        ? interruptedRuntime
        : null;
      const interrupted = await this.dependencies.store.checkpoint({
        conversationId,
        bindingGeneration: current.bindingGeneration,
        expectedRevision: current.revision,
        lifecycle: { state: 'interrupted', turnId, reason },
        appendEvents: [{
          kind: 'boundary',
          eventId: this.randomId(),
          turnId,
          sequence: (lastEvent?.sequence ?? -1) + 1,
          occurredAt: this.now().toISOString(),
          runtimeId: lastEvent?.runtimeId ?? lastRuntime ?? 'legacy-ritemark',
          boundaryKind: 'interrupted',
          message: reason === 'restart'
            ? 'Ritemark closed while this turn was running.'
            : 'The live agent context was released.',
        }],
        ...(continuationRuntime && current.continuations?.[continuationRuntime]
          ? { continuationUpdate: { runtimeId: continuationRuntime, descriptor: null } }
          : {}),
      });
      this.emitChanged(interrupted);
    }
  }

  dispose(): void {
    // Deliberately does not dispose runtime sessions or mutate records. Runtime
    // lifetime remains with UnifiedViewProvider until the Phase 4 attachment manager.
    this.disposed = true;
  }

  private async acceptTurn(request: Extract<ConversationRequest, { type: 'conversation/accept-turn' }>): Promise<ConversationResultMessage> {
    const record = await this.persistAcceptedTurn(request);
    const dispatched = this.dependencies.dispatchAcceptedTurn !== undefined;
    if (this.dependencies.dispatchAcceptedTurn) await this.dependencies.dispatchAcceptedTurn(request, record);
    return result(request, { conversation: projectConversation(record), dispatched });
  }

  private async persistAcceptedTurn(request: Extract<ConversationRequest, { type: 'conversation/accept-turn' }>): Promise<ConversationRecordV1> {
    const scope = this.dependencies.currentScope();
    const now = this.now().toISOString();
    const turnId = request.turnId ?? this.randomId();
    const event = {
      kind: 'user-message' as const,
      eventId: this.randomId(),
      turnId,
      sequence: 0,
      occurredAt: now,
      runtimeId: request.agentId,
      text: request.text,
      mode: request.mode ?? null,
      attachments: (request.attachments ?? []).map(({ name, kind, mediaType, sizeBytes }) => ({ name, kind, mediaType, sizeBytes })),
      thinkingEffort: request.thinkingEffort ?? 'auto',
    };
    const receipt = {
      kind: 'dispatch-receipt' as const,
      eventId: this.randomId(),
      turnId,
      sequence: 1,
      occurredAt: now,
      runtimeId: request.agentId,
      dispatchState: 'not-sent' as const,
    };
    let record: ConversationRecordV1;
    if (request.conversationId) {
      if (request.bindingGeneration === undefined) throw new ConversationProtocolError('bindingGeneration is required for an existing conversation');
      record = await this.mutateLatest(request.conversationId, request.bindingGeneration, (current) => {
        const priorTurnId = current.lifecycle.state === 'working' || current.lifecycle.state === 'needs-user'
          ? current.lifecycle.activeTurnId
          : null;
        const priorUser = priorTurnId
          ? [...current.events].reverse().find(
              (candidate) => candidate.kind === 'user-message' && candidate.turnId === priorTurnId,
            )
          : undefined;
        const priorRuntime = priorUser?.runtimeId === 'claude-code'
          || priorUser?.runtimeId === 'codex'
          || priorUser?.runtimeId === 'opencode'
          ? priorUser.runtimeId
          : null;
        const latestUser = [...current.events].reverse().find(
          (candidate) => candidate.kind === 'user-message',
        );
        const latestRuntime = latestUser?.runtimeId === 'claude-code'
          || latestUser?.runtimeId === 'codex'
          || latestUser?.runtimeId === 'opencode'
          ? latestUser.runtimeId
          : null;
        const runtimeChanged = latestRuntime !== null && latestRuntime !== request.agentId;
        // R9: runtime selection itself is intentionally quiet. Persist exactly
        // one boundary when the first message is actually sent with the newly
        // selected runtime. This cannot depend on an adapter later reporting
        // `transcript-restored`: a compatible native session may still receive
        // a normalized delta, and the user deserves the same honest disclosure.
        const transitionBoundary = runtimeChanged
          ? {
              kind: 'boundary' as const,
              eventId: this.randomId(),
              turnId,
              sequence: (current.events[current.events.length - 1]?.sequence ?? -1) + 1,
              occurredAt: now,
              runtimeId: request.agentId,
              boundaryKind: 'context-restored' as const,
              message: [
                `Continuing with ${AGENTS[request.agentId].label}. Previous messages were included as context.`,
                ...(priorTurnId && priorTurnId !== turnId
                  ? ['The previous agent did not return a saved answer.']
                  : []),
              ].join(' '),
            }
          : priorTurnId && priorTurnId !== turnId
            ? {
                kind: 'boundary' as const,
                eventId: this.randomId(),
                turnId: priorTurnId,
                sequence: (current.events[current.events.length - 1]?.sequence ?? -1) + 1,
                occurredAt: now,
                runtimeId: priorUser?.runtimeId ?? 'legacy-ritemark' as const,
                boundaryKind: 'interrupted' as const,
                message: 'The previous agent did not return a saved answer before the next request.',
              }
            : null;
        event.sequence = (transitionBoundary?.sequence ?? (current.events[current.events.length - 1]?.sequence ?? -1)) + 1;
        receipt.sequence = event.sequence + 1;
        return {
          lifecycle: { state: 'working', activeTurnId: turnId },
          appendEvents: [...(transitionBoundary ? [transitionBoundary] : []), event, receipt],
          ...(priorRuntime && current.continuations?.[priorRuntime]
            ? { continuationUpdate: { runtimeId: priorRuntime, descriptor: null } }
            : {}),
        };
      });
    } else {
      record = await this.dependencies.store.create({
        scopeId: scope.scopeId,
        scope: scope.descriptor,
        title: normalizeManualTitle(request.title ?? '') ?? fallbackTitleFromPrompt(request.text),
        lifecycle: { state: 'working', activeTurnId: turnId },
        events: [event, receipt],
        composerPreferences: {
          thinkingEffortByRuntime: { [request.agentId]: request.thinkingEffort ?? 'auto' },
        },
      });
    }

    this.emitChanged(record);
    try {
      await this.dependencies.markHostAuthority?.();
    } catch (error) {
      this.dependencies.emit?.({
        type: 'conversation/store-status',
        state: 'degraded',
        message: `Conversation is durable, but cutover marker repair failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    return record;
  }

  private async requireCurrentScope(conversationId: string): Promise<ConversationRecordV1> {
    return this.requireVisibleScope(conversationId, false);
  }

  /**
   * Rebuild revision-sensitive events from the latest record. Provider
   * checkpoint, receipt, and final callbacks can legitimately race each other.
   */
  private async mutateLatest(
    conversationId: string,
    bindingGeneration: number,
    build: (
      current: ConversationRecordV1,
    ) => Omit<ConversationCheckpointV1, 'conversationId' | 'bindingGeneration' | 'expectedRevision'> | null,
  ): Promise<ConversationRecordV1> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await this.requireCurrentScope(conversationId);
      if (current.bindingGeneration !== bindingGeneration) {
        throw new ConversationStoreError('stale-binding', 'Conversation binding generation is stale');
      }
      const update = build(current);
      if (!update) return current;
      try {
        return await this.dependencies.store.checkpoint({
          ...update,
          conversationId,
          bindingGeneration,
          expectedRevision: current.revision,
        });
      } catch (error) {
        if (!(error instanceof ConversationStoreError) || error.code !== 'stale-revision' || attempt === 4) {
          throw error;
        }
      }
    }
    throw new ConversationStoreError('stale-revision', 'Conversation revision changed repeatedly');
  }

  private async requireVisibleScope(conversationId: string, recovery: boolean): Promise<ConversationRecordV1> {
    const record = await this.dependencies.store.get(conversationId);
    if (!record) throw new ConversationStoreError('not-found', 'Conversation does not exist');
    this.assertVisibleScope(record, recovery);
    return record;
  }

  private assertVisibleScope(record: ConversationRecordV1, recovery: boolean): void {
    const currentScopeId = this.dependencies.currentScope().scopeId;
    const recoveryScopeId = unassignedLegacyScope().scopeId;
    if (record.scopeId === currentScopeId) return;
    if (recovery && record.scopeId === recoveryScopeId) return;
    throw new ConversationStoreError('not-found', 'Conversation does not belong to the current project');
  }

  private emitChanged(record: ConversationRecordV1): void {
    this.dependencies.emit?.({
      type: 'conversation/changed',
      conversationId: record.conversationId,
      revision: record.revision,
      bindingGeneration: record.bindingGeneration,
    });
  }

  private async generateFirstResponseTitle(
    completedRecord: ConversationRecordV1,
    userPrompt: string,
    assistantResponse: string,
    generateTitle: (request: FirstResponseTitleRequest) => Promise<string | null>,
  ): Promise<ConversationRecordV1> {
    try {
      const rawTitle = await generateTitle({ userPrompt, assistantResponse });
      const generatedTitle = rawTitle ? normalizeGeneratedTitle(rawTitle) : null;
      if (!generatedTitle) {
        console.warn('[ConversationTitle] Runtime returned an invalid title; keeping the prompt fallback.', {
          conversationId: completedRecord.conversationId,
        });
        return completedRecord;
      }
      if (this.disposed) return completedRecord;

      const current = await this.dependencies.store.get(completedRecord.conversationId);
      if (!current || current.bindingGeneration !== completedRecord.bindingGeneration) return completedRecord;

      // A user rename while the model was thinking always wins. The AI may only
      // replace the exact deterministic fallback created from the first prompt.
      if (current.title !== fallbackTitleFromPrompt(userPrompt)) return current;

      const titled = await this.dependencies.store.checkpoint({
        conversationId: current.conversationId,
        bindingGeneration: current.bindingGeneration,
        expectedRevision: current.revision,
        title: generatedTitle,
      });
      this.emitChanged(titled);
      return titled;
    } catch (error) {
      // Title generation is best-effort. A failed classifier must never turn a
      // successfully completed conversation into an error.
      console.warn('[ConversationTitle] Generation failed; keeping the prompt fallback.', {
        conversationId: completedRecord.conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return completedRecord;
    }
  }
}
