/**
 * Sprint 148, the Windows speed PR: the query path's work was cut (each term's marks worked out once per query,
 * no phrase walk through a source whose text lacks a word, the rarest word tested first), and its results must
 * not change. A seeded corpus like search-fixture.mjs's, 300 queries over every option, and the digest of every
 * answer, taken from the query code before the change (main at 3e964a6a).
 * Run: npx tsx src/search/worker/querySame.test.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { IndexSource, SearchKind, SearchOptions } from '../protocol';
import { WordIndex } from './wordIndex';

/** The digest of every answer below, from the query code before the change. */
const BEFORE = '04d9a88e70ee1d92b66e2bce936b68e922551edfb86e7759dfb91c688e3e7c7f';

let seed = 148;
const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed / 0x7fffffff);
const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
const VOCABULARY = [
  'annual', 'report', 'reporting', 'reports', 'budget', 'Budget', 'käsi', 'kasi', 'Müller', 'muller', 'José', 'jose',
  'quarterly', 'figures', 'figure', 'plan', 'planning', 'Plan', 'šokolaad', 'sokolaad', 'meeting', 'notes', 'note',
  'review', 'reviewed', 'the', 'and', 'of', 'to', 'in', 'a', 'project', 'projects', 'Ritemark', 'search', 'searching',
  'word', 'words', 'together', 'first', 'second', 'third', 'ledger', 'cost', 'costs', 'Item', 'items', '2026', '11',
];
/** Zipf-ish: the first words far more often. */
const word = () => VOCABULARY[Math.floor(VOCABULARY.length * random() ** 2.2)];
const sentence = (min: number, max: number) => Array.from({ length: min + Math.floor(random() * (max - min)) }, word).join(' ');

function corpus(): IndexSource[] {
  const sources: IndexSource[] = [];
  const kinds: SearchKind[] = ['document', 'document', 'document', 'chat', 'task'];
  for (let i = 0; i < 1500; i++) {
    const kind = pick(kinds);
    const passages = Array.from({ length: 1 + Math.floor(random() * 8) }, (_, block) => ({
      text: random() < 0.1 ? '' : sentence(3, 40),
      at: random() < 0.05 ? { block, comment: true } : { block },
    }));
    sources.push({
      key: `${kind}:${i}`,
      kind,
      name: sentence(1, 4),
      where: random() < 0.5 ? null : 'folder',
      changedAt: Math.floor(random() * 1000) * 1000,
      passages,
      ...(random() < 0.03 ? { nameOnly: 'too-large' as const, passages: [] } : {}),
    });
  }
  return sources;
}

function queries(): string[] {
  const list: string[] = ['re', 'rep', 'report', 'käsi', 'kasi', 'muller', 'Müller', 'jose', 'annual report', 'the plan', 'Budget figures', 'x', 'zz'];
  while (list.length < 300) {
    const n = 1 + Math.floor(random() * 4);
    list.push(
      Array.from({ length: n }, () => {
        const w = word();
        return random() < 0.3 ? w.slice(0, Math.max(2, Math.floor(w.length / 2))) : w;
      }).join(' '),
    );
  }
  return list;
}

const index = new WordIndex();
for (const source of corpus()) index.add(source);
// A few replaced and removed, so tombstones are in the way too.
for (let i = 0; i < 1500; i += 37) index.remove(`document:${i}`);
const OPTIONS: SearchOptions[] = [
  { matchCase: false, wholeWords: false, kinds: ['document', 'chat', 'task'] },
  { matchCase: true, wholeWords: false, kinds: ['document', 'chat', 'task'] },
  { matchCase: false, wholeWords: true, kinds: ['document', 'chat', 'task'] },
  { matchCase: false, wholeWords: false, kinds: ['document'] },
];
const hash = createHash('sha256');
let results = 0;
for (const text of queries()) {
  for (const options of OPTIONS) {
    const outcome = index.query(text, { options, perKind: 10, expand: 'document', expandLimit: 200 });
    for (const group of outcome.groups) results += group.results.length;
    hash.update(JSON.stringify(outcome));
  }
}
const digest = hash.digest('hex');
assert.ok(results > 10_000, `the queries find plenty (${results})`);
assert.equal(digest, BEFORE, 'every answer is the same as before the change');
console.log('querySame.test.ts: all passed');
