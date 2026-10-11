/**
 * Sprint 129 R7 — the voice model downloads reliably over a flaky connection.
 * Run: npx tsx src/voiceDictation/modelManager.test.ts
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';
import * as os from 'os';
import * as path from 'path';

// ── Minimal vscode stub (modelManager's download dialog imports vscode) ─────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === 'vscode') return '__vscode_stub__';
  return originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__', filename: '__vscode_stub__', loaded: true, children: [], paths: [], exports: { window: {} },
};

// The model directory follows the home folder; keep the real one untouched.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'model-download-'));
process.env.HOME = home;
process.env.USERPROFILE = home;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AVAILABLE_MODELS, downloadModel, isModelDownloaded } = require('./modelManager') as typeof import('./modelManager');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getModelPath } = require('./whisperCpp') as typeof import('./whisperCpp');

const MODEL = randomBytes(2 * 1024 * 1024);
const SHA = createHash('sha256').update(MODEL).digest('hex');

type Mode = 'drop-once' | 'truncate-always' | 'corrupt' | 'healthy';

async function withServer(mode: Mode, run: (url: string, stats: { downloads: number; ranges: string[] }) => Promise<void>): Promise<void> {
  const stats = { downloads: 0, ranges: [] as string[] };
  let dropped = false;
  const server = http.createServer((req, res) => {
    const range = /bytes=(\d+)-/.exec(req.headers.range ?? '');
    const start = range ? Number(range[1]) : 0;
    const body = mode === 'corrupt' ? Buffer.alloc(MODEL.length, 1) : MODEL;
    stats.downloads += 1;
    if (range) stats.ranges.push(req.headers.range!);

    if (mode === 'truncate-always') {
      // Claims and sends only part of the file, then ends cleanly.
      const part = body.subarray(start, Math.min(body.length, start + 300 * 1024));
      res.writeHead(range ? 206 : 200, { 'Content-Length': part.length });
      res.end(part);
      return;
    }

    const rest = body.subarray(start);
    res.writeHead(range ? 206 : 200, {
      'Content-Length': rest.length,
      ...(range ? { 'Content-Range': `bytes ${start}-${body.length - 1}/${body.length}` } : {}),
    });
    let offset = 0;
    const pump = () => {
      if (res.destroyed) return;
      if (mode === 'drop-once' && !dropped && start + offset >= body.length * 0.4) {
        dropped = true;
        res.socket?.destroy(); // the CDN closing the connection mid-file
        return;
      }
      if (offset >= rest.length) {
        res.end();
        return;
      }
      res.write(rest.subarray(offset, offset + 64 * 1024));
      offset += 64 * 1024;
      setImmediate(pump);
    };
    pump();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/model.bin`, stats);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

function register(name: string, url: string): void {
  AVAILABLE_MODELS[name] = { name, url, size: MODEL.length, sizeDisplay: '2MB', sha256: SHA };
}

const fast = { retryDelaysMs: [10, 10, 10] };

async function run(): Promise<void> {
  // A dropped connection resumes from where it stopped, on its own.
  await withServer('drop-once', async (url, stats) => {
    register('drop.bin', url);
    const progress: number[] = [];
    const result = await downloadModel('drop.bin', { ...fast, onProgress: (done) => progress.push(done) });
    assert.deepEqual(result, { success: true });
    assert.ok(stats.ranges.length >= 1, 'the second request asked for the rest with a Range header');
    assert.ok(progress.every((value, i) => i === 0 || value >= progress[i - 1]), 'progress never goes backwards');
    assert.equal(createHash('sha256').update(fs.readFileSync(getModelPath('drop.bin'))).digest('hex'), SHA);
    assert.equal(isModelDownloaded('drop.bin'), true);
    assert.equal(fs.existsSync(getModelPath('drop.bin') + '.partial'), false);
  });

  // A connection that keeps ending early gives up after the retries, keeping the part.
  await withServer('truncate-always', async (url) => {
    register('short.bin', url);
    const result = await downloadModel('short.bin', { retryDelaysMs: [10] });
    assert.equal(result.success, false);
    assert.match(result.error ?? '', /click Download to resume/);
    assert.equal(fs.existsSync(getModelPath('short.bin')), false, 'a short file is never installed as the model');
    assert.ok(fs.statSync(getModelPath('short.bin') + '.partial').size > 0, 'the part is kept for the next try');
  });

  // The right size with the wrong bytes is refused and removed.
  await withServer('corrupt', async (url) => {
    register('bad.bin', url);
    const result = await downloadModel('bad.bin', fast);
    assert.equal(result.success, false);
    assert.match(result.error ?? '', /damaged/);
    assert.equal(fs.existsSync(getModelPath('bad.bin')), false);
    assert.equal(fs.existsSync(getModelPath('bad.bin') + '.partial'), false);
  });

  // A model cut short at 90%+ no longer counts as downloaded (the old check let it through).
  await withServer('healthy', async (url) => {
    register('cut.bin', url);
    fs.mkdirSync(path.dirname(getModelPath('cut.bin')), { recursive: true });
    fs.writeFileSync(getModelPath('cut.bin'), MODEL.subarray(0, Math.floor(MODEL.length * 0.95)));
    assert.equal(isModelDownloaded('cut.bin'), false);
    const result = await downloadModel('cut.bin', fast);
    assert.deepEqual(result, { success: true });
    assert.equal(isModelDownloaded('cut.bin'), true);
  });

  // The real model entry is pinned: exact size and hash of the revision in the URL.
  const turbo = AVAILABLE_MODELS['ggml-large-v3-turbo.bin'];
  assert.match(turbo.url, /\/resolve\/[0-9a-f]{40}\/ggml-large-v3-turbo\.bin$/);
  assert.equal(turbo.size, 1_624_555_275);
  assert.match(turbo.sha256 ?? '', /^[0-9a-f]{64}$/);

  fs.rmSync(home, { recursive: true, force: true });
  console.log('modelManager.test.ts: all tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
