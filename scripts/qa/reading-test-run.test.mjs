import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evidenceRedactor, retryDestroyedContext, scoreRun, tryLinks } from './reading-test-run.mjs';

const facts = JSON.parse(`{
  "folder": "Review",
  "documents": [
    {"file": "Brief/Charter.docx", "words": ["blue cabinet"]},
    {"file": "Visits/Visit form.pdf", "words": ["three counters"], "unreadReason": "scan"}
  ],
  "passwordDocument": "Locked appendix.docx",
  "deck": {
    "file": "Pilot deck.pptx",
    "slides": [
      {"number": 1, "words": ["quiet room"], "noteWords": ["tally sheet"]},
      {"number": 2, "words": ["side entrance"], "noteWords": ["folding ramp"]},
      {"number": 3, "words": ["next Tuesday"], "noteWords": ["amber folder"]},
      {"number": 4, "words": ["red boxes"], "noteWords": ["call bell"]},
      {"number": 5, "words": ["6200"], "noteWords": []},
      {"number": 6, "words": ["six chairs"], "noteWords": ["white binder"]}
    ]
  }
}`);

const answer = `Charter recommends the blue cabinet.
Visit form is an image-only scan.
Locked appendix has a password. Please provide the password.
Pilot deck describes the pilot.
Slide 1 — quiet room. Speaker notes: tally sheet.
Slide 2 — side entrance. Speaker notes: folding ramp.
Slide 3 — next Tuesday. Speaker notes: amber folder.
Slide 4 — red boxes. Speaker notes: call bell.
Slide 5 — 6200 in reserve. Speaker notes: none.
Slide 6 — six chairs. Speaker notes: white binder.`;

const sample = {
  answer: answer.replace('Charter', '[Charter](Brief/Charter.docx#q=blue%20cabinet)'),
  visibleAnswer: answer,
  stepLabels: ['Looked in Review: 2 Word documents', 'Read Charter.docx', "Couldn't open Locked appendix.docx · it has a password"],
  links: [
    { label: 'Charter', expectedFile: 'Brief/Charter.docx', opensRightDocument: true, hasPassage: true },
    { label: 'Pilot deck', expectedFile: 'Pilot deck.pptx', opensRightDocument: true, hasPassage: true },
  ],
};

test('reading harness accepts document evidence, justified unread files, and correctly assigned notes', () => {
  const result = scoreRun(sample, facts);
  assert.deepEqual(result.criteria, { 1: 'pass', 2: 'pass', 3: 'pass', 4: 'to check', 5: 'pass', 6: 'pass' });
  assert.deepEqual(result.coverage.map(({ result }) => result), ['read', 'unread', 'unread', 'read']);
  assert.match(result.passwordLine, /provide the password/);
});

test('reading harness catches unsubstantiated coverage, misplaced notes, command labels, and bad source style', () => {
  const result = scoreRun({
    ...sample,
    visibleAnswer: answer.replace('blue cabinet', 'blue cabinets')
      .replace('image-only scan', 'unread')
      .replace('Please provide the password.', 'It remains closed.')
      .replace('tally sheet.', 'tally sheet and folding ramp.')
      .replace('Speaker notes: none.', 'Speaker notes: call bell.') + '\nSource 2 [Charter.docx] C:\\Work\\Charter.docx',
    stepLabels: [...sample.stepLabels, 'Read Brief/Charter.docx', 'pdftotext Visit.pdf -'],
    links: [{ label: '2', expectedFile: 'Pilot deck.pptx', opensRightDocument: false }],
  }, facts);
  assert.deepEqual(result.criteria, { 1: 'fail', 2: 'fail', 3: 'fail', 4: 'fail', 5: 'fail', 6: 'fail' });
  assert.deepEqual(result.badSteps, ['Read Brief/Charter.docx', 'pdftotext Visit.pdf -']);
  assert.equal(result.slides[0].notes, false);
  assert.equal(result.slides[4].notes, false);
});

test('each read source needs a link and duplicate slide rows fail the notes check', () => {
  const result = scoreRun({
    ...sample,
    visibleAnswer: answer + '\nSlide 1 — quiet room. Speaker notes: tally sheet.',
    links: sample.links.slice(0, 1),
  }, facts);
  assert.equal(result.criteria[2], 'fail');
  assert.equal(result.criteria[4], 'fail');
});

