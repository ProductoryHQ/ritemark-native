/**
 * Claude Code Node Executor
 *
 * Executes autonomous coding tasks using Claude Agent SDK.
 * Delegates to the shared AgentRunner for actual execution.
 */

import type { FlowNode, ExecutionContext, ProgressCallback } from '../types';
import { runAgent } from '../../agent';

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
 * Interpolate variables in prompt using context
 * Supports {Label} syntax for inputs and node labels
 */
function interpolateVariables(
  template: string,
  context: ExecutionContext
): string {
  let result = template;

  // New simple syntax: {Label}
  const simpleLabelPattern = /\{([^{}]+)\}/g;
  result = result.replace(simpleLabelPattern, (match, label) => {
    const trimmedLabel = label.trim();

    // Check input labels first
    if (context.inputLabels?.has(trimmedLabel)) {
      const value = context.inputLabels.get(trimmedLabel);
      return value !== undefined ? String(value) : match;
    }

    // Check node labels
    if (context.nodeLabels?.has(trimmedLabel)) {
      const nodeId = context.nodeLabels.get(trimmedLabel)!;
      const value = context.outputs.get(nodeId);
      return value !== undefined ? String(value) : match;
    }

    // Try direct lookup by input key (case insensitive)
    for (const [key, value] of Object.entries(context.inputs)) {
      if (key.toLowerCase() === trimmedLabel.toLowerCase()) {
        return String(value);
      }
    }

    return match;
  });

  // Legacy syntax: {{inputs.key}}
  const inputPattern = /\{\{inputs\.(\w+)\}\}/g;
  result = result.replace(inputPattern, (match, key) => {
    const value = context.inputs[key];
    return value !== undefined ? String(value) : match;
  });

  // Legacy syntax: {{nodeId}}
  const outputPattern = /\{\{([a-zA-Z0-9_-]+)(?:\.output)?\}\}/g;
  result = result.replace(outputPattern, (match, nodeId) => {
    const value = context.outputs.get(nodeId);
    return value !== undefined ? String(value) : match;
  });

  return result;
}

/**
 * Execute Claude Code node using Agent SDK
 */
export async function executeClaudeCodeNode(
  node: FlowNode,
  context: ExecutionContext,
  abortSignal?: AbortSignal,
  onProgress?: ProgressCallback
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

  const result = await runAgent({
    prompt: interpolatedPrompt,
    workspacePath: context.workspacePath,
    timeoutMinutes: data.timeout || 5,
    abortSignal,
    onProgress: onProgress
      ? (progress) => {
          // Map unsupported types to 'done' since flow ProgressCallback has a limited set
          const type = (progress.type === 'error' || progress.type === 'context_overflow' || progress.type === 'plan_ready'
            || progress.type === 'subagent_start' || progress.type === 'subagent_progress' || progress.type === 'subagent_done'
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
