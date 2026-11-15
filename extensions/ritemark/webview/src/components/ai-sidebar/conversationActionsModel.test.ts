/**
 * Sprint 122 (#282) — the conversation actions say and allow the same thing
 * wherever they appear: History, the thread rail, and the new header all read
 * their pin state, labels and delete wording from `conversationActionsModel`.
 *
 * Run with `npx tsx webview/src/components/ai-sidebar/conversationActionsModel.test.ts`.
 */
import { strict as assert } from 'node:assert';
import type { ConversationSummaryV1 } from '../../../../src/conversations/types';
import {
  MAX_PINNED_CONVERSATIONS,
  conversationPinState,
  conversationStatusLabel,
  deleteConfirmLabel,
  headerStatusLabel,
  isConversationRunning,
  railEntryLabels,
  usageLimitRuntime,
  usageLimitTooltip,
} from './conversationActionsModel';

type Lifecycle = ConversationSummaryV1['lifecycle'];
const withLifecycle = (lifecycle: Lifecycle) => ({ lifecycle });

const idle: Lifecycle = { state: 'idle' };
const working: Lifecycle = { state: 'working', activeTurnId: 't1' };
const needsUser: Lifecycle = { state: 'needs-user', activeTurnId: 't1', attentionKind: 'approval' };
const interrupted: Lifecycle = { state: 'interrupted', turnId: null, reason: 'restart' };

{
  // --- pinning: the five-pin limit and its wording
  assert.equal(MAX_PINNED_CONVERSATIONS, 5, 'the limit History has always had');

  const unpinned = conversationPinState('c1', 'Plan the launch', []);
  assert.deepEqual(unpinned, { pinned: false, atCapacity: false, label: 'Pin Plan the launch', action: 'Pin', icon: 'push-pin' });

  const pinned = conversationPinState('c1', 'Plan the launch', ['c1']);
  assert.deepEqual(pinned, { pinned: true, atCapacity: false, label: 'Unpin Plan the launch', action: 'Unpin', icon: 'push-pin-slash' });

  const five = ['a', 'b', 'c', 'd', 'e'];
  const refused = conversationPinState('c1', 'Plan the launch', five);
  assert.equal(refused.atCapacity, true, 'a sixth pin is refused');
  assert.equal(refused.label, 'Unpin a conversation before pinning another.', 'and the label says what to do instead');
  assert.equal(refused.icon, 'push-pin');

  // A pinned conversation can always be unpinned, even at the limit.
  const unpinAtLimit = conversationPinState('a', 'Alpha', five);
  assert.equal(unpinAtLimit.atCapacity, false);
  assert.equal(unpinAtLimit.label, 'Unpin Alpha');

  // Four pinned leaves room for one more.
  assert.equal(conversationPinState('c1', 'x', ['a', 'b', 'c', 'd']).atCapacity, false);
}

{
  // --- delete: a running conversation is stopped first, and the button says so
  assert.equal(isConversationRunning(withLifecycle(idle)), false);
  assert.equal(isConversationRunning(withLifecycle(working)), true);
  assert.equal(isConversationRunning(withLifecycle(needsUser)), true, 'waiting on the user still has a turn in flight');
  assert.equal(isConversationRunning(withLifecycle(interrupted)), false, 'an interrupted turn is over');

  assert.equal(deleteConfirmLabel(withLifecycle(idle)), 'Delete');
  assert.equal(deleteConfirmLabel(withLifecycle(interrupted)), 'Delete');
  assert.equal(deleteConfirmLabel(withLifecycle(working)), 'Stop and delete');
  assert.equal(deleteConfirmLabel(withLifecycle(needsUser)), 'Stop and delete');
}

{
  // --- status: only a conversation that is not idle has something to say
  assert.equal(conversationStatusLabel(withLifecycle(idle)), null);
  assert.equal(conversationStatusLabel(withLifecycle(working)), 'Working');
  assert.equal(conversationStatusLabel(withLifecycle(needsUser)), 'Needs you');
  assert.equal(conversationStatusLabel(withLifecycle(interrupted)), 'Interrupted');
}

// Sprint 139 (the Experience lead, 26 October): the chat's header shows a state only while it is live.
// A turn that ended by an answer, a failure or a stop leaves just the title, for all three AIs; the
// chats list keeps its word for a chat whose last turn ended badly.
{
  for (const runtime of ['claude-code', 'codex', 'opencode'] as const) {
    const summary = (lifecycle: Lifecycle) => ({ lifecycle, runtimeSummary: [runtime] });
    assert.equal(headerStatusLabel(summary(working)), 'Working', runtime);
    assert.equal(headerStatusLabel(summary(needsUser)), 'Needs you', runtime);
    assert.equal(headerStatusLabel(summary({ state: 'needs-user', activeTurnId: 't1', attentionKind: 'question' })), 'Needs you', runtime);
    assert.equal(headerStatusLabel(summary(idle)), null, `${runtime}: an answer leaves just the title`);
    for (const reason of ['failed', 'cancelled', 'restart', 'runtime-released', 'deleted-running'] as const) {
      const ended: Lifecycle = { state: 'interrupted', turnId: 't1', reason };
      assert.equal(headerStatusLabel(summary(ended)), null, `${runtime}: no "Interrupted" in the header after ${reason}`);
      assert.equal(conversationStatusLabel(summary(ended)), 'Interrupted', 'the chats list keeps its word');
    }
  }
}

