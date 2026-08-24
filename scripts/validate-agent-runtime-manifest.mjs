#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(SCRIPT_DIR);

const EXPECTED_TARGETS = [
  'darwin-arm64',
  'darwin-x64',
  'win32-x64',
];

const APPROVED_RUNTIMES = {
  codex: { vendor: 'openai', version: '0.149.0' },
  claude: { vendor: 'anthropic', version: '2.1.239' },
  opencode: { vendor: 'anomalyco', version: '1.18.21' },
};

const APPROVED_SDKS = {
  claude: '0.3.239',
  acp: '1.4.0',
};

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

const isExactVersion = (value) => /^\d+\.\d+\.\d+$/.test(value ?? '');
const patchVersion = (value) => String(value).split('.').at(-1);

export function validateAgentRuntimeManifest(manifest, packageJson, packageLock) {
  const errors = [];
  const runtimes = Array.isArray(manifest?.runtimes) ? manifest.runtimes : [];
  const byAgent = new Map();

  if (runtimes.length !== 9) errors.push(`manifest must contain 9 runtime rows; found ${runtimes.length}`);

  for (const runtime of runtimes) {
    const target = `${runtime.platform}-${runtime.arch}`;
    if (!byAgent.has(runtime.agent)) byAgent.set(runtime.agent, []);
    byAgent.get(runtime.agent).push(runtime);

    if (!isExactVersion(runtime.version)) errors.push(`${runtime.agent}/${target} version is not exact: ${runtime.version}`);
    if (!/^[a-f0-9]{64}$/.test(runtime.sha256 ?? '')) errors.push(`${runtime.agent}/${target} has an invalid SHA-256`);
    if (!runtime.sourceUrl?.includes(runtime.version)) errors.push(`${runtime.agent}/${target} sourceUrl does not contain ${runtime.version}`);
    if (!runtime.validationArgs?.includes('--version')) errors.push(`${runtime.agent}/${target} must validate with --version`);
  }

  for (const agent of Object.keys(APPROVED_RUNTIMES)) {
    const rows = byAgent.get(agent) ?? [];
    const targets = rows.map((row) => `${row.platform}-${row.arch}`).sort();
    const versions = [...new Set(rows.map((row) => row.version))];
    if (JSON.stringify(targets) !== JSON.stringify(EXPECTED_TARGETS)) {
      errors.push(`${agent} targets must be ${EXPECTED_TARGETS.join(', ')}; found ${targets.join(', ') || '<none>'}`);
    }
    if (versions.length !== 1) errors.push(`${agent} platform rows must share one version; found ${versions.join(', ')}`);
    for (const row of rows) {
      const approved = APPROVED_RUNTIMES[agent];
      if (row.version !== approved.version) {
        errors.push(`${agent}/${row.platform}-${row.arch} version must be approved snapshot ${approved.version}; found ${row.version}`);
      }
      if (row.vendor !== approved.vendor) {
        errors.push(`${agent}/${row.platform}-${row.arch} vendor must be ${approved.vendor}; found ${row.vendor}`);
      }
    }
  }

  const claudeRows = byAgent.get('claude') ?? [];
  const claudeBinaryVersion = claudeRows[0]?.version;
  const claudeSdkVersion = packageJson?.dependencies?.['@anthropic-ai/claude-agent-sdk'];
  const lockedClaudeSdk = packageLock?.packages?.['node_modules/@anthropic-ai/claude-agent-sdk'];
  if (!isExactVersion(claudeSdkVersion)) errors.push(`Claude Agent SDK dependency must be exact; found ${claudeSdkVersion}`);
  if (claudeSdkVersion !== APPROVED_SDKS.claude) {
    errors.push(`Claude Agent SDK must be approved snapshot ${APPROVED_SDKS.claude}; found ${claudeSdkVersion}`);
  }
  if (patchVersion(claudeBinaryVersion) !== patchVersion(claudeSdkVersion)) {
    errors.push(`Claude binary/SDK patch mismatch: ${claudeBinaryVersion} vs ${claudeSdkVersion}`);
  }
  if (packageLock?.packages?.['']?.dependencies?.['@anthropic-ai/claude-agent-sdk'] !== claudeSdkVersion) {
    errors.push('package-lock root Claude SDK pin does not match package.json');
  }
  if (lockedClaudeSdk?.version !== claudeSdkVersion) {
    errors.push(`package-lock resolved Claude SDK ${lockedClaudeSdk?.version ?? '<missing>'}, expected ${claudeSdkVersion}`);
  }
  for (const name of CLAUDE_OPTIONAL_PACKAGES) {
    const declaredVersion = lockedClaudeSdk?.optionalDependencies?.[name];
    const lockedVersion = packageLock?.packages?.[`node_modules/${name}`]?.version;
    if (declaredVersion !== claudeSdkVersion || lockedVersion !== claudeSdkVersion) {
      errors.push(`${name} must be present and locked to Claude SDK ${claudeSdkVersion}; found ${declaredVersion ?? '<missing>'}/${lockedVersion ?? '<missing>'}`);
    }
  }

  const acpVersion = packageJson?.dependencies?.['@agentclientprotocol/sdk'];
  const lockedAcp = packageLock?.packages?.['node_modules/@agentclientprotocol/sdk']?.version;
  if (!isExactVersion(acpVersion)) errors.push(`ACP SDK dependency must be exact; found ${acpVersion}`);
  if (acpVersion !== APPROVED_SDKS.acp) {
    errors.push(`ACP SDK must be approved snapshot ${APPROVED_SDKS.acp}; found ${acpVersion}`);
  }
  if (packageLock?.packages?.['']?.dependencies?.['@agentclientprotocol/sdk'] !== acpVersion || lockedAcp !== acpVersion) {
    errors.push(`package-lock ACP SDK pin does not match package.json (${acpVersion} vs ${lockedAcp ?? '<missing>'})`);
  }

  for (const runtime of byAgent.get('opencode') ?? []) {
    if (!runtime.license?.noticeUrl?.includes('/anomalyco/opencode/')) {
      errors.push(`opencode/${runtime.platform}-${runtime.arch} license URL must use anomalyco/opencode`);
    }
  }

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
  if (errors.length > 0) {
    console.error('Agent runtime manifest validation failed:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log('Agent runtime manifest validation passed');
}
