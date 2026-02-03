/**
 * Claude Code Node Executor
 *
 * Executes autonomous coding tasks using Claude Code CLI.
 * Runs claude in headless mode with JSON output.
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { FlowNode, ExecutionContext } from '../types';

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
 * Find Claude Code binary in common locations
 */
function findClaudeCodeBinary(): string | null {
  const possiblePaths = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    path.join(os.homedir(), '.npm', 'bin', 'claude'),
    path.join(os.homedir(), '.local', 'bin', 'claude'),
  ];

  // Also check PATH
  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(path.delimiter);
  for (const dir of pathDirs) {
    possiblePaths.push(path.join(dir, 'claude'));
  }

  for (const binPath of possiblePaths) {
    if (fs.existsSync(binPath)) {
      return binPath;
    }
  }

  return null;
}

/**
 * Check if Claude Code is authenticated
 * Looks for ~/.claude/ directory
 */
function checkClaudeCodeAuth(): boolean {
  const claudeDir = path.join(os.homedir(), '.claude');
  return fs.existsSync(claudeDir);
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
      return context.inputLabels.get(trimmedLabel) || match;
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
 * Execute Claude Code node
 */
export async function executeClaudeCodeNode(
  node: FlowNode,
  context: ExecutionContext,
  abortSignal?: AbortSignal
): Promise<ClaudeCodeResult> {
  const data = node.data as unknown as ClaudeCodeNodeData;

  // Validate configuration
  if (!data.prompt || data.prompt.trim() === '') {
    throw new Error('Claude Code node missing prompt');
  }

  // Find Claude Code binary
  const binaryPath = findClaudeCodeBinary();
  if (!binaryPath) {
    throw new Error(
      'Claude Code CLI not found. Install it from https://github.com/anthropics/claude-code'
    );
  }

  // Check authentication
  if (!checkClaudeCodeAuth()) {
    throw new Error(
      "Claude Code not authenticated. Run 'claude' in your terminal to set up."
    );
  }

  // Interpolate variables in prompt
  const interpolatedPrompt = interpolateVariables(data.prompt, context);

  // Calculate timeout in milliseconds
  const timeoutMinutes = data.timeout || 5;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  // Build command arguments
  const args = ['-p', interpolatedPrompt, '--output-format', 'json'];

  return new Promise<ClaudeCodeResult>((resolve, reject) => {
    let resolved = false;

    // Spawn Claude Code subprocess
    const claudeProc = child_process.spawn(binaryPath, args, {
      cwd: context.workspacePath,
      env: {
        ...process.env,
      },
    });

    let stdout = '';
    let stderr = '';

    claudeProc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8');
    });

    claudeProc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8');
    });

    claudeProc.on('error', (error: Error) => {
      if (resolved) return;
      resolved = true;
      reject(new Error(`Claude Code process error: ${error.message}`));
    });

    claudeProc.on('exit', (code: number | null) => {
      if (resolved) return;
      resolved = true;

      // Check if aborted
      if (abortSignal?.aborted) {
        resolve({
          text: '',
          files: [],
          error: 'Execution cancelled by user.',
        });
        return;
      }

      if (code === 0) {
        // Success - parse JSON output
        try {
          const jsonOutput = JSON.parse(stdout);

          // Extract result text and files
          const resultText = jsonOutput.result || jsonOutput.summary || '';
          const filesModified = jsonOutput.files_modified || [];
          const filesCreated = jsonOutput.files_created || [];
          const allFiles = [...filesModified, ...filesCreated];

          resolve({
            text: resultText,
            files: allFiles,
          });
        } catch (parseError) {
          // JSON parse failed - return raw output
          resolve({
            text: stdout.trim(),
            files: [],
            error: `Failed to parse Claude Code output. Raw output: ${stdout}`,
          });
        }
      } else {
        // Error exit
        const errorMsg = stderr.trim() || `Claude Code exited with code ${code}`;
        resolve({
          text: '',
          files: [],
          error: errorMsg,
        });
      }
    });

    // Handle abortion
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        if (!resolved) {
          resolved = true;
          claudeProc.kill('SIGTERM');
          resolve({
            text: '',
            files: [],
            error: 'Execution cancelled by user.',
          });
        }
      });
    }

    // Timeout handler
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        claudeProc.kill('SIGTERM');
        resolve({
          text: '',
          files: [],
          error: `Claude Code execution timed out after ${timeoutMinutes} minutes. Try increasing the timeout or simplifying the task.`,
        });
      }
    }, timeoutMs);

    // Clean up timeout if process exits early
    claudeProc.on('exit', () => {
      clearTimeout(timeoutId);
    });
  });
}
