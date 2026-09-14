import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./extract-runtime-artifact.py', import.meta.url));
const python = process.platform === 'win32' ? 'python' : 'python3';

function makeTar(archive, name) {
  const source = `import io,sys,tarfile\np=tarfile.open(sys.argv[1],'w:gz')\nd=b'ok'\ni=tarfile.TarInfo(sys.argv[2]); i.size=len(d); i.mode=0o755\np.addfile(i,io.BytesIO(d)); p.close()`;
  const result = spawnSync(python, ['-c', source, archive, name], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

test('safe extractor preserves a regular executable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-extract-safe-'));
  try {
    const archive = path.join(root, 'runtime.tar.gz');
    const output = path.join(root, 'output');
    makeTar(archive, 'bin/runtime');
    const result = spawnSync(python, [script, 'tar.gz', archive, output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(output, 'bin/runtime'), 'utf8'), 'ok');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('safe extractor rejects traversal without writing outside output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-extract-traversal-'));
  try {
    const archive = path.join(root, 'runtime.tar.gz');
    const output = path.join(root, 'output');
    makeTar(archive, '../escape');
    const result = spawnSync(python, [script, 'tar.gz', archive, output], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.existsSync(path.join(root, 'escape')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
