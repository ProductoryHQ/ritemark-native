#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validateFiles } from './validate-agent-runtime-manifest.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const agentRoot = path.join(repoRoot, 'extensions/ritemark/binaries/agents');
const manifest = JSON.parse(fs.readFileSync(path.join(agentRoot, 'manifest.json'), 'utf8'));
const cacheRoot = path.join(os.tmpdir(), 'ritemark-agent-runtime-cache');
const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-agent-runtimes-'));

const fail = message => { throw new Error(message); };
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const targetOf = row => `${row.platform}-${row.arch}`;
const hostPlatform = process.platform;
const hostArch = process.arch;
const nativeRow = row => row.platform === hostPlatform && row.arch === hostArch;

function usage() {
  console.log(`fetch-agent-runtimes.sh — manifest-driven runtime package fetcher

Usage: ./scripts/fetch-agent-runtimes.sh [options]
  --platform <darwin|win32>   Target platform (default: host)
  --arch <arm64|x64>          Target architecture (default: host)
  --agent <codex|claude|opencode>
  --verify-only               Verify installed bytes without downloading
  --all-platforms             Fetch or verify every manifest target
  --help`);
}

function parseArgs(argv) {
  const options = { platform: hostPlatform, arch: hostArch, agent: null, verifyOnly: false, allPlatforms: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return { ...options, help: true };
    if (arg === '--verify-only') { options.verifyOnly = true; continue; }
    if (arg === '--all-platforms') { options.allPlatforms = true; continue; }
    if (arg === '--platform' || arg === '--arch' || arg === '--agent') {
      const value = argv[++index];
      if (!value) fail(`${arg} requires a value`);
      options[arg.slice(2)] = value;
      continue;
    }
    fail(`unknown option: ${arg}`);
  }
  if (!['darwin', 'win32'].includes(options.platform)) fail(`unsupported platform: ${options.platform}`);
  if (!['arm64', 'x64'].includes(options.arch)) fail(`unsupported architecture: ${options.arch}`);
  if (options.agent && !['codex', 'claude', 'opencode'].includes(options.agent)) fail(`unsupported agent: ${options.agent}`);
  return options;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: options.capture ? 'pipe' : 'inherit' });
  if (result.error) fail(`${command} failed: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited ${result.status}${result.stderr ? `: ${result.stderr.trim()}` : ''}`);
  return result.stdout?.trim() ?? '';
}

function download(row) {
  fs.mkdirSync(cacheRoot, { recursive: true });
  const cached = path.join(cacheRoot, `${row.sha256}-${row.archiveFilename}`);
  if (fs.existsSync(cached) && sha256(cached) === row.sha256) return cached;
  fs.rmSync(cached, { force: true });
  const partial = `${cached}.${process.pid}.partial`;
  run('curl', ['--fail', '--location', '--retry', '3', '--output', partial, row.sourceUrl]);
  const actual = sha256(partial);
  if (actual !== row.sha256) {
    fs.rmSync(partial, { force: true });
    fail(`${row.agent}/${row.component}/${targetOf(row)} archive SHA-256 mismatch: ${actual}`);
  }
  fs.renameSync(partial, cached);
  return cached;
}

function extract(row, archive) {
  const destination = fs.mkdtempSync(path.join(runRoot, `${row.agent}-${row.component}-`));
  const python = process.platform === 'win32' ? 'python' : 'python3';
  run(python, [path.join(scriptDir, 'extract-runtime-artifact.py'), row.archiveFormat, archive, destination]);
  return destination;
}

function listFiles(root) {
  const files = [];
  const walk = (directory, prefix = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) fail(`archive contains a symlink: ${relative}`);
      if (entry.isDirectory()) walk(path.join(directory, entry.name), relative);
      else if (entry.isFile()) files.push(relative);
      else fail(`archive contains unsupported member: ${relative}`);
    }
  };
  walk(root);
  return files.sort();
}

