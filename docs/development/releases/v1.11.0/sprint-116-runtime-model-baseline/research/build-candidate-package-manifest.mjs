import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const researchDir = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.join(researchDir, 'evidence');
const original = JSON.parse(await fs.readFile(path.join(evidenceDir, 'candidate-manifest.json'), 'utf8'));
const artifactResults = JSON.parse(await fs.readFile(path.join(evidenceDir, 'artifact-results.json'), 'utf8'));
const codex = JSON.parse(await fs.readFile(path.join(evidenceDir, 'codex-package-layout.json'), 'utf8'));
const openCodeRg = JSON.parse(await fs.readFile(path.join(evidenceDir, 'opencode-ripgrep-package.json'), 'utf8'));

function codexComponent(memberPath) {
  if (memberPath.endsWith('codex-app-server') || memberPath.endsWith('codex-app-server.exe')) return 'app-server';
  if (memberPath.endsWith('codex-code-mode-host') || memberPath.endsWith('codex-code-mode-host.exe')) return 'code-mode-host';
  if (memberPath === 'codex-package.json') return 'package-metadata';
  if (memberPath.endsWith('/rg') || memberPath.endsWith('/rg.exe')) return 'ripgrep';
  if (memberPath.endsWith('/zsh')) return 'zsh';
  if (memberPath.endsWith('codex-command-runner.exe')) return 'command-runner';
  if (memberPath.endsWith('codex-windows-sandbox-setup.exe')) return 'windows-sandbox-setup';
  throw new Error(`Unknown Codex package member: ${memberPath}`);
}

function validationArgs(component) {
  if (component === 'app-server' || component === 'ripgrep' || component === 'zsh') return ['--version'];
  if (component === 'code-mode-host') return ['--help'];
  return [];
}

function componentVersion(component) {
  if (component === 'ripgrep') return '15.2.0';
  if (component === 'zsh') return '5.9.0.3-test';
  return '0.154.0';
}

const codexRows = codex.packages.map(candidate => ({
  agent: 'codex',
  component: 'package',
  vendor: 'openai',
  version: '0.154.0',
  platform: candidate.target.startsWith('darwin') ? 'darwin' : 'win32',
  arch: candidate.target.endsWith('arm64') ? 'arm64' : 'x64',
  sourceType: 'github-release-package',
  sourceUrl: candidate.sourceUrl,
  archiveFilename: candidate.archive,
  archiveFormat: 'tar.gz',
  sha256: candidate.archiveSha256,
  installRoot: 'codex',
  exactArchiveMembers: true,
  packageMetadataPath: 'codex-package.json',
  members: candidate.members.map(member => ({
    component: codexComponent(member.path),
    version: componentVersion(codexComponent(member.path)),
    archivePath: member.path,
    installPath: member.path,
    sha256: member.sha256,
    executable: member.executable,
    validationArgs: validationArgs(codexComponent(member.path)),
    expectedFileArchPattern: member.path === 'codex-package.json' ? '' : member.file,
  })),
  license: {
    spdx: 'Apache-2.0',
    redistribution: 'permitted',
    noticeUrl: 'https://github.com/openai/codex/blob/rust-v0.154.0/LICENSE',
  },
}));

const retainedRows = original.runtimes.filter(row => row.agent !== 'codex').map(row => {
  const key = `${row.agent}/${row.component}/${row.platform}-${row.arch}`;
  const artifact = artifactResults.find(result => result.key === key);
  if (!artifact?.binarySha256) throw new Error(`Missing installed hash for ${key}`);
  return { ...row, installPath: row.installName, installedSha256: artifact.binarySha256 };
});

const rgRows = openCodeRg.artifacts.map(candidate => ({
  agent: 'opencode',
  component: 'ripgrep',
  vendor: 'BurntSushi',
  version: '15.1.0',
  platform: candidate.target.startsWith('darwin') ? 'darwin' : 'win32',
  arch: candidate.target.endsWith('arm64') ? 'arm64' : 'x64',
  sourceType: 'github-release-dependency',
  sourceUrl: candidate.sourceUrl,
  archiveFilename: candidate.archive,
  archiveFormat: candidate.format,
  sha256: candidate.archiveSha256,
  archivePath: candidate.binary,
  installedSha256: candidate.binarySha256,
  installName: candidate.target === 'win32-x64' ? 'rg.exe' : 'rg',
  installPath: candidate.target === 'win32-x64' ? 'opencode-path/rg.exe' : 'opencode-path/rg',
  validationArgs: ['--version'],
  expectedFileArchPattern: candidate.file,
  license: {
    spdx: 'MIT OR Unlicense',
    redistribution: 'permitted',
    noticeUrl: 'https://github.com/BurntSushi/ripgrep/blob/15.1.0/LICENSE-MIT',
  },
}));

const output = {
  schemaVersion: '3',
  approved: true,
  approvedAt: '2026-09-13',
  capturedAt: new Date().toISOString(),
  description: 'Approved Phase 0 package: official Codex trees plus exact standalone Claude/OpenCode runtimes and OpenCode ripgrep dependency.',
  installLayout: 'binaries/agents/<platform>-<arch>/{codex/<official tree>,opencode-path/rg,<standalone runtime>}',
  runtimes: [...codexRows, ...retainedRows, ...rgRows],
};

const expectedTopLevelRows = 12;
const expectedCodexMembers = 16;
const assertions = {
  topLevelRows: output.runtimes.length === expectedTopLevelRows,
  codexPackageTargets: codexRows.length === 3,
  codexMembers: codexRows.reduce((sum, row) => sum + row.members.length, 0) === expectedCodexMembers,
  claudeTargets: retainedRows.filter(row => row.agent === 'claude' && row.component === 'runtime').length === 3,
  openCodeRuntimeTargets: retainedRows.filter(row => row.agent === 'opencode' && row.component === 'runtime').length === 3,
  openCodeRipgrepTargets: rgRows.length === 3,
  uniqueInstallPaths: new Set(output.runtimes.flatMap(row => row.members
    ? row.members.map(member => `${row.platform}-${row.arch}/${row.installRoot}/${member.installPath}`)
    : [`${row.platform}-${row.arch}/${row.installPath}`])).size === expectedCodexMembers + retainedRows.length + rgRows.length,
};
if (!Object.values(assertions).every(Boolean)) throw new Error(`Candidate manifest assertions failed: ${JSON.stringify(assertions)}`);

await fs.writeFile(path.join(evidenceDir, 'candidate-package-manifest.json'), `${JSON.stringify({ ...output, assertions }, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', assertions, topLevelRows: output.runtimes.length, codexMembers: expectedCodexMembers }));
