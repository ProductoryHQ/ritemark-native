#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(SCRIPT_DIR);
const TARGETS = ['darwin-arm64', 'darwin-x64', 'win32-x64'];

const APPROVED_COMPONENTS = {
  'codex/package': { vendor: 'openai', version: '0.154.0', targets: TARGETS, license: 'Apache-2.0', notice: '/openai/codex/' },
  'claude/runtime': { vendor: 'anthropic', version: '2.1.281', targets: TARGETS, license: 'LicenseRef-Anthropic-Proprietary', notice: 'code.claude.com/' },
  'opencode/runtime': { vendor: 'anomalyco', version: '1.18.30', targets: TARGETS, license: 'MIT', notice: '/anomalyco/opencode/' },
  'opencode/ripgrep': { vendor: 'BurntSushi', version: '15.1.0', targets: TARGETS, license: 'MIT OR Unlicense', notice: '/BurntSushi/ripgrep/' },
};

const CODEX_MEMBERS = {
  'darwin-arm64': {
    'app-server': ['bin/codex-app-server', '0.154.0', '--version'],
    'code-mode-host': ['bin/codex-code-mode-host', '0.154.0', '--help'],
    'package-metadata': ['codex-package.json', '0.154.0', null],
    ripgrep: ['codex-path/rg', '15.2.0', '--version'],
    zsh: ['codex-resources/zsh/bin/zsh', '5.9.0.3-test', '--version'],
  },
  'darwin-x64': {
    'app-server': ['bin/codex-app-server', '0.154.0', '--version'],
    'code-mode-host': ['bin/codex-code-mode-host', '0.154.0', '--help'],
    'package-metadata': ['codex-package.json', '0.154.0', null],
    ripgrep: ['codex-path/rg', '15.2.0', '--version'],
    zsh: ['codex-resources/zsh/bin/zsh', '5.9.0.3-test', '--version'],
  },
  'win32-x64': {
    'app-server': ['bin/codex-app-server.exe', '0.154.0', '--version'],
    'code-mode-host': ['bin/codex-code-mode-host.exe', '0.154.0', '--help'],
    'package-metadata': ['codex-package.json', '0.154.0', null],
    ripgrep: ['codex-path/rg.exe', '15.2.0', '--version'],
    'command-runner': ['codex-resources/codex-command-runner.exe', '0.154.0', null],
    'windows-sandbox-setup': ['codex-resources/codex-windows-sandbox-setup.exe', '0.154.0', null],
  },
};

const APPROVED_SDKS = { claude: '0.3.281', acp: '1.4.0' };
const CLAUDE_OPTIONAL_PACKAGES = [
  '@anthropic-ai/claude-agent-sdk-darwin-arm64',
  '@anthropic-ai/claude-agent-sdk-darwin-x64',
  '@anthropic-ai/claude-agent-sdk-linux-arm64',
  '@anthropic-ai/claude-agent-sdk-linux-arm64-musl',
  '@anthropic-ai/claude-agent-sdk-linux-x64',
  '@anthropic-ai/claude-agent-sdk-linux-x64-musl',
  '@anthropic-ai/claude-agent-sdk-win32-arm64',
  '@anthropic-ai/claude-agent-sdk-win32-x64',
];

const isExactVersion = value => /^\d+\.\d+\.\d+$/.test(value ?? '');
const validSha = value => /^[a-f0-9]{64}$/.test(value ?? '');
const targetOf = row => `${row.platform}-${row.arch}`;
const safeRelativePath = value => typeof value === 'string'
  && value.length > 0
  && !path.posix.isAbsolute(value)
  && !/^[A-Za-z]:/.test(value)
  && !value.includes('\\')
  && value !== '.'
  && value.split('/').every(segment => segment && segment !== '.' && segment !== '..')
  && path.posix.normalize(value) === value;
const architectureToken = target => target === 'darwin-arm64' ? 'arm64' : target === 'darwin-x64' ? 'x86_64' : 'x86-64';

