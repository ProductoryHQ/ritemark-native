/**
 * AgentDaemon — schedules agent runs using cron expressions.
 *
 * Sprint 79: instantiated and registered as a disposable but NOT activated.
 * No entries are registered in this sprint; the UI wiring happens in Sprint 80.
 *
 * Design:
 *  - One `setInterval` per daemon instance (not per entry) fires every minute.
 *  - On each tick, `isDue()` checks whether the previous cron slot falls within
 *    the GRACE_MS window and has not already been executed.
 *  - When due, `runEntry()` is fired asynchronously (fire-and-forget) so the
 *    tick does not block waiting for agents to complete.
 *  - Headless approval policy: file-write, shell-command, and permission
 *    requests are auto-rejected via `respondToApproval(false)`.  Only plan
 *    notifications are auto-approved.
 */

import parser from 'cron-parser';
import type { Disposable } from 'vscode';
import type { AgentId } from '../agent/types';
import type { RuntimeRegistry } from '../runtime/RuntimeRegistry';
import type { UnifiedApprovalRequest } from '../runtime/AgentRuntime';
import { createHeadlessTurnConfig } from './DaemonSession';
import { DaemonStatusEvents } from './DaemonStatusEvents';

/** How often the daemon checks whether any entries are due. */
const TICK_MS = 60_000;

/**
 * Grace window: the daemon considers a cron slot "due" if the previous slot
 * falls within this many milliseconds before now.  5 minutes matches
 * FlowScheduler's SCHEDULE_GRACE_MS and tolerates tick jitter or a late
 * extension-host start.
 */
const GRACE_MS = 5 * 60_000;

interface DaemonEntry {
  agentId: AgentId;
  cronExpression: string;
  workspacePath: string;
  lastRunAt?: Date;
}

export class AgentDaemon implements Disposable {
  private readonly entries = new Map<AgentId, DaemonEntry>();
  private readonly runningIds = new Set<AgentId>();
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * @param registry  Runtime registry used to look up the AgentRuntime for
   *                  each scheduled agent.
   * @param statusEvents  Optional event logger (omit in unit tests to avoid
   *                      importing vscode).
   */
  constructor(
    private readonly registry: RuntimeRegistry,
    private readonly statusEvents?: DaemonStatusEvents
  ) {}

  /**
   * Register an agent for recurring execution.
   * Starts the internal timer if it is not already running.
   */
  register(agentId: AgentId, cronExpression: string, workspacePath: string): void {
    this.entries.set(agentId, { agentId, cronExpression, workspacePath });
    if (!this.timer) {
      this.timer = setInterval(() => {
        void this.tick();
      }, TICK_MS);
    }
  }

  /**
   * Remove a previously registered agent.
   * Stops the internal timer when no entries remain.
   */
  unregister(agentId: AgentId): void {
    this.entries.delete(agentId);
    if (this.entries.size === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Check all registered entries and fire any that are due.
   * Exposed as `public` so tests can drive the daemon without relying on
   * real wall-clock intervals.
   */
  async tick(now: Date = new Date()): Promise<void> {
    for (const entry of this.entries.values()) {
      if (this.isDue(entry, now)) {
        void this.runEntry(entry, now);
      }
    }
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.statusEvents?.dispose();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns true when the cron expression's most recent slot before `now`
   * falls within GRACE_MS and has not been executed yet for that slot.
   */
  private isDue(entry: DaemonEntry, now: Date): boolean {
    try {
      const interval = parser.parseExpression(entry.cronExpression, {
        currentDate: now,
      });
      const prevSlot = interval.prev().toDate();
      const slotAge = now.getTime() - prevSlot.getTime();

      if (slotAge < 0 || slotAge > GRACE_MS) {
        return false;
      }
      if (!entry.lastRunAt) {
        return true;
      }
      return entry.lastRunAt.getTime() < prevSlot.getTime();
    } catch {
      // Malformed cron expression — skip silently.
      return false;
    }
  }

  /**
   * Execute one scheduled run for the given entry.
   * Headless policy: file-write, shell-command, and permission approval
   * requests are auto-rejected; plan notifications are auto-approved.
   */
  private async runEntry(entry: DaemonEntry, triggerTime: Date): Promise<void> {
    if (this.runningIds.has(entry.agentId)) {
      return;
    }
    this.runningIds.add(entry.agentId);

    const prompt = `Scheduled daemon run at ${triggerTime.toISOString()}`;
    this.statusEvents?.logRunStart(entry.agentId, prompt);

    let success = false;
    try {
      const runtime = this.registry.get(entry.agentId);

      await runtime.start({
        workspacePath: entry.workspacePath,
        onProgress: () => {
          // Progress events are intentionally discarded in headless mode.
        },
        onApprovalRequest: (req: UnifiedApprovalRequest) => {
          if (
            req.kind === 'file-write' ||
            req.kind === 'shell-command' ||
            req.kind === 'permission'
          ) {
            this.statusEvents?.logApprovalBlocked(
              entry.agentId,
              req.kind,
              req.filePath ?? req.command ?? req.permissionLabel ?? '(unknown)'
            );
            runtime.respondToApproval(req.requestId, false, false);
          } else {
            // 'plan' — auto-approve so the agent can proceed with read-only work.
            runtime.respondToApproval(req.requestId, true, false);
          }
        },
      });

      const turn = createHeadlessTurnConfig(prompt, entry.workspacePath);
      await runtime.prompt(turn);

      entry.lastRunAt = triggerTime;
      success = true;
    } catch (err) {
      console.error(`[AgentDaemon] Run failed for ${entry.agentId}:`, err);
    } finally {
      this.runningIds.delete(entry.agentId);
      this.statusEvents?.logRunComplete(entry.agentId, success);
    }
  }
}
