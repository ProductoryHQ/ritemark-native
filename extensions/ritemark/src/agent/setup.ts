/**
 * Claude bootstrap detection and auth state.
 *
 * Supported platforms in product scope:
 * - macOS (arm64, x64)
 * - Windows 11
 *
 * Every probe runs its child process asynchronously: the extension host has a
 * single JS thread, and `claude --version` / `claude auth status` can take
 * hundreds of milliseconds (seconds on a cold start). Waiting for them
 * synchronously froze the AI sidebar, editors and commands at every launch.
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { getCurrentPlatform } from '../utils/platform';
import { findBundledAgentRuntime, isBundledAgentRuntimePath, readAgentRuntimePreference, readBundledRuntimeVersion, type AgentRuntimePreference } from '../utils/bundledAgentRuntime';
import { onClaudeStatusInvalidated } from './claudeStatusEvents';
import { runProcess, type ProcessResult } from '../utils/runProcess';
import type {
  AgentEnvironmentStatus,
  ClaudeAuthMethod,
  ClaudeRepairAction,
  ClaudeRuntimeSource,
  ClaudeSetupState,
  OnboardingStatus,
  SetupStatus,
} from './types';

let cachedStatus: SetupStatus | null = null;
let hasAnthropicKeyInSecrets = false;
let claudeLoginInProgress = false;
let claudePendingReload = false;
let claudePendingReloadDiagnostics: string[] = [];
// Async probes can overlap. Callers share the probe in flight, and a probe that
// started before an invalidation writes nothing shared: neither the cache nor
// the pending-reload flags (see getSetupStatus).
let statusEpoch = 0;
let inflightStatus: { epoch: number; promise: Promise<SetupStatus> } | null = null;

function invalidateStatus(): void {
  cachedStatus = null;
  statusEpoch += 1;
}

onClaudeStatusInvalidated(() => {
  invalidateStatus();
});

type SupportedPlatform = 'darwin' | 'win32';

interface ClaudeBinaryInspection {
  installed: boolean;
  runnable: boolean;
  path?: string;
  authCheckPath?: string;
  version?: string;
  error?: string;
  diagnostics: string[];
  runtimeSource?: ClaudeRuntimeSource;
}

interface ClaudeStatusInput {
  binary: ClaudeBinaryInspection;
  authMethod: ClaudeAuthMethod;
  loginInProgress: boolean;
  pendingReload: boolean;
  pendingReloadDiagnostics: string[];
}

interface ClaudeAuthStatusJson {
  loggedIn?: boolean;
  authMethod?: string;
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

function runBinary(binaryPath: string, args: string[], timeout: number): Promise<ProcessResult> {
  const launch = getSpawnCommand(binaryPath);
  return runProcess(launch.command, [...launch.args, ...args], {
    timeout,
    shell: launch.shell,
  });
}

/**
 * On Windows, npm-installed CLIs are `.cmd` wrappers that invoke `node <script>`.
 * The Claude SDK spawns `node <pathToClaudeCodeExecutable>`, so passing a `.cmd`
 * causes EINVAL. This function extracts the actual JS entry point from the `.cmd`.
 */
