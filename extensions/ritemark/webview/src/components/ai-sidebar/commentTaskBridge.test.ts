/**
 * Sprint 117 (#156 / R5, R6, R8) — the sidebar half of the comment-task
 * contract, exercised through the real store without React.
 *
 * What the audit found here, and what each block pins down:
 * - F16 the sidebar owned a comment-task ledger in webview memory;
 * - F17 `enqueuePrompt`'s `full` answer was dropped and the user was told the
 *   work was queued;
 * - F20 the sidebar picked the destination conversation silently;
 * - F22 one terminal turn finalised EVERY running comment task of that
 *   conversation.
 *
 * The host owns identity, destination and lifecycle now. All this store still
 * does is run the named conversation's queue and answer honestly.
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

const {
  useAISidebarStore,
  resetConversationMigrationGuardForTest,
  resetSidebarHandshakeForTest,
} = await import('./store');
const { createConversationState } = await import('./conversationState');
const { queueFor, QUEUE_CAP } = await import('./promptQueue');
const { vscode } = await import('../../lib/vscode');
type ConversationState = import('./conversationState').ConversationState;

const initialState = useAISidebarStore.getState();
const posted: Array<Record<string, unknown>> = [];
vscode.postMessage = (msg: unknown) => { posted.push(msg as Record<string, unknown>); };

function resetAll(): void {
  storage.clear();
  useAISidebarStore.setState(initialState, true);
  resetConversationMigrationGuardForTest();
  resetSidebarHandshakeForTest();
  posted.length = 0;
}

function postedOf(type: string): Array<Record<string, unknown>> {
  return posted.filter((m) => m.type === type);
}

function runningClaudeTurn(conversationId: string) {
  return {
    id: `busy-${conversationId}`,
    conversationId,
    userPrompt: 'already working',
    activities: [],
    isRunning: true,
    isPlan: false,
    planHandled: false,
    timestamp: Date.now(),
  };
}

function seed(id: string, overrides: Partial<ConversationState> = {}): void {
  const conversation = { ...createConversationState(id), ...overrides };
  useAISidebarStore.setState((s) => ({
    conversations: { ...s.conversations, [id]: conversation },
    activeConversationId: s.activeConversationId ?? id,
  }));
}

/** A host-minted enqueue exactly as `src/commentTasks/protocol.ts` defines it. */
function enqueueMessage(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'comment-task/enqueue',
    taskId: 'task-1',
    conversationId: 'dest',
    conversationTurnId: 'host-turn-1',
    runtimeId: 'claude-code',
    prompt: 'Comment [c1]: tighten this paragraph',
    displayText: 'tighten this paragraph',
    modelId: 'claude-test-model',
    autonomy: 'auto',
    thinkingEffort: 'auto',
    sourceDisplayPath: 'docs/notes.md',
    ...over,
  };
}

function deliver(message: Record<string, unknown>): void {
  useAISidebarStore.getState().handleExtensionMessage(message as never);
}

// ── 1. The task runs in the conversation the HOST named, not the visible one ──
{
  resetAll();
  seed('visible');
  seed('dest', { agentConversation: [runningClaudeTurn('dest') as never] });
  useAISidebarStore.setState({ activeConversationId: 'visible' });
  posted.length = 0;

  deliver(enqueueMessage());

  const q = queueFor(useAISidebarStore.getState().promptQueues, 'dest');
  assert.equal(q.length, 1, 'queued into the named conversation');
  assert.equal(q[0].source, 'comment');
  assert.equal(q[0].taskId, 'task-1', 'the host task id rides the item');
  assert.equal(q[0].conversationTurnId, 'host-turn-1', 'the host turn id rides the item');
  assert.equal(q[0].sourceDisplayPath, 'docs/notes.md', 'the frozen source document rides the item');
  assert.equal(
    queueFor(useAISidebarStore.getState().promptQueues, 'visible').length, 0,
    'F20: the visible conversation is never the destination by accident',
  );

  const results = postedOf('comment-task/enqueue-result');
  assert.equal(results.length, 1, 'exactly one acknowledgement');
  assert.deepEqual(results[0], { type: 'comment-task/enqueue-result', taskId: 'task-1', outcome: 'queued' });
}

