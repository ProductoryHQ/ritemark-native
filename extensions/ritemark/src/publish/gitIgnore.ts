/**
 * Which files Git ignores in the project (Sprint 149, R3): such a file never goes up, and the sheet names it.
 *
 * `git check-ignore --stdin -z` over absolute paths inside the project, run with `LC_ALL=C` so Git's messages read the
 * same in every language. No Git, or a folder that isn't in a repository, ignores nothing. A path Git refuses because
 * it lies behind a linked folder ("beyond a symbolic link") is answered **unchecked**, one path at a time, and the
 * gather leaves that file out with a reason; the rest are asked again. Any other failure throws: when Ritemark can't
 * tell what Git ignores in a repository, it doesn't guess that nothing is (fail closed).
 */

import { spawn } from 'node:child_process';

export class GitCheckError extends Error {
  constructor() {
    super("Ritemark couldn't check which files Git ignores in this project.");
    this.name = 'GitCheckError';
  }
}

export interface GitIgnoreAnswer {
  /** Paths Git ignores, as asked. */
  ignored: Set<string>;
  /** Paths Git can't answer for (behind a linked folder): never sent. */
  unchecked: Set<string>;
}

export type GitIgnoredFn = (projectFolder: string, paths: readonly string[]) => Promise<GitIgnoreAnswer>;

type Run = { kind: 'noGit' } | { kind: 'exit'; code: number | null; out: string; err: string };

function runCheckIgnore(projectFolder: string, paths: readonly string[]): Promise<Run> {
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
        // LC_ALL=C: Git's messages in English, so "not a git repository" and "beyond a symbolic link" read the same
        // whatever the computer's language (review of #669)
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C', LANGUAGE: 'C' },
      });
    } catch {
      resolve({ kind: 'noGit' });
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
      if (e.code === 'ENOENT') resolve({ kind: 'noGit' });
      else reject(new GitCheckError());
    }));
    child.on('close', (code) => done(() => resolve({ kind: 'exit', code, out: Buffer.concat(out).toString('utf8'), err })));
    child.stdin?.on('error', () => { /* a Git that exits early closes its input; the exit code decides */ });
    child.stdin?.end(paths.join('\0') + '\0');
  });
}

export const gitIgnored: GitIgnoredFn = async (projectFolder, paths) => {
  const answer: GitIgnoreAnswer = { ignored: new Set(), unchecked: new Set() };
  let asking = [...paths];
  // Each round either answers every path still asked, or takes out the one path Git refused and asks again
  for (let round = 0; asking.length > 0 && round <= paths.length; round++) {
    const run = await runCheckIgnore(projectFolder, asking);
    if (run.kind === 'noGit') return answer;
    if (run.code === 0 || run.code === 1) {
      for (const p of run.out.split('\0').filter(Boolean)) answer.ignored.add(p);
      return answer;
    }
    if (/not a git repository/i.test(run.err)) return answer;
    if (/is beyond a symbolic link/i.test(run.err)) {
      const refused = asking.find((p) => run.err.includes(`'${p}'`));
      if (refused === undefined) throw new GitCheckError();
      answer.unchecked.add(refused);
      asking = asking.filter((p) => p !== refused);
      continue;
    }
    throw new GitCheckError();
  }
  if (asking.length > 0) throw new GitCheckError();
  return answer;
};
