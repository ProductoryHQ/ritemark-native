/**
 * Claude Code Node Executor
 *
 * Executes autonomous coding tasks using Claude Agent SDK.
 * Runs Claude Code programmatically with full tool access.
 */

import type { FlowNode, ExecutionContext, ProgressCallback } from '../types';

// Dynamic import for ES Module SDK (VS Code extensions use CommonJS)
// Using Function constructor to bypass TypeScript's import() → require() transformation
let queryFn: ((options: { prompt: string; options: Record<string, unknown> }) => AsyncIterable<unknown>) | null = null;

async function getQuery() {
  if (!queryFn) {
    // This trick prevents TypeScript from converting import() to require()
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<typeof import('@anthropic-ai/claude-agent-sdk')>;
    const sdk = await dynamicImport('@anthropic-ai/claude-agent-sdk');
    queryFn = sdk.query;
  }
  return queryFn;
}

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

  // Helper to emit progress
  const emitProgress = (type: 'init' | 'tool_use' | 'thinking' | 'text' | 'done', message: string, tool?: string, file?: string) => {
    if (onProgress) {
      onProgress({ type, message, tool, file });
    }
  };
  const data = node.data as unknown as ClaudeCodeNodeData;

  // Validate configuration
  if (!data.prompt || data.prompt.trim() === '') {
    console.error('[ClaudeCode] Missing prompt');
    throw new Error('Claude Code node missing prompt');
  }

  // Interpolate variables in prompt
  const interpolatedPrompt = interpolateVariables(data.prompt, context);
  console.log('[ClaudeCode] Interpolated prompt:', interpolatedPrompt.substring(0, 100) + '...');

  // Calculate timeout in milliseconds
  const timeoutMinutes = data.timeout || 5;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  console.log('[ClaudeCode] Timeout set to', timeoutMinutes, 'minutes');

  // Create abort controller for timeout
  const abortController = new AbortController();

  // Set up timeout
  const timeoutId = setTimeout(() => {
    console.log('[ClaudeCode] Timeout reached, aborting...');
    abortController.abort();
  }, timeoutMs);

  // Forward external abort signal
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      console.log('[ClaudeCode] External abort signal received');
      abortController.abort();
    });
  }

  try {
    console.log('[ClaudeCode] Starting SDK query...');
    console.log('[ClaudeCode] Working directory:', context.workspacePath);

    // Dynamic import for ES Module compatibility
    const query = await getQuery();
    const result = query({
      prompt: interpolatedPrompt,
      options: {
        cwd: context.workspacePath,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
        abortController,
      },
    });

    let resultText = '';
    const filesModified: string[] = [];

    // SDK message types (minimal definitions for our use)
    interface SDKMessage {
      type: string;
      model?: string;
      message?: { content?: Array<{ type: string; name?: string; text?: string; input?: unknown }> };
      duration_ms?: number;
      total_cost_usd?: number;
      subtype?: string;
      result?: string;
      errors?: string[];
    }

    // Iterate through messages
    for await (const rawMessage of result) {
      const message = rawMessage as SDKMessage;
      // Check for abort
      if (abortController.signal.aborted) {
        console.log('[ClaudeCode] Aborted during execution');
        clearTimeout(timeoutId);
        return {
          text: '',
          files: [],
          error: 'Execution cancelled',
        };
      }

      if (message.type === 'system') {
        console.log('[ClaudeCode] System init - model:', message.model);
        emitProgress('init', `Starting Claude Code (${message.model || 'claude'})`);
      } else if (message.type === 'assistant') {
        // Track tool usage for file modifications
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              // Show thinking/text snippets
              const snippet = block.text.substring(0, 100);
              emitProgress('thinking', snippet.length < block.text.length ? snippet + '...' : snippet);
            } else if (block.type === 'tool_use') {
              console.log('[ClaudeCode] Tool use:', block.name);
              const input = block.input as { file_path?: string; command?: string; pattern?: string };

              // Create descriptive message based on tool
              let toolMessage = `Using ${block.name}`;
              if (block.name === 'Write' && input?.file_path) {
                toolMessage = `Writing file: ${input.file_path.split('/').pop()}`;
                filesModified.push(input.file_path);
              } else if (block.name === 'Edit' && input?.file_path) {
                toolMessage = `Editing file: ${input.file_path.split('/').pop()}`;
                filesModified.push(input.file_path);
              } else if (block.name === 'Read' && input?.file_path) {
                toolMessage = `Reading file: ${input.file_path.split('/').pop()}`;
              } else if (block.name === 'Bash' && input?.command) {
                const cmd = input.command.substring(0, 50);
                toolMessage = `Running: ${cmd}${input.command.length > 50 ? '...' : ''}`;
              } else if (block.name === 'Glob' && input?.pattern) {
                toolMessage = `Searching: ${input.pattern}`;
              } else if (block.name === 'Grep' && input?.pattern) {
                toolMessage = `Searching for: ${input.pattern}`;
              }

              emitProgress('tool_use', toolMessage, block.name, input?.file_path);
            }
          }
        }
      } else if (message.type === 'result') {
        console.log('[ClaudeCode] Result received');
        console.log('[ClaudeCode] Duration:', message.duration_ms, 'ms');
        console.log('[ClaudeCode] Cost: $', message.total_cost_usd?.toFixed(4));

        if (message.subtype === 'success') {
          resultText = message.result || '';
          emitProgress('done', `Completed in ${((message.duration_ms || 0) / 1000).toFixed(1)}s`);
        } else {
          // Error result
          const errors = message.errors || [];
          emitProgress('done', `Failed: ${errors.join('; ') || 'Unknown error'}`);
          return {
            text: '',
            files: [],
            error: errors.join('; ') || 'Execution failed',
          };
        }
      }
    }

    clearTimeout(timeoutId);

    console.log('[ClaudeCode] Execution complete');
    console.log('[ClaudeCode] Files modified:', filesModified);

    return {
      text: resultText,
      files: [...new Set(filesModified)], // Deduplicate
    };

  } catch (error) {
    clearTimeout(timeoutId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ClaudeCode] Error:', errorMessage);

    // Check if it was an abort
    if (abortController.signal.aborted) {
      return {
        text: '',
        files: [],
        error: 'Execution cancelled or timed out',
      };
    }

    return {
      text: '',
      files: [],
      error: errorMessage,
    };
  }
}
