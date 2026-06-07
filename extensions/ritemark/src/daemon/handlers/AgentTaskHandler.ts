import * as crypto from 'crypto';
import type { ScheduledTask, TaskContext, TaskResult, TaskRunOptions, ScheduleConfig } from '../ScheduledTask';
import { DEFAULT_HEADLESS_POLICY } from '../ScheduledTask';

/**
 * AgentTaskHandler — implements ScheduledTask by running a headless AgentRuntime session.
 *
 * [S79] This handler requires Sprint 79's AgentRuntime interface. The guard below
 * checks for RuntimeRegistry at activation time. If absent, every run returns a
 * 'skipped' result with reason 'agent-runtime-unavailable'.
 *
 * Wire the real implementation here after Sprint 79 merges into main and
 * AgentRuntime + RuntimeRegistry are importable from '../runtime/'.
 */
export class AgentTaskHandler implements ScheduledTask {
  readonly id: string;
  readonly schedule: ScheduleConfig;
  readonly autoApprovalPolicy = DEFAULT_HEADLESS_POLICY;

  private readonly filePath: string;

  constructor(id: string, schedule: ScheduleConfig, filePath: string) {
    this.id = id;
    this.schedule = schedule;
    this.filePath = filePath;
  }

  async run(_ctx: TaskContext, options?: TaskRunOptions): Promise<TaskResult> {
    const now = new Date().toISOString();
    const runId = crypto.randomUUID();

    // [S79] Guard: check if AgentRuntime is available
    if (!this.isAgentRuntimeAvailable()) {
      return {
        taskId: this.id,
        runId,
        outcome: 'skipped',
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        skipReason: 'agent-runtime-unavailable',
      };
    }

    // [S79] TODO: implement headless AgentRuntime session
    // 1. Resolve runtime via RuntimeRegistry.get('claude-code')
    // 2. Build RuntimeSessionConfig with autoApprovalPolicy + options?.oneTimeAllowList
    // 3. Call runtime.start(config) then runtime.prompt({ prompt: fileContent })
    // 4. Collect output, translate blocked/error outcomes to TaskResult
    // 5. Call runtime.dispose()

    const startedAt = new Date().toISOString();
    return {
      taskId: this.id,
      runId,
      outcome: 'skipped',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      skipReason: 'agent-runtime-unavailable',
    };
  }

  private isAgentRuntimeAvailable(): boolean {
    try {
      // [S79] Replace with: return RuntimeRegistry !== undefined
      // For now always returns false until Sprint 79 merges.
      require('../runtime/RuntimeRegistry');
      return true;
    } catch {
      return false;
    }
  }
}
