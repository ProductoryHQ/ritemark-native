/**
 * Sprint 134 (R2, S5): the project list's first fill.
 * Run: npx tsx src/projects/firstFill.test.ts
 */

import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { firstFill, folderKey, lastOpenTimes, readChatFolders, type FirstFillInput } from './firstFill';

const uriOf = (fsPath: string): string => pathToFileURL(fsPath).toString();

function input(over: Partial<FirstFillInput>): FirstFillInput {
  return {
    platform: 'darwin',
    recentFolders: [],
    chatFolders: [],
    lastOpen: new Map(),
    exists: async () => true,
    insideApp: () => false,
    spellingOnDisk: (fsPath) => fsPath,
    uriOfPath: uriOf,
    pathOfUri: (uri) => fileURLToPath(uri),
    ...over,
  };
}

async function main(): Promise<void> {
  // ── One key per folder ──
  assert.equal(folderKey('/Users/a/Book/', 'darwin'), '/users/a/book');
  assert.equal(folderKey('/home/a/Book', 'linux'), '/home/a/Book', 'Linux keeps case');
  assert.equal(folderKey('C:\\Users\\Ana\\Book\\', 'win32'), 'c:\\users\\ana\\book');
  assert.equal(folderKey('/Users/a/Re\u0301sume\u0301', 'darwin'), folderKey('/Users/a/R\u00e9sum\u00e9', 'darwin'), 'NFC on the Mac');

  // ── S5: recent first for the spelling, chats add the rest, ordered by last open ──
  {
    const recent = ['/Users/a/Leadership programme', '/Users/a/Gone', '/Users/a/Workshop'];
    const result = await firstFill(input({
      recentFolders: recent.map((fsPath) => ({ uri: uriOf(fsPath), fsPath })),
      chatFolders: [
        { uri: uriOf('/Users/a/Leadership programme/'), lastActivityAt: '2026-10-10T00:00:00.000Z' },
        { uri: uriOf('/Users/a/Sales proposal Q4'), lastActivityAt: '2026-10-18T00:00:00.000Z' },
        { uri: uriOf('/Users/a/Gone too'), lastActivityAt: '2026-10-18T00:00:00.000Z' },
      ],
      lastOpen: new Map([[folderKey('/Users/a/Leadership programme', 'darwin'), Date.parse('2026-10-17T00:00:00.000Z')]]),
      exists: async (fsPath) => !fsPath.includes('Gone'),
    }));
    assert.deepEqual(result.map((entry) => [path.basename(fileURLToPath(entry.folderUri)), entry.foundBy]), [
      ['Sales proposal Q4', 'chats'],
      ['Leadership programme', 'recent'],
      ['Workshop', 'recent'],
    ], 'a gone folder is not added; a known time sorts it; the rest keep their recent place');
    assert.equal(result[0].lastOpenedAt, '2026-10-18T00:00:00.000Z');
    assert.equal(result[1].lastOpenedAt, '2026-10-17T00:00:00.000Z');
    assert.ok(result[2].lastOpenedAt < result[1].lastOpenedAt);
    assert.equal(result[1].folderUri, uriOf('/Users/a/Leadership programme'), 'the recent list’s spelling, not the chat’s');
  }

  // ── Windows: a folder known only from chats takes the disk's spelling ──
  {
    const spelled: string[] = [];
    const result = await firstFill(input({
      platform: 'win32',
      chatFolders: [{ uri: 'file:///c%3a/users/ana/book', lastActivityAt: '2026-10-18T00:00:00.000Z' }],
      pathOfUri: () => 'c:\\users\\ana\\book',
      spellingOnDisk: (fsPath) => {
        spelled.push(fsPath);
        return 'c:\\Users\\Ana\\Book';
      },
      uriOfPath: (fsPath) => `file:///${fsPath.replace(/\\/g, '/').replace(':', '%3A')}`,
    }));
    assert.deepEqual(spelled, ['c:\\users\\ana\\book']);
    assert.equal(result[0].folderUri, 'file:///c%3A/Users/Ana/Book');
  }

  // ── The sample inside the app; a check that hangs ──
  {
    const result = await firstFill(input({
      recentFolders: [
        { uri: uriOf('/App/Ritemark.app/sample-project/Leadership programme'), fsPath: '/App/Ritemark.app/sample-project/Leadership programme' },
        { uri: uriOf('/Volumes/share/Book'), fsPath: '/Volumes/share/Book' },
      ],
      insideApp: (fsPath) => fsPath.startsWith('/App/'),
      exists: () => new Promise(() => undefined),
    }));
    assert.deepEqual(result, [], 'a hanging share counts as not there, after the timeout');
  }

  // ── The chat store, read raw; the newest readable record names the folder ──
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-fill-'));
  try {
    const gs = path.join(root, 'User', 'globalStorage', 'ritemark.ritemark');
    const base = path.join(gs, 'conversations', 'v1');
    fs.mkdirSync(path.join(base, 'records'), { recursive: true });
    const record = (id: string, scopeId: string, kind: string, folders: string[], at: string): void => {
      fs.writeFileSync(path.join(base, 'records', `${id}.json`), JSON.stringify({ conversationId: id, scopeId, lastActivityAt: at, scope: { kind, workspaceFileUri: null, folderUris: folders } }));
    };
    record('a1', 'ps1-a', 'single-root', ['file:///Users/a/Book'], '2026-10-18T00:00:00.000Z');
    record('a2', 'ps1-a', 'single-root', ['file:///Users/a/Book'], '2026-10-10T00:00:00.000Z');
    record('m1', 'ps1-m', 'multi-root', ['file:///x', 'file:///y'], '2026-10-18T00:00:00.000Z');
    record('n1', 'ps1-n', 'no-folder', [], '2026-10-18T00:00:00.000Z');
    const entry = (conversationId: string, scopeId: string, lastActivityAt: string, integrity = 'verified'): object => ({ conversationId, scopeId, lastActivityAt, integrity });
    fs.writeFileSync(path.join(base, 'index.json'), JSON.stringify({ schemaVersion: 1, entries: [
      entry('a0', 'ps1-a', '2026-10-19T00:00:00.000Z'), // deleted meanwhile: the next is read
      entry('a1', 'ps1-a', '2026-10-18T00:00:00.000Z'),
      entry('a2', 'ps1-a', '2026-10-10T00:00:00.000Z'),
      entry('m1', 'ps1-m', '2026-10-18T00:00:00.000Z'),
      entry('n1', 'ps1-n', '2026-10-18T00:00:00.000Z'),
      entry('bad', 'ps1-b', '2026-10-18T00:00:00.000Z', 'corrupt'),
    ] }));
    const before = fs.readFileSync(path.join(base, 'index.json'), 'utf8');
    assert.deepEqual(await readChatFolders(gs), [{ uri: 'file:///Users/a/Book', lastActivityAt: '2026-10-18T00:00:00.000Z' }], 'a deleted chat lends no time');
    assert.equal(fs.readFileSync(path.join(base, 'index.json'), 'utf8'), before, 'the index is read, never written');
    // No index: the records are scanned.
    fs.writeFileSync(path.join(base, 'index.json'), '{ broken');
    assert.deepEqual(await readChatFolders(gs), [{ uri: 'file:///Users/a/Book', lastActivityAt: '2026-10-18T00:00:00.000Z' }]);

    // ── VS Code's workspace storage gives the last-open times ──
    const ws = path.join(root, 'User', 'workspaceStorage');
    const store = (id: string, folder: unknown, mtime: number | null): void => {
      fs.mkdirSync(path.join(ws, id), { recursive: true });
      fs.writeFileSync(path.join(ws, id, 'workspace.json'), JSON.stringify(folder));
      if (mtime !== null) {
        fs.writeFileSync(path.join(ws, id, 'state.vscdb'), '');
        fs.utimesSync(path.join(ws, id, 'state.vscdb'), mtime / 1000, mtime / 1000);
      }
    };
    store('one', { folder: 'file:///Users/a/Book' }, 1_700_000_000_000);
    store('two', { folder: 'file:///Users/a/Book' }, 1_700_000_500_000);
    store('three', { workspace: 'file:///Users/a/x.code-workspace' }, 1_700_000_000_000);
    store('four', { folder: 'file:///Users/a/New' }, null);
    const times = await lastOpenTimes(gs, (uri) => fileURLToPath(uri), 'darwin');
    assert.deepEqual([...times], [[folderKey('/Users/a/Book', 'darwin'), 1_700_000_500_000]]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  console.log('projects/firstFill: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
