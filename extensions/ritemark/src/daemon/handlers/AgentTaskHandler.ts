import * as fs from 'fs';
import * as crypto from 'crypto';
import type { ScheduledTask, TaskContext, TaskResult, TaskRunOptions, ScheduleConfig, BlockedActionDetail } from '../ScheduledTask';
import { DEFAULT_HEADLESS_POLICY } from '../ScheduledTask';
import type { RuntimeRegistry } from '../../runtime/RuntimeRegistry';
import type { UnifiedApprovalRequest, RuntimeTurnResult } from '../../runtime/AgentRuntime';

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

  async run(ctx: TaskContext, options?: TaskRunOptions): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    const runId = crypto.randomUUID();

    const registry = ctx.runtimeRegistry;
    if (!registry) {
      return this.skipped(runId, startedAt, 'agent-runtime-unavailable');
    }

    let runtime: Awaited<ReturnType<RuntimeRegistry['get']>> | undefined;
    try {
      runtime = registry.get('claude-code');
    } catch {
      return this.skipped(runId, startedAt, 'agent-runtime-unavailable');
    }

    const prompt = this.readPrompt();
    if (!prompt) {
      return this.skipped(runId, startedAt, 'empty-agent-file');
    }

    // Build one-time allow list from options + base policy
    const oneTimeAllowList = options?.oneTimeAllowList ?? [];

    let blockedAction: BlockedActionDetail | undefined;
    let turnResult: RuntimeTurnResult | undefined;
    let turnError: string | undefined;

    try {
      await runtime.start({
        workspacePath: ctx.workspacePath,
        onProgress: () => { /* headless — discard progress */ },
        onApprovalRequest: (req: UnifiedApprovalRequest) => {
          if (this.isAllowed(req, oneTimeAllowList)) {
            runtime!.respondToApproval(req.requestId, true, false);
            return;
          }
          // First blocked action wins — record it and reject
          if (!blockedAction) {
            blockedAction = this.toBlockedDetail(req);
          }
          runtime!.respondToApproval(req.requestId, false, false);
        },
        onComplete: (result: RuntimeTurnResult) => {
          turnResult = result;
        },
      });

      await runtime.prompt({ prompt, timeoutMinutes: 10 });
    } catch (err) {
      turnError = err instanceof Error ? err.message : String(err);
    } finally {
      runtime.dispose();
    }

    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

    if (turnError) {
      return {
        taskId: this.id,
        runId,
        outcome: 'errored',
        startedAt,
        finishedAt,
        durationMs,
        errorMessage: turnError,
      };
    }

    if (blockedAction) {
      return {
        taskId: this.id,
        runId,
        outcome: 'blocked',
        startedAt,
        finishedAt,
        durationMs,
        blockedAction,
        outputFirstLine: this.firstLine(turnResult?.text),
      };
    }

    return {
      taskId: this.id,
      runId,
      outcome: 'completed',
      startedAt,
      finishedAt,
      durationMs,
      outputFirstLine: this.firstLine(turnResult?.text),
    };
  }

  // ---------------------------------------------------------------------------

  private readPrompt(): string | undefined {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      // Strip YAML frontmatter (--- ... ---)
      const stripped = raw.replace(/^---[\s\S]*?---\n?/, '').trim();
      return stripped || undefined;
    } catch {
      return undefined;
    }
  }

  private isAllowed(req: UnifiedApprovalRequest, oneTimeAllowList: Array<{ kind: string; target: string }>): boolean {
    if (req.kind === 'plan') return true;
    if (req.kind === 'file-write') {
      if (this.autoApprovalPolicy.allowFileWrites) return true;
      const target = req.filePath ?? '';
      return oneTimeAllowList.some(e => e.kind === 'file-write' && e.target === target);
    }
    if (req.kind === 'shell-command') {
      if (this.autoApprovalPolicy.allowShellCommands) return true;
      const target = req.command ?? '';
      return oneTimeAllowList.some(e => e.kind === 'shell-command' && e.target === target);
    }
    // 'permission' — always blocked in headless mode
    return false;
  }

  private toBlockedDetail(req: UnifiedApprovalRequest): BlockedActionDetail {
    if (req.kind === 'file-write') {
      return { kind: 'file-write', target: req.filePath ?? '' };
    }
    return { kind: 'shell-command', target: req.command ?? req.permissionLabel ?? '' };
  }

  private firstLine(text?: string): string | undefined {
    if (!text) return undefined;
    const line = text.split('\n')[0].trim();
    return line || undefined;
  }

  private skipped(runId: string, startedAt: string, reason: string): TaskResult {
    return {
      taskId: this.id,
      runId,
      outcome: 'skipped',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      skipReason: reason,
    };
  }
}
