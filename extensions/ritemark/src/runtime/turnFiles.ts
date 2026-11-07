/**
 * Sprint 155: the files a turn changed, the same way for every runtime.
 *
 * Each runtime reports the files its turn CHANGED — written, edited, patched —
 * never the ones it only read (`RuntimeTurnResult.filesModified`). The comment
 * task's routing and the conversation record count on that: a chat that read a
 * document has not changed it.
 *
 * - Claude Code: Write, Edit, MultiEdit and NotebookEdit tool calls (`AgentRunner`).
 * - Codex: completed `fileChange` items (`changedFilesOfCodexItem`).
 * - OpenCode (ACP): completed `edit` tool calls (`AcpTurnChanges`).
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Sprint 103 R7 (audit F11), shared since Sprint 155: only workspace files
 * count. Runtime-internal writes (e.g. `~/.claude/plans/*`) are real changes
 * but not part of the person's documents.
 *
 * Both the raw and the realpath-resolved workspace roots are accepted: on
 * macOS `/tmp` (and some user dirs) are symlinks, and the model may report
 * either form. A relative path is read against the workspace.
 */
export function workspaceFilesOnly(
  files: Iterable<string>,
  workspacePath: string,
  realpath: (file: string) => string = (file) => fs.realpathSync(file),
): string[] {
  if (!workspacePath) return [];
  const roots = new Set<string>([workspacePath]);
  try {
    roots.add(realpath(workspacePath));
  } catch { /* workspace gone — keep the raw root */ }
  const prefixes = Array.from(roots).map((root) => (root.endsWith(path.sep) ? root : root + path.sep));
  const out = new Set<string>();
  for (const file of files) {
    if (typeof file !== 'string' || !file) continue;
    const absolute = path.isAbsolute(file) ? file : path.join(workspacePath, file);
    if (prefixes.some((prefix) => absolute.startsWith(prefix))) out.add(absolute);
  }
  return Array.from(out);
}

/** Claude Code's tools that change a file, and the input field naming it. */
const CLAUDE_CHANGE_TOOLS: Readonly<Record<string, 'file_path' | 'notebook_path'>> = {
  Write: 'file_path',
  Edit: 'file_path',
  // Not in the bundled SDK 0.3.310's tool list; an older Claude Code still sends it.
  MultiEdit: 'file_path',
  NotebookEdit: 'notebook_path',
};

/** The file a Claude Code tool call changes, or null for a read, a search or a command. */
export function claudeChangedFile(toolName: string, input: unknown): string | null {
  const field = CLAUDE_CHANGE_TOOLS[toolName];
  if (!field || !input || typeof input !== 'object') return null;
  const value = (input as Record<string, unknown>)[field];
  return typeof value === 'string' && value ? value : null;
}
