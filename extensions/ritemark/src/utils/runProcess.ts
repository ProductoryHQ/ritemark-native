/**
 * Run a short-lived child process without blocking the extension host.
 *
 * The extension host has a single JS thread: a `spawnSync` there freezes the AI
 * sidebar, editors, commands and timers until the child exits. This is the
 * async stand-in for it, for probes such as `claude --version` and
 * `codex --version`.
 */

import { spawn, type ChildProcess } from 'child_process';

export interface ProcessResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
}

export interface RunProcessOptions {
  /** Milliseconds before the child is stopped. Omitted: no limit, as with spawnSync. */
  timeout?: number;
  shell?: boolean;
  env?: NodeJS.ProcessEnv;
}

// spawnSync's and execSync's default maxBuffer: output past it is a broken or runaway binary.
export const MAX_PROCESS_OUTPUT = 1024 * 1024;
// How long a stopped child gets to exit before it is killed outright, and then before it is given up on.
const KILL_GRACE_MS = 1000;

/**
 * Stop a child: on Windows its whole tree (a `.cmd` shell would leave its Node
 * child running), elsewhere the process itself, with SIGKILL when `force`.
 */
function stopProcess(child: ChildProcess, force: boolean): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }).on('error', () => {});
    } catch {
      // Already gone.
    }
    return;
  }
  child.kill(force ? 'SIGKILL' : 'SIGTERM');
}

/**
 * Same stdio (`ignore/pipe/pipe`), shell flag and result shape as spawnSync with
 * utf-8 encoding. A failed spawn (ENOENT, EINVAL, …) comes back in `error`
 * rather than being thrown, as spawnSync reports it. On timeout (`ETIMEDOUT`),
 * or once the output passes spawnSync's 1 MiB (`ENOBUFS`), the child is stopped
 * — SIGTERM, then SIGKILL a second later; on Windows its whole tree — and the
 * caller gets the output so far once it has exited, so repeated probes of a
 * hung binary never pile up running processes.
 */
export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {},
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let settled = false;
    let stopping: NodeJS.ErrnoException | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let child: ChildProcess | undefined;
    const settle = (result: ProcessResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      if (stopping) {
        // A descendant may still hold the pipes open; let them go.
        child?.stdout?.destroy();
        child?.stderr?.destroy();
      }
      resolve(result);
    };
    const stop = (error: NodeJS.ErrnoException) => {
      if (stopping || settled || !child) return;
      const running = child;
      stopping = error;
      clearTimeout(timer);
      stopProcess(running, false);
      killTimer = setTimeout(() => {
        stopProcess(running, true);
        killTimer = setTimeout(() => settle({ status: null, stdout, stderr, error }), KILL_GRACE_MS);
      }, KILL_GRACE_MS);
    };
    const collect = (append: (chunk: string) => void) => (chunk: string) => {
      if (stopping || settled) return;
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > MAX_PROCESS_OUTPUT) {
        const error: NodeJS.ErrnoException = new Error(`${command} wrote more than ${MAX_PROCESS_OUTPUT} bytes`);
        error.code = 'ENOBUFS';
        stop(error);
        return;
      }
      append(chunk);
    };

    try {
      child = spawn(command, args, {
        shell: options.shell ?? false,
        env: options.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      // spawnSync throws only for invalid arguments; syscall failures are results.
      if (typeof (err as NodeJS.ErrnoException).errno === 'number') {
        settle({ status: null, stdout, stderr, error: err as NodeJS.ErrnoException });
      } else {
        reject(err);
      }
      return;
    }

    if (options.timeout) {
      const timeout = options.timeout;
      timer = setTimeout(() => {
        const error: NodeJS.ErrnoException = new Error(`${command} timed out after ${timeout} ms`);
        error.code = 'ETIMEDOUT';
        stop(error);
      }, timeout);
    }

    child.stdout?.setEncoding('utf-8');
    child.stderr?.setEncoding('utf-8');
    child.stdout?.on('data', collect((chunk) => { stdout += chunk; }));
    child.stderr?.on('data', collect((chunk) => { stderr += chunk; }));
    child.on('error', (error) => settle({ status: null, stdout, stderr, error: stopping ?? error }));
    // A stopped child is done when it exits, even if a descendant keeps its pipes open.
    child.on('exit', () => {
      if (stopping) settle({ status: null, stdout, stderr, error: stopping });
    });
    // Otherwise 'close', not 'exit': the output is complete only once the pipes close.
    child.on('close', (status) => settle(stopping ? { status: null, stdout, stderr, error: stopping } : { status, stdout, stderr }));
  });
}
