// Tests for scripts/qa/dev-launch-isolated.sh (security review of #681, findings 3 and 4).
//
//   - `stop` ends only the run's own processes: the profile flag is matched whole (the exact value, then a space or
//     the end of the command line), with regular-expression characters taken literally, so a run whose profile is
//     /…/rm-a.b/profile never stops one on /…/rm-a.b/profile2 or /…/rm-aXb/profile.
//   - `start --user-data-dir` takes only a test profile: under /private/tmp or /tmp, or a $TMPDIR of 3+ segments,
//     never Ritemark's real profile or ~/.ritemark-shared (with-test-keys.sh's own rule, from the shared guard).
//
// No Ritemark is launched: `stop` is pointed at stand-in processes (node, idle) whose command lines carry the flag,
// and `start` runs with --dry-run, which stops before any launch. macOS/Linux only (bash).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dev-launch-isolated.sh');
const skip = process.platform === 'win32' ? 'bash script; macOS only' : false;
const TMP_ROOT = process.platform === 'darwin' ? '/private/tmp' : '/tmp';

const alive = (pid) => {
  try { process.kill(pid, 0); } catch { return false; }
  // A zombie still answers kill 0: ask ps for its state
  const r = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() !== '' && !r.stdout.trim().startsWith('Z');
};

/** An idle stand-in whose command line carries these arguments. */
function standIn(...args) {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', ...args], { detached: true, stdio: 'ignore' });
  child.unref();
  return child.pid;
}

async function waitFor(check, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return check();
}

