/**
 * Sprint 148 (R1, A4): what the walk covers and leaves out, on a fixture tree
 * written to a temporary folder, and the cloud-file rule.
 * Run: npx tsx src/search/worker/walk.test.ts
 */
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { cloudState, inOneDriveFolder, oneDriveRootsFromEnv } from './cloudFiles';
import { ABOUT_THIS_PROJECT, RootRules, classifyPath, globToRegExp, isRuleFile, walkProject, type WalkFs, type WalkStat } from './walk';

const pause = () => Promise.resolve();

const nodeFs: WalkFs = {
  readdir: (dir) => fsp.readdir(dir, { withFileTypes: true }),
  stat: (target) => fsp.stat(target),
  readHead: async (target, maxBytes) => new Uint8Array((await fsp.readFile(target)).subarray(0, maxBytes)),
};

async function write(root: string, relative: string, text = 'words'): Promise<void> {
  const target = path.join(root, relative);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, text);
}

async function main() {
  // ── files.exclude globs ─────────────────────────────────────────────────────
  assert.ok(globToRegExp('**/.ritemark').test('.ritemark'));
  assert.ok(globToRegExp('**/.ritemark').test('a/b/.ritemark'));
  assert.ok(globToRegExp('**/.claude/worktrees').test('.claude/worktrees'));
  assert.ok(globToRegExp('**/*.log').test('deep/x.log'));
  assert.ok(!globToRegExp('*.md').test('deep/x.md'), 'no slash: the root only');
  assert.ok(globToRegExp('drafts/**').test('drafts/a/b.md'));
  assert.ok(globToRegExp('{old,archive}').test('archive'));
  assert.ok(globToRegExp('report-[0-9].md').test('report-7.md'));
  assert.ok(!globToRegExp('Drafts').test('drafts'), 'case counts on the Mac, as VS Code\'s glob');
  assert.ok(globToRegExp('Drafts', true).test('drafts'), 'not on Windows');

  // ── The cloud-file rule ─────────────────────────────────────────────────────
  assert.equal(cloudState('/u/iCloud/a.pdf', { size: 5000, blocks: 0 }, 'darwin', []), 'online-only', 'dataless: a size, no blocks');
  assert.equal(cloudState('/u/a.pdf', { size: 5000, blocks: 16 }, 'darwin', []), null);
  assert.equal(cloudState('/u/empty.md', { size: 0, blocks: 0 }, 'darwin', []), null, 'an empty file is no cloud file');
  assert.equal(cloudState('C:\\Users\\m\\OneDrive\\a.docx', { size: 1, blocks: 8 }, 'win32', []), 'cloud-folder');
  assert.equal(cloudState('C:\\Users\\m\\OneDrive - Productory\\a.docx', { size: 1, blocks: 8 }, 'win32', []), 'cloud-folder');
  assert.equal(cloudState('D:\\Sync\\a.docx', { size: 1, blocks: 8 }, 'win32', ['D:\\Sync']), 'cloud-folder', 'the OneDrive* variables');
  assert.equal(cloudState('D:\\Work\\a.docx', { size: 1, blocks: 8 }, 'win32', ['D:\\Sync']), null);
  assert.ok(!inOneDriveFolder('D:\\Syncing\\a.docx', ['D:\\Sync']), 'a folder that only starts the same');
  assert.deepEqual(oneDriveRootsFromEnv({ OneDrive: 'C:\\o', OneDriveCommercial: 'C:\\o', OneDriveConsumer: ' ', PATH: 'x' }), ['C:\\o']);

  // ── The walk on a fixture tree ──────────────────────────────────────────────
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'search-walk-'));
  try {
    await write(root, 'Notes.md');
    await write(root, 'AGENTS.md', '# About');
    await write(root, 'CLAUDE.md', '@AGENTS.md\n');
    await write(root, 'Budget.CSV');
    await write(root, 'Report.docx');
    await write(root, 'Scan.pdf');
    await write(root, 'image.png');
    await write(root, '~$Report.docx');
    await write(root, 'team/Plan.markdown');
    await write(root, 'team/deep/Minutes.md');
    await write(root, '.ritemark/tasks/1-card.md');
    await write(root, '.claude/notes.md');
    await write(root, '.github/README.md');
    await write(root, 'node_modules/pkg/README.md');
    await write(root, 'team/node_modules/x.md');
    await write(root, '.gitignore', 'build/\n*.tmp.md\n!keep.tmp.md\n');
    await write(root, 'build/out.md');
    await write(root, 'a.tmp.md');
    await write(root, 'keep.tmp.md');
    await write(root, 'team/.gitignore', 'private/\n!Minutes.md\nPlan.markdown\n');
    await write(root, 'team/private/Secret.md');
    await write(root, '.git/info/exclude', 'local-only.md\n');
    await write(root, 'local-only.md');
    await write(root, 'drafts/Draft.md');
    await fsp.mkdir(path.join(root, 'elsewhere'));
    await write(root, 'elsewhere/Linked.md');
    await fsp.symlink(path.join(root, 'elsewhere'), path.join(root, 'linked-folder'));
    await fsp.symlink(path.join(root, 'Notes.md'), path.join(root, 'Linked note.md'));

    const rulesOut = new Map<string, RootRules>();
    const { documents, limited } = await walkProject(
      [{ path: root, name: 'fixture' }],
      { platform: process.platform, oneDriveRoots: [], filesExclude: { [root]: ['**/.ritemark', 'drafts'] } },
      nodeFs,
      100_000,
      pause,
      rulesOut,
    );
    const found = documents.map((doc) => doc.relativePath).sort();
    assert.deepEqual(found, [
      'AGENTS.md',
      'Budget.CSV',
      'Linked note.md',
      'Notes.md',
      'Report.docx',
      'Scan.pdf',
      'elsewhere/Linked.md',
      'keep.tmp.md',
      'team/deep/Minutes.md',
    ]);
    assert.equal(limited, false);
    const byPath = new Map(documents.map((doc) => [doc.relativePath, doc]));
    assert.equal(byPath.get('AGENTS.md')!.name, ABOUT_THIS_PROJECT, 'the root AGENTS.md is About this project');
    assert.equal(byPath.get('Budget.CSV')!.format, 'csv');
    assert.equal(byPath.get('Budget.CSV')!.name, 'Budget');
    assert.equal(byPath.get('team/deep/Minutes.md')!.where, 'deep', 'the folder\'s name');
    assert.equal(byPath.get('Notes.md')!.where, null, 'nothing at the root');

    // A CLAUDE.md with the person's own words stays.
    await write(root, 'CLAUDE.md', '@AGENTS.md\n\nAlso: my own rules.');
    const again = await walkProject([{ path: root, name: 'fixture' }], { platform: process.platform, oneDriveRoots: [], filesExclude: {} }, nodeFs, 100_000, pause);
    assert.ok(again.documents.some((doc) => doc.relativePath === 'CLAUDE.md'));
    assert.ok(again.documents.some((doc) => doc.relativePath === 'drafts/Draft.md'), 'files.exclude is the person\'s, per root');

    // The limit on names stops the walk and says so.
    const capped = await walkProject([{ path: root, name: 'fixture' }], { platform: process.platform, oneDriveRoots: [], filesExclude: {} }, nodeFs, 3, pause);
    assert.equal(capped.documents.length, 3);
    assert.equal(capped.limited, true);

    // The watcher's events are judged by the same rules.
    const rules = rulesOut.get(root)!;
    assert.equal((await classifyPath(path.join(root, 'team/deep/Minutes.md'), rules, nodeFs))?.name, 'Minutes');
    assert.equal(await classifyPath(path.join(root, 'team/private/Secret.md'), rules, nodeFs), null, 'inside an ignored folder');
    assert.equal(await classifyPath(path.join(root, '.claude/notes.md'), rules, nodeFs), null, 'a dot folder');
    assert.equal(await classifyPath(path.join(root, 'build/out.md'), rules, nodeFs), null);
    assert.equal(await classifyPath(path.join(root, 'image.png'), rules, nodeFs), null, 'not a kind search reads');
    assert.equal(await classifyPath(path.join(root, 'gone.md'), rules, nodeFs), null, 'gone');
    assert.ok(isRuleFile(path.join(root, 'team/.gitignore'), root));
    assert.ok(isRuleFile(path.join(root, '.git/info/exclude'), root));
    assert.ok(!isRuleFile(path.join(root, 'Notes.md'), root));

    // A file kept only online is listed, never read: the walk asks only stat and readdir.
    const opened: string[] = [];
    const cloudFs: WalkFs = {
      readdir: nodeFs.readdir,
      stat: async (target) => {
        const stat = await fsp.stat(target);
        const dataless = target.endsWith('Report.docx') || target.endsWith('.gitignore');
        return { size: dataless ? 9000 : stat.size, mtimeMs: stat.mtimeMs, blocks: dataless ? 0 : stat.blocks, isFile: () => stat.isFile(), isDirectory: () => stat.isDirectory() } satisfies WalkStat;
      },
      readHead: async (target, max) => {
        opened.push(path.relative(root, target));
        return nodeFs.readHead(target, max);
      },
    };
    const cloud = await walkProject([{ path: root, name: 'fixture' }], { platform: 'darwin', oneDriveRoots: [], filesExclude: {} }, cloudFs, 100_000, pause);
    assert.equal(cloud.documents.find((doc) => doc.relativePath === 'Report.docx')?.cloud, 'online-only');
    assert.ok(!opened.some((name) => name.endsWith('.gitignore')), 'a dataless .gitignore is not read');
    assert.ok(cloud.documents.some((doc) => doc.relativePath === 'build/out.md'), 'so its rules are missing, and nothing is downloaded');

    // Windows, a project in OneDrive: nothing is read, not even its .gitignore.
    const windowsOpened: string[] = [];
    const windowsFs: WalkFs = { ...nodeFs, readHead: async (target, max) => { windowsOpened.push(target); return nodeFs.readHead(target, max); } };
    const inOneDrive = await walkProject([{ path: root, name: 'fixture' }], { platform: 'win32', oneDriveRoots: [root], filesExclude: {} }, windowsFs, 100_000, pause);
    assert.deepEqual(windowsOpened, []);
    assert.ok(inOneDrive.documents.every((doc) => doc.cloud === 'cloud-folder'));
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }

  console.log('walk.test.ts: all passed');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
