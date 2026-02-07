/**
 * AgentRunner - Reusable Claude Agent SDK executor
 *
 * Extracted from ClaudeCodeNodeExecutor to serve both:
 * - Flows (via ClaudeCodeNodeExecutor, which delegates here)
 * - Unified AI View (direct usage when "Claude Code" agent is selected)
 *
 * Handles SDK import, event streaming, file tracking, cost tracking,
 * and abort/timeout management.
 */

import type {
  AgentExecutionOptions,
  AgentProgress,
  AgentResult,
  AgentMetrics,
  SDKMessage,
} from './types';

// Dynamic import for ES Module SDK (VS Code extensions use CommonJS)
// Using Function constructor to bypass TypeScript's import() → require() transformation
let queryFn: ((options: { prompt: string; options: Record<string, unknown> }) => AsyncIterable<unknown>) | null = null;

async function getQuery() {
  if (!queryFn) {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<typeof import('@anthropic-ai/claude-agent-sdk')>;
    const sdk = await dynamicImport('@anthropic-ai/claude-agent-sdk');
    queryFn = sdk.query;
  }
  return queryFn;
}

const DEFAULT_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'];
const DEFAULT_TIMEOUT_MINUTES = 5;

/**
 * Execute an agent task using the Claude Agent SDK.
 *
 * Streams progress events via the onProgress callback and returns
 * a result with text output, modified files, and cost metrics.
 */
export async function runAgent(options: AgentExecutionOptions): Promise<AgentResult> {
  const {
    prompt,
    workspacePath,
    allowedTools = DEFAULT_TOOLS,
    timeoutMinutes = DEFAULT_TIMEOUT_MINUTES,
    abortSignal,
    onProgress,
  } = options;

  const emitProgress = (
    type: AgentProgress['type'],
    message: string,
    tool?: string,
    file?: string
  ) => {
    onProgress?.({ type, message, tool, file, timestamp: Date.now() });
  };

  // Validate
  if (!prompt || prompt.trim() === '') {
    throw new Error('Agent prompt is empty');
  }

  // Abort controller: merges internal timeout + external signal
  const abortController = new AbortController();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  if (abortSignal) {
    abortSignal.addEventListener('abort', () => abortController.abort(), { once: true });
  }

  const metrics: AgentMetrics = { durationMs: 0, costUsd: null, model: null };
  const filesModified: string[] = [];

  try {
    const query = await getQuery();
    const stream = query({
      prompt,
      options: {
        cwd: workspacePath,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        allowedTools,
        abortController,
      },
    });

    let resultText = '';

    for await (const rawMessage of stream) {
      const message = rawMessage as SDKMessage;

      if (abortController.signal.aborted) {
        clearTimeout(timeoutId);
        return { text: '', filesModified: [], metrics, error: 'Execution cancelled' };
      }

      if (message.type === 'system') {
        metrics.model = message.model || null;
        emitProgress('init', `Starting Claude Code (${message.model || 'claude'})`);
      } else if (message.type === 'assistant') {
        processAssistantMessage(message, filesModified, emitProgress);
      } else if (message.type === 'result') {
        metrics.durationMs = message.duration_ms || 0;
        metrics.costUsd = message.total_cost_usd ?? null;

        if (message.subtype === 'success') {
          resultText = message.result || '';
          const durationStr = (metrics.durationMs / 1000).toFixed(1);
          emitProgress('done', `Completed in ${durationStr}s`);
        } else {
          const errors = message.errors || [];
          const errorStr = errors.join('; ') || 'Execution failed';
          emitProgress('error', errorStr);
          clearTimeout(timeoutId);
          return { text: '', filesModified: [], metrics, error: errorStr };
        }
      }
    }

    clearTimeout(timeoutId);
    return {
      text: resultText,
      filesModified: [...new Set(filesModified)],
      metrics,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (abortController.signal.aborted) {
      return { text: '', filesModified: [], metrics, error: 'Execution cancelled or timed out' };
    }

    emitProgress('error', errorMessage);
    return { text: '', filesModified: [], metrics, error: errorMessage };
  }
}

/**
 * Parse assistant message content blocks for tool usage and thinking
 */
function processAssistantMessage(
  message: SDKMessage,
  filesModified: string[],
  emitProgress: (type: AgentProgress['type'], message: string, tool?: string, file?: string) => void
) {
  const content = message.message?.content;
  if (!Array.isArray(content)) return;

  for (const block of content) {
    if (block.type === 'text' && block.text) {
      const snippet = block.text.substring(0, 150);
      emitProgress('thinking', snippet.length < block.text.length ? snippet + '...' : snippet);
    } else if (block.type === 'tool_use') {
      const input = block.input as { file_path?: string; command?: string; pattern?: string } | undefined;
      let toolMessage = `Using ${block.name}`;

      if (block.name === 'Write' && input?.file_path) {
        toolMessage = `Writing: ${input.file_path.split('/').pop()}`;
        filesModified.push(input.file_path);
      } else if (block.name === 'Edit' && input?.file_path) {
        toolMessage = `Editing: ${input.file_path.split('/').pop()}`;
        filesModified.push(input.file_path);
      } else if (block.name === 'Read' && input?.file_path) {
        toolMessage = `Reading: ${input.file_path.split('/').pop()}`;
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
