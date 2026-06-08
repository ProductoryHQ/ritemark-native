import type { AgentId } from '../agent/types';
import type { AgentRuntime } from './AgentRuntime';

export class RuntimeRegistry {
  private readonly runtimes: Map<AgentId, AgentRuntime>;

  constructor(runtimes: Map<AgentId, AgentRuntime>) {
    this.runtimes = runtimes;
  }

  get(id: AgentId): AgentRuntime {
    const runtime = this.runtimes.get(id);
    if (!runtime) {
      throw new Error(`Unknown agent runtime: ${id}`);
    }
    return runtime;
  }

  getAll(): AgentRuntime[] {
    return Array.from(this.runtimes.values());
  }

  dispose(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.dispose();
    }
  }
}
