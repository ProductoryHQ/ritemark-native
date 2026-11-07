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
  ChatDocumentsPublisher,
  LanguageLookup,
  planBringForward,
  RealPathCache,
  resolveFileIcon,
  type BringForwardDeps,
  type ChatDocumentsMessage,
  type ChatDocumentView,
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
  assert.deepEqual(chatDocumentOf(changed, real), { path: '/p/Module 2.md', openPath: '/p/Module 2.md', name: 'Module 2.md', more: 2 }, 'several: the newest, and the rest counted');
  assert.deepEqual(chatDocumentOf([changed[2]], real), { path: '/p/Advokatuur.md', openPath: '/p/Advokatuur.md', name: 'Advokatuur.md', more: 0 }, 'one file');
  assert.equal(chatDocumentOf(undefined, real), null, 'a chat that changed nothing has no document');
  assert.equal(chatDocumentOf([], real), null, 'an empty list is nothing');

  // A gone file is skipped, and never counted in "and N more"
  existing.delete('/p/Module 2.md');
  assert.deepEqual(chatDocumentOf(changed, real), { path: '/p/Module 3.md', openPath: '/p/Module 3.md', name: 'Module 3.md', more: 1 }, 'the newest that still exists');
  existing.clear();
  assert.equal(chatDocumentOf(changed, real), null, 'every file gone: no icon');

  // Unsorted input, and two stored paths to one real file, count once
  const links = (file: string) => (file === '/link/a.md' || file === '/p/a.md' ? '/p/a.md' : file === '/p/b.md' ? '/p/b.md' : null);
  assert.deepEqual(chatDocumentOf([
    { path: '/p/b.md', changedAt: '2026-11-07T09:00:00Z' },
    { path: '/link/a.md', changedAt: '2026-11-07T11:00:00Z' },
    { path: '/p/a.md', changedAt: '2026-11-07T10:00:00Z' },
  ], links), { path: '/p/a.md', openPath: '/link/a.md', name: 'a.md', more: 1 }, 'newest first whatever the order; one real file counts once');

  // Review finding 2: a closed document opens at the path the project uses, never at its realpath (`/private/...`)
  const privateReal = (file: string) => (file.startsWith('/var/') ? `/private${file}` : file);
  const document = chatDocumentOf([{ path: '/var/ws/Plan.md', changedAt: '2026-11-07T10:00:00Z' }], privateReal);
  assert.equal(document?.openPath, '/var/ws/Plan.md', 'finding 2: the stored path is what opens');
  assert.equal(document?.path, '/private/var/ws/Plan.md', 'finding 2: the realpath stays the comparison key');
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
  assert.deepEqual(documents.a, { path: '/p/Advokatuur.md', openPath: '/p/Advokatuur.md', name: 'Advokatuur.md', more: 0, iconUri: 'icon:Advokatuur.md' });
}

// ── review finding 4: a file's language from the installed extensions' contributes.languages ──
{
  const fakeExtensions = [
    { id: 'markdown', extensions: ['.md', '.mkd', '.mdwn', '.mdown', '.markdown'] },
    { id: 'json', extensions: ['.json'], filenames: ['.babelrc'] },
    { id: 'flow', extensions: ['.flow.json'] },
    { id: 'yaml', filenames: ['Pipfile.lock.yaml'] },
    { extensions: ['.nothing'] }, // no id: ignored
  ];
  const languages = new LanguageLookup(fakeExtensions);
  assert.equal(languages.languageOf('/p/Notes.mdown'), 'markdown', 'finding 4: .mdown is markdown');
  assert.equal(languages.languageOf('/p/Notes.MKD'), 'markdown', 'finding 4: .mkd, case-insensitively');
  assert.equal(languages.languageOf('/p/.babelrc'), 'json', 'a file name');
  assert.equal(languages.languageOf('/p/Course.flow.json'), 'flow', 'the longest extension first');
  assert.equal(languages.languageOf('/p/notes.txt'), undefined, 'no language');
  // Keep the theme lookup's order: the language comes in only after names and extensions
  assert.equal(resolveFileIcon(theme, '/p/Notes.mdown', { kind: 'light', languageId: languages.languageOf('/p/Notes.mdown') }), './icons/file-text.svg', 'finding 4: .mdown gets markdown\'s icon');
  assert.equal(resolveFileIcon(theme, '/p/Notes.mkd', { kind: 'dark', languageId: languages.languageOf('/p/Notes.mkd') }), './icons/dark/file-text.svg', 'finding 4: .mkd (dark)');
}

