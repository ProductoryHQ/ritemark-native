/**
 * Sprint 134 (W13, confirmations §8): opening a file in another app never puts
 * its name inside a command string. `openInExternalApp` used to run
 * `open -a "<app>" "<file>"` (and `start "" "<file>"`) through a shell, so a
 * file named with `"`, `$(…)` or `;` could run a command. These tests hold the
 * name to one item of an argument list (macOS, Linux) or a URI handed to the
 * system (Windows), byte for byte.
 *
 * Run: npx tsx src/utils/openExternal.test.ts
 */

import * as assert from 'node:assert/strict';

// openExternal imports vscode for the Windows opener; give it a stub.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};
const openedUris: Array<{ scheme: string; fsPath: string }> = [];
let openExternalAnswer = true;
const vscodeStub = {
  Uri: {
    file: (fsPath: string) => ({ scheme: 'file', fsPath }),
  },
  env: {
    openExternal: async (uri: { scheme: string; fsPath: string }) => {
      openedUris.push(uri);
      return openExternalAnswer;
    },
  },
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  if (request === 'vscode') {
    return 'vscode';
  }
  return originalResolve.call(this, request, parent, isMain);
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
(require as unknown as { cache: Record<string, unknown> }).cache['vscode'] = {
  id: 'vscode',
  filename: 'vscode',
  loaded: true,
  exports: vscodeStub,
};

type Platform = 'darwin' | 'win32' | 'linux';

interface Recorder {
  execFileCalls: Array<{ file: string; args: string[] }>;
  systemCalls: string[];
}

async function main() {
  const { openInExternalApp, openWithDefaultApp, openFileWithSystem } = await import('./openExternal');

  function fakeDeps(platform: Platform, fail?: Error) {
    const recorder: Recorder = { execFileCalls: [], systemCalls: [] };
    const deps = {
      platform,
      execFile: async (file: string, args: readonly string[]) => {
        recorder.execFileCalls.push({ file, args: [...args] });
        if (fail) throw fail;
        return { stdout: '', stderr: '' };
      },
      openWithSystem: async (filePath: string) => {
        recorder.systemCalls.push(filePath);
        if (fail) throw fail;
      },
    };
    return { deps, recorder };
  }

  // A name a shell would act on: a closing quote, a command substitution, a
  // command separator, backticks, a variable and an ampersand.
  const macHostile = '/Users/jarmo/Kickoff "notes"; $(touch /tmp/pwned) `id` $HOME & echo.pdf';
  const winHostile = 'C:\\Users\\jarmo\\Kickoff $(calc); %USERPROFILE% & calc ^ notes.docx';

  // ── macOS: open -a <App> <file>, the name untouched ──
  {
    const { deps, recorder } = fakeDeps('darwin');
    await openInExternalApp(macHostile, 'Preview', deps);
    assert.deepEqual(recorder.execFileCalls, [{ file: 'open', args: ['-a', 'Preview', macHostile] }]);
    assert.equal(recorder.execFileCalls[0].args[2], macHostile, 'the file name reaches the argument list byte for byte');
    assert.deepEqual(recorder.systemCalls, [], 'macOS never uses the URI opener');
  }
  {
    const { deps, recorder } = fakeDeps('darwin');
    await openInExternalApp('/Users/jarmo/Participants.xlsx', 'Microsoft Excel', deps);
    assert.deepEqual(recorder.execFileCalls, [
      { file: 'open', args: ['-a', 'Microsoft Excel', '/Users/jarmo/Participants.xlsx'] },
    ], 'an app name with a space is one argument');
  }
  {
    const { deps, recorder } = fakeDeps('darwin');
    await openWithDefaultApp(macHostile, deps);
    assert.deepEqual(recorder.execFileCalls, [{ file: 'open', args: [macHostile] }], 'the default app: open <file>');
  }

  // ── Windows: the default app, through the system, with no command line ──
  {
    const { deps, recorder } = fakeDeps('win32');
    await openInExternalApp(winHostile, 'Microsoft Word', deps);
    assert.deepEqual(recorder.systemCalls, [winHostile], 'the file name reaches the opener byte for byte');
    assert.deepEqual(recorder.execFileCalls, [], 'no cmd, no start, no shell on Windows');
  }
  {
    const { deps, recorder } = fakeDeps('win32');
    await openWithDefaultApp(winHostile, deps);
    assert.deepEqual(recorder.systemCalls, [winHostile]);
    assert.deepEqual(recorder.execFileCalls, []);
  }
  {
    const { deps, recorder } = fakeDeps('win32');
    await openInExternalApp('\\\\server\\share\\Proposal.docx', 'Microsoft Word', deps);
    assert.deepEqual(recorder.systemCalls, ['\\\\server\\share\\Proposal.docx'], 'a network path is an absolute path');
  }

  // ── Linux: xdg-open <file> ──
  {
    const { deps, recorder } = fakeDeps('linux');
    await openInExternalApp(macHostile, 'ignored', deps);
    assert.deepEqual(recorder.execFileCalls, [{ file: 'xdg-open', args: [macHostile] }]);
  }

  // ── Only an absolute path is passed on, so a name is never read as an option ──
  for (const platform of ['darwin', 'win32', 'linux'] as const) {
    const { deps, recorder } = fakeDeps(platform);
    await assert.rejects(() => openInExternalApp('-n', 'Preview', deps), /Not an absolute path/);
    await assert.rejects(() => openWithDefaultApp('--args notes.pdf', deps), /Not an absolute path/);
    assert.deepEqual(recorder.execFileCalls, [], `${platform}: nothing ran`);
    assert.deepEqual(recorder.systemCalls, [], `${platform}: nothing opened`);
  }

  // ── A failure reaches the caller (the providers turn it into "Failed to open in …") ──
  {
    const { deps } = fakeDeps('darwin', new Error('Unable to find application named Preview'));
    await assert.rejects(() => openInExternalApp('/Users/jarmo/a.pdf', 'Preview', deps), /Unable to find application/);
  }
  {
    const { deps } = fakeDeps('win32', new Error('no app'));
    await assert.rejects(() => openWithDefaultApp('C:\\a.pdf', deps), /no app/);
  }

  // ── The Windows opener: a file URI, the path untouched; a refusal is an error ──
  openedUris.length = 0;
  await openFileWithSystem(winHostile);
  assert.deepEqual(openedUris, [{ scheme: 'file', fsPath: winHostile }]);
  openExternalAnswer = false;
  await assert.rejects(() => openFileWithSystem('C:\\a.pdf'), /did not open the file/);
  openExternalAnswer = true;

  // ── No string-built command is left in the opening path ──
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const source = readFileSync(join(__dirname, 'openExternal.ts'), 'utf-8');
  const openingCode = source.slice(source.indexOf('export async function openInExternalApp'), source.indexOf('export async function openCsvInExcelWithHints'));
  assert.ok(openingCode.length > 0, 'found the opening functions');
  assert.doesNotMatch(openingCode, /execAsync\(/, 'openInExternalApp and openWithDefaultApp never run a command string');
  assert.doesNotMatch(openingCode, /start ""/, 'no cmd start');

  console.log('openExternal tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
