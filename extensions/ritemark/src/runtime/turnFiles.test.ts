/**
 * Sprint 155: Claude Code reports the files its turn changed — Write, Edit,
 * MultiEdit, NotebookEdit — never the ones it read; and the one workspace rule
 * every runtime uses.
 *
 * Run: npx tsx src/runtime/turnFiles.test.ts
 */
import assert from 'node:assert/strict';
import * as os from 'node:os';
import * as path from 'node:path';
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
  // Portable: the workspace is under the platform's temp folder, and its
  // "realpath" a second spelling of it (macOS's /tmp → /private/tmp).
  const ws = path.join(os.tmpdir(), 'ritemark-155-ws');
  const wsReal = path.join(os.tmpdir(), 'ritemark-155-real', 'ws');
  const realpath = (file: string) => (file === ws ? wsReal : file);
  const outside = path.join(os.tmpdir(), 'ritemark-155-home', '.claude', 'plans', 'p.md');
  assert.deepEqual(
    workspaceFilesOnly([path.join(ws, 'a.md'), path.join(wsReal, 'b.md'), path.join('docs', 'c.md'), outside, path.join(ws, 'a.md'), path.join(`${ws}x`, 'd.md')], ws, realpath),
    [path.join(ws, 'a.md'), path.join(wsReal, 'b.md'), path.join(ws, 'docs', 'c.md')],
    'workspace files only, once each; a relative path is read against the workspace',
  );
  assert.deepEqual(workspaceFilesOnly([path.join(os.tmpdir(), 'a.md')], ''), [], 'no workspace, no files');
  console.log('✓ workspace files only');
}

// ── The workspace rule on Windows (path.win32, runs on any platform) ──
{
  const ws = 'C:\\Users\\me\\ws';
  const noLink = (file: string) => file;
  const keep = (files: string[], root = ws) => workspaceFilesOnly(files, root, noLink, path.win32);
  assert.deepEqual(keep(['C:\\Users\\me\\ws\\docs\\doc.md']), ['C:\\Users\\me\\ws\\docs\\doc.md'], 'win32: same spelling');
  assert.deepEqual(keep(['c:\\Users\\me\\ws\\docs\\doc.md']), ['c:\\Users\\me\\ws\\docs\\doc.md'], 'win32: a lowercase drive letter is the same drive');
  assert.deepEqual(keep(['C:/Users/me/ws/docs/doc.md']), ['C:/Users/me/ws/docs/doc.md'], 'win32: forward slashes are the same path');
  assert.deepEqual(keep(['C:\\Users\\me\\ws\\docs\\doc.md'], 'c:\\Users\\me\\ws'), ['C:\\Users\\me\\ws\\docs\\doc.md'], 'win32: a lowercase-drive workspace keeps an uppercase-drive file');
  assert.deepEqual(keep(['C:\\Users\\Me\\WS\\Doc.md']), ['C:\\Users\\Me\\WS\\Doc.md'], 'win32: NTFS names are case-insensitive');
  assert.deepEqual(keep(['C:\\Users\\me\\wsx\\d.md', 'c:/users/me/wsx/d.md']), [], 'win32: the sibling folder wsx is outside');
  assert.deepEqual(keep(['C:\\Users\\me\\.claude\\plans\\p.md', 'D:\\Users\\me\\ws\\a.md']), [], 'win32: files outside the workspace are dropped');
  assert.deepEqual(keep(['docs\\c.md', 'docs/e.md']), ['C:\\Users\\me\\ws\\docs\\c.md', 'C:\\Users\\me\\ws\\docs\\e.md'], 'win32: a relative path is read against the workspace');
  assert.deepEqual(keep(['C:\\Users\\me\\ws\\a.md', 'c:/users/me/ws/A.md']), ['C:\\Users\\me\\ws\\a.md'], 'win32: one file in two spellings counts once');
  console.log('✓ workspace files only, win32 drive case and slashes');
}

// ── The workspace rule on macOS and Linux is unchanged (path.posix) ──
{
  const noLink = (file: string) => file;
  const keep = (files: string[]) => workspaceFilesOnly(files, '/Users/me/ws', noLink, path.posix);
  assert.deepEqual(keep(['/Users/me/ws/a.md', '/Users/me/WS/b.md', '/users/me/ws/c.md', '/Users/me/wsx/d.md']), ['/Users/me/ws/a.md'], 'posix: case is not folded; wsx is outside');
  assert.deepEqual(keep(['docs/c.md']), ['/Users/me/ws/docs/c.md'], 'posix: a relative path is read against the workspace');
  console.log('✓ workspace files only, posix unchanged');
}

console.log('turnFiles tests: all assertions passed');