/**
 * Significant tokens of an expected `file(1)` description.
 *
 * The manifest states patterns as whole sentences ("PE32+ executable (console)
 * x86-64, for MS Windows"), but libmagic reorders and extends its output across
 * versions and hosts — a Windows runner now answers "PE32+ executable for MS
 * Windows 6.00 (console), x86-64, 8 sections". An exact substring match turns
 * every such drift into a release-blocking build failure, which is what
 * happened to v1.6.3 (5 commits) and again to v1.11.0.
 *
 * Only the tokens that actually identify the format and the architecture are
 * required, in any order. The rest of the sentence is commentary.
 */
export function architectureTokens(pattern) {
  return pattern
    .split(/[\s,()]+/)
    .filter(Boolean)
    .filter((token) => /^(PE32\+?|Mach-O|x86[-_]64|arm64|i386|64-bit)$/i.test(token));
}

/** First two bytes, as a hint of last resort when `file` is unavailable. */
function magicBytes(file) {
  const handle = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(4);
    fs.readSync(handle, buffer, 0, 4, 0);
    return buffer;
  } finally {
    fs.closeSync(handle);
  }
}

function checkArchitecture(file, pattern) {
  if (!pattern) return;

  let output = '';
  try {
    output = run('file', ['-b', file], { capture: true });
  } catch {
    output = '';
  }

  const tokens = architectureTokens(pattern);
  if (output && tokens.length) {
    const missing = tokens.filter((token) => !new RegExp(token.replace('+', '\\+'), 'i').test(output));
    if (!missing.length) return;
    fail(`${file} architecture mismatch: expected ${JSON.stringify(tokens)}, missing ${JSON.stringify(missing)}, found "${output}"`);
  }

  // `file` gave nothing usable. Magic bytes are the truth the pattern only
  // describes: MZ for a PE, the Mach-O 64-bit magics otherwise.
  const magic = magicBytes(file);
  const wantsPE = /^PE32/i.test(pattern);
  const looksPE = magic[0] === 0x4d && magic[1] === 0x5a; // "MZ"
  const machMagics = [0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca];
  const looksMachO = machMagics.includes(magic.readUInt32BE(0)) || machMagics.includes(magic.readUInt32LE(0));
  if (wantsPE ? looksPE : looksMachO) return;

  fail(`${file} architecture mismatch: expected "${pattern}", file(1) unavailable and magic bytes ${magic.toString('hex')} do not match`);
}

function smoke(file, args, row) {
  if (!nativeRow(row) || !args?.length) return;
  run(file, args, { capture: true });
}

function writeSidecar(file, digest) {
  fs.writeFileSync(`${file}.sha256`, `${digest}  ${path.basename(file)}\n`);
}

function verifyInstalledFile(file, expected, label, architecture) {
  if (!fs.existsSync(file)) fail(`${label} is missing: ${file}`);
  const actual = sha256(file);
  if (actual !== expected) fail(`${label} installed SHA-256 mismatch: ${actual}`);
  const sidecar = `${file}.sha256`;
  if (!fs.existsSync(sidecar) || !fs.readFileSync(sidecar, 'utf8').startsWith(expected)) fail(`${label} SHA-256 sidecar is missing or stale`);
  checkArchitecture(file, architecture);
}

function promoteFile(source, destination, executable) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const staged = `${destination}.${process.pid}.new`;
  const backup = `${destination}.${process.pid}.old`;
  fs.copyFileSync(source, staged);
  if (executable && process.platform !== 'win32') fs.chmodSync(staged, 0o755);
  fs.rmSync(backup, { force: true });
  if (fs.existsSync(destination)) fs.renameSync(destination, backup);
  try {
    fs.renameSync(staged, destination);
    fs.rmSync(backup, { force: true });
  } catch (error) {
    if (fs.existsSync(backup) && !fs.existsSync(destination)) fs.renameSync(backup, destination);
    throw error;
  }
}

