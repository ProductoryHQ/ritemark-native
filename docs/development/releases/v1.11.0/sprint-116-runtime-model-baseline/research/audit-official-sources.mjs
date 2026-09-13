// Phase 0 only: record public metadata and immutable baseline identities.
// Run from the sprint worktree root. Does not edit product inputs or execute downloads.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const evidenceDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
await fs.mkdir(evidenceDir, { recursive: true });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [
  'extensions/ritemark/binaries/agents/manifest.json',
  'extensions/ritemark/package.json', 'extensions/ritemark/package-lock.json',
  'extensions/ritemark/src/ai/modelConfig.ts',
  'extensions/ritemark/src/ai/modelCatalog/bundledCatalog.ts',
  'scripts/validate-agent-runtime-manifest.mjs',
  'extensions/ritemark/src/agent/ClaudeCodeRuntime.ts',
  'extensions/ritemark/src/codex/CodexRuntime.ts',
  'extensions/ritemark/src/acp/AcpRuntime.ts',
];
const baseline = {
  capturedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  files: Object.fromEntries(await Promise.all(files.map(async file => [file, digest(await fs.readFile(file))]))),
};
await fs.writeFile(path.join(evidenceDir, 'baseline.json'), JSON.stringify(baseline, null, 2) + '\n');

async function capture(name, url) {
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'ritemark-sprint116-audit', Accept: 'application/json' }, signal: AbortSignal.timeout(45000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = JSON.parse(bytes.toString('utf8'));
    const record = { url, capturedAt: startedAt, sha256: digest(bytes), data };
    await fs.writeFile(path.join(evidenceDir, `${name}.json`), JSON.stringify(record, null, 2) + '\n');
    console.log(JSON.stringify({ name, version: data.version ?? data.tag_name, publishedAt: data.published_at, license: data.license, sha256: record.sha256 }));
    return record;
  } catch (error) {
    const record = { url, capturedAt: startedAt, error: error.message };
    await fs.writeFile(path.join(evidenceDir, `${name}.json`), JSON.stringify(record, null, 2) + '\n');
    console.log(JSON.stringify({ name, error: error.message }));
    return record;
  }
}

const packages = {
  claude: '@anthropic-ai/claude-code', claudeSdk: '@anthropic-ai/claude-agent-sdk',
  codexNpm: '@openai/codex', opencode: 'opencode-ai', acpSdk: '@agentclientprotocol/sdk',
};
const records = Object.fromEntries(await Promise.all(Object.entries(packages).map(async ([name, pkg]) => [name, await capture(name, `https://registry.npmjs.org/${pkg}/latest`)])));
await Promise.all([
  capture('codexRelease', 'https://api.github.com/repos/openai/codex/releases/latest'),
  capture('opencodeRelease', 'https://api.github.com/repos/anomalyco/opencode/releases/latest'),
]);
const manifest = JSON.parse(await fs.readFile(files[0], 'utf8'));
await Promise.all(manifest.runtimes.filter(row => row.npmPackage).map(row => {
  const version = records[row.agent]?.data?.version;
  return version ? capture(`${row.agent}-${row.platform}-${row.arch}`, `https://registry.npmjs.org/${row.npmPackage}/${version}`) : undefined;
}));
console.log(`Evidence saved to ${evidenceDir}`);
