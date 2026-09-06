import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

function normalizeFileUri(input, platform) {
  const uri = new URL(input);
  uri.protocol = uri.protocol.toLowerCase();
  uri.hostname = uri.hostname.toLowerCase();
  let pathname = decodeURIComponent(uri.pathname).replaceAll('\\', '/');
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
  if (platform === 'win32') pathname = pathname.toLowerCase();
  return `file://${uri.host}${encodeURI(pathname)}`;
}

async function writeJson(file, value) {
  await writeFile(file, JSON.stringify(value), 'utf8');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function atomicReplace(target, value, failBeforeRename = false) {
  const temp = `${target}.tmp-audit`;
  await writeJson(temp, value);
  if (failBeforeRename) throw new Error('injected-before-rename');
  await rename(temp, target);
}

const baseDir = await mkdtemp(path.join(tmpdir(), 'ritemark-conversation-audit-'));
const report = {
  platform: process.platform,
  node: process.version,
  tests: [],
};

try {
  const recordsDir = path.join(baseDir, 'records');
  const quarantineDir = path.join(baseDir, 'quarantine');
  await mkdir(recordsDir, { recursive: true });
  await mkdir(quarantineDir, { recursive: true });

  const record = path.join(recordsDir, 'conversation-a.json');
  await writeJson(record, { revision: 1, text: 'previous' });
  await atomicReplace(record, { revision: 2, text: 'next' });
  assert.deepEqual(await readJson(record), { revision: 2, text: 'next' });
  report.tests.push({ id: 'rename-over-existing-file', result: 'pass', detail: 'target contains complete revision 2' });

  let injected = false;
  try {
    await atomicReplace(record, { revision: 3, text: 'must-not-commit' }, true);
  } catch (error) {
    injected = error instanceof Error && error.message === 'injected-before-rename';
  }
  assert.equal(injected, true);
  assert.deepEqual(await readJson(record), { revision: 2, text: 'next' });
  assert.equal((await readdir(recordsDir)).includes('conversation-a.json.tmp-audit'), true);
  report.tests.push({ id: 'failure-before-record-rename', result: 'pass', detail: 'verified target remains revision 2; stale temp is separately detectable' });

  const index = path.join(baseDir, 'index.json');
  await writeJson(index, { revision: 1, ids: ['conversation-a'] });
  const recordB = path.join(recordsDir, 'conversation-b.json');
  await atomicReplace(recordB, { revision: 1, conversationId: 'conversation-b' });
  assert.deepEqual(await readJson(index), { revision: 1, ids: ['conversation-a'] });
  const discoveredIds = (await readdir(recordsDir))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
  assert.deepEqual(discoveredIds, ['conversation-a', 'conversation-b']);
  report.tests.push({ id: 'record-commit-before-index-failure', result: 'pass', detail: 'directory reconciliation discovers record missing from old index' });

  await writeFile(index, '{"schemaVersion":1,"entries":[', 'utf8');
  let indexCorrupt = false;
  try {
    await readJson(index);
  } catch {
    indexCorrupt = true;
  }
  assert.equal(indexCorrupt, true);
  const quarantinedIndex = path.join(quarantineDir, 'index.corrupt.json');
  await rename(index, quarantinedIndex);
  await atomicReplace(index, { revision: 2, ids: discoveredIds });
  assert.deepEqual((await readJson(index)).ids, ['conversation-a', 'conversation-b']);
  assert.equal((await readFile(quarantinedIndex, 'utf8')).startsWith('{"schemaVersion"'), true);
  report.tests.push({ id: 'corrupt-index-quarantine-and-rebuild', result: 'pass', detail: 'original corrupt bytes retained; rebuilt index lists valid records' });

  const corruptRecord = path.join(recordsDir, 'conversation-corrupt.json');
  await writeFile(corruptRecord, '{"conversationId":', 'utf8');
  let recordCorrupt = false;
  try {
    await readJson(corruptRecord);
  } catch {
    recordCorrupt = true;
  }
  assert.equal(recordCorrupt, true);
  await rename(corruptRecord, path.join(quarantineDir, 'conversation-corrupt.json'));
  assert.equal((await readdir(recordsDir)).filter((name) => name.endsWith('.json')).length, 2);
  report.tests.push({ id: 'corrupt-record-isolation', result: 'pass', detail: 'valid records remain enumerable after corrupt record quarantine' });

  const windowsA = [
    normalizeFileUri('file:///C:/Fixtures/Alpha/', 'win32'),
    normalizeFileUri('file:///d:/Fixtures/Beta', 'win32'),
  ].sort();
  const windowsB = [
    normalizeFileUri('file:///D:/FIXTURES/BETA/', 'win32'),
    normalizeFileUri('file:///c:/fixtures/alpha', 'win32'),
  ].sort();
  assert.deepEqual(windowsA, windowsB);
  assert.deepEqual(windowsA, ['file:///c:/fixtures/alpha', 'file:///d:/fixtures/beta']);
  report.tests.push({ id: 'windows-uri-case-and-order-model', result: 'pass', detail: windowsA.join(', ') });

  report.summary = `${report.tests.length}/${report.tests.length} passed`;
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(baseDir, { recursive: true, force: true });
}
