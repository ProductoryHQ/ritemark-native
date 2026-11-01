/**
 * Sprint 148 (R5, R10): the word index and its query.
 * Run: npx tsx src/search/worker/wordIndex.test.ts
 */
import assert from 'node:assert/strict';
import type { IndexSource, SearchOptions } from '../protocol';
import { forEachWord, forEachWordByPattern, lettersOf, matchWord, queryWord, wordsOf } from './text';
import { SNIPPET_CHARS, WordIndex, cutPassage } from './wordIndex';

const ANY: SearchOptions = { matchCase: false, wholeWords: false, kinds: ['document', 'chat', 'task'] };

function doc(key: string, name: string, texts: string[], changedAt = 0, extra: Partial<IndexSource> = {}): IndexSource {
  return { key, kind: 'document', name, where: null, changedAt, passages: texts.map((text, block) => ({ text, at: { block } })), ...extra };
}

function names(index: WordIndex, text: string, options: SearchOptions = ANY, kind = 'document'): string[] {
  const outcome = index.query(text, { options, perKind: 50 });
  return outcome.groups.find((group) => group.kind === kind)?.results.map((result) => result.name) ?? [];
}

// ── Words and the marks rule (text.ts) ───────────────────────────────────────
assert.deepEqual(wordsOf('Annual report, 2026-11-01: käsi!'), ['Annual', 'report', '2026', '11', '01', 'käsi']);
assert.deepEqual(lettersOf('käsi'), ['k', 'ä', 's', 'i']);
assert.deepEqual(lettersOf('käsi'.normalize('NFD')), ['k', 'ä', 's', 'i'], 'a decomposed mark stays with its letter');
assert.deepEqual(matchWord(queryWord('kasi', false), 'käsi', false, false), { exact: false, length: 4 }, 'unmarked finds marked');
assert.equal(matchWord(queryWord('käsi', false), 'kasi', false, false), null, 'a typed mark finds only itself');
assert.deepEqual(matchWord(queryWord('käsi', false), 'Käsi', false, false), { exact: true, length: 4 }, 'capitals fold');
assert.equal(matchWord(queryWord('käsi', true), 'Käsi', true, false), null, 'Match capital letters');
assert.deepEqual(matchWord(queryWord('rep', false), 'reporting', false, false), { exact: true, length: 3 }, 'from the start');
assert.equal(matchWord(queryWord('rep', false), 'reporting', false, true), null, 'whole words only');
assert.deepEqual(matchWord(queryWord('muller', false), 'Müller', false, false), { exact: false, length: 6 });
assert.deepEqual(matchWord(queryWord('Jose', false), 'José', false, false), { exact: false, length: 4 });
assert.equal(matchWord(queryWord('sokolaad', false), 'šokolaad', false, false)?.exact, false, 'š follows the rule');
assert.equal(matchWord(queryWord('žürii', false), 'zurii', false, false), null);

// The character loop finds exactly the words the pattern finds.
{
  const alphabet = ['a', 'Z', '7', ' ', '-', '.', 'ä', 'õ', 'š', '̈', 'ß', 'İ', '日本', 'Ж', '😀', '𝐀', '\ud800', '_', '\n', '’', '٣'];
  let seed = 3;
  const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed / 0x7fffffff);
  for (let n = 0; n < 2000; n++) {
    let text = '';
    for (let i = Math.floor(random() * 30); i > 0; i--) text += alphabet[Math.floor(random() * alphabet.length)];
    const loop: [string, number, number][] = [];
    const pattern: [string, number, number][] = [];
    forEachWord(text, (word, start, end) => loop.push([word, start, end]));
    forEachWordByPattern(text, (word, start, end) => pattern.push([word, start, end]));
    assert.deepEqual(loop, pattern, JSON.stringify(text));
  }
}

