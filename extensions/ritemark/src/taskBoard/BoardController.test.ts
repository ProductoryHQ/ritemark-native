import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AgentId } from '../agent/types';
import type { RuntimeAvailabilities } from '../runtime/availability';
import { BoardStore, nodeBoardStoreFileSystem } from './BoardStore';
import {
  BoardController,
  DEFAULT_RUNTIME_KEY,
  WIP_LIMIT_KEY,
  countCheckboxes,
  type HandoffLedger,
  type StartOutcome,
  type StartTurn,
} from './BoardController';
import type { BoardAnswer, CardHandoffView, HandoffState, WaitReason } from './protocol';

// ── Fakes ────────────────────────────────────────────────────────────────────

let clock = Date.parse('2026-10-12T09:00:00.000Z');
const now = () => new Date(clock);
const at = (minutes: number) => new Date(Date.parse('2026-10-12T09:00:00.000Z') + minutes * 60_000).toISOString();

class FakeLedger implements HandoffLedger {
  readonly handoffs = new Map<string, CardHandoffView>();
  readonly started: StartTurn[] = [];
  capacity = true;
  nextOutcome: StartOutcome = { ok: true };
  private readonly listeners = new Set<(event: { cardId: string; previous: HandoffState | null; next: HandoffState }) => void>();