// ── 2. F17: a full queue is reported as full, never as queued ──
{
  resetAll();
  seed('dest', { agentConversation: [runningClaudeTurn('dest') as never] });
  posted.length = 0;

  for (let i = 0; i < QUEUE_CAP; i += 1) {
    useAISidebarStore.getState().enqueuePrompt({
      conversationId: 'dest',
      runtimeId: 'claude-code',
      autonomy: 'auto',
      planFirst: false,
      thinkingEffort: 'auto',
      prompt: `filler ${i}`,
      displayText: `filler ${i}`,
      source: 'composer',
    } as never);
  }
  assert.equal(queueFor(useAISidebarStore.getState().promptQueues, 'dest').length, QUEUE_CAP);

  deliver(enqueueMessage({ taskId: 'task-full' }));

  assert.equal(
    queueFor(useAISidebarStore.getState().promptQueues, 'dest').length, QUEUE_CAP,
    'nothing is smuggled past the cap',
  );
  const results = postedOf('comment-task/enqueue-result');
  assert.deepEqual(
    results[results.length - 1],
    { type: 'comment-task/enqueue-result', taskId: 'task-full', outcome: 'full' },
    'the queue answer is the reply — it is not dropped on the floor',
  );
}

// ── 3. An unknown destination is reported, never redirected (R1) ──
{
  resetAll();
  seed('visible');
  useAISidebarStore.setState({ activeConversationId: 'visible' });
  posted.length = 0;

  deliver(enqueueMessage({ taskId: 'task-lost', conversationId: 'gone-conversation' }));

  assert.deepEqual(
    postedOf('comment-task/enqueue-result')[0],
    { type: 'comment-task/enqueue-result', taskId: 'task-lost', outcome: 'no-conversation' },
  );
  assert.equal(
    queueFor(useAISidebarStore.getState().promptQueues, 'visible').length, 0,
    'the visible conversation does not inherit an orphaned task',
  );
  assert.equal(postedOf('agent-execute').length, 0, 'nothing dispatched');
}

// ── 4. The dispatched turn uses the HOST's turn id, not a fresh one ──
{
  resetAll();
  seed('dest', { selectedModel: 'claude-test-model' });   // idle → drains at once
  posted.length = 0;

  deliver(enqueueMessage({ taskId: 'task-turn', conversationTurnId: 'host-turn-abc' }));

  assert.equal(
    queueFor(useAISidebarStore.getState().promptQueues, 'dest').length, 0,
    'an idle destination drains immediately',
  );
  const exec = postedOf('agent-execute')[0];
  assert.ok(exec, 'agent-execute posted');
  assert.equal(exec.conversationTurnId, 'host-turn-abc', 'the host-minted turn id is used verbatim');
  assert.equal(exec.taskId, 'task-turn', 'the turn names its task (audit F11)');
  assert.equal(exec.sourceDisplayPath, 'docs/notes.md', 'the frozen document travels with the turn (audit F12)');

  const turns = useAISidebarStore.getState().conversations['dest'].agentConversation;
  assert.equal(turns.length, 1);
  assert.equal(turns[0].id, 'host-turn-abc', 'the transcript turn carries the id the host will match on');
  assert.equal(turns[0].activeFilePath, 'docs/notes.md');

  // The acknowledgement precedes the dispatch: the host wants the enqueue ack
  // before the turn it accepted (D6).
  const ackIndex = posted.findIndex((m) => m.type === 'comment-task/enqueue-result');
  const execIndex = posted.findIndex((m) => m.type === 'agent-execute');
  assert.ok(ackIndex >= 0 && execIndex >= 0 && ackIndex < execIndex, 'ack is posted before the dispatch');
}

// ── 5. A composer turn invents its own id and names no task ──
{
  resetAll();
  seed('solo', { selectedModel: 'claude-test-model' });
  posted.length = 0;

  useAISidebarStore.getState().enqueuePrompt({
    conversationId: 'solo',
    runtimeId: 'claude-code',
    autonomy: 'auto',
    planFirst: false,
    thinkingEffort: 'auto',
    prompt: 'plain composer prompt',
    displayText: 'plain composer prompt',
    source: 'composer',
  } as never);

  const exec = postedOf('agent-execute')[0];
  assert.ok(exec, 'composer turn dispatched');
  assert.equal(exec.taskId, undefined, 'no synthetic task identity for composer turns');
  assert.equal(exec.sourceDisplayPath, undefined, 'composer turns keep the host active-file behaviour');
  assert.ok(typeof exec.conversationTurnId === 'string' && (exec.conversationTurnId as string).length > 0);
}

