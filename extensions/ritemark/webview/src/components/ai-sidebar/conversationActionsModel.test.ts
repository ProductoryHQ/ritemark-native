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
  isConversationRunning,
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

console.log('conversationActionsModel.test.ts: all tests passed');
