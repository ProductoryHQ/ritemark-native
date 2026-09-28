/**
 * Tests for runProcess, the async stand-in for spawnSync.
 *
 * Run: npx tsx src/utils/runProcess.test.ts
 */

import assert from 'assert';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runProcess } from './runProcess';

async function waitFor(condition: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, message);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Output and exit code come back as spawnSync reported them.
  {
    const result = await runProcess(
      process.execPath,
      ['-e', 'process.stdout.write("out"); process.stderr.write("err"); process.exitCode = 3'],
      { timeout: 10_000 },
    );
    assert.deepStrictEqual(result, { status: 3, stdout: 'out', stderr: 'err' });
  }

  // A missing binary is a result, not an exception.
  {
    const result = await runProcess(join(tmpdir(), 'ritemark-no-such-binary'), ['--version'], { timeout: 10_000 });
    assert.strictEqual(result.status, null);
    assert.strictEqual(result.error?.code, 'ENOENT');
    assert.strictEqual(result.stdout, '');
  }

  // On timeout the child is killed and the output so far is kept.
  {
    const dir = mkdtempSync(join(tmpdir(), 'ritemark-run-process-test-'));
    const pidFile = join(dir, 'pid');
    const script = `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));`
      + ` process.stdout.write('codex-cli 0.1.0\\n'); setInterval(() => {}, 1000);`;
    try {
      const result = await runProcess(process.execPath, ['-e', script], { timeout: 2000 });
      assert.strictEqual(result.status, null);
      assert.strictEqual(result.error?.code, 'ETIMEDOUT');
      assert.strictEqual(result.stdout, 'codex-cli 0.1.0\n');
      const pid = Number(readFileSync(pidFile, 'utf-8'));
      await waitFor(() => !isAlive(pid), 'the timed-out child is still running');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Without a timeout a slow child is waited for, as spawnSync waits for it.
  {
    const result = await runProcess(process.execPath, ['-e', 'setTimeout(() => process.stdout.write("done"), 300)']);
    assert.deepStrictEqual(result, { status: 0, stdout: 'done', stderr: '' });
  }

  // The child gets the environment passed in (Codex puts the nvm bin dir first on PATH).
  {
    const result = await runProcess(
      process.execPath,
      ['-e', 'process.stdout.write(process.env.RITEMARK_RUN_PROCESS_TEST ?? "unset")'],
      { env: { ...process.env, RITEMARK_RUN_PROCESS_TEST: 'passed' } },
    );
    assert.strictEqual(result.stdout, 'passed');
  }

  // shell: true runs the command line through the shell, as execSync does.
  if (process.platform !== 'win32') {
    const result = await runProcess('echo', ['"$RITEMARK_RUN_PROCESS_TEST"'], {
      shell: true,
      env: { ...process.env, RITEMARK_RUN_PROCESS_TEST: 'expanded' },
    });
    assert.deepStrictEqual(result, { status: 0, stdout: 'expanded\n', stderr: '' });
  }

  // The reason it exists: the event loop keeps turning while the child runs.
  {
    let ticks = 0;
    const ticker = setInterval(() => { ticks++; }, 10);
    const result = await runProcess(process.execPath, ['-e', 'setTimeout(() => {}, 600)']);
    clearInterval(ticker);
    assert.strictEqual(result.status, 0);
    assert.ok(ticks >= 20, `the event loop stalled while the child ran (${ticks} ticks in ~600 ms)`);
  }

  console.log('runProcess.test.ts: all tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
