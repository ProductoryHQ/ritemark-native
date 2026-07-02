/**
 * Run: npx tsx src/utils/imageWriter.test.ts
 *
 * Round-trips the save-as-markdown filename contract: the name the webview
 * embeds in the .md (`<sanitized-base>--image-N.ext`) must match the name
 * the extension actually writes to disk. Regression for the Sprint 68 bug
 * where re-sanitization collapsed the `--` separator to `-`, leaving the
 * markdown pointing at non-existent files.
 */

import assert from 'assert';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeImageRelativeTo, sanitizeImageBaseName, parseImageDataUrl } from './imageWriter';

const tempRoot = join(tmpdir(), `ritemark-image-writer-test-${process.pid}`);

// Mirror of webview/src/utils/imageNaming.ts:buildExtractedImageFilename — kept
// inline here so the test fails loudly if either side drifts.
function buildExpectedFilename(sourceBasename: string, index1Based: number, ext: string): string {
  const cleanBase = sanitizeImageBaseName(sourceBasename) || 'document';
  const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'png';
  return `${cleanBase}--image-${index1Based}.${cleanExt}`;
}

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';

try {
  mkdirSync(tempRoot, { recursive: true });

  // Source filenames the user might pass through the DOCX/PDF save-as-md flow.
  const sources = [
    'Event Streaming Architecture: From Batch to Real-Time',
    'Q1 Report — Final',
    'Notes & Plans (v2)',
    'simple-name',
    'already-clean',
  ];

  for (const source of sources) {
    const subdir = join(tempRoot, source.replace(/[^a-z0-9]/gi, '_'));
    const filename = buildExpectedFilename(source, 1, 'png');

    const written = writeImageRelativeTo(subdir, filename, ONE_PIXEL_PNG_BASE64, {
      skipSanitize: true,
    });

    assert.strictEqual(
      written,
      filename,
      `skipSanitize must preserve the webview-built filename for "${source}" (got "${written}", expected "${filename}")`
    );

    const onDisk = readdirSync(subdir);
    assert.ok(
      onDisk.includes(filename),
      `disk filename must match the .md reference for "${source}" — webview reference "${filename}" not found in [${onDisk.join(', ')}]`
    );
  }

  // Paste-flow caller (default behaviour) must still sanitize user-supplied
  // filenames so an arbitrarily-named clipboard image doesn't land on disk
  // with whitespace / punctuation.
  const pasteDir = join(tempRoot, 'paste');
  const sanitized = writeImageRelativeTo(pasteDir, 'My File: Foo.png', ONE_PIXEL_PNG_BASE64);
  assert.strictEqual(
    sanitized,
    'My-File-Foo.png',
    `default path must sanitize user-supplied filenames (got "${sanitized}")`
  );

  // skipSanitize must refuse any input that could escape targetDir on disk.
  // Defense-in-depth against a crafted webview message — Codex PR #75 P1.
  const trapDir = join(tempRoot, 'trap');
  const trapInputs = [
    '../escape.png',
    '..\\escape.png',
    '/etc/passwd',
    'C:\\Windows\\evil.png',
    'sub/dir/file.png',
    '.hidden.png',
    '..',
    '.',
    '',
  ];
  for (const evil of trapInputs) {
    assert.throws(
      () => writeImageRelativeTo(trapDir, evil, ONE_PIXEL_PNG_BASE64, { skipSanitize: true }),
      /Refusing unsafe image filename/,
      `skipSanitize must reject "${evil}"`
    );
  }
  // And the trap directory must not contain any files written by those rejections.
  if (existsSync(trapDir)) {
    const trapDirFiles = readdirSync(trapDir);
    assert.strictEqual(
      trapDirFiles.length,
      0,
      `no files should have landed in trap dir; got [${trapDirFiles.join(', ')}]`
    );
  }

  // parseImageDataUrl — SVG insert (Sprint 90 R6). The image picker offers .svg
  // and builds `data:image/svg+xml;base64,…`; the parser must accept the
  // compound subtype and map it to a clean `svg` extension, not reject it.
  assert.deepStrictEqual(
    parseImageDataUrl(`data:image/svg+xml;base64,${ONE_PIXEL_PNG_BASE64}`),
    { extension: 'svg', base64: ONE_PIXEL_PNG_BASE64 },
    'svg+xml data URL must parse to extension "svg"'
  );
  assert.strictEqual(parseImageDataUrl(`data:image/png;base64,${ONE_PIXEL_PNG_BASE64}`)?.extension, 'png');
  assert.strictEqual(parseImageDataUrl(`data:image/jpeg;base64,${ONE_PIXEL_PNG_BASE64}`)?.extension, 'jpg');
  assert.strictEqual(parseImageDataUrl(`data:image/webp;base64,${ONE_PIXEL_PNG_BASE64}`)?.extension, 'webp');
  assert.strictEqual(parseImageDataUrl('not a data url'), null, 'non-data-URL must return null');
  assert.strictEqual(parseImageDataUrl('data:text/plain;base64,AAAA'), null, 'non-image data URL must return null');

  console.log('imageWriter.test.ts: PASS');
} finally {
  if (existsSync(tempRoot)) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
