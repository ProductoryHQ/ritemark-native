import type { ConversationProjectionV1 } from '../../../../src/conversations/protocol';
import type { RuntimeId } from '../../../../src/conversations/types';
import { createConversationState, type ConversationState } from './conversationState';
import type { AcpProviderFlags, AgentConversationTurn, AgentId, ByokModelOption, CodexConversationTurn, ModelOption } from './types';

function runtimeAgent(runtime: RuntimeId | undefined): AgentId {
  return runtime === 'codex' || runtime === 'opencode' ? runtime : 'claude-code';
}

type TerminalEvent = Extract<ConversationProjectionV1['events'][number], { kind: 'assistant-message' | 'boundary' }>;

/** The failure sentence a terminal event carries, or undefined when the turn didn't fail. */
function terminalError(event: TerminalEvent): string | undefined {
  if (event.kind === 'boundary') return event.boundaryKind === 'failed' ? event.message : undefined;
  return event.terminalStatus === 'failed' ? event.error ?? 'The turn failed.' : undefined;
}

/** The model lists a restored chat is checked against (Sprint 139, R6). */
export interface RestoreCatalogs {
  claude: ModelOption[];
  claudeDefault: string;
  codex: ModelOption[];
  opencodeEnabled: boolean;
  acpProviders: AcpProviderFlags | undefined;
  byok: Record<string, ByokModelOption[]> | undefined;
}

function offered(models: ModelOption[], id: string): string | undefined {
  return models.find((model) => model.id === id || model.resolvedModel === id || model.aliases?.includes(id))?.id;
}

function offeredOpenCode(catalogs: RestoreCatalogs, composite: string): boolean {
  const bare = composite.replace(/^opencode:/, '');
  const slash = bare.indexOf('/');
  if (slash <= 0) return false;
  const vendor = bare.slice(0, slash) as keyof AcpProviderFlags;
  return Boolean(catalogs.acpProviders?.[vendor]) && Boolean(catalogs.byok?.[vendor]?.some((model) => model.id === bare.slice(slash + 1)));
}

function firstOpenCode(catalogs: RestoreCatalogs): string {
  if (!catalogs.opencodeEnabled || !catalogs.acpProviders || !catalogs.byok) return '';
  for (const vendor of ['google', 'openai', 'anthropic', 'openrouter'] as const) {
    const first = catalogs.acpProviders[vendor] ? catalogs.byok[vendor]?.[0] : undefined;
    if (first) return `opencode:${vendor}/${first.id}`;
  }
  return '';
}

/**
 * Sprint 139 (#417, R6): a restored chat keeps each saved model the catalog
 * still offers, and falls back to the catalog's default only for one it
 * doesn't. The host names that fallback once, before the next turn runs. With
 * no catalog yet (before the bootstrap), nothing changes: the bootstrap checks
 * every open chat the same way.
 */
export function reconcileRestoredModels(conversation: ConversationState, catalogs: RestoreCatalogs): ConversationState {
  if (catalogs.claude.length === 0) return conversation;
  const selectedModel = (conversation.selectedModel && offered(catalogs.claude, conversation.selectedModel))
    || offered(catalogs.claude, catalogs.claudeDefault)
    || catalogs.claude[0].id;
  const codexDefault = (catalogs.codex.find((model) => model.isDefault) ?? catalogs.codex[0])?.id ?? '';
  const codexSelectedModel = catalogs.codex.length === 0
    ? conversation.codexSelectedModel
    : (conversation.codexSelectedModel && offered(catalogs.codex, conversation.codexSelectedModel)) || codexDefault;
  const opencodeSelectedModel = conversation.opencodeSelectedModel && offeredOpenCode(catalogs, conversation.opencodeSelectedModel)
    ? conversation.opencodeSelectedModel
    : firstOpenCode(catalogs) || conversation.opencodeSelectedModel;
  const runtimeId = conversation.pendingRuntime.runtimeId;
  const pendingModel = runtimeId === 'claude-code'
    ? selectedModel
    : runtimeId === 'codex'
      ? codexSelectedModel
      : opencodeSelectedModel.replace(/^opencode:/, '');
  return {
    ...conversation,
    selectedModel,
    codexSelectedModel,
    opencodeSelectedModel,
    pendingRuntime: { ...conversation.pendingRuntime, modelId: pendingModel },
  };
}

