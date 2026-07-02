/**
 * Tests for Sprint 90 atomic saveAsMarkdown (issue #76).
 *
 * A failed save must leave NO partial state on disk: every image file this
 * save newly created is rolled back, while pre-existing user files in images/
 * are preserved. A successful save behaves exactly as before.
 *
 * Mocks `vscode` and `../analytics/posthog` via Module._load (same pattern as
 * browserActionTools.test.ts) so the handler can be exercised without the VS
 * Code host. Image writes and the .md write hit a real temp directory.
 *
 * Run: npx tsx src/export/saveAsMarkdown.test.ts
 */

import { strict as assert } from 'node:assert';
import Module from 'node:module';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ── vscode + posthog stubs (installed before requiring the unit) ────────────
let saveDialogResult: { fsPath: string } | undefined;
let failMarkdownWrite = false;

const vscodeStub = {
  Uri: { file: (p: string) => ({ fsPath: p }) },
  window: {
    showSaveDialog: async () => saveDialogResult,
    showErrorMessage: async () => undefined,
  },
  workspace: {
    fs: {
      writeFile: async (uri: { fsPath: string }, content: Uint8Array) => {
        if (failMarkdownWrite) throw new Error('injected markdown write failure');
        fs.writeFileSync(uri.fsPath, Buffer.from(content));
      },
    },
  },
  commands: { executeCommand: async () => undefined },
};

const moduleAny = Module as unknown as {
  _load: (request: string, parent: unknown, isMain?: boolean) => unknown;
};
const originalLoad = moduleAny._load.bind(Module);
moduleAny._load = (request: string, parent: unknown, isMain?: boolean): unknown => {
  if (request === 'vscode') return vscodeStub;
  if (request.endsWith('/posthog')) return { trackEvent: async () => undefined };
  return originalLoad(request, parent, isMain);
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saveAsMarkdownHandler } = require('./saveAsMarkdown') as typeof import('./saveAsMarkdown');
type Payload = import('./saveAsMarkdown').SaveAsMarkdownPayload;

// ── helpers ─────────────────────────────────────────────────────────────────
const b64 = (s: string) => Buffer.from(s).toString('base64');
const noopWebview = { postMessage: () => undefined } as unknown as Parameters<typeof saveAsMarkdownHandler>[2];

function tmpProject(): { dir: string; sourceUri: { fsPath: string }; saveUri: { fsPath: string } } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-saveas-'));
  return {
    dir,
    sourceUri: { fsPath: path.join(dir, 'source.docx') },
    saveUri: { fsPath: path.join(dir, 'out.md') },
  };
}

function images(count: number): Payload['images'] {
  return Array.from({ length: count }, (_, i) => ({
    filename: `out--image-${i + 1}.png`,
    contentType: 'image/png',
    base64: b64(`img-${i + 1}`),
  }));
}

function imagesDirOf(saveUri: { fsPath: string }) {
  return path.join(path.dirname(saveUri.fsPath), 'images');
}

async function run() {
  // ── S6: failure mid-images loop leaves no orphaned images and no .md ──────
  {
    const { dir, sourceUri, saveUri } = tmpProject();
    saveDialogResult = saveUri;
    failMarkdownWrite = false;
    const imgs = images(5);
    // 3rd image has an unsafe filename → writeImageRelativeTo throws mid-loop
    imgs![2].filename = 'evil/../escape.png';

    await saveAsMarkdownHandler({ ...basePayload(), images: imgs }, sourceUri as any, noopWebview);

    const imagesDir = imagesDirOf(saveUri);
    const remaining = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : [];
    assert.deepEqual(remaining, [], `S6: no image files should remain, found ${remaining}`);
    assert.equal(fs.existsSync(saveUri.fsPath), false, 'S6: no .md should be written');
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // ── S7: failure on the .md write cleans up all created images ─────────────
  {
    const { dir, sourceUri, saveUri } = tmpProject();
    saveDialogResult = saveUri;
    failMarkdownWrite = true;

    await saveAsMarkdownHandler({ ...basePayload(), images: images(3) }, sourceUri as any, noopWebview);

    const imagesDir = imagesDirOf(saveUri);
    const remaining = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : [];
    assert.deepEqual(remaining, [], `S7: all created images should be rolled back, found ${remaining}`);
    assert.equal(fs.existsSync(saveUri.fsPath), false, 'S7: no .md should remain');
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // ── S8: pre-existing files in images/ survive a failed save ───────────────
  {
    const { dir, sourceUri, saveUri } = tmpProject();
    saveDialogResult = saveUri;
    failMarkdownWrite = true;
    const imagesDir = imagesDirOf(saveUri);
    fs.mkdirSync(imagesDir, { recursive: true });
    const preExisting = path.join(imagesDir, 'photo.png');
    fs.writeFileSync(preExisting, 'user-owned');

    await saveAsMarkdownHandler({ ...basePayload(), images: images(2) }, sourceUri as any, noopWebview);

    assert.equal(fs.existsSync(preExisting), true, 'S8: pre-existing file must be preserved');
    assert.equal(fs.readFileSync(preExisting, 'utf8'), 'user-owned', 'S8: pre-existing content untouched');
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // ── S9: successful save writes the .md and all images ─────────────────────
  {
    const { dir, sourceUri, saveUri } = tmpProject();
    saveDialogResult = saveUri;
    failMarkdownWrite = false;

    await saveAsMarkdownHandler({ ...basePayload(), images: images(3) }, sourceUri as any, noopWebview);

    const imagesDir = imagesDirOf(saveUri);
    assert.equal(fs.existsSync(saveUri.fsPath), true, 'S9: .md should be written');
    assert.deepEqual(
      fs.readdirSync(imagesDir).sort(),
      ['out--image-1.png', 'out--image-2.png', 'out--image-3.png'],
      'S9: all images should be written',
    );
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('saveAsMarkdown.test.ts: all assertions passed');
}

function basePayload(): Payload {
  return {
    markdown: '# hello\n\n![](images/out--image-1.png)\n',
    defaultFilename: 'out.md',
    source: 'docx',
  };
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
