/**
 * Run a short-lived child process without blocking the extension host.
 *
 * The extension host has a single JS thread: a `spawnSync` there freezes the AI
 * sidebar, editors, commands and timers until the child exits. This is the
 * async stand-in for it, for probes such as `codex --version`.
 */

import { spawn, type ChildProcess } from 'child_process';

export interface ProcessResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
}

export interface RunProcessOptions {
  /** Milliseconds before the child gets SIGTERM. Omitted: no limit, as with spawnSync. */
  timeout?: number;
  shell?: boolean;
  env?: NodeJS.ProcessEnv;
}

/**
 * Same stdio (`ignore/pipe/pipe`), shell flag and result shape as spawnSync with
 * utf-8 encoding. On timeout the child gets SIGTERM and the caller gets the
 * output so far. A failed spawn (ENOENT, EINVAL, …) comes back in `error`
 * rather than being thrown, as spawnSync reports it. Unlike spawnSync, the
 * answer arrives at the timeout even if the child ignores the signal.
 */
export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {},
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (result: ProcessResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    let child: ChildProcess;
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
        child.kill();
        const error: NodeJS.ErrnoException = new Error(`${command} timed out after ${timeout} ms`);
        error.code = 'ETIMEDOUT';
        settle({ status: null, stdout, stderr, error });
      }, timeout);
    }

    child.stdout?.setEncoding('utf-8');
    child.stderr?.setEncoding('utf-8');
    child.stdout?.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr?.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', (error) => settle({ status: null, stdout, stderr, error }));
    // 'close', not 'exit': the output is complete only once the pipes close.
    child.on('close', (status) => settle({ status, stdout, stderr }));
  });
}
