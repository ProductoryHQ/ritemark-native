/**
 * Regression tests for the composer queue flow (Sprint 74, R2 / issue #82).
 *
 * Run with: npx tsx webview/src/components/ai-sidebar/composerQueue.test.ts
 */
import assert from 'node:assert/strict';
import { shouldQueueInsteadOfSend, shouldAutoSendQueuedPrompt } from './composerQueue';

// ── shouldQueueInsteadOfSend ────────────────────────────────────────────────

function testQueuesWhileAgentRuns() {
  // Regression #82: typing + Enter during an agent run must queue, not be lost
  // (the old behaviour disabled the textarea entirely).
  assert.equal(
    shouldQueueInsteadOfSend({ isLoading: true, isAgentMode: true, hasOverridePrompt: false }),
    true,
    'user send during agent run must queue'
  );
}

function testSendsImmediatelyWhenIdle() {
  assert.equal(
    shouldQueueInsteadOfSend({ isLoading: false, isAgentMode: true, hasOverridePrompt: false }),
    false,
    'send while idle must go straight through'
  );
}

function testAutoSendPathNeverReQueues() {
  // The auto-send of an already-queued prompt happens right after the agent
  // finishes; it must never loop back into the queue.
  assert.equal(
    shouldQueueInsteadOfSend({ isLoading: true, isAgentMode: true, hasOverridePrompt: true }),
    false,
    'override-prompt sends must never re-queue'
  );
}

function testNonAgentModeNeverQueues() {
  // Plain chat streaming (non-agent) keeps its existing behaviour.
  assert.equal(
    shouldQueueInsteadOfSend({ isLoading: true, isAgentMode: false, hasOverridePrompt: false }),
    false,
    'non-agent chat must not use the queue'
  );
}

// ── shouldAutoSendQueuedPrompt ──────────────────────────────────────────────

function testAutoSendsOnRunningToIdleTransition() {
  assert.equal(
    shouldAutoSendQueuedPrompt({ wasRunning: true, isRunning: false, queuedPrompt: 'and review existing sprints' }),
    true,
    'queued prompt must auto-send when the agent finishes'
  );
}

function testNoAutoSendWithoutQueuedPrompt() {
  assert.equal(
    shouldAutoSendQueuedPrompt({ wasRunning: true, isRunning: false, queuedPrompt: null }),
    false,
    'no queued prompt → nothing to auto-send'
  );
  assert.equal(
    shouldAutoSendQueuedPrompt({ wasRunning: true, isRunning: false, queuedPrompt: '   ' }),
    false,
    'whitespace-only queued prompt → nothing to auto-send'
  );
}

function testNoAutoSendWhileStillRunning() {
  assert.equal(
    shouldAutoSendQueuedPrompt({ wasRunning: true, isRunning: true, queuedPrompt: 'queued' }),
    false,
    'must not send while the agent is still running'
  );
}

function testNoDoubleSendOnIdleRerenders() {
  // Regression guard: idle → idle re-renders (e.g. unrelated store updates)
  // must not re-fire the auto-send.
  assert.equal(
    shouldAutoSendQueuedPrompt({ wasRunning: false, isRunning: false, queuedPrompt: 'queued' }),
    false,
    'idle → idle must never auto-send (would double-send)'
  );
}

function main() {
  testQueuesWhileAgentRuns();
  testSendsImmediatelyWhenIdle();
  testAutoSendPathNeverReQueues();
  testNonAgentModeNeverQueues();
  testAutoSendsOnRunningToIdleTransition();
  testNoAutoSendWithoutQueuedPrompt();
  testNoAutoSendWhileStillRunning();
  testNoDoubleSendOnIdleRerenders();
  console.log('composerQueue tests passed.');
}

main();