// ── review finding 6: a second update with no file events reads nothing from disk ──
{
  let calls = 0;
  const cache = new RealPathCache((file) => { calls += 1; return file.startsWith('/gone/') ? null : file; });
  const chats = Array.from({ length: 20 }, (_, chat) => ({
    conversationId: `c${chat}`,
    changedFiles: Array.from({ length: 50 }, (_, n) => ({ path: n === 0 ? `/gone/${chat}.md` : `/p/${chat}-${n}.md`, changedAt: `2026-11-07T10:${String(n).padStart(2, '0')}:00Z` })),
  }));
  chatDocumentsFor(chats, (file) => cache.get(file), () => 'icon');
  const first = calls;
  assert.equal(first, 1000, 'the first update reads each file once');
  chatDocumentsFor(chats, (file) => cache.get(file), () => 'icon');
  assert.equal(calls, first, 'finding 6: no file events, no new fs calls');
  cache.forgetMissing();
  chatDocumentsFor(chats, (file) => cache.get(file), () => 'icon');
  assert.equal(calls, first + 20, 'a chat change asks only the gone files again');
  cache.clear();
  chatDocumentsFor(chats, (file) => cache.get(file), () => 'icon');
  assert.equal(calls, first * 2 + 20, 'a file event reads them again');
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
  // Review finding 3: a diff tab (File changes, Review) is not the document's tab
  const diffOnly: TabGroupFact[] = [{ viewColumn: 1, isActive: true, tabs: [{ path: '/p/Home', isActive: true }, { path: '/p/x.md', isActive: false, isDiff: true }] }];
  assert.deepEqual(planBringForward(diffOnly, '/p/x.md'), { kind: 'open' }, 'finding 3: only a diff tab shows it: the document opens');
  const diffAndTab: TabGroupFact[] = [
    { viewColumn: 1, isActive: true, tabs: [{ path: '/p/x.md', isActive: true, isDiff: true }] },
    { viewColumn: 2, isActive: false, tabs: [{ path: '/p/x.md', isActive: false }] },
  ];
  assert.deepEqual(planBringForward(diffAndTab, '/p/x.md'), { kind: 'reveal', group: 1, tab: 0 }, 'finding 3: the document\'s own tab, not the diff in front');
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
    run.deps.tabWaitMs = 20;
    run.deps.onDidChangeTabs = () => ({ dispose() {} });
    run.calls.length = 0;
    assert.equal(await bringDocumentForward('/p/b.md', run.deps), 'opened');
    assert.deepEqual(run.calls, ['open /p/b.md'], 'waiting for a tab that never comes ends, and moves nothing');
  }
  {
    // Review finding 2: the click opens the stored path; the realpath only finds the tab
    const run = fakeDeps([{ viewColumn: 1, isActive: true, tabs: [{ path: '/p/a.md', isActive: true }] }]);
    assert.equal(await bringDocumentForward('/private/var/ws/Plan.md', run.deps, '/var/ws/Plan.md'), 'opened');
    assert.deepEqual(run.calls, ['open /var/ws/Plan.md'], 'finding 2: opens /var/..., never /private/var/...');
  }
  {
    // Review finding 7: a custom editor's tab shows up after `vscode.open` resolved; the move waits for it
    const run = fakeDeps([{ viewColumn: 1, isActive: true, tabs: [{ path: '/p/Home', isActive: true }, { path: '/p/a.md', isActive: false }] }]);
    const listeners = new Set<() => void>();
    const instantOpen = run.deps.open;
    run.deps.open = async (file) => {
      setTimeout(() => { void instantOpen(file).then(() => listeners.forEach((listener) => listener())); }, 30);
    };
    run.deps.onDidChangeTabs = (listener) => { listeners.add(listener); return { dispose: () => { listeners.delete(listener); } }; };
    assert.equal(await bringDocumentForward('/p/Closed.md', run.deps), 'opened');
    assert.deepEqual(run.calls, ['open /p/Closed.md', 'move to end'], 'finding 7: the late tab still goes to the row\'s end');
    assert.deepEqual(run.groups[0].tabs.map((t) => t.path), ['/p/Home', '/p/a.md', '/p/Closed.md']);
    assert.equal(listeners.size, 0, 'the wait lets go of the event');
  }
}

// ── review finding 1: a sheet resolved again gets the icons and the order again ──
async function publisher(): Promise<void> {
  const documents: Record<string, ChatDocumentView> = { a: { path: '/p/a.md', openPath: '/p/a.md', name: 'a.md', more: 0, iconUri: 'icon' } };
  let view: { id: number } | undefined = { id: 1 };
  const posts: { view: number; message: ChatDocumentsMessage }[] = [];
  const sender = new ChatDocumentsPublisher<{ id: number }>({
    view: () => view,
    documents: async () => documents,
    front: () => '/p/a.md',
    post: async (target, message) => { posts.push({ view: target.id, message }); return true; },
  });
  assert.equal(await sender.send(), true, 'the first send posts');
  assert.equal(await sender.send(), false, 'nothing changed: nothing posts');
  // The view is resolved again (moved, Reload Webviews, process restart): its bootstrap resets, then sends
  view = { id: 2 };
  sender.reset();
  assert.equal(await sender.send(), true, 'finding 1: after a second resolve, the next send posts again');
  assert.equal(posts.length, 2);
  assert.equal(posts[1].view, 2, 'to the new view');
  assert.deepEqual(posts[1].message, { type: 'chat-documents', documents, front: '/p/a.md' });

  // The host glue: the bootstrap branch resets before it schedules the send
  const host = fs.readFileSync(path.join(__dirname, 'UnifiedViewProvider.ts'), 'utf8');
  const bootstrap = host.slice(host.indexOf("case 'agent:bootstrap/request': {"));
  const reset = bootstrap.indexOf('this._chatDocumentsPublisher.reset()');
  const schedule = bootstrap.indexOf('this._scheduleChatDocuments()');
  assert.ok(reset >= 0 && reset < schedule, 'finding 1: the bootstrap clears the sent copy before it schedules');
}

clicks().then(publisher).then(() => console.log('chatDocuments.test.ts: all passed'), (error) => { console.error(error); process.exit(1); });
