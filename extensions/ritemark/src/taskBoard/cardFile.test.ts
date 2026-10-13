import assert from 'node:assert/strict';
import {
  CARD_LIMITS,
  cardFileName,
  cardSlug,
  checkDoneWhen,
  checkFiles,
  checkTitle,
  clip,
  compareCards,
  mintCardId,
  parseCardFile,
  rankBetween,
  serializeCard,
  splitCardText,
  spliceCardBody,
  spreadRanks,
  withHistory,
  type Card,
} from './cardFile';

// The example from research/storage-decision.md, plus a key this version does
// not know (`priority`) and a body without a trailing newline.
const EXAMPLE = `---
ritemark: task/1
id: k3f9x2
title: Rewrite the launch plan intro
priority: high
stage: doing
rank: m
files:
  - docs/launch-plan.md
  - notes/audiences.md
created: 2026-10-11T10:02:00Z
updated: 2026-10-11T10:31:00Z
result:
  by: claude
  at: 2026-10-11T10:31:00Z
  seconds: 252
  summary: Rewrote the intro into one paragraph that names the three audiences.
  files:
    - docs/launch-plan.md
history:
  - { at: 2026-10-11T10:02:00Z, by: you, what: Created }
  - { at: 2026-10-11T10:05:00Z, by: you, what: Gave it to Claude }
  - { at: 2026-10-11T10:31:00Z, by: claude, what: "Finished: Rewrote the intro into one paragraph…" }
---
Make the intro shorter and name the three audiences: trainers, consultants and technical writers.

- [ ] Keep the first sentence
- [ ] Link the audience notes`;

function parsedCard(text: string): { card: Card; source: { data: Record<string, unknown> } } {
  const parsed = parseCardFile(text);
  assert.equal(parsed.kind, 'card', parsed.kind === 'error' ? parsed.message : 'expected a card');
  if (parsed.kind !== 'card') throw new Error('unreachable');
  return parsed;
}

function seeded(seed: number): (max: number) => number {
  let state = seed >>> 0;
  return (max) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % max;
  };
}

