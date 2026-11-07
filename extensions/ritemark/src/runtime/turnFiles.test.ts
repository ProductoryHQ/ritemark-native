/**
 * Sprint 155: Claude Code reports the files its turn changed — Write, Edit,
 * MultiEdit, NotebookEdit — never the ones it read; and the one workspace rule
 * every runtime uses.
 *
 * Run: npx tsx src/runtime/turnFiles.test.ts
 */
import assert from 'node:assert/strict';
import * as runner from '../agent/AgentRunner';
import { processAssistantMessage } from '../agent/AgentRunner';
import { claudeChangedFile, workspaceFilesOnly } from './turnFiles';

const toolResults = (runner as unknown as {
  processToolResultMessage?: (message: unknown, filesModified: string[]) => void;
}).processToolResultMessage;

// ── Claude Code: a change counts only on a tool_result that is not an error ──
{
  const filesModified: string[] = [];
  processAssistantMessage({
    type: 'assistant',
    message: {
      content: [
        { type: 'tool_use', id: 'w1', name: 'Write', input: { file_path: '/ws/Declined.md', content: 'x' } },
        { type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: '/ws/Failed.md', old_string: 'zzz', new_string: 'b' } },
        { type: 'tool_use', id: 'e2', name: 'Edit', input: { file_path: '/ws/Module 2.md', old_string: 'a', new_string: 'b' } },
      ],
    },
  } as never, filesModified, () => undefined);
  assert.deepEqual(filesModified, [], 'nothing counts before its tool has run');
  toolResults?.({
    type: 'user',
    message: {
      content: [
        // Ask mode, the person declined: the bundled CLI (0.3.310) answers the
        // tool_use with `is_error: true` and the deny message (toolDenialKind "user-rejected").
        { type: 'tool_result', tool_use_id: 'w1', is_error: true, content: '<tool_use_error>User rejected this action.</tool_use_error>' },
        // The edit ran and failed.
        { type: 'tool_result', tool_use_id: 'e1', is_error: true, content: '<tool_use_error>String to replace not found in file.</tool_use_error>' },
        { type: 'tool_result', tool_use_id: 'e2', content: 'The file /ws/Module 2.md has been updated.' },
      ],
    },
  } as never, filesModified);
  assert.deepEqual(filesModified, ['/ws/Module 2.md'], 'a declined Write and a failed Edit do not count; a successful Edit does');
  console.log('✓ Claude Code: declined and failed edits do not count');
}

// ── Claude Code: changed, not read ──
{
  const filesModified: string[] = [];
  const message = {
    type: 'assistant',
    message: {
      content: [
        { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/ws/Advokatuur.md' } },
        { type: 'tool_use', id: 't2', name: 'Grep', input: { pattern: 'Bar', path: '/ws' } },
        { type: 'tool_use', id: 't3', name: 'Bash', input: { command: 'cat /ws/Module 3.md' } },
        { type: 'tool_use', id: 't4', name: 'Edit', input: { file_path: '/ws/Module 2.md', old_string: 'a', new_string: 'b' } },
        { type: 'tool_use', id: 't5', name: 'Write', input: { file_path: '/ws/New.md', content: 'x' } },
        { type: 'tool_use', id: 't6', name: 'NotebookEdit', input: { notebook_path: '/ws/analysis.ipynb', new_source: 'x' } },
        { type: 'tool_use', id: 't7', name: 'MultiEdit', input: { file_path: '/ws/Module 3.md', edits: [] } },
      ],
    },
  };
  processAssistantMessage(message as never, filesModified, () => undefined);
  // Each change counts once its tool ran (Sprint 155 review, finding 3).
  toolResults?.({
    type: 'user',
    message: { content: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'].map((id) => ({ type: 'tool_result', tool_use_id: id, content: 'ok' })) },
  } as never, filesModified);
  assert.deepEqual(filesModified, ['/ws/Module 2.md', '/ws/New.md', '/ws/analysis.ipynb', '/ws/Module 3.md'], 'Write, Edit, NotebookEdit and MultiEdit; not Read, Grep or Bash');
  assert.equal(claudeChangedFile('Read', { file_path: '/ws/a.md' }), null);
  console.log('✓ Claude Code counts Write and Edit, not Read');
}

// ── The workspace rule ──
{
  const realpath = (file: string) => (file === '/tmp/ws' ? '/private/tmp/ws' : file);
  assert.deepEqual(
    workspaceFilesOnly(['/tmp/ws/a.md', '/private/tmp/ws/b.md', 'docs/c.md', '/Users/me/.claude/plans/p.md', '/tmp/ws/a.md', '/tmp/wsx/d.md'], '/tmp/ws', realpath),
    ['/tmp/ws/a.md', '/private/tmp/ws/b.md', '/tmp/ws/docs/c.md'],
    'workspace files only, once each; a relative path is read against the workspace',
  );
  assert.deepEqual(workspaceFilesOnly(['/a.md'], ''), [], 'no workspace, no files');
  console.log('✓ workspace files only');
}

console.log('turnFiles tests: all assertions passed');