test('stop ends only the processes on the run’s own profile, matched whole and literally', { skip }, async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(TMP_ROOT, 'dli-stop-')));
  // A dot in the folder: as a regular expression it would also match rm-aXb
  const runDir = path.join(root, 'rm-a.b');
  const profile = path.join(runDir, 'profile');
  fs.mkdirSync(profile, { recursive: true });
  const pids = [];
  try {
    const target = standIn(`--user-data-dir=${profile}`); // the flag last on the line
    const helper = standIn(`--user-data-dir=${profile}`, '--type=renderer'); // the flag, then a space
    const longer = standIn(`--user-data-dir=${profile}2`); // the profile as a prefix of another
    const deeper = standIn(`--user-data-dir=${profile}/nested`); // and of a folder inside it
    const dotted = standIn(`--user-data-dir=${path.join(root, 'rm-aXb', 'profile')}`); // `.` as any character
    const other = standIn(`--other-dir=x--user-data-dir=${profile}`); // the flag inside another argument
    pids.push(target, helper, longer, deeper, dotted, other);
    assert.ok(await waitFor(() => pids.every(alive)), 'stand-ins started');
    // run.env names a PID whose command line only starts like the profile: it must not be taken for the instance
    fs.writeFileSync(path.join(runDir, 'run.env'), `RUN_DIR=${runDir}\nPID=${longer}\nPROFILE=${profile}\n`);

    const r = spawnSync('bash', [SCRIPT, 'stop', runDir], { encoding: 'utf8' });
    assert.match(r.stdout, /LEFT=0/, `${r.stdout}${r.stderr}`);
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.ok(await waitFor(() => !alive(target) && !alive(helper)), 'the run’s own processes are stopped');
    for (const [name, pid] of Object.entries({ longer, deeper, dotted, other })) {
      assert.ok(alive(pid), `another run’s process (${name}) was stopped`);
    }
  } finally {
    for (const pid of pids) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function start(profileArg, envOver = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: os.tmpdir(),
    RITEMARK_LAUNCH_ANY_BUILD: '1',
    ...envOver,
  };
  const r = spawnSync('bash', [SCRIPT, 'start', '--name', 'dli-test', '--dry-run', `--user-data-dir=${profileArg}`], { env, encoding: 'utf8' });
  // A dry run that got through leaves a run folder: remove it
  const runDir = /^RUN_DIR=(.+)$/m.exec(r.stdout)?.[1];
  if (runDir && runDir.includes('rm-dli-test.')) fs.rmSync(runDir, { recursive: true, force: true });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('start --user-data-dir refuses anything but a test profile, and makes no folder for it', { skip }, () => {
  const fakeHome = fs.realpathSync(fs.mkdtempSync(path.join(TMP_ROOT, 'dli-home-')));
  const realProfile = path.join(fakeHome, 'Library', 'Application Support', 'Ritemark');
  const shared = path.join(fakeHome, '.ritemark-shared');
  fs.mkdirSync(realProfile, { recursive: true });
  fs.mkdirSync(shared);
  const homeDir = fs.mkdtempSync(path.join(os.homedir(), '.dli-test-'));
  try {
    const refused = (p, envOver, why) => {
      const r = start(p, envOver);
      assert.equal(r.status, 2, `${why}: ${r.out}`);
      assert.match(r.out, /refused: --user-data-dir/, `${why}: ${r.out}`);
    };
    refused('relative/profile', {}, 'a relative path');
    refused(TMP_ROOT, {}, 'the temp root itself');
    refused(path.join(homeDir, 'profile'), {}, 'a folder in the home folder');
    refused(path.join(homeDir, 'profile'), { TMPDIR: os.homedir() }, 'a short TMPDIR does not widen the roots');
    refused(path.join(homeDir, 'profile'), { TMPDIR: '/' }, 'nor does /');
    refused(path.join(TMP_ROOT, 'x', '..', '..', 'etc', 'profile'), {}, '.. climbs out');
    refused(realProfile, { HOME: fakeHome }, "Ritemark's real profile");
    refused(path.join(realProfile, 'User'), { HOME: fakeHome }, 'a folder inside it');
    refused(path.join(shared, 'profile'), { HOME: fakeHome }, '~/.ritemark-shared');
    assert.ok(!fs.existsSync(path.join(homeDir, 'profile')), 'a refused profile folder was made');
    assert.ok(!fs.existsSync(path.join(shared, 'profile')), 'a refused profile folder was made');

    // A new folder under the temp root passes the guard (a dry run then stops before any launch)
    const ok = path.join(fs.mkdtempSync(path.join(TMP_ROOT, 'dli-ok-')), 'profile');
    try {
      const r = start(ok);
      assert.doesNotMatch(r.out, /refused: --user-data-dir/, r.out);
    } finally {
      fs.rmSync(path.dirname(ok), { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(fakeHome, { recursive: true, force: true });
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

// Second security review of #681 (findings 3 and 5): the profile guard's gaps.
function startWith(args, envOver = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: os.tmpdir(),
    RITEMARK_LAUNCH_ANY_BUILD: '1',
    ...envOver,
  };
  const r = spawnSync('bash', [SCRIPT, 'start', '--name', 'dli-test', '--dry-run', ...args], { env, encoding: 'utf8' });
  const runDir = /^RUN_DIR=(.+)$/m.exec(r.stdout)?.[1];
  if (runDir && runDir.includes('rm-dli-test.')) fs.rmSync(runDir, { recursive: true, force: true });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, stdout: r.stdout };
}

test('start refuses VSCODE_PORTABLE and VSCODE_APPDATA, in its environment and in --env', { skip }, () => {
  // VS Code reads both before --user-data-dir: either would put the profile somewhere the guard never saw
  for (const name of ['VSCODE_PORTABLE', 'VSCODE_APPDATA']) {
    const env = startWith([], { [name]: path.join(TMP_ROOT, 'dli-elsewhere') });
    assert.equal(env.status, 2, `${name} in the environment: ${env.out}`);
    assert.match(env.out, new RegExp(`refused: ${name}`), env.out);
    const empty = startWith([], { [name]: '' });
    assert.equal(empty.status, 2, `${name} set but empty: ${empty.out}`);
    const viaEnv = startWith(['--env', `${name}=${path.join(TMP_ROOT, 'dli-elsewhere')}`]);
    assert.equal(viaEnv.status, 2, `--env ${name}: ${viaEnv.out}`);
    assert.match(viaEnv.out, new RegExp(`--env may not set ${name}`), viaEnv.out);
  }
});

test('start refuses --user-data-dir and --shared-data-dir among the extra arguments after --', { skip }, () => {
  // VS Code takes the last one given, so an extra one would replace the checked profile or the run's shared folder
  const elsewhere = path.join(TMP_ROOT, 'dli-elsewhere');
  const shared = path.join(os.homedir(), '.ritemark-shared');
  for (const extra of [
    [`--user-data-dir=${elsewhere}`],
    ['--user-data-dir', elsewhere],
    [`--shared-data-dir=${shared}`],
    ['--shared-data-dir', shared],
    ['--use-fake-ui-for-media-stream', `--shared-data-dir=${shared}`],
  ]) {
    const r = startWith(['--', ...extra]);
    assert.equal(r.status, 2, `${extra.join(' ')}: ${r.out}`);
    assert.match(r.out, /refused: the extra arguments may not name/, r.out);
  }
  // A harmless extra flag still goes through the guard
  const ok = startWith(['--', '--use-fake-ui-for-media-stream']);
  assert.doesNotMatch(ok.out, /refused/, ok.out);
});

test('start gives each run its own --shared-data-dir, a new empty folder in the run folder, exactly once', { skip }, (t) => {
  // 8 Nov: a shared ~/.ritemark-dev-shared carried Open Recent between runs, so a fresh profile's Projects list
  // filled with the person's real folders (src/projects/firstFill.ts) and the window read their files.
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: os.tmpdir(), RITEMARK_LAUNCH_ANY_BUILD: '1' };
  const r = spawnSync('bash', [SCRIPT, 'start', '--name', 'dli-test', '--dry-run'], { env, encoding: 'utf8' });
  const out = `${r.stdout}${r.stderr}`;
  if (/no dev build/.test(out)) { t.skip('no dev build in this checkout'); return; }
  const runDir = /^RUN_DIR=(.+)$/m.exec(r.stdout)?.[1];
  try {
    assert.equal(r.status, 0, out);
    assert.ok(runDir && runDir.includes('rm-dli-test.'), out);
    const line = r.stdout.split('\n').find((l) => l.startsWith('DRY_RUN ')) ?? '';
    const shared = line.match(/--shared-data-dir=\S+/g) ?? [];
    assert.equal(shared.length, 1, line);
    assert.equal(shared[0], `--shared-data-dir=${runDir}/shared`, line);
    assert.doesNotMatch(line, /\.ritemark-dev-shared|\.ritemark-shared/, line);
    const dir = path.join(runDir, 'shared');
    assert.ok(fs.statSync(dir).isDirectory(), 'the run\'s shared folder exists');
    assert.deepEqual(fs.readdirSync(dir), [], 'and starts empty');
    assert.equal((line.match(/--user-data-dir=/g) ?? []).length, 1, line);
  } finally {
    if (runDir && runDir.includes('rm-dli-test.')) fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('a test profile path with whitespace is refused (stop matches the flag up to a space)', { skip }, () => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(TMP_ROOT, 'dli-ws-')));
  try {
    for (const p of [path.join(base, 'pro file'), `${path.join(base, 'profile')} `, path.join(base, 'pro\tfile'), `${path.join(base, 'profile')}\n`]) {
      const r = startWith([`--user-data-dir=${p}`]);
      assert.equal(r.status, 2, `${JSON.stringify(p)}: ${r.out}`);
      assert.match(r.out, /refused: --user-data-dir must not contain whitespace/, r.out);
      assert.ok(!fs.existsSync(p), 'a refused profile folder was made');
    }
    // The guard itself, sourced as both scripts source it
    const guard = path.join(path.dirname(SCRIPT), 'test-profile-guard.sh');
    const g = spawnSync('bash', ['-c', '. "$1"; test_profile_check "$2"', '_', guard, path.join(base, 'a b')], { encoding: 'utf8' });
    assert.equal(g.status, 1, g.stdout);
    assert.match(g.stdout, /must not contain whitespace/);
    // A folder that only resolves to a path with a space (a link to it) is refused too
    fs.mkdirSync(path.join(base, 'real dir'));
    fs.symlinkSync(path.join(base, 'real dir'), path.join(base, 'link'));
    const l = spawnSync('bash', ['-c', '. "$1"; test_profile_check "$2"', '_', guard, path.join(base, 'link')], { encoding: 'utf8' });
    assert.equal(l.status, 1, l.stdout);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
