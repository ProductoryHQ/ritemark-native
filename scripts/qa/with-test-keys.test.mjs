// Tests for scripts/qa/with-test-keys.sh (Sprint 149, W0, E3).
//
// A fake `security` stands in for the Keychain (RITEMARK_TEST_KEYS_FAKE=1 + RITEMARK_SECURITY_BIN):
// it answers `find-generic-password -s <service> -a <name> -w` from files in a fake vault folder,
// and exits 44 ("not found") otherwise. No real Keychain entry is read. Every run checks that no
// fake value appears in the script's own output.
//
// macOS/Linux only (bash); no CI workflow runs it, and validate-qa.sh is a Mac-side check.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'with-test-keys.sh');
const skip = process.platform === 'win32' ? 'bash script; macOS only' : false;

// Assembled at run time so no key-shaped literal sits in the repo.
const FAKE = {
  cloudflare: ['fake', 'cf', 'token', 'A1b2C3'].join('-'),
  'cloudflare-account-id': ['acct', '0123456789abcdef'].join('-'),
  elevenlabs: ['fake', 'el', 'Z9y8'].join('-'),
};
// The other four provider keys, in the vault only for the test that loads all five
const PROVIDERS = {
  gemini: ['fake', 'gm', 'Q7r6'].join('-'),
  openai: ['fake', 'oa', 'P5o4'].join('-'),
  anthropic: ['fake', 'an', 'N3m2'].join('-'),
  openrouter: ['fake', 'or', 'L1k0'].join('-'),
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
  // The child proves it got each key by comparing, and prints only yes/no (or "unset"). It also
  // touches a marker so a test can tell whether it ran.
  const child = path.join(root, 'child.mjs');
  const marker = path.join(root, 'ran');
  fs.writeFileSync(
    child,
    `import fs from 'node:fs';
fs.writeFileSync(${JSON.stringify(marker)}, '');
const want = JSON.parse(process.argv[2] || '{}');
for (const [k, v] of Object.entries(want)) console.log(k + '=' + (process.env[k] === undefined ? 'unset' : process.env[k] === v ? 'yes' : 'no'));
`,
  );
  return { root, security, profile, callLog, child, marker };
}

// A launch command that carries the profile, as a real launch does.
const launch = (w, want = {}) => [process.execPath, w.child, JSON.stringify(want), `--user-data-dir=${w.profile}`];

function run(world, args, envOver = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: os.tmpdir(),
    RITEMARK_TEST_KEYS_FAKE: '1',
    RITEMARK_SECURITY_BIN: world.security,
    RITEMARK_BUILD_CHANNEL: 'test',
    RITEMARK_TEST_PROFILE: world.profile,
    ...envOver,
  };
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
  const r = spawnSync('bash', [SCRIPT, ...args], { env, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, stdout: r.stdout, stderr: r.stderr };
}

function assertNoValue(text) {
  for (const v of [...Object.values(FAKE), ...Object.values(PROVIDERS)]) assert.ok(!text.includes(v), 'a key value reached the output');
}

test('refuses without RITEMARK_BUILD_CHANNEL=test, before reading the vault', { skip }, () => {
  const w = makeWorld(FAKE);
  const r = run(w, ['--only', 'cloudflare', '--', ...launch(w)], { RITEMARK_BUILD_CHANNEL: 'stable' });
  assert.equal(r.status, 64);
  assert.match(r.out, /RITEMARK_BUILD_CHANNEL=test/);
  assert.ok(!fs.existsSync(w.callLog), 'security was called before the guard');
});

test('refuses without a test profile, or with one outside the temp folders', { skip }, () => {
  const w = makeWorld(FAKE);
  const go = (profile, extra = {}) =>
    run(w, ['--only', 'cloudflare', '--', process.execPath, w.child, '{}', `--user-data-dir=${profile}`], {
      RITEMARK_TEST_PROFILE: profile,
      ...extra,
    }).status;
  assert.equal(run(w, ['--only', 'cloudflare', '--', ...launch(w)], { RITEMARK_TEST_PROFILE: undefined }).status, 64);
  assert.equal(go('relative/profile'), 64);
  assert.equal(go(path.join(os.homedir(), 'Library/Application Support/Ritemark')), 64);
  assert.equal(go('/private/tmp'), 64, 'the temp root itself is not a profile');
  assert.equal(go(path.join(w.profile, '..', '..', '..', '..', '..', 'etc')), 64, '.. climbs out');
  assert.ok(!fs.existsSync(w.callLog));
});

