import assert from 'node:assert/strict';
import { useAISidebarStore, hydrateConversations, selectActiveConversation } from './store';
import {
  createConversationState,
  isRuntimeHandoff,
  type ConversationState,
} from './conversationState';
import { vscode } from '../../lib/vscode';
import type { AgentConversationTurn, CodexConversationTurn } from './types';

const initialState = useAISidebarStore.getState();

function resetStore(): void {
  useAISidebarStore.setState(initialState, true);
}

/**
 * Sprint 99: conversation state lives in `conversations[id]`, not in top-level
 * store fields. Seed through the conversation map — writing the flat mirror
 * fields directly no longer reaches the source of truth.
 */
function seedActiveConversation(partial: Partial<ConversationState> = {}): string {
  const conversation = createConversationState('conv-active', partial);
  hydrateConversations([conversation], conversation.id);
  return conversation.id;
}

function makeCodexTurn(overrides: Partial<CodexConversationTurn> = {}): CodexConversationTurn {
  return {
    id: 'codex-turn-1',
    userPrompt: 'Do the task',
    streamingText: '',
    activities: [],
    planText: '',
    planSteps: [],
    planHandled: false,
    isRunning: false,
    timestamp: 1,
    executionContinuation: false,
    requiresPlanReview: false,
    ...overrides,
  };
}

function makeAgentTurn(overrides: Partial<AgentConversationTurn> = {}): AgentConversationTurn {
  return {
    id: 'agent-turn-1',
    userPrompt: 'Do the task',
    activities: [],
    isRunning: false,
    isPlan: false,
    planHandled: false,
    timestamp: 1,
    ...overrides,
  };
}

// ── setPendingRuntime ──────────────────────────────────────────────────────────

function testSetPendingRuntimeMergesPartialUpdate() {
  try {
    seedActiveConversation({
      pendingRuntime: { runtimeId: 'claude-code', modelId: 'claude-sonnet-4-5', mode: 'ask' },
    });

    useAISidebarStore.getState().setPendingRuntime({ runtimeId: 'codex' });

    const { pendingRuntime } = selectActiveConversation(useAISidebarStore.getState());
    assert.equal(pendingRuntime.runtimeId, 'codex', 'runtimeId should update');
    assert.equal(pendingRuntime.modelId, 'claude-sonnet-4-5', 'modelId should be preserved');
    assert.equal(pendingRuntime.mode, 'ask', 'mode should be preserved');
  } finally {
    resetStore();
  }
}

function testSetPendingRuntimeModeOnly() {
  try {
    seedActiveConversation({
      pendingRuntime: { runtimeId: 'codex', modelId: 'o4-mini', mode: 'auto' },
    });

    useAISidebarStore.getState().setPendingRuntime({ mode: 'plan' });

    const { pendingRuntime } = selectActiveConversation(useAISidebarStore.getState());
    assert.equal(pendingRuntime.runtimeId, 'codex', 'runtimeId should be preserved');
    assert.equal(pendingRuntime.modelId, 'o4-mini', 'modelId should be preserved');
    assert.equal(pendingRuntime.mode, 'plan', 'mode should update');
  } finally {
    resetStore();
  }
}

// ── cancelRequest routing ──────────────────────────────────────────────────────

