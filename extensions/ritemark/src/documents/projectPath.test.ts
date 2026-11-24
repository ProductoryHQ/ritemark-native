/** Sprint 173 S14–S15. Run: npx tsx src/documents/projectPath.test.ts */
import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { makeTempDir } from '../testing/tempDir';
import { resolveProjectDocument } from './projectPath';

async function main() {
  const base = makeTempDir('rm-document-path-');
  const root = path.join(base, 'project');
  const sibling = path.join(base, 'project-other');
  const secret = path.join(sibling, 'secret.docx');
  await mkdir(root);
  await mkdir(sibling);
  await writeFile(secret, 'outside');
  await writeFile(path.join(root, 'local.docx'), 'inside');
  await symlink(sibling, path.join(root, 'link'), 'junction');

  const outside = { ok: false, reason: 'outside' };
  for (const input of ['../../secret.docx', '../project-other/secret.docx', secret, 'link/secret.docx']) {
    assert.deepEqual(await resolveProjectDocument(input, [root]), outside, input);
  }
  assert.equal((await resolveProjectDocument('local.docx', [root])).ok, true);
  assert.equal((await resolveProjectDocument('secret.docx', [root, sibling])).ok, true);
  assert.deepEqual(await resolveProjectDocument('local.docx', []), outside);

  const win = path.win32;
  const project = 'C:/Project';
  const report = 'C:\\Project\\Reference\\Annual Report.pdf';
  const canonical = async (file: string) => {
    const normalized = win.normalize(file).toLowerCase();
    if (normalized === 'c:\\project') return 'C:\\Project';
    if (normalized === report.toLowerCase()) return report;
    throw new Error('Missing');
  };
  for (const input of ['reference\\Annual Report.pdf', 'c:/project/REFERENCE/annual report.pdf']) {
    const result = await resolveProjectDocument(input, [project], canonical, win);
    assert.ok(result.ok);
    assert.equal(result.path, report);
  }
  for (const input of ['D:/Project/Reference/Annual Report.pdf', 'C:secret.docx', 'Reference/a.docx:hidden', '//server/share/a.docx']) {
    assert.deepEqual(await resolveProjectDocument(input, [project], canonical, win), outside, input);
  }
  console.log('documents/projectPath: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
