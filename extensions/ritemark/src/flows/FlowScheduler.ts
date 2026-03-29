import type { Disposable, ExtensionContext } from 'vscode';
import { FlowStorage } from './FlowStorage';
import { SCHEDULE_TICK_MS, getDueScheduledRun } from './flowSchedule';
import { FlowScheduleState, type FlowScheduleRuntimeState } from './FlowScheduleState';
import type { ExecutionResult, Flow } from './types';

interface FlowScheduleStateLike {
  get(flowPath: string): Promise<FlowScheduleRuntimeState>;
  update(
    flowPath: string,
    patch: Partial<FlowScheduleRuntimeState>
  ): Promise<FlowScheduleRuntimeState>;
}

interface FlowStorageLike {
  listFlows(): Promise<Flow[]>;
  getFlowPath(id: string): string;
}

type ExecuteFlowFn = (
  flow: Flow,
  inputs: Record<string, unknown>,
  workspacePath: string,
  onProgress?: (progress: {
    step: number;
    total: number;
    currentNode: string;
    currentNodeLabel?: string;
  }) => void,
  abortSignal?: AbortSignal
) => Promise<ExecutionResult>;

type IsFeatureEnabledFn = (flagId: 'scheduled-flow-runs') => boolean;

export interface FlowSchedulerDeps {
  storage: FlowStorageLike;
  scheduleState: FlowScheduleStateLike;
  executeFlowFn?: ExecuteFlowFn;
  isFeatureEnabled?: IsFeatureEnabledFn;
  onRuntimeStateChanged?: (flowId: string) => void | Promise<void>;
}

export interface ScheduledInputResult {
  inputs: Record<string, unknown> | null;
  error?: string;
}

export function buildScheduledInputs(flow: Flow): ScheduledInputResult {
  const inputs: Record<string, unknown> = {};

  for (const input of flow.inputs) {
    const hasDefault =
      typeof input.defaultValue === 'string' && input.defaultValue.length > 0;

    if (input.required && !hasDefault) {
      return {
        inputs: null,
        error: `Missing required input default: ${input.label}`,
      };
    }

    if (hasDefault) {
      inputs[input.id] = input.defaultValue!;
    }
  }

  return { inputs };
}

export class FlowScheduler implements Disposable {
  private readonly storage: FlowStorageLike;
  private readonly scheduleState: FlowScheduleStateLike;
  private readonly executeFlowFn: ExecuteFlowFn;
  private readonly isFeatureEnabled: IsFeatureEnabledFn;
  private readonly onRuntimeStateChanged?: (flowId: string) => void | Promise<void>;
  private readonly runningFlowIds = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickInFlight: Promise<void> | null = null;

  constructor(
    private readonly workspacePath: string,
    deps: FlowSchedulerDeps
  ) {
    this.storage = deps.storage;
    this.scheduleState = deps.scheduleState;
    this.executeFlowFn =
      deps.executeFlowFn ??
      (async () => {
        throw new Error(
          'FlowScheduler requires executeFlowFn when created outside createFlowScheduler().'
        );
      });
    this.isFeatureEnabled = deps.isFeatureEnabled ?? (() => false);
    this.onRuntimeStateChanged = deps.onRuntimeStateChanged;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, SCHEDULE_TICK_MS);
  }

  async tick(now: Date = new Date()): Promise<void> {
    if (this.tickInFlight) {
      return this.tickInFlight;
    }

    this.tickInFlight = this.runTick(now).finally(() => {
      this.tickInFlight = null;
    });
    return this.tickInFlight;
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runTick(now: Date): Promise<void> {
    if (!this.isFeatureEnabled('scheduled-flow-runs')) {
      return;
    }

    const flows = await this.storage.listFlows();
    for (const flow of flows) {
      await this.maybeRunFlow(flow, now);
    }
  }

  private async maybeRunFlow(flow: Flow, now: Date): Promise<void> {
    if (!flow.schedule?.enabled) {
      return;
    }

    const flowPath = this.storage.getFlowPath(flow.id);
    const runtimeState = await this.scheduleState.get(flowPath);
    const dueSlot = getDueScheduledRun(
      flow.schedule,
      now,
      runtimeState.lastScheduledFor
    );

    if (!dueSlot) {
      return;
    }

    const scheduledFor = dueSlot.toISOString();

    if (this.runningFlowIds.has(flow.id)) {
      await this.updateRuntimeState(flow.id, flowPath, {
        lastScheduledFor: scheduledFor,
        lastStatus: 'skipped',
        lastError: 'Skipped scheduled run because the flow is already running.',
      });
      return;
    }

    const inputResult = buildScheduledInputs(flow);
    if (!inputResult.inputs) {
      await this.updateRuntimeState(flow.id, flowPath, {
        lastScheduledFor: scheduledFor,
        lastStatus: 'skipped',
        lastError: inputResult.error ?? 'Scheduled flow is not eligible to run.',
      });
      return;
    }

    this.runningFlowIds.add(flow.id);
    await this.updateRuntimeState(flow.id, flowPath, {
      lastScheduledFor: scheduledFor,
      lastStatus: 'running',
      lastError: null,
    });

    try {
      const result = await this.executeFlowFn(
        flow,
        inputResult.inputs,
        this.workspacePath
      );

      await this.updateRuntimeState(flow.id, flowPath, {
        lastRunAt: new Date().toISOString(),
        lastStatus: result.success ? 'success' : 'error',
        lastError: result.success ? null : result.error ?? 'Scheduled flow failed.',
      });
    } catch (err) {
      await this.updateRuntimeState(flow.id, flowPath, {
        lastRunAt: new Date().toISOString(),
        lastStatus: 'error',
        lastError: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.runningFlowIds.delete(flow.id);
    }
  }

  private async updateRuntimeState(
    flowId: string,
    flowPath: string,
    patch: Partial<FlowScheduleRuntimeState>
  ): Promise<void> {
    await this.scheduleState.update(flowPath, patch);
    await this.onRuntimeStateChanged?.(flowId);
  }
}

export function createFlowScheduler(
  context: ExtensionContext,
  workspacePath: string,
  deps?: Pick<FlowSchedulerDeps, 'onRuntimeStateChanged'>
): FlowScheduler {
  const { isEnabled } =
    require('../features/featureGate') as typeof import('../features/featureGate');
  const { executeFlow } =
    require('./FlowExecutor') as typeof import('./FlowExecutor');
  const storage = new FlowStorage(workspacePath);
  const scheduleState = new FlowScheduleState(context.workspaceState);

  return new FlowScheduler(workspacePath, {
    storage,
    scheduleState,
    executeFlowFn: executeFlow,
    isFeatureEnabled: isEnabled,
    onRuntimeStateChanged: deps?.onRuntimeStateChanged,
  });
}