function installCodex(row, extracted) {
  const actualFiles = listFiles(extracted);
  const expectedFiles = row.members.map(member => member.archivePath).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) fail(`codex/package/${targetOf(row)} archive members differ from the approved package layout`);
  for (const member of row.members) {
    const source = path.join(extracted, ...member.archivePath.split('/'));
    if (sha256(source) !== member.sha256) fail(`codex/${member.component}/${targetOf(row)} installed SHA-256 mismatch`);
    checkArchitecture(source, member.expectedFileArchPattern);
    smoke(source, member.validationArgs, row);
  }

  const targetRoot = path.join(agentRoot, targetOf(row));
  const destination = path.join(targetRoot, row.installRoot);
  const staged = path.join(targetRoot, `.codex-${process.pid}.new`);
  const backup = path.join(targetRoot, `.codex-${process.pid}.old`);
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.rmSync(staged, { recursive: true, force: true });
  fs.cpSync(extracted, staged, { recursive: true, preserveTimestamps: true });
  for (const member of row.members) {
    const installed = path.join(staged, ...member.installPath.split('/'));
    if (member.executable && process.platform !== 'win32') fs.chmodSync(installed, 0o755);
    writeSidecar(installed, member.sha256);
  }
  fs.rmSync(backup, { recursive: true, force: true });
  if (fs.existsSync(destination)) fs.renameSync(destination, backup);
  try {
    fs.renameSync(staged, destination);
    for (const legacy of [
      'codex-app-server', 'codex-app-server.exe',
      'codex-code-mode-host', 'codex-code-mode-host.exe',
      'codex-command-runner.exe', 'codex-windows-sandbox-setup.exe',
    ]) {
      fs.rmSync(path.join(targetRoot, legacy), { force: true });
      fs.rmSync(path.join(targetRoot, `${legacy}.sha256`), { force: true });
    }
    fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (fs.existsSync(backup) && !fs.existsSync(destination)) fs.renameSync(backup, destination);
    throw error;
  }
}

function installStandalone(row, extracted) {
  const source = path.join(extracted, ...row.archivePath.split('/'));
  if (!fs.existsSync(source)) fail(`${row.agent}/${row.component}/${targetOf(row)} archive path is missing: ${row.archivePath}`);
  if (sha256(source) !== row.installedSha256) fail(`${row.agent}/${row.component}/${targetOf(row)} installed SHA-256 mismatch`);
  checkArchitecture(source, row.expectedFileArchPattern);
  smoke(source, row.validationArgs, row);
  const destination = path.join(agentRoot, targetOf(row), ...row.installPath.split('/'));
  promoteFile(source, destination, true);
  writeSidecar(destination, row.installedSha256);
}

function verifyRow(row) {
  if (row.agent === 'codex') {
    const packageRoot = path.join(agentRoot, targetOf(row), row.installRoot);
    const expectedInstalled = row.members.flatMap(member => [member.installPath, `${member.installPath}.sha256`]).sort();
    const actualInstalled = listFiles(packageRoot);
    if (JSON.stringify(actualInstalled) !== JSON.stringify(expectedInstalled)) fail(`codex/package/${targetOf(row)} installed tree differs from the approved package layout`);
    for (const member of row.members) {
      const file = path.join(packageRoot, ...member.installPath.split('/'));
      verifyInstalledFile(file, member.sha256, `codex/${member.component}/${targetOf(row)}`, member.expectedFileArchPattern);
      smoke(file, member.validationArgs, row);
    }
    return;
  }
  const file = path.join(agentRoot, targetOf(row), ...row.installPath.split('/'));
  verifyInstalledFile(file, row.installedSha256, `${row.agent}/${row.component}/${targetOf(row)}`, row.expectedFileArchPattern);
  smoke(file, row.validationArgs, row);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { usage(); return; }
  const validationErrors = validateFiles(repoRoot);
  if (validationErrors.length) fail(`runtime manifest validation failed:\n  - ${validationErrors.join('\n  - ')}`);
  const selected = manifest.runtimes.filter(row => ((!options.agent || row.agent === options.agent) && (options.allPlatforms || (row.platform === options.platform && row.arch === options.arch))));
  if (!selected.length) fail('no manifest rows match the requested target');
  for (const row of selected) {
    const label = `${row.agent}/${row.component}/${targetOf(row)}`;
    if (options.verifyOnly) {
      verifyRow(row);
      console.log(`PASS ${label}`);
      continue;
    }
    const archive = download(row);
    const extracted = extract(row, archive);
    if (row.agent === 'codex') installCodex(row, extracted);
    else installStandalone(row, extracted);
    verifyRow(row);
    console.log(`PASS ${label}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(runRoot, { recursive: true, force: true });
}
