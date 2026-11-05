/**
 * Which files Git ignores in the project (Sprint 149, R3): such a file never goes up, and the sheet names it.
 *
 * One `git check-ignore --stdin -z` per call, over absolute paths inside the project. No Git, or a folder that isn't
 * in a repository, ignores nothing. Any other failure throws: when Ritemark can't tell what Git ignores in a repository,
 * it doesn't guess that nothing is (fail closed).
 */

import { spawn } from 'node:child_process';

export class GitCheckError extends Error {
  constructor() {
    super("Ritemark couldn't check which files Git ignores in this project.");
    this.name = 'GitCheckError';
  }
}

export type GitIgnoredFn = (projectFolder: string, paths: readonly string[]) => Promise<Set<string>>;

export const gitIgnored: GitIgnoredFn = (projectFolder, paths) => {
  if (paths.length === 0) return Promise.resolve(new Set());
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn('git', ['-C', projectFolder, 'check-ignore', '-z', '--stdin'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
      });
    } catch {
      resolve(new Set());
      return;
    }
    const timer = setTimeout(() => done(() => {
      child.kill();
      reject(new GitCheckError());
    }), 15_000);
    const out: Buffer[] = [];
    let err = '';
    child.stdout?.on('data', (b: Buffer) => out.push(b));
    child.stderr?.on('data', (b: Buffer) => { err += b.toString('utf8'); });
    child.on('error', (e: NodeJS.ErrnoException) => done(() => {
      // No Git on this computer: nothing is ignored
      if (e.code === 'ENOENT') resolve(new Set());
      else reject(new GitCheckError());
    }));
    child.on('close', (code) => done(() => {
      if (code === 0 || code === 1) {
        const text = Buffer.concat(out).toString('utf8');
        resolve(new Set(text.split('\0').filter(Boolean)));
      } else if (/not a git repository/i.test(err)) {
        resolve(new Set());
      } else {
        reject(new GitCheckError());
      }
    }));
    child.stdin?.on('error', () => { /* a Git that exits early closes its input; the exit code decides */ });
    child.stdin?.end(paths.join('\0') + '\0');
  });
};
