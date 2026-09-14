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

const { useAISidebarStore, resetConversationMigrationGuardForTest } = await import('./store');
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
  resetConversationMigrationGuardForTest();
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
  seed('idle-1', { selectedModel: 'claude-test-model' });
  const outcome = enqueue('idle-1', 'run now');
  assert.equal(outcome, 'queued');
  assert.equal(queueFor(useAISidebarStore.getState().promptQueues, 'idle-1').length, 0, 'idle target drains immediately');
  const exec = posted.find((m) => m.type === 'agent-execute');
  assert.ok(exec, 'agent-execute posted');
  assert.equal(exec!.conversationId, 'idle-1');
  // Model drift fix (2026-08-05): a Claude dispatch NEVER goes out modeless —
  // an absent model let the bundled CLI fall back to the user's personal
  // ~/.claude.json and silently run a different model than the UI showed.
  assert.equal(exec!.model, 'claude-test-model', 'frozen/selected model is pinned on the payload');
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

// ── 5. a comment task runs in the conversation the HOST named ──
// Sprint 117 (R4, D5, audit F20) rewrote this block. It used to feed
// `comment:submit` and assert the store picked a destination itself ("first
// ready thread of that runtime, else a new background one") — a silent choice
// the user was never shown. The store no longer picks: the host binds the
// conversation open in the sidebar at acceptance and names it on
// `comment-task/enqueue`. The invariants worth keeping are the same two the
// old block guarded — a busy destination still queues rather than being
// dropped, and the visible thread is neither used nor retargeted — plus the
// enqueue verdict, which the old path had no way to report.
{
  resetAll();
  // Two threads: the visible Claude thread; a BUSY Codex thread.
  seed('claude-a', {});
  seed('codex-b', {
    codexConversation: [{
      id: 'x', conversationId: 'codex-b', userPrompt: 'p', runtime: 'codex', requestedPlanMode: false,
      streamingText: '', activities: [], executionContinuation: false, requiresPlanReview: false,
      planText: '', planSteps: [], planHandled: false, isRunning: true, timestamp: Date.now(),
    } as never],
  });
  useAISidebarStore.setState({ activeConversationId: 'claude-a' });

  useAISidebarStore.getState().handleExtensionMessage({
    type: 'comment-task/enqueue',
    taskId: 'task-5',
    conversationId: 'codex-b',
    conversationTurnId: 'turn-host-5',
    runtimeId: 'codex',
    prompt: 'fix the comment',
    displayText: 'fix the comment',
    modelId: null,
    autonomy: 'auto',
    thinkingEffort: 'auto',
    sourceDisplayPath: 'notes/release.md',
  } as never);

  const q = queueFor(useAISidebarStore.getState().promptQueues, 'codex-b');
  assert.equal(q.length, 1, 'comment queued in the BUSY named thread, not dropped');
  assert.equal(q[0].source, 'comment');
  assert.equal(q[0].runtimeId, 'codex');
  assert.equal(q[0].taskId, 'task-5', 'the item carries its task id');
  assert.equal(q[0].conversationTurnId, 'turn-host-5', 'the host-minted turn id is used verbatim');
  assert.equal(queueFor(useAISidebarStore.getState().promptQueues, 'claude-a').length, 0, 'visible thread untouched');
  const active = useAISidebarStore.getState().conversations['claude-a'];
  assert.equal(active.pendingRuntime.runtimeId, 'claude-code', 'visible thread runtime NOT retargeted');
  assert.deepEqual(
    posted.find((m) => m.type === 'comment-task/enqueue-result'),
    { type: 'comment-task/enqueue-result', taskId: 'task-5', outcome: 'queued' },
    'the queue verdict is reported back to the host',
  );
}

// ── 6. a destination this sidebar does not hold is reported, not redirected ──
{
  resetAll();
  seed('claude-a', {});
  useAISidebarStore.setState({ activeConversationId: 'claude-a' });

  useAISidebarStore.getState().handleExtensionMessage({
    type: 'comment-task/enqueue',
    taskId: 'task-6',
    conversationId: 'gone-9',
    conversationTurnId: 'turn-host-6',
    runtimeId: 'claude-code',
    prompt: 'p',
    displayText: 'p',
    modelId: null,
    autonomy: 'auto',
    thinkingEffort: 'auto',
    sourceDisplayPath: 'notes/release.md',
  } as never);

  assert.equal(
    queueFor(useAISidebarStore.getState().promptQueues, 'claude-a').length, 0,
    'an unknown destination is NEVER redirected into the visible thread',
  );
  assert.deepEqual(
    posted.find((m) => m.type === 'comment-task/enqueue-result'),
    { type: 'comment-task/enqueue-result', taskId: 'task-6', outcome: 'no-conversation' },
    'the sidebar says so instead of inventing a destination',
  );
}

console.log('promptQueueStore tests passed.');
