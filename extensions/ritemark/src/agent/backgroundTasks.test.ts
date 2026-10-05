/**
 * Sprint 128 — Claude background subagents: card events, the live set, and the
 * turn Claude opens itself after background work. Fixtures are the Phase 0
 * recordings of the bundled CLI (src/agent/fixtures/background-subagents/).
 *
 * Run: npx tsx src/agent/backgroundTasks.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { createBackgroundTaskState, reduceTaskMessage, isBackgroundedCard, type TaskCardEvent } from './backgroundTasks';
import { AgentSession } from './AgentRunner';
import type { AgentProgress, AgentResult, BackgroundTaskSummary } from './types';

type Recording = { messages: Array<Record<string, any>> };
const fixture = (name: string): Recording =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'background-subagents', `${name}.json`), 'utf8'));

const agentToolUseId = (rec: Recording): string =>
  rec.messages.find((m) => m.type === 'system' && m.subtype === 'task_started' && m.task_type === 'local_agent')!.tool_use_id;

// ── Reducer ─────────────────────────────────────────────────────────────

// S1/S2: the card id is the Agent tool_use id; a subagent's own Bash has no card;
// the background agent ends completed and the live set ends empty.
{
  const rec = fixture('p1');
  const state = createBackgroundTaskState();
  const events = rec.messages.flatMap((m) => reduceTaskMessage(state, m));
  const cards = events.filter((e): e is TaskCardEvent => e.kind === 'card');
  const cardId = agentToolUseId(rec);
  assert.ok(cards.length > 0, 'task messages produce card events');
  assert.ok(cards.every((c) => c.cardId === cardId), 'every card event targets the Agent card (tool_use id), never a Bash task');
  assert.equal(cards[0].status, 'running');
  assert.equal(cards[0].backgrounded, true);
  assert.equal(cards[cards.length - 1].status, 'completed');
  const liveSets = events.filter((e) => e.kind === 'live-set');
  assert.ok(liveSets.length > 0);
  assert.deepEqual(liveSets[liveSets.length - 1], { kind: 'live-set', tasks: [] }, 'the live set ends empty');
  assert.equal(isBackgroundedCard(state, cardId), true);
}

// S5: a finished subagent that is resumed runs again under the same card.
{
  const rec = fixture('p3');
  const state = createBackgroundTaskState();
  const statuses = rec.messages
    .flatMap((m) => reduceTaskMessage(state, m))
    .filter((e): e is TaskCardEvent => e.kind === 'card' && e.cardId === agentToolUseId(rec))
    .map((e) => e.status)
    .filter((status, i, all) => i === 0 || status !== all[i - 1]);
  assert.deepEqual(statuses, ['running', 'completed', 'running', 'completed']);
}

// S24: stopTask ends the agent as stopped.
{
  const rec = fixture('p6stop');
  const state = createBackgroundTaskState();
  const cards = rec.messages.flatMap((m) => reduceTaskMessage(state, m)).filter((e): e is TaskCardEvent => e.kind === 'card');
  assert.equal(cards[cards.length - 1].status, 'stopped');
}

// Ambient work is never a card and never in the live set.
{
  const state = createBackgroundTaskState();
  assert.deepEqual(reduceTaskMessage(state, { type: 'system', subtype: 'task_started', task_id: 't1', ambient: true, is_backgrounded: true }), []);
  assert.deepEqual(
    reduceTaskMessage(state, { type: 'system', subtype: 'background_tasks_changed', tasks: [{ task_id: 't1', ambient: true }, { task_id: 't2' }] }),
    [{ kind: 'live-set', tasks: [{ taskId: 't2' }] }],
  );
  assert.deepEqual(reduceTaskMessage(state, { type: 'assistant' }), [], 'other messages produce nothing');
}

// ── Session: the observed sequence through AgentSession._consumeLoop ─────

interface LiveLog {
  task: AgentProgress[];
  live: BackgroundTaskSummary[][];
  starts: number;
  runtimeProgress: AgentProgress[];
  runtimeResults: AgentResult[];
  ended: number[];
}

function liveSession(): { session: any; log: LiveLog } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = new AgentSession({ workspacePath: process.cwd() }) as any;
  const log: LiveLog = { task: [], live: [], starts: 0, runtimeProgress: [], runtimeResults: [], ended: [] };
  session.setLiveHooks({
    onTaskProgress: (p: AgentProgress) => log.task.push(p),
    onBackgroundTasks: (t: BackgroundTaskSummary[]) => log.live.push(t),
    onRuntimeTurnStart: () => { log.starts += 1; },
    onRuntimeTurnProgress: (p: AgentProgress) => log.runtimeProgress.push(p),
    onRuntimeTurnComplete: (r: AgentResult) => log.runtimeResults.push(r),
    onTasksEndedWithSession: (n: number) => log.ended.push(n),
  });
  return { session, log };
}

function streamOf(messages: Array<Record<string, any>>, hooks: { interrupt?: () => void } = {}) {
  return {
    async *[Symbol.asyncIterator]() { for (const m of messages) yield m; },
    interrupt: async () => { hooks.interrupt?.(); },
    close: () => {},
  };
}

function openHumanTurn(session: any, progress: AgentProgress['type'][]): Promise<AgentResult> {
  session._turnId = 1;
  session._consumerTurnId = 1;
  session._emitProgress = (type: AgentProgress['type']) => progress.push(type);
  return new Promise<AgentResult>((resolve) => { session._turnResolve = resolve; });
}

// S8, S12, S15: the human turn ends "launched"; the card stays running; after
// the task finishes Claude's own turn opens, streams, and ends "final: BG-DONE".
async function testObservedSequence(): Promise<void> {
  const rec = fixture('p1');
  const { session, log } = liveSession();
  const humanProgress: AgentProgress['type'][] = [];
  const human = openHumanTurn(session, humanProgress);
  let interrupts = 0;
  session._queryStream = streamOf(rec.messages, { interrupt: () => { interrupts += 1; } });
  await session._consumeLoop();
  const humanResult = await human;
  assert.equal(humanResult.text, 'launched', 'the human turn resolves at its own result');
  assert.ok(humanProgress.includes('subagent_start'), 'the card is created in the human turn');
  assert.equal(log.starts, 1, 'exactly one turn opened by Claude');
  assert.equal(log.runtimeResults.length, 1);
  assert.equal(log.runtimeResults[0].text, 'final: BG-DONE', 'the follow-up answer is delivered, not dropped');
  assert.ok(!log.runtimeResults[0].error);
  assert.equal(log.runtimeProgress[log.runtimeProgress.length - 1].type, 'done');
  const cardId = agentToolUseId(rec);
  const cardUpdates = log.task.filter((p) => p.subagentId === cardId && p.subagentStatus);
  assert.equal(cardUpdates[cardUpdates.length - 1].subagentStatus, 'completed', 'the background card completes (no endless spinner)');
  const sdkCompletions = rec.messages.filter((m) => m.subtype === 'task_notification' && m.tool_use_id === cardId && m.status === 'completed').length;
  assert.equal(
    log.task.filter((p) => p.subagentId === cardId && p.type === 'subagent_done').length,
    sdkCompletions,
    'only the SDK completes a background card; its launch tool_result does not',
  );
  assert.deepEqual(log.live[log.live.length - 1], [], 'the live set ends empty');
  assert.equal(interrupts, 0, 'nothing interrupts the session');
  assert.equal(session._runtimeTurn, null);
}

// S18: a prompt sent while Claude answers its own turn waits for that turn.
async function testHumanPromptWaitsForRuntimeTurn(): Promise<void> {
  const { session } = liveSession();
  const enqueued: unknown[] = [];
  session._queryStream = {
    ...streamOf([]),
    applyFlagSettings: async () => {},
  };
  session._enqueueInput = (msg: unknown) => enqueued.push(msg);
  session._resultsSeen = 1;
  session._openRuntimeTurn();
  const sent = session.sendMessage({ prompt: 'next question', timeoutMinutes: 15 });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(enqueued.length, 0, 'held while the runtime turn runs');
  session._completeRuntimeTurn({ type: 'result', subtype: 'success', result: 'done', origin: { kind: 'task-notification' } });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(enqueued.length, 1, 'sent once that turn has its result');
  const msg = enqueued[0] as { origin?: { kind: string } };
  assert.deepEqual(msg.origin, { kind: 'human' }, 'user prompts carry origin: human');
  session._forceResolveTurn(session._turnId, { text: '', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null } });
  await sent;
}

// S14 (T0.9): a message after the result does not start the inactivity timer,
// so nothing can interrupt the idle session and its background work later.
async function testNoTimerAfterResult(): Promise<void> {
  const { session } = liveSession();
  session._turnTimeoutMs = 50;
  let interrupts = 0;
  const human = openHumanTurn(session, []);
  session._queryStream = streamOf([
    { type: 'result', subtype: 'success', result: 'launched', origin: { kind: 'human' } },
    { type: 'system', subtype: 'task_progress', task_id: 't1', tool_use_id: 'toolu_x', description: 'still working' },
  ], { interrupt: () => { interrupts += 1; } });
  await session._consumeLoop();
  await human;
  assert.equal(session._turnTimeout, null, 'no timer runs with no turn open');
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(interrupts, 0);
}

// S29/S31: closing a session with work still running reports it.
async function testCloseReportsEndedTasks(): Promise<void> {
  const { session, log } = liveSession();
  session._handleTaskMessage({ type: 'system', subtype: 'background_tasks_changed', tasks: [{ task_id: 'a' }, { task_id: 'b' }] });
  session.close();
  assert.deepEqual(log.ended, [2]);
  assert.deepEqual(log.live[log.live.length - 1], []);
}

// A result that belongs to no open turn (an empty notification turn) is ignored.
async function testStrayNotificationResultIgnored(): Promise<void> {
  const { session, log } = liveSession();
  session._queryStream = streamOf([{ type: 'result', subtype: 'success', result: '', origin: { kind: 'task-notification' }, num_turns: 0 }]);
  await session._consumeLoop();
  assert.equal(log.runtimeResults.length, 0);
}

// Ask mode outside a human turn (a background subagent, or Claude's own turn):
// the approval reaches the gate through the live channel — it used to fail open.
async function testAskModeOutsideATurnAsksFirst(): Promise<void> {
  const { session } = liveSession();
  const asked: Array<{ toolUseId: string; kind: string }> = [];
  session.setLiveHooks({ ...session._live, onToolApproval: (r: { toolUseId: string; kind: string }) => asked.push(r) });
  session.setApprovalMode('ask');
  assert.equal(session._turnResolve, null, 'no human turn is open');
  const decision = session._handleCanUseTool('Write', { file_path: '/tmp/x.md' }, { signal: new AbortController().signal, toolUseID: 'toolu_bg_write' });
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(asked.map((r) => [r.toolUseId, r.kind]), [['toolu_bg_write', 'file-write']], 'the write waits for approval');
  assert.equal(session.answerToolApproval('toolu_bg_write', false), true);
  assert.equal((await decision).behavior, 'deny', 'a rejected background write does not run');
}

(async () => {
  await testAskModeOutsideATurnAsksFirst();
  await testObservedSequence();
  await testHumanPromptWaitsForRuntimeTurn();
  await testNoTimerAfterResult();
  await testCloseReportsEndedTasks();
  await testStrayNotificationResultIgnored();
  console.log('backgroundTasks.test.ts: all assertions passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
