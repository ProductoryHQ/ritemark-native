#!/usr/bin/env node

// Lists the changes under extensions/ritemark/ since a ref (the last shell
// release) that an extension-only release cannot deliver.
//
// scripts/release-extension.sh ships the compiled out/**/*.js plus SHIPPED_FILES.
// On the user's machine src/update/userExtensionInstaller.ts clones the app's
// bundled extension and lays those files over it, so everything else keeps the
// version the last shell release installed: icons, fonts, themes, the starter
// pack, draw.io and PDF assets, the whisper binaries, and every package that
// loads from node_modules instead of being compiled into out/extension.js (the
// esbuild externals and what they pull in). release-extension-preflight.sh
// stops the release when this prints anything.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EXTENSION_DIR = 'extensions/ritemark/';

/** Shipped as-is besides out/**\/*.js. Must match release-extension.sh's FILES list (the test checks). */
export const SHIPPED_FILES = [
  'media/webview.js',
  'media/webview.js.map',
  'media/office-preview.js',
  'media/office-preview.NOTICES.txt',
  'package.json',
];

// Compiled into out/**/*.js, media/webview.js or media/office-preview.js.
const COMPILED_SOURCES = ['src/', 'webview/', 'esbuild.config.mjs', 'tsconfig.json'];
// Never loaded at runtime.
const DEV_ONLY = ['scripts/', '.gitignore'];
// Shell-tier (CLAUDE.md "Release Tiers"); the preflight's tier check blocks these.
const SHELL_TIER = ['binaries/agents/'];

const matchesAny = (relPath, entries) =>
  entries.some(entry => (entry.endsWith('/') ? relPath.startsWith(entry) : relPath === entry));

/** How a change to `relPath` (relative to extensions/ritemark/) fares in an extension release. */
export function classifyExtensionPath(relPath) {
  if (matchesAny(relPath, SHIPPED_FILES)) return 'shipped';
  if (matchesAny(relPath, COMPILED_SOURCES)) return 'compiled';
  if (matchesAny(relPath, DEV_ONLY)) return 'dev-only';
  if (matchesAny(relPath, SHELL_TIER)) return 'shell-tier';
  // Mostly compiled in; the packages that stay in node_modules are compared separately.
  if (relPath === 'package-lock.json') return 'lockfile';
  // Anything unrecognised counts as not shipped, so a new asset folder is listed, not missed.
  return 'unshipped';
}

/** The lockfile key Node loads `name` from, starting at the package installed at `from`. */
function resolveLocked(packages, from, name) {
  for (let dir = from; ;) {
    const key = `${dir ? `${dir}/` : ''}node_modules/${name}`;
    if (packages[key]) return key;
    if (!dir) return null;
    const parent = dir.lastIndexOf('/node_modules/');
    dir = parent < 0 ? '' : dir.slice(0, parent);
  }
}

/** Every lockfile entry that loading `root` pulls in, keyed by install path. */
function lockedTree(packages, root) {
  const tree = new Map();
  const queue = [['', root]];
  while (queue.length) {
    const [from, name] = queue.shift();
    const key = resolveLocked(packages, from, name);
    if (!key || tree.has(key)) continue;
    const entry = packages[key];
    tree.set(key, entry);
    const deps = { ...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies };
    for (const dep of Object.keys(deps)) queue.push([key, dep]);
  }
  return tree;
}

const fingerprint = entry => (entry ? `${entry.version} ${entry.resolved} ${entry.integrity}` : 'absent');
const packageName = key => key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);

/** Externals whose installed tree differs between two package-lock.json snapshots. */
export function changedExternals(baseLock, headLock, externals) {
  const base = baseLock?.packages ?? {};
  const head = headLock?.packages ?? {};
  return externals.flatMap(name => {
    const before = lockedTree(base, name);
    const after = lockedTree(head, name);
    const rootKey = `node_modules/${name}`;
    const changedDeps = [...new Set([...before.keys(), ...after.keys()])]
      .filter(key => key !== rootKey && fingerprint(before.get(key)) !== fingerprint(after.get(key)))
      .sort()
      .map(key => ({ name: packageName(key), from: before.get(key)?.version ?? 'absent', to: after.get(key)?.version ?? 'absent' }));
    const from = before.get(rootKey)?.version ?? 'absent';
    const to = after.get(rootKey)?.version ?? 'absent';
    const rootChanged = fingerprint(before.get(rootKey)) !== fingerprint(after.get(rootKey));
    return rootChanged || changedDeps.length ? [{ name, from, to, rootChanged, changedDeps }] : [];
  });
}

// Same version, different lockfile entry (resolved/integrity): still a change.
const versionChange = (from, to) => (from === to ? `${from} repackaged` : `${from} -> ${to}`);

/** One report line for a changed external. */
export function describeExternal({ name, from, to, rootChanged, changedDeps }) {
  const where = "loads from the app's node_modules";
  if (!rootChanged) {
    const deps = changedDeps.map(dep => `${dep.name} ${versionChange(dep.from, dep.to)}`).join(', ');
    return `${name} ${from} (${where}), pulls in changed ${deps}`;
  }
  const version = versionChange(from, to);
  const more = changedDeps.length
    ? `; ${changedDeps.length} package${changedDeps.length === 1 ? '' : 's'} it pulls in changed too`
    : '';
  return `${name} ${version} (${where}${more})`;
}

function git(root, args) {
  // stderr is piped so a git failure is reported once, inside the thrown error.
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

function lockfileAt(root, ref) {
  const spec = `${ref}:${EXTENSION_DIR}package-lock.json`;
  try {
    execFileSync('git', ['cat-file', '-e', spec], { cwd: root, stdio: 'ignore' });
  } catch {
    return {}; // no lockfile at that ref: every external counts as new
  }
  return JSON.parse(git(root, ['show', spec]));
}

async function readExternals(root) {
  const config = path.join(root, EXTENSION_DIR, 'esbuild.config.mjs');
  let external;
  try {
    ({ external } = await import(pathToFileURL(config).href));
  } catch (error) {
    throw new Error(`could not read the esbuild externals from ${config} (run npm ci in ${EXTENSION_DIR}): ${error.message}`);
  }
  if (!Array.isArray(external)) throw new Error(`${config} does not export an \`external\` array`);
  return external;
}

async function main(argv) {
  const ref = argv[0] === '--ref' ? argv[1] : undefined;
  if (!ref) throw new Error('usage: list-unshipped-extension-changes.mjs --ref <git-ref>');
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();

  const changed = git(root, ['diff', '-z', '--name-only', '--no-renames', `${ref}..HEAD`, '--', EXTENSION_DIR])
    .split('\0')
    .filter(Boolean);
  const lines = changed.filter(file => classifyExtensionPath(file.slice(EXTENSION_DIR.length)) === 'unshipped');

  if (changed.includes(`${EXTENSION_DIR}package-lock.json`)) {
    const externals = await readExternals(root);
    const changes = changedExternals(lockfileAt(root, ref), lockfileAt(root, 'HEAD'), externals);
    lines.push(...changes.map(describeExternal));
  }

  for (const line of lines) console.log(line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
