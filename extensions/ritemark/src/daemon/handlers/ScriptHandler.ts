import type { ScheduledTask, TaskContext, TaskResult, TaskRunOptions, ScheduleConfig } from '../ScheduledTask';

/**
 * ScriptHandler — STUB (not wired into the Scheduler).
 *
 * Exists to prove the ScheduledTask abstraction is handler-agnostic: a future
 * sprint can schedule a shell script / build step by implementing run() here,
 * with no change to Scheduler.ts (which only depends on the ScheduledTask
 * interface). Until then run() throws so an accidental registration fails loudly
 * rather than silently doing nothing.
 *
 * TODO(future sprint): implement headless script execution under the same
 * AutoApprovalPolicy contract as AgentTaskHandler — see the daemon section of
 * docs/development/architecture.md.
 */
export class ScriptHandler implements ScheduledTask {
  readonly id: string;
  readonly schedule: ScheduleConfig;

  constructor(id: string, schedule: ScheduleConfig) {
    this.id = id;
    this.schedule = schedule;
  }

  async run(_ctx: TaskContext, _options?: TaskRunOptions): Promise<TaskResult> {
    throw new Error('ScriptHandler not implemented — reserved for a future sprint');
  }
}
