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
const downloadDir = path.join(auditRoot, 'downloads');

const packages = [
  {
    target: 'darwin-arm64',
    archive: 'codex-app-server-package-aarch64-apple-darwin.tar.gz',
    sourceUrl: 'https://github.com/openai/codex/releases/download/rust-v0.154.0/codex-app-server-package-aarch64-apple-darwin.tar.gz',
    sha256: '7bf20c1843bdcff086c89a294299833f20146ebbdba03e7f49f020b7adbfff7b',
    members: ['bin/codex-app-server', 'bin/codex-code-mode-host', 'codex-package.json', 'codex-path/rg', 'codex-resources/zsh/bin/zsh'],
  },
  {
    target: 'darwin-x64',
    archive: 'codex-app-server-package-x86_64-apple-darwin.tar.gz',
    sourceUrl: 'https://github.com/openai/codex/releases/download/rust-v0.154.0/codex-app-server-package-x86_64-apple-darwin.tar.gz',
    sha256: '4fddde3689d2aa0058c06138a84b05f87bdbff8cd556fba5816a97ac0469a4d4',
    members: ['bin/codex-app-server', 'bin/codex-code-mode-host', 'codex-package.json', 'codex-path/rg', 'codex-resources/zsh/bin/zsh'],
  },
  {
    target: 'win32-x64',
    archive: 'codex-app-server-package-x86_64-pc-windows-msvc.tar.gz',
    sourceUrl: 'https://github.com/openai/codex/releases/download/rust-v0.154.0/codex-app-server-package-x86_64-pc-windows-msvc.tar.gz',
    sha256: '5f8b43e030c0aeeb7bdb3d5e03fff4c68ba94fa2df0ae437c490811f54660d74',
    members: ['bin/codex-app-server.exe', 'bin/codex-code-mode-host.exe', 'codex-package.json', 'codex-path/rg.exe', 'codex-resources/codex-command-runner.exe', 'codex-resources/codex-windows-sandbox-setup.exe'],
  },
];

async function sha256(file) {
  const hash = createHash('sha256');
  hash.update(await fs.readFile(file));
  return hash.digest('hex');
}

const results = [];
for (const candidate of packages) {
  const archivePath = path.join(downloadDir, candidate.archive);
  const archiveSha256 = await sha256(archivePath);
  const { stdout } = await execFileAsync('tar', ['-tzf', archivePath]);
  const entries = stdout.split(/\r?\n/).filter(Boolean);
  const unsafeEntries = entries.filter(entry => path.isAbsolute(entry) || entry.split('/').includes('..'));
  const root = path.join(auditRoot, 'full-packages', candidate.target);
  const memberResults = [];
  for (const member of candidate.members) {
    const memberPath = path.join(root, member);
    const stat = await fs.stat(memberPath);
    const fileResult = await execFileAsync('file', [memberPath]);
    memberResults.push({
      path: member,
      sha256: await sha256(memberPath),
      size: stat.size,
      executable: Boolean(stat.mode & 0o111),
      file: fileResult.stdout.trim().replace(`${memberPath}: `, ''),
    });
  }
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'codex-package.json'), 'utf8'));
  const exactMembers = entries.filter(entry => !entry.endsWith('/')).sort();
  const expectedMembers = [...candidate.members].sort();
  results.push({
    target: candidate.target,
    sourceUrl: candidate.sourceUrl,
    archive: candidate.archive,
    archiveSha256,
    expectedArchiveSha256: candidate.sha256,
    archiveVerified: archiveSha256 === candidate.sha256,
    archiveEntrySafety: unsafeEntries.length === 0 ? 'PASS' : 'FAIL',
    unsafeEntries,
    exactMemberSet: JSON.stringify(exactMembers) === JSON.stringify(expectedMembers) ? 'PASS' : 'FAIL',
    metadata,
    members: memberResults,
  });
}

const output = {
  capturedAt: new Date().toISOString(),
  release: 'rust-v0.154.0',
  status: results.every(result => result.archiveVerified && result.archiveEntrySafety === 'PASS' && result.exactMemberSet === 'PASS') ? 'PASS' : 'FAIL',
  productLayoutRecommendation: 'binaries/agents/<target>/codex/<official package tree>',
  packages: results,
};
await fs.writeFile(path.join(evidenceDir, 'codex-package-layout.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ status: output.status, targets: results.map(result => ({ target: result.target, members: result.members.length })) }));
