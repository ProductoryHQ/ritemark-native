/**
 * Sprint 128 — Claude's background work in the sidebar: card updates across
 * turns, the honest "still running" state, and the queue rules.
 *
 * Run: npx tsx webview/src/components/ai-sidebar/backgroundWork.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyTaskProgress,
  backgroundStatusLabel,
  endRunningCards,
  markCardStopping,
  subagentStatusText,
  tasksEndedLine,
} from './backgroundWork';
import { deriveActivityState, presentActivityState } from './activityState';
import { createConversationState, type ConversationState } from './conversationState';
import { isQueuePaused, isReadyToDrain } from './promptQueue';
import type { AgentConversationTurn, AgentProgress, SubagentProgress } from './types';

const card = (partial: Partial<SubagentProgress> = {}): SubagentProgress => ({
  id: 'toolu_card', parentTurnId: 't1', task: 'Verify facts', status: 'running', activities: [], timestamp: 1, ...partial,
});
const turn = (partial: Partial<AgentConversationTurn>): AgentConversationTurn => ({
  id: 't1', conversationId: 'c1', userPrompt: 'p', activities: [], isRunning: false, isPlan: false, planHandled: false, timestamp: 1000, ...partial,
});
const progress = (partial: Partial<AgentProgress>): AgentProgress => ({ type: 'subagent_update', message: '', timestamp: 2, ...partial });
const conv = (partial: Partial<ConversationState>): ConversationState => ({ ...createConversationState('c1'), ...partial });

// S1/S3: a card in an earlier, finished turn is found and updated — the
// update does not need its turn to be running, nor the last one.
{
  const turns = [
    turn({ id: 't1', subagents: [card()], result: { text: 'launched', filesModified: [], metrics: { durationMs: 1, costUsd: null, model: null } } }),
    turn({ id: 't2', origin: 'background-task', isRunning: true }),
  ];
  const done = applyTaskProgress(turns, progress({ type: 'subagent_done', subagentId: 'toolu_card', subagentStatus: 'completed', message: 'All facts checked', taskId: 'a1', backgrounded: true }));
  assert.equal(done[0].subagents![0].status, 'done');
  assert.equal(done[0].subagents![0].result, 'All facts checked');
  assert.equal(done[0].subagents![0].taskId, 'a1');
  assert.equal(done[1], turns[1], 'other turns are untouched');
  assert.equal(applyTaskProgress(turns, progress({ subagentId: 'no-card' })), turns, 'an update with no card changes nothing');
}

// Running in the background, then resumed after a completion (Phase 0: a task can start again).
{
  let turns = [turn({ subagents: [card()] })];
  turns = applyTaskProgress(turns, progress({ subagentId: 'toolu_card', subagentStatus: 'running', backgrounded: true, message: 'Reading the guide' }));
  assert.equal(turns[0].subagents![0].backgrounded, true);
  assert.equal(subagentStatusText(turns[0].subagents![0]), 'Running in the background');
  assert.equal(turns[0].subagents![0].detail, 'Reading the guide');
  turns = applyTaskProgress(turns, progress({ type: 'subagent_done', subagentId: 'toolu_card', subagentStatus: 'completed' }));
  turns = applyTaskProgress(turns, progress({ subagentId: 'toolu_card', subagentStatus: 'running' }));
  assert.equal(turns[0].subagents![0].status, 'running');
}

// S24/S25: Stopping… holds until the task reports its end; then Stopped.
{
  let turns = markCardStopping([turn({ subagents: [card({ taskId: 'a1' })] })], 'toolu_card');
  assert.equal(turns[0].subagents![0].status, 'stopping');
  turns = applyTaskProgress(turns, progress({ subagentId: 'toolu_card', subagentStatus: 'running', message: 'still working' }));
  assert.equal(turns[0].subagents![0].status, 'stopping', 'a progress line does not undo the stop');
  turns = applyTaskProgress(turns, progress({ type: 'subagent_done', subagentId: 'toolu_card', subagentStatus: 'stopped', message: 'Stopped' }));
  assert.equal(turns[0].subagents![0].status, 'stopped');
  assert.equal(subagentStatusText(turns[0].subagents![0]), 'Stopped');
}

// S11/S31: cards with no live session behind them end, instead of spinning forever.
{
  const turns = endRunningCards([turn({ subagents: [card(), card({ id: 'done', status: 'done' })] })]);
  assert.equal(turns[0].subagents![0].status, 'ended');
  assert.equal(turns[0].subagents![1].status, 'done');
  assert.equal(subagentStatusText(turns[0].subagents![0]), 'Ended when the session closed');
  const untouched = [turn({ subagents: [card({ status: 'done' })] })];
  assert.equal(endRunningCards(untouched), untouched);
}

// Subagent activity lands on its card.
{
  const turns = applyTaskProgress([turn({ subagents: [card()] })], progress({ type: 'subagent_progress', parentToolUseId: 'toolu_card', message: 'Bash running (3s)' }));
  assert.equal(turns[0].subagents![0].activities.length, 1);
}

// S8/S9/S27: Done or Stopped says what still runs; never a plain "Done".
{
  const finished = turn({ result: { text: 'launched', filesModified: [], metrics: { durationMs: 1000, costUsd: null, model: null } } });
  const withOne = conv({ agentConversation: [finished], backgroundTasks: [{ taskId: 'a1' }] });
  assert.equal(deriveActivityState(withOne), 'done-background');
  assert.equal(presentActivityState('done-background', { backgroundCount: 1 })?.label, 'Done — 1 task still running in the background');
  assert.equal(presentActivityState('done-background', { backgroundCount: 2 })?.label, 'Done — 2 tasks still running in the background');
  assert.equal(deriveActivityState(conv({ agentConversation: [finished] })), 'done', 'nothing running: plain Done');
  const stopped = turn({ result: { text: '', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null }, error: 'Cancelled by user' } });
  assert.equal(deriveActivityState(conv({ agentConversation: [stopped], backgroundTasks: [{ taskId: 'a1' }] })), 'stopped-background');
  assert.equal(backgroundStatusLabel('Stopped', 1), 'Stopped — 1 task still running in the background');
  // Waiting states still outrank background work.
  const waiting = turn({ pendingQuestion: { toolUseId: 'q', questions: [] } });
  assert.equal(deriveActivityState(conv({ agentConversation: [waiting], backgroundTasks: [{ taskId: 'a1' }] })), 'waiting-input');
}

// Background work never blocks a new prompt; a stop still pauses the queue.
{
  assert.equal(isReadyToDrain('done-background'), true);
  assert.equal(isQueuePaused('stopped-background', 1), true);
}

assert.equal(tasksEndedLine(1), '1 background task ended with the session.');
assert.equal(tasksEndedLine(2), '2 background tasks ended with the session.');

console.log('backgroundWork.test.ts: all assertions passed');
