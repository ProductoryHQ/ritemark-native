import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { CommentTaskEnqueueMessage, CommentTaskEnqueueOutcome } from '../commentTasks/protocol';
import { BoardStore, nodeBoardStoreFileSystem } from './BoardStore';
import { CardHandoffLedger, type CardTaskSidebar } from './CardHandoffLedger';
import { CardTaskStore } from './CardTaskStore';
import type { HandoffState } from './protocol';

let clock = Date.parse('2026-10-12T09:00:00.000Z');
const now = () => new Date(clock);
const tick = (seconds: number) => {
  clock += seconds * 1000;
};

class FakeSidebar implements CardTaskSidebar {
  enqueued: CommentTaskEnqueueMessage[] = [];
  answer: { outcome: CommentTaskEnqueueOutcome; conversationId?: string } = { outcome: 'queued', conversationId: 'client-1' };
  conversations = new Set<string>();
  titles = new Map<string, string>();
  cancelled: Array<[string, string]> = [];
  revealed: string[] = [];
  capacity = true;
  async areDurableConversationsEnabled() {
    return true;
  }
  runtimeSettings() {
    return { modelId: 'model-x', approvalMode: 'auto' as const, thinkingEffort: 'auto' };
  }
  async enqueue(message: CommentTaskEnqueueMessage) {
    this.enqueued.push(message);
    return this.answer;
  }
  async canAttach() {
    return this.capacity;
  }
  async revealConversation(id: string) {
    this.revealed.push(id);
  }
  async cancelTurn(conversationId: string, turnId: string) {
    this.cancelled.push([conversationId, turnId]);
  }
  async conversationExists(id: string) {
    return this.conversations.has(id);
  }
  async conversationTitle(id: string) {
    return this.titles.get(id) ?? null;
  }
  async setConversationTitle(id: string, title: string) {
    if (!this.conversations.has(id)) throw new Error('no record yet');
    this.titles.set(id, title);
  }
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-ledger-'));
  const board = new BoardStore(root, { fileSystem: { ...nodeBoardStoreFileSystem, async trash() {} }, now });
  const recordsDir = path.join(root, '.global');
  const store = new CardTaskStore(recordsDir);
  const sidebar = new FakeSidebar();
  let id = 0;
  const ledger = new CardHandoffLedger({
    store,
    board,
    sidebar,
    folderPath: root,
    hasBoardTools: () => true,
    now,
    randomId: () => `id-${++id}`,
  });
  const events: Array<{ cardId: string; previous: HandoffState | null; next: HandoffState }> = [];
  ledger.onDidChange((event) => events.push(event));
  return { root, board, store, sidebar, ledger, events, recordsDir };
}

