/**
 * Sprint 133 (R5, S18, S19): a new project's name, place and folder.
 * Run: npx tsx src/welcome/newProject.test.ts
 */

import assert from 'node:assert/strict';
import * as path from 'path';
import {
  checkProjectName,
  createProjectFolder,
  defaultProjectsParent,
  documentsFolder,
  parseRegQueryPersonal,
  placeLine,
  type ProjectFs,
} from './newProject';

// ── Names ──
assert.deepEqual(checkProjectName('  Board report 2026 ', 'darwin'), { ok: true, value: 'Board report 2026' });
assert.equal(checkProjectName('', 'darwin').ok, false);
assert.equal(checkProjectName('   ', 'win32').ok, false);
assert.equal(checkProjectName('a/b', 'darwin').ok, false);
assert.equal(checkProjectName('a:b', 'darwin').ok, false);
assert.equal(checkProjectName('a?b', 'darwin').ok, true, 'the Mac allows ?');
assert.equal(checkProjectName('a?b', 'win32').ok, false);
assert.equal(checkProjectName('Q4 "final"', 'win32').ok, false);
assert.equal(checkProjectName('report.', 'win32').ok, false, 'Windows drops a trailing dot');
assert.equal(checkProjectName('CON', 'win32').ok, false);
assert.equal(checkProjectName('con.txt', 'win32').ok, false);
assert.equal(checkProjectName('Console', 'win32').ok, true);
assert.equal(checkProjectName('.hidden', 'darwin').ok, false);
assert.equal(checkProjectName('x'.repeat(101), 'darwin').ok, false);
const refused = checkProjectName('a/b', 'darwin');
assert.ok(!refused.ok && refused.message.includes('“/”'), 'the refusal names the character');
assert.ok(!checkProjectName('', 'darwin').ok && !/error|invalid/i.test((checkProjectName('', 'darwin') as { message: string }).message), 'words, no codes');

// ── The place line ──
assert.equal(defaultProjectsParent('/Users/a/Documents'), path.join('/Users/a/Documents', 'Ritemark'));
assert.equal(placeLine({ parent: '/Users/a/Documents/Ritemark', name: 'Board report 2026', home: '/Users/a', documentsFolder: '/Users/a/Documents', platform: 'darwin' }), 'In ~/Documents/Ritemark/Board report 2026');
assert.equal(placeLine({ parent: '/Users/a/Documents/Ritemark', name: '', home: '/Users/a', documentsFolder: '/Users/a/Documents', platform: 'darwin' }), 'In ~/Documents/Ritemark/…');
assert.equal(placeLine({ parent: '/Volumes/Work', name: 'X', home: '/Users/a', documentsFolder: '/Users/a/Documents', platform: 'darwin' }), 'In /Volumes/Work/X');
assert.equal(placeLine({ parent: 'C:\\Users\\a\\OneDrive\\Documents\\Ritemark', name: 'Board', home: 'C:\\Users\\a', documentsFolder: 'C:\\Users\\a\\OneDrive\\Documents', platform: 'win32' }), 'In Documents\\Ritemark\\Board');
assert.equal(placeLine({ parent: 'D:\\Work', name: 'Board', home: 'C:\\Users\\a', documentsFolder: 'C:\\Users\\a\\Documents', platform: 'win32' }), 'In D:\\Work\\Board');

// ── The Documents folder ──
async function main(): Promise<void> {
  assert.equal(await documentsFolder({ platform: 'darwin', home: '/Users/a', env: {} }), path.join('/Users/a', 'Documents'));
  assert.equal(
    await documentsFolder({ platform: 'win32', home: 'C:\\Users\\a', env: { USERPROFILE: 'C:\\Users\\a', OneDrive: 'C:\\Users\\a\\OneDrive' }, readRegistryDocuments: async () => '%OneDrive%\\Documents' }),
    'C:\\Users\\a\\OneDrive\\Documents',
    'a OneDrive-moved Documents folder is read, not assumed',
  );
  assert.equal(
    await documentsFolder({ platform: 'win32', home: 'C:\\Users\\a', env: {}, readRegistryDocuments: async () => '%UNKNOWN%\\Documents' }),
    path.join('C:\\Users\\a', 'Documents'),
    'an unexpandable value falls back',
  );
  assert.equal(await documentsFolder({ platform: 'win32', home: 'C:\\Users\\a', env: {}, readRegistryDocuments: async () => { throw new Error('reg'); } }), path.join('C:\\Users\\a', 'Documents'));
  assert.equal(parseRegQueryPersonal('\r\nHKEY_CURRENT_USER\\Software\\...\\User Shell Folders\r\n    Personal    REG_EXPAND_SZ    %USERPROFILE%\\OneDrive\\Documents\r\n'), '%USERPROFILE%\\OneDrive\\Documents');
  assert.equal(parseRegQueryPersonal('nothing'), null);

  // ── Creating the folder ──
  const existing = new Set(['/docs/Ritemark/Taken']);
  const made: string[] = [];
  const fs: ProjectFs = {
    stat: async (target) => {
      if (existing.has(target)) return {};
      throw Object.assign(new Error('nope'), { code: 'ENOENT' });
    },
    mkdir: async (target, options) => {
      if (!options?.recursive && existing.has(target)) throw Object.assign(new Error('exists'), { code: 'EEXIST' });
      made.push(target);
      existing.add(target);
    },
  };
  assert.deepEqual(await createProjectFolder(fs, '/docs/Ritemark', 'Board report 2026', 'darwin'), { ok: true, value: '/docs/Ritemark/Board report 2026' });
  assert.deepEqual(made, ['/docs/Ritemark', '/docs/Ritemark/Board report 2026']);
  const taken = await createProjectFolder(fs, '/docs/Ritemark', 'Taken', 'darwin');
  assert.ok(!taken.ok && taken.message.includes('already there'), 'S19: an existing folder is refused, in words');
  const before = made.length;
  const bad = await createProjectFolder(fs, '/docs/Ritemark', 'a/b', 'darwin');
  assert.equal(bad.ok, false);
  assert.equal(made.length, before, 'nothing is created for a refused name');

  console.log('✓ newProject tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
