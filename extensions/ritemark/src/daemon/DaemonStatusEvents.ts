/**
 * DaemonStatusEvents — logs daemon lifecycle events to a VS Code OutputChannel.
 *
 * Used by AgentDaemon to surface run start/completion and blocked approval
 * requests in the "Ritemark Agent Daemon" output channel.
 */

import type { AgentId } from '../agent/types';

/** Structural subset of vscode.OutputChannel required here. */
interface OutputChannelLike {
  appendLine(value: string): void;
  dispose(): void;
}

/** Structural subset of vscode.Disposable. */
interface Disposable {
  dispose(): void;
}

export class DaemonStatusEvents implements Disposable {
  constructor(private readonly channel: OutputChannelLike) {}

  logRunStart(agentId: AgentId, prompt: string): void {
    this.channel.appendLine(
      `[${ts()}] [${agentId}] Run started — ${prompt}`
    );
  }

  logRunComplete(agentId: AgentId, success: boolean): void {
    const status = success ? 'OK' : 'FAILED';
    this.channel.appendLine(
      `[${ts()}] [${agentId}] Run complete: ${status}`
    );
  }

  logApprovalBlocked(agentId: AgentId, kind: string, detail: string): void {
    this.channel.appendLine(
      `[${ts()}] [${agentId}] Approval blocked (headless policy): ${kind} — ${detail}`
    );
  }

  dispose(): void {
    this.channel.dispose();
  }
}

function ts(): string {
  return new Date().toISOString();
}
