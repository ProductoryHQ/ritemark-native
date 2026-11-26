import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [, , modulePath, bundleId, output] = process.argv;
const { parsePluginkitState, quickLookSettingsUrl } = await import(pathToFileURL(modulePath));

if (bundleId === '--settings-url') {
  console.log(quickLookSettingsUrl);
} else {
  const result = spawnSync('/usr/bin/pluginkit', ['-m', '-i', bundleId], {
    encoding: 'utf8',
    timeout: 1500,
    maxBuffer: 16 * 1024,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const status = result.status ?? result.error?.code ?? result.signal ?? 'unknown';
  writeFileSync(`${output}.txt`, stdout);
  writeFileSync(`${output}.log`, `Exit status: ${status}\n${stderr}`);
  console.log(result.status === 0 && !stderr ? parsePluginkitState(stdout, bundleId) : 'unknown');
}
