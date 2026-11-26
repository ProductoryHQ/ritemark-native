import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { copyDeckFolder } from './copyDeckFolder';
import { makeTempDir } from '../testing/tempDir';

async function main(): Promise<void> {
  const root = makeTempDir('copy-deck-folder');
  const source = path.join(root, 'Kickoff files');
  fs.mkdirSync(path.join(source, 'fonts'), { recursive: true });
  fs.writeFileSync(path.join(source, 'photo.png'), 'png');
  fs.writeFileSync(path.join(source, 'fonts', 'a.woff2'), 'font');

  // The app run (26 November): Electron's fs.cp refused the reserved folder, so the copy's folder stayed empty.
  // The copy goes entry by entry into the reserved folder, so it works whatever fs.cp does with an existing target.
  const copy = path.join(root, 'Kickoff copy files');
  assert.equal(await copyDeckFolder(source, copy), true);
  assert.equal(fs.readFileSync(path.join(copy, 'photo.png'), 'utf8'), 'png');
  assert.equal(fs.readFileSync(path.join(copy, 'fonts', 'a.woff2'), 'utf8'), 'font');

  // Create-only: a name already taken is left as it is.
  const taken = path.join(root, 'Taken files');
  fs.mkdirSync(taken);
  fs.writeFileSync(path.join(taken, 'mine.txt'), 'mine');
  assert.equal(await copyDeckFolder(source, taken), false);
  assert.deepEqual(fs.readdirSync(taken), ['mine.txt']);

  // A copy that fails part way leaves no half folder behind.
  const missing = path.join(root, 'Gone files');
  assert.equal(await copyDeckFolder(missing, path.join(root, 'Gone copy files')), false);
  assert.equal(fs.existsSync(path.join(root, 'Gone copy files')), false);

  fs.rmSync(root, { recursive: true, force: true });
  console.log('copyDeckFolder: passed');
}

main().catch(error => { console.error(error); process.exit(1); });
