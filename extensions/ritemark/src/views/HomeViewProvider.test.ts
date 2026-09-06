/**
 * Tests for HomeViewProvider._recentDocuments (#194).
 *
 * Run: npx tsx src/views/HomeViewProvider.test.ts
 */

// ── Minimal vscode stub ──────────────────────────────────────────────────────
// HomeViewProvider imports vscode for workspace.findFiles/fs.stat.
// Pre-populate the require cache before any other imports (same pattern as
// BrowserToolsInjector.test.ts).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
  _cache: Record<string, unknown>;
};

// Simulate a workspace with more files than the old 200-file pre-sort cap.
const TOTAL_FILES = 300;
// The newest file sits at crawl-order index 250 — past the old cap, so the
// old implementation could never see it no matter how new it was.
const NEWEST_INDEX = 250;

interface FakeUri { fsPath: string; scheme: 'file'; }
function fakeUri(fsPath: string): FakeUri { return { fsPath, scheme: 'file' }; }

const fakeFiles: FakeUri[] = Array.from({ length: TOTAL_FILES }, (_, i) => fakeUri(`/ws/doc-${i}.md`));
const mtimeByPath = new Map<string, number>(
  fakeFiles.map((f, i) => [f.fsPath, i === NEWEST_INDEX ? 999_999_999 : i])
);

let requestedMaxResults = 0;

const vscodeMod = {
  workspace: {
    workspaceFolders: [{ uri: fakeUri('/ws'), name: 'ws', index: 0 }],
    findFiles: async (_include: string, _exclude: string, maxResults: number) => {
      requestedMaxResults = maxResults;
      return fakeFiles.slice(0, Math.min(maxResults, fakeFiles.length));
    },
    fs: {
      stat: async (uri: FakeUri) => ({ mtime: mtimeByPath.get(uri.fsPath) ?? 0 }),
    },
    asRelativePath: (uri: FakeUri) => uri.fsPath.replace(/^\/ws\//, ''),
    onDidSaveTextDocument: () => ({ dispose: () => undefined }),
  },
  Uri: {
    joinPath: (...parts: unknown[]) => parts[parts.length - 1],
    file: (p: string) => fakeUri(p),
  },
};

const _originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') { return '__vscode_stub__'; }
  return _originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__',
  filename: '__vscode_stub__',
  loaded: true,
  children: [],
  paths: [],
  exports: vscodeMod,
};

// ── Now safe to import vscode-dependent modules ──────────────────────────────
// Runtime require() (not a static import) so tsx's ESM-aware resolver doesn't
// hoist the import above the stub registration.
import * as assert from 'assert';
const { HomeViewProvider } = require('./HomeViewProvider') as typeof import('./HomeViewProvider');

let passed = 0;
function test(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve(fn()).then(() => {
    passed++;
    console.log(`  ✓ ${name}`);
  });
}

async function main() {
  console.log('HomeViewProvider');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = new (HomeViewProvider as any)(fakeUri('/ext'), true);

  await test('the true newest file (beyond the old 200 cap) is in the top 5', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recents: Array<{ label: string; fsPath: string }> = await (provider as any)._recentDocuments();
    assert.strictEqual(recents.length, 5);
    assert.strictEqual(recents[0].fsPath, `/ws/doc-${NEWEST_INDEX}.md`, 'newest file should sort first');
  });

  await test('results are sorted newest first', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recents: Array<{ fsPath: string }> = await (provider as any)._recentDocuments();
    const mtimes = recents.map((r) => mtimeByPath.get(r.fsPath) ?? -1);
    const sorted = [...mtimes].sort((a, b) => b - a);
    assert.deepStrictEqual(mtimes, sorted);
  });

  await test('requests far more than the old 200-file cap (runaway guard only)', () => {
    assert.ok(requestedMaxResults >= 5000, `expected a high cap, got ${requestedMaxResults}`);
  });

  console.log(`\n${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
