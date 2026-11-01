/**
 * Sprint 145 R1 (revised 1 November, #588): blocks, the base and the three-way block merge.
 *
 * Run: npx tsx src/editorSync/merge.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { findBase, mergeBlocks, splitBlocks } from './merge';

const join = (text: string, kind: 'markdown' | 'csv' = 'markdown') => {
  const { blocks, separators } = splitBlocks(text, kind);
  return blocks.map((block, index) => block + separators[index]).join('');
};

test('blocks: paragraphs, a list, a table, a fenced code block and front matter; joined back exactly', () => {
  const text = '---\ntitle: X\n\nnotes: y\n---\n\n# Title\n\nA paragraph\nwrapped.\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\n\nLast.\n';
  const { blocks } = splitBlocks(text, 'markdown');
  assert.deepEqual(blocks, [
    '---\ntitle: X\n\nnotes: y\n---',
    '# Title',
    'A paragraph\nwrapped.',
    '- one\n- two',
    '| a | b |\n|---|---|\n| 1 | 2 |',
    '```js\nconst a = 1;\n\nconst b = 2;\n```',
    'Last.',
  ]);
  assert.equal(join(text), text);
  assert.equal(join('No trailing newline'), 'No trailing newline');
  assert.equal(join('\n\nLeading blank lines\n'), '\n\nLeading blank lines\n');
  assert.equal(join('a,b\n1,2\n', 'csv'), 'a,b\n1,2\n');
  assert.deepEqual(splitBlocks('a\r\n\r\nb\r\n', 'markdown').blocks, ['a', 'b'], 'CRLF is logical text');
});

const BASE = '# Title\n\nThe second line.\n\nThe third line. Alpha.\n';
const MINE = '# Title\n\nThe second line.\n\nThe third line. Alpha. Bravo.\n';
const THEIRS = '# Title, edited\n\nThe second line.\n\nThe third line. Alpha.\n';

test('S1: the writer\'s block and the person\'s block both land; nothing conflicts', () => {
  const result = mergeBlocks(BASE, MINE, THEIRS, 'markdown');
  assert.equal(result.text, '# Title, edited\n\nThe second line.\n\nThe third line. Alpha. Bravo.\n');
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.takenFromTheirs, 1);
});

test('S56: both changed one block: the person\'s stays and it is a conflict; the writer\'s other block lands', () => {
  const theirs = '# Title\n\nThe second line, shorter.\n\nThe third line, tightened by the writer.\n';
  const result = mergeBlocks(BASE, MINE, theirs, 'markdown');
  assert.equal(result.text, '# Title\n\nThe second line, shorter.\n\nThe third line. Alpha. Bravo.\n');
  assert.deepEqual(result.conflicts, [{ mine: 'The third line. Alpha. Bravo.', theirs: 'The third line, tightened by the writer.' }]);
});

test('adjacent changes: the person rewrote a block, the writer added one right after it', () => {
  const theirs = '# Title\n\nThe second line.\n\nThe third line. Alpha.\n\nA new paragraph from the writer.\n';
  const result = mergeBlocks(BASE, MINE, theirs, 'markdown');
  assert.equal(result.text, '# Title\n\nThe second line.\n\nThe third line. Alpha. Bravo.\n\nA new paragraph from the writer.\n');
  assert.deepEqual(result.conflicts, []);
});

test('adjacent rewrites by different sides are both taken', () => {
  const mine = '# Title\n\nThe second line.\n\nThe third line, mine.\n';
  const theirs = '# Title\n\nThe second line, theirs.\n\nThe third line. Alpha.\n';
  const result = mergeBlocks(BASE, mine, theirs, 'markdown');
  assert.equal(result.text, '# Title\n\nThe second line, theirs.\n\nThe third line, mine.\n');
  assert.deepEqual(result.conflicts, []);
});

test('inserts at one place from both sides are both kept, the person\'s first; deletions from either side land', () => {
  const mine = '# Title\n\nMine inserted.\n\nThe second line.\n\nThe third line. Alpha.\n';
  const theirs = '# Title\n\nTheirs inserted.\n\nThe second line.\n';
  const result = mergeBlocks(BASE, mine, theirs, 'markdown');
  assert.equal(result.text, '# Title\n\nMine inserted.\n\nTheirs inserted.\n\nThe second line.\n');
  assert.deepEqual(result.conflicts, []);
});

test('the same change on both sides is taken once; a block the person changed and the writer deleted is a conflict', () => {
  const same = mergeBlocks(BASE, THEIRS, THEIRS, 'markdown');
  assert.equal(same.text, THEIRS);
  assert.deepEqual(same.conflicts, []);
  const deleted = mergeBlocks(BASE, MINE, '# Title\n\nThe second line.\n', 'markdown');
  assert.equal(deleted.text, MINE);
  assert.deepEqual(deleted.conflicts, [{ mine: 'The third line. Alpha. Bravo.', theirs: '' }]);
});

test('S7: CSV rows, front matter and CRLF line endings', () => {
  const csv = mergeBlocks('name,amount\nTea,3\nCoffee,4\n', 'name,amount\nTea,3\nCoffee,4\nCake,5\n', 'name,amount\nTea,3\nCoffee,9\n', 'csv');
  assert.equal(csv.text, 'name,amount\nTea,3\nCoffee,9\nCake,5\n');
  const fm = mergeBlocks(`---\ntitle: Run\n---\n\n${BASE}`, `---\ntitle: Run\n---\n\n${MINE}`, `---\ntitle: Run\n---\n\n${THEIRS}`, 'markdown');
  assert.equal(fm.text, `---\ntitle: Run\n---\n\n# Title, edited\n\nThe second line.\n\nThe third line. Alpha. Bravo.\n`);
  const crlf = mergeBlocks(BASE.replace(/\n/g, '\r\n'), MINE.replace(/\n/g, '\r\n'), THEIRS.replace(/\n/g, '\r\n'), 'markdown', '\r\n');
  assert.equal(crlf.text, '# Title, edited\r\n\r\nThe second line.\r\n\r\nThe third line. Alpha. Bravo.\r\n');
});

test('the base: the save the copy shares most blocks with, the oldest on a tie, none when nothing is shared', () => {
  const saveA = BASE;
  const saveB = '# Title\n\nThe second line.\n\nThe third line. Alpha.\n\nBravo in its own paragraph.\n';
  assert.equal(findBase([saveA, saveB], THEIRS, 'markdown'), 0, 'the save the writer read');
  assert.equal(findBase([saveA, saveA], THEIRS, 'markdown'), 0, 'the oldest of equals');
  assert.equal(findBase([saveA], '# Something else\n\nEntirely rewritten.\n\nNothing in common.\n', 'markdown'), -1, 'no base');
  assert.equal(findBase([saveA], '# Title\n\nThe second line, rewritten.\n\nThe third line, rewritten.\n', 'markdown'), 0, 'one paragraph of three in place is enough');
  // S63: an older base is found when five saves later the writer writes a copy of the second.
  const saves = [1, 2, 3, 4, 5].map(n => `# Title\n\n${Array.from({ length: n }, (_, i) => `Sentence ${i + 1}.`).join('\n\n')}\n`);
  const copyOfSecond = saves[1].replace('# Title', '# Title, edited');
  assert.equal(findBase(saves, copyOfSecond, 'markdown'), 1);
  const merged = mergeBlocks(saves[1], saves[4], copyOfSecond, 'markdown');
  assert.equal(merged.text, saves[4].replace('# Title', '# Title, edited'));
});
