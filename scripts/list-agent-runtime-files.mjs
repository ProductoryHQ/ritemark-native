#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Expand schema-v3 source rows into the files installed for one target. */
export function listInstalledRuntimeFiles(manifest, platform, arch) {
  const rows = (manifest?.runtimes ?? []).filter(row => row.platform === platform && row.arch === arch);
  return rows.flatMap(row => {
    if (row.agent === 'codex') {
      return (row.members ?? []).map(member => ({
        path: path.posix.join(row.installRoot, member.installPath),
        expectedFileArchPattern: member.expectedFileArchPattern ?? '',
        executable: member.executable === true,
        sha256: member.sha256,
      }));
    }
    return [{
      path: row.installPath,
      expectedFileArchPattern: row.expectedFileArchPattern ?? '',
      executable: true,
      sha256: row.installedSha256,
    }];
  }).sort((a, b) => a.path.localeCompare(b.path));
}

function main(argv) {
  const [manifestPath, platform, arch, format = '--records'] = argv;
  if (!manifestPath || !platform || !arch || !['--records', '--paths', '--paths-with-sidecars'].includes(format)) {
    throw new Error('usage: list-agent-runtime-files.mjs <manifest> <platform> <arch> [--records|--paths|--paths-with-sidecars]');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const files = listInstalledRuntimeFiles(manifest, platform, arch);
  if (!files.length) process.exitCode = 2;
  if (format === '--paths') {
    for (const file of files) console.log(file.path);
  } else if (format === '--paths-with-sidecars') {
    for (const file of files) {
      console.log(file.path);
      console.log(`${file.path}.sha256`);
    }
  } else {
    for (const file of files) {
      console.log([file.path, file.expectedFileArchPattern, file.executable ? '1' : '0', file.sha256].join('|'));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
