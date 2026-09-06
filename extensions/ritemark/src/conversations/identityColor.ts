export const CONVERSATION_IDENTITY_COLOR_FAMILY_COUNT = 8 as const;
export const CONVERSATION_IDENTITY_COLOR_VARIANT_COUNT = 3 as const;
export const CONVERSATION_IDENTITY_COLOR_SLOT_COUNT = (
  CONVERSATION_IDENTITY_COLOR_FAMILY_COUNT * CONVERSATION_IDENTITY_COLOR_VARIANT_COUNT
);

export interface ConversationIdentityColorOwner {
  identityColorSlot: number;
  lastActivityAt: string;
}

export function isConversationIdentityColorSlot(value: unknown): value is number {
  return Number.isSafeInteger(value)
    && (value as number) >= 0
    && (value as number) < CONVERSATION_IDENTITY_COLOR_SLOT_COUNT;
}

/**
 * Allocate every base hue before its variants, without repeating an exact slot
 * until the full palette is occupied. After exhaustion, reuse the slot whose
 * owners were active least recently; this keeps likely rail conversations
 * visually distinct while preserving one stable persisted slot per record.
 */
export function allocateConversationIdentityColorSlot(
  owners: readonly ConversationIdentityColorOwner[],
): number {
  const occupied = new Set(
    owners
      .map((owner) => owner.identityColorSlot)
      .filter(isConversationIdentityColorSlot),
  );
  for (let slot = 0; slot < CONVERSATION_IDENTITY_COLOR_SLOT_COUNT; slot += 1) {
    if (!occupied.has(slot)) return slot;
  }

  const newestActivityBySlot = Array.from(
    { length: CONVERSATION_IDENTITY_COLOR_SLOT_COUNT },
    () => Number.NEGATIVE_INFINITY,
  );
  for (const owner of owners) {
    if (!isConversationIdentityColorSlot(owner.identityColorSlot)) continue;
    const timestamp = Date.parse(owner.lastActivityAt);
    newestActivityBySlot[owner.identityColorSlot] = Math.max(
      newestActivityBySlot[owner.identityColorSlot],
      Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY,
    );
  }

  let selected = 0;
  for (let slot = 1; slot < newestActivityBySlot.length; slot += 1) {
    if (newestActivityBySlot[slot] < newestActivityBySlot[selected]) selected = slot;
  }
  return selected;
}
