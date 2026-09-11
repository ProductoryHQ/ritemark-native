import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertLocalIdentity,
  assertPublicKeyUnused,
  installerKey,
  parseArgs,
  verifyPublicObject,
} from './publish-store-installer.mjs';

const body = Buffer.from('Ritemark installer hosting test\n');
const sha256 = '08e310d8f007eac55128a67baae94b644e19f81475a8d58af06b72ace0239444';

test('builds the immutable versioned installer key', () => {
  assert.equal(installerKey('1.10.0'), 'windows/v1.10.0/Ritemark-Setup.exe');
});

test('publish requires an exact key confirmation', () => {
  assert.throws(() => parseArgs([
    'publish', '--version', '1.10.0', '--file', '/tmp/example.exe',
    '--size', '1', '--sha256', 'a'.repeat(64),
  ]), /--confirm-key windows\/v1\.10\.0\/Ritemark-Setup\.exe/);

  const options = parseArgs([
    'publish', '--version', '1.10.0', '--file', '/tmp/example.exe',
    '--size', '1', '--sha256', 'a'.repeat(64),
    '--confirm-key', 'windows/v1.10.0/Ritemark-Setup.exe',
  ]);
  assert.equal(options.publicUrl, 'https://getritemark.com/windows/v1.10.0/Ritemark-Setup.exe');
});

test('verifies a local file identity and cleans its temporary directory', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ritemark-store-hosting-'));
  const file = path.join(directory, 'Ritemark-Setup.exe');
  try {
    await writeFile(file, body);
    await assertLocalIdentity({ file, size: body.length, sha256 });
    await assert.rejects(
      assertLocalIdentity({ file, size: body.length + 1, sha256 }),
      /local size mismatch/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('requires a public 404 before upload', async () => {
  const unusedFetch = async url => {
    assert.match(url.href, /[?&]preflight=/);
    return new Response(null, { status: 404 });
  };
  await assertPublicKeyUnused('https://getritemark.com/unused', unusedFetch);
  await assert.rejects(
    assertPublicKeyUnused(
      'https://getritemark.com/existing',
      async () => new Response(null, { status: 200 }),
    ),
    /got HTTP 200/,
  );
});

test('streams and verifies the anonymous public response without leaving a file', async () => {
  const fetchImpl = async (_url, request) => {
    assert.equal(request.method, 'GET');
    assert.equal(request.redirect, 'manual');
    return new Response(body, {
      status: 200,
      headers: {
      'Content-Type': 'application/vnd.microsoft.portable-executable',
      'Content-Length': body.length,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'attachment; filename="Ritemark-Setup.exe"',
      'Accept-Ranges': 'bytes',
      },
    });
  };
  const evidence = await verifyPublicObject({
    publicUrl: 'https://getritemark.com/windows/v1.10.0/Ritemark-Setup.exe',
    size: body.length,
    sha256,
  }, fetchImpl);
  assert.equal(evidence.status, 200);
  assert.equal(evidence.redirects, 0);
  assert.equal(evidence.sha256, sha256);
  assert.equal(evidence.setCookie, null);
});
