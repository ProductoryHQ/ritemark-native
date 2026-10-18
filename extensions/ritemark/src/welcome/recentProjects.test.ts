/**
 * Sprint 133 (R10, S33): the project rows of the update welcome and the start sheet.
 * Run: npx tsx src/welcome/recentProjects.test.ts
 */

import assert from 'node:assert/strict';
import { displayPlace, lastOpenWords, projectMark, projectRows } from './recentProjects';

assert.equal(projectMark('Leadership programme'), 'LP');
assert.equal(projectMark('Sales proposal Q4'), 'SP');
assert.equal(projectMark('Board report 2026'), 'BR');
assert.equal(projectMark('Notes'), 'NO');
assert.equal(projectMark('my-project_v2'), 'MP');
assert.equal(projectMark('Öösel'), 'ÖÖ');
assert.equal(projectMark('!!!'), '?', 'a name with no letters or digits gets a plain mark');

assert.equal(displayPlace('/Users/a/Documents/Board report 2026', '/Users/a', 'darwin'), '~/Documents/Board report 2026');
assert.equal(displayPlace('/Volumes/Work/X', '/Users/a', 'darwin'), '/Volumes/Work/X');
assert.equal(displayPlace('C:\\Users\\a\\Documents\\X', 'C:\\Users\\a', 'win32'), 'C:\\Users\\a\\Documents\\X');

const now = new Date('2026-10-18T15:00:00').getTime();
const at = (iso: string) => new Date(iso).getTime();
assert.equal(lastOpenWords(at('2026-10-18T09:00:00'), now), 'Today');
assert.equal(lastOpenWords(at('2026-10-17T22:00:00'), now), 'Yesterday');
assert.equal(lastOpenWords(at('2026-10-15T10:00:00'), now), '3 days ago', 'calendar days: 15 October from 18 October');
assert.equal(lastOpenWords(at('2026-10-09T10:00:00'), now), 'Last week');
assert.equal(lastOpenWords(at('2026-09-25T10:00:00'), now), '3 weeks ago');
assert.equal(lastOpenWords(at('2026-09-01T10:00:00'), now), 'Last month');
assert.equal(lastOpenWords(at('2026-01-01T10:00:00'), now), 'Earlier');
assert.equal(lastOpenWords(undefined, now), null);

const recents = [
  { fsPath: '/Users/a/Documents/Sales proposal Q4', uri: 'file:///sales' },
  { fsPath: '/Users/a/Documents/Leadership programme', uri: 'file:///lead' },
  { fsPath: '/Users/a/Gone', uri: 'file:///gone' },
  { fsPath: '/Users/a/Documents/Board report 2026', uri: 'file:///board' },
  { fsPath: '/Users/a/Documents/Fourth', uri: 'file:///fourth' },
];
const rows = projectRows({
  recents,
  currentFolder: 'file:///lead',
  exists: (p) => !p.endsWith('Gone'),
  lastOpen: (uri) => (uri === 'file:///sales' ? at('2026-10-17T12:00:00') : uri === 'file:///board' ? at('2026-10-10T12:00:00') : undefined),
  home: '/Users/a',
  platform: 'darwin',
  now,
});
assert.deepEqual(rows.map((r) => [r.name, r.when, r.current]), [
  ['Leadership programme', 'Open when you left', true],
  ['Sales proposal Q4', 'Yesterday', false],
  ['Board report 2026', 'Last week', false],
], 'the one open when they left first; a gone folder left out; three at most');
assert.equal(rows[0].place, '~/Documents/Leadership programme');
assert.equal(rows[0].mark, 'LP');
assert.deepEqual(rows.map((r) => r.id), ['p0', 'p1', 'p2']);

const noCurrent = projectRows({ recents, currentFolder: undefined, exists: () => true, lastOpen: () => undefined, home: '/Users/a', platform: 'darwin', now });
assert.equal(noCurrent[0].name, 'Sales proposal Q4');
assert.equal(noCurrent.some((r) => r.current), false);
assert.equal(noCurrent[0].when, null);

console.log('✓ recentProjects tests passed');
