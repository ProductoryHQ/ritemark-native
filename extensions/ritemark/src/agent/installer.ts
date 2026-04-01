/**
 * Claude installer and login helpers.
 *
 * The install flow remains vendor-managed, but the result handling is
 * explicit so the UI can distinguish install, reload, and repair states.
 */

import { spawn, spawnSync } from 'child_process';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getCurrentPlatform } from '../utils/platform';
import {
  clearClaudePendingReload,
  clearSetupCache,
  getSetupStatus,
  setClaudePendingReload,
} from './setup';
import type { ClaudeInstallResult, InstallProgress } from './types';

const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;
let installInProgress = false;

function getVSCode(): typeof import('vscode') {
  return require('vscode') as typeof import('vscode');
}

/**
 * Check if a Claude install or repair is currently in progress.
 */
export function isClaudeInstallInProgress(): boolean {
  return installInProgress;
}

function checkWindowsGitAvailability(): boolean {
  return checkWindowsCommandAvailability('git');
}

function checkWindowsPowerShellAvailability(): boolean {
  return checkWindowsCommandAvailability('powershell.exe');
}

function checkWindowsCommandAvailability(command: string): boolean {
  if (process.platform !== 'win32') {
    return true;
  }

  try {
    const result = spawnSync('where', [command], {
      timeout: 3000,
      encoding: 'utf-8',
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return result.status === 0 && Boolean(result.stdout?.trim());
  } catch {
    return false;
  }
}

/**
 * Check whether any Claude-related processes are running that may lock download files.
 * Returns process names if found, empty array if none.
 */
function detectRunningClaudeProcesses(): string[] {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    const result = spawnSync('powershell.exe', [
      '-NoProfile', '-Command',
      "Get-Process | Where-Object { $_.ProcessName -match '^claude' } | Select-Object -ExpandProperty ProcessName -Unique",
    ], {
      timeout: 5000,
      encoding: 'utf-8',
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.status !== 0 || !result.stdout?.trim()) {
      return [];
    }

    return result.stdout.trim().split(/\r?\n/).map(n => n.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Clear stale download files in ~/.claude/downloads/ to prevent file-lock conflicts.
 */
function clearStaleDownloads(): void {
  try {
    const downloadsDir = join(homedir(), '.claude', 'downloads');
    if (!existsSync(downloadsDir)) {
      return;
    }

    const files = readdirSync(downloadsDir);
    for (const file of files) {
      try {
        unlinkSync(join(downloadsDir, file));
      } catch {
        // File is locked — not critical, install.ps1 will handle or fail visibly
      }
    }
  } catch {
    // Downloads dir doesn't exist or isn't readable — OK
  }
}

export function classifyClaudeInstallResult(input: {
  exitCode: number | null;
  statusAfterInstall: Awaited<ReturnType<typeof getSetupStatus>>;
  stderrOutput: string;
}): ClaudeInstallResult {
  if (input.exitCode !== 0) {
    return {
      success: false,
      outcome: 'install_failed',
      error: input.stderrOutput.trim() || `Installation failed (exit code ${input.exitCode})`,
    };
  }

  if (input.statusAfterInstall.runnable) {
    return {
      success: true,
      outcome: 'installed',
      diagnostics: input.statusAfterInstall.diagnostics,
    };
  }

  if (!input.statusAfterInstall.cliInstalled) {
    return {
      success: true,
      outcome: 'installed_needs_reload',
      diagnostics: ['Claude install completed. Reload Ritemark to pick up the new command path.'],
    };
  }

  return {
    success: false,
    outcome: 'verification_failed',
    error: input.statusAfterInstall.error || 'Claude was installed, but the binary could not be verified.',
    diagnostics: input.statusAfterInstall.diagnostics,
  };
}

export async function installClaude(
  onProgress: (progress: InstallProgress) => void
): Promise<ClaudeInstallResult> {
  if (installInProgress) {
    return {
      success: false,
      outcome: 'install_failed',
      error: 'A Claude install or repair is already in progress. Wait for it to finish.',
    };
  }

  installInProgress = true;

  try {
    return await installClaudeInner(onProgress);
  } finally {
    installInProgress = false;
  }
}

async function installClaudeInner(
  onProgress: (progress: InstallProgress) => void
): Promise<ClaudeInstallResult> {
  return new Promise((resolve) => {
    const platform = getCurrentPlatform();

    if (platform === 'win32' && !checkWindowsGitAvailability()) {
      resolve({
        success: false,
        outcome: 'install_failed',
        error: 'Git for Windows is required before Claude can be installed on Windows 11.',
        diagnostics: ['Install Git for Windows, then try Claude install again.'],
      });
      return;
    }

    if (platform === 'win32' && !checkWindowsPowerShellAvailability()) {
      resolve({
        success: false,
        outcome: 'install_failed',
        error: 'PowerShell is required before Claude can be installed on Windows.',
        diagnostics: ['Install or restore PowerShell, then try Claude install again.'],
      });
      return;
    }

    // On Windows, check for running Claude processes that may lock download files
    if (platform === 'win32') {
      const runningProcesses = detectRunningClaudeProcesses();
      if (runningProcesses.length > 0) {
        onProgress({
          stage: 'installing',
          message: 'Closing running Claude processes before install…',
        });
        // Try to clear stale downloads even if processes are running
        clearStaleDownloads();
      } else {
        clearStaleDownloads();
      }
    }

    onProgress({ stage: 'downloading', message: 'Downloading Claude…' });

    const proc = platform === 'win32'
      ? spawn('powershell.exe', [
          '-NoProfile',
          '-ExecutionPolicy', 'Bypass',
          '-Command', 'irm https://claude.ai/install.ps1 | iex',
        ], { stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('bash', [
          '-c', 'curl -fsSL https://claude.ai/install.sh | bash',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

    const timeout = setTimeout(() => {
      proc.kill();
      onProgress({ stage: 'error', message: 'Install timed out', error: 'Timed out after 5 minutes' });
      resolve({
        success: false,
        outcome: 'install_failed',
        error: 'Installation timed out after 5 minutes',
      });
    }, INSTALL_TIMEOUT_MS);

    let stderrOutput = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      if (text.toLowerCase().includes('install')) {
        onProgress({ stage: 'installing', message: 'Installing Claude…' });
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderrOutput += data.toString();
    });

    proc.on('close', async (code) => {
      clearTimeout(timeout);
      onProgress({ stage: 'verifying', message: 'Verifying Claude…' });

      clearSetupCache();
      const statusAfterInstall = await getSetupStatus({ refresh: true });
      const result = classifyClaudeInstallResult({
        exitCode: code,
        statusAfterInstall,
        stderrOutput,
      });

      if (result.outcome === 'installed') {
        clearClaudePendingReload();
        onProgress({ stage: 'done', message: 'Claude installed successfully' });
      } else if (result.outcome === 'installed_needs_reload') {
        setClaudePendingReload(result.diagnostics || []);
        onProgress({ stage: 'done', message: 'Claude installed. Reload Ritemark to finish setup.' });
      } else {
        onProgress({
          stage: 'error',
          message: result.outcome === 'verification_failed' ? 'Claude verification failed' : 'Claude install failed',
          error: result.error,
        });
      }

      resolve(result);
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      onProgress({ stage: 'error', message: 'Install failed', error: err.message });
      resolve({
        success: false,
        outcome: 'install_failed',
        error: err.message,
      });
    });
  });
}

export function openClaudeLoginTerminal(binaryPath?: string): void {
  const command = binaryPath || 'claude';
  const vscode = getVSCode();
  const terminal = vscode.window.createTerminal({
    name: 'Claude Login',
    shellPath: getCurrentPlatform() === 'win32' ? 'powershell.exe' : undefined,
  });
  terminal.show();
  terminal.sendText(command.includes(' ') ? `"${command}"` : command);
}

export function openAnthropicKeySettings(): void {
  const vscode = getVSCode();
  vscode.commands.executeCommand('ritemark.aiSettings');
}

/**
 * Install Git via winget in the integrated terminal.
 * Falls back to opening browser if winget is not available.
 */
export function installGit(wingetAvailable: boolean): void {
  const vscode = getVSCode();
  if (wingetAvailable) {
    const terminal = vscode.window.createTerminal({
      name: 'Install Git',
      shellPath: 'powershell.exe',
    });
    terminal.show();
    terminal.sendText('winget install Git.Git --accept-package-agreements --accept-source-agreements');
  } else {
    vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/download/win'));
  }
}

/**
 * Install Node.js LTS via winget in the integrated terminal.
 * Falls back to opening browser if winget is not available.
 */
export function installNode(wingetAvailable: boolean): void {
  const vscode = getVSCode();
  if (wingetAvailable) {
    const terminal = vscode.window.createTerminal({
      name: 'Install Node.js',
      shellPath: 'powershell.exe',
    });
    terminal.show();
    terminal.sendText('winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements');
  } else {
    vscode.env.openExternal(vscode.Uri.parse('https://nodejs.org/en/download'));
  }
}

/**
 * Install Codex CLI via npm in the integrated terminal.
 * For fresh installs, uses plain `@openai/codex` and lets npm resolve the
 * correct platform package based on the user's default Node arch.
 * Requires Node.js to be already installed.
 */
export function installCodexCli(): void {
  const vscode = getVSCode();
  const platform = getCurrentPlatform();

  const terminal = vscode.window.createTerminal({
    name: 'Install Codex',
    shellPath: platform === 'win32' ? 'powershell.exe' : undefined,
  });
  terminal.show();
  terminal.sendText('npm install -g @openai/codex');
}

export async function logoutClaude(binaryPath?: string): Promise<void> {
  const command = binaryPath || 'claude';
  const platform = getCurrentPlatform();

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(command, ['auth', 'logout'], {
      shell: platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderrOutput = '';
    proc.stderr?.on('data', (data: Buffer) => {
      stderrOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderrOutput.trim() || `Claude logout failed (exit code ${code})`));
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}
