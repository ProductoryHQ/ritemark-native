import assert from 'node:assert/strict';
import {
  CONVERSATION_IDENTITY_COLOR_SLOT_COUNT,
  allocateConversationIdentityColorSlot,
  isConversationIdentityColorSlot,
  type ConversationIdentityColorOwner,
} from './identityColor';

const at = (slot: number, minute: number): ConversationIdentityColorOwner => ({
  identityColorSlot: slot,
  lastActivityAt: new Date(Date.UTC(2026, 7, 23, 12, minute)).toISOString(),
});

assert.equal(CONVERSATION_IDENTITY_COLOR_SLOT_COUNT, 24);
assert.equal(allocateConversationIdentityColorSlot([]), 0);
assert.equal(allocateConversationIdentityColorSlot([at(0, 0), at(1, 1)]), 2);

const fullPalette = Array.from(
  { length: CONVERSATION_IDENTITY_COLOR_SLOT_COUNT },
  (_, slot) => at(slot, slot),
);
assert.equal(
  new Set(fullPalette.map((owner) => owner.identityColorSlot)).size,
  CONVERSATION_IDENTITY_COLOR_SLOT_COUNT,
);
assert.equal(allocateConversationIdentityColorSlot(fullPalette), 0, 'oldest active slot is reused after exhaustion');
assert.equal(
  allocateConversationIdentityColorSlot([...fullPalette, at(0, 99)]),
  1,
  'a newly reused slot moves to the back of the reuse queue',
);
assert.equal(isConversationIdentityColorSlot(23), true);
assert.equal(isConversationIdentityColorSlot(24), false);
assert.equal(isConversationIdentityColorSlot(-1), false);

console.log('identityColor.test.ts: all tests passed');
