/**
 * Claude Code Node Executor
 *
 * Executes autonomous coding tasks using Claude Agent SDK.
 * Delegates to the shared AgentRunner for actual execution.
 */

import type { FlowNode, ExecutionContext, ProgressCallback } from '../types';
import { getSetupStatus, runAgent, type AgentExecutionOptions, type AgentResult, type SetupStatus } from '../../agent';
import { claudeApiKey, readProviderKey, type SecretReader } from '../../ai/providerKeys';
import { interpolateVariables } from './interpolate';

let secrets: SecretReader | null = null;

/** At activation: where the step reads the Anthropic key saved in Ritemark (Sprint 160, #541). */
export function setClaudeCodeNodeSecrets(store: SecretReader): void {
  secrets = store;
}

/** What the step uses from the host; the tests pass their own. */
export interface ClaudeCodeNodeDependencies {
  getSetupStatus: (options?: { refresh?: boolean }) => Promise<SetupStatus>;
  runAgent: (options: AgentExecutionOptions) => Promise<AgentResult>;
  readAnthropicKey: () => PromiseLike<string | undefined>;
}

const hostDependencies: ClaudeCodeNodeDependencies = {
  getSetupStatus,
  runAgent,
  readAnthropicKey: async () => (secrets ? readProviderKey(secrets, 'anthropic-api-key') : undefined),
};

/**
 * Claude Code Node configuration
 */
export interface ClaudeCodeNodeData {
  label: string;
  prompt: string;
  timeout: number; // in minutes (1-60)
}

/**
 * Claude Code execution result
 */
export interface ClaudeCodeResult {
  text: string; // Summary of what was done
  files: string[]; // Files created or modified
  error?: string;
}

/**
 * Execute Claude Code node using Agent SDK
 */
export async function executeClaudeCodeNode(
  node: FlowNode,
  context: ExecutionContext,
  abortSignal?: AbortSignal,
  onProgress?: ProgressCallback,
  dependencies: ClaudeCodeNodeDependencies = hostDependencies,
): Promise<ClaudeCodeResult> {
  console.log('[ClaudeCode] Starting execution for node:', node.id);

  const data = node.data as unknown as ClaudeCodeNodeData;

  // Validate configuration
  if (!data.prompt || data.prompt.trim() === '') {
    console.error('[ClaudeCode] Missing prompt');
    throw new Error('Claude Code node missing prompt');
  }

  // Interpolate variables in prompt
  const interpolatedPrompt = interpolateVariables(data.prompt, context);
  console.log('[ClaudeCode] Interpolated prompt:', interpolatedPrompt.substring(0, 100) + '...');

  const setupStatus = await dependencies.getSetupStatus({ refresh: true });
  // Ritemark 2.0: the step's settings no longer carry a sign-in note, so the run says what to do and where
  if (setupStatus.state !== 'ready') {
    throw new Error(setupStatus.state === 'needs-auth' || setupStatus.state === 'auth-in-progress'
      // #459: Claude's card is Claude Account, under API Keys (not Agent Runtime)
      ? 'Claude is not signed in. In Ritemark Settings, sign in with Claude.ai under API Keys, then run the flow again.'
      : 'Claude is not set up. In Ritemark Settings, set it up in Claude Account under API Keys, then run the flow again.');
  }

  // #541: a Claude that runs on the key saved in Ritemark gets it, as a chat does; a Claude.ai sign-in gets none.
  const savedKey = setupStatus.authMethod === 'api-key' ? await dependencies.readAnthropicKey() : undefined;

  const result = await dependencies.runAgent({
    prompt: interpolatedPrompt,
    workspacePath: context.workspacePath,
    timeoutMinutes: data.timeout || 5,
    abortSignal,
    pathToClaudeCodeExecutable: setupStatus.binaryPath,
    anthropicApiKey: claudeApiKey(setupStatus.authMethod, savedKey),
    onProgress: onProgress
      ? (progress) => {
          // Map unsupported types to 'done' since flow ProgressCallback has a limited set
          const type = (progress.type === 'error' || progress.type === 'context_overflow' || progress.type === 'plan_ready' || progress.type === 'plan_text'
            || progress.type === 'plan_autonomous' || progress.type === 'session_reset'
            || progress.type === 'subagent_start' || progress.type === 'subagent_progress' || progress.type === 'subagent_done' || progress.type === 'subagent_update'
            || progress.type === 'compacting' || progress.type === 'compacted')
            ? 'done' as const
            : progress.type;
          onProgress({ type, message: progress.message, tool: progress.tool, file: progress.file });
        }
      : undefined,
  });

  return {
    text: result.text,
    files: result.filesModified,
    error: result.error,
  };
}
