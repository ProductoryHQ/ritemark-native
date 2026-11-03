// Tests for scripts/qa/with-test-keys.sh (Sprint 149, W0, E3).
//
// A fake `security` stands in for the Keychain: it answers `find-generic-password -s <service>
// -a <name> -w` from files in a fake vault folder, and exits 44 ("not found") otherwise. No real
// Keychain entry is read. Every run checks that no fake value appears in the script's own output.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'with-test-keys.sh');

// Assembled at run time so no key-shaped literal sits in the repo.
const FAKE = {
  cloudflare: ['fake', 'cf', 'token', 'A1b2C3'].join('-'),
  'cloudflare-account-id': ['acct', '0123456789abcdef'].join('-'),
  elevenlabs: ['fake', 'el', 'Z9y8'].join('-'),
};

function makeWorld(vault) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wtk-'));
  const vaultDir = path.join(root, 'vault');
  fs.mkdirSync(vaultDir);
  for (const [name, value] of Object.entries(vault)) fs.writeFileSync(path.join(vaultDir, name), value);
  const callLog = path.join(root, 'calls.log');
  const security = path.join(root, 'security');
  fs.writeFileSync(
    security,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> ${JSON.stringify(callLog)}
[ "$1" = find-generic-password ] || exit 2
svc=""; acct=""
while [ $# -gt 0 ]; do case "$1" in -s) svc="$2"; shift 2;; -a) acct="$2"; shift 2;; *) shift;; esac; done
[ "$svc" = ritemark-test-keys ] || exit 44
f=${JSON.stringify(vaultDir)}/"$acct"
[ -f "$f" ] || { echo "security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain." >&2; exit 44; }
cat "$f"; echo
`,
  );
  fs.chmodSync(security, 0o755);
  const profile = path.join(root, 'profile');
  fs.mkdirSync(profile);
  return { root, security, profile, callLog };
}

function run(world, args, envOver = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: os.tmpdir(),
    RITEMARK_SECURITY_BIN: world.security,
    RITEMARK_BUILD_CHANNEL: 'test',
    RITEMARK_TEST_PROFILE: world.profile,
    ...envOver,
  };
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
  const r = spawnSync('bash', [SCRIPT, ...args], { env, encoding: 'utf8' });
  const out = `${r.stdout}${r.stderr}`;
  return { status: r.status, out, stdout: r.stdout, stderr: r.stderr };
}

function assertNoValue(text) {
  for (const v of Object.values(FAKE)) assert.ok(!text.includes(v), 'a key value reached the output');
}

// The child proves it got each key by comparing, and prints only yes/no.
const CHECK_CHILD = [
  process.execPath,
  '-e',
  `const want = JSON.parse(process.argv[1]);
   for (const [k, v] of Object.entries(want)) console.log(k + '=' + (process.env[k] === v ? 'yes' : 'no'));`,
];

test('refuses without RITEMARK_BUILD_CHANNEL=test, before reading the vault', () => {
  const w = makeWorld(FAKE);
  const r = run(w, ['--', 'true'], { RITEMARK_BUILD_CHANNEL: 'stable' });
  assert.equal(r.status, 64);
  assert.match(r.out, /RITEMARK_BUILD_CHANNEL=test/);
  assert.ok(!fs.existsSync(w.callLog), 'security was called before the guard');
});

test('refuses without a test profile, or with one outside the temp folders', () => {
  const w = makeWorld(FAKE);
  assert.equal(run(w, ['--', 'true'], { RITEMARK_TEST_PROFILE: undefined }).status, 64);
  assert.equal(run(w, ['--', 'true'], { RITEMARK_TEST_PROFILE: 'relative/profile' }).status, 64);
  const r = run(w, ['--', 'true'], { RITEMARK_TEST_PROFILE: path.join(os.homedir(), 'Library/Application Support/Ritemark') });
  assert.equal(r.status, 64);
  assert.match(r.out, /refused/);
  // the temp root itself is not a profile
  assert.equal(run(w, ['--', 'true'], { RITEMARK_TEST_PROFILE: '/private/tmp' }).status, 64);
  // .. can't climb out of the temp folder
  assert.equal(run(w, ['--', 'true'], { RITEMARK_TEST_PROFILE: path.join(w.profile, '..', '..', '..', '..', '..', 'etc') }).status, 64);
  assert.ok(!fs.existsSync(w.callLog));
});

test("refuses a command whose --user-data-dir isn't the test profile", () => {
  const w = makeWorld(FAKE);
  const r = run(w, ['--', 'true', '--user-data-dir', '/private/tmp/somewhere-else']);
  assert.equal(r.status, 64);
  const ok = run(w, ['--', 'true', `--user-data-dir=${w.profile}`]);
  assert.equal(ok.status, 0, ok.out);
});

test('loads present keys into the command environment and prints names only', () => {
  const w = makeWorld(FAKE);
  const want = {
    CLOUDFLARE_API_TOKEN: FAKE.cloudflare,
    CLOUDFLARE_ACCOUNT_ID: FAKE['cloudflare-account-id'],
    ELEVENLABS_API_KEY: FAKE.elevenlabs,
  };
  const r = run(w, ['--require', 'cloudflare,cloudflare-account-id', '--', ...CHECK_CHILD, JSON.stringify(want)]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /CLOUDFLARE_API_TOKEN=yes/);
  assert.match(r.stdout, /CLOUDFLARE_ACCOUNT_ID=yes/);
  assert.match(r.stdout, /ELEVENLABS_API_KEY=yes/);
  assert.match(r.stderr, /loaded: .*cloudflare→CLOUDFLARE_API_TOKEN/);
  assert.match(r.stderr, /not in the vault \(skipped\): .*openai/);
  // what reached the child's stdout was the yes/no lines, never the values
  assertNoValue(r.out);
});

test('a missing required key stops the run with the vault entry to add, and no value', () => {
  const w = makeWorld({ elevenlabs: FAKE.elevenlabs });
  const marker = path.join(w.root, 'ran');
  const r = run(w, ['--require', 'cloudflare', '--', 'touch', marker]);
  assert.equal(r.status, 65);
  assert.match(r.out, /missing from the vault: 'cloudflare'/);
  assert.match(r.out, /security add-generic-password -U -s ritemark-test-keys -a cloudflare -w/);
  assert.ok(!r.out.includes('SecKeychainSearchCopyNext'), "security's own message was passed on");
  assert.ok(!fs.existsSync(marker), 'the command ran without its key');
  assertNoValue(r.out);
});

test('an empty vault still runs a command that requires nothing', () => {
  const w = makeWorld({});
  const r = run(w, ['--', ...CHECK_CHILD, JSON.stringify({ CLOUDFLARE_API_TOKEN: FAKE.cloudflare })]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /CLOUDFLARE_API_TOKEN=no/);
  assert.match(r.stderr, /not in the vault \(skipped\): cloudflare /);
});

test('an unknown vault name and a missing command are refused', () => {
  const w = makeWorld(FAKE);
  assert.equal(run(w, ['--require', 'stripe', '--', 'true']).status, 64);
  assert.equal(run(w, ['--']).status, 64);
});

test('a value never reaches security’s arguments or the command line', () => {
  const w = makeWorld(FAKE);
  run(w, ['--', 'true']);
  const calls = fs.readFileSync(w.callLog, 'utf8');
  assertNoValue(calls);
  assert.match(calls, /find-generic-password -s ritemark-test-keys -a cloudflare -w/);
  // the script itself holds no key-shaped literal and no echo of a value variable
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.ok(!/echo\s+"?\$value/.test(src) && !/printf[^\n]*\$value/.test(src));
});
