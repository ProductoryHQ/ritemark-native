import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { ScheduledTask, TaskContext, TaskResult, ScheduleConfig } from './ScheduledTask';
import { DaemonResultStore } from './DaemonResultStore';
import { DaemonStatusEvents } from './DaemonStatusEvents';
import { parseScheduleFromFrontmatter } from './scheduleParser';

interface RegisteredEntry {
  task: ScheduledTask;
  config: ScheduleConfig;
  filePath: string;
  nextFire: Date;
  timerId: ReturnType<typeof setTimeout>;
}

const TICK_INTERVAL_MS = 30_000; // re-evaluate every 30 s

export class Scheduler {
  private readonly entries = new Map<string, RegisteredEntry>();
  private tickTimer: ReturnType<typeof setInterval> | undefined;
  private watcher: vscode.FileSystemWatcher | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: DaemonResultStore,
    private readonly status: DaemonStatusEvents,
    private readonly workspacePath: string
  ) {}

  start(): void {
    this.scanWorkspace();
    this.watchAgentFiles();
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  stop(): void {
    if (this.tickTimer !== undefined) {
      clearInterval(this.tickTimer);
    }
    for (const entry of this.entries.values()) {
      clearTimeout(entry.timerId);
    }
    this.entries.clear();
    this.watcher?.dispose();
    this.status.setScheduledCount(0);
  }

  /** Register a task for a specific agent file path. */
  register(filePath: string, task: ScheduledTask): void {
    this.unregister(filePath);
    if (!task.schedule.enabled) {
      return;
    }
    const nextFire = this.computeNext(task.schedule.cron);
    if (!nextFire) {
      return;
    }
    const delay = Math.max(0, nextFire.getTime() - Date.now());
    const timerId = setTimeout(() => this.fire(filePath), delay);
    this.entries.set(filePath, { task, config: task.schedule, filePath, nextFire, timerId });
    this.status.setScheduledCount(this.entries.size);
  }

  unregister(filePath: string): void {
    const existing = this.entries.get(filePath);
    if (existing) {
      clearTimeout(existing.timerId);
      this.entries.delete(filePath);
      this.status.setScheduledCount(this.entries.size);
    }
  }

  private async fire(filePath: string): Promise<void> {
    const entry = this.entries.get(filePath);
    if (!entry) {
      return;
    }
    // Re-arm next fire before running so a long run doesn't shift the schedule
    const nextFire = this.computeNext(entry.config.cron);
    if (nextFire) {
      const delay = Math.max(0, nextFire.getTime() - Date.now());
      const timerId = setTimeout(() => this.fire(filePath), delay);
      this.entries.set(filePath, { ...entry, nextFire, timerId });
    } else {
      this.entries.delete(filePath);
      this.status.setScheduledCount(this.entries.size);
    }

    const ctx: TaskContext = {
      workspacePath: this.workspacePath,
      extensionContext: this.context,
    };

    const label = entry.config.label || path.basename(filePath, '.md');
    this.status.emitRunStarted(label);

    const result = await entry.task.run(ctx);
    await this.store.append(result);

    switch (result.outcome) {
      case 'completed':
        this.status.emitRunCompleted(entry.task.id, result.runId, result);
        break;
      case 'blocked':
        this.status.emitRunBlocked(entry.task.id, result.runId, result);
        break;
      case 'errored':
        this.status.emitRunErrored(entry.task.id, result);
        break;
      default:
        // skipped / missed — refresh idle state
        this.status.setScheduledCount(this.entries.size);
    }
  }

  // ---------------------------------------------------------------------------
  // Workspace scanning
  // ---------------------------------------------------------------------------

  private scanWorkspace(): void {
    if (!this.workspacePath) {
      return;
    }
    const agentsDir = path.join(this.workspacePath, '.claude', 'agents');
    if (!fs.existsSync(agentsDir)) {
      return;
    }
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      this.reloadFile(path.join(agentsDir, file));
    }
  }

  private reloadFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = parseScheduleFromFrontmatter(content);
      if (!config) {
        this.unregister(filePath);
        return;
      }
      const task = this.buildTaskForFile(filePath, config);
      this.register(filePath, task);
    } catch {
      this.unregister(filePath);
    }
  }

  private watchAgentFiles(): void {
    const agentsPattern = new vscode.RelativePattern(
      this.workspacePath,
      '.claude/agents/**/*.md'
    );
    this.watcher = vscode.workspace.createFileSystemWatcher(agentsPattern);
    const reload = (uri: vscode.Uri) => this.reloadFile(uri.fsPath);
    const remove = (uri: vscode.Uri) => this.unregister(uri.fsPath);
    this.watcher.onDidChange(reload);
    this.watcher.onDidCreate(reload);
    this.watcher.onDidDelete(remove);
    this.context.subscriptions.push(this.watcher);
  }

  // ---------------------------------------------------------------------------
  // Task factory — builds a minimal ScheduledTask for an agent file.
  // The AgentTaskHandler (Sprint 79-gated) will replace this with a real impl.
  // ---------------------------------------------------------------------------

  private buildTaskForFile(filePath: string, config: ScheduleConfig): ScheduledTask {
    const id = path.basename(filePath, '.md');
    const schedule = config;
    // [S79] AgentTaskHandler wired here after Sprint 79 merges.
    // Until then, produce a skipped result.
    return {
      id,
      schedule,
      async run(_ctx): Promise<TaskResult> {
        const now = new Date().toISOString();
        return {
          taskId: id,
          runId: crypto.randomUUID(),
          outcome: 'skipped',
          startedAt: now,
          finishedAt: now,
          durationMs: 0,
          skipReason: 'agent-runtime-unavailable',
        };
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Cron helpers (minimal — no external dep)
  // ---------------------------------------------------------------------------

  private tick(): void {
    // Re-evaluate missed fires (e.g. system sleep)
    for (const [filePath, entry] of this.entries) {
      if (Date.now() >= entry.nextFire.getTime()) {
        clearTimeout(entry.timerId);
        this.fire(filePath);
      }
    }
  }

  /**
   * Compute the next fire time for a 5-field cron expression.
   * Minimal implementation: scans forward minute-by-minute up to 1 year.
   */
  private computeNext(expr: string): Date | undefined {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) {
      return undefined;
    }
    const [minPart, hourPart, domPart, monPart, dowPart] = parts;

    const now = new Date();
    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1); // start from next minute

    const limit = new Date(now);
    limit.setFullYear(limit.getFullYear() + 1);

    while (candidate < limit) {
      if (
        matchField(candidate.getMinutes(), minPart, 0, 59) &&
        matchField(candidate.getHours(), hourPart, 0, 23) &&
        matchField(candidate.getDate(), domPart, 1, 31) &&
        matchField(candidate.getMonth() + 1, monPart, 1, 12) &&
        matchField(candidate.getDay(), dowPart, 0, 6)
      ) {
        return candidate;
      }
      candidate.setMinutes(candidate.getMinutes() + 1);
    }
    return undefined;
  }
}

function matchField(value: number, expr: string, min: number, max: number): boolean {
  if (expr === '*') {
    return true;
  }
  for (const part of expr.split(',')) {
    if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      const [lo, hi] = range === '*'
        ? [min, max]
        : range.split('-').map(Number);
      if (value >= lo && value <= hi && (value - lo) % step === 0) {
        return true;
      }
    } else if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      if (value >= lo && value <= hi) {
        return true;
      }
    } else {
      if (parseInt(part, 10) === value) {
        return true;
      }
    }
  }
  return false;
}
