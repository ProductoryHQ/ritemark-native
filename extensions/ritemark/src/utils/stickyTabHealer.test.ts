/**
 * Sprint 107 R3 — stuck-tab candidate selection tests over fabricated groups.
 */
import assert from 'node:assert/strict';
import { findStuckMarkdownTabs, type TabGroupLike } from './stickyTabHealer';

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
assert.deepEqual(found[0], { uri: { path: '/ws/notes.md' }, isActive: true, isPinned: false, viewColumn: 1 });
assert.deepEqual(found[1], { uri: { path: '/ws/README.MARKDOWN' }, isActive: false, isPinned: true, viewColumn: 2 });

// Zero stuck tabs → empty, no throw (healer must be inert).
assert.deepEqual(findStuckMarkdownTabs([], resolve), []);
assert.deepEqual(findStuckMarkdownTabs([{ viewColumn: 1, tabs: [{ input: CUSTOM('/a.md'), isActive: false, isPinned: false }] }], resolve), []);

console.log('stickyTabHealer tests passed.');
