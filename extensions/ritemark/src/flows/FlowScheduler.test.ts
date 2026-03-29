/**
 * Unit tests for scheduled flow runtime orchestration.
 * Run: npx tsx src/flows/FlowScheduler.test.ts
 */

import * as assert from 'assert';
import { FlowScheduler, buildScheduledInputs } from './FlowScheduler';
import type { Flow, ExecutionResult } from './types';
import type { FlowScheduleRuntimeState } from './FlowScheduleState';

class FakeScheduleState {
  private readonly store = new Map<string, FlowScheduleRuntimeState>();

  async get(flowPath: string): Promise<FlowScheduleRuntimeState> {
    const key = String(flowPath);
    return this.store.get(key) ?? {
      lastRunAt: null,
      lastScheduledFor: null,
      lastStatus: 'idle',
      lastError: null,
    };
  }

  async update(
    flowPath: string,
    patch: Partial<FlowScheduleRuntimeState>
  ): Promise<FlowScheduleRuntimeState> {
    const key = String(flowPath);
    const next = {
      ...(await this.get(flowPath)),
      ...patch,
    };
    this.store.set(key, next);
    return next;
  }
}

class FakeStorage {
  constructor(
    private readonly flows: Flow[],
    private readonly flowPathPrefix: string = '/tmp'
  ) {}

  async listFlows(): Promise<Flow[]> {
    return this.flows;
  }

  getFlowPath(id: string): string {
    return `${this.flowPathPrefix}/${id}.flow.json`;
  }
}

function createFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: 'daily-summary',
    name: 'Daily Summary',
    description: '',
    version: 1,
    created: '2026-03-29T08:00:00.000Z',
    modified: '2026-03-29T08:00:00.000Z',
    inputs: [],
    schedule: {
      enabled: true,
      type: 'daily',
      time: '09:00',
    },
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: { label: 'Trigger', inputs: [] },
      },
    ],
    edges: [],
    ...overrides,
  };
}

async function main(): Promise<void> {
  console.log('Testing flow scheduler...');

  // Test 1: Required inputs without defaults are ineligible
  const missingDefault = buildScheduledInputs(
    createFlow({
      inputs: [
        {
          id: 'release-number',
          type: 'text',
          label: 'Release number',
          required: true,
        },
      ],
    })
  );
  assert.strictEqual(missingDefault.inputs, null);
  assert.ok(missingDefault.error?.includes('Release number'));
  console.log('  ✓ Scheduled eligibility rejects missing required defaults');

  // Test 2: Defaults are passed into execution
  const collectedExecutions: Array<{ inputs: Record<string, unknown> }> = [];
  const flowForExecution = createFlow({
    inputs: [
      {
        id: 'topic',
        type: 'text',
        label: 'Topic',
        required: true,
        defaultValue: 'Releases',
      },
    ],
    schedule: {
      enabled: true,
      type: 'daily',
      time: '09:00',
    },
  });
  const stateForExecution = new FakeScheduleState();
  const scheduler = new FlowScheduler('/workspace', {
    storage: new FakeStorage([flowForExecution]),
    scheduleState: stateForExecution,
    isFeatureEnabled: () => true,
    executeFlowFn: async (
      _flow: Flow,
      inputs: Record<string, unknown>
    ): Promise<ExecutionResult> => {
      collectedExecutions.push({ inputs });
      return { success: true, outputs: {} };
    },
  });
  await scheduler.tick(new Date(2026, 2, 29, 9, 2));
  assert.strictEqual(collectedExecutions.length, 1);
  assert.strictEqual(collectedExecutions[0].inputs.topic, 'Releases');
  console.log('  ✓ Scheduled defaults are passed into execution');

  // Test 3: Duplicate scheduled slot runs only once
  await scheduler.tick(new Date(2026, 2, 29, 9, 3));
  assert.strictEqual(collectedExecutions.length, 1);
  console.log('  ✓ Duplicate slot is not executed twice');

  // Test 4: Disabled feature prevents execution
  let disabledExecuted = false;
  const disabledScheduler = new FlowScheduler('/workspace', {
    storage: new FakeStorage([createFlow()]),
    scheduleState: new FakeScheduleState(),
    isFeatureEnabled: () => false,
    executeFlowFn: async (): Promise<ExecutionResult> => {
      disabledExecuted = true;
      return { success: true, outputs: {} };
    },
  });
  await disabledScheduler.tick(new Date(2026, 2, 29, 9, 1));
  assert.strictEqual(disabledExecuted, false);
  console.log('  ✓ Disabled feature prevents execution');

  // Test 5: Ineligible flow is marked skipped
  const skippedState = new FakeScheduleState();
  const skippedFlow = createFlow({
    inputs: [
      {
        id: 'release-number',
        type: 'text',
        label: 'Release number',
        required: true,
      },
    ],
  });
  const skippedScheduler = new FlowScheduler('/workspace', {
    storage: new FakeStorage([skippedFlow]),
    scheduleState: skippedState,
    isFeatureEnabled: () => true,
    executeFlowFn: async (): Promise<ExecutionResult> => {
      throw new Error('Should not execute');
    },
  });
  await skippedScheduler.tick(new Date(2026, 2, 29, 9, 2));
  const skippedRuntime = await skippedState.get('/tmp/daily-summary.flow.json');
  assert.strictEqual(skippedRuntime.lastStatus, 'skipped');
  assert.ok(
    skippedRuntime.lastError?.includes('Missing required input default')
  );
  console.log('  ✓ Ineligible flow is marked skipped');

  console.log('\n✅ All flow scheduler tests passed!');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
