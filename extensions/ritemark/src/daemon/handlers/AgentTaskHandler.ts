import * as fs from 'fs';
import * as crypto from 'crypto';
import type { ScheduledTask, TaskContext, TaskResult, TaskRunOptions, ScheduleConfig, BlockedActionDetail } from '../ScheduledTask';
import { DEFAULT_HEADLESS_POLICY } from '../ScheduledTask';
import type { UnifiedApprovalRequest, RuntimeTurnResult } from '../../runtime/AgentRuntime';

/**
 * AgentTaskHandler — runs an agent .md file headlessly via a fresh AgentRuntime.
 *
 * Headless session contract (Sprint 80, technical-plan.md, Jarmo decision #2):
 * each run creates its OWN ClaudeCodeRuntime instance with a NEW session. It
 * never borrows the shared RuntimeRegistry the interactive sidebar uses — a
 * background run must not clobber the user's live conversation or its approval
 * mode. The runtime is disposed when the run ends.
 *
 * Approval policy: the runtime is started in 'ask' mode so the SDK surfaces an
 * approval callback for every Write/Edit/Bash. Reads proceed automatically. The
 * handler auto-rejects file-writes and shell-commands (recording the first as a
 * blocked action) unless they appear in the per-run one-time allow-list passed
 * from an inline approval re-run.
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

  async run(ctx: TaskContext, options?: TaskRunOptions): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    const runId = crypto.randomUUID();

    const prompt = this.readPrompt();
    if (!prompt) {
      return this.skipped(runId, startedAt, 'empty-agent-file');
    }

    // Fresh, isolated runtime per run — never the shared interactive instance.
    let ClaudeCodeRuntime: typeof import('../../agent/ClaudeCodeRuntime').ClaudeCodeRuntime;
    try {
      ({ ClaudeCodeRuntime } = await import('../../agent/ClaudeCodeRuntime'));
    } catch {
      return this.skipped(runId, startedAt, 'agent-runtime-unavailable');
    }
    const runtime = new ClaudeCodeRuntime();

    const oneTimeAllowList = options?.oneTimeAllowList ?? [];
    let blockedAction: BlockedActionDetail | undefined;
    let turnResult: RuntimeTurnResult | undefined;

    try {
      try {
        await runtime.start({
          workspacePath: ctx.workspacePath,
          // 'ask' is required: 'auto' uses bypassPermissions and the SDK would
          // silently auto-approve writes/shell, defeating the headless policy.
          approvalMode: 'ask',
          onProgress: () => { /* headless — discard progress */ },
          onApprovalRequest: (req: UnifiedApprovalRequest) => {
            if (this.isAllowed(req, oneTimeAllowList)) {
              runtime.respondToApproval(req.requestId, true, false);
              return;
            }
            if (!blockedAction) {
              blockedAction = this.toBlockedDetail(req);
            }
            runtime.respondToApproval(req.requestId, false, false);
          },
          // prompt() never throws — turn errors arrive here with an `error` field.
          onComplete: (result: RuntimeTurnResult) => {
            turnResult = result;
          },
        });
      } catch (err) {
        // start() throws only when Claude Code isn't installed / signed in.
        return this.skipped(runId, startedAt, 'agent-runtime-unavailable',
          err instanceof Error ? err.message : String(err));
      }

      await runtime.prompt({ prompt, timeoutMinutes: 10 });
    } finally {
      runtime.dispose();
    }

    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    const base = { taskId: this.id, runId, startedAt, finishedAt, durationMs };

    // prompt() surfaces turn failures through onComplete({ error }), not by throwing.
    if (turnResult?.error) {
      return { ...base, outcome: 'errored', errorMessage: turnResult.error };
    }

    if (blockedAction) {
      return {
        ...base,
        outcome: 'blocked',
        blockedAction,
        outputFirstLine: this.firstLine(turnResult?.text),
      };
    }

    return {
      ...base,
      outcome: 'completed',
      outputFirstLine: this.firstLine(turnResult?.text),
    };
  }

  // ---------------------------------------------------------------------------

  private readPrompt(): string | undefined {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      // Strip leading YAML frontmatter (--- ... ---); the body is the prompt.
      const stripped = raw.replace(/^---[\s\S]*?\n---\n?/, '').trim();
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

  private skipped(runId: string, startedAt: string, reason: string, detail?: string): TaskResult {
    return {
      taskId: this.id,
      runId,
      outcome: 'skipped',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      skipReason: reason,
      ...(detail ? { errorMessage: detail } : {}),
    };
  }
}
