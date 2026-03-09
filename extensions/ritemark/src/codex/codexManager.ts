/**
 * Codex Binary Manager
 *
 * Manages the lifecycle of the `codex app-server` binary:
 * - Detection (check if codex is in PATH)
 * - Version verification
 * - Process spawning and stdio management
 * - Graceful shutdown
 */

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
}

export class CodexManager {
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
   * Resolve the codex executable path from PATH.
   */
  async findBinaryPath(): Promise<string | null> {
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

        const firstMatch = stdout
          .split(/\r?\n/)
          .map(line => line.trim())
          .find(Boolean);

        resolve(firstMatch ?? null);
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
        error: 'Codex CLI not found in PATH.',
        binaryPath: null,
        installNodeVersion: null,
        runtimeNodeVersion,
        diagnostics: [],
        repairCommand: this.buildRepairCommand(null, runtimeNodeVersion, machineArch),
        installNodeArch: null,
        runtimeNodeArch,
        machineArch,
      };
    }

    return new Promise((resolve) => {
      const versionProcess = spawn('codex', ['--version']);
      let stdout = '';
      let stderr = '';

      versionProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      versionProcess.stderr.on('data', (data) => {
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
            repairCommand: this.buildRepairCommand(installNodeVersion, runtimeNodeVersion, machineArch),
            installNodeArch,
            runtimeNodeArch,
            machineArch,
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
          repairCommand: this.buildRepairCommand(installNodeVersion, runtimeNodeVersion, machineArch),
          installNodeArch,
          runtimeNodeArch,
          machineArch,
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
          repairCommand: this.buildRepairCommand(installNodeVersion, runtimeNodeVersion, machineArch),
          installNodeArch,
          runtimeNodeArch,
          machineArch,
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

      this.process = spawn('codex', ['app-server'], {
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

  private buildRepairCommand(installNodeVersion: string | null, runtimeNodeVersion: string, machineArch: string): string {
    if (process.platform === 'win32') {
      return 'npm install -g @openai/codex@latest';
    }

    if (process.platform === 'darwin' && machineArch === 'arm64') {
      return `arch -arm64 /bin/bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use ${runtimeNodeVersion} && npm uninstall -g @openai/codex @openai/codex-darwin-x64 @openai/codex-darwin-arm64; npm install -g @openai/codex@latest'`;
    }

    if (installNodeVersion) {
      return `source "$HOME/.nvm/nvm.sh" && nvm use ${installNodeVersion} && npm uninstall -g @openai/codex @openai/codex-darwin-x64 @openai/codex-darwin-arm64; npm install -g @openai/codex@latest`;
    }

    return 'npm install -g @openai/codex@latest';
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

    try {
      const result = spawnSync('/usr/bin/file', [binaryPath], {
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
}