test('accepts a password-free copy and the project folder label from the Claude run', () => {
  const result = scoreRun({
    ...sample,
    visibleAnswer: answer.replace('Please provide the password.', 'Open it in Word and save a copy without the password.'),
    stepLabels: ['Looked in the project folder: 10 Word documents, 2 PDFs, 1 PowerPoint deck', 'Reading documents'],
  }, facts);
  assert.equal(result.criteria[5], 'pass');
  assert.equal(result.criteria[3], 'pass');
  assert.equal(scoreRun({ ...sample, stepLabels: ['ToolSearchUsing ToolSearch'] }, facts).criteria[3], 'fail');
});

test('scores each multiline unread entry up to its next document or blank line', () => {
  const multiline = answer.replace('Visit form is an image-only scan.', 'Visit form\nIt is an image-only scan.')
    .replace('Locked appendix has a password.', 'Locked appendix\nIt has a password.');
  const score = (visibleAnswer) => scoreRun({ ...sample, visibleAnswer }, facts);
  assert.equal(score(multiline).criteria[1], 'pass');
  assert.equal(score(multiline).criteria[5], 'pass');
  assert.equal(score(multiline.replace('Visit form\n', 'Visit form\n\n')).coverage[1].result, 'missing');
  assert.equal(score(multiline.replace('Please provide the password.', '\nCharter: Please provide the password.')).criteria[5], 'fail');
  assert.equal(score(multiline.replace('It has a password.', 'Charter has a password.')).criteria[5], 'fail');
});

test('accepts each concrete Findings draft fact, excluding the minutes’ shared cost wording', () => {
  const findings = { file: 'Findings draft v2.docx',
    words: ['six times', '6 times', 'case notes', 'end of their life', 'staff want to be told early',
      'rely on branches for help with the app'] };
  const fixture = { ...facts, documents: [...facts.documents, findings] };
  for (const fact of [
    'Cost per visit is six times the cost per call.',
    'Cost per visit is 6 times the cost per call.',
    'Older customers rely on branches for help with the app.',
    'Call centre and branches do not share case notes.',
    'Cash machines are near the end of their life.',
    'Staff want to be told early.',
  ]) {
    const scored = scoreRun({ ...sample, visibleAnswer: `${answer}\n- Findings draft v2: ${fact}` }, fixture);
    assert.equal(scored.coverage.find(({ file }) => file === findings.file).result, 'read', fact);
  }
  const scored = scoreRun({ ...sample, visibleAnswer: `${answer}\n- Findings draft v2: Cost per visit.` }, fixture);
  assert.equal(scored.coverage.find(({ file }) => file === findings.file).result, 'missing');
});

test('matches the Claude title variants and headings without crediting another document', () => {
  const fixture = { ...facts, documents: [
    { file: '04 Drafts/Proposal phase 2 v3.docx', words: ['79,000'] },
    { file: 'Steering group minutes 21 October.docx', words: ['18 November'] },
    { file: '01 Brief/Engagement brief.docx', heading: 'Branch network review', words: ['42 branches'] },
    { file: 'Findings draft v2.docx', heading: 'Findings, draft 2', words: ['six times'] },
  ] };
  const visibleAnswer = `- Proposal: phase 2 asks for €79,000 plus VAT.
- Steering group minutes, 21 October set the board date at 18 November.
- BRANCH NETWORK REVIEW covers 42 branches.
- Findings, draft 2 says it costs six times as much.`;
  const coverage = (text) => scoreRun({ ...sample, visibleAnswer: text }, fixture).coverage.slice(0, 4)
    .map(({ result }) => result);
  assert.deepEqual(coverage(visibleAnswer), ['read', 'read', 'read', 'read']);
  assert.equal(coverage(visibleAnswer.replace('Proposal: phase 2', 'Findings draft 2'))[0], 'missing');
});

