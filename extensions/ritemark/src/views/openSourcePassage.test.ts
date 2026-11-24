/** Sprint 173 S24–S28: source navigation after the host opens the project file. */
import assert from 'node:assert/strict';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { join, win32 } from 'node:path';
import { Module } from 'node:module';
import { findRequests } from '../search/findAtPassage';
import { makeTempDir } from '../testing/tempDir';
import { resolveProjectDocument } from '../documents/projectPath';

async function main() {
  const base = await realpath(makeTempDir('rm-source-links-'));
  const root = join(base, 'project');
  await mkdir(root);
  const opens: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];
  const vscode = {
    workspace: { workspaceFolders: [{ uri: { scheme: 'file', fsPath: root } }] },
    Uri: { file: (path: string) => ({ toString: () => path }) },
    commands: { executeCommand: async (command: string, uri: { toString(): string }) => {
      assert.equal(command, 'vscode.open');
      assert.equal(findRequests.waiting(uri.toString()), null, 'opening comes before requesting navigation');
      opens.push(uri.toString());
    } },
    window: {
      showWarningMessage: (message: string) => warnings.push(message),
      showInformationMessage: (message: string) => info.push(message),
    },
  };
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const originalLoad = loader._load;
  loader._load = function (id, ...args) {
    return id === 'vscode' ? vscode : originalLoad.call(this, id, ...args);
  };
  let openSourcePassage: typeof import('./openSourcePassage').openSourcePassage;
  try {
    ({ openSourcePassage } = require('./openSourcePassage') as typeof import('./openSourcePassage'));
  } finally {
    loader._load = originalLoad;
  }

  for (const file of ['Word.docx', 'Report.pdf', 'Deck.pptx', 'No match.docx']) {
    await writeFile(join(root, file), '');
  }
  await writeFile(join(base, 'Outside.docx'), '');
  const noRead = async () => assert.fail('the worker should not read this target');
  await openSourcePassage('../Outside.docx', { text: 'words' }, noRead);
  assert.match(warnings[0], /inside the project folder/);
  assert.deepEqual(opens, []);

  await openSourcePassage('Word.docx', { text: 'words', page: 4 }, async (request) => {
    assert.deepEqual(request, { path: join(root, 'Word.docx'), passage: { text: 'words', page: 4 } });
    return { text: '', location: { text: 'Words', occurrence: 0 } };
  });
  await openSourcePassage('Report.pdf', { text: 'moved words', page: 4 }, async () => ({ text: '', location: { page: 4 } }));
  await openSourcePassage('Deck.pptx', { text: 'speaker notes', page: 5 }, noRead);
  await openSourcePassage('No match.docx', { text: 'paraphrase' }, async () => ({ text: '' }));
  assert.deepEqual(opens.map((file) => findRequests.waiting(file)), [
    { type: 'find:open', text: 'Words', occurrence: 0, source: true },
    { type: 'find:page', page: 4 },
    { type: 'find:slide', page: 5 },
    { type: 'find:top' },
  ]);
  assert.match(info[0], /Couldn't find these words. Opened at the top/);

  const windowsRealpath = async (file: string) => file.toLowerCase();
  assert.equal((await resolveProjectDocument('c:/REVIEW/Report.pdf', ['C:\\Review'], windowsRealpath, win32)).ok, true);
  assert.equal((await resolveProjectDocument('D:/REVIEW/Report.pdf', ['C:\\Review'], windowsRealpath, win32)).ok, false);
  console.log('openSourcePassage: all assertions passed');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