async function main(): Promise<void> {
  // ── The first handoff: a new conversation, followed to its end ────────────
  {
    const { root, board, sidebar, ledger, events } = setup();
    const card = await board.create({ title: 'Draft the workshop agenda', stage: 'doing', by: 'you', doneWhen: 'One page', files: ['notes/meeting.md'] });

    assert.deepEqual(await ledger.start({ card, runtimeId: 'codex', kind: 'give' }), { ok: true });
    const sent = sidebar.enqueued[0];
    assert.equal(sent.sourceKind, 'card');
    assert.deepEqual(sent.newConversation, { title: 'Draft the workshop agenda' }, 'a new conversation of its own');
    assert.equal(sent.conversationId, '');
    assert.equal(sent.runtimeId, 'codex');
    assert.ok(sent.displayText.startsWith('Draft the workshop agenda\n\nDone when: One page'));
    assert.ok(sent.prompt.endsWith(`(This is card ${card.id} on the project's task board.)`));
    assert.deepEqual(events.map((event) => event.next), ['accepting', 'queued']);
    assert.equal(ledger.list().get(card.id)?.state, 'queued');

    // The first turn gives the conversation its canonical id: follow it and title it.
    sidebar.conversations.add('conv-A');
    tick(2);
    await ledger.applyTurnStarted('conv-A', sent.conversationTurnId);
    let view = ledger.list().get(card.id)!;
    assert.equal(view.state, 'running');
    assert.equal(view.canOpen, true);
    assert.equal(sidebar.titles.get('conv-A'), 'Draft the workshop agenda', 'the conversation carries the card’s title');

    // A question mid-turn, answered (G3): back to Working.
    await ledger.applyTurnAttention('conv-A', sent.conversationTurnId, 'question');
    assert.equal(ledger.list().get(card.id)?.needs, 'question');
    await ledger.applyTurnStarted('conv-A', sent.conversationTurnId);
    view = ledger.list().get(card.id)!;
    assert.equal(view.state, 'running');
    assert.equal(view.needs, undefined);

    // A turn it does not own is ignored.
    await ledger.applyTurnTerminal('conv-Z', 'someone-else', { status: 'failed', error: 'x' });
    assert.equal(ledger.list().get(card.id)?.state, 'running');

    // An agent may report the real path of a folder opened through a symlink
    // (macOS temp folders: /var → /private/var).
    fs.writeFileSync(path.join(root, 'hello.md'), 'Hello');
    const realHello = path.join(fs.realpathSync(root), 'hello.md');
    tick(250);
    await ledger.applyTurnTerminal('conv-A', sent.conversationTurnId, {
      status: 'completed',
      text: 'I drafted the agenda with four themes. It is in notes/agenda.md.',
      filesModified: [path.join(root, 'notes/agenda.md'), '/elsewhere/secret.md', 'notes/agenda.md', realHello],
    });
    assert.equal(ledger.list().get(card.id)?.state, 'completed');
    const done = (await board.get(card.id))!;
    assert.equal(done.result?.by, 'codex');
    assert.equal(done.result?.seconds, 250, 'how long the turn ran');
    assert.deepEqual(done.result?.files, ['notes/agenda.md', 'hello.md'], 'project files only, once, also by their real path');
    assert.equal(done.result?.summary, 'I drafted the agenda with four themes. It is in notes/agenda.md.', 'the agent’s short conclusion');
    assert.equal(done.history.at(-1)?.what, 'Finished: I drafted the agenda with four themes. It is in notes/agenda.md.');

    // Ask for changes: the same conversation, no new one.
    assert.deepEqual(await ledger.start({ card: done, runtimeId: 'codex', kind: 'follow-up', text: 'Shorter, please' }), { ok: true });
    const followUp = sidebar.enqueued[1];
    assert.equal(followUp.conversationId, 'conv-A');
    assert.equal(followUp.newConversation, undefined);
    assert.equal(followUp.displayText, 'Shorter, please');

    // A second start while one is in flight is refused.
    const twice = await ledger.start({ card: done, runtimeId: 'codex', kind: 'give' });
    assert.equal(twice.ok, false);
  }

  // ── The agent reported with report_result: its words stay ──────────────────
  {
    const { board, sidebar, ledger } = setup();
    const card = await board.create({ title: 'Tighten the summary', stage: 'doing', by: 'you' });
    await ledger.start({ card, runtimeId: 'claude-code', kind: 'give' });
    sidebar.conversations.add('conv-B');
    const turn = sidebar.enqueued[0].conversationTurnId;
    await ledger.applyTurnStarted('conv-B', turn);
    tick(10);
    await board.mutate(card.id, { by: 'claude', what: 'Reported' }, (current) => ({
      ...current,
      result: { by: 'claude', at: now().toISOString(), summary: 'Reworked the evidence.', files: [], check: ['The pricing table'] },
    }));
    tick(5);
    await ledger.applyTurnTerminal('conv-B', turn, { status: 'completed', text: 'Long closing message that is not the report.' });
    const after = (await board.get(card.id))!;
    assert.equal(after.result?.summary, 'Reworked the evidence.');
    assert.deepEqual(after.result?.check, ['The pricing table']);
    assert.equal(after.result?.seconds, 15);
  }

  // ── Failures, stops and the queue ──────────────────────────────────────────
  {
    const { board, sidebar, ledger } = setup();
    const card = await board.create({ title: 'Failing card', stage: 'doing', by: 'you' });
    await ledger.start({ card, runtimeId: 'claude-code', kind: 'give' });
    sidebar.conversations.add('conv-C');
    const turn = sidebar.enqueued[0].conversationTurnId;
    await ledger.applyTurnStarted('conv-C', turn);
    await ledger.applyTurnTerminal('conv-C', turn, { status: 'failed', error: '{"error":{"message":"usage limit reached"}}' });
    const view = ledger.list().get(card.id)!;
    assert.equal(view.state, 'failed');
    assert.equal(view.failure, 'usage limit reached', 'a safe sentence, never the raw provider error');
    assert.equal((await board.get(card.id))?.history.at(-1)?.what, 'Failed: usage limit reached');

    // Retry repeats the last ask in the same conversation.
    assert.deepEqual(await ledger.start({ card, runtimeId: 'claude-code', kind: 'retry' }), { ok: true });
    assert.equal(sidebar.enqueued[1].conversationId, 'conv-C');
    assert.ok(sidebar.enqueued[1].displayText.startsWith('Failing card'));

    // Stopped while queued: the turn is cancelled the moment it starts.
    await ledger.stop(card.id);
    assert.equal(ledger.list().get(card.id)?.state, 'cancelled');
    await ledger.applyTurnStarted('conv-C', sidebar.enqueued[1].conversationTurnId);
    assert.deepEqual(sidebar.cancelled, [['conv-C', sidebar.enqueued[1].conversationTurnId]]);
    assert.equal(ledger.list().get(card.id)?.state, 'cancelled');

    // A dispatch that throws (G6) ends as failed.
    await ledger.start({ card, runtimeId: 'claude-code', kind: 'give' });
    await ledger.applyDispatchFailed(sidebar.enqueued[2].taskId, 'postMessage failed');
    assert.equal(ledger.list().get(card.id)?.state, 'failed');

    // The sidebar is full: the ledger says so, and records nothing.
    sidebar.capacity = false;
    const full = await ledger.start({ card, runtimeId: 'claude-code', kind: 'give' });
    assert.deepEqual(full.ok ? null : full.code, 'capacity');
    assert.equal(ledger.list().get(card.id)?.state, 'failed', 'the previous state stays');
  }

  // ── A deleted conversation, and Retry starting a new one ──────────────────
  {
    const { board, sidebar, ledger } = setup();
    const card = await board.create({ title: 'Lost conversation', stage: 'doing', by: 'you' });
    await ledger.start({ card, runtimeId: 'claude-code', kind: 'give' });
    sidebar.conversations.add('conv-D');
    const turn = sidebar.enqueued[0].conversationTurnId;
    await ledger.applyTurnStarted('conv-D', turn);
    await ledger.applyTurnTerminal('conv-D', turn, { status: 'completed', text: 'Done.' });
    sidebar.conversations.delete('conv-D');

    const again = await ledger.start({ card, runtimeId: 'claude-code', kind: 'give' });
    assert.equal(again.ok ? null : again.code, 'no-conversation');
    assert.equal(ledger.list().get(card.id)?.state, 'conversation-gone');
    assert.equal(ledger.list().get(card.id)?.canOpen, false);
    assert.equal(await ledger.openConversation(card.id), false);

    assert.deepEqual(await ledger.start({ card, runtimeId: 'claude-code', kind: 'retry' }), { ok: true });
    assert.deepEqual(sidebar.enqueued.at(-1)?.newConversation, { title: 'Lost conversation' }, 'Retry starts a new one');
  }

  // ── Waiting, and coming back after a restart ───────────────────────────────
  {
    const { board, sidebar, ledger, store, recordsDir, events } = setup();
    const waiting = await board.create({ title: 'Waits', stage: 'todo', by: 'you' });
    await ledger.wait(waiting.id, 'opencode', { kind: 'slot' });
    assert.deepEqual(ledger.list().get(waiting.id)?.waitFor, { kind: 'slot' });
    await ledger.unwait(waiting.id);
    assert.equal(ledger.list().get(waiting.id), undefined, 'a card with no conversation forgets the wait');

    const running = await board.create({ title: 'Was running', stage: 'doing', by: 'you' });
    await ledger.start({ card: running, runtimeId: 'claude-code', kind: 'give' });
    sidebar.conversations.add('conv-E');
    await ledger.applyTurnStarted('conv-E', sidebar.enqueued[0].conversationTurnId);
    await store.put({ ...store.get(running.id)!, cardId: 'zzzzzz' }).catch(() => undefined);
    // The written records survive into a new session.
    const reborn = new CardHandoffLedger({ store: new CardTaskStore(recordsDir), board, sidebar, folderPath: '/', now });
    const seen: HandoffState[] = [];
    reborn.onDidChange((event) => seen.push(event.next));
    await reborn.recover(new Set([running.id]));
    assert.equal(reborn.list().get(running.id)?.state, 'interrupted', 'work in flight at quit is Interrupted');
    assert.deepEqual(seen, ['interrupted']);
    assert.equal(reborn.list().has('zzzzzz'), false, 'records of cards that are gone are dropped');
    assert.ok(events.length > 0);
  }

  console.log('taskBoard/CardHandoffLedger: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