test('generic findings headings and prose do not reassign document coverage', () => {
  const fixture = { ...facts, documents: [
    { file: 'Findings draft v2.docx', heading: 'Findings, draft 2', words: ['six times'] },
    { file: 'Interview – head of operations.docx', words: ['€18.40'] },
    { file: 'Branch visit v 2.docx', words: ['blue cabinet'] },
  ] };
  const visibleAnswer = `**Findings overview**
A branch visit costs about six times as much as a call.

**Interview – head of operations**
His findings: a visit costs €18.40 against €3.10 for a call.`;
  const coverage = (text) => scoreRun({ ...sample, visibleAnswer: text }, fixture).coverage
    .slice(0, fixture.documents.length).map(({ result }) => result);
  assert.deepEqual(coverage(visibleAnswer), ['missing', 'read', 'missing']);
  assert.equal(coverage(visibleAnswer.replace('His findings: a visit', 'He reported that a branch visit'))[1], 'read');
  assert.equal(coverage(visibleAnswer.replace('His findings: a visit', 'He reported that a branch visit v 2'))[1], 'missing');
});

test('every version-stripped fixture title that becomes one word is rejected as an alias', () => {
  const fixture = { ...facts, documents: [
    { file: 'Findings draft v2.docx', heading: 'Findings, draft 2', words: ['six times'] },
    { file: 'Summary v3.docx', heading: 'Review, v 4', words: ['three counters'] },
  ] };
  for (const { file, heading, words: [fact] } of fixture.documents) {
    for (const name of [file.replace(/\.docx$/, ''), heading]) {
      const shortName = /^(\p{L}+)[ ,]+(?:v ?\d+|draft \d+)$/u.exec(name)?.[1];
      if (!shortName) continue;
      const result = (label) => scoreRun({ ...sample, visibleAnswer: `**${label}**\n${fact}` }, fixture)
        .coverage.find((row) => row.file === file).result;
      assert.equal(result(name), 'read', name);
      assert.equal(result(`${shortName} overview`), 'missing', shortName);
    }
  }
});

test('rejects facts attributed to the wrong fixture document', () => {
  const findings = 'Findings draft v2';
  const tellers = 'Interview – two tellers, Harbour Street';
  const brief = 'Engagement brief';
  const fixture = { ...facts, documents: [
    { file: findings + '.docx', words: ['end of their life', 'rely on branches for help with the app'] },
    { file: tellers + '.docx', words: ['app desk near the door'] },
    { file: brief + '.docx', words: ['branches in three sizes'] },
    { file: 'Interview – head of operations.docx', heading: 'Interview – head of operations', words: ['11 years old'] },
  ] };
  for (const [document, detail] of [
    [findings, 'Cash machines are 11 years old on average.'],
    [findings, 'The bank runs 118 ATMs.'],
    [findings, 'Riverside sees older customers paying bills.'],
    [tellers, 'The proposal tests an app desk in two branches.'],
    [tellers, 'The workshop suggests an app desk at the door.'],
    [brief, 'The proposal designs the three branch sizes with staff.'],
  ]) {
    const visibleAnswer = `${document}: ${detail}`;
    assert.equal(scoreRun({ ...sample, visibleAnswer }, fixture)
      .coverage.find(({ file }) => file === document + '.docx').result, 'missing', visibleAnswer);
  }
  for (const nextLine of [
    'The Interview – head of operations says cash machines are near the end of their life.',
    'Head of operations says cash machines are near the end of their life.',
  ]) {
    const visibleAnswer = `${findings} — summary of findings\n${nextLine}`;
    assert.equal(scoreRun({ ...sample, visibleAnswer }, fixture).coverage[0].result, 'missing', visibleAnswer);
  }
});

test('redacts exact test keys and provider-shaped secrets from failure evidence', () => {
  const redact = evidenceRedactor({
    RITEMARK_TEST_KEY_GOOGLE: 'literal.+[google]',
    RITEMARK_TEST_KEY_OTHER: 'two\nlines',
    RITEMARK_TEST_KEY_EMPTY: '',
    UNRELATED: 'visible',
  });
  const error = 'literal.+[google] AIza' + 'a'.repeat(20) + ' sk-' + 'b'.repeat(20);
  const runtimeStderr = 'two\nlines visible sk-short literal.+[google]';
  assert.equal(redact(error + '\n' + runtimeStderr),
    '[redacted] [redacted] [redacted]\n[redacted] visible sk-short [redacted]');
  assert.deepEqual(JSON.parse(JSON.stringify({ error, failure: { runtimeStderr, status: null } },
    (_key, value) => redact(value))), {
    error: '[redacted] [redacted] [redacted]',
    failure: { runtimeStderr: '[redacted] visible sk-short [redacted]', status: null },
  });
});

