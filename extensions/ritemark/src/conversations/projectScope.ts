import { createHash } from 'crypto';
import type { ProjectScopeDescriptorV1 } from './types';

export interface ProjectScopeInput {
  workspaceFileUri?: string | null;
  folderUris?: readonly string[];
  platform?: NodeJS.Platform;
}
export interface ResolvedProjectScopeV1 {
  scopeId: string;
  descriptor: ProjectScopeDescriptorV1;
}

function isWindowsFileRoot(pathname: string): boolean {
  return /^\/[a-z]:\/$/i.test(pathname) || pathname === '/';
}

export function normalizeProjectUri(uri: string, platform: NodeJS.Platform = process.platform): string {
  const parsed = new URL(uri);
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  if (parsed.protocol === 'file:') {
    let pathname = parsed.pathname.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    if (platform === 'win32') pathname = pathname.toLowerCase();
    while (pathname.endsWith('/') && !isWindowsFileRoot(pathname)) pathname = pathname.slice(0, -1);
    parsed.pathname = pathname;
  } else if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }

  return parsed.toString();
}

export function canonicalProjectScopeJson(descriptor: ProjectScopeDescriptorV1): string {
  return JSON.stringify({
    kind: descriptor.kind,
    workspaceFileUri: descriptor.workspaceFileUri,
    folderUris: descriptor.folderUris,
  });
}

export function projectScopeId(descriptor: ProjectScopeDescriptorV1): string {
  return `ps1-${createHash('sha256').update(canonicalProjectScopeJson(descriptor)).digest('hex').slice(0, 40)}`;
}

export function resolveProjectScope(input: ProjectScopeInput): ResolvedProjectScopeV1 {
  const platform = input.platform ?? process.platform;
  const workspaceFileUri = input.workspaceFileUri
    ? normalizeProjectUri(input.workspaceFileUri, platform)
    : null;
  const folderUris = [...new Set((input.folderUris ?? []).map((uri) => normalizeProjectUri(uri, platform)))].sort();

  const descriptor: ProjectScopeDescriptorV1 = {
    kind: workspaceFileUri
      ? 'workspace-file'
      : folderUris.length === 0
        ? 'no-folder'
        : folderUris.length === 1
          ? 'single-root'
          : 'multi-root',
    workspaceFileUri,
    folderUris,
  };

  return { scopeId: projectScopeId(descriptor), descriptor };
}

export function unassignedLegacyScope(): ResolvedProjectScopeV1 {
  const descriptor: ProjectScopeDescriptorV1 = {
    kind: 'unassigned-legacy',
    workspaceFileUri: null,
    folderUris: [],
  };
  return { scopeId: projectScopeId(descriptor), descriptor };
}
