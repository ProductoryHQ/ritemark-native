/**
 * Sprint 155 (PR 2) — each chat shows its document: which document a chat's
 * icon is, its file icon from Ritemark's own theme, and the click that brings
 * it forward.
 *
 * What a person loses if this is wrong: the icon names a file that is gone, or
 * a tab a click can't reach; the head draws a stranger's icon; or the click
 * opens a second copy of a tab it should have brought forward.
 *
 * Run with `npx tsx src/views/chatDocuments.test.ts`.
 */
import { strict as assert } from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  bringDocumentForward,
  chatDocumentOf,
  chatDocumentsFor,
  planBringForward,
  resolveFileIcon,
  type BringForwardDeps,
  type FileIconTheme,
  type TabGroupFact,
} from './chatDocuments';

const theme = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'fileicons', 'ritemark-icon-theme.json'), 'utf8')) as FileIconTheme;

// ── which document: the newest change to a file that still exists ──
{
  const existing = new Set(['/p/Module 2.md', '/p/Advokatuur.md', '/p/Module 3.md']);
  const real = (file: string) => (existing.has(file) ? file : null);
  const changed = [
    { path: '/p/Module 2.md', changedAt: '2026-11-07T10:03:00Z' },
    { path: '/p/Module 3.md', changedAt: '2026-11-07T10:02:00Z' },
    { path: '/p/Advokatuur.md', changedAt: '2026-11-07T10:01:00Z' },
  ];
  assert.deepEqual(chatDocumentOf(changed, real), { path: '/p/Module 2.md', name: 'Module 2.md', more: 2 }, 'several: the newest, and the rest counted');
  assert.deepEqual(chatDocumentOf([changed[2]], real), { path: '/p/Advokatuur.md', name: 'Advokatuur.md', more: 0 }, 'one file');
  assert.equal(chatDocumentOf(undefined, real), null, 'a chat that changed nothing has no document');
  assert.equal(chatDocumentOf([], real), null, 'an empty list is nothing');

  // A gone file is skipped, and never counted in "and N more"
  existing.delete('/p/Module 2.md');
  assert.deepEqual(chatDocumentOf(changed, real), { path: '/p/Module 3.md', name: 'Module 3.md', more: 1 }, 'the newest that still exists');
  existing.clear();
  assert.equal(chatDocumentOf(changed, real), null, 'every file gone: no icon');

  // Unsorted input, and two stored paths to one real file, count once
  const links = (file: string) => (file === '/link/a.md' || file === '/p/a.md' ? '/p/a.md' : file === '/p/b.md' ? '/p/b.md' : null);
  assert.deepEqual(chatDocumentOf([
    { path: '/p/b.md', changedAt: '2026-11-07T09:00:00Z' },
    { path: '/link/a.md', changedAt: '2026-11-07T11:00:00Z' },
    { path: '/p/a.md', changedAt: '2026-11-07T10:00:00Z' },
  ], links), { path: '/p/a.md', name: 'a.md', more: 1 }, 'newest first whatever the order; one real file counts once');
}

// ── the theme: fileNames, then fileExtensions, then languageIds, then the default ──
{
  assert.equal(resolveFileIcon(theme, '/p/Module 2.md', { kind: 'light' }), './icons/file-text.svg', 'markdown by extension (light)');
  assert.equal(resolveFileIcon(theme, '/p/Module 2.md', { kind: 'dark' }), './icons/dark/file-text.svg', 'markdown by extension (dark)');
  assert.equal(resolveFileIcon(theme, '/p/README.md', { kind: 'light' }), './icons/book-open.svg', 'fileNames win over the extension, case-insensitively');
  assert.equal(resolveFileIcon(theme, '/p/AGENTS.md', { kind: 'dark' }), './icons/dark/book-open.svg', 'fileNames (dark)');
  assert.equal(resolveFileIcon(theme, '/p/Course.flow.json', { kind: 'light' }), './icons/flow-arrow.svg', 'the longest extension first');
  assert.equal(resolveFileIcon(theme, '/p/data.json', { kind: 'light' }), './icons/braces.svg', 'then the short one');
  assert.equal(resolveFileIcon(theme, '/p/Budget.XLSX', { kind: 'light' }), './icons/file-xls.svg', 'extensions case-insensitively');
  assert.equal(resolveFileIcon(theme, '/p/Makefile', { kind: 'light', languageId: 'yaml' }), './icons/settings.svg', 'languageIds after names and extensions');
  assert.equal(resolveFileIcon(theme, '/p/notes.txt', { kind: 'light', languageId: 'plaintext' }), './icons/file.svg', 'the default file icon (light)');
  assert.equal(resolveFileIcon(theme, '/p/notes.txt', { kind: 'dark' }), './icons/dark/file.svg', 'the default file icon (dark)');
  assert.equal(resolveFileIcon(theme, 'C:\\Work\\Plan.docx', { kind: 'light' }), './icons/file-doc.svg', 'a Windows path');
  // Every icon the theme names is a file that ships
  for (const [id, definition] of Object.entries(theme.iconDefinitions)) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'fileicons', definition.iconPath)), `${id} ships`);
  }
}

