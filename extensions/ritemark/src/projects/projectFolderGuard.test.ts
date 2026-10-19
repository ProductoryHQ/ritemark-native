/**
 * Sprint 134 (R13, W10): a folder under a project is made only while the
 * project's folder is there.
 * Run: npx tsx src/projects/projectFolderGuard.test.ts
 */

import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ensureProjectSubfolder,
  isInsideProject,
  isProjectFolderError,
  ProjectFolderError,
} from './projectFolderGuard';

function tempFolder(): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rm-project-guard-')));
}

function refusedWith(code: ProjectFolderError['code']) {
  return (error: unknown) => isProjectFolderError(error) && error.code === code;
}

async function main(): Promise<void> {
  // ── The root is there: the subfolder is made, with its missing parents ────
  {
    const parent = tempFolder();
    const root = path.join(parent, 'Notes');
    fs.mkdirSync(root);

    const made = await ensureProjectSubfolder(root, '.ritemark/flows');
    assert.equal(made, path.join(root, '.ritemark', 'flows'), 'returns the absolute path');
    assert.ok(fs.statSync(made).isDirectory(), 'the subfolder and its missing parent are made');

    fs.writeFileSync(path.join(made, 'keep.flow.json'), '{}');
    assert.equal(await ensureProjectSubfolder(root, '.ritemark/flows'), made, 'a second call is a no-op');
    assert.deepEqual(fs.readdirSync(made), ['keep.flow.json'], 'what is there is left alone');

    const absolute = path.join(root, 'images');
    assert.equal(await ensureProjectSubfolder(root, absolute), absolute, 'an absolute path inside the root is taken as it is');
    assert.ok(fs.existsSync(absolute));

    assert.equal(await ensureProjectSubfolder(root, ''), root, 'the root itself is only checked');
  }

  // ── The root is gone: refused, and nothing comes back ─────────────────────
  {
    const parent = tempFolder();
    const root = path.join(parent, 'Notes');
    fs.mkdirSync(root);
    fs.rmSync(root, { recursive: true });

    await assert.rejects(() => ensureProjectSubfolder(root, '.ritemark/tasks'), refusedWith('missing'));
    assert.equal(fs.existsSync(root), false, 'the gone project folder is not brought back');
    assert.deepEqual(fs.readdirSync(parent), [], 'nothing is made beside it either');

    const error = await ensureProjectSubfolder(root, 'recordings').catch((caught: unknown) => caught);
    assert.ok(error instanceof ProjectFolderError);
    assert.equal(error.projectRoot, root);
    assert.match(error.message, /is not where it was/, 'says it in words');
    assert.ok(error.message.includes(root), 'and names the folder');

    // A parent of the root that is gone too, or is a file, reads as missing.
    fs.writeFileSync(path.join(parent, 'a-file'), 'x');
    await assert.rejects(() => ensureProjectSubfolder(path.join(parent, 'a-file', 'Notes'), 'x'), refusedWith('missing'));
    await assert.rejects(() => ensureProjectSubfolder(path.join(parent, 'gone', 'Notes'), 'x'), refusedWith('missing'));
    assert.equal(fs.existsSync(path.join(parent, 'gone')), false);
  }

  // ── The root is a file: refused, and the file is left as it is ────────────
  {
    const parent = tempFolder();
    const root = path.join(parent, 'Notes');
    fs.writeFileSync(root, 'not a folder');

    await assert.rejects(() => ensureProjectSubfolder(root, '.ritemark/flows'), refusedWith('not-a-folder'));
    assert.equal(fs.readFileSync(root, 'utf8'), 'not a folder');
    assert.deepEqual(fs.readdirSync(parent), ['Notes']);
  }

  // ── A folder outside the project is refused ───────────────────────────────
  {
    const parent = tempFolder();
    const root = path.join(parent, 'Notes');
    fs.mkdirSync(root);

    await assert.rejects(() => ensureProjectSubfolder(root, '../Elsewhere'), refusedWith('outside'));
    await assert.rejects(() => ensureProjectSubfolder(root, path.join(parent, 'Notes-2')), refusedWith('outside'));
    assert.deepEqual(fs.readdirSync(parent), ['Notes'], 'nothing is made outside');

    assert.equal(isInsideProject(root, root), true);
    assert.equal(isInsideProject(root, path.join(root, 'a', 'b')), true);
    assert.equal(isInsideProject(root, path.join(root, '..folder')), true, 'a name that starts with two dots is inside');
    assert.equal(isInsideProject(root, `${root}x`), false);
    assert.equal(isInsideProject(root, parent), false);
  }

  // ── An injected filesystem: the site's own mkdir, after the stat ──────────
  {
    const calls: string[] = [];
    const made = await ensureProjectSubfolder('/projects/Notes', '.ritemark/tasks', {
      async stat(target) {
        calls.push(`stat ${target}`);
        return { isDirectory: () => true };
      },
      async mkdir(target) {
        calls.push(`mkdir ${target}`);
      },
    });
    assert.equal(made, path.resolve('/projects/Notes', '.ritemark', 'tasks'));
    assert.deepEqual(calls, [`stat ${path.resolve('/projects/Notes')}`, `mkdir ${made}`], 'the root is checked before anything is made');

    const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    await assert.rejects(
      () => ensureProjectSubfolder('/projects/Notes', 'x', { stat: async () => { throw denied; }, mkdir: async () => { calls.push('made anyway'); } }),
      (error: unknown) => error === denied,
      'any other stat error is passed on as it is',
    );
    assert.equal(calls.includes('made anyway'), false, 'and nothing is made');
  }

  console.log('projects/projectFolderGuard: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
