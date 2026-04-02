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
}

export interface CodexCapabilityFlags {
  approvals: boolean;
  requestUserInput: boolean;
  planUpdates: boolean;
}

export interface CodexCompatibilityStatus {
  state: 'compatible' | 'limited' | 'untested';
  summary: string;
  auditedRange: string;
  versionInAuditedRange: boolean;
  capabilities: CodexCapabilityFlags;
  limitations: string[];
}

export class CodexManager {
  private static readonly MIN_AUDITED_VERSION = '0.111.0';
  private static readonly MAX_AUDITED_VERSION_EXCLUSIVE = '0.119.0';
  private static readonly AUDITED_RANGE_LABEL = '0.111.x - 0.118.x';
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
    const binaryPath = await this.findBinaryPath();
    return binaryPath !== null;
  }

  /**
   * Resolve the codex executable path from the current environment.
   *
   * On Windows, `where codex` returns both an extensionless Unix shell script
   * and a .cmd wrapper. The extensionless file cannot be spawned by Node.js
   * (it's a bash shim), so we must prefer the .cmd or .exe variant.
   */
  async findBinaryPath(): Promise<string | null> {
    // First try `which`/`where` for the active PATH
    const fromPath = await this.findBinaryInPath();
    if (fromPath) return fromPath;

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
    const binaryPath = await this.findBinaryPath();
    const runtimeNodeVersion = process.version.replace(/^v/, '');
    const runtimeNodeArch = process.arch;
    const machineArch = this.getMachineArch();
    const installNodeVersion = binaryPath ? this.extractNvmNodeVersion(binaryPath) : null;
    const installNodeArch = binaryPath ? this.getBinaryArchitecture(binaryPath) : null;

    if (!binaryPath) {
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
            compatibility: this.inspectCompatibility(binaryPath, match ? match[1] : null),
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
        'Codex CLI is not installed. Install it with: npm install -g @openai/codex or brew install --cask codex'
      );
    }
    if (!status.runnable) {
      throw new Error(status.error || 'Codex CLI is installed but could not be started.');
    }

    return new Promise((resolve, reject) => {
      this.isShuttingDown = false;

      this.process = this.spawnResolvedBinary(status.binaryPath!, ['app-server'], {
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

  private inspectCompatibility(binaryPath: string, version: string | null): CodexCompatibilityStatus {
    const cacheKey = `${binaryPath}:${version ?? 'unknown'}`;
    const cached = CodexManager.compatibilityCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const defaultCapabilities: CodexCapabilityFlags = {
      approvals: false,
      requestUserInput: false,
      planUpdates: false,
    };
    const versionInAuditedRange = version
      ? this.isVersionInAuditedRange(version)
      : false;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-codex-protocol-'));

    try {
      const result = this.spawnResolvedBinarySync(binaryPath, ['app-server', 'generate-ts', '--out', tempDir], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 8000,
      });

      if (result.status !== 0) {
        const failure = this.summarizeFailure(String(result.stderr || result.stdout || 'Codex protocol probe failed.'));
        const status = this.buildCompatibilityStatus(
          version,
          versionInAuditedRange,
          defaultCapabilities,
          [`Protocol probe failed: ${failure}`]
        );
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

      const status = this.buildCompatibilityStatus(version, versionInAuditedRange, capabilities, limitations);
      CodexManager.compatibilityCache.set(cacheKey, status);
      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = this.buildCompatibilityStatus(
        version,
        versionInAuditedRange,
        defaultCapabilities,
        [`Protocol probe failed: ${message}`]
      );
      CodexManager.compatibilityCache.set(cacheKey, status);
      return status;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private buildCompatibilityStatus(
    version: string | null,
    versionInAuditedRange: boolean,
    capabilities: CodexCapabilityFlags,
    limitations: string[]
  ): CodexCompatibilityStatus {
    if (!versionInAuditedRange) {
      return {
        state: 'untested',
        summary: version
          ? `Codex ${version} is outside Ritemark's audited range ${CodexManager.AUDITED_RANGE_LABEL}. Ritemark will only enable capabilities it can detect at runtime.`
          : `Codex version could not be detected. Ritemark will only enable capabilities it can detect at runtime.`,
        auditedRange: CodexManager.AUDITED_RANGE_LABEL,
        versionInAuditedRange,
        capabilities,
        limitations,
      };
    }

    if (limitations.length > 0) {
      return {
        state: 'limited',
        summary: `Codex is runnable, but this version is missing one or more lifecycle capabilities that Ritemark expects in the audited range ${CodexManager.AUDITED_RANGE_LABEL}.`,
        auditedRange: CodexManager.AUDITED_RANGE_LABEL,
        versionInAuditedRange,
        capabilities,
        limitations,
      };
    }

    return {
      state: 'compatible',
      summary: `Codex matches the audited lifecycle capability set for ${CodexManager.AUDITED_RANGE_LABEL}.`,
      auditedRange: CodexManager.AUDITED_RANGE_LABEL,
      versionInAuditedRange,
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

  private isVersionInAuditedRange(version: string): boolean {
    return this.compareVersions(version, CodexManager.MIN_AUDITED_VERSION) >= 0
      && this.compareVersions(version, CodexManager.MAX_AUDITED_VERSION_EXCLUSIVE) < 0;
  }

  private compareVersions(left: string, right: string): number {
    const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
      const leftValue = leftParts[index] ?? 0;
      const rightValue = rightParts[index] ?? 0;
      if (leftValue !== rightValue) {
        return leftValue - rightValue;
      }
    }

    return 0;
  }

  private spawnResolvedBinary(
    binaryPath: string,
    args: string[],
    options: Parameters<typeof spawn>[2] = {}
  ): ChildProcess {
    const isWindowsScript = process.platform === 'win32' && /\.(cmd|bat)$/i.test(binaryPath);
    return spawn(binaryPath, args, {
      ...options,
      shell: options.shell ?? isWindowsScript,
    });
  }

  private spawnResolvedBinarySync(
    binaryPath: string,
    args: string[],
    options: Parameters<typeof spawnSync>[2] = {}
  ): ReturnType<typeof spawnSync> {
    const isWindowsScript = process.platform === 'win32' && /\.(cmd|bat)$/i.test(binaryPath);
    return spawnSync(binaryPath, args, {
      ...options,
      shell: options.shell ?? isWindowsScript,
    });
  }
}
