/**
 * Claude Code CLI Detection Service
 *
 * Checks whether the Claude Code CLI is installed and authenticated.
 * Follows the child_process patterns used in whisperCpp.ts.
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getCurrentPlatform } from '../utils/platform';
import type { SetupStatus } from './types';

let cachedStatus: SetupStatus | null = null;

/**
 * Clear the cached setup status (call after install/login).
 */
export function clearSetupCache(): void {
  cachedStatus = null;
}

/**
 * Check if the Claude Code CLI is installed.
 * First tries `which`/`where`, then checks known install locations.
 */
export function checkClaudeInstalled(): { installed: boolean; version?: string; path?: string } {
  const platform = getCurrentPlatform();

  // Try PATH lookup first
  const whichCmd = platform === 'win32' ? 'where' : 'which';
  const whichResult = spawnSync(whichCmd, ['claude'], {
    timeout: 5000,
    encoding: 'utf-8',
    shell: true,
  });

  if (whichResult.status === 0 && whichResult.stdout?.trim()) {
    const version = getClaudeVersion();
    return { installed: true, version, path: whichResult.stdout.trim() };
  }

  // Check known install locations
  const home = homedir();
  const knownPaths = platform === 'win32'
    ? [
        join(process.env.LOCALAPPDATA || '', 'Programs', 'Claude', 'claude.exe'),
      ]
    : [
        join(home, '.claude', 'local', 'bin', 'claude'),
        join(home, '.local', 'bin', 'claude'),
        '/usr/local/bin/claude',
      ];

  for (const p of knownPaths) {
    if (p && existsSync(p)) {
      const version = getClaudeVersion(p);
      return { installed: true, version, path: p };
    }
  }

  return { installed: false };
}

/**
 * Get the Claude CLI version string.
 */
function getClaudeVersion(binaryPath?: string): string | undefined {
  try {
    const result = spawnSync(binaryPath || 'claude', ['--version'], {
      timeout: 5000,
      encoding: 'utf-8',
      shell: true,
    });
    if (result.status === 0 && result.stdout?.trim()) {
      return result.stdout.trim();
    }
  } catch {
    // Ignore — version is optional
  }
  return undefined;
}

/**
 * Check if the Claude Code CLI is authenticated.
 *
 * Claude Code stores OAuth credentials in the OS keychain:
 * - macOS: macOS Keychain (service: "Claude Code-credentials")
 * - Windows: Windows Credential Manager
 * - Linux: system keyring (libsecret)
 *
 * We also check for the ANTHROPIC_API_KEY environment variable,
 * which is an alternative auth method supported by the CLI.
 */
/**
 * Check if an Anthropic API key is available from SecretStorage.
 * Called externally (from UnifiedViewProvider which has context access).
 */
export function setAnthropicKeyAvailable(hasKey: boolean): void {
  _hasAnthropicKey = hasKey;
}

let _hasAnthropicKey = false;

export function checkClaudeAuth(): boolean {
  // Check ANTHROPIC_API_KEY env var first (fast path)
  if (process.env.ANTHROPIC_API_KEY) {
    return true;
  }

  // Check if Anthropic key was provided via SecretStorage
  if (_hasAnthropicKey) {
    return true;
  }

  const platform = getCurrentPlatform();

  if (platform === 'darwin') {
    return checkKeychainAuth();
  } else if (platform === 'win32') {
    return checkWindowsAuth();
  } else {
    // Linux: try a quick CLI test as fallback
    return checkAuthViaCliTest();
  }
}

/**
 * macOS: Check Keychain for "Claude Code-credentials" service.
 */
function checkKeychainAuth(): boolean {
  try {
    const result = spawnSync('security', ['find-generic-password', '-s', 'Claude Code-credentials'], {
      timeout: 3000,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Windows: Check Credential Manager for Claude credentials.
 */
function checkWindowsAuth(): boolean {
  try {
    const result = spawnSync('cmdkey', ['/list:Claude*'], {
      timeout: 3000,
      encoding: 'utf-8',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // cmdkey returns 0 if any matching credentials found
    return result.status === 0 && (result.stdout?.includes('Claude') ?? false);
  } catch {
    return false;
  }
}

/**
 * Linux/fallback: Quick CLI test with minimal prompt.
 * Uses `claude -p "ok" --max-turns 1` — if it returns, auth works.
 */
function checkAuthViaCliTest(): boolean {
  try {
    const result = spawnSync('claude', ['-p', 'respond with: OK', '--max-turns', '1'], {
      timeout: 15000,
      encoding: 'utf-8',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Check if the user has native CLI OAuth credentials (keychain/credential store).
 * This is separate from having an API key — CLI OAuth uses Claude.ai billing,
 * while API keys use Anthropic API billing.
 */
export function hasCliOAuth(): boolean {
  const platform = getCurrentPlatform();
  if (platform === 'darwin') return checkKeychainAuth();
  if (platform === 'win32') return checkWindowsAuth();
  return false; // Linux can't distinguish — fall through to API key
}

/**
 * Get the full setup status (CLI + auth). Results are cached until cleared.
 */
export async function getSetupStatus(): Promise<SetupStatus> {
  if (cachedStatus) {
    return cachedStatus;
  }

  const cli = checkClaudeInstalled();

  const status: SetupStatus = {
    cliInstalled: cli.installed,
    cliVersion: cli.version,
    authenticated: cli.installed ? checkClaudeAuth() : false,
  };

  cachedStatus = status;
  return status;
}
