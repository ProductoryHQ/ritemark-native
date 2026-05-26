import * as assert from 'assert';
import * as path from 'path';
import {
  buildWorkspaceFileLinkResult,
  isSearchableFile,
  shouldSkipWorkspacePath,
  sortWorkspaceFileResults,
} from './workspaceFileLinks';

const root = path.join(path.sep, 'workspace');
const documentPath = path.join(root, 'docs', 'notes', 'meeting.md');

const sibling = buildWorkspaceFileLinkResult(
  documentPath,
  path.join(root, 'docs', 'notes', 'follow-up.md'),
  root
);

assert.strictEqual(sibling.label, 'follow-up');
assert.strictEqual(sibling.relativePath, 'follow-up.md');
assert.strictEqual(sibling.workspacePath, 'docs/notes/follow-up.md');
assert.strictEqual(sibling.directory, 'docs/notes');
assert.strictEqual(sibling.kind, 'markdown');

const cousin = buildWorkspaceFileLinkResult(
  documentPath,
  path.join(root, 'docs', 'briefs', 'q2 plan.md'),
  root
);

assert.strictEqual(cousin.relativePath, '../briefs/q2 plan.md');
assert.strictEqual(cousin.workspacePath, 'docs/briefs/q2 plan.md');

assert.strictEqual(isSearchableFile('note.md'), true);
assert.strictEqual(isSearchableFile('image.png'), true);
// Sprint 72 (2026-05-26): the file-extension allowlist was removed.
// Source files and configs are now searchable; only heavy folders are excluded.
assert.strictEqual(isSearchableFile('script.ts'), true);
assert.strictEqual(isSearchableFile('config.yaml'), true);
assert.strictEqual(isSearchableFile('Dockerfile'), true);
assert.strictEqual(
  isSearchableFile(path.join(root, 'node_modules', 'pkg', 'readme.md')),
  false,
  'heavy-folder files must still be excluded'
);

assert.strictEqual(shouldSkipWorkspacePath(path.join(root, 'node_modules', 'pkg', 'readme.md')), true);
assert.strictEqual(shouldSkipWorkspacePath(path.join(root, 'docs', 'readme.md')), false);

const duplicateResults = [
  buildWorkspaceFileLinkResult(documentPath, path.join(root, 'docs', 'company', 'roadmap.md'), root),
  buildWorkspaceFileLinkResult(documentPath, path.join(root, 'docs', 'product', 'roadmap.md'), root),
  buildWorkspaceFileLinkResult(documentPath, path.join(root, 'docs', 'product', 'roadmap.pdf'), root),
];

const sorted = sortWorkspaceFileResults(duplicateResults, 'roadmap');
assert.strictEqual(sorted.length, 3);
assert.strictEqual(sorted[0].kind, 'markdown');
assert.ok(sorted[0].workspacePath.endsWith('roadmap.md'));
assert.ok(sorted[1].workspacePath.endsWith('roadmap.md'));
assert.ok(sorted[2].workspacePath.endsWith('roadmap.pdf'));

const fuzzy = sortWorkspaceFileResults(duplicateResults, 'rdmp');
assert.ok(fuzzy.length >= 2);

console.log('workspaceFileLinks tests passed');
