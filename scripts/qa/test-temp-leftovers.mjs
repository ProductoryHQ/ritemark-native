#!/usr/bin/env node
// test-temp-leftovers.mjs — runs a test command with a temp folder of its own and fails if the command leaves
// anything in it. On 17–18 Nov 2026 the unit tests' temp folders (rm-board-*, rm-ledger-*, acp-mgr-test-*, …)
// were never removed and filled the disk twice: about 3,100 folders and 17 GB in $TMPDIR.
//
//   node scripts/qa/test-temp-leftovers.mjs [--keep] [-- <command> [args…]]
//   npm run test:temp-leftovers          (in extensions/ritemark: the whole `npm test` chain, pretest included)
//
// The command (default: `npm test`, run in the current folder) gets TMPDIR, TMP and TEMP set to a new folder,
// <temp>/tt-XXXXXX, so os.tmpdir(), mktemp and mkdtemp all land there and nothing another process makes in the
// real $TMPDIR at the same time is counted. (The name is short: tsx puts an IPC socket in the temp folder, and a
// socket path over 104 bytes fails to listen.) Afterwards every entry left in it is listed, apart from
// tool caches that are meant to stay (tsx's tsx-<uid>, Node's node-compile-cache). Exit: the command's own code
// when it failed, else 1 when it left anything, else 0. The folder, all of it made by the command, is removed at
// the end, unless --keep is given (then its path is printed for a look).

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const TOOL_CACHES = [/^tsx-\d+$/, /^node-compile-cache$/];

const args = process.argv.slice(2);
let keep = false;
while (args.length && args[0] !== '--') {
  const a = args.shift();
  if (a === '--keep') keep = true;
  else { console.error(`test-temp-leftovers: unknown option '${a}'`); process.exit(2); }
}
if (args[0] === '--') args.shift();
const command = args.length ? args : ['npm', 'test'];

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tt-')));
console.log(`test-temp-leftovers: running '${command.join(' ')}' with TMPDIR=${tmp}`);
const r = spawnSync(command[0], command.slice(1), {
  stdio: 'inherit',
  env: { ...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp },
  shell: process.platform === 'win32',
});
const code = r.status ?? 1;

const left = fs.readdirSync(tmp).filter((name) => !TOOL_CACHES.some((re) => re.test(name))).sort();
// Group by name less its random suffix (rm-board-AbC123 → rm-board-*) so a leak reads as one line per source
const groups = new Map();
for (const name of left) {
  const key = name.replace(/[-_.][A-Za-z0-9]{4,}$/, '-*');
  groups.set(key, (groups.get(key) ?? 0) + 1);
}
if (left.length) {
  console.log(`test-temp-leftovers: LEFT=${left.length} entries in the test temp folder:`);
  for (const [key, n] of groups) console.log(`  ${key}  ×${n}`);
} else {
  console.log('test-temp-leftovers: LEFT=0');
}
/** Gives write access back to every folder under dir (a test may leave a read-only one), so it can be removed. */
function restoreWriteAccess(dir) {
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory()) return;
  fs.chmodSync(dir, stat.mode | 0o700);
  for (const name of fs.readdirSync(dir)) restoreWriteAccess(path.join(dir, name));
}

let removeFailed = false;
if (keep) console.log(`test-temp-leftovers: kept ${tmp}`);
else {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    try {
      restoreWriteAccess(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch (error) {
      removeFailed = true;
      console.error(`test-temp-leftovers: could not remove ${tmp}: ${error.message}`);
    }
  }
}

if (r.error) console.error(`test-temp-leftovers: could not run the command: ${r.error.message}`);
process.exit(code !== 0 ? code : left.length || removeFailed ? 1 : 0);