export function projectionToConversation(
  projection: ConversationProjectionV1,
  previous?: ConversationState,
): ConversationState {
  const agentConversation: AgentConversationTurn[] = [];
  const codexConversation: CodexConversationTurn[] = [];
  const userEvents = projection.events.filter((event) => event.kind === 'user-message');
  for (const user of userEvents) {
    const assistants = projection.events.filter(
      (event): event is Extract<typeof event, { kind: 'assistant-message' }> => (
        event.kind === 'assistant-message' && event.turnId === user.turnId
      ),
    );
    const terminalAssistant = assistants[assistants.length - 1];
    const terminalBoundary = [...projection.events].reverse().find(
      (event): event is Extract<typeof event, { kind: 'boundary' }> => (
        event.kind === 'boundary'
        && event.turnId === user.turnId
        && (event.boundaryKind === 'failed' || event.boundaryKind === 'cancelled')
      ),
    );
    const terminalEvent = terminalBoundary && (!terminalAssistant || terminalBoundary.sequence > terminalAssistant.sequence)
      ? terminalBoundary
      : terminalAssistant;
    const assistantContent = assistants.map((event) => event.content).filter(Boolean).join('\n\n');
    const runtime = runtimeAgent(user.runtimeId);
    const timestamp = Date.parse(user.occurredAt);
    if (runtime === 'claude-code') {
      agentConversation.push({
        id: user.turnId,
        conversationId: projection.conversationId,
        userPrompt: user.text,
        activities: [],
        ...(terminalEvent ? { result: {
          text: assistantContent,
          filesModified: [],
          // #488: the saved working time, or no metrics at all (the status line
          // then says "Done"). A 0 here read as "Done in 0.0s".
          ...(terminalEvent.kind === 'assistant-message' && terminalEvent.activeDurationMs !== undefined
            ? { metrics: { durationMs: terminalEvent.activeDurationMs, costUsd: null, model: null } }
            : {}),
          ...(terminalEvent.kind === 'boundary'
            ? terminalEvent.boundaryKind === 'failed'
              ? { error: terminalEvent.message }
              : {}
            : terminalEvent.terminalStatus === 'failed'
              ? { error: terminalEvent.error ?? 'The turn failed.' }
              : {}),
          ...(terminalEvent.failureKind ? { failureKind: terminalEvent.failureKind } : {}),
          // Sprint 139 (#376): a restored failed turn draws the same card as the live one.
          ...(terminalError(terminalEvent) && terminalEvent.errorKind ? { errorKind: terminalEvent.errorKind } : {}),
          ...(terminalError(terminalEvent) && terminalEvent.errorKind && terminalEvent.errorDetail ? { errorDetail: terminalEvent.errorDetail } : {}),
        } } : {}),
        isRunning: projection.lifecycle.state === 'working' && projection.lifecycle.activeTurnId === user.turnId,
        isPlan: user.mode === 'plan',
        planHandled: false,
        timestamp,
      });
    } else {
      codexConversation.push({
        id: user.turnId,
        conversationId: projection.conversationId,
        runtime,
        userPrompt: user.text,
        requestedPlanMode: user.mode === 'plan',
        streamingText: assistantContent,
        activities: [],
        ...(terminalEvent ? { result: {
          status: terminalEvent.kind === 'boundary'
            ? terminalEvent.boundaryKind === 'cancelled' ? 'cancelled' : 'failed'
            : terminalEvent.terminalStatus ?? 'completed',
          // Sprint 139 (#376): ChatGPT's and OpenCode's restored failures say their sentence again
          // (2.0 restored only "Failed"), and draw their card.
          ...(terminalError(terminalEvent) ? { error: terminalError(terminalEvent) } : {}),
          ...(terminalError(terminalEvent) && terminalEvent.errorKind ? { errorKind: terminalEvent.errorKind } : {}),
          ...(terminalError(terminalEvent) && terminalEvent.errorKind && terminalEvent.errorDetail ? { errorDetail: terminalEvent.errorDetail } : {}),
        } } : {}),
        isRunning: projection.lifecycle.state === 'working' && projection.lifecycle.activeTurnId === user.turnId,
        timestamp,
      });
    }
  }

  const selectedAgent = runtimeAgent(projection.runtimeSummary[projection.runtimeSummary.length - 1]);
  // Sprint 139 (#417, R6): the chat's own saved model for each AI comes first. A chat saved by
  // 2.0 has none, and behaves as before: the open chat's pick, then the catalog's default.
  const saved = projection.composerPreferences.modelByRuntime ?? {};
  const selectedModel = saved['claude-code'] ?? previous?.selectedModel ?? '';
  const codexSelectedModel = saved.codex ?? previous?.codexSelectedModel ?? '';
  const opencodeSelectedModel = saved.opencode ? `opencode:${saved.opencode.replace(/^opencode:/, '')}` : previous?.opencodeSelectedModel ?? '';
  const pendingModelId = selectedAgent === 'claude-code'
    ? (saved['claude-code'] ?? previous?.pendingRuntime.modelId ?? '')
    : selectedAgent === 'codex'
      ? (saved.codex ?? previous?.pendingRuntime.modelId ?? '')
      : (saved.opencode?.replace(/^opencode:/, '') ?? previous?.pendingRuntime.modelId ?? '');
  const transcriptBoundaries = projection.events
    .filter((event): event is Extract<typeof event, { kind: 'boundary' }> => (
      event.kind === 'boundary' && event.boundaryKind === 'context-restored'
    ))
    .map((event) => ({
      id: event.eventId,
      turnId: event.turnId,
      runtimeId: runtimeAgent(event.runtimeId),
      timestamp: Date.parse(event.occurredAt),
      message: event.message,
    }));
  return createConversationState(projection.conversationId, {
    createdAt: Date.parse(projection.createdAt),
    agentConversation,
    codexConversation,
    selectedAgent,
    selectedModel,
    codexSelectedModel,
    opencodeSelectedModel,
    pendingRuntime: {
      runtimeId: selectedAgent,
      modelId: pendingModelId,
      mode: previous?.pendingRuntime.mode ?? 'auto',
    },
    thinkingEffortByRuntime: {
      ...(previous?.thinkingEffortByRuntime ?? {}),
      ...projection.composerPreferences.thinkingEffortByRuntime,
    },
    transcriptBoundaries,
  });
}
