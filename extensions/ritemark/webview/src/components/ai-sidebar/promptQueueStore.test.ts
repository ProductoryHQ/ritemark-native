/**
 * Sprint 104 (#162) — store-level queue engine tests: drain gating against
 * real activity states, immediate dispatch on idle targets, comment routing
 * into stable per-runtime conversations, pause on failed turns.
 */
import assert from 'node:assert/strict';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.has(key) ? this.data.get(key)! : null; }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return Array.from(this.data.keys())[index] ?? null; }
  get length(): number { return this.data.size; }
}
const storage = new MemoryStorage();
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = storage;

const { useAISidebarStore, resetOpenThreadRestoreForTest } = await import('./store');
const { createConversationState } = await import('./conversationState');
const { queueFor } = await import('./promptQueue');
const { vscode } = await import('../../lib/vscode');
type ConversationState = import('./conversationState').ConversationState;
type AgentConversationTurn = import('./types').AgentConversationTurn;

const initialState = useAISidebarStore.getState();
const posted: Array<Record<string, unknown>> = [];
vscode.postMessage = (msg: unknown) => { posted.push(msg as Record<string, unknown>); };

function resetAll(): void {
  storage.clear();
  posted.length = 0;
  useAISidebarStore.setState(initialState, true);
  resetOpenThreadRestoreForTest();
}

function turn(overrides: Partial<AgentConversationTurn> = {}): AgentConversationTurn {
  return {
    id: `turn-${Math.random().toString(36).slice(2, 8)}`,
    userPrompt: 'seed',
    activities: [],
    isRunning: false,
    isPlan: false,
    planHandled: false,
    timestamp: Date.now(),
    ...overrides,
  } as AgentConversationTurn;
}

function seed(id: string, overrides: Partial<ConversationState> = {}): void {
  const conversation = { ...createConversationState(id), ...overrides };
  useAISidebarStore.setState((s) => ({
    conversations: { ...s.conversations, [id]: conversation },
    activeConversationId: s.activeConversationId ?? id,
  }));
}

function enqueue(conversationId: string, text: string, over: Record<string, unknown> = {}) {
  return useAISidebarStore.getState().enqueuePrompt({
    conversationId,
    runtimeId: 'claude-code',
    autonomy: 'auto',
    planFirst: false,
    prompt: text,
    displayText: text,
    source: 'composer',
    ...over,
  } as never);
}

// ── 1. Idle target: enqueue dispatches immediately ──
{
  resetAll();
  seed('idle-1');
  const outcome = enqueue('idle-1', 'run now');
  assert.equal(outcome, 'queued');
  assert.equal(queueFor(useAISidebarStore.getState().promptQueues, 'idle-1').length, 0, 'idle target drains immediately');
  const exec = posted.find((m) => m.type === 'agent-execute');
  assert.ok(exec, 'agent-execute posted');
  assert.equal(exec!.conversationId, 'idle-1');
  const conv = useAISidebarStore.getState().conversations['idle-1'];
  assert.equal(conv.agentConversation.length, 1, 'turn appended to the TARGET conversation');
  assert.equal(conv.agentConversation[0].isRunning, true);
}

// ── 2. Running target: item waits; completion drains it ──
{
  resetAll();
  seed('busy-1', { agentConversation: [turn({ isRunning: true })] });
  enqueue('busy-1', 'after you finish');
  assert.equal(queueFor(useAISidebarStore.getState().promptQueues, 'busy-1').length, 1, 'running target defers');
  assert.equal(posted.filter((m) => m.type === 'agent-execute').length, 0);
  // Simulate completion → maybeDrainQueue fires (as the agent-result handler does).
  useAISidebarStore.setState((s) => ({
    conversations: {
      ...s.conversations,
      'busy-1': {
        ...s.conversations['busy-1'],
        agentConversation: [{
          ...s.conversations['busy-1'].agentConversation[0],
          isRunning: false,
          result: { text: 'ok', filesModified: [], metrics: { durationMs: 10, costUsd: null, model: null } },
        }],
      },
    },
  }));
  useAISidebarStore.getState().maybeDrainQueue('busy-1');
  assert.equal(queueFor(useAISidebarStore.getState().promptQueues, 'busy-1').length, 0, 'drained on completion');
  assert.equal(posted.filter((m) => m.type === 'agent-execute').length, 1);
}

// ── 3. Waiting states block; failed pauses ──
{
  resetAll();
  seed('waiting-1', { agentConversation: [turn({ isRunning: true, pendingPlanApproval: { toolUseId: 't', plan: '#p' } })] });
  enqueue('waiting-1', 'blocked by plan review');
  useAISidebarStore.getState().maybeDrainQueue('waiting-1');
  assert.equal(queueFor(useAISidebarStore.getState().promptQueues, 'waiting-1').length, 1, 'plan review blocks draining');

  seed('failed-1', { agentConversation: [turn({ result: { text: '', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null }, error: 'boom' } })] });
  enqueue('failed-1', 'paused item');
  useAISidebarStore.getState().maybeDrainQueue('failed-1');
  assert.equal(queueFor(useAISidebarStore.getState().promptQueues, 'failed-1').length, 1, 'failed turn pauses the queue');
  // Explicit resume dispatches.
  useAISidebarStore.getState().resumeQueue('failed-1');
  assert.equal(queueFor(useAISidebarStore.getState().promptQueues, 'failed-1').length, 0, 'resume dispatches the head');
}

// ── 4. Captured runtime is used at dispatch, not the composer's ──
{
  resetAll();
  seed('cap-1');
  enqueue('cap-1', 'codex item', { runtimeId: 'codex', autonomy: 'ask', modelId: 'gpt-test' });
  const exec = posted.find((m) => m.type === 'agent-execute');
  assert.equal(exec!.agentId, 'codex', 'captured runtime wins');
  assert.equal(exec!.approvalMode, 'ask');
  assert.equal(exec!.model, 'gpt-test');
  const conv = useAISidebarStore.getState().conversations['cap-1'];
  assert.equal(conv.codexConversation.length, 1, 'codex turn shape used');
}

// ── 5. comment:submit routes to a stable runtime conversation via the queue ──
{
  resetAll();
  // Two threads: active Claude thread; busy Codex thread.
  seed('claude-a', {});
  seed('codex-b', {
    codexConversation: [{
      id: 'x', conversationId: 'codex-b', userPrompt: 'p', runtime: 'codex', requestedPlanMode: false,
      streamingText: '', activities: [], executionContinuation: false, requiresPlanReview: false,
      planText: '', planSteps: [], planHandled: false, isRunning: true, timestamp: Date.now(),
    } as never],
  });
  useAISidebarStore.setState({ activeConversationId: 'claude-a' });
  // Deliver a comment:submit for Codex through the store's message handler.
  useAISidebarStore.getState().handleExtensionMessage({ type: 'comment:submit', agentId: 'codex', prompt: 'fix the comment' } as never);
  const q = queueFor(useAISidebarStore.getState().promptQueues, 'codex-b');
  assert.equal(q.length, 1, 'comment queued in the BUSY Codex thread, not dropped');
  assert.equal(q[0].source, 'comment');
  assert.equal(q[0].runtimeId, 'codex');
  assert.equal(queueFor(useAISidebarStore.getState().promptQueues, 'claude-a').length, 0, 'active thread untouched');
  const active = useAISidebarStore.getState().conversations['claude-a'];
  assert.equal(active.pendingRuntime.runtimeId, 'claude-code', 'active thread runtime NOT retargeted');
}

console.log('promptQueueStore tests passed.');
