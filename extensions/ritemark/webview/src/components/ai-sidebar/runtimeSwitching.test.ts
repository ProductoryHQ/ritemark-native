import assert from 'node:assert/strict';
import { useAISidebarStore, hydrateConversations, selectActiveConversation } from './store';
import { createConversationState, type ConversationState } from './conversationState';
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

function testOpenCodeReceivesClaudeHandoff() {
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
    assert.match(exec!.prompt, /handled by Claude/i,
      'OpenCode must receive the Claude handoff preamble — the bug was that it did not');
    assert.match(exec!.prompt, /markdown editor/,
      'the handoff must carry what Claude actually said');
    assert.match(exec!.prompt, /and what would you do\?/,
      'the user request must still be present after the handoff');

    // The chat bubble shows the raw prompt, not the wrapped one.
    const { codexConversation } = selectActiveConversation(useAISidebarStore.getState());
    assert.equal(codexConversation[codexConversation.length - 1].userPrompt, 'and what would you do?',
      'the visible bubble must show the raw prompt, not the handoff wrapper');
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
  testOpenCodeReceivesClaudeHandoff();
  testOpenCodeTransmitsAttachmentsAndHonoursActiveFileRemoval();
  console.log('Runtime switching tests passed.');
}

main();
