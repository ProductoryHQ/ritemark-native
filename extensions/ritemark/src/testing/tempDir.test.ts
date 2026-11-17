/**
 * Tests for makeTempDir (src/testing/tempDir.ts): the folder goes when the test process ends, pass or fail,
 * by a signal too, also with a read-only folder inside it. Each case runs a child process with its own TMPDIR and
 * looks at what is left in that TMPDIR afterwards.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const helper = path.join(__dirname, 'tempDir.ts');
const extensionRoot = path.join(__dirname, '..', '..');

function leftAfter(body: string): { status: number | null; signal: NodeJS.Signals | null; left: string[]; out: string } {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rm-td-')));
  try {
    const script = path.join(tmp, 'child.ts');
    fs.writeFileSync(script, `import * as fs from 'node:fs';\nimport * as path from 'node:path';\nimport { makeTempDir } from ${JSON.stringify(helper)};\n${body}\n`);
    // node --import tsx (resolved from the extension folder), not the tsx command: that one opens an IPC socket in
    // TMPDIR, and a socket path in a nested temp folder can pass the 104-byte limit
    const r = spawnSync(process.execPath, ['--import', 'tsx', script], { cwd: extensionRoot, env: { ...process.env, TMPDIR: tmp }, encoding: 'utf8' });
    const left = fs.readdirSync(tmp).filter((n) => n.startsWith('case-'));
    return { status: r.status, signal: r.signal, left, out: `${r.stdout}${r.stderr}` };
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

// Stopped by a signal (Ctrl-C, a timeout's SIGTERM): the folder goes, and the process still ends by that signal
for (const signal of process.platform === 'win32' ? [] : (['SIGTERM', 'SIGINT'] as const)) {
  r = leftAfter(`makeTempDir('case-'); setInterval(() => {}, 1000); setTimeout(() => process.kill(process.pid, '${signal}'), 50);`);
  assert.equal(r.signal, signal, `${signal}: ${r.status} ${r.out}`);
  assert.deepEqual(r.left, [], `${signal} leaves the folder`);
}

// A read-only folder inside it
r = leftAfter(`const d = makeTempDir('case-'); const ro = path.join(d, 'ro'); fs.mkdirSync(ro); fs.writeFileSync(path.join(ro, 'f'), 'x'); fs.chmodSync(ro, 0o500);`);
assert.equal(r.status, 0, r.out);
assert.deepEqual(r.left, [], 'a read-only folder inside keeps it');

console.log('tempDir.test.ts: all passed');
