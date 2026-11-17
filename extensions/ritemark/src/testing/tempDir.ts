/**
 * Temp folders for the extension's tests, removed when the test process ends, pass or fail.
 *
 * 17–18 November 2026: tests made folders with mkdtemp and never removed them (rm-board-*, rm-ledger-*,
 * acp-mgr-test-*, …); about 3,100 folders and 17 GB filled the disk twice. Most test files here are plain scripts
 * (a main() whose catch calls process.exit(1)), with no runner hook to clean up in, so each folder made here is
 * removed on the process's 'exit' event, which also runs after process.exit(1). Only test code imports this file.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const made = new Set<string>();
let hooked = false;

// A test stopped by Ctrl-C or a timeout's SIGTERM ends without 'exit': its folders are removed on the signal, and
// the signal is then raised again, so the process still ends the way it would have (unless the test has its own
// handler for it, which then decides). SIGKILL can't be caught.
const SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

function onSignal(signal: NodeJS.Signals): void {
  removeTempDirs();
  for (const s of SIGNALS) process.removeListener(s, onSignal);
  if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
}

/** fs.mkdtempSync(<os.tmpdir()>/<prefix>XXXXXX), removed with everything in it when the process exits. */
export function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.add(dir);
  if (!hooked) {
    hooked = true;
    process.on('exit', removeTempDirs);
    for (const s of SIGNALS) process.on(s, onSignal);
  }
  return dir;
}

/** Removes every folder makeTempDir made so far (the exit hook calls it; a test may call it sooner). */
export function removeTempDirs(): void {
  for (const dir of made) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // A test that took write access away from a folder inside it (a read-only fixture): give it back, then retry
      try {
        restoreWriteAccess(dir);
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Best effort at exit: never turn a passing test into a failing one
      }
    }
    made.delete(dir);
  }
}

function restoreWriteAccess(dir: string): void {
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory()) return;
  fs.chmodSync(dir, stat.mode | 0o700);
  for (const name of fs.readdirSync(dir)) restoreWriteAccess(path.join(dir, name));
}
