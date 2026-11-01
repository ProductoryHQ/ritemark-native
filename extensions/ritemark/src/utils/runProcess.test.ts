/**
 * Tests for runProcess, the async stand-in for spawnSync.
 *
 * Run: npx tsx src/utils/runProcess.test.ts
 */

import assert from 'assert';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { MAX_PROCESS_OUTPUT, runProcess, stopProcessTree } from './runProcess';

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

  // A child that ignores SIGTERM is killed outright, and the answer comes only
  // once it has exited: repeated probes of a hung binary never pile up processes.
  if (process.platform !== 'win32') {
    const dir = mkdtempSync(join(tmpdir(), 'ritemark-run-process-test-'));
    const pidFile = join(dir, 'pid');
    const script = `process.on('SIGTERM', () => {}); require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));`
      + ` setInterval(() => {}, 1000);`;
    try {
      const started = Date.now();
      const result = await runProcess(process.execPath, ['-e', script], { timeout: 1000 });
      assert.strictEqual(result.error?.code, 'ETIMEDOUT');
      const pid = Number(readFileSync(pidFile, 'utf-8'));
      assert.strictEqual(isAlive(pid), false, 'the answer came while the child was still running');
      assert.ok(Date.now() - started < 5000, 'the answer came within the timeout and the kill grace');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Output is capped at spawnSync's 1 MiB: past it the child is stopped (ENOBUFS)
  // and the output kept stays within the cap.
  {
    const result = await runProcess(
      process.execPath,
      ['-e', 'const line = "x".repeat(64 * 1024); setInterval(() => { process.stdout.write(line); }, 1);'],
      { timeout: 10_000 },
    );
    assert.strictEqual(result.status, null);
    assert.strictEqual(result.error?.code, 'ENOBUFS');
    assert.ok(result.stdout.length <= MAX_PROCESS_OUTPUT, `kept ${result.stdout.length} bytes`);
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

  // #619: stopProcessTree stops a whole tree on Windows (taskkill /T /F, by its full path), and only the process
  // elsewhere. When taskkill can't start or fails, the process itself is still killed. Windows is simulated: the
  // platform reads win32 and each taskkill is recorded instead of run, then made to exit, fail or not start.
  {
    const childProcess = require('child_process') as { spawn: (...args: unknown[]) => unknown };
    const realSpawn = childProcess.spawn;
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    const started: { args: unknown[]; taskkill: EventEmitter }[] = [];
    childProcess.spawn = (...args: unknown[]) => {
      const taskkill = new EventEmitter();
      started.push({ args, taskkill });
      return taskkill;
    };
    const killed: string[] = [];
    const child = (pid: number, exitCode: number | null = null) => ({ pid, exitCode, signalCode: null, kill: (signal: string) => { killed.push(`${pid} ${signal}`); return true; } }) as never;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      stopProcessTree(child(4242));
      stopProcessTree(child(4243, 0));
      started[0].taskkill.emit('exit', 0);
      assert.deepStrictEqual(killed, [], 'a tree taskkill ended is not followed by kill()');
      stopProcessTree(child(4244), true);
      started[1].taskkill.emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }));
      stopProcessTree(child(4245));
      started[2].taskkill.emit('exit', 1);
    } finally {
      Object.defineProperty(process, 'platform', platform);
      childProcess.spawn = realSpawn;
    }
    assert.deepStrictEqual(
      started.map(({ args }) => args),
      [4242, 4244, 4245].map((pid) => ['C:\\Windows\\System32\\taskkill.exe', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }]),
      'one taskkill each, by its full path; none for a child that already exited',
    );
    assert.deepStrictEqual(killed, ['4244 SIGKILL', '4245 SIGTERM'], 'kill() when taskkill did not start, or failed');
    console.log(`  Windows: ${started.map(({ args }) => `${args[0]} ${(args[1] as string[]).join(' ')}`).join('; ')}`);
  }
  if (process.platform !== 'win32') {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    const exited = new Promise<NodeJS.Signals | null>((resolve) => child.on('exit', (_code, signal) => resolve(signal)));
    stopProcessTree(child);
    assert.strictEqual(await exited, 'SIGTERM');
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