// ── The query ────────────────────────────────────────────────────────────────
{
  const index = new WordIndex();
  index.add(doc('d:1', 'Annual report', ['The harbour office opens at seven.'], 100));
  index.add(doc('d:2', 'Notes', ['Reporting lines changed. See the annual numbers.'], 300));
  index.add(doc('d:3', 'Unreported', ['Nothing here about it.'], 200));
  index.add(doc('d:4', 'Käsi', ['Käsi ja jalg.'], 50));
  index.add(doc('d:5', 'Kasi', ['A word without marks.'], 40));

  // From two characters; one shows nothing and isn't "nothing found".
  assert.equal(index.query('r', { options: ANY, perKind: 5 }).tooShort, true);
  assert.equal(index.query('re', { options: ANY, perKind: 5 }).tooShort, false);

  // Each word starts a word: "report" finds "reports" and "reporting", not "unreported".
  assert.deepEqual(names(index, 'report').sort(), ['Annual report', 'Notes']);
  // All words must be found, in any order, in the name or the text.
  assert.deepEqual(names(index, 'annual harbour'), ['Annual report']);
  assert.deepEqual(names(index, 'harbour annual'), ['Annual report']);
  assert.deepEqual(names(index, 'annual'), ['Annual report', 'Notes'], 'a hit in the name first');
  // Whole words only.
  assert.deepEqual(names(index, 'report', { ...ANY, wholeWords: true }), ['Annual report']);
  // Capitals don't matter, unless Match capital letters is on.
  assert.deepEqual(names(index, 'REPORTING'), ['Notes']);
  assert.deepEqual(names(index, 'REPORTING', { ...ANY, matchCase: true }), []);
  assert.deepEqual(names(index, 'Reporting', { ...ANY, matchCase: true }), ['Notes']);
  // Marks (the Experience lead, question 7): unmarked finds marked, exact letters first; a typed mark finds only itself.
  assert.deepEqual(names(index, 'kasi'), ['Kasi', 'Käsi'], '"kasi" finds both, the exact letters first');
  assert.deepEqual(names(index, 'käsi'), ['Käsi']);
  assert.deepEqual(names(index, 'KÄSI'), ['Käsi']);
  assert.deepEqual(names(index, 'käsi', { ...ANY, matchCase: true }), [], 'capitals exact with Match capital letters');

  // A newer document wins a tie; the passage marks the matching part, the name alone shows none.
  const notes = index.query('rep', { options: ANY, perKind: 5 }).groups[0].results;
  assert.deepEqual(notes.map((r) => r.name), ['Annual report', 'Notes']);
  assert.equal(notes[0].passage, null, 'a hit in the name alone shows no passage');
  assert.equal(notes[1].passage?.text, 'Reporting lines changed. See the annual numbers.');
  assert.deepEqual(notes[1].passage?.marks, [[0, 3]], 'the typed part is marked');
  assert.deepEqual(notes[1].match, { text: 'Reporting', occurrence: 0 }, 'R9: the hit as written');
  assert.equal(notes[1].layer, 'words');
}

// ── Ranking: name, exact letters, the words together, more hits, newest ──────
{
  const index = new WordIndex();
  index.add(doc('d:a', 'One', ['budget meeting on friday'], 1));
  index.add(doc('d:b', 'Two', ['meeting about the budget', 'budget budget budget'], 2));
  index.add(doc('d:c', 'Three', ['meeting budget'], 3));
  // "budget meeting" together as typed ranks first; then more hits; then newest.
  assert.deepEqual(names(index, 'budget meeting'), ['One', 'Two', 'Three']);
  index.add(doc('d:d', 'Budget plan', ['meeting notes'], 0));
  assert.equal(names(index, 'budget meeting')[0], 'Budget plan', 'a hit in the name before all');
  // More hits, then the most recently changed.
  index.add(doc('d:e', 'Five', ['friday'], 10));
  index.add(doc('d:f', 'Six', ['friday'], 20));
  assert.deepEqual(names(index, 'friday'), ['Six', 'Five', 'One']);
}

