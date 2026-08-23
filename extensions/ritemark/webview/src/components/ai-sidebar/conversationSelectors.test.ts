import assert from 'node:assert/strict';
import { selectRailConversationIds } from './conversationSelectors';
import type { ConversationSummaryV1 } from '../../../../src/conversations/types';

const summary = (id: string, minute: number, state: 'idle' | 'working' | 'needs-user' = 'idle'): ConversationSummaryV1 => ({
  conversationId: id, scopeId: 'ps1-0000000000000000000000000000000000000000', title: id,
  identityColorSlot: minute % 24,
  createdAt: new Date(2026, 0, 1, 0, minute).toISOString(), lastActivityAt: new Date(2026, 0, 1, 0, minute).toISOString(),
  revision: 1, bindingGeneration: 0,
  lifecycle: state === 'idle' ? { state } : state === 'working' ? { state, activeTurnId: 'turn' } : { state, activeTurnId: 'turn', attentionKind: 'question' },
  runtimeSummary: ['codex'], integrity: 'verified', lastVerifiedAt: new Date().toISOString(),
});

const rows = [summary('old', 0), summary('a', 1), summary('b', 2), summary('c', 3), summary('d', 4), summary('e', 5, 'working'), summary('f', 6, 'needs-user')];
assert.deepEqual(selectRailConversationIds(rows, ['a'], 'b'), ['a', 'f', 'e', 'd', 'c', 'b']);
assert.deepEqual(selectRailConversationIds(rows, ['missing', 'a', 'a'], null), ['a', 'f', 'e', 'd', 'c', 'b']);
assert.deepEqual(
  selectRailConversationIds(rows, ['a'], 'c'),
  selectRailConversationIds(rows, ['a'], 'b'),
  'clicking among recent conversations does not reorder them',
);
assert.deepEqual(
  selectRailConversationIds(rows, ['a'], 'old'),
  ['a', 'f', 'e', 'd', 'c', 'b', 'old'],
  'an older current conversation is appended without disturbing recent order',
);
console.log('conversationSelectors tests passed');
