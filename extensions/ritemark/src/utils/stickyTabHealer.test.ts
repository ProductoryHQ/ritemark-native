/**
 * Sprint 107 R3 — stuck-tab candidate selection tests over fabricated groups.
 */
import assert from 'node:assert/strict';
import { findReplacedTextTab, findStuckMarkdownTabs, type TabGroupLike } from './stickyTabHealer';

// Fabricated inputs: TEXT = plain text editor on file://, others must be ignored.
const TEXT = (path: string) => ({ kind: 'text', path });
const CUSTOM = (path: string) => ({ kind: 'custom', path });
const DIFF = { kind: 'diff' };
const UNTITLED = { kind: 'untitled' };

const resolve = (input: unknown): { path: string } | null => {
  const i = input as { kind?: string; path?: string };
  return i && i.kind === 'text' && i.path ? { path: i.path } : null;
};

const groups: TabGroupLike[] = [
  {
    viewColumn: 1,
    tabs: [
      { input: TEXT('/ws/notes.md'), isActive: true, isPinned: false },          // stuck → candidate
      { input: TEXT('/ws/script.ts'), isActive: false, isPinned: false },        // not markdown
      { input: CUSTOM('/ws/other.md'), isActive: false, isPinned: false },       // already custom editor
      { input: DIFF, isActive: false, isPinned: false },                          // diff — ignored
    ],
  },
  {
    viewColumn: 2,
    tabs: [
      { input: TEXT('/ws/README.MARKDOWN'), isActive: false, isPinned: true },   // case-insensitive ext
      { input: UNTITLED, isActive: false, isPinned: false },                      // untitled — ignored
    ],
  },
];

const found = findStuckMarkdownTabs(groups, resolve);
assert.equal(found.length, 2, 'exactly the two stuck markdown text tabs');
assert.deepEqual(found[0], { uri: { path: '/ws/notes.md' }, isActive: true, isPinned: false, viewColumn: 1, tab: groups[0].tabs[0], replace: true });
assert.deepEqual(found[1], { uri: { path: '/ws/README.MARKDOWN' }, isActive: false, isPinned: true, viewColumn: 2, tab: groups[1].tabs[0], replace: true });

// Sprint 133 (R11, #429): the healer replaces the text tab, so the file ends with one tab.
// A text tab with unsaved changes is kept: closing it would ask to save.
const dirty = findStuckMarkdownTabs([{ viewColumn: 1, tabs: [{ input: TEXT('/ws/draft.md'), isActive: true, isPinned: false, isDirty: true }] }], resolve);
assert.equal(dirty.length, 1);
assert.equal(dirty[0].replace, false, 'a dirty text tab is not closed');
assert.equal(found[0].tab, groups[0].tabs[0], 'the candidate carries its own tab, to close it');

// Zero stuck tabs → empty, no throw (healer must be inert).
assert.deepEqual(findStuckMarkdownTabs([], resolve), []);
assert.deepEqual(findStuckMarkdownTabs([{ viewColumn: 1, tabs: [{ input: CUSTOM('/a.md'), isActive: false, isPinned: false }] }], resolve), []);

// Sprint 133 (#429): after the Ritemark editor opened, the text tab is found again, in its own group only.
const afterOpen = [
  { viewColumn: 1, tabs: [
    { input: TEXT('/ws/notes.md'), isActive: false, isPinned: false },
    { input: CUSTOM('/ws/notes.md'), isActive: true, isPinned: false },
  ] },
  { viewColumn: 2, tabs: [{ input: TEXT('/ws/notes.md'), isActive: true, isPinned: false }] },
];
assert.equal(findReplacedTextTab(afterOpen, resolve, { path: '/ws/notes.md', viewColumn: 1 }), afterOpen[0].tabs[0]);
assert.equal(findReplacedTextTab(afterOpen, resolve, { path: '/ws/notes.md', viewColumn: 2 }), afterOpen[1].tabs[0]);
assert.equal(findReplacedTextTab(afterOpen, resolve, { path: '/ws/other.md', viewColumn: 1 }), undefined);
assert.equal(
  findReplacedTextTab([{ viewColumn: 1, tabs: [{ input: TEXT('/ws/notes.md'), isActive: false, isPinned: false, isDirty: true }] }], resolve, { path: '/ws/notes.md', viewColumn: 1 }),
  undefined,
  'a dirty text tab is not closed',
);

console.log('stickyTabHealer tests passed.');
