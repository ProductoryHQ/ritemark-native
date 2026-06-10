import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { ScheduledTask, TaskContext, TaskResult, ScheduleConfig } from './ScheduledTask';
import { DaemonResultStore } from './DaemonResultStore';
import { DaemonStatusEvents } from './DaemonStatusEvents';
import { parseScheduleFromFrontmatter } from './scheduleParser';
import { AgentTaskHandler } from './handlers/AgentTaskHandler';
import { computeNextFire } from './cron';
import { isEnabled } from '../features/featureGate';

export interface RegisteredEntry {
  task: ScheduledTask;
  config: ScheduleConfig;
  filePath: string;
  nextFire: Date;
  timerId: ReturnType<typeof setTimeout>;
}

const TICK_INTERVAL_MS = 30_000; // re-evaluate every 30 s

// Agent files may live under either convention. Both are scanned at startup and
// watched for live changes.
const AGENT_DIRS = ['.claude/agents', '.agents'];
const AGENT_WATCH_GLOB = `{${AGENT_DIRS.join(',')}}/**/*.md`;

export class Scheduler {
  private readonly entries = new Map<string, RegisteredEntry>();
  private readonly running = new Set<string>(); // filePaths currently executing
  private tickTimer: ReturnType<typeof setInterval> | undefined;
  private watcher: vscode.FileSystemWatcher | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: DaemonResultStore,
    private readonly status: DaemonStatusEvents,
    private readonly workspacePath: string,
    private readonly onRunsChanged?: () => void
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

  /** Look up a registered entry by agent id (basename without .md). */
  getEntry(taskId: string): RegisteredEntry | undefined {
    for (const entry of this.entries.values()) {
      if (entry.task.id === taskId) return entry;
    }
    return undefined;
  }

  /** Register a task for a specific agent file path. */
  register(filePath: string, task: ScheduledTask): void {
    this.unregister(filePath);
    if (!task.schedule.enabled) {
      return;
    }
    const nextFire = computeNextFire(task.schedule.cron, new Date());
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
    // Defense in depth: if the flag was toggled off after start(), stop firing
    // and tear down so no scheduled run executes while the feature is disabled.
    if (!isEnabled('scheduled-tasks-daemon')) {
      this.stop();
      return;
    }
    // Skip if this task is already running — prevents a second headless runtime
    // for the same agent when a run outlasts its cron interval.
    if (this.running.has(filePath)) {
      const now = new Date().toISOString();
      const skipped: TaskResult = {
        taskId: entry.task.id,
        runId: crypto.randomUUID(),
        outcome: 'skipped',
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        skipReason: 'concurrent-run',
      };
      // Still re-arm the next fire so the schedule keeps ticking.
      const reNext = computeNextFire(entry.config.cron, new Date());
      if (reNext) {
        const reDelay = Math.max(0, reNext.getTime() - Date.now());
        const reTimer = setTimeout(() => this.fire(filePath), reDelay);
        this.entries.set(filePath, { ...entry, nextFire: reNext, timerId: reTimer });
      }
      await this.store.append(skipped);
      this.onRunsChanged?.();
      return;
    }
    // Re-arm next fire before running so a long run doesn't shift the schedule
    const nextFire = computeNextFire(entry.config.cron, new Date());
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

    this.running.add(filePath);
    let result: TaskResult;
    try {
      result = await entry.task.run(ctx);
    } finally {
      this.running.delete(filePath);
    }
    await this.store.append(result);
    this.onRunsChanged?.();

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
    for (const rel of AGENT_DIRS) {
      const agentsDir = path.join(this.workspacePath, ...rel.split('/'));
      if (!fs.existsSync(agentsDir)) {
        continue;
      }
      const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        this.reloadFile(path.join(agentsDir, file));
      }
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
      AGENT_WATCH_GLOB
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
  // Task factory — builds an AgentTaskHandler for an agent file.
  // ---------------------------------------------------------------------------

  private buildTaskForFile(filePath: string, config: ScheduleConfig): ScheduledTask {
    const id = path.basename(filePath, '.md');
    return new AgentTaskHandler(id, config, filePath);
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
}