// ── The kinds, the counts, the options' kinds, a long group ───────────────────
{
  const index = new WordIndex();
  for (let i = 0; i < 30; i++) index.add(doc(`d:${i}`, `Doc ${i}`, ['planning'], i));
  index.add({ key: 'chat:1', kind: 'chat', name: 'Planning chat', where: null, changedAt: 5, passages: [{ text: 'Let us do the planning', at: { eventId: 'e1', speaker: 'you' } }] });
  index.add({ key: 'task:1', kind: 'task', name: 'Write the plan', where: 'Doing', changedAt: 5, passages: [{ text: 'planning is done', at: { field: 'doneWhen' } }] });
  const outcome = index.query('plan', { options: ANY, perKind: 5 });
  assert.deepEqual(outcome.groups.map((g) => [g.kind, g.total, g.results.length]), [['document', 30, 5], ['chat', 1, 1], ['task', 1, 1]], 'Documents, Chats, Tasks, with counts');
  assert.equal(outcome.groups[1].results[0].passage?.at.eventId, 'e1');
  assert.equal(outcome.groups[2].results[0].where, 'Doing');
  const expanded = index.query('plan', { options: ANY, perKind: 5, expand: 'document' });
  assert.equal(expanded.groups[0].results.length, 30, 'Show all');
  const chatsOnly = index.query('plan', { options: { ...ANY, kinds: ['chat'] }, perKind: 5 });
  assert.deepEqual(chatsOnly.groups.map((g) => g.kind), ['chat']);
}

// ── The passage: the first passage with the most words; cut to about two lines ─
{
  const long = `${'Lorem ipsum dolor sit amet, '.repeat(12)}the treasure map is here. ${'Consectetur adipiscing elit. '.repeat(12)}`;
  const index = new WordIndex();
  index.add(doc('d:1', 'Story', ['A map of the town.', 'Nothing.', long]));
  const [result] = index.query('treasure map', { options: ANY, perKind: 5 }).groups[0].results;
  assert.ok(result.passage!.text.startsWith('…'), 'cut before');
  assert.ok(result.passage!.text.endsWith('…'), 'cut after');
  assert.ok(result.passage!.text.length <= SNIPPET_CHARS + 2);
  const marked = result.passage!.marks.map(([s, e]) => result.passage!.text.slice(s, e));
  assert.deepEqual(marked, ['treasure', 'map']);
  assert.equal(result.passage!.at.block, 2, 'the passage with both words, not the first with one');
  // White space collapses with the marks moved along.
  const cut = cutPassage('a  b\n\nreport', [[6, 12]], { block: 0 });
  assert.deepEqual(cut, { text: 'a b report', marks: [[4, 10]], at: { block: 0 } });
}

// ── Removal, replacement, compaction ─────────────────────────────────────────
{
  const index = new WordIndex();
  index.add(doc('d:1', 'First', ['alpha beta']));
  index.add(doc('d:1', 'First', ['gamma']));
  assert.deepEqual(names(index, 'alpha'), [], 'a replaced source loses its old words');
  assert.deepEqual(names(index, 'gamma'), ['First']);
  assert.equal(index.remove('d:1'), true);
  assert.deepEqual(names(index, 'gamma'), []);
  for (let i = 0; i < 25_000; i++) index.add(doc(`d:${i % 10}`, `N${i % 10}`, ['delta']));
  assert.equal(index.size, 10);
  assert.equal(names(index, 'delta').length, 10, 'compaction keeps the live sources');
  assert.equal(index.withText, 10);
}

// ── Sprint 150's two questions ───────────────────────────────────────────────
{
  const index = new WordIndex();
  index.add(doc('d:1', 'Budget', ['The budget for 2027.', 'Unrelated paragraph.'], 0, { path: '/p/Budget.md', relativePath: 'Budget.md', format: 'markdown' }));
  index.add(doc('d:2', 'Ships', ['Harbour fees and the budget.', 'Harbour pilots.'], 0, { path: '/p/a/Ships.md', relativePath: 'a/Ships.md', format: 'markdown' }));
  index.add({ key: 'chat:1', kind: 'chat', name: 'Fees', where: null, changedAt: 0, passages: [{ text: 'What are the harbour fees?', at: { eventId: 'e' } }] });
  const best = index.passages(['harbour', 'fees']);
  assert.ok(best.length >= 2 && best.length <= 20);
  assert.ok(['Harbour fees and the budget.', 'What are the harbour fees?'].includes(best[0].text), 'both words first');
  assert.ok(best.every((p) => p.score > 0));
  assert.deepEqual(index.passages(['x']), [], 'one letter is no word');
  const map = index.map();
  assert.deepEqual(map.map((m) => [m.relativePath, m.name, m.firstLine]), [['Budget.md', 'Budget', 'The budget for 2027.'], ['a/Ships.md', 'Ships', 'Harbour fees and the budget.']], 'documents only, by path');
}

console.log('wordIndex.test.ts: all passed');