// Sprint 160 (#686, the Experience lead): a usage limit says so, in the chats list and on the rail,
// instead of "Interrupted". Other failures keep "Interrupted" (decision 9).
{
  const failed: Lifecycle = { state: 'interrupted', turnId: 't1', reason: 'failed' };
  type Failure = NonNullable<ConversationSummaryV1['lastFailure']>;
  const chat = (lifecycle: Lifecycle, lastFailure?: Failure) => ({ title: 'Shorten the notes', lifecycle, ...(lastFailure ? { lastFailure } : {}) });
  const limitOf = (runtimeId: Failure['runtimeId'], limit?: Failure['limit']): Failure => ({ runtimeId, kind: 'limit', ...(limit ? { limit } : {}) });

  for (const runtime of ['claude-code', 'codex', 'opencode'] as const) {
    for (const limit of ['plan', 'quota', 'credits', undefined] as const) {
      assert.equal(conversationStatusLabel(chat(failed, limitOf(runtime, limit))), 'Limit reached', `${runtime} ${limit ?? '(no detail)'}`);
      assert.equal(usageLimitRuntime(chat(failed, limitOf(runtime, limit))), runtime);
    }
    assert.equal(headerStatusLabel(chat(failed, limitOf(runtime, 'plan'))), null, 'the header still shows just the title');
  }
  // The Experience lead (16 November): OpenCode's limit is the model's, so the tooltip names the model as
  // the card's title does; Claude's and ChatGPT's is the plan's, so it names the AI.
  const labels = (id: string) => ({ 'google/gemini-3.8-flash': 'Gemini 3.8 Flash' } as Record<string, string>)[id];
  assert.equal(usageLimitTooltip({ runtimeId: 'opencode', model: 'google/gemini-3.8-flash' }, labels), "Stopped at Gemini 3.8 Flash's usage limit");
  assert.equal(usageLimitTooltip({ runtimeId: 'opencode', model: 'google/gemini-unlisted' }, labels), 'Stopped at a usage limit', 'the label unknown');
  assert.equal(usageLimitTooltip({ runtimeId: 'opencode' }, labels), 'Stopped at a usage limit', 'no model (a billing stop)');
  assert.equal(usageLimitTooltip({ runtimeId: 'opencode', model: 'google/gemini-3.8-flash' }), 'Stopped at a usage limit', 'no catalog');
  assert.equal(usageLimitTooltip({ runtimeId: 'codex', model: 'gpt-6.1-sol' }, labels), "Stopped at ChatGPT's usage limit", "people's names, never Codex");
  assert.equal(usageLimitTooltip({ runtimeId: 'claude-code' }, labels), "Stopped at Claude's usage limit");

  // ChatGPT's "busy" isn't a usage limit (its card says so); other kinds, and a chat from before Sprint 160, keep the word.
  assert.equal(conversationStatusLabel(chat(failed, limitOf('codex', 'busy'))), 'Interrupted');
  for (const kind of ['sign-in', 'model', 'network', 'provider'] as const) {
    assert.equal(conversationStatusLabel(chat(failed, { runtimeId: 'opencode', kind })), 'Interrupted', kind);
  }
  assert.equal(conversationStatusLabel(chat(failed)), 'Interrupted', 'no failure kind in the summary');
  // Only while the failure is what interrupted the chat.
  assert.equal(conversationStatusLabel(chat({ state: 'interrupted', turnId: 't1', reason: 'cancelled' }, limitOf('opencode', 'plan'))), 'Interrupted');
  assert.equal(conversationStatusLabel(chat(idle, limitOf('opencode', 'plan'))), null);
  assert.equal(conversationStatusLabel(chat(working, limitOf('opencode', 'plan'))), 'Working');

  // The rail: its accessible name says "Limit reached", its tooltip whose limit it was.
  const flashLimit = { ...limitOf('opencode', 'plan'), model: 'google/gemini-3.8-flash' };
  assert.deepEqual(railEntryLabels(chat(failed, flashLimit), { pinned: false, unread: false, modelLabel: labels }), {
    label: 'Shorten the notes — Limit reached',
    tooltip: "Shorten the notes — Stopped at Gemini 3.8 Flash's usage limit",
  });
  assert.equal(railEntryLabels(chat(failed, limitOf('opencode', 'plan')), { pinned: false, unread: false, modelLabel: labels }).tooltip,
    'Shorten the notes — Stopped at a usage limit', 'no model in the summary');
  assert.equal(railEntryLabels(chat(failed, limitOf('claude-code', 'plan')), { pinned: false, unread: false, modelLabel: labels }).tooltip,
    "Shorten the notes — Stopped at Claude's usage limit");
  assert.deepEqual(railEntryLabels(chat(failed, { runtimeId: 'opencode', kind: 'network' }), { pinned: false, unread: false }), {
    label: 'Shorten the notes — Interrupted',
    tooltip: 'Shorten the notes — Interrupted',
  });
  // As before: an unread reply first, and a pinned chat says Pinned.
  assert.equal(railEntryLabels(chat(failed, limitOf('opencode', 'plan')), { pinned: false, unread: true }).tooltip, 'Shorten the notes — New reply');
  assert.equal(railEntryLabels(chat(failed, limitOf('opencode', 'plan')), { pinned: true, unread: false }).tooltip, 'Shorten the notes — Pinned');
  assert.equal(railEntryLabels(chat(failed, limitOf('opencode', 'plan')), { pinned: true, unread: true }).label, 'Shorten the notes — Pinned, new reply');
  assert.equal(railEntryLabels(chat(working), { pinned: false, unread: true }).label, 'Shorten the notes — Working');
  assert.equal(railEntryLabels(chat(needsUser), { pinned: false, unread: false }).label, 'Shorten the notes — Needs you');
  assert.equal(railEntryLabels(chat(idle), { pinned: false, unread: false }).label, 'Shorten the notes — Recent');
}

console.log('conversationActionsModel.test.ts: all tests passed');
