// Capture license facts from verified archives and version-specific upstreams.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const evidence = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const { auditRoot } = JSON.parse(await fs.readFile(path.join(evidence, 'audit-environment.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(evidence, 'candidate-manifest.json'), 'utf8'));
const result = { capturedAt: new Date().toISOString(), archives: [], upstream: [] };
const inspect = String.raw`
import sys,tarfile,hashlib,json
rows=[]
with tarfile.open(sys.argv[1], 'r:gz') as tar:
    for m in tar.getmembers():
        if not m.isfile() or 'license' not in m.name.lower(): continue
        data=tar.extractfile(m).read()
        text=data.decode('utf8',errors='replace')
        rows.append({'member':m.name,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'proprietaryNotice':'All rights reserved' in text,'mitNotice':'MIT License' in text,'apacheNotice':'Apache License' in text})
print(json.dumps(rows))
`;
for (const row of manifest.runtimes.filter(row => row.npmPackage)) {
  result.archives.push({ agent: row.agent, target: `${row.platform}-${row.arch}`, version: row.version, npmLicense: JSON.parse(await fs.readFile(path.join(evidence, `${row.agent}-${row.platform}-${row.arch}.json`), 'utf8')).data.license ?? null, licenses: JSON.parse(execFileSync('python3', ['-c', inspect, path.join(auditRoot, 'downloads', row.archiveFilename)], { encoding: 'utf8' })) });
}
for (const [agent, url] of [
  ['codex', 'https://raw.githubusercontent.com/openai/codex/rust-v0.154.0/LICENSE'],
  ['opencode', 'https://raw.githubusercontent.com/anomalyco/opencode/v1.18.30/LICENSE'],
]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${agent} license HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes.toString('utf8');
  result.upstream.push({ agent, url, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, apacheNotice: /Apache License/.test(text), mitNotice: /MIT License/.test(text) });
}
result.claudeRedistributionBasis = 'Existing product-owner decision dated 2026-05-06, recorded in binaries/agents/README.md; not a new vendor license grant.';
await fs.writeFile(path.join(evidence, 'license-audit.json'), JSON.stringify(result, null, 2) + '\n');
// Correct version-specific notice URLs in the audit candidate only.
for (const row of manifest.runtimes) {
  if (row.agent === 'codex') row.license.noticeUrl = 'https://github.com/openai/codex/blob/rust-v0.154.0/LICENSE';
  if (row.agent === 'opencode') row.license.noticeUrl = 'https://github.com/anomalyco/opencode/blob/v1.18.30/LICENSE';
}
await fs.writeFile(path.join(evidence, 'candidate-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(result));
