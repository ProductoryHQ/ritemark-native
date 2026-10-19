/**
 * Sprint 134 (E2): Home's and the projects list's requests are decoded field by field.
 * Run: npx tsx src/projects/protocol.test.ts
 */

import assert from 'node:assert/strict';
import { decodeHomeRequest, decodeProjectsRequest } from './protocol';

// ── Home ──
for (const type of ['home/ready', 'home/open-documents', 'home/change-cover', 'home/what-moved-seen', 'home/go-back', 'home/dismiss-switched', 'home/dismiss-missing', 'home/add-files', 'home/dismiss-notice']) {
  assert.deepEqual(decodeHomeRequest({ type }), { ok: true, request: { type } });
  assert.equal(decodeHomeRequest({ type, extra: 1 }).ok, false, `${type} refuses an extra field`);
}
assert.deepEqual(decodeHomeRequest({ type: 'home/set-line', line: 'Six modules' }), { ok: true, request: { type: 'home/set-line', line: 'Six modules' } });
assert.equal(decodeHomeRequest({ type: 'home/set-line', line: 5 }).ok, false);
assert.equal(decodeHomeRequest({ type: 'home/set-line', line: 'x'.repeat(5000) }).ok, false);
assert.equal(decodeHomeRequest({ type: 'home/set-line' }).ok, false);
assert.deepEqual(decodeHomeRequest({ type: 'home/open-waiting', id: 'card:aaaaa1' }), { ok: true, request: { type: 'home/open-waiting', id: 'card:aaaaa1' } });
assert.equal(decodeHomeRequest({ type: 'home/open-waiting', id: '../etc' }).ok, false, 'an id is never a path');
assert.equal(decodeHomeRequest({ type: 'home/open-recent', id: 'file:/Users/a' }).ok, false);
assert.deepEqual(decodeHomeRequest({ type: 'home/start', kind: 'table' }), { ok: true, request: { type: 'home/start', kind: 'table' } });
assert.equal(decodeHomeRequest({ type: 'home/start', kind: 'terminal' }).ok, false);
assert.deepEqual(decodeHomeRequest({ type: 'home/drop-files', uris: ['file:///Users/a/x.md'] }), { ok: true, request: { type: 'home/drop-files', uris: ['file:///Users/a/x.md'] } });
assert.equal(decodeHomeRequest({ type: 'home/drop-files', uris: [] }).ok, false);
assert.equal(decodeHomeRequest({ type: 'home/drop-files', uris: ['https://example.com/x'] }).ok, false);
assert.equal(decodeHomeRequest({ type: 'home/drop-files', uris: Array(201).fill('file:///a') }).ok, false);
assert.equal(decodeHomeRequest({ type: 'home/nope' }).ok, false);
assert.equal(decodeHomeRequest(null).ok, false);
assert.equal(decodeHomeRequest(['home/ready']).ok, false);

// ── The projects list ──
assert.deepEqual(decodeProjectsRequest({ type: 'projects/open', id: 'project:3f2a', newWindow: true }), { ok: true, request: { type: 'projects/open', id: 'project:3f2a', newWindow: true } });
assert.equal(decodeProjectsRequest({ type: 'projects/open', id: 'project:3f2a' }).ok, false, 'newWindow is required');
assert.equal(decodeProjectsRequest({ type: 'projects/open', id: 'project:3f2a', newWindow: 'yes' }).ok, false);
assert.deepEqual(decodeProjectsRequest({ type: 'projects/remove', id: 'project:3f2a' }), { ok: true, request: { type: 'projects/remove', id: 'project:3f2a' } });
assert.deepEqual(decodeProjectsRequest({ type: 'projects/new-project' }), { ok: true, request: { type: 'projects/new-project' } });
assert.equal(decodeProjectsRequest({ type: 'projects/open-folder', path: '/x' }).ok, false);
assert.equal(decodeProjectsRequest({ type: 'home/ready' }).ok, false, 'the two pages keep their own requests');

console.log('projects/protocol: all assertions passed');
