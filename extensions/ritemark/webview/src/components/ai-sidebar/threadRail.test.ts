/**
 * Sprint 99 (R11 / R12 / R13 / R14, E5–E7) — rail behaviour at the STORE level.
 *
 * `threadStatus.test.ts` covers the pure rules; this file covers what the rail's
 * buttons actually do to the store:
 *   - "+" at the soft cap prompts instead of silently opening a 6th thread, and
 *     still opens one when nothing is idle to close (Resolved Gap 2)
 *   - closing a thread keeps it in History (close ≠ delete, R11/R12)
 *   - History switches to open threads and reopens closed ones, without ever
 *     destroying another thread (R12)
 *   - a prompt queued in thread A is never visible or sendable as thread B's
 *     (R14 / E5)
 *   - the open-thread set persists and restores, with mid-flight turns marked
 *     interrupted rather than resurrected (R13 / E7)
 *
 * Run with: npx tsx webview/src/components/ai-sidebar/threadRail.test.ts
 */
import assert from 'node:assert/strict';

// ── Environment shims (no DOM in node) ───────────────────────────────────
// Installed BEFORE the store is imported: chatHistoryStorage reads localStorage.
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
const { createConversationState, isConversationEmpty, INTERRUPTED_TURN_MESSAGE } = await import('./conversationState');
const { slotFor, setSlot, clearSlot, pruneSlots } = await import('./composerQueue');
const { SOFT_THREAD_CAP } = await import('./threadStatus');
const { listConversations, saveOpenThreadIds, loadOpenThreadIds } = await import('./chatHistoryStorage');
const { vscode } = await import('../../lib/vscode');
type ConversationState = import('./conversationState').ConversationState;
type AgentConversationTurn = import('./types').AgentConversationTurn;

const initialState = useAISidebarStore.getState();
vscode.postMessage = () => { /* silence the host bridge in tests */ };

function resetAll(): void {
  storage.clear();
  useAISidebarStore.setState(initialState, true);
  resetOpenThreadRestoreForTest();
}

const AGENT_CONFIG_BASE = {
  type: 'agent:config' as const,
  agenticEnabled: true,
  selectedAgent: 'claude-code',
  selectedModel: '',
  agents: [],
  models: [],
};

