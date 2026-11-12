// The update notice's summary line (2.2.0 closeout): the first plain line of the notes, never an HTML comment.
// Run: node --test scripts/generate-update-feed.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getNotesSummary } from './generate-update-feed.mjs';

function notesFile(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feed-notes-'));
  const file = path.join(dir, 'release-notes.md');
  fs.writeFileSync(file, text);
  return file;
}

test('a comment above the title is skipped (2.2.0 first feed)', () => {
  const file = notesFile('<!-- Written with the `release-notes` skill. Sources: … -->\n\n# Ritemark 2.2.0\n\nYou can now share your ideas as a web page.\n');
  assert.equal(getNotesSummary({ 'notes-file': file, version: '2.2.0' }, null), 'You can now share your ideas as a web page.');
});

test('a comment over several lines is skipped', () => {
  const file = notesFile('# Ritemark 9.9.9\n\n<!--\nnote for editors\n-->\nThe first line people see.\n');
  assert.equal(getNotesSummary({ 'notes-file': file, version: '9.9.9' }, null), 'The first line people see.');
});

test('notes with no plain line fall back to the version', () => {
  const file = notesFile('<!-- only a comment -->\n# Ritemark 9.9.9\n');
  assert.equal(getNotesSummary({ 'notes-file': file, version: '9.9.9' }, null), 'Ritemark 9.9.9');
});

test('a summary given on the command line wins', () => {
  assert.equal(getNotesSummary({ 'notes-summary': '  Given.  ', version: '9.9.9' }, null), 'Given.');
});
