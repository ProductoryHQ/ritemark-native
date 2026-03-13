/**
 * Claude installer and login helpers.
 *
 * The install flow remains vendor-managed, but the result handling is
 * explicit so the UI can distinguish install, reload, and repair states.
 */

import { spawn, spawnSync } from 'child_process';
import { getCurrentPlatform } from '../utils/platform';
import {
  clearClaudePendingReload,
  clearSetupCache,
  getSetupStatus,
  setClaudePendingReload,
} from './setup';
import type { ClaudeInstallResult, InstallProgress } from './types';

const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;

function getVSCode(): typeof import('vscode') {
  return require('vscode') as typeof import('vscode');
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
