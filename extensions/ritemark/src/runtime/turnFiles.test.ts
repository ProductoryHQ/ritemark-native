/**
 * Sprint 155: Claude Code reports the files its turn changed — Write, Edit,
 * MultiEdit, NotebookEdit — never the ones it read; and the one workspace rule
 * every runtime uses.
 *
 * Run: npx tsx src/runtime/turnFiles.test.ts
 */
import assert from 'node:assert/strict';
import { processAssistantMessage } from '../agent/AgentRunner';
import { claudeChangedFile, workspaceFilesOnly } from './turnFiles';

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