function resolveJsEntryFromCmd(cmdPath: string): string | null {
  if (process.platform !== 'win32' || !cmdPath.toLowerCase().endsWith('.cmd')) {
    return null;
  }

  try {
    const content = readFileSync(cmdPath, 'utf-8');
    // npm .cmd wrappers contain a line like:
    //   "%_prog%" "%dp0%\node_modules\@anthropic-ai\claude-code\cli.js" %*
    const match = content.match(/%dp0%\\([^\s"]+\.js)/);
    if (match) {
      const jsRelative = match[1].replace(/\\/g, '/');
      const jsAbsolute = join(dirname(cmdPath), jsRelative);
      if (existsSync(jsAbsolute)) {
        return jsAbsolute;
      }
    }
  } catch {
    // Can't read the .cmd — fall through
  }

  return null;
}

async function checkCommandAvailable(command: string): Promise<boolean> {
  const platform = process.platform;
  const lookup = platform === 'win32' ? 'where' : 'which';
  const result = await runProcess(lookup, [command], {
    timeout: 3000,
    shell: false,
  });
  return result.status === 0 && Boolean(result.stdout?.trim());
}

/**
 * Whether Windows setup asks for Git for Windows and Node.js.
 *
 * The bundled runtimes need neither: claude.exe is self-contained and, without
 * Git Bash, uses its PowerShell tool instead; codex-app-server.exe is a native
 * binary. Only a runtime the user installed themselves can: an npm install runs
 * on Node.js, and an older Claude may need Git Bash. So the checks apply with the
 * 'system' runtime preference only.
 */
function systemRuntimeToolsRequired(
  platform: NodeJS.Platform,
  preference: AgentRuntimePreference = readAgentRuntimePreference(),
): boolean {
  return platform === 'win32' && preference === 'system';
}

function recommendedEnvironmentAction(input: {
  gitRequired: boolean;
  gitInstalled: boolean;
  nodeRequired: boolean;
  nodeInstalled: boolean;
  restartRequired: boolean;
}): AgentEnvironmentStatus['recommendedAction'] {
  if (input.restartRequired) {
    return 'reload';
  }

  if (input.gitRequired && !input.gitInstalled) {
    return 'install-git';
  }

  if (input.nodeRequired && !input.nodeInstalled) {
    return 'install-node';
  }

  return null;
}

function uniquePaths(paths: Array<string | null | undefined>): string[] {
  return Array.from(new Set(paths.filter((value): value is string => Boolean(value))));
}

async function getCandidateClaudePaths(platform: SupportedPlatform): Promise<string[]> {
  const home = homedir();
  const candidates: string[] = [];
  const bundledRuntime = findBundledAgentRuntime('claude', { platform });
  const preference = readAgentRuntimePreference();

  if (preference === 'bundled' && bundledRuntime) {
    candidates.push(bundledRuntime.path);
  }

  const lookup = await runProcess(platform === 'win32' ? 'where' : 'which', ['claude'], {
    timeout: 3000,
    shell: false,
  });

  if (lookup.status === 0 && lookup.stdout) {
    let lookupLines = lookup.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (platform === 'win32') {
      // On Windows, `where` returns extensionless Unix shell shims (e.g. %APPDATA%\npm\claude)
      // alongside the usable .cmd/.exe variants. The extensionless files cannot be spawned by
      // Node.js and cause ENOENT errors — filter them out.
      lookupLines = lookupLines.filter(p => /\.(exe|cmd|bat)$/i.test(p));
    }
    candidates.push(...lookupLines);
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

  // When the user prefers system installs but none were found, append the bundled
  // runtime as a graceful last resort so Claude remains usable. The Settings page
  // exposes runtimeSource so users can see which path is actually in use.
  if (preference === 'system' && bundledRuntime) {
    candidates.push(bundledRuntime.path);
  }

  return uniquePaths(candidates);
}

async function checkWindowsPrereqs(): Promise<string[]> {
  if (process.platform !== 'win32') {
    return [];
  }

  const diagnostics: string[] = [];
  if (systemRuntimeToolsRequired(process.platform) && !(await checkCommandAvailable('git'))) {
    diagnostics.push('Git for Windows not detected. A system-installed Claude may require Git Bash.');
  }
  if (!(await checkCommandAvailable('powershell.exe'))) {
    diagnostics.push('PowerShell not detected. Ritemark cannot launch Claude install/login actions.');
  }

  return diagnostics;
}

async function getClaudeVersion(binaryPath: string): Promise<string | undefined> {
  try {
    // 15s allows for cold-start of the 217MB bundled Mach-O on first launch
    // (macOS Gatekeeper signature verification can spike on the very first
    // execution; subsequent runs cache and return in < 1s).
    const result = await runBinary(binaryPath, ['--version'], 15000);
    const stdout = result.stdout?.trim();
    if (!stdout) return undefined;
    // Happy path: clean exit + non-empty stdout.
    if (result.status === 0) return stdout;
    // Permissive recovery: some bundled binaries print a valid version then
    // exit non-zero on first run (env-related, harmless). If stdout matches
    // semver-prefix, trust it. Without this we'd label a working binary as
    // "broken" and surface the version string itself as a "repair needed"
    // error message — exactly the UX trap that broke the bundled Claude
    // Settings screen on cold start.
    if (/^\d+\.\d+\.\d+/.test(stdout)) return stdout;
  } catch {
    // optional
  }
  return undefined;
}

async function inspectClaudeBinary(platform: NodeJS.Platform = getCurrentPlatform()): Promise<ClaudeBinaryInspection> {
  if (!isSupportedPlatform(platform)) {
    return {
      installed: false,
      runnable: false,
      diagnostics: ['Claude bootstrap is currently supported on macOS and Windows 11.'],
    };
  }

  const diagnostics = await checkWindowsPrereqs();
  const candidatePaths = await getCandidateClaudePaths(platform);

  for (const candidate of candidatePaths) {
    if (!existsSync(candidate)) {
      continue;
    }

    const version = await getClaudeVersion(candidate);
    if (version) {
      // For the SDK's pathToClaudeCodeExecutable, we need the JS entry point,
      // not the .cmd wrapper (the SDK runs `node <path>`, not `shell .cmd`).
      const sdkPath = resolveJsEntryFromCmd(candidate) || candidate;
      const runtimeSource: ClaudeRuntimeSource = isBundledAgentRuntimePath(candidate) ? 'bundled' : 'system';
      if (runtimeSource === 'bundled') {
        const manifestVersion = readBundledRuntimeVersion(candidate);
        const runtimeSemver = version.match(/^([\d.]+)/)?.[1];
        if (manifestVersion && runtimeSemver && manifestVersion !== runtimeSemver) {
          console.warn(
            `[ritemark] Runtime drift: claude reports ${runtimeSemver} but manifest says ${manifestVersion} (${candidate})`,
          );
        }
      }
      return {
        installed: true,
        runnable: true,
        path: sdkPath,
        authCheckPath: candidate,
        version,
        runtimeSource,
        diagnostics: candidatePaths[0] !== candidate || sdkPath !== candidate || runtimeSource === 'bundled'
          ? [...diagnostics, `${runtimeSource === 'bundled' ? 'Using bundled Claude runtime' : 'Using detected Claude path'}: ${sdkPath}`]
          : diagnostics,
      };
    }

    let error: string | undefined;
    let isSpawnFailure = false;
    try {
      const result = await runBinary(candidate, ['--version'], 5000);
      if (result.error && 'code' in result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Binary file exists but Node.js cannot spawn it (e.g. Unix shim on Windows).
        // Skip and try the next candidate.
        isSpawnFailure = true;
      } else {
        error = result.stderr?.trim() || result.stdout?.trim() || 'Claude binary was detected but could not be started.';
      }
    } catch (err) {
      const errCode = err instanceof Error && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;
      if (errCode === 'ENOENT' || errCode === 'EINVAL') {
        isSpawnFailure = true;
      } else {
        error = err instanceof Error ? err.message : String(err);
      }
    }

    if (isSpawnFailure) {
      diagnostics.push(`Skipped unspawnable path: ${candidate}`);
      continue;
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

async function checkKeychainAuth(): Promise<boolean> {
  try {
    const result = await runProcess('security', ['find-generic-password', '-s', 'Claude Code-credentials'], {
      timeout: 3000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

async function checkWindowsAuth(): Promise<boolean> {
  try {
    const result = await runProcess('cmdkey', ['/list:Claude*'], {
      timeout: 3000,
      shell: true,
    });
    return result.status === 0 && (result.stdout?.includes('Claude') ?? false);
  } catch {
    return false;
  }
}

function parseClaudeAuthStatusJson(output: string): ClaudeAuthMethod | undefined {
  try {
    const status = JSON.parse(output) as ClaudeAuthStatusJson;
    if (status.loggedIn === false) {
      return null;
    }
    if (status.loggedIn === true) {
      return status.authMethod?.toLowerCase().includes('api')
        ? 'api-key'
        : 'claude-oauth';
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function checkClaudeAuthStatus(binaryPath: string): Promise<ClaudeAuthMethod | undefined> {
  try {
    const result = await runBinary(binaryPath, ['auth', 'status', '--json'], 5000);
    const parsed = parseClaudeAuthStatusJson(result.stdout ?? '');
    if (parsed !== undefined) {
      return parsed;
    }
    const stderrParsed = parseClaudeAuthStatusJson(result.stderr ?? '');
    if (stderrParsed !== undefined) {
      return stderrParsed;
    }
  } catch {
    // CLI unreachable — caller decides on fallbacks.
  }

  return undefined;
}

async function detectClaudeAuthMethod(
  platform: NodeJS.Platform = getCurrentPlatform(),
  binaryPath?: string
): Promise<ClaudeAuthMethod> {
  // 1. Primary source of truth: ask the CLI directly. Returns null after `claude logout`.
  if (binaryPath) {
    const cliStatus = await checkClaudeAuthStatus(binaryPath);
    if (cliStatus !== undefined) {
      return cliStatus;
    }
  }

  // 2. Explicit user-set secret (entered via Settings UI).
  if (hasAnthropicKeyInSecrets) {
    return 'api-key';
  }

  // 3. Platform credential stores.
  if (platform === 'darwin' && await checkKeychainAuth()) {
    return 'claude-oauth';
  }

  if (platform === 'win32' && await checkWindowsAuth()) {
    return 'claude-oauth';
  }

  // 4. Last resort: ANTHROPIC_API_KEY env var. Weakest signal — could be set by any
  //    parent shell or process and does not imply token validity.
  if (process.env.ANTHROPIC_API_KEY) {
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
    runtimeSource: input.binary.runtimeSource,
  };
}

export async function hasCliOAuth(): Promise<boolean> {
  return (await detectClaudeAuthMethod()) === 'claude-oauth';
}

export function setAnthropicKeyAvailable(hasKey: boolean): void {
  hasAnthropicKeyInSecrets = hasKey;
}

export function setClaudeLoginInProgress(inProgress: boolean): void {
  claudeLoginInProgress = inProgress;
  invalidateStatus();
}

export function setClaudePendingReload(diagnostics: string[] = []): void {
  claudePendingReload = true;
  claudePendingReloadDiagnostics = diagnostics;
  invalidateStatus();
}

export function clearClaudePendingReload(): void {
  claudePendingReload = false;
  claudePendingReloadDiagnostics = [];
  invalidateStatus();
}

export function clearSetupCache(): void {
  invalidateStatus();
}

async function probeSetupStatus(epoch: number): Promise<SetupStatus> {
  const binary = await inspectClaudeBinary();
  // Not clearClaudePendingReload(): that would invalidate this very probe. A
  // probe overtaken by an invalidation leaves the flags to the newer one.
  if (binary.runnable && epoch === statusEpoch) {
    claudePendingReload = false;
    claudePendingReloadDiagnostics = [];
  }

  const authMethod = binary.runnable ? await detectClaudeAuthMethod(getCurrentPlatform(), binary.authCheckPath ?? binary.path) : null;
  return deriveClaudeSetupStatus({
    binary,
    authMethod,
    loginInProgress: claudeLoginInProgress,
    pendingReload: claudePendingReload,
    pendingReloadDiagnostics: claudePendingReloadDiagnostics,
  });
}

function startSetupStatusProbe(): Promise<SetupStatus> {
  const epoch = statusEpoch;
  const promise = probeSetupStatus(epoch).then((status) => {
    // A probe that started before an invalidation must not replace newer state.
    if (epoch === statusEpoch) {
      cachedStatus = status;
    }
    return status;
  });
  const inflight = { epoch, promise };
  inflightStatus = inflight;
  const release = () => {
    if (inflightStatus === inflight) {
      inflightStatus = null;
    }
  };
  promise.then(release, release);
  return promise;
}

export async function getSetupStatus(options?: { refresh?: boolean }): Promise<SetupStatus> {
  if (!options?.refresh && cachedStatus) {
    return cachedStatus;
  }

  // A call made while a probe runs shares it, `refresh` included, unless the
  // status was invalidated after that probe started.
  if (inflightStatus && inflightStatus.epoch === statusEpoch) {
    return inflightStatus.promise;
  }

  return startSetupStatusProbe();
}

export async function getAgentEnvironmentStatus(options?: {
  refresh?: boolean;
  setupStatus?: SetupStatus;
}): Promise<AgentEnvironmentStatus> {
  const platform = getCurrentPlatform();
  const setupStatus = options?.setupStatus ?? await getSetupStatus({ refresh: options?.refresh });
  const gitInstalled = await checkCommandAvailable('git');
  const nodeInstalled = await checkCommandAvailable('node');
  const toolsRequired = systemRuntimeToolsRequired(platform);
  const powershellAvailable = platform === 'win32' ? await checkCommandAvailable('powershell.exe') : true;
  const restartRequired = setupStatus.repairAction === 'reload';
  const diagnostics: string[] = [];

  if (toolsRequired && !gitInstalled) {
    diagnostics.push('Git for Windows not detected.');
  }
  if (platform === 'win32' && !powershellAvailable) {
    diagnostics.push('PowerShell not detected.');
  }
  if (toolsRequired && !nodeInstalled) {
    diagnostics.push('Node.js not detected.');
  }
  if (restartRequired) {
    diagnostics.push('Reload Ritemark to refresh command paths after installation.');
  }

  return {
    platform,
    gitInstalled,
    nodeInstalled,
    gitRequired: toolsRequired,
    nodeRequired: toolsRequired,
    powershellAvailable,
    restartRequired,
    diagnostics,
    recommendedAction: recommendedEnvironmentAction({
      gitRequired: toolsRequired,
      gitInstalled,
      nodeRequired: toolsRequired,
      nodeInstalled,
      restartRequired,
    }),
  };
}

/**
 * Check whether `winget` is available (Windows 11 ships with it).
 * Used to decide whether we can automate Git/Node installs.
 */
export async function checkWingetAvailable(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  return checkCommandAvailable('winget');
}

/**
 * Unified onboarding status — detects ALL dependencies at once.
 * Used by the OnboardingWizard to show a single checklist.
 */
export async function getOnboardingStatus(options?: {
  setupStatus?: SetupStatus;
  hasOpenAiKey?: boolean;
  hasAnthropicKey?: boolean;
  codexCliInstalled?: boolean;
  codexCliAuthenticated?: boolean;
}): Promise<OnboardingStatus> {
  const platform = getCurrentPlatform() as 'win32' | 'darwin';
  const setupStatus = options?.setupStatus ?? await getSetupStatus({ refresh: true });

  const gitInstalled = await checkCommandAvailable('git');
  const nodeInstalled = await checkCommandAvailable('node');
  const toolsRequired = systemRuntimeToolsRequired(platform);
  const wingetAvailable = platform === 'win32' ? await checkCommandAvailable('winget') : false;

  const claudeCliInstalled = setupStatus.cliInstalled && setupStatus.runnable;
  const claudeCliAuthenticated = claudeCliInstalled && setupStatus.authenticated;

  // Codex status is passed in from the caller (CodexManager is async + heavier)
  const codexCliInstalled = options?.codexCliInstalled ?? false;
  const codexCliAuthenticated = options?.codexCliAuthenticated ?? false;

  const hasOpenAiKey = options?.hasOpenAiKey ?? false;
  const hasAnthropicKey = options?.hasAnthropicKey ?? hasAnthropicKeyInSecrets;

  // Any agent is ready if at least one path is fully usable
  const claudeReady = claudeCliAuthenticated;
  const codexReady = codexCliInstalled && codexCliAuthenticated;
  const ritemarkAgentReady = hasOpenAiKey;
  const anyAgentReady = claudeReady || codexReady || ritemarkAgentReady;

  return {
    platform,
    wingetAvailable,
    gitInstalled,
    nodeInstalled,
    gitRequired: toolsRequired,
    nodeRequired: toolsRequired,
    claudeCliInstalled,
    claudeCliAuthenticated,
    codexCliInstalled,
    codexCliAuthenticated,
    hasOpenAiKey,
    hasAnthropicKey,
    anyAgentReady,
  };
}

export const __testOnly = {
  deriveClaudeSetupStatus,
  recommendedEnvironmentAction,
  systemRuntimeToolsRequired,
  parseClaudeAuthStatusJson,
};