  list(): ReadonlyMap<string, CardHandoffView> {
    return new Map(this.handoffs);
  }
  async start(turn: StartTurn): Promise<StartOutcome> {
    this.started.push(turn);
    const outcome = this.nextOutcome;
    this.nextOutcome = { ok: true };
    if (!outcome.ok) return outcome;
    this.set(turn.card.id, { state: 'running', runtimeId: turn.runtimeId, since: now().toISOString(), canOpen: true });
    return outcome;
  }
  async wait(cardId: string, runtimeId: AgentId, reason: WaitReason): Promise<void> {
    this.set(cardId, { state: 'waiting', runtimeId, waitFor: reason, since: now().toISOString(), canOpen: false });
  }
  async unwait(cardId: string): Promise<void> {
    if (this.handoffs.get(cardId)?.state === 'waiting') this.handoffs.delete(cardId);
  }
  async stop(cardId: string): Promise<void> {
    const current = this.handoffs.get(cardId);
    if (current) this.set(cardId, { ...current, state: 'cancelled', since: now().toISOString() });
  }
  async openConversation(cardId: string): Promise<boolean> {
    return this.handoffs.get(cardId)?.canOpen ?? false;
  }
  async canAttach(): Promise<boolean> {
    return this.capacity;
  }
  onDidChange(listener: (event: { cardId: string; previous: HandoffState | null; next: HandoffState }) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  set(cardId: string, view: CardHandoffView): void {
    const previous = this.handoffs.get(cardId)?.state ?? null;
    this.handoffs.set(cardId, view);
    for (const listener of this.listeners) listener({ cardId, previous, next: view.state });
  }
  finish(cardId: string, state: HandoffState = 'completed'): void {
    const current = this.handoffs.get(cardId)!;
    this.set(cardId, { ...current, state, since: now().toISOString() });
  }
}

const READY = { state: 'ready', usable: true, detail: null } as const;

function setup(options: { codex?: 'ready' | 'needs-auth' } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-board-controller-'));
  const store = new BoardStore(folder, {
    fileSystem: { ...nodeBoardStoreFileSystem, async trash(file) { fs.rmSync(file); } },
    now,
  });
  const ledger = new FakeLedger();
  const settings = new Map<string, unknown>();
  const badges: number[] = [];
  const runtimes: RuntimeAvailabilities = {
    'claude-code': READY,
    codex: options.codex === 'ready' ? READY : { state: 'needs-auth', usable: false, detail: null },
    opencode: READY,
  };
  const controller = new BoardController({
    store,
    ledger,
    folderName: 'harbor-logistics',
    settings: {
      get: <T>(key: string) => settings.get(key) as T | undefined,
      update: async (key, value) => {
        settings.set(key, value);
      },
    },
    runtimes: () => runtimes,
    enabled: () => true,
    fileExists: async (file) => !file.startsWith('missing/'),
    setBadge: (count) => badges.push(count),
    now,
  });
  return { folder, store, ledger, settings, badges, controller };
}

function idOf(answer: BoardAnswer): string {
  assert.ok(answer.ok, answer.ok ? '' : `${answer.code}: ${answer.message}`);
  return answer.ok && answer.cardId ? answer.cardId : '';
}

async function card(controller: BoardController, title: string, stage: 'idea' | 'todo' | 'doing' | 'done' = 'todo', files: string[] = []) {
  return idOf(await controller.add({ title, stage, files }));
}

async function main(): Promise<void> {
  // ── Who moves next, Your calls, and the attention summary ─────────────────
  {
    const { store, ledger, controller, badges } = setup();
    const review = await card(controller, 'Tighten the proposal summary', 'doing');
    await store.mutate(review, null, (c) => ({ ...c, result: { by: 'claude', at: at(-120), summary: 'Reworked.', files: ['proposal.md'], check: [] } }));
    const reviewNewer = await card(controller, 'Second result', 'doing');
    await store.mutate(reviewNewer, null, (c) => ({ ...c, result: { by: 'codex', at: at(-10), summary: 'Done.', files: [], check: [] } }));
    const decision = await card(controller, 'Pick the audience', 'todo');
    await store.mutate(decision, null, (c) => ({ ...c, ask: { by: 'claude', at: at(-30), question: 'Which audience?', options: ['Executives', 'Practitioners'] } }));
    const blocked = await card(controller, 'Clean up the client list', 'doing');
    ledger.set(blocked, { state: 'needs-user', needs: 'approval', runtimeId: 'claude-code', since: at(-12), canOpen: true });
    const failed = await card(controller, 'Draft the Q3 agenda', 'doing');
    ledger.set(failed, { state: 'failed', failure: 'usage limit reached', runtimeId: 'codex', since: at(-5), canOpen: true });
    const stopped = await card(controller, 'Stopped card', 'doing');
    ledger.set(stopped, { state: 'cancelled', runtimeId: 'claude-code', since: at(-3), canOpen: true });
    const working = await card(controller, 'Working card', 'doing');
    ledger.set(working, { state: 'running', runtimeId: 'claude-code', since: at(-1), canOpen: true });
    const todoTop = await card(controller, 'Top of To do');

    const snapshot = await controller.refresh();
    assert.deepEqual(
      snapshot.calls.map((call) => call.cardId),
      [blocked, decision, review, reviewNewer, failed],
      'needs you → decision → review (longest-waiting first) → failed; a stopped card is not a call',
    );
    assert.deepEqual(snapshot.attention, { count: 5, oldestSince: at(-120), blocked: 1 });
    assert.equal(badges.at(-1), 5, 'the badge counts the calls');
    const view = (id: string) => snapshot.cards.find((c) => c.id === id)!;
    assert.equal(view(working).move, 'agent');
    assert.equal(view(working).locked, true);
    assert.equal(view(stopped).move, 'you');
    assert.equal(view(stopped).call, null);
    assert.equal(view(decision).call, 'decision');
    assert.equal(view(todoTop).nextUp, true, 'the top To do card without agent work is Next up');
    // A decision on top of To do is a call, not Next up.
    await store.mutate(todoTop, null, (c) => ({ ...c, ask: { by: 'claude', at: at(0), question: 'Q?', options: ['A', 'B'] } }));
    const withAsk = await controller.snapshot();
    assert.equal(withAsk.cards.find((c) => c.id === todoTop)?.nextUp, false);
    await store.mutate(todoTop, null, (c) => {
      const next = { ...c };
      delete next.ask;
      return next;
    });
    assert.equal(view(decision).nextUp, false);
    assert.equal(snapshot.doing.count, 6);
    assert.equal(snapshot.doing.limit, 3, 'the Doing limit defaults to 3');
    assert.equal(snapshot.defaultRuntime, 'claude-code');
    assert.equal(snapshot.runtimes.find((r) => r.id === 'codex')?.message, 'Codex is signed out. Sign in and try again.');

    // Marking a reviewed card done takes it off Your calls.
    await controller.markDone(review);
    const after = await controller.refresh();
    assert.ok(!after.calls.some((call) => call.cardId === review));
    assert.equal(after.cards.find((c) => c.id === review)?.history.at(-1)?.what, 'Marked done');
  }

  // ── A card an agent works on stays put; agents cannot finish cards ────────
  {
    const { ledger, controller } = setup();
    const busy = await card(controller, 'Busy', 'doing');
    ledger.set(busy, { state: 'running', runtimeId: 'claude-code', since: at(0), canOpen: true });
    for (const answer of [await controller.move(busy, 'todo'), await controller.markDone(busy), await controller.remove(busy)]) {
      assert.equal(answer.ok, false);
      assert.equal(!answer.ok && answer.code, 'busy');
    }
    const plain = await card(controller, 'Plain');
    const refused = await controller.move(plain, 'done', {}, 'claude');
    assert.equal(!refused.ok && refused.message, 'Only the user marks a card done.');
    const intoDoing = await controller.add({ title: 'Agent card', stage: 'doing' }, 'codex');
    assert.equal(!intoDoing.ok && intoDoing.code, 'not-allowed');
    const fromAgent = await controller.add({ title: 'From notes', stage: 'todo', files: ['notes/meeting.md'] }, 'claude');
    const created = (await controller.snapshot()).cards.find((c) => c.id === idOf(fromAgent))!;
    assert.equal(created.history[0].by, 'claude', 'the history says which agent created it');

    // Doing full: an agent cannot move a card in; the user can, and is over.
    await card(controller, 'D2', 'doing');
    await card(controller, 'D3', 'doing');
    const agentMove = await controller.move(plain, 'doing', {}, 'claude');
    assert.equal(!agentMove.ok && agentMove.code, 'not-allowed');
    assert.ok((await controller.move(plain, 'doing')).ok);
    assert.equal((await controller.snapshot()).doing.count, 4);
  }

  // ── report_result and ask_user: what agents leave on a card (W5) ──────────
  {
    const { ledger, controller } = setup();
    const id = await card(controller, 'Tighten the summary', 'doing');
    const reported = await controller.reportResult(id, 'claude', {
      summary: '  Cut the summary to   five sentences.  ',
      check: ['The footnote', ' ', 'x'.repeat(400)],
    });
    assert.ok(reported.ok);
    let view = (await controller.refresh()).cards.find((c) => c.id === id)!;
    assert.equal(view.result?.summary, 'Cut the summary to five sentences.');
    assert.equal(view.result?.by, 'claude');
    assert.equal(view.result?.check.length, 2, 'empty items are dropped');
    assert.ok(view.result!.check[1].length <= 160 && view.result!.check[1].endsWith('…'), 'a long item is clipped');
    assert.equal(view.call, 'review', 'a result on a Doing card waits for review');
    assert.equal(view.history.at(-1)?.what, 'Reported: Cut the summary to five sentences.');
    assert.equal(view.history.at(-1)?.by, 'claude');

    // During the card's own turn the ledger writes the history line at the end.
    ledger.set(id, { state: 'running', runtimeId: 'claude-code', since: at(0), canOpen: true });
    const before = view.history.length;
    assert.ok((await controller.reportResult(id, 'claude', { summary: 'Second pass.' })).ok);
    view = (await controller.refresh()).cards.find((c) => c.id === id)!;
    assert.equal(view.history.length, before, 'no history line in the card\'s own turn');
    assert.equal(view.result?.summary, 'Second pass.');

    for (const [input, words] of [
      [{ summary: '   ' }, 'The summary is empty'],
      [{ summary: 'Done.', check: ['a', 'b', 'c', 'd'] }, 'at most 3'],
    ] as const) {
      const refused = await controller.reportResult(id, 'codex', input as { summary: string; check?: string[] });
      assert.equal(refused.ok, false);
      assert.ok(!refused.ok && refused.message.includes(words), words);
    }
    assert.equal((await controller.reportResult('zzz999', 'codex', { summary: 'x' })).ok, false, 'an unknown card is refused');

    const plan = await card(controller, 'Plan the pilot');
    const asked = await controller.askUser(plan, 'codex', { question: 'Which two hubs?', options: ['Poznań and Duisburg', ' Aarhus and Duisburg '] });
    assert.ok(asked.ok);
    const withAsk = (await controller.refresh()).cards.find((c) => c.id === plan)!;
    assert.deepEqual(withAsk.ask?.options, ['Poznań and Duisburg', 'Aarhus and Duisburg']);
    assert.equal(withAsk.call, 'decision');
    assert.equal(withAsk.history.at(-1)?.what, 'Asked: Which two hubs?');
    for (const [input, words] of [
      [{ question: '', options: ['A', 'B'] }, 'empty'],
      [{ question: 'Q?', options: ['Only one'] }, '2 to 4 options'],
      [{ question: 'Q?', options: ['A', 'B', 'C', 'D', 'E'] }, '2 to 4 options'],
      [{ question: 'Q?', options: ['A', 'x'.repeat(81)] }, 'at most 80'],
      [{ question: 'x'.repeat(501), options: ['A', 'B'] }, 'at most 500'],
    ] as const) {
      const refused = await controller.askUser(plan, 'codex', input as { question: string; options: string[] });
      assert.equal(refused.ok, false, words);
      assert.ok(!refused.ok && refused.message.includes(words), `${words}: ${!refused.ok ? refused.message : ''}`);
    }
  }

  // ── Give to agent: availability, conflict guard, Doing limit ──────────────
  {
    const { ledger, controller, settings } = setup();
    const deck = await card(controller, 'Draft the steering committee deck outline', 'todo', ['findings-draft.md']);
    const henrik = await card(controller, 'Send the draft to Henrik', 'todo', ['findings-draft.md', 'mail.md']);

    const signedOut = await controller.give(deck, 'codex');
    assert.equal(!signedOut.ok && signedOut.code, 'runtime-unavailable');
    assert.equal(!signedOut.ok && 'recovery' in signedOut && signedOut.recovery, 'sign-in');
    assert.equal(ledger.started.length, 0, 'nothing starts for an agent that is not ready');

    assert.ok((await controller.give(deck, 'claude-code')).ok);
    assert.equal(ledger.started[0].kind, 'give');
    const deckView = (await controller.snapshot()).cards.find((c) => c.id === deck)!;
    assert.equal(deckView.stage, 'doing');
    assert.equal(deckView.history.at(-1)?.what, 'Gave it to Claude');
    assert.equal(settings.get(DEFAULT_RUNTIME_KEY), 'claude-code', 'the chosen agent becomes the default');

    const conflict = await controller.give(henrik, 'opencode');
    assert.equal(!conflict.ok && conflict.code, 'conflict');
    if (!conflict.ok && conflict.code === 'conflict') {
      assert.equal(conflict.withCardId, deck);
      assert.equal(conflict.file, 'findings-draft.md');
      assert.match(conflict.message, /is working on findings-draft\.md right now/);
    }
    assert.equal(ledger.started.length, 1);
    assert.equal(settings.get(DEFAULT_RUNTIME_KEY), 'opencode', 'choosing in the dropdown sets the default even when it waits');

    // Wait for it: starts by itself when the deck's turn ends.
    assert.deepEqual(await controller.wait(henrik, 'claude-code'), { ok: true, cardId: henrik, waiting: { kind: 'conflict', cardId: deck } });
    assert.equal((await controller.snapshot()).cards.find((c) => c.id === henrik)?.stage, 'todo', 'a waiting card stays in To do');
    assert.equal((await controller.snapshot()).cards.find((c) => c.id === henrik)?.move, 'agent');
    ledger.finish(deck);
    await controller.settled();
    const started = ledger.started.at(-1)!;
    assert.equal(started.card.id, henrik);
    assert.equal(started.runtimeId, 'claude-code');
    const henrikView = (await controller.snapshot()).cards.find((c) => c.id === henrik)!;
    assert.equal(henrikView.history.at(-1)?.what, 'Started after “Draft the steering committee deck…” finished');

    // A double click starts one agent, not two.
    const twice = await card(controller, 'Clicked twice');
    const [firstClick, secondClick] = await Promise.all([controller.give(twice, 'claude-code'), controller.give(twice, 'claude-code')]);
    assert.equal(firstClick.ok, true);
    assert.equal(!secondClick.ok && secondClick.code, 'busy');
    assert.equal(ledger.started.filter((turn) => turn.card.id === twice).length, 1);

    // Start now goes past the guard; with Doing full (3 of 3) the limit asks next.
    const other = await card(controller, 'Also on findings', 'todo', ['findings-draft.md']);
    const pastGuard = await controller.give(other, 'claude-code', { force: true });
    assert.equal(!pastGuard.ok && pastGuard.code, 'doing-full');
    assert.ok((await controller.give(other, 'claude-code', { force: true, overLimit: true })).ok);
  }

  // ── The Doing limit: Queue it, Start anyway, No limit ─────────────────────
  {
    const { ledger, controller } = setup();
    const doing = [await card(controller, 'D1', 'doing'), await card(controller, 'D2', 'doing'), await card(controller, 'D3', 'doing')];
    const next = await card(controller, 'Next');
    const full = await controller.give(next, 'claude-code');
    assert.deepEqual(full, { ok: false, code: 'doing-full', message: 'Doing is full: 3 of 3.', count: 3, limit: 3 });
    assert.deepEqual(await controller.queue(next, 'claude-code'), { ok: true, cardId: next, waiting: { kind: 'slot' } });
    await controller.settled();
    assert.equal(ledger.started.length, 0, 'still full: the queued card waits');

    const later = await card(controller, 'Later');
    await controller.queue(later, 'opencode');
    await controller.markDone(doing[0]);
    await controller.settled();
    assert.deepEqual(ledger.started.map((turn) => turn.card.id), [later], 'one slot frees one card: the top queued card of To do');
    assert.equal(ledger.started[0].runtimeId, 'opencode', 'with the agent it was queued for');
    assert.equal((await controller.snapshot()).cards.find((c) => c.id === later)?.history.at(-1)?.what, 'Started when Doing had room');

    assert.ok((await controller.setWipLimit(null)).ok);
    await controller.settled();
    assert.deepEqual(ledger.started.map((turn) => turn.card.id), [later, next], 'No limit starts the queued cards at once');
    assert.equal((await controller.snapshot()).doing.limit, null);

    await controller.setWipLimit(2);
    const anyway = await card(controller, 'Anyway');
    assert.ok((await controller.give(anyway, 'claude-code', { overLimit: true })).ok, 'Start anyway goes past the limit');
    assert.equal(!(await controller.setWipLimit(9)).ok, true);
  }

  // ── The AI sidebar is full: the card waits for room ────────────────────────
  {
    const { ledger, controller } = setup();
    await controller.setWipLimit(null);
    const running = await card(controller, 'Running elsewhere', 'doing');
    ledger.set(running, { state: 'running', runtimeId: 'claude-code', since: at(0), canOpen: true });
    const waiting = await card(controller, 'Waits for room');
    ledger.capacity = false;
    assert.deepEqual(await controller.give(waiting, 'claude-code'), { ok: true, cardId: waiting, waiting: { kind: 'capacity' } });
    assert.equal((await controller.snapshot()).cards.find((c) => c.id === waiting)?.stage, 'todo');
    ledger.capacity = true;
    ledger.finish(running);
    await controller.settled();
    assert.equal(ledger.started.at(-1)?.card.id, waiting);
    assert.equal((await controller.snapshot()).cards.find((c) => c.id === waiting)?.history.at(-1)?.what, 'Started when the AI sidebar had room');

    // A capacity refusal at dispatch time also waits instead of failing.
    const raced = await card(controller, 'Raced');
    ledger.nextOutcome = { ok: false, code: 'capacity', message: 'Five conversations are already working.' };
    const answer = await controller.give(raced, 'claude-code');
    assert.deepEqual(answer, { ok: true, cardId: raced, waiting: { kind: 'capacity' } });
  }

  // ── Decisions and follow-ups go back to the card's conversation ───────────
  {
    const { store, ledger, controller } = setup();
    const id = await card(controller, 'Pick the audience', 'doing');
    ledger.set(id, { state: 'completed', runtimeId: 'codex', since: at(0), canOpen: true });
    await store.mutate(id, null, (c) => ({ ...c, ask: { by: 'opencode', at: at(1), question: 'Who first?', options: ['Trainers first', 'Consultants first'] } }));
    assert.equal(!(await controller.answer(id, 5)).ok, true);
    assert.ok((await controller.answer(id, 1)).ok);
    const turn = ledger.started.at(-1)!;
    assert.deepEqual([turn.kind, turn.text, turn.runtimeId], ['answer', 'I choose: Consultants first', 'opencode']);
    const view = (await controller.snapshot()).cards.find((c) => c.id === id)!;
    assert.equal(view.ask, null, 'the decision is gone at once');
    assert.equal(view.history.at(-1)?.what, 'You chose: Consultants first');

    ledger.finish(id);
    await store.mutate(id, null, (c) => ({ ...c, ask: { by: 'claude', at: at(2), question: 'Tone?', options: ['Formal', 'Casual'] } }));
    assert.ok((await controller.followUp(id, 'Somewhere in between')).ok, 'Something else… answers in the user’s words');
    assert.equal(ledger.started.at(-1)?.text, 'I choose: Somewhere in between');
    assert.equal(ledger.started.at(-1)?.runtimeId, 'claude-code');

    ledger.finish(id);
    assert.equal(!(await controller.followUp(id, '   ')).ok, true);
    assert.ok((await controller.followUp(id, 'Shorter, please', 'opencode')).ok);
    assert.deepEqual([ledger.started.at(-1)?.kind, ledger.started.at(-1)?.text], ['follow-up', 'Shorter, please']);
    assert.equal((await controller.snapshot()).cards.find((c) => c.id === id)?.history.at(-1)?.what, 'Asked for changes: Shorter, please');
    assert.equal(!(await controller.followUp(id, 'Again')).ok, true, 'not while the agent works');
  }

  // ── Moves, edits, ideas ────────────────────────────────────────────────────
  {
    const { controller } = setup();
    const a = await card(controller, 'A');
    const b = await card(controller, 'B');
    const c = await card(controller, 'C');
    const order = async () => (await controller.snapshot()).cards.filter((x) => x.stage === 'todo').map((x) => x.title);
    assert.deepEqual(await order(), ['C', 'B', 'A'], 'new cards land on top');
    await controller.move(a, 'todo', { beforeCardId: b });
    assert.deepEqual(await order(), ['C', 'A', 'B']);
    await controller.move(c, 'todo', { atEnd: true });
    assert.deepEqual(await order(), ['A', 'B', 'C']);
    assert.equal(!(await controller.move(a, 'todo', { beforeCardId: 'zzzzzz' })).ok, true);

    await controller.markDone(a);
    await controller.move(a, 'todo');
    assert.deepEqual(
      (await controller.snapshot()).cards.find((x) => x.id === a)?.history.map((h) => h.what),
      ['Created', 'Marked done', 'Reopened'],
    );

    assert.ok((await controller.update(b, { title: 'B, renamed', doneWhen: 'One page', files: ['./docs/a.md', 'missing/b.md'] })).ok);
    let view = (await controller.snapshot()).cards.find((x) => x.id === b)!;
    assert.equal(view.doneWhen, 'One page');
    assert.deepEqual(view.files, [{ path: 'docs/a.md', exists: true }, { path: 'missing/b.md', exists: false }]);
    assert.equal(view.history.at(-1)?.what, 'Edited title, Done when, files');
    await controller.update(b, { doneWhen: '' });
    view = (await controller.snapshot()).cards.find((x) => x.id === b)!;
    assert.equal(view.doneWhen, null, 'an empty Done when clears it');
    assert.equal(!(await controller.update(b, { files: ['../outside.md'] })).ok, true);
    assert.equal(!(await controller.update(b, { title: '' })).ok, true);

    const idea = await card(controller, 'Workshop follow-up email template', 'idea');
    assert.equal(!(await controller.setDropped(b, true)).ok, true, 'only ideas are dropped');
    await controller.setDropped(idea, true);
    assert.equal((await controller.snapshot()).cards.find((x) => x.id === idea)?.dropped, true);
    await controller.setDropped(idea, false);
    assert.deepEqual(
      (await controller.snapshot()).cards.find((x) => x.id === idea)?.history.map((h) => h.what),
      ['Created', 'Dropped', 'Brought back'],
    );
    assert.ok((await controller.remove(idea)).ok);
    assert.equal((await controller.snapshot()).cards.some((x) => x.id === idea), false);
  }

  // ── A chain of waits: the next blocker is waited for in turn ──────────────
  {
    const { ledger, controller } = setup();
    await controller.setWipLimit(null);
    const first = await card(controller, 'First', 'todo', ['shared.md']);
    const second = await card(controller, 'Second', 'todo', ['shared.md']);
    const third = await card(controller, 'Third', 'todo', ['shared.md']);
    await controller.give(first, 'claude-code');
    await controller.wait(second, 'claude-code');
    await controller.give(third, 'claude-code', { force: true });
    ledger.finish(first);
    await controller.settled();
    const handoff = ledger.handoffs.get(second)!;
    assert.equal(handoff.state, 'waiting');
    assert.deepEqual(handoff.waitFor, { kind: 'conflict', cardId: third }, 'still blocked, now by the third card');
    ledger.finish(third);
    await controller.settled();
    assert.equal(ledger.handoffs.get(second)?.state, 'running');
    assert.ok((await controller.unwait(second)).ok);
  }

  assert.deepEqual(countCheckboxes('- [ ] a\n- [x] b\n  * [X] c\nnot - [ ] d\n'), { done: 2, total: 3 });
  assert.equal(WIP_LIMIT_KEY, 'ritemark.taskBoard.wipLimit');

  console.log('taskBoard/BoardController: all assertions passed');
  clock += 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