export function validateAgentRuntimeManifest(manifest, packageJson, packageLock) {
  const errors = [];
  const rows = Array.isArray(manifest?.runtimes) ? manifest.runtimes : [];
  if (manifest?.schemaVersion !== '3') errors.push(`manifest schemaVersion must be 3; found ${manifest?.schemaVersion ?? '<missing>'}`);
  if (rows.length !== 12) errors.push(`manifest must contain 12 source rows; found ${rows.length}`);

  const keys = new Set();
  const installPaths = new Set();
  for (const row of rows) {
    const target = targetOf(row);
    const key = `${row.agent}/${row.component}`;
    const rowKey = `${key}/${target}`;
    if (keys.has(rowKey)) errors.push(`${rowKey} is duplicated`);
    keys.add(rowKey);

    const approved = APPROVED_COMPONENTS[key];
    if (!approved) errors.push(`${rowKey} is not an approved source component`);
    else {
      if (row.vendor !== approved.vendor) errors.push(`${rowKey} vendor must be ${approved.vendor}; found ${row.vendor}`);
      if (row.version !== approved.version) errors.push(`${rowKey} version must be approved snapshot ${approved.version}; found ${row.version}`);
      if (row.license?.spdx !== approved.license) errors.push(`${rowKey} license must be ${approved.license}; found ${row.license?.spdx ?? '<missing>'}`);
      if (row.license?.redistribution !== (key === 'claude/runtime' ? 'permitted-by-vendor-confirmation' : 'permitted')) errors.push(`${rowKey} redistribution evidence is missing or invalid`);
      if (!row.license?.noticeUrl?.includes(approved.notice)) errors.push(`${rowKey} license notice URL must identify ${approved.notice}`);
    }
    if (!isExactVersion(row.version)) errors.push(`${rowKey} version is not exact: ${row.version}`);
    if (!validSha(row.sha256)) errors.push(`${rowKey} has an invalid archive SHA-256`);
    if (!row.sourceUrl?.includes(row.version)) errors.push(`${rowKey} sourceUrl does not contain ${row.version}`);
    if (!safeRelativePath(row.archiveFilename)) errors.push(`${rowKey} archiveFilename is unsafe`);
    const expectedFormat = row.agent === 'opencode' && row.component === 'ripgrep' && row.platform === 'win32' ? 'zip' : 'tar.gz';
    if (row.archiveFormat !== expectedFormat) errors.push(`${rowKey} archiveFormat must be ${expectedFormat}`);

    if (row.agent === 'codex') {
      if (row.installRoot !== 'codex') errors.push(`${rowKey} installRoot must be codex`);
      if (row.packageMetadataPath !== 'codex-package.json') errors.push(`${rowKey} must identify codex-package.json`);
      if (row.exactArchiveMembers !== true) errors.push(`${rowKey} must require the exact official package member set`);
      const expected = CODEX_MEMBERS[target] ?? {};
      const members = Array.isArray(row.members) ? row.members : [];
      if (members.length !== Object.keys(expected).length) errors.push(`${rowKey} member count must be ${Object.keys(expected).length}; found ${members.length}`);
      const seen = new Set();
      for (const member of members) {
        const memberKey = `${rowKey}/${member.component}`;
        if (seen.has(member.component)) errors.push(`${memberKey} is duplicated`);
        seen.add(member.component);
        const contract = expected[member.component];
        if (!contract) { errors.push(`${memberKey} is not expected`); continue; }
        const [expectedPath, expectedVersion, validationArg] = contract;
        if (member.archivePath !== expectedPath || member.installPath !== expectedPath) errors.push(`${memberKey} must preserve ${expectedPath}`);
        if (member.version !== expectedVersion) errors.push(`${memberKey} version must be ${expectedVersion}; found ${member.version}`);
        const expectedExecutable = member.component !== 'package-metadata';
        if (member.executable !== expectedExecutable) errors.push(`${memberKey} executable must be ${expectedExecutable}`);
        if (expectedExecutable && !member.expectedFileArchPattern?.includes(architectureToken(target))) errors.push(`${memberKey} must declare the ${architectureToken(target)} architecture`);
        if (!validSha(member.sha256)) errors.push(`${memberKey} has an invalid installed SHA-256`);
        if (!safeRelativePath(member.archivePath) || !safeRelativePath(member.installPath)) errors.push(`${memberKey} path is unsafe`);
        if (validationArg && !member.validationArgs?.includes(validationArg)) errors.push(`${memberKey} must validate with ${validationArg}`);
        if (!validationArg && member.validationArgs?.length) errors.push(`${memberKey} must not declare validationArgs`);
        const installKey = `${target}/${row.installRoot}/${member.installPath}`;
        if (installPaths.has(installKey)) errors.push(`${installKey} is duplicated`);
        installPaths.add(installKey);
      }
      for (const component of Object.keys(expected)) if (!seen.has(component)) errors.push(`${rowKey} is missing ${component}`);
    } else {
      if (!safeRelativePath(row.archivePath) || !safeRelativePath(row.installPath)) errors.push(`${rowKey} archive/install path is unsafe`);
      if (!validSha(row.installedSha256)) errors.push(`${rowKey} has an invalid installed SHA-256`);
      if (!row.expectedFileArchPattern?.includes(architectureToken(target))) errors.push(`${rowKey} must declare the ${architectureToken(target)} architecture`);
      const expectedName = row.agent === 'claude'
        ? `claude${row.platform === 'win32' ? '.exe' : ''}`
        : row.component === 'runtime'
          ? `opencode${row.platform === 'win32' ? '.exe' : ''}`
          : `rg${row.platform === 'win32' ? '.exe' : ''}`;
      if (row.installName !== expectedName) errors.push(`${rowKey} installName must be ${expectedName}; found ${row.installName}`);
      if (!row.validationArgs?.includes('--version')) errors.push(`${rowKey} must validate with --version`);
      const installKey = `${target}/${row.installPath}`;
      if (installPaths.has(installKey)) errors.push(`${installKey} is duplicated`);
      installPaths.add(installKey);
    }
  }

  for (const [key, approved] of Object.entries(APPROVED_COMPONENTS)) {
    const actualTargets = rows.filter(row => `${row.agent}/${row.component}` === key).map(targetOf).sort();
    if (JSON.stringify(actualTargets) !== JSON.stringify([...approved.targets].sort())) {
      errors.push(`${key} targets must be ${approved.targets.join(', ')}; found ${actualTargets.join(', ') || '<none>'}`);
    }
  }

  const claudeVersion = rows.find(row => row.agent === 'claude')?.version;
  const claudeSdk = packageJson?.dependencies?.['@anthropic-ai/claude-agent-sdk'];
  const lockedClaude = packageLock?.packages?.['node_modules/@anthropic-ai/claude-agent-sdk'];
  if (claudeSdk !== APPROVED_SDKS.claude) errors.push(`Claude Agent SDK must be approved snapshot ${APPROVED_SDKS.claude}; found ${claudeSdk}`);
  if (String(claudeVersion).split('.').at(-1) !== String(claudeSdk).split('.').at(-1)) errors.push(`Claude binary/SDK patch mismatch: ${claudeVersion} vs ${claudeSdk}`);
  if (packageLock?.packages?.['']?.dependencies?.['@anthropic-ai/claude-agent-sdk'] !== claudeSdk || lockedClaude?.version !== claudeSdk) errors.push('package-lock Claude SDK pin does not match package.json');
  for (const name of CLAUDE_OPTIONAL_PACKAGES) {
    const declared = lockedClaude?.optionalDependencies?.[name];
    const locked = packageLock?.packages?.[`node_modules/${name}`]?.version;
    if (declared !== claudeSdk || locked !== claudeSdk) errors.push(`${name} must be present and locked to Claude SDK ${claudeSdk}; found ${declared ?? '<missing>'}/${locked ?? '<missing>'}`);
  }

  const acp = packageJson?.dependencies?.['@agentclientprotocol/sdk'];
  const lockedAcp = packageLock?.packages?.['node_modules/@agentclientprotocol/sdk']?.version;
  if (acp !== APPROVED_SDKS.acp) errors.push(`ACP SDK must be approved snapshot ${APPROVED_SDKS.acp}; found ${acp}`);
  if (packageLock?.packages?.['']?.dependencies?.['@agentclientprotocol/sdk'] !== acp || lockedAcp !== acp) errors.push(`package-lock ACP SDK pin does not match package.json (${acp} vs ${lockedAcp ?? '<missing>'})`);

  return errors;
}

export function validateFiles(repoRoot = REPO_ROOT) {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'extensions/ritemark/binaries/agents/manifest.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'extensions/ritemark/package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'extensions/ritemark/package-lock.json'), 'utf8'));
  return validateAgentRuntimeManifest(manifest, packageJson, packageLock);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const errors = validateFiles();
  if (errors.length) {
    console.error('Agent runtime manifest validation failed:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log('Agent runtime manifest validation passed');
}
