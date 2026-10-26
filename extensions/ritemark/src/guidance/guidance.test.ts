/**
 * Sprint 140 (R2–R6, R8, R14, E2, E3; S10, S11, S13, S14, S16, S19, S27–S29, S33–S38, S43, S61–S63): the
 * first day's guidance rules: the counts line, the ready request's kind, words, AI and lifetime, Home's one
 * card, the saved days, the store, and the starting place.
 * Run: npx tsx src/guidance/guidance.test.ts
 */

import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { COUNT_LIMIT, countsLine, fileKindOf, listFileNames } from './folderCounts';
import { feedbackDue, guidanceCard, localDay, releaseOf, withSavedDay } from './guidanceState';
import { decodeGuidanceState, GUIDANCE_KEY, GuidanceStore, type MementoLike } from './guidanceStore';
import { AI_NAMES, cardAi, EVENT_KIND, FIRST_LOOK_READS_DOCUMENTS, READY_REQUEST_CURSOR_EMPTY, READY_REQUEST_TEXT, readyGoneNow, readyKindOf, readyRequestDue, readyRequestWords } from './readyRequest';
import { READ_KINDS_EVERY_AI_PASSED, startingPlaceOf, wordCount } from './startingPlace';

const repeat = (name: string, n: number) => Array.from({ length: n }, (_, i) => `${i}${name}`);

// ── The counts line (R3, S10, S11) ──

assert.equal(
  countsLine([...repeat('.docx', 61), ...repeat('.pdf', 38), ...repeat('.xlsx', 22), ...repeat('.md', 9), ...repeat('.png', 6), ...repeat('.zip', 8)]),
  '144 files: 61 Word documents, 38 PDFs, 22 spreadsheets, 9 text documents and 14 others.',
  'experience 35 frame 1: four kinds, most first, the rest as others, last',
);
assert.equal(countsLine([...repeat('.docx', 20), ...repeat('.pdf', 10), ...repeat('.xlsx', 4), ...repeat('.md', 3)]), '37 files: 20 Word documents, 10 PDFs, 4 spreadsheets and 3 text documents.', 'S10: the spike folder');
assert.equal(countsLine(['Tender.pdf']), '1 file: 1 PDF.', 'S11: singulars');
assert.equal(countsLine(['a.docx', 'b.pdf', 'c.csv', 'd.pptx', 'e.txt', 'f.jpg']), '6 files: 1 Word document, 1 PDF, 1 spreadsheet, 1 presentation and 2 others.', 'S11: one of each of six kinds: four named, the tie in kind order');
assert.equal(countsLine(['a.zip', 'b.exe']), '2 files.', 'only unknown kinds: the total alone');
assert.equal(countsLine(['notes.MD', 'Deck.KEY']), '2 files: 1 presentation and 1 text document.', 'extensions in any case; a tie keeps the kind order');
assert.equal(countsLine([], false), '0 files.');
assert.equal(countsLine(repeat('.md', COUNT_LIMIT + 1)), 'More than 10,000 files.', 'S11: past 10,000');
assert.equal(countsLine(['a.md'], true), 'More than 10,000 files.', 'the walk stopped');
assert.deepEqual(['x.docx', 'x.doc', 'x.odt', 'x.pdf', 'x.numbers', 'x.csv', 'x.key', 'x.markdown', 'x.heic', 'x.flow', 'Makefile'].map(fileKindOf), ['word', 'word', 'word', 'pdf', 'spreadsheet', 'spreadsheet', 'presentation', 'text', 'picture', 'other', 'other']);

