/**
 * Sprint 155: path identity — Windows' drive case and slash direction do not
 * make two files of one; macOS and Linux compare as today.
 *
 * Runs on any platform: the Windows cases pass `path.win32`, the macOS/Linux
 * cases `path.posix`.
 *
 * Run: npx tsx src/utils/pathIdentity.test.ts
 */
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { pickCommentTaskDestination } from '../commentTasks/commentTaskDestination';
import { isInside, normalizeForCompare, sameFile, samePath } from './pathIdentity';

const W = path.win32;
const P = path.posix;
const gone = (file: string): string => {
  throw Object.assign(new Error(`ENOENT: no such file or directory, realpath '${file}'`), { code: 'ENOENT' });
};

// ── normalizeForCompare ──
{
  assert.equal(normalizeForCompare('C:/Users/Me/ws/./docs/../Doc.md', W), 'c:\\users\\me\\ws\\doc.md', 'win32: backslashes, lower case, normalized');
  assert.equal(normalizeForCompare('/Users/Me/ws/./docs/../Doc.md', P), '/Users/Me/ws/Doc.md', 'posix: normalized, case kept');
  console.log('✓ normalizeForCompare');
}

// ── samePath ──
{
  assert.ok(samePath('c:\\Users\\me\\ws\\doc.md', 'C:\\Users\\me\\ws\\doc.md', W), 'win32: drive case');
  assert.ok(samePath('C:/Users/me/ws/doc.md', 'C:\\Users\\me\\ws\\doc.md', W), 'win32: slash direction');
  assert.ok(samePath('C:\\Users\\Me\\WS\\Doc.md', 'c:/users/me/ws/doc.md', W), 'win32: NTFS names are case-insensitive');
  assert.ok(!samePath('C:\\Users\\me\\ws\\doc.md', 'D:\\Users\\me\\ws\\doc.md', W), 'win32: another drive is another file');
  assert.ok(!samePath('C:\\Users\\me\\ws\\doc.md', 'C:\\Users\\me\\wsx\\doc.md', W), 'win32: another folder is another file');
  assert.ok(samePath('/Users/me/ws/doc.md', '/Users/me/ws/doc.md', P), 'posix: same spelling');
  assert.ok(!samePath('/Users/me/ws/doc.md', '/Users/me/ws/Doc.md', P), 'posix: case is not folded');
  assert.ok(!samePath('/Users/me/ws/doc.md', '/users/me/ws/doc.md', P), 'posix: case is not folded, folders too');
  console.log('✓ samePath');
}

// ── isInside ──
{
  assert.ok(isInside('c:\\Users\\me\\ws\\docs\\doc.md', 'C:\\Users\\me\\ws', W), 'win32: drive case');
  assert.ok(isInside('C:/Users/me/ws/docs/doc.md', 'C:\\Users\\me\\ws', W), 'win32: slash direction');
  assert.ok(isInside('C:\\Users\\me\\ws\\docs\\doc.md', 'c:\\Users\\me\\ws', W), 'win32: a lowercase-drive workspace, an uppercase-drive file');
  assert.ok(isInside('C:\\Users\\me\\ws\\doc.md', 'C:\\Users\\me\\ws\\', W), 'win32: a root with a trailing slash');
  assert.ok(!isInside('C:\\Users\\me\\wsx\\doc.md', 'C:\\Users\\me\\ws', W), 'win32: the sibling folder wsx is outside');
  assert.ok(!isInside('C:\\Users\\me\\other\\doc.md', 'C:\\Users\\me\\ws', W), 'win32: a file outside is outside');
  assert.ok(!isInside('C:\\Users\\me\\ws', 'C:\\Users\\me\\ws', W), 'win32: the folder itself is not inside');
  assert.ok(isInside('/Users/me/ws/docs/doc.md', '/Users/me/ws', P), 'posix: inside');
  assert.ok(!isInside('/Users/me/wsx/doc.md', '/Users/me/ws', P), 'posix: the sibling folder wsx is outside');
  assert.ok(!isInside('/Users/me/WS/doc.md', '/Users/me/ws', P), 'posix: case is not folded');
  console.log('✓ isInside');
}

// ── sameFile: the router's comparison (realpath first, then samePath) ──
{
  // A deleted file: realpath throws, and the spellings still name one file.
  assert.ok(sameFile('c:\\Users\\me\\ws\\gone.md', 'C:\\Users\\me\\ws\\gone.md', gone, W), 'win32: a deleted file, drive case');
  assert.ok(sameFile('C:/Users/me/ws/gone.md', 'C:\\Users\\me\\ws\\gone.md', gone, W), 'win32: a deleted file, slash direction');
  assert.ok(!sameFile('C:\\Users\\me\\ws\\gone.md', 'C:\\Users\\me\\wsx\\gone.md', gone, W), 'win32: a deleted file in another folder is another file');
  // An existing file reached through a link: realpath decides first.
  const linked = (file: string) => (file.startsWith('/tmp/') ? `/private${file}` : file);
  assert.ok(sameFile('/tmp/ws/doc.md', '/private/tmp/ws/doc.md', linked, P), 'posix: realpath first, as today');
  assert.ok(!sameFile('/tmp/ws/doc.md', '/tmp/ws/Doc.md', linked, P), 'posix: case is not folded');
  assert.ok(!sameFile('/tmp/ws/gone.md', '/tmp/ws/Gone.md', gone, P), 'posix: a deleted file, case is not folded');
  console.log('✓ sameFile');
}

// ── The routing rule with the host's comparison, win32: a deleted document ──
{
  const choice = pickCommentTaskDestination({
    document: 'C:\\Users\\me\\ws\\gone.md',
    chats: [
      { conversationId: 'other', changedFiles: [{ path: 'C:\\Users\\me\\ws\\other.md', changedAt: '2026-11-07T10:00:00Z' }] },
      { conversationId: 'draft', changedFiles: [{ path: 'c:/Users/me/ws/gone.md', changedAt: '2026-11-07T08:00:00Z' }] },
    ],
    pending: [],
    openConversationId: null,
    exists: () => true,
    samePath: (a, b) => sameFile(a, b, gone, W),
  });
  assert.deepEqual(choice, { rule: 'changed', conversationId: 'draft', changedAt: '2026-11-07T08:00:00Z' }, 'win32: the chat that changed the deleted document, in another spelling');
  console.log('✓ routing: a deleted document in another spelling finds its chat (win32)');
}

console.log('pathIdentity tests: all assertions passed');
