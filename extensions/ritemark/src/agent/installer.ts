/**
 * Claude Code CLI Installer Service
 *
 * Handles installation and authentication of the Claude Code CLI.
 * Uses Anthropic's native installers (no Node.js dependency).
 */

import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { getCurrentPlatform } from '../utils/platform';
import { clearSetupCache, checkClaudeInstalled } from './setup';
import type { InstallProgress } from './types';

const INSTALL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Install the Claude Code CLI using Anthropic's native installer.
 */
export function installClaude(
  onProgress: (progress: InstallProgress) => void
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const platform = getCurrentPlatform();

    onProgress({ stage: 'downloading', message: 'Downloading Claude Code...' });

    let proc;
    if (platform === 'win32') {
      proc = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command', 'irm https://claude.ai/install.ps1 | iex',
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
    } else {
      proc = spawn('bash', [
        '-c', 'curl -fsSL https://claude.ai/install.sh | bash',
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
    }

    const timeout = setTimeout(() => {
      proc.kill();
      onProgress({ stage: 'error', message: 'Installation timed out', error: 'Timed out after 5 minutes' });
      resolve({ success: false, error: 'Installation timed out after 5 minutes' });
    }, INSTALL_TIMEOUT_MS);

    let stderrOutput = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      if (text.toLowerCase().includes('install')) {
        onProgress({ stage: 'installing', message: 'Installing Claude Code...' });
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderrOutput += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        onProgress({ stage: 'verifying', message: 'Verifying installation...' });

        // Clear cache and re-check with known paths
        clearSetupCache();
        const check = checkClaudeInstalled();

        if (check.installed) {
          onProgress({ stage: 'done', message: 'Claude Code installed successfully' });
          resolve({ success: true });
        } else {
          // Installer exited 0 but binary not found — may need shell restart
          onProgress({ stage: 'done', message: 'Claude Code installed. You may need to restart the app.' });
          resolve({ success: true });
        }
      } else {
        const errorMsg = stderrOutput.trim() || `Installation failed (exit code ${code})`;
        onProgress({ stage: 'error', message: 'Installation failed', error: errorMsg });
        resolve({ success: false, error: errorMsg });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      onProgress({ stage: 'error', message: 'Installation failed', error: err.message });
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Open a VS Code terminal with Claude Code for interactive login.
 *
 * Claude Code prompts for login on first launch — the user authenticates
 * via their browser. Once done, credentials are stored in the OS keychain.
 * The user can then close the terminal and return to the setup wizard.
 */
export function openClaudeLoginTerminal(): void {
  const terminal = vscode.window.createTerminal({
    name: 'Claude Code Login',
    shellPath: getCurrentPlatform() === 'win32' ? 'powershell.exe' : undefined,
  });
  terminal.show();
  terminal.sendText('claude');
}

/**
 * Open Ritemark Settings page where users can add their Anthropic API key.
 */
export function openAnthropicKeySettings(): void {
  vscode.commands.executeCommand('ritemark.aiSettings');
}
