/**
 * Sprint 139 (R7, R8; #479): counting AI turns, with no text.
 *
 * Pure, with no `vscode` import: `posthog.ts` wires it to the one consent gate
 * and to globalState, and the tests drive it with fakes.
 *
 * - `first_message_sent` counts the profile's first message once it is saved
 *   (accepted), not before: a message that failed to save was never sent.
 * - `agent_used` counts each turn a person runs with an AI, once, when the
 *   turn ends, with its outcome. A continuation of the same turn (after an
 *   approval or a plan review) is not a new turn.
 * - `first_reply` follows `first_message_sent`: when the turn it counted ends,
 *   once per profile, with that turn's outcome. A turn that never ends (the
 *   window closed first) sends nothing, which the data reads as no reply.
 */

import type { EventPayloads, TurnOutcome, WelcomeProvider } from './events';

/** The agent families, as the welcome's events name them. */
export function agentFamily(runtimeId: string): WelcomeProvider | null {
  return runtimeId === 'claude-code' ? 'claude' : runtimeId === 'codex' ? 'chatgpt' : runtimeId === 'opencode' ? 'opencode' : null;
}

type CountedEvent = 'first_message_sent' | 'agent_used' | 'first_reply';

export interface TurnCountDeps {
  /** The consent gate's answer right now: usage data on and the kill switch not thrown. */
  maySend(): boolean;
  /** The profile's first message was counted already (a globalState marker). */
  firstMessageCounted(): boolean;
  /** Write that marker. Called only just before the event is sent. */
  markFirstMessageCounted(): Promise<void>;
  track<T extends CountedEvent>(name: T, properties: EventPayloads[T]): Promise<boolean>;
}

/** How many ended turns are remembered, so a continuation's end isn't counted twice. */
const REMEMBERED_TURNS = 500;

export class TurnCounter {
  private firstReplyTurn: string | null = null;
  private readonly endedTurns = new Set<string>();

  constructor(private readonly deps: TurnCountDeps) {}

  /**
   * A person's turn was saved and is about to run. `turnKey` names the turn
   * across its continuations (conversation and turn id).
   */
  async accepted(turnKey: string, runtimeId: string, continuation: boolean): Promise<void> {
    if (continuation) return;
    const provider = agentFamily(runtimeId);
    if (!provider || !this.deps.maySend() || this.deps.firstMessageCounted()) return;
    await this.deps.markFirstMessageCounted();
    this.firstReplyTurn = turnKey;
    await this.deps.track('first_message_sent', { provider });
  }

  /** A person's turn ended: completed, failed or stopped. */
  async ended(turnKey: string, runtimeId: string, source: 'chat' | 'flow', outcome: TurnOutcome): Promise<void> {
    const agent = agentFamily(runtimeId);
    if (!agent || this.endedTurns.has(turnKey)) return;
    this.endedTurns.add(turnKey);
    if (this.endedTurns.size > REMEMBERED_TURNS) {
      const oldest = this.endedTurns.values().next().value;
      if (oldest !== undefined) this.endedTurns.delete(oldest);
    }
    const isFirst = this.firstReplyTurn === turnKey;
    if (isFirst) this.firstReplyTurn = null;
    await this.deps.track('agent_used', { agent, source, outcome });
    if (isFirst) await this.deps.track('first_reply', { provider: agent, outcome });
  }

  /** Tests and diagnostics: the turn whose end sends `first_reply`, if any. */
  pendingFirstReply(): string | null {
    return this.firstReplyTurn;
  }
}
