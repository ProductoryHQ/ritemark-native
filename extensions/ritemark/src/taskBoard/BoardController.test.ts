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
import type { IdeaReviewInput, ReviewFields } from './ideaReview';

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

function setup(options: { codex?: 'ready' | 'needs-auth'; reviewer?: { review(input: IdeaReviewInput): Promise<ReviewFields> } } = {}) {
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
    ...(options.reviewer ? { reviewer: options.reviewer } : {}),
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
    // A follow-up stopped (or removed from the queue) after an earlier result:
    // the card is Stopped, not that older result waiting for review (spec R5).
    const stoppedAfterResult = await card(controller, 'Stopped follow-up', 'doing');
    await store.mutate(stoppedAfterResult, null, (c) => ({ ...c, result: { by: 'claude', at: at(-60), summary: 'First go.', files: [], check: [] } }));
    ledger.set(stoppedAfterResult, { state: 'cancelled', runtimeId: 'claude-code', since: at(-2), canOpen: true });
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
    assert.equal(view(stoppedAfterResult).call, null, 'a stopped follow-up is not a call, even with an earlier result');
    assert.equal(view(stoppedAfterResult).move, 'you');
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
    assert.equal(snapshot.doing.count, 7);
    assert.equal(snapshot.doing.limit, 3, 'the Doing limit defaults to 3');
    assert.equal(snapshot.defaultRuntime, 'claude-code');
    assert.equal(snapshot.runtimes.find((r) => r.id === 'codex')?.message, 'ChatGPT is signed out. Sign in and try again.');

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

  // ── Archive (D15): off the board, not deleted, restorable ─────────────────
  {
    const { store, ledger, controller } = setup();
    const doneA = await card(controller, 'Done A', 'done');
    const doneB = await card(controller, 'Done B', 'done');
    const review = await card(controller, 'Waiting for review', 'doing');
    await store.mutate(review, null, (c) => ({ ...c, result: { by: 'claude', at: at(-5), summary: 'Did it.', files: [], check: [] } }));
    const busy = await card(controller, 'Busy', 'doing');
    ledger.set(busy, { state: 'running', runtimeId: 'claude-code', since: at(0), canOpen: true });
    const queued = await card(controller, 'Queued');
    // It waits for the busy card (a slot wait would start as soon as archiving frees room in Doing).
    ledger.set(queued, { state: 'waiting', waitFor: { kind: 'conflict', cardId: busy }, runtimeId: 'claude-code', since: at(0), canOpen: false });

    let snapshot = await controller.refresh();
    assert.equal(snapshot.doing.count, 2);
    assert.ok(snapshot.calls.some((call) => call.cardId === review));

    // One card: off the board and out of Your calls, with a history line.
    assert.ok((await controller.archive(review)).ok);
    snapshot = await controller.refresh();
    assert.ok(!snapshot.cards.some((c) => c.id === review), 'an archived card is off the board');
    assert.ok(!snapshot.calls.some((call) => call.cardId === review), 'and out of Your calls');
    assert.equal(snapshot.doing.count, 1, 'and does not count in Doing');
    const archived = snapshot.archived.find((c) => c.id === review)!;
    assert.equal(archived.archived, now().toISOString());
    assert.equal(archived.call, null);
    assert.equal(archived.history.at(-1)?.what, 'Archived');
    assert.ok(fs.readFileSync(store.filePathOf(review)!, 'utf8').includes('archived:'), 'the file stays, marked');

    // An archived card cannot be moved or given; restore it first.
    for (const answer of [await controller.move(review, 'todo'), await controller.give(review, 'claude-code'), await controller.queue(review, 'claude-code')]) {
      assert.equal(!answer.ok && answer.message, 'This card is archived. Restore it first.');
    }

    // Not while an agent works on it; a waiting card stops waiting.
    assert.equal(!(await controller.archive(busy)).ok && (await controller.archive(busy) as { code: string }).code, 'busy');
    assert.ok((await controller.archive(queued)).ok);
    assert.equal(ledger.list().get(queued)?.state ?? null, null, 'archiving a queued card takes it out of the queue');

    // Archive all done: every Done card, and how many.
    const all = await controller.archiveDone();
    assert.ok(all.ok && all.count === 2);
    snapshot = await controller.refresh();
    assert.deepEqual(snapshot.cards.filter((c) => c.stage === 'done'), []);
    assert.deepEqual(new Set(snapshot.archived.map((c) => c.id)), new Set([review, queued, doneA, doneB]));
    assert.deepEqual(await controller.archiveDone(), { ok: true, count: 0 }, 'nothing left to archive');

    // Restore puts it back where it was, and Your calls again.
    assert.ok((await controller.restore(review)).ok);
    snapshot = await controller.refresh();
    const back = snapshot.cards.find((c) => c.id === review)!;
    assert.equal(back.stage, 'doing');
    assert.equal(back.archived, null);
    assert.equal(back.history.at(-1)?.what, 'Restored');
    assert.ok(snapshot.calls.some((call) => call.cardId === review));

    // Delete works on an archived card too.
    assert.ok((await controller.remove(doneA)).ok);
    assert.ok(!(await controller.refresh()).archived.some((c) => c.id === doneA));
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

  // ── W13: Interrupted by a quit while Doing was over its limit (4/3) ────────
  {
    const { ledger, controller } = setup();
    for (const title of ['D1', 'D2', 'D3']) await card(controller, title, 'doing');
    const slides = await card(controller, 'Draft the slides', 'todo', ['meeting.md']);
    assert.ok((await controller.give(slides, 'claude-code', { overLimit: true })).ok, 'Start anyway');
    assert.deepEqual((await controller.snapshot()).doing, { count: 4, limit: 3 });
    ledger.finish(slides, 'interrupted');

    // Nothing holds an interrupted card: another card naming the same file starts.
    const room = await card(controller, 'Book the room', 'todo', ['meeting.md']);
    assert.equal((await controller.give(room, 'claude-code', { overLimit: true })).ok, true, 'no conflict with an interrupted card');
    ledger.finish(room);

    // Retry starts at once: the Doing limit holds back cards entering Doing, not one in it.
    ledger.started.length = 0;
    assert.deepEqual(await controller.retry(slides), { ok: true, cardId: slides });
    assert.deepEqual(ledger.started.map((turn) => [turn.card.id, turn.kind]), [[slides, 'retry']]);

    // Stop, then Give again: also at once.
    assert.ok((await controller.stop(slides)).ok);
    assert.deepEqual(await controller.give(slides, 'claude-code'), { ok: true, cardId: slides });
    assert.deepEqual(ledger.started.map((turn) => turn.kind), ['retry', 'give']);
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

  // ── Idea review (W6) ───────────────────────────────────────────────────────
  {
    const asked: IdeaReviewInput[] = [];
    let answer: (fields: ReviewFields) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    const reviewer = {
      review(input: IdeaReviewInput): Promise<ReviewFields> {
        asked.push(input);
        return new Promise<ReviewFields>((resolve, reject) => {
          answer = resolve;
          fail = reject;
        });
      },
    };
    const proposal: ReviewFields = {
      verdict: 'ready',
      why: 'A template saves an hour after every workshop.',
      size: 'small',
      title: 'Write the workshop follow-up email template',
      description: 'Draft one email with placeholders.',
      doneWhen: 'The template is in the shared folder.',
    };
    const { store, settings, controller } = setup({ reviewer });
    const view = async (id: string) => (await controller.snapshot()).cards.find((c) => c.id === id)!;
    await card(controller, 'Send the workshop invites');
    await card(controller, 'Finished long ago', 'done');
    const dropped = await card(controller, 'A dropped idea', 'idea');
    await controller.setDropped(dropped, true);
    const idea = await card(controller, 'workshop follow-up email template', 'idea');
    await store.mutate(idea, null, (c) => ({ ...c, description: 'Notes: keep it short.\n' }));

    assert.equal(!(await controller.acceptReview(idea)).ok, true, 'nothing to make into a task before a review');
    assert.ok((await controller.reviewIdea(idea, 'opencode')).ok, 'answers at once');
    assert.equal(settings.get(DEFAULT_RUNTIME_KEY), 'opencode', 'the agent chosen becomes the board’s default');
    assert.equal((await view(idea)).reviewing?.runtimeId, 'opencode', 'the idea shows Reviewing · OpenCode');
    assert.deepEqual(asked[0].idea, { title: 'workshop follow-up email template', description: 'Notes: keep it short.\n' });
    assert.deepEqual(asked[0].openTitles, ['Send the workshop invites'], 'open cards only: not done, not dropped, not itself');
    const twice = await controller.reviewIdea(idea, 'claude-code');
    assert.equal(!twice.ok && twice.code, 'busy');
    assert.equal(!twice.ok && twice.message, 'OpenCode is already reviewing this idea.');
    assert.equal(!(await controller.acceptReview(idea)).ok, true);

    answer(proposal);
    await controller.settled();
    let current = await view(idea);
    assert.equal(current.reviewing, null);
    assert.deepEqual(current.review, { by: 'opencode', at: current.review?.at, ...proposal });
    assert.equal(current.title, 'workshop follow-up email template', 'the idea itself is unchanged');
    assert.equal(current.description, 'Notes: keep it short.\n');
    assert.equal(current.stage, 'idea');
    assert.deepEqual(current.history.at(-1), { at: current.history.at(-1)?.at, by: 'opencode', what: 'Reviewed: Good to go' });

    // A review that does not come back: the idea says so, the earlier one stays.
    assert.ok((await controller.reviewIdea(idea, 'claude-code')).ok);
    fail(new Error('The review didn’t come back. It took longer than 45 seconds.'));
    await controller.settled();
    current = await view(idea);
    assert.equal(current.reviewFailure, 'The review didn’t come back. It took longer than 45 seconds.');
    assert.equal(current.review?.by, 'opencode');
    assert.ok((await controller.reviewIdea(idea, 'claude-code')).ok);
    assert.equal((await view(idea)).reviewFailure, null, 'the next review clears it');
    fail(new Error(''));
    await controller.settled();
    assert.equal((await view(idea)).reviewFailure, 'The review didn’t come back. Try again.');

    // Make it a task.
    assert.ok((await controller.acceptReview(idea)).ok);
    const snapshot = await controller.snapshot();
    current = snapshot.cards.find((c) => c.id === idea)!;
    assert.equal(current.stage, 'todo');
    assert.equal(snapshot.cards.filter((c) => c.stage === 'todo')[0].id, idea, 'on top of To do');
    assert.equal(current.title, 'Write the workshop follow-up email template');
    assert.equal(current.description, 'Draft one email with placeholders.\n\nNotes: keep it short.\n', 'the suggestion above the user’s notes');
    assert.equal(current.doneWhen, 'The template is in the shared folder.', 'the suggested Done when fills the field, not the body');
    assert.equal(current.history.at(-1)?.what, 'Made it a task from “workshop follow-up email template”');
    assert.equal(!(await controller.reviewIdea(idea, 'claude-code')).ok, true, 'only ideas are reviewed');
    // The file is named after the task now, not the idea (Windows test).
    assert.equal(path.basename(store.filePathOf(idea)!), 'write-the-workshop-follow-up-email.md', 'the slug a new card with this title gets');
    assert.equal(fs.existsSync(path.join(store.tasksDir, 'workshop-follow-up-email-template.md')), false, 'the idea’s file is gone');

    // An empty idea body takes the suggestion as it is.
    const plain = await card(controller, 'Glossary page', 'idea');
    await controller.reviewIdea(plain, 'claude-code');
    answer({ ...proposal, title: 'Add a client glossary page', verdict: 'unclear' });
    await controller.settled();
    assert.equal((await view(plain)).history.at(-1)?.what, 'Reviewed: Needs detail');
    await card(controller, 'Add a client glossary page');
    await store.mutate(plain, null, (c) => ({ ...c, doneWhen: 'My own line' }));
    await controller.acceptReview(plain);
    assert.equal((await view(plain)).doneWhen, 'My own line', 'never over the user’s own Done when');
    assert.equal((await view(plain)).description, 'Draft one email with placeholders.\n');
    assert.equal(path.basename(store.filePathOf(plain)!), 'add-a-client-glossary-page-2.md', 'a name another card has gets a number');

    // A review for an idea that moved on meanwhile is not stored.
    const moved = await card(controller, 'Run a pilot', 'idea');
    await controller.reviewIdea(moved, 'claude-code');
    await controller.move(moved, 'todo');
    answer(proposal);
    await controller.settled();
    assert.equal((await view(moved)).review, null);

    // Archived, unavailable, no reviewer.
    const later = await card(controller, 'Later', 'idea');
    await controller.archive(later);
    assert.equal(!(await controller.reviewIdea(later, 'claude-code')).ok, true, 'restore it first');
    await controller.restore(later);
    const before = asked.length;
    assert.equal(!(await controller.reviewIdea(later, 'codex')).ok, true, 'Codex is not signed in');
    assert.equal(asked.length, before, 'nothing runs for an unavailable agent');
    const bare = setup();
    const lone = await card(bare.controller, 'Lone idea', 'idea');
    assert.equal(!(await bare.controller.reviewIdea(lone, 'claude-code')).ok, true);
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

  // ── Sprint 145 (#596): Try again and Remove on a file the board couldn't read ──
  {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-board-files-'));
    const tasks = path.join(folder, '.ritemark', 'tasks');
    fs.mkdirSync(tasks, { recursive: true });
    const cardText = (id: string, title: string) => `---\nritemark: task/1\nid: ${id}\ntitle: ${title}\nstage: todo\n---\n`;
    fs.writeFileSync(path.join(tasks, 'cloud.md'), cardText('c10ud1', 'In the cloud'));
    fs.writeFileSync(path.join(tasks, 'stuck.md'), cardText('st0ck1', 'Stuck'));
    fs.writeFileSync(path.join(tasks, 'broken.md'), '---\nritemark: task/1\nid: br0k3n\ntitle: [unclosed\n---\n');
    fs.writeFileSync(path.join(tasks, 'locked.md'), '---\nritemark: task/1\nid: l0ck3d\ntitle: [unclosed\n---\n');
    fs.writeFileSync(path.join(tasks, 'fine.md'), cardText('f1n3c4', 'Reads fine'));
    fs.writeFileSync(path.join(folder, 'elsewhere.md'), 'not a card\n');
    let cloudReady = false;
    let stuckMs = 0;
    let slowMs = 0;
    const trashed: string[] = [];
    const store = new BoardStore(folder, {
      fileSystem: {
        ...nodeBoardStoreFileSystem,
        async readFile(file) {
          const name = path.basename(file);
          if (name === 'cloud.md' && !cloudReady) throw Object.assign(new Error('ETIMEDOUT: connection timed out, read'), { code: 'ETIMEDOUT' });
          if (name === 'slow.md' && slowMs) await new Promise((resolve) => setTimeout(resolve, slowMs));
          if (name === 'stuck.md' && stuckMs) {
            await new Promise((resolve) => setTimeout(resolve, stuckMs));
            throw Object.assign(new Error('ETIMEDOUT: connection timed out, read'), { code: 'ETIMEDOUT' });
          }
          return nodeBoardStoreFileSystem.readFile(file);
        },
        async trash(file) {
          if (path.basename(file) === 'locked.md') throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
          trashed.push(file);
          fs.rmSync(file);
        },
      },
      now,
    });
    const ledger = new FakeLedger();
    const pushed: string[][] = [];
    const make = (platform: NodeJS.Platform) =>
      new BoardController({
        store,
        ledger,
        folderName: 'files',
        settings: { get: () => undefined, update: async () => undefined },
        runtimes: () => ({ 'claude-code': READY, codex: READY, opencode: READY }),
        enabled: () => true,
        fileExists: async () => true,
        now,
        platform,
        retryAnswerMs: 150,
      });
    const controller = make('darwin');
    controller.subscribe((snapshot) => pushed.push(snapshot.unreadable.map((file) => `${file.fileName}:${file.reason}`)));
    // A card the hand-off ledger knows, whose file can't be read now.
    ledger.set('c10ud1', { state: 'completed', runtimeId: 'claude-code', since: at(1), canOpen: true });
    stuckMs = 0;
    await store.list();
    const first = await controller.snapshot();
    assert.deepEqual(first.unreadable.map((file) => [file.fileName, file.reason]), [['broken.md', 'format'], ['cloud.md', 'read'], ['locked.md', 'format']]);
    assert.ok(!first.cards.some((card) => card.id === 'c10ud1') && !first.calls.length, 'a ledger record brings no card back for a file the board can’t read');

    // S11: Try again, and it reads. The snapshot goes out before the answer, so the row goes in one step.
    cloudReady = true;
    pushed.length = 0;
    assert.deepEqual(await controller.retryFile('cloud.md'), { ok: true });
    assert.ok(pushed.length >= 1 && !pushed[pushed.length - 1].some((row) => row.startsWith('cloud.md')), 'the last snapshot before the answer is fresh, without the row');
    assert.ok((await controller.snapshot()).cards.some((card) => card.id === 'c10ud1'), 'the card is back in its column');

    // S12: Try again on a file that still fails: the answer comes in time, the row stays as it was.
    stuckMs = 400;
    await store.invalidate('stuck.md').catch(() => undefined);
    const before = Date.now();
    assert.deepEqual(await controller.retryFile('stuck.md'), { ok: true });
    assert.ok(Date.now() - before < 350, 'a read that hangs gets an answer after the cap, not after the read');
    const moved = await controller.move('f1n3c4', 'doing');
    assert.ok(moved.ok && Date.now() - before < 350, 'and a move made meanwhile doesn’t wait for it (#597)');
    stuckMs = 0;

    // S17: only this board's unreadable files.
    for (const name of ['../elsewhere.md', 'fine.md', 'not-there.md', 'nested/broken.md']) {
      assert.equal((await controller.removeFile(name)).ok, false, `${name} is refused`);
      assert.equal((await controller.retryFile(name)).ok, false, `${name} can’t be retried`);
    }
    assert.deepEqual(trashed, [], 'nothing trashed');

    // S13: Remove moves the file to the trash; the row goes.
    assert.deepEqual(await controller.removeFile('broken.md'), { ok: true });
    assert.deepEqual(trashed.map((file) => path.basename(file)), ['broken.md']);
    assert.ok(!(await controller.snapshot()).unreadable.some((file) => file.fileName === 'broken.md'));

    // S16: the trash refuses: the row stays, and the answer says so in the board's words, per system.
    assert.deepEqual(await controller.removeFile('locked.md'), {
      ok: false,
      code: 'trash-refused',
      message: 'Ritemark couldn’t move it to the Trash, so it is still in the folder.',
    });
    const windows = make('win32');
    const onWindows = await windows.removeFile('locked.md');
    windows.dispose();
    assert.equal(onWindows.ok ? null : onWindows.message, 'Ritemark couldn’t move it to the Recycle Bin, so it is still in the folder.');
    assert.ok((await controller.snapshot()).unreadable.some((file) => file.fileName === 'locked.md'), 'the refused file keeps its row');

    // Try again answers in time even while a change to another card holds the store (its own file hangs).
    fs.writeFileSync(path.join(tasks, 'slow.md'), cardText('sl0w01', 'Slow to read'));
    await store.invalidate('slow.md');
    slowMs = 400;
    const held = controller.move('sl0w01', 'doing');
    const started = Date.now();
    assert.deepEqual(await controller.retryFile('locked.md'), { ok: true });
    assert.ok(Date.now() - started < 350, `the answer comes at the cap, not after the held store (${Date.now() - started} ms)`);
    await held;
    slowMs = 0;
    controller.dispose();
  }

  // ── Remove's last look, and a move's revision ─────────────────────────────
  {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-board-files-'));
    const tasks = path.join(folder, '.ritemark', 'tasks');
    fs.mkdirSync(tasks, { recursive: true });
    const cardText = (id: string, title: string) => `---\nritemark: task/1\nid: ${id}\ntitle: ${title}\nstage: todo\n---\n`;
    fs.writeFileSync(path.join(tasks, 'arrived.md'), cardText('arr1v3', 'Arrived'));
    fs.writeFileSync(path.join(tasks, 'hanging.md'), cardText('h4ng1n', 'Hanging'));
    fs.writeFileSync(path.join(tasks, 'plain.md'), cardText('pl41n1', 'Plain'));
    let arrived = false;
    let hanging = false;
    const trashed: string[] = [];
    const store = new BoardStore(folder, {
      fileSystem: {
        ...nodeBoardStoreFileSystem,
        async readFile(file) {
          const name = path.basename(file);
          if (name === 'arrived.md' && !arrived) throw Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' });
          if (name === 'hanging.md' && hanging) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            throw Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' });
          }
          return nodeBoardStoreFileSystem.readFile(file);
        },
        async trash(file) {
          trashed.push(path.basename(file));
          fs.rmSync(file);
        },
      },
      now,
    });
    const controller = new BoardController({
      store,
      ledger: new FakeLedger(),
      folderName: 'files',
      settings: { get: () => undefined, update: async () => undefined },
      runtimes: () => ({ 'claude-code': READY, codex: READY, opencode: READY }),
      enabled: () => true,
      fileExists: async () => true,
      now,
      removeLookMs: 150,
    });
    hanging = true;
    await store.list();
    assert.ok(store.isUnreadable('arrived.md') && store.isUnreadable('hanging.md'));

    // The file arrived since its row was drawn: Remove looks once more and leaves it, and its card shows.
    arrived = true;
    const kept = await controller.removeFile('arrived.md');
    assert.equal(kept.ok ? 'ok' : kept.code, 'not-found');
    assert.deepEqual(trashed, [], 'a file that reads now is not trashed');
    assert.ok((await controller.snapshot()).cards.some((card) => card.title === 'Arrived'), 'its card is on the board');

    // A file that went during the look (a sync deleted it) counts as removed, and nothing is trashed.
    fs.writeFileSync(path.join(tasks, 'going.md'), '---\nritemark: task/1\nid: g01ng1\ntitle: [unclosed\n---\n');
    await store.invalidate('going.md');
    assert.ok(store.isUnreadable('going.md'));
    fs.rmSync(path.join(tasks, 'going.md'));
    assert.deepEqual(await controller.removeFile('going.md'), { ok: true });
    assert.deepEqual(trashed, [], 'a file already gone is not trashed');

    // A file that still hangs goes to the trash after the short look.
    const started = Date.now();
    assert.deepEqual(await controller.removeFile('hanging.md'), { ok: true });
    assert.ok(Date.now() - started < 600, 'Remove doesn’t wait for the hanging read');
    assert.deepEqual(trashed, ['hanging.md']);

    // A move's answer carries the store's revision; the next snapshot is at or after it and shows the move.
    const moved = await controller.move('pl41n1', 'doing');
    assert.ok(moved.ok && typeof moved.revision === 'number');
    const after = await controller.snapshot();
    assert.ok(after.revision !== undefined && moved.ok && moved.revision !== undefined && after.revision >= moved.revision, 'the snapshot is at or after the move');
    assert.equal(after.cards.find((card) => card.id === 'pl41n1')?.stage, 'doing');
    assert.equal(after.boardId, store.id, 'and names the store that counted it');
    await new Promise((resolve) => setTimeout(resolve, 1100)); // let the hanging read finish
    controller.dispose();
  }

  // ── Remove refuses a file the board hasn't listed, without blaming the trash ─
  {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-board-files-'));
    const store = new BoardStore(folder, {
      fileSystem: {
        ...nodeBoardStoreFileSystem,
        async readDir() {
          throw Object.assign(new Error('EIO: i/o error, scandir'), { code: 'EIO' });
        },
        async trash() {},
      },
      now,
    });
    const controller = new BoardController({
      store,
      ledger: new FakeLedger(),
      folderName: 'files',
      settings: { get: () => undefined, update: async () => undefined },
      runtimes: () => ({ 'claude-code': READY, codex: READY, opencode: READY }),
      enabled: () => true,
      fileExists: async () => true,
      now,
    });
    const answer = await controller.removeFile('broken.md');
    assert.equal(answer.ok, false);
    assert.equal(answer.ok ? '' : answer.code, 'not-found', 'a board that couldn’t list its folder lists no file to remove');
    assert.doesNotMatch(answer.ok ? '' : answer.message, /Trash|Recycle Bin/, 'and the answer doesn’t blame the trash');
    controller.dispose();
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
