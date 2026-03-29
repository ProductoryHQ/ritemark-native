import type { Memento } from 'vscode';

export type FlowScheduleRunStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'skipped';

export interface FlowScheduleRuntimeState {
  lastRunAt: string | null;
  lastScheduledFor: string | null;
  lastStatus: FlowScheduleRunStatus;
  lastError: string | null;
}

const DEFAULT_STATE: FlowScheduleRuntimeState = {
  lastRunAt: null,
  lastScheduledFor: null,
  lastStatus: 'idle',
  lastError: null,
};

export class FlowScheduleState {
  constructor(private readonly workspaceState: Memento) {}

  private getKey(flowPath: string): string {
    return `flowScheduleState:${flowPath}`;
  }

  async get(flowPath: string): Promise<FlowScheduleRuntimeState> {
    return this.workspaceState.get<FlowScheduleRuntimeState>(
      this.getKey(flowPath),
      DEFAULT_STATE
    );
  }

  async update(
    flowPath: string,
    patch: Partial<FlowScheduleRuntimeState>
  ): Promise<FlowScheduleRuntimeState> {
    const nextState = {
      ...(await this.get(flowPath)),
      ...patch,
    };
    await this.workspaceState.update(this.getKey(flowPath), nextState);
    return nextState;
  }

  async clear(flowPath: string): Promise<void> {
    await this.workspaceState.update(this.getKey(flowPath), undefined);
  }
}
