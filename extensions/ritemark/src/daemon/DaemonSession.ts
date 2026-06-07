/**
 * DaemonSession — headless turn configuration for AgentDaemon runs.
 *
 * Approval policy (enforced via RuntimeSessionConfig.onApprovalRequest in
 * AgentDaemon): file-write, shell-command, and permission requests are
 * auto-rejected and logged. Only read-only (plan) operations proceed without
 * user interaction.
 */

import type { RuntimeTurnConfig } from '../runtime/AgentRuntime';

/**
 * Builds a RuntimeTurnConfig for a headless daemon run.
 * The timeout is kept short (10 minutes) to prevent runaway background agents.
 */
export function createHeadlessTurnConfig(
  prompt: string,
  _workspacePath: string
): RuntimeTurnConfig {
  return {
    prompt,
    timeoutMinutes: 10,
  };
}
