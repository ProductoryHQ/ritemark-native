/**
 * DaemonResultStore — persists the most recent run result for each scheduled
 * agent.  Results are stored in workspaceState so they survive extension
 * host restarts but are scoped to the open workspace.
 *
 * Sprint 79: populated by AgentDaemon but not yet consumed by any UI.
 * Sprint 80 wires the results into the Agent Library sidebar.
 */

import type { AgentId } from '../agent/types';

export interface DaemonRunResult {
  agentId: AgentId;
  /** Unix timestamp (milliseconds) when the run was triggered. */
  timestamp: number;
  /** One-line summary produced by the run (or error message). */
  summary: string;
  success: boolean;
}

const KEY_PREFIX = 'daemon.lastRun.';

/** Structural subset of vscode.ExtensionContext required by this store. */
interface ExtensionContextLike {
  workspaceState: {
    get<T>(key: string): T | undefined;
    update(key: string, value: unknown): Thenable<void>;
  };
}

export class DaemonResultStore {
  constructor(private readonly context: ExtensionContextLike) {}

  record(agentId: AgentId, result: DaemonRunResult): void {
    void this.context.workspaceState.update(`${KEY_PREFIX}${agentId}`, result);
  }

  getLastRun(agentId: AgentId): DaemonRunResult | undefined {
    return this.context.workspaceState.get<DaemonRunResult>(
      `${KEY_PREFIX}${agentId}`
    );
  }
}
