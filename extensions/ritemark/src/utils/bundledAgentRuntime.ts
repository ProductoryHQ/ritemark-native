import { existsSync, readFileSync } from 'fs';
import { basename, join, resolve, dirname, relative } from 'path';

// Sprint 76 R2: 'opencode' — bundled ACP agent runtime
export type AgentRuntimeKind = 'claude' | 'codex-cli' | 'codex-app-server' | 'opencode';

export interface BundledAgentRuntime {
  kind: AgentRuntimeKind;
  path: string;
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
}

export function extensionRootFrom(startDir: string): string {
  // Sprint 92 R3: after esbuild bundling, this code is inlined into `out/extension.js`,
  // so `__dirname` at runtime is the `out/` directory — ONE level below the extension
  // root (pre-bundle it was `out/utils/`, two levels below, hence the old '..','..').
  // Callers in the extension host should prefer passing an explicit `extensionRoot`
  // (e.g. `context.extensionPath`); this __dirname fallback assumes the bundle lives at
  // `<extensionRoot>/out/`. If the esbuild `outdir` changes, update this offset.
  return resolve(startDir, '..');
}

function platformArchTag(platform: NodeJS.Platform, arch: NodeJS.Architecture): string {
  return `${platform}-${arch}`;
}

function executablePaths(kind: AgentRuntimeKind, platform: NodeJS.Platform): string[] {
  const extension = platform === 'win32' ? '.exe' : '';

  if (kind === 'claude') {
    return [`claude${extension}`];
  }

  if (kind === 'codex-app-server') {
    return [join('codex', 'bin', `codex-app-server${extension}`), `codex-app-server${extension}`];
  }

  // Sprint 76 R2: OpenCode ACP agent binary
  if (kind === 'opencode') {
    return [`opencode${extension}`];
  }

  return platform === 'win32'
    ? ['codex.exe', 'codex.cmd', 'codex.bat']
    : ['codex'];
}

function candidateRuntimePaths(
  kind: AgentRuntimeKind,
  options?: {
    extensionRoot?: string;
    platform?: NodeJS.Platform;
    arch?: NodeJS.Architecture;
  }
): string[] {
  const platform = options?.platform ?? process.platform;
  const arch = options?.arch ?? process.arch;
  const extensionRoot = options?.extensionRoot ?? extensionRootFrom(__dirname);
  const tag = platformArchTag(platform, arch);
  const names = executablePaths(kind, platform);
  const directories = [
    join(extensionRoot, 'binaries', 'agents', tag),
    join(extensionRoot, 'binaries', 'agents', platform),
    join(extensionRoot, 'resources', 'native-binaries', tag),
    join(extensionRoot, 'resources', 'native-binary'),
    join(extensionRoot, 'resources', kind, tag),
  ];

  return directories.flatMap(directory => names.map(name => join(directory, name)));
}

export function findBundledAgentRuntime(
  kind: AgentRuntimeKind,
  options?: {
    extensionRoot?: string;
    platform?: NodeJS.Platform;
    arch?: NodeJS.Architecture;
  }
): BundledAgentRuntime | null {
  const platform = options?.platform ?? process.platform;
  const arch = options?.arch ?? process.arch;

  for (const candidate of candidateRuntimePaths(kind, options)) {
    if (existsSync(candidate)) {
      return {
        kind,
        path: candidate,
        platform,
        arch,
      };
    }
  }

  return null;
}

export function isBundledAgentRuntimePath(binaryPath: string): boolean {
  const normalized = binaryPath.replace(/\\/g, '/');
  return normalized.includes('/binaries/agents/')
    || normalized.includes('/resources/native-binary/')
    || normalized.includes('/resources/native-binaries/')
    || normalized.includes('/resources/codex-')
    || normalized.includes('/resources/claude/');
}

/** PATH entries shipped specifically for OpenCode's own subprocess lookups. */
export function findBundledOpenCodePathEntries(binaryPath: string): string[] {
  if (!isBundledAgentRuntimePath(binaryPath)) return [];
  const dependencyDir = join(dirname(binaryPath), 'opencode-path');
  const executable = join(dependencyDir, basename(binaryPath).toLowerCase().endsWith('.exe') ? 'rg.exe' : 'rg');
  return existsSync(executable) ? [dependencyDir] : [];
}

export function inferCodexRuntimeLaunchMode(binaryPath: string): 'codex-cli' | 'codex-app-server' {
  const name = basename(binaryPath).toLowerCase();
  return name.startsWith('codex-app-server') ? 'codex-app-server' : 'codex-cli';
}

export type AgentRuntimePreference = 'bundled' | 'system';

/**
 * Read the user's preferred agent-runtime source from VS Code settings.
 * Lazy-loads `vscode` so this stays callable from tsx tests that don't run
 * inside the extension host (returns `'bundled'` when vscode is unavailable).
 */
export function readAgentRuntimePreference(): AgentRuntimePreference {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('ritemark');
    const value = config.get('agentRuntime.preference', 'bundled');
    return value === 'system' ? 'system' : 'bundled';
  } catch {
    return 'bundled';
  }
}

interface BundledManifestMember {
  installPath: string;
  version: string;
}

interface BundledManifestEntry {
  installName?: string;
  installPath?: string;
  installRoot?: string;
  platform: string;
  arch: string;
  version: string;
  members?: BundledManifestMember[];
}

interface BundledManifest {
  runtimes: BundledManifestEntry[];
}

/**
 * Read the version of a bundled binary from manifest.json.
 *
 * Some bundled binaries (codex-app-server) don't accept `--version`, so the
 * canonical source for their version is the manifest the build script wrote.
 * Returns null if the binary isn't bundled, the manifest is missing, or the
 * manifest doesn't list the requested entry.
 */
export function readBundledRuntimeVersion(binaryPath: string): string | null {
  if (!isBundledAgentRuntimePath(binaryPath)) return null;
  const normalized = resolve(binaryPath).replace(/\\/g, '/');
  const marker = '/binaries/agents/';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) return null;
  const agentsRoot = normalized.slice(0, markerIndex + marker.length - 1);
  const manifestPath = join(agentsRoot, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  try {
    const manifest: BundledManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const target = normalized.slice(markerIndex + marker.length).split('/')[0];
    const targetRoot = join(agentsRoot, target);
    const installedPath = relative(targetRoot, binaryPath).replace(/\\/g, '/');
    for (const entry of manifest.runtimes.filter(r => `${r.platform}-${r.arch}` === target)) {
      if (entry.installPath === installedPath || entry.installName === basename(binaryPath)) return entry.version;
      const member = entry.members?.find(candidate => (
        `${entry.installRoot}/${candidate.installPath}` === installedPath
      ));
      if (member) return member.version;
    }
    return null;
  } catch {
    return null;
  }
}
