import type { ConversationProjectionV1 } from '../../../../src/conversations/protocol';
import type { RuntimeId } from '../../../../src/conversations/types';
import { createConversationState, type ConversationState } from './conversationState';
import type { AgentConversationTurn, AgentId, CodexConversationTurn } from './types';

function runtimeAgent(runtime: RuntimeId | undefined): AgentId {
  return runtime === 'codex' || runtime === 'opencode' ? runtime : 'claude-code';
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
    const assistantContent = assistants.map((event) => event.content).filter(Boolean).join('\n\n');
    const runtime = runtimeAgent(user.runtimeId);
    const timestamp = Date.parse(user.occurredAt);
    if (runtime === 'claude-code') {
      agentConversation.push({
        id: user.turnId,
        conversationId: projection.conversationId,
        userPrompt: user.text,
        activities: [],
        ...(terminalAssistant ? { result: {
          text: assistantContent,
          filesModified: [],
          metrics: { durationMs: 0, costUsd: null, model: null },
          ...(terminalAssistant.terminalStatus === 'failed' ? { error: 'The turn failed.' } : {}),
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
        ...(terminalAssistant?.terminalStatus ? { result: { status: terminalAssistant.terminalStatus } } : {}),
        isRunning: projection.lifecycle.state === 'working' && projection.lifecycle.activeTurnId === user.turnId,
        timestamp,
      });
    }
  }

  const selectedAgent = runtimeAgent(projection.runtimeSummary[projection.runtimeSummary.length - 1]);
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
    restoredTranscript: true,
  });
}
