import type { ConversationProjectionV1 } from '../../../../src/conversations/protocol';
import type { RuntimeId } from '../../../../src/conversations/types';
import { createConversationState, type ConversationState } from './conversationState';
import type { AgentConversationTurn, AgentId, CodexConversationTurn } from './types';

function runtimeAgent(runtime: RuntimeId | undefined): AgentId {
  return runtime === 'codex' || runtime === 'opencode' ? runtime : 'claude-code';
}

type TerminalEvent = Extract<ConversationProjectionV1['events'][number], { kind: 'assistant-message' | 'boundary' }>;

/** The failure sentence a terminal event carries, or undefined when the turn didn't fail. */
function terminalError(event: TerminalEvent): string | undefined {
  if (event.kind === 'boundary') return event.boundaryKind === 'failed' ? event.message : undefined;
  return event.terminalStatus === 'failed' ? event.error ?? 'The turn failed.' : undefined;
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
    selectedModel: previous?.selectedModel ?? '',
    codexSelectedModel: previous?.codexSelectedModel ?? '',
    opencodeSelectedModel: previous?.opencodeSelectedModel ?? '',
    pendingRuntime: {
      runtimeId: selectedAgent,
      modelId: previous?.pendingRuntime.modelId ?? '',
      mode: previous?.pendingRuntime.mode ?? 'auto',
    },
    thinkingEffortByRuntime: {
      ...(previous?.thinkingEffortByRuntime ?? {}),
      ...projection.composerPreferences.thinkingEffortByRuntime,
    },
    transcriptBoundaries,
  });
}