function main(): void {
  // ── Reading the documented example ─────────────────────────────────────────
  {
    const { card } = parsedCard(EXAMPLE);
    assert.equal(card.id, 'k3f9x2');
    assert.equal(card.stage, 'doing');
    assert.deepEqual(card.files, ['docs/launch-plan.md', 'notes/audiences.md']);
    assert.equal(card.created, '2026-10-11T10:02:00.000Z', 'an unquoted YAML time reads as an ISO string');
    assert.equal(card.result?.seconds, 252);
    assert.deepEqual(card.result?.check, [], 'a result without Check these has an empty list');
    assert.equal(card.history.length, 3);
    assert.equal(card.history[2].by, 'claude');
    assert.ok(card.description.startsWith('Make the intro shorter'));
    assert.ok(card.description.endsWith('- [ ] Link the audience notes'), 'the body is read exactly');
  }

  // ── Rewriting keeps what it does not own ───────────────────────────────────
  {
    const { card, source } = parsedCard(EXAMPLE);
    const moved = withHistory({ ...card, stage: 'done' }, { at: '2026-10-12T09:00:00.000Z', by: 'you', what: 'Marked done' });
    const text = serializeCard(moved, source);
    assert.ok(text.includes('priority: high'), 'an unknown key survives a rewrite');
    const keys = text.split('\n---\n')[0].split('\n').filter((line) => /^[a-z_]+:/.test(line)).map((line) => line.split(':')[0]);
    assert.deepEqual(
      keys.slice(0, 5),
      ['ritemark', 'id', 'title', 'priority', 'stage'],
      'keys keep their original order, the unknown one in its place',
    );
    assert.ok(text.endsWith('\n---\n' + card.description), 'the body is written back byte for byte');
    const again = parsedCard(text).card;
    assert.equal(again.stage, 'done');
    assert.equal(again.history.at(-1)?.what, 'Marked done');
    assert.deepEqual({ ...again, history: [] }, { ...moved, history: [] }, 'a rewrite reads back as the same card');
  }

  // ── Round trip of a full card ──────────────────────────────────────────────
  {
    const card: Card = {
      id: 'a1b2c3',
      title: 'Draft the workshop agenda: day 1 & 2',
      doneWhen: 'One page, three to five themes',
      stage: 'todo',
      rank: 'i',
      files: ['notes/meeting.md'],
      created: '2026-10-12T08:00:00.000Z',
      updated: '2026-10-12T08:30:00.000Z',
      result: {
        by: 'codex',
        at: '2026-10-12T08:30:00.000Z',
        seconds: 61,
        summary: 'Drafted it: "Morning" covers #1, #2.',
        files: ['notes/agenda.md'],
        check: ['The lunch slot', 'Room names'],
      },
      ask: { by: 'claude', at: '2026-10-12T08:20:00.000Z', question: 'Who first?', options: ['Trainers first', 'Consultants first'] },
      review: {
        by: 'claude',
        at: '2026-10-12T08:10:00.000Z',
        verdict: 'ready',
        why: 'Clear enough.',
        size: 'small',
        title: 'Draft the agenda',
        description: 'Three themes.',
        doneWhen: 'The agenda fits on one page.',
      },
      dropped: true,
      history: [{ at: '2026-10-12T08:00:00.000Z', by: 'you', what: 'Created: "quoted", #hash, colon: yes' }],
      description: '\n# Heading after a blank line\n\nText.\n',
    };
    const text = serializeCard(card);
    assert.ok(text.startsWith('---\nritemark: task/1\nid: a1b2c3\n'), 'a new file starts with the marker');
    assert.ok(text.includes('history:\n  - {'), 'history entries are one line each');
    assert.ok(text.includes('done_when: The agenda fits on one page.'), 'a review’s Done when is written as done_when');
    assert.deepEqual(parsedCard(text).card, card, 'every field round-trips, including awkward text');
  }

  // ── Empty optional parts are left out ──────────────────────────────────────
  {
    const text = serializeCard({ id: 'zz9zz9', title: 'Call Maria', stage: 'todo', rank: 'i', files: [], history: [], description: '' });
    assert.ok(!text.includes('files:') && !text.includes('result:') && !text.includes('dropped:'));
    assert.ok(text.endsWith('---\n'), 'an empty body stays empty');
    assert.equal(parsedCard(text).card.title, 'Call Maria');
  }

  // ── The rank is always quoted text (Windows test: `rank: 09`) ──────────────
  // js-yaml wrote `09` and `0i` plain; a YAML 1.2 reader takes `09` for 9.
  for (const rank of ['09', '0i', 'i', '9', '010', 'zz']) {
    const text = serializeCard({ id: 'zz9zz9', title: 'Call Maria', stage: 'todo', rank, files: [], history: [], description: '' });
    assert.ok(text.includes(`\nrank: '${rank}'\n`), `rank ${rank} is written quoted`);
    assert.equal(parsedCard(text).card.rank, rank, `rank ${rank} reads back unchanged`);
  }

  // ── What is not a card, and what is a broken one ───────────────────────────
  {
    assert.equal(parseCardFile('# Just notes\n').kind, 'not-a-card');
    assert.equal(parseCardFile('---\ntitle: A blog post\n---\nBody').kind, 'not-a-card');
    assert.equal(parseCardFile('---\nritemark: something-else\n---\n').kind, 'not-a-card');
    assert.equal(parseCardFile('---\n: : not yaml at all [\n---\n').kind, 'not-a-card', 'broken YAML without our marker is not ours');

    const broken = parseCardFile('---\nritemark: task/1\nid: k3f9x2\ntitle: [unclosed\n---\n');
    assert.equal(broken.kind, 'error');
    if (broken.kind === 'error') {
      assert.match(broken.message, /not valid YAML/);
      assert.doesNotMatch(broken.message, /:\)\.$/, 'no stray colon from the parser’s code excerpt');
    }

    const badStage = parseCardFile('---\nritemark: task/1\nid: k3f9x2\ntitle: T\nstage: waiting\n---\n');
    assert.equal(badStage.kind, 'error');
    if (badStage.kind === 'error') assert.match(badStage.message, /stage must be one of idea, todo, doing, done/);

    const badId = parseCardFile('---\nritemark: task/1\nid: K3F9X2!\ntitle: T\nstage: todo\n---\n');
    assert.equal(badId.kind, 'error');

    const newer = parseCardFile('---\nritemark: task/2\nid: k3f9x2\ntitle: T\nstage: todo\n---\n');
    assert.equal(newer.kind, 'error');
    if (newer.kind === 'error') assert.match(newer.message, /newer format/);

    const lenient = parsedCard('---\nritemark: task/1\nid: k3f9x2\ntitle: 2026\nstage: todo\nrank: 5\n---\n').card;
    assert.equal(lenient.title, '2026', 'an unquoted number reads as text');
    assert.equal(lenient.rank, '5');
  }

  // ── Ranks ──────────────────────────────────────────────────────────────────
  {
    assert.equal(rankBetween(), 'i', 'the first card of an empty stage');
    assert.equal(rankBetween('', '1'), '0i');
    assert.equal(rankBetween('az', 'b'), 'azi');
    assert.equal(rankBetween('a', 'ab'), 'a5');
    assert.equal(rankBetween('1', '10'), null, 'no room between hand-edited ranks');
    assert.equal(rankBetween('b', 'a'), null, 'reversed bounds are refused');
    assert.equal(rankBetween('B'), null, 'only 0-9a-z are ranks');

    // Insert 2,000 times at random places; the order must stay strict and no
    // rank may end in "0" (which would leave no room in front of it).
    const random = seeded(7);
    const ranks: string[] = [];
    for (let step = 0; step < 2000; step += 1) {
      const at = random(ranks.length + 1);
      const rank = rankBetween(ranks[at - 1], ranks[at]);
      assert.ok(rank, `room at step ${step}`);
      assert.ok(!rank.endsWith('0'));
      ranks.splice(at, 0, rank);
    }
    for (let index = 1; index < ranks.length; index += 1) assert.ok(ranks[index - 1] < ranks[index]);
    // New cards land on top: always inserting before the first stays short-ish.
    let first = 'i';
    for (let step = 0; step < 200; step += 1) first = rankBetween(undefined, first) ?? 'x';
    assert.ok(first.length < 60, `200 cards added on top keep ranks short (${first.length})`);

    for (const count of [1, 5, 35, 36, 100, 1500]) {
      const spread = spreadRanks(count);
      assert.equal(spread.length, count);
      for (let index = 1; index < spread.length; index += 1) assert.ok(spread[index - 1] < spread[index]);
      assert.ok(spread.every((rank) => !rank.endsWith('0')));
      assert.ok(rankBetween(undefined, spread[0]), 'room before the first spread rank');
    }

    const a = { id: 'aaaaaa', rank: 'm' } as Card;
    const b = { id: 'bbbbbb', rank: 'm' } as Card;
    assert.equal(compareCards(a, b), -1, 'equal ranks fall back to the id');
  }

  // ── Ids and file names ─────────────────────────────────────────────────────
  {
    const random = seeded(1);
    const taken = new Set<string>();
    for (let step = 0; step < 500; step += 1) {
      const id = mintCardId(taken, random);
      assert.match(id, /^[a-z0-9]{6}$/);
      assert.ok(!taken.has(id));
      taken.add(id);
    }
    let calls = 0;
    const id = mintCardId(new Set(['aaaaaa']), () => (calls++ < 6 ? 10 : 11));
    assert.equal(id, 'bbbbbb', 'a taken id is drawn again');

    assert.equal(cardSlug('Rewrite the launch plan intro'), 'rewrite-the-launch-plan-intro');
    assert.equal(cardSlug('Õppekava ülevaade — šokk!'), 'oppekava-ulevaade-sokk');
    assert.equal(cardSlug('🎉🎉'), 'task');
    // Windows reserves device names even with an extension (con.md, nul.md…).
    assert.equal(cardSlug('Con'), 'con-task');
    assert.equal(cardSlug('NUL'), 'nul-task');
    assert.equal(cardSlug('com1'), 'com1-task');
    assert.equal(cardSlug('Con call with Maria'), 'con-call-with-maria', 'only a whole name is reserved');
    assert.equal(cardSlug('Supercalifragilisticexpialidocious-and-even-longer-words-here'), 'supercalifragilisticexpialidocious-and');
    assert.ok(cardSlug('word '.repeat(30)).length <= 40);
    assert.equal(cardFileName('Call Maria'), 'call-maria.md');
    assert.equal(cardFileName('Call Maria', 2), 'call-maria-2.md');
  }

  // ── Archived (D15): a time, or `true` from a hand edit ─────────────────────
  {
    const base: Card = { id: 'arc001', title: 'Old', stage: 'done', rank: 'i', files: [], history: [], description: '' };
    const text = serializeCard({ ...base, archived: '2026-10-13T09:00:00.000Z' });
    assert.match(text, /\narchived: 2026-10-13T09:00:00.000Z\n/);
    assert.equal(parsedCard(text).card.archived, '2026-10-13T09:00:00.000Z');
    assert.equal(parsedCard(serializeCard(base)).card.archived, undefined, 'a card on the board has no archived key');
    assert.doesNotMatch(serializeCard(base), /archived/);
    const byHand = '---\nritemark: task/1\nid: arc002\ntitle: T\nstage: todo\narchived: true\n---\n';
    assert.equal(parsedCard(byHand).card.archived, '');
    assert.match(serializeCard(parsedCard(byHand).card, parsedCard(byHand).source), /\narchived: true\n/);
    assert.equal(parsedCard(byHand.replace('archived: true', 'archived: false')).card.archived, undefined);
  }

  // ── Front matter and body, for the card page ──────────────────────────────
  {
    const card = parsedCard(EXAMPLE).card;
    const text = serializeCard(card);
    const split = splitCardText(text);
    assert.ok(split, 'a serialized card splits');
    assert.equal(split!.head + split!.body, text, 'head and body are the whole file');
    assert.equal(split!.body, card.description, 'the body is what the parser reads as the description');
    assert.ok(split!.head.startsWith('---\n') && split!.head.endsWith('\n---\n'));
    // gray-matter's own reading agrees on hand-written files too.
    for (const sample of [EXAMPLE, '---\nritemark: task/1\n---\n', '---\r\nritemark: task/1\r\n---\r\nBody\r\n', '---\n---\nOnly a body']) {
      const cut = splitCardText(sample);
      assert.ok(cut, sample);
      assert.equal(cut!.head + cut!.body, sample);
    }
    assert.equal(splitCardText('# No front matter\n'), null);
    assert.equal(splitCardText('---\nnever closed\n'), null);
    assert.deepEqual(splitCardText('---\nritemark: task/1\n---'), { head: '---\nritemark: task/1\n---', body: '' });

    // Splicing keeps the front matter byte for byte and only replaces the body.
    const spliced = spliceCardBody(text, 'New body with **bold**');
    assert.equal(spliced, split!.head + 'New body with **bold**\n');
    assert.equal(spliceCardBody(text, ''), split!.head);
    assert.equal(spliceCardBody(text, 'Ends\n'), split!.head + 'Ends\n');
    assert.equal(spliceCardBody('# Not a card', 'x'), null);
    const reparsed = parseCardFile(spliced!);
    assert.equal(reparsed.kind, 'card');
    if (reparsed.kind === 'card') {
      assert.equal(reparsed.card.title, card.title);
      assert.deepEqual(reparsed.card.history, card.history);
      assert.equal(reparsed.card.description, 'New body with **bold**\n');
    }
  }

  // ── History cap and bounds ─────────────────────────────────────────────────
  {
    let card: Card = { id: 'k3f9x2', title: 'T', stage: 'todo', rank: 'i', files: [], history: [], description: '' };
    for (let step = 0; step < CARD_LIMITS.history + 7; step += 1) {
      card = withHistory(card, { at: `2026-10-12T08:00:${String(step % 60).padStart(2, '0')}.000Z`, by: 'you', what: `Step ${step}` });
    }
    assert.equal(card.history.length, CARD_LIMITS.history);
    assert.equal(card.history[0].what, 'Step 7', 'the oldest entries drop off');

    assert.deepEqual(checkTitle('  Call\n Maria  '), { ok: true, value: 'Call Maria' });
    assert.equal(checkTitle('   ').ok, false);
    assert.equal(checkTitle('x'.repeat(201)).ok, false);
    assert.deepEqual(checkDoneWhen(''), { ok: true, value: '' });
    assert.deepEqual(checkFiles(['./docs/a.md', 'docs\\b.md', 'docs/a.md', ' ']), { ok: true, value: ['docs/a.md', 'docs/b.md'] });
    assert.equal(checkFiles(['../secret.md']).ok, false);
    assert.equal(checkFiles(['/etc/hosts']).ok, false);
    assert.equal(checkFiles(['C:/Users/x.md']).ok, false);
    assert.equal(checkFiles(Array.from({ length: 21 }, (_, index) => `f${index}.md`)).ok, false);
    assert.equal(clip('short', 10), 'short');
    const clipped = clip('one two three four five six seven', 20);
    assert.ok(clipped.length <= 20 && clipped.endsWith('…'));
  }

  console.log('taskBoard/cardFile: all assertions passed');
}

main();