test('a short TMPDIR (/ or $HOME) does not widen the allowed roots', { skip }, () => {
  const w = makeWorld(FAKE);
  const homeProfile = fs.mkdtempSync(path.join(os.homedir(), '.wtk-test-'));
  try {
    for (const tmp of ['/', os.homedir()]) {
      const r = run(w, ['--only', 'cloudflare', '--', process.execPath, w.child, '{}', `--user-data-dir=${homeProfile}`], {
        TMPDIR: tmp,
        RITEMARK_TEST_PROFILE: homeProfile,
      });
      assert.equal(r.status, 64, `TMPDIR=${tmp} let a home-folder profile through`);
    }
  } finally {
    fs.rmSync(homeProfile, { recursive: true, force: true });
  }
  // the fixed temp root (/private/tmp on macOS, /tmp elsewhere) still works whatever TMPDIR says
  const p = fs.mkdtempSync(path.join(process.platform === 'darwin' ? '/private/tmp' : '/tmp', 'wtk-'));
  try {
    const r = run(w, ['--only', 'cloudflare', '--', process.execPath, w.child, '{}', `--user-data-dir=${p}`], {
      TMPDIR: '/',
      RITEMARK_TEST_PROFILE: p,
    });
    assert.equal(r.status, 0, r.out);
  } finally {
    fs.rmSync(p, { recursive: true, force: true });
  }
});

test('the command needs exactly one --user-data-dir, this profile, and no wrapper', { skip }, () => {
  const w = makeWorld(FAKE);
  const st = (cmd) => run(w, ['--only', 'cloudflare', '--', ...cmd]).status;
  assert.equal(st([process.execPath, w.child, '{}']), 64, 'none');
  assert.equal(st([process.execPath, w.child, '{}', '--user-data-dir', '/private/tmp/somewhere-else']), 64, 'another');
  assert.equal(st([...launch(w), `--user-data-dir=${w.profile}`]), 64, 'two');
  assert.equal(st([process.execPath, w.child, '{}', '--user-data-dir=']), 64, 'empty, one-word form');
  assert.equal(st([process.execPath, w.child, '{}', '--user-data-dir', '']), 64, 'empty, two-word form');
  assert.equal(st([process.execPath, w.child, '{}', `--user-data-dir=${w.profile}`, '--user-data-dir']), 64, 'a dangling flag');
  assert.equal(st([process.execPath, w.child, '{}', '--user-data-dir', '', `--user-data-dir=${w.profile}`]), 64, 'empty beside the right one');
  assert.equal(st(['bash', '-c', `node x --user-data-dir=${w.profile}`, `--user-data-dir=${w.profile}`]), 64, 'bash -c');
  assert.equal(st(['/usr/bin/env', ...launch(w)]), 64, 'env');
  assert.ok(!fs.existsSync(w.marker), 'a refused command ran');
  assert.equal(st([process.execPath, w.child, '{}', '--user-data-dir', w.profile]), 0, 'the two-word form');
});

test('loads only the named keys and prints names only', { skip }, () => {
  const w = makeWorld(FAKE);
  const want = {
    CLOUDFLARE_API_TOKEN: FAKE.cloudflare,
    CLOUDFLARE_ACCOUNT_ID: FAKE['cloudflare-account-id'],
    RITEMARK_TEST_KEY_ELEVENLABS: FAKE.elevenlabs,
  };
  const r = run(w, ['--require', 'cloudflare,cloudflare-account-id', '--only', 'openai', '--', ...launch(w, want)]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /CLOUDFLARE_API_TOKEN=yes/);
  assert.match(r.stdout, /CLOUDFLARE_ACCOUNT_ID=yes/);
  assert.match(r.stdout, /RITEMARK_TEST_KEY_ELEVENLABS=unset/, 'a key nobody named was loaded');
  assert.match(r.stderr, /loaded: .*cloudflare→CLOUDFLARE_API_TOKEN/);
  assert.match(r.stderr, /not in the vault \(skipped\): openai/);
  const calls = fs.readFileSync(w.callLog, 'utf8');
  assert.ok(!/-a elevenlabs/.test(calls) && !/-a gemini/.test(calls), 'the vault was read beyond the named keys');
  assertNoValue(r.out);
});

