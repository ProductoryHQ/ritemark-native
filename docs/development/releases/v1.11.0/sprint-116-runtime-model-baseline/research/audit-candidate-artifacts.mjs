// Isolated Phase 0 artifact inspection; never installs into product binaries/.
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const evidence = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const read = async name => JSON.parse(await fs.readFile(path.join(evidence, `${name}.json`), 'utf8'));
let auditRoot;
try { auditRoot = (await read('audit-environment')).auditRoot; }
catch { auditRoot = await fs.mkdtemp('/private/tmp/ritemark-s116-audit-'); }
await fs.mkdir(path.join(auditRoot, 'downloads'), { recursive: true });
await fs.mkdir(path.join(auditRoot, 'workspace'), { recursive: true });
await fs.writeFile(path.join(evidence, 'audit-environment.json'), JSON.stringify({ auditRoot, node: process.version, host: `${process.platform}-${process.arch}` }, null, 2) + '\n');
const manifest = JSON.parse(await fs.readFile('extensions/ritemark/binaries/agents/manifest.json', 'utf8'));
const codex = (await read('codexRelease')).data;
const candidates = [];
for (const current of manifest.runtimes) {
  const row = structuredClone(current);
  if (row.agent === 'codex') {
    const asset = codex.assets.find(asset => asset.name === row.archiveFilename);
    if (!asset?.digest?.startsWith('sha256:')) throw new Error(`No authoritative digest for ${row.archiveFilename}`);
    row.version = codex.tag_name.replace('rust-v', '');
    row.sourceUrl = asset.browser_download_url;
    row.sha256 = asset.digest.slice(7);
    row.license.noticeUrl = `https://github.com/openai/codex/blob/${codex.tag_name}/LICENSE`;
  } else {
    const metadata = (await read(`${row.agent}-${row.platform}-${row.arch}`)).data;
    row.version = metadata.version;
    row.sourceUrl = metadata.dist.tarball;
    row.archiveFilename = path.basename(new URL(row.sourceUrl).pathname);
    row.npmIntegrity = metadata.dist.integrity;
    if (row.agent === 'opencode') row.license.noticeUrl = `https://github.com/anomalyco/opencode/blob/v${row.version}/LICENSE`;
    delete row.sha256;
  }
  candidates.push(row);
}

async function hashFile(file, algorithm, encoding = 'hex') {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest(encoding);
}

// Extract only the expected regular file into a fixed destination. No archive
// filename or link can choose a write path, even if the archive is malformed.
const extract = String.raw`
import sys,tarfile,pathlib,shutil,json
archive,member_name,destination=sys.argv[1:]
with tarfile.open(archive,'r:gz') as tar:
    members=tar.getmembers()
    for m in members:
        p=pathlib.PurePosixPath(m.name)
        if p.is_absolute() or '..' in p.parts: raise ValueError('Unsafe archive path')
    selected=[m for m in members if m.name.removeprefix('./')==member_name]
    if len(selected)!=1 or not selected[0].isfile(): raise ValueError('Expected one regular executable')
    with tar.extractfile(selected[0]) as src,open(destination,'wb') as dst: shutil.copyfileobj(src,dst)
    licenses=[m.name for m in members if m.isfile() and ('license' in m.name.lower() or 'notice' in m.name.lower())]
    print(json.dumps({'memberCount':len(members),'member':selected[0].name,'size':selected[0].size,'licenseFiles':licenses}))
`;
const results = [];
async function inspect(row) {
  const key = `${row.agent}/${row.component}/${row.platform}-${row.arch}`;
  const result = { key, capturedAt: new Date().toISOString(), version: row.version, sourceUrl: row.sourceUrl, archiveFilename: row.archiveFilename };
  try {
    const archive = path.join(auditRoot, 'downloads', row.archiveFilename);
    try { await fs.access(archive); }
    catch {
      const response = await fetch(row.sourceUrl, { signal: AbortSignal.timeout(180000) });
      if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
      await pipeline(response.body, createWriteStream(`${archive}.partial`));
      await fs.rename(`${archive}.partial`, archive);
    }
    result.sha256 = await hashFile(archive, 'sha256');
    if (row.sha256 && row.sha256 !== result.sha256) throw new Error('GitHub SHA-256 mismatch');
    if (row.npmIntegrity) {
      const [algorithm, expected] = row.npmIntegrity.split('-', 2);
      if (await hashFile(archive, algorithm, 'base64') !== expected) throw new Error('npm integrity mismatch');
    }
    row.sha256 = result.sha256;
    result.publisherIntegrityVerified = true;
    const targetDir = path.join(auditRoot, 'binaries', `${row.platform}-${row.arch}`);
    await fs.mkdir(targetDir, { recursive: true });
    const binary = path.join(targetDir, row.installName);
    result.archive = JSON.parse(execFileSync('python3', ['-c', extract, archive, row.archivePath, binary], { encoding: 'utf8', timeout: 120000 }));
    await fs.chmod(binary, 0o755);
    result.binarySha256 = await hashFile(binary, 'sha256');
    result.file = execFileSync('file', ['-b', binary], { encoding: 'utf8' }).trim();
    if (row.platform === 'darwin' ? !result.file.includes(row.arch === 'arm64' ? 'arm64' : 'x86_64') : !/PE32\+.*x86-64/.test(result.file)) throw new Error('Architecture mismatch');
    if (row.platform === process.platform && row.arch === process.arch && row.validationArgs?.length) {
      result.startup = { status: 'PASS', args: row.validationArgs, output: execFileSync(binary, row.validationArgs, { cwd: path.join(auditRoot, 'workspace'), encoding: 'utf8', timeout: 20000, maxBuffer: 200000 }).slice(0, 800) };
    } else {
      result.startup = { status: 'NOT_RUN', reason: row.validationArgs?.length ? 'Requires native target runner' : 'IPC helper; must be exercised through parent runtime on Windows' };
    }
    result.status = 'PASS_ARTIFACT';
  } catch (error) { result.status = 'FAIL'; result.error = error.message.slice(0, 600); }
  results.push(result);
  await fs.writeFile(path.join(evidence, `${key.replaceAll('/', '-')}.json`), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ key, status: result.status, startup: result.startup?.status, error: result.error }));
}
const queue = [...candidates];
await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) await inspect(queue.shift()); }));
await fs.writeFile(path.join(evidence, 'candidate-manifest.json'), JSON.stringify({ approved: false, capturedAt: new Date().toISOString(), runtimes: candidates }, null, 2) + '\n');
await fs.writeFile(path.join(evidence, 'artifact-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ auditRoot, total: results.length, passed: results.filter(x => x.status === 'PASS_ARTIFACT').length }));
if (results.some(x => x.status === 'FAIL')) process.exitCode = 1;
