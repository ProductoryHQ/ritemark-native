/**
 * Sprint 133 (R5, S50, S51): Try the sample project. The next free name,
 * nothing written over, a failed copy, the cards' dates set to the copy's time,
 * and every card in the shipped sample parses as a card.
 * Run: npx tsx src/welcome/sampleProject.test.ts
 */

import assert from 'node:assert/strict';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseCardFile } from '../taskBoard/cardFile';
import { SAMPLE_PROJECT_NAME, SAMPLE_PROJECT_SOURCE, candidateName, copySampleProject, type SampleFs } from './sampleProject';

const nodeFs: SampleFs = {
  mkdir: (target, options) => fsp.mkdir(target, options),
  readdir: (target) => fsp.readdir(target, { withFileTypes: true }),
  copyFile: (from, to, mode) => fsp.copyFile(from, to, mode),
  readFile: (target) => fsp.readFile(target, 'utf8'),
  writeFile: (target, text) => fsp.writeFile(target, text, 'utf8'),
  exists: async (target) => fs.existsSync(target),
};

const shipped = path.join(__dirname, '..', '..', SAMPLE_PROJECT_SOURCE);

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(root, full));
    }
  };
  walk(root);
  return out.sort();
}

async function main(): Promise<void> {
  assert.equal(candidateName(SAMPLE_PROJECT_NAME, 1), 'Leadership programme');
  assert.equal(candidateName(SAMPLE_PROJECT_NAME, 2), 'Leadership programme 2');

  // ── Every card in the shipped sample is a card, with the placeholder dates ──
  const tasks = path.join(shipped, '.ritemark', 'tasks');
  const cards = fs.readdirSync(tasks).filter((name) => name.endsWith('.md'));
  assert.equal(cards.length, 4, 'four cards: one idea, two to do, one done');
  const stages: string[] = [];
  for (const name of cards) {
    const parsed = parseCardFile(fs.readFileSync(path.join(tasks, name), 'utf8'));
    assert.equal(parsed.kind, 'card', `${name} parses as a card`);
    if (parsed.kind === 'card') {
      stages.push(parsed.card.stage);
      assert.equal(parsed.card.created, '2026-01-01T09:00:00.000Z');
    }
  }
  assert.deepEqual(stages.sort(), ['done', 'idea', 'todo', 'todo']);
  for (const file of listFiles(shipped)) {
    const text = fs.readFileSync(path.join(shipped, file), 'utf8');
    assert.doesNotMatch(text, /\/Users\/|C:\\Users\\|@productory|jarmo/i, `${file} holds no real path, account or name`);
  }

  const work = await fsp.mkdtemp(path.join(os.tmpdir(), 'rm-sample-'));
  try {
    const parent = path.join(work, 'Documents', 'Ritemark');
    const now = new Date('2026-10-18T12:34:56.000Z');

    // ── The first copy (S50) ──
    const first = await copySampleProject({ fs: nodeFs, source: shipped, parent, now });
    assert.deepEqual(first, { ok: true, folder: path.join(parent, 'Leadership programme') });
    assert.deepEqual(listFiles(path.join(parent, 'Leadership programme')), listFiles(shipped), 'every file, .ritemark and CLAUDE.md included');
    for (const name of cards) {
      const parsed = parseCardFile(fs.readFileSync(path.join(parent, 'Leadership programme', '.ritemark', 'tasks', name), 'utf8'));
      assert.ok(parsed.kind === 'card');
      if (parsed.kind === 'card') {
        assert.equal(parsed.card.created, now.toISOString(), `${name}: created is the copy's time`);
        assert.equal(parsed.card.updated, now.toISOString());
      }
    }
    assert.equal(
      fs.readFileSync(path.join(parent, 'Leadership programme', 'Brief.md'), 'utf8'),
      fs.readFileSync(path.join(shipped, 'Brief.md'), 'utf8'),
    );
    // The sample inside the app is unchanged.
    const shippedCard = parseCardFile(fs.readFileSync(path.join(tasks, cards[0]), 'utf8'));
    assert.ok(shippedCard.kind === 'card' && shippedCard.card.created === '2026-01-01T09:00:00.000Z');

    // ── A folder already there is never written into (S51) ──
    const mine = path.join(parent, 'Leadership programme', 'Brief.md');
    fs.writeFileSync(mine, 'My own edits');
    const second = await copySampleProject({ fs: nodeFs, source: shipped, parent, now });
    assert.deepEqual(second, { ok: true, folder: path.join(parent, 'Leadership programme 2') });
    assert.equal(fs.readFileSync(mine, 'utf8'), 'My own edits', 'nothing in the existing folder changes');

    // ── A copy that fails says so in one sentence, and a second try takes the next free name ──
    let failOnce = true;
    const flaky: SampleFs = {
      ...nodeFs,
      copyFile: async (from, to, mode) => {
        if (failOnce) { failOnce = false; throw new Error('disk full'); }
        return nodeFs.copyFile(from, to, mode);
      },
    };
    const failed = await copySampleProject({ fs: flaky, source: shipped, parent, now });
    assert.equal(failed.ok, false);
    assert.ok(!failed.ok && !/disk full|error/i.test(failed.message), 'one sentence, no error text');
    const retry = await copySampleProject({ fs: flaky, source: shipped, parent, now });
    assert.deepEqual(retry, { ok: true, folder: path.join(parent, 'Leadership programme 4') });
  } finally {
    await fsp.rm(work, { recursive: true, force: true });
  }

  console.log('✓ sampleProject tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
