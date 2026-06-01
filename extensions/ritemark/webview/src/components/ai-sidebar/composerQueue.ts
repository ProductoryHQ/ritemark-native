/**
 * Composer queue logic (Sprint 74, R2 / issue #82).
 *
 * Pure decision functions for the "queue next prompt while agent runs" flow,
 * extracted from ChatInput so they can be regression-tested without React.
 *
 * Flow:
 *  1. Agent is running → composer stays unlocked → user types and presses Enter
 *  2. shouldQueueInsteadOfSend → prompt is parked in local queue state (notch UI)
 *  3. Agent finishes → shouldAutoSendQueuedPrompt fires on the running→idle
 *     transition → queued prompt is sent as the next turn
 */

export interface QueueSendContext {
  /** Agent (Claude Code / Codex) is currently running or chat is streaming */
  isLoading: boolean;
  /** Composer is in agent mode (Claude Code or Codex selected) */
  isAgentMode: boolean;
  /** The send call carries an explicit override prompt (auto-send path) */
  hasOverridePrompt: boolean;
}

/**
 * Decide whether a send action should park the prompt in the queue instead of
 * sending it immediately. True only while an agent run is in flight and the
 * call is a user-initiated send (not the auto-send of an already-queued prompt).
 */
export function shouldQueueInsteadOfSend(ctx: QueueSendContext): boolean {
  return ctx.isLoading && ctx.isAgentMode && !ctx.hasOverridePrompt;
}

export interface QueueAutoSendContext {
  /** agentRunning value before the latest store update */
  wasRunning: boolean;
  /** agentRunning value after the latest store update */
  isRunning: boolean;
  /** Currently queued prompt, if any */
  queuedPrompt: string | null;
}

/**
 * Decide whether the queued prompt should auto-send now. Fires exactly on the
 * running → idle transition and only when something is queued. This prevents
 * double-sends (idle → idle re-renders) and premature sends (running → running).
 */
export function shouldAutoSendQueuedPrompt(ctx: QueueAutoSendContext): boolean {
  return ctx.wasRunning && !ctx.isRunning && !!ctx.queuedPrompt && ctx.queuedPrompt.trim().length > 0;
}