function testCancelRequestRoutesToCodexWhenCodexIsRunning() {
  const posted: unknown[] = [];
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = (message: unknown) => { posted.push(message); };

  try {
    seedActiveConversation({
      selectedAgent: 'codex',
      codexConversation: [makeCodexTurn({ isRunning: true })],
      agentConversation: [],
    });

    useAISidebarStore.getState().cancelRequest();

    assert.ok(
      posted.some((m) => typeof m === 'object' && m !== null && 'type' in m && (m as { type: string; agentId?: string }).type === 'agent-cancel' && (m as { type: string; agentId?: string }).agentId === 'codex'),
      'cancelRequest must send agent-cancel with agentId=codex when Codex has a running turn'
    );
    assert.ok(
      !posted.some((m) => typeof m === 'object' && m !== null && 'type' in m && (m as { type: string; agentId?: string }).type === 'agent-cancel' && (m as { type: string; agentId?: string }).agentId === 'claude-code'),
      'cancelRequest must not send agent-cancel with agentId=claude-code when only Codex is running'
    );
    const { codexConversation } = selectActiveConversation(useAISidebarStore.getState());
    assert.equal(codexConversation[0].isRunning, false, 'cancelled Codex turn must be marked not running');
    assert.equal(codexConversation[0].result?.error, 'Cancelled by user');
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testCancelRequestRoutesToClaudeWhenClaudeIsRunning() {
  const posted: unknown[] = [];
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = (message: unknown) => { posted.push(message); };

  try {
    seedActiveConversation({
      agentConversation: [makeAgentTurn({ isRunning: true })],
      codexConversation: [],
    });

    useAISidebarStore.getState().cancelRequest();

    assert.ok(
      posted.some((m) => typeof m === 'object' && m !== null && 'type' in m && (m as { type: string; agentId?: string }).type === 'agent-cancel' && (m as { type: string; agentId?: string }).agentId === 'claude-code'),
      'cancelRequest must send agent-cancel with agentId=claude-code when Claude has a running turn'
    );
    assert.ok(
      !posted.some((m) => typeof m === 'object' && m !== null && 'type' in m && (m as { type: string; agentId?: string }).type === 'agent-cancel' && (m as { type: string; agentId?: string }).agentId === 'codex'),
      'cancelRequest must not send agent-cancel with agentId=codex when only Claude is running'
    );
    const { agentConversation } = selectActiveConversation(useAISidebarStore.getState());
    assert.equal(agentConversation[0].isRunning, false, 'cancelled Claude turn must be marked not running');
    assert.equal(agentConversation[0].result?.error, 'Cancelled by user');
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testCancelRequestPrefersCodexWhenBothRuntimesHaveRunningTurns() {
  const posted: unknown[] = [];
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = (message: unknown) => { posted.push(message); };

  try {
    seedActiveConversation({
      selectedAgent: 'codex',
      codexConversation: [makeCodexTurn({ isRunning: true })],
      agentConversation: [makeAgentTurn({ isRunning: true })],
    });

    useAISidebarStore.getState().cancelRequest();

    assert.ok(
      posted.some((m) => typeof m === 'object' && m !== null && 'type' in m && (m as { type: string; agentId?: string }).type === 'agent-cancel' && (m as { type: string; agentId?: string }).agentId === 'codex'),
      'cancelRequest must target Codex first when both runtimes have running turns'
    );
    assert.ok(
      !posted.some((m) => typeof m === 'object' && m !== null && 'type' in m && (m as { type: string; agentId?: string }).type === 'agent-cancel' && (m as { type: string; agentId?: string }).agentId === 'claude-code'),
      'cancelRequest must not double-cancel Claude when Codex is already targeted'
    );
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testCancelRequestIsNoOpWhenNeitherRuntimeIsRunning() {
  const posted: unknown[] = [];
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = (message: unknown) => { posted.push(message); };

  try {
    seedActiveConversation({
      codexConversation: [makeCodexTurn({ isRunning: false })],
      agentConversation: [makeAgentTurn({ isRunning: false })],
    });

    useAISidebarStore.getState().cancelRequest();

    assert.ok(
      !posted.some((m) => typeof m === 'object' && m !== null && 'type' in m && (m as { type: string }).type === 'agent-cancel'),
      'cancelRequest must not send agent-cancel when neither runtime is running'
    );
    assert.equal(posted.length, 0, 'cancelRequest must post no messages when neither runtime is running');
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

// ── cross-runtime handoff (OpenCode was the odd one out) ────────────────────────

function testCrossRuntimeChangeIsAnImmediateHandoffForNonEmptyConversation() {
  const nonEmpty = createConversationState('non-empty', {
    pendingRuntime: { runtimeId: 'claude-code', modelId: '', mode: 'auto' },
    agentConversation: [makeAgentTurn()],
  });
  assert.equal(isRuntimeHandoff(nonEmpty, 'opencode'), true);
  assert.equal(isRuntimeHandoff(nonEmpty, 'claude-code'), false);

  const empty = createConversationState('empty', {
    pendingRuntime: { runtimeId: 'claude-code', modelId: '', mode: 'auto' },
  });
  assert.equal(isRuntimeHandoff(empty, 'codex'), false);
}

function testTranscriptRestorationUsesDurableBoundaryInsteadOfBanner() {
  try {
    seedActiveConversation();
    useAISidebarStore.getState().handleExtensionMessage({
      type: 'conversation/continuation-state',
      conversationId: 'conv-active',
      turnId: 'turn-2',
      runtimeId: 'codex',
      state: {
        mode: 'transcript-restored',
        truncated: true,
        unansweredPriorRequest: true,
      },
    });

    assert.equal(
      selectActiveConversation(useAISidebarStore.getState()).continuationNotice,
      null,
      'transcript restoration is disclosed only by the durable inline boundary',
    );
    assert.deepEqual(
      selectActiveConversation(useAISidebarStore.getState()).transcriptBoundaries.map(({ turnId, runtimeId, message }) => ({ turnId, runtimeId, message })),
      [{
        turnId: 'turn-2',
        runtimeId: 'codex',
        message: 'Continuing with Codex. Previous messages were included as context. The previous agent did not return a saved answer. Some older messages were left out.',
      }],
      'same-runtime fallback renders its compact boundary immediately without waiting for a reload',
    );

    useAISidebarStore.getState().handleExtensionMessage({
      type: 'conversation/continuation-state',
      conversationId: 'conv-active',
      runtimeId: 'codex',
      state: { mode: 'context-unavailable' },
    });
    assert.deepEqual(selectActiveConversation(useAISidebarStore.getState()).continuationNotice, {
      mode: 'context-unavailable',
      runtimeId: 'codex',
      truncated: false,
      unansweredPriorRequest: false,
    });
    useAISidebarStore.getState().dismissContinuationNotice('conv-active');
    assert.equal(selectActiveConversation(useAISidebarStore.getState()).continuationNotice, null);
  } finally {
    resetStore();
  }
}

function testFailedRuntimeCanBeStoppedAndHandedToAnotherAgent() {
  const posted: unknown[] = [];
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = (message: unknown) => { posted.push(message); };
  try {
    seedActiveConversation({
      selectedAgent: 'codex',
      pendingRuntime: { runtimeId: 'codex', modelId: 'gpt-5.6-codex', mode: 'auto' },
      selectedModel: 'claude-opus-4-1',
      codexConversation: [makeCodexTurn({
        id: 'unanswered-codex-turn',
        userPrompt: 'Complete the Credit24 task',
        isRunning: true,
      })],
    });

    // The confirmation action stops the old runtime before applying the new
    // selection, so the composer does not queue behind a runtime that is down.
    useAISidebarStore.getState().cancelRequest();
    useAISidebarStore.getState().selectAgent('claude-code');
    useAISidebarStore.getState().setPendingRuntime({ runtimeId: 'claude-code', modelId: 'claude-opus-4-1' });
    useAISidebarStore.getState().sendAgentMessage('Solve it yourself');

    assert.ok(posted.some((message) => (
      typeof message === 'object' && message !== null
      && (message as { type?: string }).type === 'agent-cancel'
      && (message as { agentId?: string }).agentId === 'codex'
    )), 'handoff stops the unresponsive runtime');
    assert.ok(posted.some((message) => (
      typeof message === 'object' && message !== null
      && (message as { type?: string }).type === 'agent-execute'
      && (message as { agentId?: string; prompt?: string }).agentId === 'claude-code'
      && (message as { prompt?: string }).prompt === 'Solve it yourself'
    )), 'the new instruction is dispatched once to the selected runtime');
    const active = selectActiveConversation(useAISidebarStore.getState());
    const latestAgentTurn = active.agentConversation[active.agentConversation.length - 1];
    assert.equal(active.codexConversation[0].isRunning, false);
    assert.equal(latestAgentTurn?.userPrompt, 'Solve it yourself');
    assert.equal(latestAgentTurn?.isRunning, true);
    assert.deepEqual(active.transcriptBoundaries.map(({ turnId, runtimeId, message }) => ({ turnId, runtimeId, message })), [{
      turnId: latestAgentTurn.id,
      runtimeId: 'claude-code',
      message: 'Continuing with Claude. Previous messages were included as context.',
    }], 'the handoff disclosure appears immediately with the newly sent user turn');
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testOpenCodeLeavesCanonicalHandoffContextToHost() {
  const posted: unknown[] = [];
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = (message: unknown) => { posted.push(message); };

  try {
    // A conversation where Claude answered first, then the user switches to OpenCode.
    seedActiveConversation({
      opencodeSelectedModel: 'opencode:openrouter/some-model',
      pendingRuntime: { runtimeId: 'opencode', modelId: 'opencode:openrouter/some-model', mode: 'auto' },
      agentConversation: [makeAgentTurn({
        userPrompt: 'Summarise the README',
        result: { text: 'The README describes a markdown editor.', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null } },
        timestamp: 1,
      })],
      codexConversation: [],
    });

    useAISidebarStore.getState().sendOpenCodeMessage('and what would you do?');

    const exec = posted.find((m): m is { type: string; agentId: string; prompt: string } =>
      typeof m === 'object' && m !== null && (m as { type?: string }).type === 'agent-execute'
      && (m as { agentId?: string }).agentId === 'opencode');
    assert.ok(exec, 'sendOpenCodeMessage must post an agent-execute for opencode');
    assert.equal(exec!.prompt, 'and what would you do?',
      'the webview must send the current request once and leave canonical transcript framing to the host');
    assert.doesNotMatch(exec!.prompt, /markdown editor|handled by Claude/i,
      'the removed webview preamble must not duplicate the host continuation pack');

    // The chat bubble shows the raw prompt, not the wrapped one.
    const { codexConversation } = selectActiveConversation(useAISidebarStore.getState());
    assert.equal(codexConversation[codexConversation.length - 1].userPrompt, 'and what would you do?',
      'the visible bubble must show the raw prompt, not the handoff wrapper');
    assert.equal(
      selectActiveConversation(useAISidebarStore.getState()).transcriptBoundaries[0]?.message,
      'Continuing with OpenCode. Previous messages were included as context.',
      'the runtime switch boundary must render immediately rather than waiting for a reload',
    );
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

function testOpenCodeTransmitsAttachmentsAndHonoursActiveFileRemoval() {
  const posted: unknown[] = [];
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = (message: unknown) => { posted.push(message); };

  try {
    seedActiveConversation({
      opencodeSelectedModel: 'opencode:anthropic/claude-sonnet-5',
      pendingRuntime: { runtimeId: 'opencode', modelId: 'anthropic/claude-sonnet-5', mode: 'ask' },
    });
    useAISidebarStore.setState({ activeFilePath: '/workspace/private-notes.md' });

    const attachment = {
      id: 'attachment-1',
      kind: 'text' as const,
      name: 'brief.md',
      data: '# Brief',
      mediaType: 'text/markdown',
    };
    useAISidebarStore.getState().sendOpenCodeMessage(
      'Review the attached brief',
      [attachment],
      { skipActiveFile: true },
    );

    const exec = posted.find((message): message is {
      type: string;
      agentId: string;
      skipActiveFile?: boolean;
      attachments?: typeof attachment[];
    } => typeof message === 'object' && message !== null
      && (message as { type?: string }).type === 'agent-execute'
      && (message as { agentId?: string }).agentId === 'opencode');
    assert.ok(exec, 'OpenCode must post an agent-execute message');
    assert.equal(exec.skipActiveFile, true, 'dismissed active-file context must reach the host');
    assert.deepEqual(exec.attachments, [attachment], 'OpenCode attachments must reach the runtime payload');

    const { codexConversation } = selectActiveConversation(useAISidebarStore.getState());
    const turn = codexConversation[codexConversation.length - 1];
    assert.equal(turn.activeFilePath, undefined, 'dismissed active file must not appear in the visible turn metadata');
    assert.deepEqual(turn.attachments, [attachment], 'the visible OpenCode turn must retain attachment metadata');
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}


function main() {
  testSetPendingRuntimeMergesPartialUpdate();
  testSetPendingRuntimeModeOnly();
  testCancelRequestRoutesToCodexWhenCodexIsRunning();
  testCancelRequestRoutesToClaudeWhenClaudeIsRunning();
  testCancelRequestPrefersCodexWhenBothRuntimesHaveRunningTurns();
  testCancelRequestIsNoOpWhenNeitherRuntimeIsRunning();
  testCrossRuntimeChangeIsAnImmediateHandoffForNonEmptyConversation();
  testTranscriptRestorationUsesDurableBoundaryInsteadOfBanner();
  testFailedRuntimeCanBeStoppedAndHandedToAnotherAgent();
  testOpenCodeLeavesCanonicalHandoffContextToHost();
  testOpenCodeTransmitsAttachmentsAndHonoursActiveFileRemoval();
  console.log('Runtime switching tests passed.');
}

main();
