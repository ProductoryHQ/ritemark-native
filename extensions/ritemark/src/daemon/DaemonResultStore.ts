import type { Memento } from 'vscode';
import type { TaskResult } from './ScheduledTask';

const STORE_KEY = 'daemon:runHistory';
const MAX_RESULTS_PER_TASK = 10;

export class DaemonResultStore {
  constructor(private readonly state: Memento) {}

  async getAll(taskId: string): Promise<TaskResult[]> {
    const all = this.state.get<Record<string, TaskResult[]>>(STORE_KEY, {});
    return all[taskId] ?? [];
  }

  /** All runs across every task, most-recent first, capped for display. */
  getAllRuns(limit = 10): TaskResult[] {
    const all = this.state.get<Record<string, TaskResult[]>>(STORE_KEY, {});
    const flat = Object.values(all).flat();
    flat.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return flat.slice(0, limit);
  }

  async getBlockedResult(taskId: string, runId: string): Promise<TaskResult | undefined> {
    const results = await this.getAll(taskId);
    return results.find(r => r.runId === runId && r.outcome === 'blocked');
  }

  async append(result: TaskResult): Promise<void> {
    const all = this.state.get<Record<string, TaskResult[]>>(STORE_KEY, {});
    const existing = all[result.taskId] ?? [];
    const trimmed = [result, ...existing].slice(0, MAX_RESULTS_PER_TASK);
    await this.state.update(STORE_KEY, { ...all, [result.taskId]: trimmed });
  }

  /** Mark an existing result as superseded by a newer run. */
  async supersede(taskId: string, runId: string, supersededBy: string): Promise<void> {
    const all = this.state.get<Record<string, TaskResult[]>>(STORE_KEY, {});
    const existing = all[taskId] ?? [];
    const updated = existing.map(r =>
      r.runId === runId ? { ...r, supersededBy } : r
    );
    await this.state.update(STORE_KEY, { ...all, [taskId]: updated });
  }

  async clearAll(): Promise<void> {
    await this.state.update(STORE_KEY, {});
  }
}