// Security review of #681 (finding 1): a provider key under its standard name (OPENAI_API_KEY…) is picked up by
// every tool in the launched tree by itself — Claude Code, Codex, git hooks, MCP servers, a terminal's `env` — so the
// five provider keys travel under Ritemark-only names, which only Ritemark's extension host reads (and removes).
test('the provider keys travel under Ritemark-only names, never the standard ones', { skip }, () => {
  const w = makeWorld({ ...FAKE, ...PROVIDERS });
  const want = {
    RITEMARK_TEST_KEY_GOOGLE: PROVIDERS.gemini,
    RITEMARK_TEST_KEY_OPENAI: PROVIDERS.openai,
    RITEMARK_TEST_KEY_ANTHROPIC: PROVIDERS.anthropic,
    RITEMARK_TEST_KEY_OPENROUTER: PROVIDERS.openrouter,
    RITEMARK_TEST_KEY_ELEVENLABS: FAKE.elevenlabs,
    GOOGLE_GENERATIVE_AI_API_KEY: '',
    GEMINI_API_KEY: '',
    OPENAI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    OPENROUTER_API_KEY: '',
    ELEVENLABS_API_KEY: '',
  };
  const r = run(w, ['--only', 'gemini,openai,anthropic,openrouter,elevenlabs', '--', ...launch(w, want)]);
  assert.equal(r.status, 0, r.out);
  for (const name of ['GOOGLE', 'OPENAI', 'ANTHROPIC', 'OPENROUTER', 'ELEVENLABS']) {
    assert.match(r.stdout, new RegExp(`RITEMARK_TEST_KEY_${name}=yes`), `RITEMARK_TEST_KEY_${name} loaded`);
  }
  for (const name of ['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'ELEVENLABS_API_KEY']) {
    assert.match(r.stdout, new RegExp(`${name}=unset`), `${name} must not be set`);
  }
  assert.match(r.stderr, /loaded: .*gemini→RITEMARK_TEST_KEY_GOOGLE/);
  assertNoValue(r.out);
  // Cloudflare's two keep their names: only scripts/qa/cloudflare-contract.mjs reads them, never Ritemark
  const cf = run(w, ['--require', 'cloudflare,cloudflare-account-id', '--', ...launch(w, { CLOUDFLARE_API_TOKEN: FAKE.cloudflare })]);
  assert.match(cf.stdout, /CLOUDFLARE_API_TOKEN=yes/);
  // The script says what still inherits the names and that nobody echoes them
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(src, /terminal/i, 'the script documents that terminals inherit the names');
  assert.match(src, /never echo|must not echo/i, 'and that agents must not echo them');
});

test('naming no keys is refused', { skip }, () => {
  const w = makeWorld(FAKE);
  assert.equal(run(w, ['--', ...launch(w)]).status, 64);
});

test('SHELLOPTS=xtrace does not trace a value', { skip }, () => {
  const w = makeWorld(FAKE);
  const r = run(w, ['--require', 'cloudflare,cloudflare-account-id', '--only', 'elevenlabs', '--', ...launch(w)], {
    SHELLOPTS: 'xtrace',
  });
  assert.equal(r.status, 0, r.out);
  assertNoValue(r.out);
});

test('a missing required key stops the run with the vault entry to add, and no value', { skip }, () => {
  const w = makeWorld({ elevenlabs: FAKE.elevenlabs });
  const r = run(w, ['--require', 'cloudflare', '--only', 'elevenlabs', '--', ...launch(w)]);
  assert.equal(r.status, 65);
  assert.match(r.out, /missing from the vault: 'cloudflare'/);
  assert.match(r.out, /security add-generic-password -U -s ritemark-test-keys -a cloudflare -w/);
  assert.ok(!r.out.includes('SecKeychainSearchCopyNext'), "security's own message was passed on");
  assert.ok(!fs.existsSync(w.marker), 'the command ran without its key');
  assertNoValue(r.out);
});

// Read from the source, not run: running without the flag would call the real Keychain.
test('RITEMARK_SECURITY_BIN is honoured only with RITEMARK_TEST_KEYS_FAKE=1', { skip }, () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const uses = src.split('\n').filter((l) => l.includes('RITEMARK_SECURITY_BIN') && !l.trim().startsWith('#'));
  assert.equal(uses.length, 2, 'RITEMARK_SECURITY_BIN is read somewhere else');
  assert.match(uses[0], /^if \[ "\$\{RITEMARK_TEST_KEYS_FAKE:-\}" = "1" \] && \[ -n "\$\{RITEMARK_SECURITY_BIN:-\}" \]; then$/);
  assert.match(uses[1], /^\s+SECURITY_BIN="\$RITEMARK_SECURITY_BIN"$/);
  assert.match(src, /^SECURITY_BIN="\/usr\/bin\/security"$/m);
});

test('an unknown vault name and a missing command are refused', { skip }, () => {
  const w = makeWorld(FAKE);
  assert.equal(run(w, ['--require', 'stripe', '--', ...launch(w)]).status, 64);
  assert.equal(run(w, ['--only', 'cloudflare', '--']).status, 64);
});

