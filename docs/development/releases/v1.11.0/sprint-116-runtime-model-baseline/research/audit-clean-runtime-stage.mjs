// Prove that each invocable darwin-arm64 candidate starts from the isolated
// staged component set with an empty HOME/cache and an OS-only PATH.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const research = path.dirname(fileURLToPath(import.meta.url));
const evidence = path.join(research, 'evidence');
const { auditRoot } = JSON.parse(await fs.readFile(path.join(evidence, 'audit-environment.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(evidence, 'candidate-manifest.json'), 'utf8'));
const stage = path.join(auditRoot, 'binaries', 'darwin-arm64');
const cleanRoot = path.join(auditRoot, 'clean-runtime-environment');
const home = path.join(cleanRoot, 'home');
const tmp = path.join(cleanRoot, 'tmp');
await fs.rm(cleanRoot, { recursive: true, force: true });
await fs.mkdir(home, { recursive: true });
await fs.mkdir(tmp, { recursive: true });

const expected = manifest.runtimes
  .filter((row) => row.platform === 'darwin' && row.arch === 'arm64')
  .map((row) => row.installName)
  .sort();
const staged = (await fs.readdir(stage))
  .filter((name) => !name.endsWith('.sha256'))
  .sort();

function run(binary, args) {
  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      cwd: tmp,
      env: {
        HOME: home,
        PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
        TMPDIR: tmp,
        XDG_CACHE_HOME: path.join(home, '.cache'),
        XDG_CONFIG_HOME: path.join(home, '.config'),
        XDG_DATA_HOME: path.join(home, '.local/share'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout = (stdout + String(chunk)).slice(-4000); });
    child.stderr.on('data', (chunk) => { stderr = (stderr + String(chunk)).slice(-4000); });
    const timer = setTimeout(() => child.kill('SIGTERM'), 20_000);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        stdout: stdout.trim().slice(0, 1000),
        stderr: stderr.trim().slice(0, 1000),
      });
    });
  });
}

const checks = [];
for (const row of manifest.runtimes.filter((entry) => (
  entry.platform === 'darwin'
  && entry.arch === 'arm64'
  && Array.isArray(entry.validationArgs)
  && entry.validationArgs.length > 0
))) {
  const result = await run(path.join(stage, row.installName), row.validationArgs);
  checks.push({
    component: `${row.agent}/${row.component}`,
    version: row.version,
    installName: row.installName,
    validationArgs: row.validationArgs,
    status: result.code === 0 ? 'PASS' : 'FAIL',
    ...result,
  });
}

const output = {
  capturedAt: new Date().toISOString(),
  stage,
  environment: {
    home: 'new empty directory under audit root',
    path: '/usr/bin:/bin:/usr/sbin:/sbin',
    developerCachesAvailable: false,
  },
  componentSet: {
    expected,
    staged,
    exact: JSON.stringify(expected) === JSON.stringify(staged),
  },
  checks,
  status: checks.every((check) => check.status === 'PASS')
    && JSON.stringify(expected) === JSON.stringify(staged)
    ? 'PASS'
    : 'FAIL',
  limitation: 'Authenticated behavior necessarily uses existing provider sign-in state and is recorded separately; native Intel/Windows behavior remains a CI matrix item.',
};
await fs.writeFile(path.join(evidence, 'clean-runtime-stage.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
if (output.status !== 'PASS') process.exitCode = 1;
