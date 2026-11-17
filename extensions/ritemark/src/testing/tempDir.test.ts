/**
 * Tests for makeTempDir (src/testing/tempDir.ts): the folder goes when the test process ends, pass or fail,
 * also with a read-only folder inside it. Each case runs a child process with its own TMPDIR and looks at what
 * is left in that TMPDIR afterwards.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const helper = path.join(__dirname, 'tempDir.ts');
const tsx = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'tsx');

// The child's TMPDIR sits in a short root, not in os.tmpdir(): tsx puts an IPC socket in it, and a socket path over
// 104 bytes fails to listen (os.tmpdir() may already be a nested test temp folder)
const SHORT_ROOT = process.platform === 'win32' ? os.tmpdir() : '/tmp';

function leftAfter(body: string): { status: number | null; left: string[]; out: string } {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(SHORT_ROOT, 'rm-td-')));
  try {
    const script = path.join(tmp, 'child.ts');
    fs.writeFileSync(script, `import * as fs from 'node:fs';\nimport * as path from 'node:path';\nimport { makeTempDir } from ${JSON.stringify(helper)};\n${body}\n`);
    const r = spawnSync(tsx, [script], { env: { ...process.env, TMPDIR: tmp }, encoding: 'utf8' });
    const left = fs.readdirSync(tmp).filter((n) => n.startsWith('case-'));
    return { status: r.status, left, out: `${r.stdout}${r.stderr}` };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// A passing test
let r = leftAfter(`const d = makeTempDir('case-'); fs.writeFileSync(path.join(d, 'a.txt'), 'x');`);
assert.equal(r.status, 0, r.out);
assert.deepEqual(r.left, [], 'a passing test leaves its folder');

// A failing test: main()'s catch calls process.exit(1), as most test files here do
r = leftAfter(`async function main() { makeTempDir('case-'); makeTempDir('case-'); throw new Error('boom'); }
main().catch(() => process.exit(1));`);
assert.equal(r.status, 1, r.out);
assert.deepEqual(r.left, [], 'a failing test leaves its folders');

// An uncaught throw
r = leftAfter(`makeTempDir('case-'); throw new Error('boom');`);
assert.notEqual(r.status, 0, r.out);
assert.deepEqual(r.left, [], 'an uncaught error leaves the folder');

// A read-only folder inside it
r = leftAfter(`const d = makeTempDir('case-'); const ro = path.join(d, 'ro'); fs.mkdirSync(ro); fs.writeFileSync(path.join(ro, 'f'), 'x'); fs.chmodSync(ro, 0o500);`);
assert.equal(r.status, 0, r.out);
assert.deepEqual(r.left, [], 'a read-only folder inside keeps it');

console.log('tempDir.test.ts: all passed');
