/**
 * Tests for where Text and Table make their file (Sprint 132 closeout, S24): the Untitled names, never over an
 * existing file, the folder chosen in the tree inside the project, the project's root otherwise, and no project.
 *
 * Run: npx tsx src/newDocumentLocation.test.ts
 */

import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { newDocumentFolder, nextUntitledPath, untitledName } from './newDocumentLocation';

const project = path.join(path.sep, 'projects', 'Harbour');
const modules = path.join(project, 'Modules');

// The names: Untitled, then Untitled 2, 3 ...
assert.equal(untitledName(1, 'md'), 'Untitled.md');
assert.equal(untitledName(2, 'md'), 'Untitled 2.md');
assert.equal(untitledName(3, 'csv'), 'Untitled 3.csv');

// The first free name, never an existing file's
const taken = new Set([path.join(modules, 'Untitled.md'), path.join(modules, 'Untitled 2.md')]);
assert.equal(nextUntitledPath(modules, 'md', p => taken.has(p)), path.join(modules, 'Untitled 3.md'));
assert.equal(nextUntitledPath(modules, 'csv', p => taken.has(p)), path.join(modules, 'Untitled.csv'));
assert.equal(nextUntitledPath(project, 'md', () => false), path.join(project, 'Untitled.md'));

// The folder chosen in the tree, when it is in the project
assert.equal(newDocumentFolder([project], modules), modules);
assert.equal(newDocumentFolder([project], project), project);

// Nothing chosen, or a folder outside the project: the project's root
assert.equal(newDocumentFolder([project], undefined), project);
assert.equal(newDocumentFolder([project], path.join(path.sep, 'projects', 'Harbour-old')), project);
assert.equal(newDocumentFolder([project], path.join(path.sep, 'elsewhere')), project);

// A second project folder counts as the project too
const second = path.join(path.sep, 'projects', 'Shared');
assert.equal(newDocumentFolder([project, second], path.join(second, 'Notes')), path.join(second, 'Notes'));

// No project open: no folder, so the caller uses the drafts folder
assert.equal(newDocumentFolder([], modules), undefined);
assert.equal(newDocumentFolder([], undefined), undefined);

console.log('newDocumentLocation: all tests passed');
