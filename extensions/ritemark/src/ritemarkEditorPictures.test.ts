import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import Module from 'node:module';
import * as path from 'node:path';
import { test } from 'node:test';
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
      const mappings = editor.transformImagePaths(markdown, uri(path.join(dir, 'doc.md')), { asWebviewUri: uri });
      assert.deepEqual(mappings, { [key]: absolutePath + '?v=' + Math.round(fs.statSync(absolutePath).mtimeMs) });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('100 KB of unterminated angle destinations takes under 50 ms', () => {
  const markdown = '![](<'.repeat(20_000);
  const start = performance.now();
  const mappings = editor.transformImagePaths(markdown, uri('/tmp/doc.md'), { asWebviewUri: uri });
  const elapsed = performance.now() - start;
  assert.deepEqual(mappings, {});
  assert.ok(elapsed < 50, `${elapsed.toFixed(2)} ms`);
  console.log(`100 KB scan: ${elapsed.toFixed(2)} ms`);
});
