import assert from 'node:assert/strict';
import { useAISidebarStore } from './store';
import { vscode } from '../../lib/vscode';
import type { AgentConversationTurn, CodexConversationTurn } from './types';

const initialState = useAISidebarStore.getState();

function resetStore(): void {
  useAISidebarStore.setState(initialState, true);
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
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
      pendingRuntime: { runtimeId: 'claude-code', modelId: 'claude-sonnet-4-5', mode: 'edit' },
    });

    useAISidebarStore.getState().setPendingRuntime({ runtimeId: 'codex' });

    const { pendingRuntime } = useAISidebarStore.getState();
    assert.equal(pendingRuntime.runtimeId, 'codex', 'runtimeId should update');
    assert.equal(pendingRuntime.modelId, 'claude-sonnet-4-5', 'modelId should be preserved');
    assert.equal(pendingRuntime.mode, 'edit', 'mode should be preserved');
  } finally {
    resetStore();
  }
}

function testSetPendingRuntimeModeOnly() {
  try {
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
      pendingRuntime: { runtimeId: 'codex', modelId: 'o4-mini', mode: 'edit' },
    });

    useAISidebarStore.getState().setPendingRuntime({ mode: 'plan' });

    const { pendingRuntime } = useAISidebarStore.getState();
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
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
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
    const { codexConversation } = useAISidebarStore.getState();
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
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
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
    const { agentConversation } = useAISidebarStore.getState();
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
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
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
    useAISidebarStore.setState({
      ...useAISidebarStore.getState(),
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

function main() {
  testSetPendingRuntimeMergesPartialUpdate();
  testSetPendingRuntimeModeOnly();
  testCancelRequestRoutesToCodexWhenCodexIsRunning();
  testCancelRequestRoutesToClaudeWhenClaudeIsRunning();
  testCancelRequestPrefersCodexWhenBothRuntimesHaveRunningTurns();
  testCancelRequestIsNoOpWhenNeitherRuntimeIsRunning();
  console.log('Runtime switching tests passed.');
}

main();
