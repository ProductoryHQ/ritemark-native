/**
 * Claude bootstrap detection and auth state.
 *
 * Supported platforms in product scope:
 * - macOS (arm64, x64)
 * - Windows 11
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getCurrentPlatform } from '../utils/platform';
import type {
  ClaudeAuthMethod,
  ClaudeRepairAction,
  ClaudeSetupState,
  SetupStatus,
} from './types';

let cachedStatus: SetupStatus | null = null;
let hasAnthropicKeyInSecrets = false;
let claudeLoginInProgress = false;
let claudePendingReload = false;
let claudePendingReloadDiagnostics: string[] = [];

type SupportedPlatform = 'darwin' | 'win32';

interface ClaudeBinaryInspection {
  installed: boolean;
  runnable: boolean;
  path?: string;
  version?: string;
  error?: string;
  diagnostics: string[];
}

interface ClaudeStatusInput {
  binary: ClaudeBinaryInspection;
  authMethod: ClaudeAuthMethod;
  loginInProgress: boolean;
  pendingReload: boolean;
  pendingReloadDiagnostics: string[];
}

function isSupportedPlatform(platform: NodeJS.Platform): platform is SupportedPlatform {
  return platform === 'darwin' || platform === 'win32';
}

function getSpawnCommand(binaryPath: string): { command: string; args: string[]; shell: boolean } {
  if (process.platform === 'win32' && binaryPath.toLowerCase().endsWith('.cmd')) {
    return { command: binaryPath, args: [], shell: true };
  }
  return { command: binaryPath, args: [], shell: false };
}

function runBinary(binaryPath: string, args: string[], timeout: number) {
  const launch = getSpawnCommand(binaryPath);
  return spawnSync(launch.command, [...launch.args, ...args], {
    timeout,
    encoding: 'utf-8',
    shell: launch.shell,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function checkCommandAvailable(command: string): boolean {
  const platform = process.platform;
  const lookup = platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(lookup, [command], {
    timeout: 3000,
    encoding: 'utf-8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0 && Boolean(result.stdout?.trim());
}

function uniquePaths(paths: Array<string | null | undefined>): string[] {
  return Array.from(new Set(paths.filter((value): value is string => Boolean(value))));
}

function getCandidateClaudePaths(platform: SupportedPlatform): string[] {
  const home = homedir();
  const candidates: string[] = [];

  const lookup = spawnSync(platform === 'win32' ? 'where' : 'which', ['claude'], {
    timeout: 3000,
    encoding: 'utf-8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (lookup.status === 0 && lookup.stdout) {
    candidates.push(...lookup.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  }

  if (platform === 'win32') {
    candidates.push(
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Claude', 'claude.exe'),
      join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
      join(process.env.USERPROFILE || '', '.claude', 'local', 'claude.exe'),
    );
  } else {
    candidates.push(
      join(home, '.claude', 'local', 'bin', 'claude'),
      join(home, '.local', 'bin', 'claude'),
      join(home, '.npm-global', 'bin', 'claude'),
      join(home, '.volta', 'bin', 'claude'),
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
    );
  }

  return uniquePaths(candidates);
}

function checkWindowsPrereqs(): string[] {
  if (process.platform !== 'win32') {
    return [];
  }

  const diagnostics: string[] = [];
  if (!checkCommandAvailable('git')) {
    diagnostics.push('Git for Windows not detected. Claude on Windows may require Git Bash.');
  }
  if (!checkCommandAvailable('powershell.exe')) {
    diagnostics.push('PowerShell not detected. Ritemark cannot launch Claude install/login actions.');
  }

  return diagnostics;
}

function getClaudeVersion(binaryPath: string): string | undefined {
  try {
    const result = runBinary(binaryPath, ['--version'], 5000);
    if (result.status === 0 && result.stdout?.trim()) {
      return result.stdout.trim();
    }
  } catch {
    // optional
  }
  return undefined;
}

function inspectClaudeBinary(platform: NodeJS.Platform = getCurrentPlatform()): ClaudeBinaryInspection {
  if (!isSupportedPlatform(platform)) {
    return {
      installed: false,
      runnable: false,
      diagnostics: ['Claude bootstrap is currently supported on macOS and Windows 11.'],
    };
  }

  const diagnostics = checkWindowsPrereqs();
  const candidatePaths = getCandidateClaudePaths(platform);

  for (const candidate of candidatePaths) {
    if (!existsSync(candidate)) {
      continue;
    }

    const version = getClaudeVersion(candidate);
    if (version) {
      return {
        installed: true,
        runnable: true,
        path: candidate,
        version,
        diagnostics: candidatePaths[0] !== candidate
          ? [...diagnostics, `Using detected Claude path: ${candidate}`]
          : diagnostics,
      };
    }

    let error: string | undefined;
    try {
      const result = runBinary(candidate, ['--version'], 5000);
      error = result.stderr?.trim() || result.stdout?.trim() || 'Claude binary was detected but could not be started.';
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    return {
      installed: true,
      runnable: false,
      path: candidate,
      error,
      diagnostics: [...diagnostics, `Claude binary detected at ${candidate}`],
    };
  }

  return {
    installed: false,
    runnable: false,
    diagnostics,
  };
}

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

function checkWindowsAuth(): boolean {
  try {
    const result = spawnSync('cmdkey', ['/list:Claude*'], {
      timeout: 3000,
      encoding: 'utf-8',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return result.status === 0 && (result.stdout?.includes('Claude') ?? false);
  } catch {
    return false;
  }
}

function detectClaudeAuthMethod(platform: NodeJS.Platform = getCurrentPlatform()): ClaudeAuthMethod {
  if (platform === 'darwin' && checkKeychainAuth()) {
    return 'claude-oauth';
  }

  if (platform === 'win32' && checkWindowsAuth()) {
    return 'claude-oauth';
  }

  if (process.env.ANTHROPIC_API_KEY || hasAnthropicKeyInSecrets) {
    return 'api-key';
  }

  return null;
}

export function deriveClaudeSetupStatus(input: ClaudeStatusInput): SetupStatus {
  const diagnostics = [...input.binary.diagnostics];
  let state: ClaudeSetupState;
  let repairAction: ClaudeRepairAction = null;
  let error: string | null = null;

  if (input.pendingReload && !input.binary.runnable) {
    state = 'broken-install';
    repairAction = 'reload';
    diagnostics.push(...input.pendingReloadDiagnostics);
    error = 'Claude was installed, but Ritemark needs a reload before it can use it.';
  } else if (!input.binary.installed) {
    state = 'not-installed';
    repairAction = 'install';
    error = null;
  } else if (!input.binary.runnable) {
    state = 'broken-install';
    repairAction = 'repair';
    error = input.binary.error ?? 'Claude was detected, but it could not be started.';
  } else if (input.authMethod === null) {
    state = input.loginInProgress ? 'auth-in-progress' : 'needs-auth';
    error = null;
  } else {
    state = 'ready';
    error = null;
  }

  if (input.binary.path) {
    diagnostics.unshift(`Binary: ${input.binary.path}`);
  }
  if (input.binary.version) {
    diagnostics.unshift(`Version: ${input.binary.version}`);
  }
  if (input.authMethod === 'claude-oauth' && hasAnthropicKeyInSecrets) {
    diagnostics.push('Anthropic API key is configured, but Claude.ai credentials are active and take precedence.');
  }

  return {
    cliInstalled: input.binary.installed,
    runnable: input.binary.runnable,
    cliVersion: input.binary.version,
    binaryPath: input.binary.path,
    authenticated: input.authMethod !== null,
    authMethod: input.authMethod,
    state,
    diagnostics,
    repairAction,
    error,
  };
}

export function hasCliOAuth(): boolean {
  return detectClaudeAuthMethod() === 'claude-oauth';
}

export function setAnthropicKeyAvailable(hasKey: boolean): void {
  hasAnthropicKeyInSecrets = hasKey;
}

export function setClaudeLoginInProgress(inProgress: boolean): void {
  claudeLoginInProgress = inProgress;
  cachedStatus = null;
}

export function setClaudePendingReload(diagnostics: string[] = []): void {
  claudePendingReload = true;
  claudePendingReloadDiagnostics = diagnostics;
  cachedStatus = null;
}

export function clearClaudePendingReload(): void {
  claudePendingReload = false;
  claudePendingReloadDiagnostics = [];
  cachedStatus = null;
}

export function clearSetupCache(): void {
  cachedStatus = null;
}

export async function getSetupStatus(options?: { refresh?: boolean }): Promise<SetupStatus> {
  if (!options?.refresh && cachedStatus) {
    return cachedStatus;
  }

  const binary = inspectClaudeBinary();
  if (binary.runnable) {
    clearClaudePendingReload();
  }

  const authMethod = binary.runnable ? detectClaudeAuthMethod() : null;
  const status = deriveClaudeSetupStatus({
    binary,
    authMethod,
    loginInProgress: claudeLoginInProgress,
    pendingReload: claudePendingReload,
    pendingReloadDiagnostics: claudePendingReloadDiagnostics,
  });

  cachedStatus = status;
  return status;
}

export const __testOnly = {
  deriveClaudeSetupStatus,
};
