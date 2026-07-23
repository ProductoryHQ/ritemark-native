import * as fs from 'fs';
import * as crypto from 'crypto';
import type { ScheduledTask, TaskContext, TaskResult, TaskRunOptions, ScheduleConfig, BlockedActionDetail } from '../ScheduledTask';
import { DEFAULT_HEADLESS_POLICY } from '../ScheduledTask';
import type { AgentId } from '../../agent/types';
import { createRuntime } from '../../runtime/runtimeFactory';
import type { UnifiedApprovalRequest, RuntimeTurnResult, RuntimeSession } from '../../runtime/AgentRuntime';

/**
 * AgentTaskHandler — runs an agent .md file headlessly via a fresh AgentRuntime.
 *
 * Headless session contract (Sprint 80, technical-plan.md, Jarmo decision #2):
 * each run creates its OWN runtime instance (via createRuntime) with a NEW
 * session. It never borrows the shared RuntimeRegistry the interactive sidebar
 * uses — a background run must not clobber the user's live conversation or its
 * approval mode. The runtime is disposed when the run ends.
 *
 * The instance is built through the runtime factory against the AgentRuntime
 * interface, so headless execution is runtime-agnostic by construction.
 * `runtimeId` defaults to 'claude-code' (the verified headless path); pointing
 * a scheduled task at another runtime is a constructor argument, not a rewrite.
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
  private readonly runtimeId: AgentId;

  constructor(id: string, schedule: ScheduleConfig, filePath: string, runtimeId: AgentId = 'claude-code') {
    this.id = id;
    this.schedule = schedule;
    this.filePath = filePath;
    this.runtimeId = runtimeId;
  }

  async run(ctx: TaskContext, options?: TaskRunOptions): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    const runId = crypto.randomUUID();

    const prompt = this.readPrompt();
    if (!prompt) {
      return this.skipped(runId, startedAt, 'empty-agent-file');
    }

    // Fresh, isolated runtime per run — never the shared interactive instance.
    // Built through the factory against the AgentRuntime interface; whether the
    // runtime is actually usable (installed / signed in) is checked by start()
    // below, which returns an 'agent-runtime-unavailable' skip on failure.
    const runtime = createRuntime(this.runtimeId);

    const oneTimeAllowList = options?.oneTimeAllowList ?? [];
    let blockedAction: BlockedActionDetail | undefined;
    let turnResult: RuntimeTurnResult | undefined;

    // Assigned before any approval can arrive — approvals only fire during
    // prompt(), which runs after createSession() has resolved.
    let session: RuntimeSession | undefined;

    try {
      try {
        session = await runtime.createSession(runId, {
          workspacePath: ctx.workspacePath,
          // 'ask' is required: 'auto' uses bypassPermissions and the SDK would
          // silently auto-approve writes/shell, defeating the headless policy.
          approvalMode: 'ask',
          onProgress: () => { /* headless — discard progress */ },
          onApprovalRequest: (req: UnifiedApprovalRequest) => {
            if (this.isAllowed(req, oneTimeAllowList)) {
              session?.respondToApproval(req.requestId, true, false);
              return;
            }
            if (!blockedAction) {
              blockedAction = this.toBlockedDetail(req);
            }
            session?.respondToApproval(req.requestId, false, false);
          },
          // prompt() never throws — turn errors arrive here with an `error` field.
          onComplete: (result: RuntimeTurnResult) => {
            turnResult = result;
          },
        });
      } catch (err) {
        // createSession() throws only when Claude Code isn't installed / signed in.
        return this.skipped(runId, startedAt, 'agent-runtime-unavailable',
          err instanceof Error ? err.message : String(err));
      }

      await session.prompt({ prompt, timeoutMinutes: 10 });
    } finally {
      // The daemon builds a fresh runtime per run, so disposing the runtime
      // disposes its only session too.
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
