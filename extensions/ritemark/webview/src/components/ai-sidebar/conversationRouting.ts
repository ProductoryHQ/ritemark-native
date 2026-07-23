/**
 * Sprint 99 (R5 / E2) — inbound message routing.
 *
 * Every host→webview message that concerns a conversation carries a top-level
 * `conversationId`. This module decides which conversation an inbound message
 * belongs to.
 *
 * The non-negotiable rule (spec R5): a message whose `conversationId` is UNKNOWN
 * to the store is dropped with a warning. It is never appended to the active
 * conversation — silently falling back to "whatever the user is looking at" is
 * precisely the misrouting bug this sprint exists to remove.
 */

/** Message types already warned about for a missing `conversationId`. */
const missingIdWarnedTypes = new Set<string>();

/** Test seam — clears the warn-once memo. */
export function resetConversationRoutingWarnings(): void {
  missingIdWarnedTypes.clear();
}

export interface RoutableMessage {
  type: string;
  conversationId?: string;
}

export interface RoutingContext {
  /** Ids the store currently knows about. */
  knownConversationIds: ReadonlySet<string> | Readonly<Record<string, unknown>>;
  activeConversationId: string | null;
}

function isKnown(ctx: RoutingContext, id: string): boolean {
  const known = ctx.knownConversationIds;
  return known instanceof Set
    ? known.has(id)
    : Object.prototype.hasOwnProperty.call(known, id);
}

/**
 * Resolve the conversation an inbound message targets.
 *
 * @returns the target conversation id, or `null` when the message must be dropped.
 */
export function resolveInboundConversationId(
  message: RoutableMessage,
  ctx: RoutingContext,
): string | null {
  const incoming = message.conversationId;

  if (typeof incoming === 'string' && incoming.length > 0) {
    if (isKnown(ctx, incoming)) return incoming;
    console.warn(
      `[ai-sidebar] Dropped "${message.type}" for unknown conversation "${incoming}". `
      + 'Refusing to misroute it to the active conversation (Sprint 99 R5).',
    );
    return null;
  }

  // Sprint 99 Phase 1: remove once all extension paths carry conversationId.
  // The extension host is migrating in parallel; until it has, a message with no
  // attribution belongs to the conversation the user is driving. Warn once per
  // message type so an un-migrated path is visible without flooding the console.
  if (!missingIdWarnedTypes.has(message.type)) {
    missingIdWarnedTypes.add(message.type);
    console.warn(
      `[ai-sidebar] "${message.type}" arrived without a conversationId — falling back to the `
      + 'active conversation. Sprint 99 Phase 1: remove once all extension paths carry conversationId.',
    );
  }
  return ctx.activeConversationId;
}