test('a custom question only scores step labels and source style', () => {
  const answer = 'Only the pilot deck has speaker notes.';
  const result = scoreRun({ ...sample, answer, visibleAnswer: answer, customQuestion: true, links: [] }, facts);
  assert.deepEqual(result.criteria, { 1: 'n/a', 2: 'n/a', 3: 'pass', 4: 'n/a', 5: 'n/a', 6: 'pass' });
  assert.deepEqual(result.coverage, []);
  assert.deepEqual(result.slides, []);
  assert.equal(scoreRun({ ...sample, customQuestion: true, visibleAnswer: 'Drafts/My deck.pptx',
    stepLabels: ['Ran a command'] }, { ...facts, deck: { ...facts.deck, file: 'Drafts/My deck.pptx' } }).criteria[6], 'fail');
});

test('retries a destroyed CDP execution context once with a refreshed target', async () => {
  const destroy = new Error('Execution context was destroyed.');
  const calls = [];
  const evaluate = async (target, expression) => {
    calls.push([target, expression]);
    if (target === 'old') throw destroy;
    return 'value';
  };
  assert.equal(await retryDestroyedContext(evaluate, async () => 'new', 'old', 'query'), 'value');
  assert.deepEqual(calls, [['old', 'query'], ['new', 'query']]);
  let attempts = 0;
  await assert.rejects(retryDestroyedContext(async () => { attempts++; throw destroy; }, async () => 'new', 'old', 'query'), destroy);
  assert.equal(attempts, 2);
  await assert.rejects(retryDestroyedContext(async () => { throw new SyntaxError('bad expression'); },
    () => assert.fail('syntax errors should not retry'), 'old', 'query'), SyntaxError);
});

test('checks later links after a tab close fails and closes repeated destinations', async (t) => {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), 'reading-links-')));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  writeFileSync(join(folder, facts.passwordDocument), '');
  writeFileSync(join(folder, facts.deck.file), '');

  const seen = [];
  const results = [];
  let clicks = 0;
  let front = facts.deck.file;
  let tabToClose;
  const ui = {
    page: async () => ({}),
    async evaluate(_target, expression) {
      if (expression.includes('find-bar-count') && clicks === 1) throw new Error('Simulated find probe failure.');
      if (expression.includes("new MouseEvent('auxclick'")) {
        tabToClose = expression.includes(facts.deck.file) ? facts.deck.file : facts.passwordDocument;
        seen.push(tabToClose);
        if (tabToClose === facts.deck.file && front === tabToClose) front = '';
        return;
      }
      if (expression.endsWith('.length === 0')) return tabToClose === facts.deck.file;
      return front;
    },
    async chat(expression) {
      assert.doesNotThrow(() => new Function('d', expression));
      assert.match(expression, /anchor\.click\(\)/);
      assert.equal(results.length, 4);
      if (++clicks === 2) throw new Error('Simulated CDP failure.');
      front = facts.deck.file;
      return true;
    },
    waitFor: async (probe) => (await probe()) || null,
    targets: async () => [{ type: 'iframe', url: 'vscode-webview://fixture' }],
    frameCode: (expression) => expression,
  };
  await tryLinks(ui, folder, facts, [
    { label: 'Locked appendix', href: 'Locked%20appendix.docx#q=test' },
    { label: 'Pilot deck', href: 'Pilot%20deck.pptx#p=1' },
    { label: 'Pilot deck', href: 'Pilot%20deck.pptx#p=2' },
    { label: 'Another visible title', href: 'Pilot%20deck.pptx#p=3' },
  ], results);
  assert.deepEqual(seen, [facts.passwordDocument, facts.deck.file, facts.deck.file, facts.deck.file]);
  assert.match(results[0].error, /Could not close/);
  assert.equal(results[0].errorStep, 'close destination tab');
  assert.equal(results[1].errorStep, 'check find mark');
  assert.equal(results[1].error, 'Simulated find probe failure.');
  assert.equal(results[2].errorStep, 'click answer link');
  assert.equal(results[2].error, 'Simulated CDP failure.');
  assert.equal(results[3].targetFile, facts.deck.file);
  assert.deepEqual(results.map(({ opensRightDocument }) => opensRightDocument), [false, true, false, true]);
});
