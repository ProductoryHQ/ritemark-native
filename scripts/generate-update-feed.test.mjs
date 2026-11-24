// The update notice's summary line (2.2.0 closeout): the first plain line of the notes, never an HTML comment.
// Run: node --test scripts/generate-update-feed.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

import { CHANNELS, getNotesSummary } from './generate-update-feed.mjs';

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

test('uses the native repository for both update channels', () => {
  assert.deepEqual(CHANNELS, {
    stable: 'https://github.com/ProductoryHQ/ritemark-native/releases/latest/download/update-feed.json',
    canary: 'https://github.com/ProductoryHQ/ritemark-native/releases/download/canary/update-feed.json',
  });
});

test('generates a versioned native download URL for each full release asset', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-feed-assets-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const output = path.join(dir, 'update-feed.json');
  const script = fileURLToPath(new URL('./generate-update-feed.mjs', import.meta.url));
  const assets = [
    ['Ritemark-arm64.dmg', 'darwin', 'arm64'],
    ['Ritemark-x64.dmg', 'darwin', 'x64'],
    ['Ritemark-Setup.exe', 'win32', 'x64'],
  ];
  const args = assets.flatMap(([name, platform, arch]) => {
    const asset = path.join(dir, name);
    fs.writeFileSync(asset, name);
    return ['--asset', `${asset}|${platform}|${arch}|${name}`];
  });
  const emptyFeed = JSON.stringify({ fullReleases: [], extensionReleases: [] });
  execFileSync(process.execPath, [
    script, '--mode', 'full', '--version', '2.4.0', '--output', output,
    '--existing-feed-url', `data:application/json,${encodeURIComponent(emptyFeed)}`, ...args,
  ]);
  const feed = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.deepEqual(
    feed.fullReleases[0].platforms.map(asset => asset.downloadUrl),
    assets.map(([name]) => `https://github.com/ProductoryHQ/ritemark-native/releases/download/v2.4.0/${name}`),
  );
});
