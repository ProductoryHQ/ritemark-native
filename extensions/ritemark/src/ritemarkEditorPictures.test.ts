import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import Module from 'node:module';
import * as path from 'node:path';
import { test } from 'node:test';
import { sameMarkdownImageFile } from './utils/imagePaths';
import { makeTempDir } from './testing/tempDir';

const loader = Module as unknown as { _load(request: string, parent: { filename: string }, isMain: boolean): unknown };
const originalLoad = loader._load;
const uri = (fsPath: string) => ({ fsPath, toString: () => fsPath });
loader._load = function (request, parent, isMain) {
  if (request === 'vscode') return { Uri: { file: uri } };
  if (request === './pictures/chatgptPictureHost') return { ChatgptPictureHost: class {} };

  if (parent.filename === require.resolve('./ritemarkEditor') && request.startsWith('.')
      && !request.startsWith('./utils/imagePaths') && !request.startsWith('./utils/markdownImage')) return {};
  return originalLoad.call(this, request, parent, isMain);
};
const { RitemarkEditorProvider } = require('./ritemarkEditor') as typeof import('./ritemarkEditor');
loader._load = originalLoad;

const editor = Object.create(RitemarkEditorProvider.prototype) as {
  transformImagePaths(markdown: string, documentUri: ReturnType<typeof uri>, webview: {
    asWebviewUri: typeof uri;
  }): Record<string, string>;
};

const cases = [
  ['literal percent escape', '![](Screen%20Shot.png)', 'Screen%20Shot.png', 'Screen%20Shot.png'],
  ['quoted definition', '![ref]\n\n> [ref]: x.png', 'x.png', 'x.png'],
  ['list definition', '![ref]\n\n- [ref]: x.png', 'x.png', 'x.png'],
  ['ignore fenced definition', '![ref]\n\n```\n[ref]: old.png\n```\n\n[ref]: x.png', 'x.png', 'x.png'],
  ['text after title delimiters', '![ref]\n\n[ref]: x.png\n(see) more', 'x.png', 'x.png'],
  ['shortcut after malformed inline', '![ref](not valid\n\n[ref]: x.png', 'x.png', 'x.png'],
  ['inline entity', '![](a&amp;b.png)', 'a&amp;b.png', 'a&b.png'],
  ['reference entity', '![ref]\n\n[ref]: a&amp;b.png', 'a&amp;b.png', 'a&b.png'],
  ['double-quoted title', '![](./x.png "t")', './x.png', 'x.png'],
  ['angle destination and title', '![](<a b.png> "t")', 'a b.png', 'a b.png'],
  ['encoded space', '![](images/my%20pic.png)', 'images/my%20pic.png', 'images/my pic.png'],
  ['balanced parentheses', '![](a(1).png)', 'a(1).png', 'a(1).png'],
  ['single-quoted title', "![](a.png 't')", 'a.png', 'a.png'],
  ['parenthesized title', '![](a.png (t))', 'a.png', 'a.png'],
  ['decode failure falls back to raw', '![](a%.png)', 'a%.png', 'a%.png'],
  ['reference with definition', '![a][Ref]\n\n[ref]: x.png', 'x.png', 'x.png'],
  ['collapsed reference with titled definition', '![A B][]\n\n[a b]: <x y.png> "t"', 'x y.png', 'x y.png'],
  ['shortcut reference', '![a]\n\n[a]: x.png', 'x.png', 'x.png'],
  ['recover after malformed angle', '![](< ![](a.png)', 'a.png', 'a.png'],
  ['escaped parentheses', String.raw`![](a\(1\).png)`, String.raw`a\(1\).png`, 'a(1).png'],
  ['nested parentheses', '![](a(1(2)).png)', 'a(1(2)).png', 'a(1(2)).png'],
];

for (const [name, markdown, key, file] of cases) {
  test(name, () => {
    const dir = makeTempDir('ritemark-picture-scan-');
    try {
      const absolutePath = path.join(dir, file);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, '');
      if (name === 'ignore fenced definition') fs.writeFileSync(path.join(dir, 'old.png'), '');
      const mappings = editor.transformImagePaths(markdown, uri(path.join(dir, 'doc.md')), { asWebviewUri: uri });
      assert.deepEqual(mappings, { [key]: absolutePath + '?v=' + Math.round(fs.statSync(absolutePath).mtimeMs) });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('200 KB of unterminated angle destinations takes under 50 ms', () => {
  const markdown = '![ref]\n\n[ref]: hostile-test.png\n\n' + '![](<'.repeat(40_000);
  const start = performance.now();
  const mappings = editor.transformImagePaths(markdown, uri('/dev/null/doc.md'), { asWebviewUri: uri });
  const elapsed = performance.now() - start;
  assert.deepEqual(mappings, {});
  assert.ok(elapsed < 50, `${elapsed.toFixed(2)} ms`);
  console.log(`200 KB scan: ${elapsed.toFixed(2)} ms`);
});

test('file changes match the written spelling of a picture path', () => {
  assert.ok(sameMarkdownImageFile('images/my%20pic.png', './images/my pic.png'));
  assert.ok(sameMarkdownImageFile('Screen%20Shot.png', './Screen%20Shot.png'));
  assert.ok(sameMarkdownImageFile(String.raw`a\(1\).png`, './a(1).png'));
  assert.ok(sameMarkdownImageFile('a&amp;b.png', './a&b.png'));
  assert.ok(!sameMarkdownImageFile('images/my%20pic.png', './other/my pic.png'));
});
