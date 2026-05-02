import { existsSync } from 'fs';
import { basename, join, resolve } from 'path';

export type AgentRuntimeKind = 'claude' | 'codex-cli' | 'codex-app-server';

export interface BundledAgentRuntime {
  kind: AgentRuntimeKind;
  path: string;
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
}

function extensionRootFrom(startDir: string): string {
  return resolve(startDir, '..', '..');
}

function platformArchTag(platform: NodeJS.Platform, arch: NodeJS.Architecture): string {
  return `${platform}-${arch}`;
}

function executableNames(kind: AgentRuntimeKind, platform: NodeJS.Platform): string[] {
  const extension = platform === 'win32' ? '.exe' : '';

  if (kind === 'claude') {
    return [`claude${extension}`];
  }

  if (kind === 'codex-app-server') {
    return [`codex-app-server${extension}`];
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
  const names = executableNames(kind, platform);
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

export function inferCodexRuntimeLaunchMode(binaryPath: string): 'codex-cli' | 'codex-app-server' {
  const name = basename(binaryPath).toLowerCase();
  return name.startsWith('codex-app-server') ? 'codex-app-server' : 'codex-cli';
}
