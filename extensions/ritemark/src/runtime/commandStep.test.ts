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

for (const command of [
  String.raw`/bin/bash -lc "ls -la; find . -type f | grep -v '/\\.'"`,
  String.raw`/bin/bash -lc "find . -type f | grep -v '/\\.'"`,
]) {
  test(command, () => {
    const step = classify(command);
    assert.equal(stepLabel({ type: 'done', tool: 'commandExecution', message: '', timestamp: 0, step: { ...step, status: 'completed' } })?.label,
      'Looked in the project folder');
  });
}

test('classifies folder listings piped through stdin filters', () => {
  for (const command of [
    String.raw`find . -type f | grep -v '/\.'`,
    'find . -type f 2>/dev/null | sort',
    'ls | grep -vi hidden | egrep -ixe foo -e bar | fgrep -e-fixed | sort -urnfV | uniq -c | head -n 5 | tail -2 | wc -l',
    "ls|cut -d ' ' -f 1,3-5|tr a-z A-Z|tr -d ' ' 2>/dev/null",
  ]) {
    assert.deepEqual(classify(command), { id: 'command', command, kind: 'folder', path: '.' });
  }
  assert.equal(classify('ls Reference | sort && find ./Reference/ -print | wc').path, 'Reference');
});

test('keeps unsupported pipeline stages and redirections visible', () => {
  for (const command of [
    'find . -type f | xargs rm', 'find . -type f | tee list.txt', 'find . | grep x > out',
    'cat a.docx | grep x', 'find /etc -type f | sort', 'ls | sh', 'ls |& sort', 'ls || sort',
    'find . -exec ls {} + | sort', 'ls | sed -n 1p', 'ls | awk x',
    'ls | grep x file', 'ls | grep -e x file', 'ls | grep -f patterns', 'ls | grep -e', 'ls | grep -v',
    'ls | sort file', 'ls | sort -o file', 'ls | uniq infile outfile', 'ls | head -n 2 file',
    'ls | tail file', 'ls | wc file', "ls | cut -d ' ' -f 1 file", 'ls | tr -d x y',
    'ls A | sort && find B -print | wc', 'ls | sort |',
    'ls 2>/dev/null extra | sort', 'ls 2>/dev/null.txt | sort', 'ls 2>/dev/null 2>/dev/null | sort',
    'ls 2>/dev/null < input | sort', 'ls > /dev/null | sort', 'ls | grep ">"', 'ls | grep "$x"',
    "ls | grep '\`x\`'", 'ls |\nsort',
  ]) {
    assert.deepEqual(classify(command), { id: 'command', command, kind: 'shell' });
  }
});
