import type * as vscode from 'vscode';
import type { RuntimeRegistry } from '../runtime/RuntimeRegistry';

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface TaskContext {
  workspacePath: string;
  extensionContext: vscode.ExtensionContext;
  /** Live registry provided by the extension host (undefined until wired). */
  runtimeRegistry?: RuntimeRegistry;
}

export type TaskOutcome = 'completed' | 'blocked' | 'errored' | 'skipped' | 'missed';

export interface BlockedActionDetail {
  kind: 'file-write' | 'shell-command';
  target: string;
}

export interface TaskResult {
  taskId: string;
  runId: string;
  outcome: TaskOutcome;
  startedAt: string;       // ISO 8601
  finishedAt: string;      // ISO 8601
  durationMs: number;
  outputFirstLine?: string;
  blockedAction?: BlockedActionDetail;
  skipReason?: string;
  errorMessage?: string;
  supersededBy?: string;   // runId of the result that replaced this one
}

// ---------------------------------------------------------------------------
// Auto-approval policy
// ---------------------------------------------------------------------------

export interface AutoApprovalPolicy {
  allowFileReads: boolean;
  allowFileWrites: boolean;
  allowShellCommands: boolean;
  /** One-time allow-list applied to a single re-run (inline approval). */
  oneTimeAllowList?: RunAllowListEntry[];
}

export interface RunAllowListEntry {
  kind: 'file-write' | 'shell-command';
  target: string;
}

export const DEFAULT_HEADLESS_POLICY: AutoApprovalPolicy = {
  allowFileReads: true,
  allowFileWrites: false,
  allowShellCommands: false,
};

// ---------------------------------------------------------------------------
// ScheduledTask interface — the load-bearing abstraction
// ---------------------------------------------------------------------------

export interface ScheduledTask {
  readonly id: string;
  readonly schedule: ScheduleConfig;
  run(ctx: TaskContext, options?: TaskRunOptions): Promise<TaskResult>;
  readonly autoApprovalPolicy?: AutoApprovalPolicy;
}

export interface ScheduleConfig {
  cron: string;
  label: string;
  enabled: boolean;
}

export interface TaskRunOptions {
  /** Allow-list entries for this run only (inline approval re-run). */
  oneTimeAllowList?: RunAllowListEntry[];
}
