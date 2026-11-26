import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commandStep } from './commandStep';
import { stepLabel } from '../../webview/src/components/ai-sidebar/stepLabel';
import type { ToolStep } from './toolStep';

const classify = (command: string, cwd = '/project') => {
  const step: ToolStep = { id: 'command', kind: 'shell', command };
  return commandStep(step, [{ type: 'unknown' }], cwd, '/project');
};

for (const command of [
  String.raw`ls -la; find . -type d \( -name '.*' -o -name node_modules \) ! -name . -prune -o -type f -print`,
  "find . -type f \\( -name '*.docx' -o -name '*.pdf' -o -name '*.pptx' \\)",
]) {
  for (const form of [command, `/bin/bash -lc "${command}"`, `/bin/bash -lc ${JSON.stringify(command)}`]) {
    test(form, () => {
      const step = classify(form);
      assert.deepEqual(step, { id: 'command', command: form, kind: 'folder', path: '.' });
      assert.equal(stepLabel({ type: 'done', tool: 'commandExecution', message: '', timestamp: 0, step: { ...step, status: 'completed' } })?.label,
        'Looked in the project folder');
    });
  }
}

// The exact command string a traced ChatGPT run sent (26 Nov, set 3): Codex double-quotes the command and
// single-quotes the part from `!` on, joined without a space.
test('the real wrapped command with joined quoted pieces', () => {
  const real = String.raw`/bin/bash -lc "ls -la; find . -type d \\( -name '.*' -o -name node_modules \\) "'! -name . -prune -o -type f -print'`;
  assert.equal(classify(real).kind, 'folder');
  assert.equal(classify(real).path, '.');
  assert.equal(classify(String.raw`/bin/bash -lc "ls -la"'; rm -rf x'`).kind, 'shell');
  assert.equal(classify(String.raw`/bin/bash -lc "find . "'-delete'`).kind, 'shell');
  assert.equal(classify(String.raw`/bin/bash -lc "ls" 'extra'`).kind, 'shell');
});

test('accepts read-only find predicates and a shared folder in compounds', () => {
  const command = "ls Reference && find ./Reference/ -mindepth 1 -maxdepth 2 '(' -type d -or -type l ')' -and -not -iname tmp -path '*/a' -ipath '*/B' -print0";
  assert.equal(classify(command).path, 'Reference');
  assert.equal(classify('ls; find Reference -print').path, '.');
});

test('keeps unsupported commands and outside paths visible', () => {
  for (const command of [
    String.raw`find . -type f -exec rm {} \;`, 'find . -delete', 'ls; rm x',
    'ls -la && find /etc -type f', String.raw`find . \( -name a \) > out.txt`,
    'ls; find ../Other -print', 'find /project -print', 'ls A && find B -print',
    'ls; cat x.docx', 'ls || ls', 'ls | ls', '(ls); ls', 'ls < input', 'ls >> out',
    'ls; ls "$folder"', 'ls; ls "`pwd`"', 'find . -newermt yesterday',
    'find . -fls out', 'find . -fprint0 out', 'find . -unknown',
  ]) {
    for (const form of [command, `/bin/bash -lc ${JSON.stringify(command)}`]) {
      const step = classify(form);
      assert.deepEqual(step, { id: 'command', kind: 'shell', command: form });
    }
  }
});
