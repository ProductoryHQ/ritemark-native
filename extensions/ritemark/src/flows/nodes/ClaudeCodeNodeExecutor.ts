/**
 * Claude Code Node Executor
 *
 * Executes autonomous coding tasks using Claude Agent SDK.
 * Delegates to the shared AgentRunner for actual execution.
 */

import type { FlowNode, ExecutionContext, ProgressCallback } from '../types';
import { getSetupStatus, runAgent, type AgentExecutionOptions, type AgentResult, type SetupStatus } from '../../agent';
import type { AnthropicKeyReader } from '../../agent/setup';
import { claudeApiKey } from '../../ai/providerKeys';
import { interpolateVariables } from './interpolate';

let anthropicKeyReader: AnthropicKeyReader | null = null;

/**
 * At activation: the reader of the Anthropic key saved in Ritemark (Sprint 160, #541), the same one Claude's
 * readiness asks (`registerAnthropicKeyReader`), so the key the step runs on is the key that made Claude ready.
 */
export function setClaudeCodeNodeKeyReader(reader: AnthropicKeyReader): void {
  anthropicKeyReader = reader;
}

/** What the step uses from the host; the tests pass their own. */
export interface ClaudeCodeNodeDependencies {
  getSetupStatus: (options?: { refresh?: boolean }) => Promise<SetupStatus>;
  runAgent: (options: AgentExecutionOptions) => Promise<AgentResult>;
  readAnthropicKey: AnthropicKeyReader;
}

const hostDependencies: ClaudeCodeNodeDependencies = {
  getSetupStatus,
  runAgent,
  readAnthropicKey: async () => (anthropicKeyReader ? anthropicKeyReader() : undefined),
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
  let savedKey: string | undefined;
  if (setupStatus.authMethod === 'api-key') {
    try {
      savedKey = await dependencies.readAnthropicKey();
    } catch (error) {
      // As Claude's readiness counts it (setup.ts): a key that can't be read is none. Claude Code may run on its own.
      console.warn(`[ClaudeCode] The saved Anthropic key could not be read, so the step runs without it (${error instanceof Error ? error.message : String(error)})`);
    }
  }

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
          const progressType = progress.type === 'notice' ? 'init' : progress.type;
          const type = (progressType === 'error' || progressType === 'context_overflow' || progressType === 'plan_ready' || progressType === 'plan_text'
            || progressType === 'plan_autonomous' || progressType === 'session_reset'
            || progressType === 'subagent_start' || progressType === 'subagent_progress' || progressType === 'subagent_done' || progressType === 'subagent_update'
            || progressType === 'compacting' || progressType === 'compacted')
            ? 'done' as const
            : progressType;
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