test('a value never reaches security’s arguments, and tracing is off first', { skip }, () => {
  const w = makeWorld(FAKE);
  run(w, ['--only', 'cloudflare', '--', ...launch(w)]);
  const calls = fs.readFileSync(w.callLog, 'utf8');
  assertNoValue(calls);
  assert.match(calls, /find-generic-password -s ritemark-test-keys -a cloudflare -w/);
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.equal(src.split('\n')[1], 'set +o xtrace; unset BASH_XTRACEFD BASH_ENV');
  assert.ok(!/echo\s+"?\$value/.test(src) && !/printf[^\n]*\$value/.test(src));
});

// Second security review of #681 (findings 3 and 5): the profile guard's gaps.
test('refuses VSCODE_PORTABLE and VSCODE_APPDATA, before reading the vault', { skip }, () => {
  // VS Code reads both before --user-data-dir: either would put the profile somewhere the guard never saw
  for (const name of ['VSCODE_PORTABLE', 'VSCODE_APPDATA']) {
    for (const value of [path.join(os.tmpdir(), 'wtk-elsewhere'), '']) {
      const w = makeWorld(FAKE);
      const r = run(w, ['--only', 'cloudflare', '--', ...launch(w)], { [name]: value });
      assert.equal(r.status, 64, `${name}=${JSON.stringify(value)}: ${r.out}`);
      assert.match(r.out, new RegExp(`refused: ${name}`), r.out);
      assert.ok(!fs.existsSync(w.callLog), 'security was called before the guard');
      assert.ok(!fs.existsSync(w.marker), 'the command ran');
    }
  }
});

test('refuses a --shared-data-dir that is, or sits under, ~/.ritemark-shared', { skip }, () => {
  const fakeHome = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wtk-home-')));
  try {
    const shared = path.join(fakeHome, '.ritemark-shared');
    const st = (extra) => {
      const w = makeWorld(FAKE);
      const r = run(w, ['--only', 'cloudflare', '--', ...launch(w), ...extra], { HOME: fakeHome });
      return { ...r, ran: fs.existsSync(w.marker), read: fs.existsSync(w.callLog) };
    };
    const refused = (extra, why) => {
      const r = st(extra);
      assert.equal(r.status, 64, `${why}: ${r.out}`);
      assert.match(r.out, /refused: the command's --shared-data-dir/, `${why}: ${r.out}`);
      assert.ok(!r.ran && !r.read, `${why}: the command ran or the vault was read`);
    };
    // Not made yet: still refused
    refused([`--shared-data-dir=${shared}`], 'the folder itself, before it exists');
    fs.mkdirSync(shared);
    refused([`--shared-data-dir=${shared}`], 'the folder itself');
    refused([`--shared-data-dir=${shared}/`], 'with a trailing slash');
    refused(['--shared-data-dir', shared], 'the two-word form');
    refused([`--shared-data-dir=${path.join(shared, 'sub')}`], 'a folder under it');
    refused([`--shared-data-dir=${fakeHome}/x/../.ritemark-shared`], '.. into it');
    refused([`--shared-data-dir=${fakeHome}/.ritemark-dev-shared`, `--shared-data-dir=${shared}`], 'the last one wins in VS Code');
    refused(['--shared-data-dir'], 'a dangling flag');
    refused(['--shared-data-dir='], 'an empty value');
    const link = path.join(fakeHome, 'link-to-shared');
    fs.symlinkSync(shared, link);
    refused([`--shared-data-dir=${link}`], 'a link to it');
    if (process.platform === 'darwin') refused([`--shared-data-dir=${path.join(fakeHome, '.Ritemark-Shared')}`], 'another case (a case-insensitive disk)');
    // The dev builds' own folder, and no --shared-data-dir at all (the Cloudflare contract script is no app launch)
    const dev = st([`--shared-data-dir=${path.join(fakeHome, '.ritemark-dev-shared')}`]);
    assert.equal(dev.status, 0, dev.out);
    const none = st([]);
    assert.equal(none.status, 0, none.out);
  } finally {
    fs.rmSync(fakeHome, { recursive: true, force: true });
  }
});

test('a test profile path with whitespace is refused', { skip }, () => {
  const w = makeWorld(FAKE);
  for (const name of ['pro file', 'profile ', 'pro\tfile']) {
    const p = path.join(w.root, name);
    fs.mkdirSync(p);
    const r = run(w, ['--only', 'cloudflare', '--', process.execPath, w.child, '{}', `--user-data-dir=${p}`], { RITEMARK_TEST_PROFILE: p });
    assert.equal(r.status, 64, `${JSON.stringify(name)}: ${r.out}`);
    assert.match(r.out, /must not contain whitespace/, r.out);
  }
  assert.ok(!fs.existsSync(w.callLog), 'security was called before the guard');
});
