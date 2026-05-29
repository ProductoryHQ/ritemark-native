/**
 * Codex Binary Manager
 *
 * Manages the lifecycle of the `codex app-server` binary:
 * - Detection (check if codex is in PATH)
 * - Version verification
 * - Process spawning and stdio management
 * - Graceful shutdown
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import { isEnabled } from '../features/featureGate';
import {
  findBundledAgentRuntime,
  inferCodexRuntimeLaunchMode,
  readBundledRuntimeVersion,
  isBundledAgentRuntimePath,
  readAgentRuntimePreference,
} from '../utils/bundledAgentRuntime';

export interface CodexManagerConfig {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onExit?: (code: number | null) => void;
}

export interface CodexBinaryStatus {
  available: boolean;
  runnable: boolean;
  version: string | null;
  error: string | null;
  binaryPath: string | null;
  installNodeVersion: string | null;
  runtimeNodeVersion: string;
  diagnostics: string[];
  repairCommand: string | null;
  installNodeArch: string | null;
  runtimeNodeArch: string;
  machineArch: string;
  compatibility: CodexCompatibilityStatus | null;
  runtimeSource: CodexRuntimeSource | null;
  launchMode: CodexLaunchMode | null;
}

export interface CodexCapabilityFlags {
  approvals: boolean;
  requestUserInput: boolean;
  planUpdates: boolean;
}

export interface CodexCompatibilityStatus {
  state: 'compatible' | 'limited';
  summary: string;
  capabilities: CodexCapabilityFlags;
  limitations: string[];
}

type CodexRuntimeSource = 'bundled' | 'system';
type CodexLaunchMode = 'codex-cli' | 'codex-app-server';

interface CodexResolvedBinary {
  binaryPath: string;
  runtimeSource: CodexRuntimeSource;
  launchMode: CodexLaunchMode;
}

export class CodexManager {
  private static readonly compatibilityCache = new Map<string, CodexCompatibilityStatus>();
  private process: ChildProcess | null = null;
  private config: CodexManagerConfig;
  private isShuttingDown = false;

  constructor(config: CodexManagerConfig = {}) {
    this.config = config;
  }

  /**
   * Check if codex binary is available in PATH
   */
  async isInstalled(): Promise<boolean> {
    const binary = await this.findBinary();
    return binary !== null;
  }

  /**
   * Resolve the codex executable path from the current environment.
   *
   * On Windows, `where codex` returns both an extensionless Unix shell script
   * and a .cmd wrapper. The extensionless file cannot be spawned by Node.js
   * (it's a bash shim), so we must prefer the .cmd or .exe variant.
   */
  async findBinaryPath(): Promise<string | null> {
    const binary = await this.findBinary();
    return binary?.binaryPath ?? null;
  }

  private async findBinary(): Promise<CodexResolvedBinary | null> {
    const preference = readAgentRuntimePreference();
    const bundled = this.resolveBundledBinary();

    if (preference === 'bundled' && bundled) {
      return bundled;
    }

    const fromPath = await this.findBinaryInPath();
    if (fromPath) {
      return {
        binaryPath: fromPath,
        runtimeSource: 'system',
        launchMode: inferCodexRuntimeLaunchMode(fromPath),
      };
    }

    const fallbackPath = this.findSystemFallbackBinaryPath();
    if (fallbackPath) {
      return {
        binaryPath: fallbackPath,
        runtimeSource: 'system',
        launchMode: inferCodexRuntimeLaunchMode(fallbackPath),
      };
    }

    // No system binary found. If the user prefers system but no install exists,
    // gracefully fall back to bundled so Codex remains usable. The Settings page
    // surfaces runtimeSource so the user can see which path is actually in use.
    return bundled;
  }

  private resolveBundledBinary(): CodexResolvedBinary | null {
    const bundledAppServer = findBundledAgentRuntime('codex-app-server');
    if (bundledAppServer) {
      return {
        binaryPath: bundledAppServer.path,
        runtimeSource: 'bundled',
        launchMode: 'codex-app-server',
      };
    }

    const bundledCli = findBundledAgentRuntime('codex-cli');
    if (bundledCli) {
      return {
        binaryPath: bundledCli.path,
        runtimeSource: 'bundled',
        launchMode: inferCodexRuntimeLaunchMode(bundledCli.path),
      };
    }

    return null;
  }

  private findSystemFallbackBinaryPath(): string | null {
    // Fallback: scan common install locations (nvm, Homebrew, etc.)
    if (process.platform !== 'win32') {
      const home = require('os').homedir();
      const { existsSync, readdirSync } = require('fs');
      const { join } = require('path');

      // Scan all nvm Node versions for codex
      const nvmDir = join(home, '.nvm', 'versions', 'node');
      if (existsSync(nvmDir)) {
        try {
          const versions = readdirSync(nvmDir)
            .filter((d: string) => d.startsWith('v'))
            .sort((a: string, b: string) => {
              // Semver-aware sort: v22.21.1 > v9.0.0
              const pa = a.replace('v', '').split('.').map(Number);
              const pb = b.replace('v', '').split('.').map(Number);
              for (let i = 0; i < 3; i++) {
                if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
              }
              return 0;
            }); // newest first
          for (const ver of versions) {
            const candidate = join(nvmDir, ver, 'bin', 'codex');
            if (existsSync(candidate)) return candidate;
          }
        } catch { /* not readable */ }
      }

      // Other common locations
      const candidates = [
        join(home, '.local', 'bin', 'codex'),
        join(home, '.npm-global', 'bin', 'codex'),
        '/opt/homebrew/bin/codex',
        '/usr/local/bin/codex',
      ];
      for (const c of candidates) {
        if (existsSync(c)) return c;
      }
    }

    return null;
  }

  private async findBinaryInPath(): Promise<string | null> {
    return new Promise((resolve) => {
      const cmd = process.platform === 'win32' ? 'where' : 'which';
      const check = spawn(cmd, ['codex']);
      let stdout = '';

      check.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      check.on('exit', (code) => {
        if (code !== 0) {
          resolve(null);
          return;
        }

        const lines = stdout
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean);

        if (process.platform === 'win32') {
          const exeMatch = lines.find(l => /\.exe$/i.test(l));
          if (exeMatch) {
            resolve(exeMatch);
            return;
          }
          const cmdMatch = lines.find(l => /\.(cmd|bat)$/i.test(l));
          if (cmdMatch) {
            resolve(cmdMatch);
            return;
          }
          resolve(null);
          return;
        }

        resolve(lines[0] ?? null);
      });
      check.on('error', () => resolve(null));
    });
  }

  /**
   * Check whether the codex binary exists and can actually run.
   */
  async getBinaryStatus(): Promise<CodexBinaryStatus> {
    const binary = await this.findBinary();
    const runtimeNodeVersion = process.version.replace(/^v/, '');
    const runtimeNodeArch = process.arch;
    const machineArch = this.getMachineArch();

    if (!binary) {
      return {
        available: false,
        runnable: false,
        version: null,
        error: 'Codex CLI not found.',
        binaryPath: null,
        installNodeVersion: null,
        runtimeNodeVersion,
        diagnostics: [],
        repairCommand: this.buildRepairCommand(null, runtimeNodeVersion, machineArch, null),
        installNodeArch: null,
        runtimeNodeArch,
        machineArch,
        compatibility: null,
        runtimeSource: null,
        launchMode: null,
      };
    }

    const binaryPath = binary.binaryPath;
    const installNodeVersion = this.extractNvmNodeVersion(binaryPath);
    const installNodeArch = this.getBinaryArchitecture(binaryPath);

    // `codex-app-server` supports `--version` from 0.135.0 onwards (output:
    // `codex-app-server <semver>`). Older bundled releases (≤ 0.130.0) rejected
    // it with exit code 2 — for those, fall back to the manifest version and
    // verify the binary spawns via `--help`. Successful `--version` confirms
    // both the real runtime version AND that the binary is launchable, so
    // we don't need a separate `--help` probe on the happy path. The drift
    // detection below warns if the runtime version disagrees with the
    // manifest, so a silent fallback to manifest never hides upgrade drift.
    if (binary.launchMode === 'codex-app-server') {
      const manifestVersion = readBundledRuntimeVersion(binaryPath);
      const versionProbe = this.spawnResolvedBinarySync(binaryPath, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 3000,
      });
      let runtimeVersion: string | null = null;
      if (versionProbe.status === 0) {
        const match = String(versionProbe.stdout || '').match(/codex(?:-app-server|-cli)?\s+([\d.]+)/i);
        runtimeVersion = match ? match[1] : null;
      }

      let probeOk: boolean;
      let probeError: string | null;
      if (runtimeVersion) {
        probeOk = true;
        probeError = null;
      } else {
        // Fallback for older bundled binaries that reject `--version`.
        const helpProbe = this.spawnResolvedBinarySync(binaryPath, ['--help'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 3000,
        });
        probeOk = helpProbe.status === 0;
        probeError = probeOk
          ? null
          : this.summarizeFailure(
              String(helpProbe.stderr || helpProbe.stdout || `app-server --help exited ${helpProbe.status ?? 'null'}`),
            );
      }

      const reportedVersion = runtimeVersion ?? manifestVersion;

      if (probeOk && runtimeVersion && manifestVersion && runtimeVersion !== manifestVersion) {
        console.warn(
          `[ritemark] Runtime drift: codex-app-server reports ${runtimeVersion} but manifest says ${manifestVersion} (${binaryPath})`,
        );
      }

      return {
        available: true,
        runnable: probeOk,
        version: reportedVersion,
        error: probeError,
        binaryPath,
        installNodeVersion,
        runtimeNodeVersion,
        diagnostics: this.buildDiagnostics(binaryPath, installNodeVersion, runtimeNodeVersion, installNodeArch, runtimeNodeArch, machineArch),
        repairCommand: this.buildRepairCommand(installNodeVersion, runtimeNodeVersion, machineArch, installNodeArch),
        installNodeArch,
        runtimeNodeArch,
        machineArch,
        compatibility: probeOk ? this.inspectCompatibility(binaryPath, reportedVersion, binary.launchMode) : null,
        runtimeSource: binary.runtimeSource,
        launchMode: binary.launchMode,
      };
    }

    return new Promise((resolve) => {
      const versionProcess = this.spawnResolvedBinary(binaryPath, ['--version']);
      let stdout = '';
      let stderr = '';

      versionProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      versionProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      versionProcess.on('exit', (code) => {
        if (code === 0) {
          const match = stdout.match(/codex(?:-cli)?\s+([\d.]+)/i);
          resolve({
            available: true,
            runnable: true,
            version: match ? match[1] : null,
            error: null,
            binaryPath,
            installNodeVersion,
            runtimeNodeVersion,
            diagnostics: this.buildDiagnostics(binaryPath, installNodeVersion, runtimeNodeVersion, installNodeArch, runtimeNodeArch, machineArch),
            repairCommand: this.buildRepairCommand(installNodeVersion, runtimeNodeVersion, machineArch, installNodeArch),
            installNodeArch,
            runtimeNodeArch,
            machineArch,
            compatibility: this.inspectCompatibility(binaryPath, match ? match[1] : null, binary.launchMode),
            runtimeSource: binary.runtimeSource,
            launchMode: binary.launchMode,
          });
          return;
        }

        const error = this.summarizeFailure(stderr || stdout || `Codex CLI exited with code ${code}`);
        resolve({
          available: true,
          runnable: false,
          version: null,
          error,
          binaryPath,
          installNodeVersion,
          runtimeNodeVersion,
          diagnostics: this.buildDiagnostics(binaryPath, installNodeVersion, runtimeNodeVersion, installNodeArch, runtimeNodeArch, machineArch),
          repairCommand: this.buildRepairCommand(installNodeVersion, runtimeNodeVersion, machineArch, installNodeArch),
          installNodeArch,
          runtimeNodeArch,
          machineArch,
          compatibility: null,
          runtimeSource: binary.runtimeSource,
          launchMode: binary.launchMode,
        });
      });

      versionProcess.on('error', (error) => {
        resolve({
          available: true,
          runnable: false,
          version: null,
          error: error.message,
          binaryPath,
          installNodeVersion,
          runtimeNodeVersion,
          diagnostics: this.buildDiagnostics(binaryPath, installNodeVersion, runtimeNodeVersion, installNodeArch, runtimeNodeArch, machineArch),
          repairCommand: this.buildRepairCommand(installNodeVersion, runtimeNodeVersion, machineArch, installNodeArch),
          installNodeArch,
          runtimeNodeArch,
          machineArch,
          compatibility: null,
          runtimeSource: binary.runtimeSource,
          launchMode: binary.launchMode,
        });
      });
    });
  }

  /**
   * Get codex version
   */
  async getVersion(): Promise<string | null> {
    const status = await this.getBinaryStatus();
    return status.runnable ? status.version : null;
  }

  /**
   * Check if app-server is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Ensure app-server is running (lazy spawn)
   */
  async ensureRunning(): Promise<void> {
    // Check feature flag first
    if (!isEnabled('codex-integration')) {
      throw new Error('Codex integration is not enabled. Enable it in Settings > Features.');
    }

    if (this.isRunning()) {
      return; // Already running
    }

    await this.spawn();
  }

  /**
   * Spawn `codex app-server` process
   */
  private async spawn(): Promise<void> {
    if (this.process) {
      throw new Error('Codex app-server is already running');
    }

    // Check if binary is installed
    const status = await this.getBinaryStatus();
    if (!status.available) {
      throw new Error(
        'Codex runtime is not available. Bundle a Codex runtime with Ritemark or install Codex manually.'
      );
    }
    if (!status.runnable) {
      throw new Error(status.error || 'Codex CLI is installed but could not be started.');
    }

    return new Promise((resolve, reject) => {
      this.isShuttingDown = false;

      this.process = this.spawnResolvedBinary(status.binaryPath!, this.buildAppServerArgs(status.launchMode), {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Set up stdout handler
      if (this.process.stdout) {
        this.process.stdout.on('data', (data) => {
          const text = data.toString();
          this.config.onStdout?.(text);
        });
      }

      // Set up stderr handler
      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          const text = data.toString();
          this.config.onStderr?.(text);
        });
      }

      // Handle process exit
      this.process.on('exit', (code) => {
        if (!this.isShuttingDown && !this.config.onExit) {
          console.error(`Codex app-server exited unexpectedly with code ${code}`);
        }
        this.process = null;
        this.config.onExit?.(code);
      });

      // Handle spawn errors
      this.process.on('error', (error) => {
        console.error('Failed to spawn codex app-server:', error);
        this.process = null;
        reject(error);
      });

      // Process spawned successfully
      // Give it a moment to initialize before resolving
      setTimeout(() => resolve(), 100);
    });
  }

  /**
   * Send JSON-RPC message to app-server stdin
   */
  send(message: string): void {
    if (!this.process || !this.process.stdin) {
      throw new Error('Codex app-server is not running');
    }

    this.process.stdin.write(message + '\n');
  }

  /**
   * Gracefully shutdown app-server
   */
  dispose(): void {
    if (this.process && !this.process.killed) {
      this.isShuttingDown = true;
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  private extractNvmNodeVersion(binaryPath: string): string | null {
    const unixMatch = binaryPath.match(/\/\.nvm\/versions\/node\/v([^/]+)\//);
    if (unixMatch) {
      return unixMatch[1];
    }

    const windowsMatch = binaryPath.match(/[\\/]nvm[\\/]v([^\\/]+)[\\/]/i);
    return windowsMatch ? windowsMatch[1] : null;
  }

  private buildDiagnostics(
    binaryPath: string | null,
    installNodeVersion: string | null,
    runtimeNodeVersion: string,
    installNodeArch: string | null,
    runtimeNodeArch: string,
    machineArch: string
  ): string[] {
    const diagnostics: string[] = [];

    if (binaryPath) {
      diagnostics.push(`Binary: ${binaryPath}`);
      if (isBundledAgentRuntimePath(binaryPath)) {
        diagnostics.push('Runtime source: bundled with Ritemark');
      }
    }

    if (installNodeVersion) {
      diagnostics.push(`Global install is from Node v${installNodeVersion}`);
    }

    if (installNodeArch) {
      diagnostics.push(`Global install Node architecture: ${installNodeArch}`);
    }

    diagnostics.push(`Ritemark is running with Node v${runtimeNodeVersion}`);
    diagnostics.push(`Ritemark runtime Node architecture: ${runtimeNodeArch}`);

    if (machineArch !== runtimeNodeArch) {
      diagnostics.push(`Machine architecture is ${machineArch}, but Ritemark runtime Node is ${runtimeNodeArch}`);
    }

    if (installNodeVersion && installNodeVersion !== runtimeNodeVersion) {
      diagnostics.push(`Node mismatch detected: CLI install is under v${installNodeVersion}, but Ritemark is running v${runtimeNodeVersion}`);
    }

    if (machineArch === 'arm64' && installNodeArch === 'x86_64') {
      diagnostics.push('Rosetta/x64 Node install detected. This can install the wrong Codex binary on Apple Silicon.');
    }

    return diagnostics;
  }

  private buildRepairCommand(installNodeVersion: string | null, runtimeNodeVersion: string, machineArch: string, installNodeArch?: string | null): string {
    return CodexManager.buildRepairCommandFor({
      platform: process.platform,
      installNodeVersion,
      installNodeArch: installNodeArch ?? null,
      runtimeNodeVersion,
      machineArch,
    });
  }

  /**
   * Build the repair command for a given environment. Pure function, testable.
   *
   * The platform tag must match the Node arch that codex will run under,
   * NOT the machine arch. Example: Apple Silicon with x64 Node via Rosetta
   * needs @darwin-x64, not @darwin-arm64.
   */
  /**
   * Build the repair command for a given environment. Pure function, testable.
   *
   * Key insight: Ritemark's Electron runs its own Node (the runtime). Codex
   * native modules must match that runtime's arch, NOT the install Node's arch.
   * Example: Apple Silicon + x64 Node v23 via Rosetta → codex was installed
   * under v23/x64, but Ritemark needs arm64 native deps. The repair must:
   * 1. Uninstall from the install Node (v23) to remove the broken binary
   * 2. Install under the runtime Node (v22/arm64) with matching native deps
   */
  static buildRepairCommandFor(env: {
    platform: string;
    installNodeVersion: string | null;
    installNodeArch: string | null;
    runtimeNodeVersion: string;
    machineArch: string;
  }): string {
    // Use plain @openai/codex — npm resolves the correct platform-specific
    // native addon automatically. Platform-specific tags like @darwin-arm64
    // only install the addon without the CLI wrapper.
    const pkg = '@openai/codex';

    if (env.platform === 'win32') {
      return `npm install -g ${pkg}`;
    }

    const uninstallPkgs = '@openai/codex @openai/codex-darwin-x64 @openai/codex-darwin-arm64';
    const runtimeArch = env.machineArch === 'arm64' ? 'arm64' : 'x64';

    // If install Node differs from runtime Node, uninstall from install Node first,
    // then install under runtime Node so native deps match the runtime arch.
    const installAndRuntimeDiffer = env.installNodeVersion
      && env.installNodeVersion !== env.runtimeNodeVersion;

    if (env.platform === 'darwin' && runtimeArch === 'arm64') {
      if (installAndRuntimeDiffer) {
        return `arch -arm64 /bin/bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use ${env.installNodeVersion} && npm uninstall -g ${uninstallPkgs}; nvm use ${env.runtimeNodeVersion} && npm install -g ${pkg}'`;
      }
      return `arch -arm64 /bin/bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use ${env.runtimeNodeVersion} && npm uninstall -g ${uninstallPkgs}; npm install -g ${pkg}'`;
    }

    if (env.installNodeVersion) {
      if (installAndRuntimeDiffer) {
        return `source "$HOME/.nvm/nvm.sh" && nvm use ${env.installNodeVersion} && npm uninstall -g ${uninstallPkgs}; nvm use ${env.runtimeNodeVersion} && npm install -g ${pkg}`;
      }
      return `source "$HOME/.nvm/nvm.sh" && nvm use ${env.installNodeVersion} && npm uninstall -g ${uninstallPkgs}; npm install -g ${pkg}`;
    }

    return `npm install -g ${pkg}`;
  }

  private getMachineArch(): string {
    if (process.platform !== 'darwin') {
      return process.arch;
    }

    try {
      const result = spawnSync('/usr/bin/uname', ['-m'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return result.status === 0 && result.stdout.trim()
        ? result.stdout.trim()
        : process.arch;
    } catch {
      return process.arch;
    }
  }

  private getBinaryArchitecture(binaryPath: string): string | null {
    if (process.platform !== 'darwin') {
      return null;
    }

    // The codex binary is a text script (#!/usr/bin/env node), so `file` on it
    // won't reveal architecture. Instead, check the Node binary that will
    // actually run it — derive from the nvm path.
    const nvmMatch = binaryPath.match(/(.+\/\.nvm\/versions\/node\/v[^/]+\/bin\/)codex$/);
    const nodeBinary = nvmMatch ? `${nvmMatch[1]}node` : null;
    const target = nodeBinary ?? binaryPath;

    try {
      const result = spawnSync('/usr/bin/file', [target], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const output = result.stdout ?? '';

      return output.includes('x86_64')
        ? 'x86_64'
        : output.includes('arm64')
          ? 'arm64'
          : null;
    } catch {
      return null;
    }
  }

  private summarizeFailure(output: string): string {
    const trimmed = output.trim();
    const errorMatch = trimmed.match(/Error:\s*([^\n]+)/);
    if (errorMatch) {
      return errorMatch[1].trim();
    }

    const firstLine = trimmed.split(/\r?\n/).map(line => line.trim()).find(Boolean);
    return firstLine ?? 'Codex CLI failed to start.';
  }

  private inspectCompatibility(binaryPath: string, version: string | null, launchMode: CodexLaunchMode): CodexCompatibilityStatus {
    const cacheKey = `${binaryPath}:${version ?? 'unknown'}`;
    const cached = CodexManager.compatibilityCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Optimistic fail-safe: when the protocol probe cannot run with either argv shape
    // (legacy `codex app-server generate-ts` vs new `codex-app-server generate-ts`),
    // we assume the binary is a modern Codex and keep capability flags ON. The
    // alternative — all flags off — surfaces a "limited features" banner for healthy
    // binaries whose launch-mode was guessed wrong from basename heuristics (issue #60).
    // Banner now fires only on positive evidence of incompatibility (generate-ts
    // succeeded but a specific method was missing), never on probe failure.
    const optimisticCapabilities: CodexCapabilityFlags = {
      approvals: true,
      requestUserInput: true,
      planUpdates: true,
    };
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-codex-protocol-'));

    try {
      // Try the argv form matching the detected launchMode first, then fall back to
      // the other form. inferCodexRuntimeLaunchMode() classifies on basename, which
      // is wrong for a system-installed Rust `codex` that is actually the new
      // app-server shape. Trying both shapes detects the real binary at runtime.
      const probeOutcome = this.runGenerateTypesProbe(binaryPath, launchMode, tempDir);

      if (!probeOutcome.success) {
        const status = this.buildCompatibilityStatus(optimisticCapabilities, []);
        CodexManager.compatibilityCache.set(cacheKey, status);
        return status;
      }

      const requestText = this.readGeneratedProtocolFile(tempDir, 'ServerRequest.ts');
      const notificationText = this.readGeneratedProtocolFile(tempDir, 'ServerNotification.ts');
      const capabilities: CodexCapabilityFlags = {
        approvals: requestText.includes('item/commandExecution/requestApproval')
          && requestText.includes('item/fileChange/requestApproval'),
        requestUserInput: requestText.includes('item/tool/requestUserInput'),
        planUpdates: notificationText.includes('turn/plan/updated')
          || notificationText.includes('item/plan/delta'),
      };

      const limitations: string[] = [];
      if (!capabilities.approvals) {
        limitations.push('Approval requests were not detected in the current Codex app-server protocol.');
      }
      if (!capabilities.requestUserInput) {
        limitations.push('Interactive question prompts were not detected in the current Codex app-server protocol.');
      }
      if (!capabilities.planUpdates) {
        limitations.push('Structured plan update notifications were not detected in the current Codex app-server protocol.');
      }

      const status = this.buildCompatibilityStatus(capabilities, limitations);
      CodexManager.compatibilityCache.set(cacheKey, status);
      return status;
    } catch {
      const status = this.buildCompatibilityStatus(optimisticCapabilities, []);
      CodexManager.compatibilityCache.set(cacheKey, status);
      return status;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private runGenerateTypesProbe(
    binaryPath: string,
    launchMode: CodexLaunchMode,
    tempDir: string,
  ): { success: boolean } {
    const tried = new Set<string>();
    const orderedModes: CodexLaunchMode[] = [launchMode, launchMode === 'codex-app-server' ? 'codex-cli' : 'codex-app-server'];

    for (const mode of orderedModes) {
      const args = this.buildGenerateTypesArgs(mode, tempDir);
      const key = args.join(' ');
      if (tried.has(key)) continue;
      tried.add(key);

      const result = this.spawnResolvedBinarySync(binaryPath, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 8000,
      });

      if (result.status === 0) {
        return { success: true };
      }
    }

    return { success: false };
  }

  private buildCompatibilityStatus(
    capabilities: CodexCapabilityFlags,
    limitations: string[]
  ): CodexCompatibilityStatus {
    if (limitations.length > 0) {
      return {
        state: 'limited',
        summary: 'Codex is runnable, but one or more lifecycle capabilities Ritemark expects were not detected.',
        capabilities,
        limitations,
      };
    }

    return {
      state: 'compatible',
      summary: 'Codex lifecycle capabilities detected.',
      capabilities,
      limitations: [],
    };
  }

  private readGeneratedProtocolFile(outputDir: string, fileName: string): string {
    const directPath = path.join(outputDir, fileName);
    if (fs.existsSync(directPath)) {
      return fs.readFileSync(directPath, 'utf8');
    }

    const nestedPath = path.join(outputDir, 'openai', 'codex', fileName);
    if (fs.existsSync(nestedPath)) {
      return fs.readFileSync(nestedPath, 'utf8');
    }

    return '';
  }

  private buildAppServerArgs(launchMode: CodexLaunchMode | null): string[] {
    return launchMode === 'codex-app-server' ? [] : ['app-server'];
  }

  private buildGenerateTypesArgs(launchMode: CodexLaunchMode, outputDir: string): string[] {
    return launchMode === 'codex-app-server'
      ? ['generate-ts', '--out', outputDir]
      : ['app-server', 'generate-ts', '--out', outputDir];
  }

  /**
   * Spawn a resolved binary with the correct PATH.
   * For nvm-installed binaries, prepends the nvm bin dir to PATH so that
   * `#!/usr/bin/env node` resolves to the same Node version the binary
   * was installed under (not the system default which may differ in arch).
   */
  private spawnResolvedBinary(
    binaryPath: string,
    args: string[],
    options: Parameters<typeof spawn>[2] = {}
  ): ChildProcess {
    const isWindowsScript = process.platform === 'win32' && /\.(cmd|bat)$/i.test(binaryPath);
    const env = this.buildSpawnEnv(binaryPath, options.env);
    return spawn(binaryPath, args, {
      ...options,
      env,
      shell: options.shell ?? isWindowsScript,
    });
  }

  private spawnResolvedBinarySync(
    binaryPath: string,
    args: string[],
    options: Parameters<typeof spawnSync>[2] = {}
  ): ReturnType<typeof spawnSync> {
    const isWindowsScript = process.platform === 'win32' && /\.(cmd|bat)$/i.test(binaryPath);
    const env = this.buildSpawnEnv(binaryPath, options.env as Record<string, string> | undefined);
    return spawnSync(binaryPath, args, {
      ...options,
      env,
      shell: options.shell ?? isWindowsScript,
    });
  }

  /**
   * Build environment for spawning codex binary.
   * If binaryPath is under ~/.nvm, prepend that Node version's bin dir
   * to PATH so `#!/usr/bin/env node` finds the matching Node.
   */
  private buildSpawnEnv(
    binaryPath: string,
    baseEnv?: Record<string, string> | NodeJS.ProcessEnv | undefined
  ): Record<string, string> | NodeJS.ProcessEnv {
    const nvmBinMatch = binaryPath.match(/^(.+\/\.nvm\/versions\/node\/v[^/]+\/bin)\//);
    if (!nvmBinMatch) return baseEnv ?? process.env;

    const nvmBinDir = nvmBinMatch[1];
    const env = { ...(baseEnv ?? process.env) };
    env.PATH = `${nvmBinDir}:${env.PATH ?? ''}`;
    return env;
  }
}