// ── every chat's document, with its icon ──
{
  const real = (file: string) => (file.startsWith('/gone/') ? null : file);
  const documents = chatDocumentsFor([
    { conversationId: 'a', changedFiles: [{ path: '/p/Advokatuur.md', changedAt: '2026-11-07T10:00:00Z' }] },
    { conversationId: 'b' },
    { conversationId: 'c', changedFiles: [{ path: '/gone/x.md', changedAt: '2026-11-07T10:00:00Z' }] },
  ], real, (file) => `icon:${path.basename(file)}`);
  assert.deepEqual(Object.keys(documents), ['a'], 'only chats with a document that exists');
  assert.deepEqual(documents.a, { path: '/p/Advokatuur.md', name: 'Advokatuur.md', more: 0, iconUri: 'icon:Advokatuur.md' });
}

// ── the click: bring the tab forward in its own group, or open it at the row's end ──
const groups: TabGroupFact[] = [
  { viewColumn: 1, isActive: true, tabs: [{ path: '/p/Home', isActive: false }, { path: '/p/Advokatuur.md', isActive: true }] },
  { viewColumn: 2, isActive: false, tabs: [{ path: '/p/Module 2.md', isActive: false }, { path: '/p/Module 3.md', isActive: true }] },
];
{
  assert.deepEqual(planBringForward(groups, '/p/Module 2.md'), { kind: 'reveal', group: 1, tab: 0 }, 'a tab in another group comes forward there');
  assert.deepEqual(planBringForward(groups, '/p/Advokatuur.md'), { kind: 'reveal', group: 0, tab: 1 }, 'the tab in front stays');
  assert.deepEqual(planBringForward(groups, '/p/Closed.md'), { kind: 'open' }, 'a closed document opens');
  const both: TabGroupFact[] = [
    { viewColumn: 1, isActive: false, tabs: [{ path: '/p/x.md', isActive: false }] },
    { viewColumn: 2, isActive: true, tabs: [{ path: '/p/x.md', isActive: false }] },
  ];
  assert.deepEqual(planBringForward(both, '/p/x.md'), { kind: 'reveal', group: 1, tab: 0 }, 'open in two groups: the active group first');
  assert.deepEqual(planBringForward(groups, '/p/module 2.md', (a, b) => a.toLowerCase() === b.toLowerCase()), { kind: 'reveal', group: 1, tab: 0 }, 'the host compares paths its own way');
}

function fakeDeps(start: TabGroupFact[]): { deps: BringForwardDeps; calls: string[]; groups: TabGroupFact[] } {
  const state = start.map((group) => ({ ...group, tabs: group.tabs.map((tab) => ({ ...tab })) }));
  const calls: string[] = [];
  const deps: BringForwardDeps = {
    groups: () => state,
    reveal: async (group, tab) => {
      calls.push(`reveal ${group}:${tab}`);
      state.forEach((g, gi) => { g.isActive = gi === group; });
      state[group].tabs.forEach((t, ti) => { t.isActive = ti === tab; });
    },
    open: async (file) => {
      calls.push(`open ${file}`);
      const active = state.find((g) => g.isActive)!;
      const at = active.tabs.findIndex((t) => t.isActive) + 1; // VS Code opens to the right of the active tab
      active.tabs.forEach((t) => { t.isActive = false; });
      active.tabs.splice(at, 0, { path: file, isActive: true });
    },
    moveActiveToEnd: async () => {
      calls.push('move to end');
      const active = state.find((g) => g.isActive)!;
      const at = active.tabs.findIndex((t) => t.isActive);
      active.tabs.push(...active.tabs.splice(at, 1));
    },
  };
  return { deps, calls, groups: state };
}

async function clicks(): Promise<void> {
  {
    const run = fakeDeps(groups);
    assert.equal(await bringDocumentForward('/p/Module 2.md', run.deps), 'revealed');
    assert.deepEqual(run.calls, ['reveal 1:0'], 'an open tab is brought forward, never opened again');
    assert.equal(run.groups[1].isActive, true, 'in its own group');
  }
  {
    // Home in front: the workbench opens the new tab beside it, in the row's middle
    const run = fakeDeps([{ viewColumn: 1, isActive: true, tabs: [{ path: '/p/Home', isActive: true }, { path: '/p/Advokatuur.md', isActive: false }] }, groups[1]]);
    assert.equal(await bringDocumentForward('/p/Closed.md', run.deps), 'opened');
    assert.deepEqual(run.calls, ['open /p/Closed.md', 'move to end'], 'a closed document opens, then goes to the row\'s end');
    assert.deepEqual(run.groups[0].tabs.map((t) => t.path), ['/p/Home', '/p/Advokatuur.md', '/p/Closed.md']);
    assert.equal(run.groups[0].tabs[2].isActive, true);
  }
  {
    // Opened as the last tab already: nothing moves
    const run = fakeDeps([{ viewColumn: 1, isActive: true, tabs: [{ path: '/p/a.md', isActive: true }] }]);
    assert.equal(await bringDocumentForward('/p/b.md', run.deps), 'opened');
    assert.deepEqual(run.calls, ['open /p/b.md'], 'no move when it already is at the end');
  }
  {
    // The open didn't put the document in front (refused, another editor): nothing else is moved
    const run = fakeDeps([{ viewColumn: 1, isActive: true, tabs: [{ path: '/p/a.md', isActive: true }, { path: '/p/c.md', isActive: false }] }]);
    run.deps.open = async (file) => { run.calls.push(`open ${file}`); };
    assert.equal(await bringDocumentForward('/p/b.md', run.deps), 'opened');
    assert.deepEqual(run.calls, ['open /p/b.md'], 'never moves a tab that isn\'t the document');
  }
}

clicks().then(() => console.log('chatDocuments.test.ts: all passed'), (error) => { console.error(error); process.exit(1); });