// The walk: names only, Ritemark's own and hidden files left out (S11, E2)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-counts-'));
for (const file of ['Brief.docx', 'CLAUDE.md', 'AGENTS.md', '.DS_Store', 'Sub/Plan.pdf', 'Sub/.hidden.md', '.ritemark/tasks/m4d7r2-x.md', '.git/HEAD', 'node_modules/x/y.js', 'Sub/Deep/Notes.md']) {
  fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
  fs.writeFileSync(path.join(tmp, file), 'x');
}
(async () => {
  const listed = await listFileNames(tmp, { skipAtRoot: new Set(['CLAUDE.md']) });
  assert.deepEqual(listed.names.sort(), ['AGENTS.md', 'Brief.docx', 'Notes.md', 'Plan.pdf'], 'S11: no .ritemark, dot files, node_modules or the pointer CLAUDE.md');
  assert.equal(listed.more, false);
  const capped = await listFileNames(tmp, { limit: 2 });
  assert.equal(capped.more, true, 'the walk stops past its limit');
  fs.rmSync(tmp, { recursive: true, force: true });

  // ── The ready request's kind and words (R3, S10, S13, S14, S16) ──

  assert.equal(readyKindOf({ empty: false, sample: false }), 'files');
  assert.equal(readyKindOf({ empty: true, sample: false }), 'empty');
  assert.equal(readyKindOf({ empty: false, sample: true }), 'sample', 'the sample wins over its files');
  assert.deepEqual(readyRequestWords('files', 'Claude', 'Training work', '144 files: 61 Word documents, 38 PDFs, 22 spreadsheets, 9 text documents and 14 others.'), {
    icon: 'folder-simple',
    heading: 'Nothing in this folder was moved or changed',
    body: 'Claude works only inside it. 144 files: 61 Word documents, 38 PDFs, 22 spreadsheets, 9 text documents and 14 others.',
    button: 'Ask Claude what is here',
    note: 'Reads the names first.',
    hide: 'Hide this in Training work',
    busy: null,
  }, 'Claude has no spike result yet, so its note promises only the names');
  assert.equal(readyRequestWords('files', 'ChatGPT', 'Training work', null).body, 'ChatGPT works only inside it.', 'S16: the AI renames the body; no counts until they are read');
  assert.equal(readyRequestWords('files', 'ChatGPT', 'Training work', null).note, 'Reads the names, then the five newest documents.', 'ChatGPT passed the spike for Word and PDF');
  assert.equal(readyRequestWords('files', 'OpenCode', 'Training work', null).note, 'Reads the names first.');
  assert.deepEqual(FIRST_LOOK_READS_DOCUMENTS, { ChatGPT: true, Claude: false, OpenCode: false }, 'the spike so far (research/word-spike.md)');
  assert.deepEqual(readyRequestWords('empty', 'Claude', 'Board report 2027', null), {
    icon: 'pencil-simple-line',
    heading: 'Start with what this project is for',
    body: 'A sentence is enough. Claude writes About this project from it, and a first outline as a document.',
    button: 'Tell Claude what this project is for',
    note: 'Nothing goes until you press Send.',
    hide: 'Hide this in Board report 2027',
    busy: null,
  });
  assert.deepEqual(readyRequestWords('sample', 'OpenCode', 'Leadership programme', null), {
    icon: 'check-square',
    heading: 'OpenCode can draft Module 4',
    body: "It reads the brief and the interviews with shift leaders, then writes Module 4 like Modules 1 to 3. It's the task on the board for OpenCode.",
    button: 'Ask OpenCode to draft Module 4',
    note: 'Reads two documents, writes a new one.',
    hide: 'Hide this in Leadership programme',
    busy: { button: 'Giving it to OpenCode…', note: 'It shows in Doing in a moment.' },
  });
  assert.equal(READY_REQUEST_TEXT.files, 'What is here? Look at the names first, read only the five newest documents, and end with two things you could do next.', 'frame 2 redrawn');
  // Frame 3 redrawn: the person's sentence after "This project is for ", then the card's promise on the next line
  assert.equal(READY_REQUEST_TEXT.empty, 'This project is for \nThen write About this project from it, and a first outline as a document.');
  assert.equal(READY_REQUEST_CURSOR_EMPTY, 'This project is for '.length);
  assert.deepEqual(EVENT_KIND, { files: 'what_is_here', empty: 'what_for', sample: 'module_4' });
  assert.deepEqual(AI_NAMES, { 'claude-code': 'Claude', codex: 'ChatGPT', opencode: 'OpenCode' }, 'never Codex');

  // ── When it shows, and when it goes (R6, S24–S29) ──

  assert.equal(readyRequestDue({ foundBy: 'opened', record: undefined, ownChats: 0 }), true, 'a project met first');
  assert.equal(readyRequestDue({ foundBy: 'recent', record: undefined, ownChats: 0 }), false, 'S28: never on a project from 1.x');
  assert.equal(readyRequestDue({ foundBy: 'chats', record: undefined, ownChats: 0 }), false, 'S28');
  assert.equal(readyRequestDue({ foundBy: null, record: undefined, ownChats: 0 }), false, 'not in the list');
  assert.equal(readyRequestDue({ foundBy: 'opened', record: undefined, ownChats: 1 }), false, 'S28: a project added in 2.0 that already has a chat');
  assert.equal(readyRequestDue({ foundBy: 'opened', record: { gone: 'hidden' }, ownChats: 0 }), false, 'S27: its ×');
  assert.equal(readyRequestDue({ foundBy: 'opened', record: { chatId: 'c1' }, ownChats: 0 }), true, 'S25: a request that failed leaves it');
  assert.equal(readyGoneNow({ kind: 'files', ownChats: 0, requestAnswered: true, sampleLeftToDo: false }), 'answered', 'S24');
  assert.equal(readyGoneNow({ kind: 'files', ownChats: 0, requestAnswered: false, sampleLeftToDo: true }), undefined, 'a folder ignores the sample');
  assert.equal(readyGoneNow({ kind: 'sample', ownChats: 0, requestAnswered: false, sampleLeftToDo: true }), 'answered', 'the sample: its card left To do (shows in Doing)');
  assert.equal(readyGoneNow({ kind: 'empty', ownChats: 2, requestAnswered: false, sampleLeftToDo: false }), 'chat', 'S26: a chat of one\'s own');
  assert.equal(readyGoneNow({ kind: 'empty', ownChats: 0, requestAnswered: false, sampleLeftToDo: false }), undefined, 'S25: refused or failed: it stays');

  // ── The AI it names (R4, S16, S19) ──

  assert.deepEqual(cardAi({ chosen: undefined, sheetAi: 'codex', states: { 'claude-code': 'ready', codex: 'ready' } }), { ai: 'codex', ready: true }, 'the sheet\'s AI for new chats');
  assert.deepEqual(cardAi({ chosen: 'opencode', sheetAi: 'codex', states: { codex: 'ready', opencode: 'ready' } }), { ai: 'opencode', ready: true }, 'chosen on the card');
  assert.deepEqual(cardAi({ chosen: 'opencode', sheetAi: 'codex', states: { codex: 'ready', opencode: 'set-up' } }), { ai: 'codex', ready: true }, 'a chosen AI no longer ready falls back');
  assert.deepEqual(cardAi({ chosen: undefined, sheetAi: 'claude-code', states: { 'claude-code': 'sign-in', codex: 'sign-in', opencode: 'ready' } }), { ai: 'opencode', ready: true }, 'the first ready in the order');
  assert.deepEqual(cardAi({ chosen: undefined, sheetAi: 'codex', states: { 'claude-code': 'sign-in', codex: 'sign-in', opencode: 'set-up' } }), { ai: 'claude-code', ready: false }, 'S19: none ready names Claude');

  // ── Home's one card (R2, R14, D1; S7, S8, S61–S63) ──

  const base = { whatMoved: false, readyRequest: false, feedback: false, today: '2026-11-03', readyShownOn: undefined };
  assert.equal(guidanceCard(base), null);
  assert.equal(guidanceCard({ ...base, whatMoved: true, readyRequest: true, feedback: true }), 'what-moved', 'S8: What moved first');
  assert.equal(guidanceCard({ ...base, readyRequest: true }), 'ready-request');
  assert.equal(guidanceCard({ ...base, feedback: true }), 'feedback', 'S61');
  assert.equal(guidanceCard({ ...base, readyRequest: true, feedback: true, readyShownOn: '2026-11-03' }), 'ready-request', 'S62: the day it showed, the feedback card waits');
  assert.equal(guidanceCard({ ...base, readyRequest: true, feedback: true, readyShownOn: '2026-11-02' }), 'feedback', 'S62: the next day, the feedback card takes the place');
  assert.equal(guidanceCard({ ...base, readyRequest: true, feedback: false, readyShownOn: '2026-11-02' }), 'ready-request', 'S62: and the ready request returns after it');

  // ── Saved days and releases (R14, S61, S63) ──

  assert.equal(localDay(new Date(2026, 10, 3, 23, 59)), '2026-11-03', 'a local calendar day');
  assert.deepEqual(withSavedDay(['2026-11-01'], '2026-11-01'), ['2026-11-01'], 'one day counts once');
  assert.deepEqual(withSavedDay(['2026-11-02', '2026-11-01', '2026-11-03'], '2026-11-04'), ['2026-11-02', '2026-11-03', '2026-11-04'], 'kept short');
  assert.equal(feedbackDue({ savedDays: ['a', 'b'], answered: false }), false);
  assert.equal(feedbackDue({ savedDays: ['a', 'b', 'c'], answered: false }), true, 'S61: the third day');
  assert.equal(feedbackDue({ savedDays: ['a', 'b', 'c'], answered: true }), false, 'S63: once per release');
  assert.equal(releaseOf('2.1.0'), '2.1');
  assert.equal(releaseOf('2.1.3-ext.2'), '2.1', 'S63: an extension update within 2.1 is the same release');

  // ── The store: one global key, defensive reads (E2) ──

  const bag = new Map<string, unknown>();
  const memento: MementoLike = { get: <T>(key: string) => bag.get(key) as T | undefined, update: async (key, value) => { bag.set(key, value); } };
  const store = new GuidanceStore(memento, '2.1.0');
  await store.updateProject('file:///p', (record) => ({ ...record, chatId: 'c1', ai: 'codex' }));
  await store.noteSavedDay('2026-11-01');
  await store.noteSavedDay('2026-11-01');
  await store.noteSavedDay('2026-11-02');
  await store.noteReadyShown('2026-11-02');
  assert.deepEqual([...bag.keys()], [GUIDANCE_KEY], 'one key');
  assert.deepEqual(store.project('file:///p'), { chatId: 'c1', ai: 'codex' });
  assert.deepEqual(store.release(), { id: '2.1', savedDays: ['2026-11-01', '2026-11-02'] });
  await store.answerFeedback('not-now');
  assert.equal(store.release().feedback, 'not-now');
  const next = new GuidanceStore(memento, '2.2.0');
  assert.deepEqual(next.release(), { id: '2.2', savedDays: [] }, 'a new release asks again');
  assert.deepEqual(decodeGuidanceState({ v: 1, projects: { a: { gone: 'nope', ai: 'gpt', chatId: 7 }, b: 'x' }, readyShownOn: 'yesterday', release: { id: '2.1', savedDays: ['2026-1-1', '2026-11-01'], feedback: 'maybe' } }),
    { v: 1, projects: { a: {} }, release: { id: '2.1', savedDays: ['2026-11-01'] } }, 'anything malformed is dropped');
  assert.deepEqual(decodeGuidanceState(undefined), { v: 1, projects: {} });

  // ── The starting place (R8, R1; S33–S38, S43) ──

  assert.deepEqual(READ_KINDS_EVERY_AI_PASSED, { word: false, pdf: false }, 'the spike\'s gate: closed until every AI has passed (research/word-spike.md)');
  assert.equal(startingPlaceOf(null, 'files'), 'project', 'S33');
  assert.equal(startingPlaceOf(null, 'empty'), 'empty_project', 'S34');
  assert.equal(startingPlaceOf(null, 'sample'), 'sample', 'S38');
  assert.equal(startingPlaceOf({ viewType: 'ritemark.docxViewer', fileName: 'Fernhollow Bank notes.docx' }, 'files'), 'project', 'S35: gate closed: the project\'s');
  assert.equal(startingPlaceOf({ viewType: 'ritemark.docxViewer', fileName: 'Fernhollow Bank notes.docx' }, 'files', { word: true, pdf: false }), 'word_or_pdf', 'S35: gate open');
  assert.equal(startingPlaceOf({ viewType: 'ritemark.pdfViewer', fileName: 'Tender.pdf' }, 'files', { word: true, pdf: false }), 'project', 'a PDF follows its own kind');
  assert.equal(startingPlaceOf({ viewType: 'ritemark.pdfViewer', fileName: 'Tender.pdf' }, 'files', { word: false, pdf: true }), 'word_or_pdf');
  assert.equal(startingPlaceOf({ viewType: 'ritemark.editor', fileName: 'Outline.md', words: 19 }, 'files'), 'short_text', 'S36');
  assert.equal(startingPlaceOf({ viewType: 'ritemark.editor', fileName: 'Report.md', words: 900 }, 'files'), 'long_text', 'S36');
  assert.equal(startingPlaceOf({ viewType: 'ritemark.editor', fileName: 'Report.md', words: 300 }, 'files'), 'long_text', 'short is below 300');
  assert.equal(startingPlaceOf({ viewType: 'ritemark.editor', fileName: 'Participants.csv' }, 'files'), 'table', 'S37: a CSV');
  assert.equal(startingPlaceOf({ viewType: 'ritemark.excelViewer', fileName: 'Budget.xlsx' }, 'files'), 'table', 'S37: a spreadsheet in the table editor');
  assert.equal(startingPlaceOf({ viewType: 'ritemark.pptxViewer', fileName: 'Deck.pptx' }, 'sample'), 'sample', 'S43: anything else: the project\'s');
  assert.equal(startingPlaceOf({ viewType: 'ritemark.flowEditor', fileName: 'Weekly.flow.json' }, 'empty'), 'empty_project', 'S43');
  assert.equal(startingPlaceOf({ viewType: undefined, fileName: 'notes.txt', words: 3 }, 'files'), 'short_text', 'a plain text file');
  assert.equal(wordCount('---\ntitle: x y z\n---\n# Board report\n\nThe year in [three](./x.md) numbers. <!-- not this -->'), 7, 'front matter, comments and link targets left out');

  console.log('guidance: all assertions passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
