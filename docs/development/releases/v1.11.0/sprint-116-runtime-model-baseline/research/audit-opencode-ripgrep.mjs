import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const researchDir = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.join(researchDir, 'evidence');
const { auditRoot } = JSON.parse(await fs.readFile(path.join(evidenceDir, 'audit-environment.json'), 'utf8'));
const downloads = path.join(auditRoot, 'downloads');
const extracted = path.join(auditRoot, 'ripgrep-15.1.0');

const candidates = [
  {
    target: 'darwin-arm64',
    archive: 'ripgrep-15.1.0-aarch64-apple-darwin.tar.gz',
    format: 'tar.gz',
    sha256: '378e973289176ca0c6054054ee7f631a065874a352bf43f0fa60ef079b6ba715',
    binary: 'ripgrep-15.1.0-aarch64-apple-darwin/rg',
    sourceUrl: 'https://github.com/BurntSushi/ripgrep/releases/download/15.1.0/ripgrep-15.1.0-aarch64-apple-darwin.tar.gz',
  },
  {
    target: 'darwin-x64',
    archive: 'ripgrep-15.1.0-x86_64-apple-darwin.tar.gz',
    format: 'tar.gz',
    sha256: '64811cb24e77cac3057d6c40b63ac9becf9082eedd54ca411b475b755d334882',
    binary: 'ripgrep-15.1.0-x86_64-apple-darwin/rg',
    sourceUrl: 'https://github.com/BurntSushi/ripgrep/releases/download/15.1.0/ripgrep-15.1.0-x86_64-apple-darwin.tar.gz',
  },
  {
    target: 'win32-x64',
    archive: 'ripgrep-15.1.0-x86_64-pc-windows-msvc.zip',
    format: 'zip',
    sha256: '124510b94b6baa3380d051fdf4650eaa80a302c876d611e9dba0b2e18d87493a',
    binary: 'ripgrep-15.1.0-x86_64-pc-windows-msvc/rg.exe',
    sourceUrl: 'https://github.com/BurntSushi/ripgrep/releases/download/15.1.0/ripgrep-15.1.0-x86_64-pc-windows-msvc.zip',
  },
];

async function digest(file) {
  const hash = createHash('sha256');
  hash.update(await fs.readFile(file));
  return hash.digest('hex');
}

const artifacts = [];
for (const candidate of candidates) {
  const archivePath = path.join(downloads, candidate.archive);
  const archiveSha256 = await digest(archivePath);
  const listing = candidate.format === 'zip'
    ? await execFileAsync('unzip', ['-Z1', archivePath])
    : await execFileAsync('tar', ['-tzf', archivePath]);
  const entries = listing.stdout.split(/\r?\n/).filter(Boolean);
  const unsafeEntries = entries.filter(entry => path.isAbsolute(entry) || entry.split('/').includes('..'));
  const binaryPath = path.join(extracted, candidate.target, candidate.binary);
  const fileResult = await execFileAsync('file', [binaryPath]);
  artifacts.push({
    ...candidate,
    archiveSha256,
    archiveVerified: archiveSha256 === candidate.sha256,
    archiveEntrySafety: unsafeEntries.length === 0 ? 'PASS' : 'FAIL',
    unsafeEntries,
    binarySha256: await digest(binaryPath),
    file: fileResult.stdout.trim().replace(`${binaryPath}: `, ''),
  });
}

const toolDir = path.join(auditRoot, 'opencode-managed-tools');
const cleanHome = path.join(auditRoot, 'opencode-managed-rg-home');
const workspace = path.join(auditRoot, 'opencode-rg-workspace');
for (const candidate of [toolDir, cleanHome]) {
  if (!candidate.startsWith(`${auditRoot}${path.sep}`)) throw new Error('Unsafe audit path');
  await fs.rm(candidate, { recursive: true, force: true });
}
await fs.mkdir(toolDir, { recursive: true });
await fs.mkdir(workspace, { recursive: true });
const rgReal = path.join(toolDir, 'rg.real');
const rgWrapper = path.join(toolDir, 'rg');
const usageLog = path.join(toolDir, 'usage.log');
await fs.copyFile(path.join(extracted, 'darwin-arm64', candidates[0].binary), rgReal);
await fs.chmod(rgReal, 0o755);
await fs.writeFile(rgWrapper, `#!/bin/sh\nprintf 'rg\\n' >> '${usageLog}'\nexec '${rgReal}' \"$@\"\n`, { mode: 0o755 });

const opencode = path.join(auditRoot, 'binaries', 'darwin-arm64', 'opencode');
const run = await execFileAsync(opencode, ['--pure', 'debug', 'rg', 'search', 'S116'], {
  cwd: workspace,
  env: {
    HOME: cleanHome,
    XDG_CACHE_HOME: path.join(cleanHome, 'cache'),
    XDG_CONFIG_HOME: path.join(cleanHome, 'config'),
    PATH: `${toolDir}:/usr/bin:/bin:/usr/sbin:/sbin`,
  },
  timeout: 30000,
});
const usage = (await fs.readFile(usageLog, 'utf8')).trim().split(/\r?\n/).filter(Boolean);
const downloadedFallback = await fs.stat(path.join(cleanHome, 'cache', 'opencode', 'bin', 'rg')).then(() => true, () => false);
const result = {
  capturedAt: new Date().toISOString(),
  opencodeVersion: '1.18.30',
  sourcePin: 'packages/core/src/ripgrep/binary.ts VERSION = 15.1.0',
  releaseMetadataSha256: '4bc26d96d46cd73cf940fc440a734c2e43a82f32bedaccd324cb1225a175c2b6',
  status: artifacts.every(item => item.archiveVerified && item.archiveEntrySafety === 'PASS') && usage.includes('rg') && !downloadedFallback ? 'PASS' : 'FAIL',
  artifacts,
  cleanPathProbe: {
    stdout: run.stdout.trim(),
    resourceSelections: usage,
    downloadedFallback,
    path: '<managed-opencode-tool-dir>:/usr/bin:/bin:/usr/sbin:/sbin',
  },
};
await fs.writeFile(path.join(evidenceDir, 'opencode-ripgrep-package.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ status: result.status, targets: artifacts.map(item => item.target), cleanPathProbe: result.cleanPathProbe }));
if (result.status !== 'PASS') process.exitCode = 1;
