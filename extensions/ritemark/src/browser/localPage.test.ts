/**
 * Tests for localPage.ts (Sprint 149, R2, W1): which targets are local pages, and Publish's
 * project boundary by real path (S3, S4). Real temp folders and a real symlink; no `vscode`.
 */

import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isInside, isPagePath, locatePage, localPagePath } from './localPage';

async function main(): Promise<void> {
  // --- which targets are pages ---
  assert.equal(isPagePath('/p/Harbour programme.html'), true);
  assert.equal(isPagePath('/p/a.HTM'), true);
  assert.equal(isPagePath('/p/a.md'), false);
  assert.equal(localPagePath({ scheme: 'file', fsPath: '/p/a.html' }), '/p/a.html');
  assert.equal(localPagePath({ scheme: 'vscode-browser', fsPath: '/p/a.html' }), undefined);
  assert.equal(localPagePath('https://example.com/a.html'), undefined, 'S3: a web address is not a local page');
  assert.equal(localPagePath('file:///Users/me/Harbour%20programme.html'), '/Users/me/Harbour programme.html');
  assert.equal(localPagePath('file:///C:/Users/me/a.html'), 'C:/Users/me/a.html');
  assert.equal(localPagePath('file://server/share/a.html'), '//server/share/a.html');
  assert.equal(localPagePath('file:///Users/me/notes.md'), undefined);
  assert.equal(localPagePath('file://localhost/Users/me/a.html'), '/Users/me/a.html', 'localhost is no host');
  assert.equal(localPagePath('file://LOCALHOST/C:/me/a.html'), 'C:/me/a.html');
  assert.equal(isInside('/p/..notes/a.html', '/p', 'darwin'), true, 'a folder named ..notes is inside');
  assert.equal(isInside('C:\\proj\\..x\\a.html', 'C:\\proj', 'win32'), true);
  assert.equal(isInside('/p/../q/a.html', '/p', 'darwin'), false);
  assert.equal(localPagePath(undefined), undefined);

  // --- isInside, both platforms ---
  assert.equal(isInside('/p/sub/a.html', '/p', 'darwin'), true);
  assert.equal(isInside('/p2/a.html', '/p', 'darwin'), false, 'a sibling with the same prefix is outside');
  assert.equal(isInside('/x/a.html', '/p', 'darwin'), false);
  assert.equal(isInside('C:\\Proj\\a.html', 'c:\\proj', 'win32'), true, 'Windows ignores case');
  assert.equal(isInside('D:\\proj\\a.html', 'C:\\proj', 'win32'), false, 'another drive is outside');
  assert.equal(isInside('\\\\server\\share\\a.html', 'C:\\proj', 'win32'), false, 'a UNC path is outside');

  // --- locatePage on real folders ---
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'localpage-')));
  const project = path.join(root, 'project');
  const outside = path.join(root, 'Downloads');
  fs.mkdirSync(path.join(project, 'pages'), { recursive: true });
  fs.mkdirSync(outside);
  const inPage = path.join(project, 'pages', 'Harbour programme.html');
  const outPage = path.join(outside, 'dragged.html');
  fs.writeFileSync(inPage, '<h1>in</h1>');
  fs.writeFileSync(outPage, '<h1>out</h1>');
  const link = path.join(project, 'linked.html');
  fs.symlinkSync(outPage, link);

  const a = await locatePage(inPage, [project]);
  assert.equal(a.kind, 'project', 'a page in the project can be published');
  assert.equal(a.kind === 'project' && a.projectFolder, project);

  const b = await locatePage(outPage, [project]);
  assert.equal(b.kind, 'outside', 'S4: a page outside the project gets no Publish');

  const c = await locatePage(link, [project]);
  assert.equal(c.kind, 'outside', 'a symlink in the project that points out of it is outside');

  const d = await locatePage(path.join(project, 'pages', '..', '..', 'Downloads', 'dragged.html'), [project]);
  assert.equal(d.kind, 'outside', '.. that climbs out of the project is outside');

  const e = await locatePage(path.join(project, 'gone.html'), [project]);
  assert.equal(e.kind, 'missing');

  const f = await locatePage(inPage, []);
  assert.equal(f.kind, 'outside', 'no project open: nothing is a project page');

  const g = await locatePage(inPage, [path.join(root, 'no-such-folder'), project]);
  assert.equal(g.kind, 'project', 'an unresolvable folder is skipped, not fatal');

  // The project folder opened through a symlink still holds its own pages.
  const projectLink = path.join(root, 'project-link');
  fs.symlinkSync(project, projectLink);
  const h = await locatePage(path.join(projectLink, 'pages', 'Harbour programme.html'), [projectLink]);
  assert.equal(h.kind, 'project');

  // Security review of PR 2: a name that ends in .html but is a link to a program or a folder is no page. The
  // system's opener would run the link's target (a .command in Terminal, a .bat on Windows) or open the folder.
  const program = path.join(project, 'run.command');
  fs.writeFileSync(program, '<!-- -->\necho ran\n', { mode: 0o755 });
  const disguised = path.join(project, 'index.html');
  fs.symlinkSync(program, disguised);
  const i = await locatePage(disguised, [project]);
  assert.equal(i.kind, 'notAPage', 'a .html link to a program is not a page');
  const folderPage = path.join(project, 'folder.html');
  fs.mkdirSync(folderPage);
  const j = await locatePage(folderPage, [project]);
  assert.equal(j.kind, 'notAPage', 'a folder named .html is not a page');
  const pageLink = path.join(project, 'alias.html');
  fs.symlinkSync(inPage, pageLink);
  const k = await locatePage(pageLink, [project]);
  assert.equal(k.kind === 'project' && k.realPath, inPage, 'a link to a page in the project is that page');

  // A file URL from the bar round-trips through localPagePath into locatePage.
  const fromBar = localPagePath(pathToFileURL(inPage).toString());
  assert.equal(fromBar, inPage);

  fs.rmSync(root, { recursive: true, force: true });
  console.log('localPage.test.ts: all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