// ── 6. F22: a terminal turn does not touch the OTHER comment task ──
{
  resetAll();
  seed('shared', { selectedModel: 'claude-test-model' });
  posted.length = 0;

  // First task dispatches into the idle conversation and starts running.
  deliver(enqueueMessage({ taskId: 'task-A', conversationId: 'shared', conversationTurnId: 'turn-A' }));
  // Second task lands in the queue behind it — same conversation, same runtime.
  deliver(enqueueMessage({ taskId: 'task-B', conversationId: 'shared', conversationTurnId: 'turn-B' }));

  assert.equal(
    queueFor(useAISidebarStore.getState().promptQueues, 'shared').length, 1,
    'task B waits behind the running turn',
  );

  const before = useAISidebarStore.getState();
  assert.equal(
    Object.prototype.hasOwnProperty.call(before, 'commentTasks'), false,
    'F16: the webview holds no comment-task ledger at all any more',
  );

  // Turn A ends. Under Sprint 105 this marked EVERY running comment task of
  // the conversation terminal — task B included, which had not even started.
  posted.length = 0;
  deliver({ type: 'agent-result', conversationId: 'shared', text: 'done with A' });

  assert.equal(
    postedOf('comment:task-status').length, 0,
    'F22: no conversation-wide status is broadcast for either task',
  );
  assert.equal(
    posted.some((m) => m.type === 'comment-task/enqueue-result'), false,
    'a terminal turn does not re-answer an enqueue',
  );

  // B drains on the turn boundary — with ITS OWN host turn id, untouched.
  const execB = postedOf('agent-execute').find((m) => m.taskId === 'task-B');
  assert.ok(execB, 'task B dispatches when the conversation frees up');
  assert.equal(execB!.conversationTurnId, 'turn-B', 'task B keeps its own turn identity');

  const turnIds = useAISidebarStore.getState().conversations['shared'].agentConversation.map((t) => t.id);
  assert.deepEqual(turnIds, ['turn-A', 'turn-B'], 'two distinct host-minted turns, one per task');
}

// ── 7. Removing a queued comment item is reported as a dequeue ──
{
  resetAll();
  seed('dest', { agentConversation: [runningClaudeTurn('dest') as never] });
  posted.length = 0;

  deliver(enqueueMessage({ taskId: 'task-drop' }));
  const item = queueFor(useAISidebarStore.getState().promptQueues, 'dest')[0];
  posted.length = 0;

  useAISidebarStore.getState().removeQueued('dest', item.id);
  assert.deepEqual(
    postedOf('comment-task/dequeued'),
    [{ type: 'comment-task/dequeued', taskId: 'task-drop' }],
  );

  // A composer item carries no task, so removing it reports nothing.
  useAISidebarStore.getState().enqueuePrompt({
    conversationId: 'dest',
    runtimeId: 'claude-code',
    autonomy: 'auto',
    planFirst: false,
    thinkingEffort: 'auto',
    prompt: 'composer',
    displayText: 'composer',
    source: 'composer',
  } as never);
  const composerItem = queueFor(useAISidebarStore.getState().promptQueues, 'dest')[0];
  posted.length = 0;
  useAISidebarStore.getState().removeQueued('dest', composerItem.id);
  assert.equal(postedOf('comment-task/dequeued').length, 0, 'composer items are not comment tasks');
}

// ── 8. The host is told what this sidebar is showing (D5) ──
{
  resetAll();
  seed('first');
  seed('second');
  useAISidebarStore.setState({ activeConversationId: 'first' });
  assert.equal(
    postedOf('conversation/active').length, 0,
    'nothing is reported before hydration — the host holds enqueues until the handshake',
  );
  posted.length = 0;

  useAISidebarStore.setState({ ready: true });
  assert.equal(postedOf('sidebar/ready').length, 1, 'one hydration handshake');
  assert.deepEqual(
    postedOf('conversation/active'),
    [{ type: 'conversation/active', conversationId: 'first' }],
    'readiness reports the open conversation in the same breath',
  );

  useAISidebarStore.getState().switchConversation('second');
  assert.deepEqual(
    postedOf('conversation/active').map((m) => m.conversationId),
    ['first', 'second'],
    'every change of the visible conversation is reported',
  );

  // Re-selecting the same conversation says nothing new.
  const reportsBefore = postedOf('conversation/active').length;
  useAISidebarStore.getState().switchConversation('second');
  assert.equal(postedOf('conversation/active').length, reportsBefore, 'no redundant reports');

  // Ready does not fire twice for one hydrated store.
  useAISidebarStore.setState({ ready: false });
  useAISidebarStore.setState({ ready: true });
  assert.equal(postedOf('sidebar/ready').length, 1, 'the handshake is once per session');
}

// ── 9. "Open conversation" selects the task's own destination (R4) ──
{
  resetAll();
  seed('here');
  seed('there');
  useAISidebarStore.setState({ activeConversationId: 'here', ready: true });
  posted.length = 0;

  deliver({ type: 'conversation/select', conversationId: 'there' });
  assert.equal(useAISidebarStore.getState().activeConversationId, 'there', 'the named conversation is shown');
  assert.deepEqual(
    postedOf('conversation/active'),
    [{ type: 'conversation/active', conversationId: 'there' }],
    'the host learns the new destination immediately',
  );

  // An id this sidebar cannot resolve leaves the view alone.
  deliver({ type: 'conversation/select', conversationId: 'not-a-conversation' });
  assert.equal(useAISidebarStore.getState().activeConversationId, 'there', 'no blind retarget');
}

console.log('commentTaskBridge tests: all assertions passed');
