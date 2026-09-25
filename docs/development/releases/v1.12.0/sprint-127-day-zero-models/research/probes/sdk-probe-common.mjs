// Sprint 127 research probes — shared helpers.
//
// The probes run the exact Claude Code CLI and Agent SDK packages that Ritemark
// bundles, outside the app, with an isolated HOME/CLAUDE_CONFIG_DIR and no real
// credentials. See ./README.md for how to fetch the packages.

import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key.slice(2)] = true;
    } else {
      args[key.slice(2)] = next;
      i++;
    }
  }
  return args;
}

export async function loadSdk(sdkPath) {
  if (!sdkPath) throw new Error('--sdk <path to sdk.mjs> is required');
  return import(pathToFileURL(resolve(sdkPath)).href);
}

/** A throwaway home so the probe never reads the caller's Claude login or settings. */
export function isolatedEnv(extra = {}) {
  const home = mkdtempSync(join(tmpdir(), 's127-probe-'));
  return {
    home,
    env: {
      PATH: process.env.PATH,
      HOME: home,
      CLAUDE_CONFIG_DIR: join(home, '.claude'),
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      ...extra,
    },
  };
}

/** Parse `--picker '[{"model":"claude-opus-5-5","label":"Opus 5.5"}]'`. */
export function pickerSettings(raw) {
  if (!raw) return undefined;
  const options = JSON.parse(raw);
  if (!Array.isArray(options)) throw new Error('--picker must be a JSON array of modelPicker options');
  return { modelPicker: { options } };
}

export function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}