function agentTurn(overrides: Partial<AgentConversationTurn> = {}): AgentConversationTurn {
  return {
    id: `turn-${Math.random().toString(36).slice(2, 8)}`,
    userPrompt: 'Review the open issues',
    activities: [],
    isRunning: false,
    isPlan: false,
    planHandled: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

/** Seed N open threads, each with one finished turn so none is "empty". */
function seedThreads(specs: Array<Partial<AgentConversationTurn>>): string[] {
  const conversations: Record<string, ConversationState> = {};
  const ids: string[] = [];
  specs.forEach((spec, i) => {
    const id = `conv-${i}`;
    ids.push(id);
    conversations[id] = createConversationState(id, {
      createdAt: 1000 + i,
      agentConversation: [agentTurn({ conversationId: id, ...spec })],
    });
  });
  useAISidebarStore.setState({ conversations, activeConversationId: ids[0] });
  return ids;
}

// ── 1. Soft cap on "+" (R11 + Resolved Gap 2) ────────────────────────────

{
  resetAll();
  // Four busy threads: under the cap, so "+" just opens a fifth.
  seedThreads([{ isRunning: true }, { isRunning: true }, { isRunning: true }, { isRunning: true }]);
  useAISidebarStore.getState().requestNewThread();
  assert.equal(Object.keys(useAISidebarStore.getState().conversations).length, SOFT_THREAD_CAP);
  assert.equal(useAISidebarStore.getState().pendingThreadOpen, null, 'no prompt below the cap');
}

{
  resetAll();
  // At the cap WITH an idle thread → prompt, and do not open anything yet.
  const ids = seedThreads([
    { isRunning: true }, { isRunning: true }, {}, { isRunning: true }, { isRunning: true },
  ]);
  useAISidebarStore.getState().requestNewThread();
  const state = useAISidebarStore.getState();
  assert.deepEqual(state.pendingThreadOpen, { kind: 'new' }, 'the cap raises a decision');
  assert.equal(Object.keys(state.conversations).length, SOFT_THREAD_CAP, 'nothing opened behind the prompt');
  assert.ok(state.conversations[ids[2]], 'the idle thread is still open');
}

{
  resetAll();
  // At the cap with NOTHING idle. The cap is advisory — after "open anyway"
  // the thread exists. A hard block here would punish the exact workflow this
  // sprint enables.
  seedThreads([
    { isRunning: true },
    { isRunning: true },
    { approval: { approvalType: 'command', requestId: 'r1' } },
    { isRunning: true },
    { isRunning: true },
  ]);
  useAISidebarStore.getState().requestNewThread();
  assert.deepEqual(useAISidebarStore.getState().pendingThreadOpen, { kind: 'new' });

  useAISidebarStore.getState().confirmThreadOpen();
  const after = useAISidebarStore.getState();
  assert.equal(after.pendingThreadOpen, null);
  assert.equal(Object.keys(after.conversations).length, SOFT_THREAD_CAP + 1, 'open anyway really opens');
  assert.ok(isConversationEmpty(after.conversations[after.activeConversationId!]), 'the new thread is the active blank');
}

{
  resetAll();
  // Cancelling the prompt opens nothing.
  seedThreads([{ isRunning: true }, { isRunning: true }, { isRunning: true }, { isRunning: true }, { isRunning: true }]);
  useAISidebarStore.getState().requestNewThread();
  useAISidebarStore.getState().cancelThreadOpen();
  const state = useAISidebarStore.getState();
  assert.equal(state.pendingThreadOpen, null);
  assert.equal(Object.keys(state.conversations).length, SOFT_THREAD_CAP);
}

{
  resetAll();
  // R10: "+" never stacks blanks — it refocuses the empty thread that exists,
  // even when that blank is not the thread currently on screen.
  const ids = seedThreads([{}, {}]);
  const blank = createConversationState('conv-blank', { createdAt: 900 });
  useAISidebarStore.setState({
    conversations: { ...useAISidebarStore.getState().conversations, [blank.id]: blank },
    activeConversationId: ids[0],
  });
  useAISidebarStore.getState().requestNewThread();
  const state = useAISidebarStore.getState();
  assert.equal(state.activeConversationId, 'conv-blank', 'the existing blank is refocused');
  assert.equal(Object.keys(state.conversations).length, 3, 'no second blank was created');
}

// ── 2. Close ≠ delete (R11 + R12) ────────────────────────────────────────

{
  resetAll();
  const ids = seedThreads([{ userPrompt: 'Translate the memo' }, { userPrompt: 'Draft the outline' }]);
  useAISidebarStore.getState().closeConversation(ids[0]);

  const state = useAISidebarStore.getState();
  assert.equal(state.conversations[ids[0]], undefined, 'the thread left the rail');
  assert.equal(state.activeConversationId, ids[1], 'the other thread survived and took over');
  assert.ok(state.conversations[ids[1]], 'closing one thread never destroys another');

  // The conversation itself is still in History, in full.
  const archived = listConversations().find((c) => c.id === ids[0]);
  assert.ok(archived, 'a closed thread stays in History');
  assert.equal(archived!.title, 'Translate the memo');

  // And it can be reopened from there, onto the rail, without disturbing the
  // thread the user is on.
  useAISidebarStore.getState().requestOpenConversation(ids[0]);
  const reopened = useAISidebarStore.getState();
  assert.ok(reopened.conversations[ids[0]], 'the closed conversation came back onto the rail');
  assert.ok(reopened.conversations[ids[1]], 'reopening did not destroy the live thread');
  assert.equal(reopened.activeConversationId, ids[0]);
}

{
  resetAll();
  // Clicking an ALREADY-OPEN conversation in History is a plain switch: no
  // reload, no reset, and the transcript is untouched.
  const ids = seedThreads([{ userPrompt: 'One' }, { userPrompt: 'Two' }]);
  const before = useAISidebarStore.getState().conversations[ids[1]];
  useAISidebarStore.getState().requestOpenConversation(ids[1]);
  const after = useAISidebarStore.getState();
  assert.equal(after.activeConversationId, ids[1]);
  assert.equal(after.conversations[ids[1]], before, 'switching reuses the exact same thread object');
  assert.equal(after.pendingThreadOpen, null, 'switching to an open thread never hits the cap');
}

{
  resetAll();
  // Resolved Gap 3: reopening from History obeys the same cap as "+".
  seedThreads([{ isRunning: true }, { isRunning: true }, { isRunning: true }, { isRunning: true }, { isRunning: true }]);
  useAISidebarStore.getState().requestOpenConversation('some-archived-id');
  assert.deepEqual(
    useAISidebarStore.getState().pendingThreadOpen,
    { kind: 'reopen', conversationId: 'some-archived-id' },
    'a reopen is an open, and is not exempt from the cap',
  );
}

// ── 3. Per-thread composer queue (R14 / E5) ──────────────────────────────

{
  resetAll();
  const ids = seedThreads([{ isRunning: true }, { isRunning: true }]);
  const store = useAISidebarStore.getState();

  store.setComposerQueue(ids[0], 'follow-up for thread A');
  const withA = useAISidebarStore.getState();
  assert.equal(slotFor(withA.composerQueues, ids[0]), 'follow-up for thread A');
  // The load-bearing assertion: thread B cannot see thread A's queued prompt.
  assert.equal(slotFor(withA.composerQueues, ids[1]), null, 'a queue never leaks into another thread');

  useAISidebarStore.getState().setComposerQueue(ids[1], 'follow-up for thread B');
  const both = useAISidebarStore.getState();
  assert.equal(slotFor(both.composerQueues, ids[0]), 'follow-up for thread A');
  assert.equal(slotFor(both.composerQueues, ids[1]), 'follow-up for thread B');

  // Clearing one thread's queue leaves the other's alone.
  useAISidebarStore.getState().clearComposerQueue(ids[0]);
  const cleared = useAISidebarStore.getState();
  assert.equal(slotFor(cleared.composerQueues, ids[0]), null);
  assert.equal(slotFor(cleared.composerQueues, ids[1]), 'follow-up for thread B');

  // Drafts are keyed the same way — switching threads must not carry text over.
  useAISidebarStore.getState().setComposerDraft(ids[0], 'half-written prompt');
  assert.equal(slotFor(useAISidebarStore.getState().composerDrafts, ids[0]), 'half-written prompt');
  assert.equal(slotFor(useAISidebarStore.getState().composerDrafts, ids[1]), null);
}

{
  // The slot helpers themselves, independent of the store.
  const empty: Record<string, string> = {};
  const a = setSlot(empty, 'A', 'alpha');
  const ab = setSlot(a, 'B', 'beta');
  assert.equal(slotFor(ab, 'A'), 'alpha');
  assert.equal(slotFor(ab, 'B'), 'beta');
  assert.equal(slotFor(ab, 'C'), null, 'an unknown thread has no queue, it does not inherit one');
  assert.equal(slotFor(ab, null), null);
  assert.deepEqual(clearSlot(ab, 'A'), { B: 'beta' });
  assert.equal(clearSlot(ab, 'C'), ab, 'clearing an absent slot is a no-op, not a rebuild');
  // A closed thread's queue is dropped so it cannot be resurrected later.
  assert.deepEqual(pruneSlots(ab, ['B']), { B: 'beta' });
  assert.equal(pruneSlots(ab, ['A', 'B']), ab);
}

{
  resetAll();
  // Closing a thread drops its queued prompt with it.
  const ids = seedThreads([{}, {}]);
  useAISidebarStore.getState().setComposerQueue(ids[0], 'queued in A');
  useAISidebarStore.getState().closeConversation(ids[0]);
  assert.equal(slotFor(useAISidebarStore.getState().composerQueues, ids[0]), null);
}

// ── 4. Persistence and restart (R13 / E7) ────────────────────────────────

{
  resetAll();
  // The open set is mirrored to storage as threads come and go.
  const ids = seedThreads([{}, {}]);
  useAISidebarStore.getState().closeConversation(ids[1]);
  assert.deepEqual(loadOpenThreadIds(), [ids[0]], 'the persisted rail tracks the store');
}

{
  resetAll();
  // A turn that was mid-flight at shutdown comes back INTERRUPTED — not
  // running, and without a stale approval card that nothing can answer.
  //
  // Establish the workspace prefix first, so the "before" writes and the
  // "after" restore address the same storage keys.
  useAISidebarStore.getState().handleExtensionMessage({ ...AGENT_CONFIG_BASE, workspacePath: '/ws/demo' } as never);

  const ids = seedThreads([{
    isRunning: true,
    userPrompt: 'Apply the translation',
    approval: { approvalType: 'fileChange', requestId: 'stale-1' },
  }]);
  useAISidebarStore.getState().saveCurrentConversation();
  saveOpenThreadIds([ids[0]]);

  // Simulate a relaunch: a fresh store, then the workspace handshake again.
  useAISidebarStore.setState(initialState, true);
  resetOpenThreadRestoreForTest();
  useAISidebarStore.getState().handleExtensionMessage({ ...AGENT_CONFIG_BASE, workspacePath: '/ws/demo' } as never);

  const restored = useAISidebarStore.getState().conversations[ids[0]];
  assert.ok(restored, 'the open thread came back onto the rail');
  const turn = restored.agentConversation[0];
  assert.equal(turn.isRunning, false, 'a restored turn never looks live');
  assert.equal(turn.approval, undefined, 'a stale approval card is not presented');
  assert.equal(turn.result?.error, INTERRUPTED_TURN_MESSAGE, 'the turn is marked interrupted');
}

console.log('threadRail.test.ts: all assertions passed');

/**
 * R15 kill-switch. Parallel chats are almost entirely webview behaviour, so the
 * flag has to actually change what the store does — otherwise it is decorative
 * and the feature ships with no way to turn it off.
 */
function testKillSwitchCollapsesToOneConversation(): void {
  const store = useAISidebarStore;

  // Flag OFF: "new chat" replaces rather than adds.
  seedThreads([{ prompt: 'seeded work' }]);
  store.setState({ parallelChatsEnabled: false });
  store.getState().requestNewThread();
  assert.strictEqual(
    Object.keys(store.getState().conversations).length, 1,
    'with the flag off, a new chat must replace the current thread, not open an additional one',
  );

  // Flag ON: the same action opens an ADDITIONAL thread. Seeded non-empty,
  // because R10 would otherwise correctly refocus the blank left by the step above.
  seedThreads([{ prompt: 'seeded work' }]);
  store.setState({ parallelChatsEnabled: true });
  store.getState().requestNewThread();
  assert.strictEqual(
    Object.keys(store.getState().conversations).length, 2,
    'with the flag on, a new chat opens an additional thread',
  );

  console.log('✓ kill-switch: flag off collapses to one conversation');
}

testKillSwitchCollapsesToOneConversation();
