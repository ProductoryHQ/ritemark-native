/**
 * ACP filesystem proxy
 *
 * Sprint 76 R1/R4: handlers for the agent-initiated `fs/read_text_file` and
 * `fs/write_text_file` requests. All filesystem access is routed through
 * `vscode.workspace.fs` (default backend) so the agent never touches disk
 * directly, and every path is validated against the workspace root before any
 * read or write.
 *
 * The write handler takes an approval callback (Phase 4 wires it to the AI
 * sidebar UI). There is no default that silently writes — a callback MUST be
 * provided (R4 invariant: "no silent writes, ever").
 */

import * as path from 'path';
import * as fs from 'fs';
import type {
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from '@agentclientprotocol/sdk';

/**
 * Minimal filesystem backend. The default implementation is backed by
 * `vscode.workspace.fs`; tests inject a fake. Kept small and vscode-free so the
 * module compiles and unit-tests without the editor host.
 */
export interface AcpFsBackend {
  readFile(absPath: string): Promise<string>;
  writeFile(absPath: string, content: string): Promise<void>;
}

/**
 * Approval callback for writes. Returns true if the write is permitted. Phase 4
 * wires this to the approval UI; in Phase 1 the embedder must supply it.
 */
export type AcpWriteApproval = (request: WriteTextFileRequest) => Promise<boolean>;

export interface AcpFsProxyConfig {
  /** Absolute workspace root. Reads/writes outside this are rejected. */
  workspaceRoot: string;
  /** Filesystem backend (defaults to vscode.workspace.fs). */
  backend?: AcpFsBackend;
  /** Required approval gate for writes (R4 — no silent writes). */
  approveWrite: AcpWriteApproval;
  trace?: (scope: string, message: string, payload?: unknown) => void;
}

/**
 * Resolve a requested path against the workspace root and confirm it stays
 * inside. Symlinks are resolved where the target exists so a symlink pointing
 * outside the workspace cannot be used to escape it; `..` traversal is rejected
 * by the containment check on the resolved absolute path.
 *
 * Returns the resolved absolute path, or null when the path escapes the root.
 */
export function resolveWithinWorkspace(workspaceRoot: string, requestedPath: string): string | null {
  const rootReal = realpathOrSelf(path.resolve(workspaceRoot));
  // Resolve the request relative to the root (absolute paths stay absolute).
  const resolved = path.resolve(rootReal, requestedPath);
  const real = realpathOrSelf(resolved);

  if (!isContained(rootReal, real)) {
    return null;
  }
  return real;
}

/** True when `child` is the root itself or nested beneath it. */
function isContained(root: string, child: string): boolean {
  const rel = path.relative(root, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolve symlinks for the longest existing prefix of `target`. For a write to
 * a not-yet-existing file we still resolve the existing parent directory, so a
 * symlinked parent escaping the workspace is caught.
 */
function realpathOrSelf(target: string): string {
  try {
    return fs.realpathSync(target);
  } catch {
    const parent = path.dirname(target);
    if (parent === target) {
      return target;
    }
    return path.join(realpathOrSelf(parent), path.basename(target));
  }
}

export class AcpFsProxy {
  private readonly config: AcpFsProxyConfig;
  private readonly backend: AcpFsBackend;
  private readonly trace?: AcpFsProxyConfig['trace'];

  constructor(config: AcpFsProxyConfig) {
    this.config = config;
    this.backend = config.backend ?? createVscodeFsBackend();
    this.trace = config.trace;
  }

  /** fs/read_text_file handler. */
  readTextFile = async (request: ReadTextFileRequest): Promise<ReadTextFileResponse> => {
    const resolved = resolveWithinWorkspace(this.config.workspaceRoot, request.path);
    if (!resolved) {
      this.trace?.('fs', 'read:rejected-outside-workspace', { path: request.path });
      throw new Error(`Read rejected: ${request.path} is outside the workspace root`);
    }

    let content = await this.backend.readFile(resolved);
    content = sliceByLines(content, request.line ?? null, request.limit ?? null);
    this.trace?.('fs', 'read', { path: resolved, length: content.length });
    return { content };
  };

  /** fs/write_text_file handler — approval-gated, workspace-bounded (R4). */
  writeTextFile = async (request: WriteTextFileRequest): Promise<WriteTextFileResponse> => {
    const resolved = resolveWithinWorkspace(this.config.workspaceRoot, request.path);
    if (!resolved) {
      this.trace?.('fs', 'write:rejected-outside-workspace', { path: request.path });
      throw new Error(`Write rejected: ${request.path} is outside the workspace root`);
    }

    const approved = await this.config.approveWrite(request);
    if (!approved) {
      this.trace?.('fs', 'write:rejected-by-user', { path: resolved });
      throw new Error(`Write rejected by user: ${request.path}`);
    }

    await this.backend.writeFile(resolved, request.content);
    this.trace?.('fs', 'write', { path: resolved, length: request.content.length });
    return {};
  };
}

/**
 * Return the requested 1-based line slice of `content`. When neither `line` nor
 * `limit` is set the full content is returned. Matches the ACP
 * ReadTextFileRequest line/limit semantics.
 */
function sliceByLines(content: string, line: number | null, limit: number | null): string {
  if (line === null && limit === null) {
    return content;
  }
  const lines = content.split('\n');
  const start = line && line > 0 ? line - 1 : 0;
  const end = limit && limit > 0 ? start + limit : lines.length;
  return lines.slice(start, end).join('\n');
}

/**
 * Default backend backed by `vscode.workspace.fs`. Loaded through a
 * Function-wrapped require so this module compiles and unit-tests without the
 * editor host (mirrors runtimeTrace.ts).
 */
function createVscodeFsBackend(): AcpFsBackend {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynamicRequire = new Function('name', 'return require(name)') as (name: string) => {
    Uri: { file: (p: string) => unknown };
    workspace: {
      fs: {
        readFile: (uri: unknown) => Thenable<Uint8Array>;
        writeFile: (uri: unknown, content: Uint8Array) => Thenable<void>;
      };
    };
  };
  const vscode = dynamicRequire('vscode');

  return {
    async readFile(absPath: string): Promise<string> {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
      return Buffer.from(bytes).toString('utf8');
    },
    async writeFile(absPath: string, content: string): Promise<void> {
      await vscode.workspace.fs.writeFile(vscode.Uri.file(absPath), Buffer.from(content, 'utf8'));
    },
  };
}
