# Windows Node.js Dependency Analysis

**Date:** 2026-03-06
**Reported by:** Martin Kõiv (Windows beta tester)
**Severity:** Critical — AI features completely broken on clean Windows installs
**Status:** Root cause identified, fix options proposed

---

## Bug Report Summary

Martin Kõiv tested Ritemark 1.4.0 on a clean Windows machine (no developer tools installed — no Node.js, no Git, no npm). He encountered two distinct failures:

1. **Setup Wizard installer hangs** — The "Set up Claude Code" flow spins at "Installing..." for ~1 minute, then silently fails
2. **AI panel throws ENOENT** — After manually installing Claude Code CLI via terminal, the Ritemark AI panel shows: `Failed to spawn Claude Code process: spawn node ENOENT`

Both issues stem from the same root cause: **Ritemark assumes developer tools are present on the user's system**.

---

## Root Cause Analysis

### How the Claude Agent SDK spawns processes

The SDK (`@anthropic-ai/claude-agent-sdk` v0.2.31) spawn chain works as follows:

```
query() function (sdk.mjs)
  ├── Resolves pathToClaudeCodeExecutable
  │     → If not provided: defaults to sdk_dir/cli.js
  ├── Resolves executable runtime
  │     → 'bun' | 'deno' | 'node' (or custom value)
  ├── Checks if pathToClaudeCodeExecutable is a native binary
  │     → QV(): checks if path ends with .js/.mjs/.tsx/.ts/.jsx
  │     → cli.js ends with .js → NOT a native binary
  ├── Builds spawn command:
  │     → command = executable (runtime)
  │     → args = [cli.js, ...claude-code-args]
  └── Spawns: child_process.spawn(command, args)
```

### What Ritemark currently does

In `AgentRunner.ts` (lines 227 and 579):

```typescript
const queryOptions = {
  executable: process.execPath,  // Electron app binary path
  // pathToClaudeCodeExecutable is NOT set
  ...
};
```

We pass `process.execPath` as `executable`. In Electron, this resolves to the app binary itself (e.g., `C:\Users\...\Ritemark Native.exe` on Windows, `/Applications/Ritemark Native.app/.../Ritemark Native` on macOS).

### The SDK's `executable` type definition

```typescript
executable?: 'bun' | 'deno' | 'node';
```

The SDK expects a **runtime identifier** (`'node'`, `'bun'`, `'deno'`), not a file path. However, since JavaScript has no runtime type enforcement, any string is accepted. The string is used directly as the `command` argument to `child_process.spawn()`.

### Why it works on macOS (Jarmo's machine)

On Jarmo's Mac, Node.js v20 is installed via nvm and available in PATH. Even though we pass `process.execPath` (Electron binary path), the SDK falls back to finding `node` in PATH for certain operations. The Electron binary can also execute JavaScript files, so the initial spawn succeeds.

### Why it fails on Martin's Windows

On a clean Windows install:
1. `process.execPath` points to `Ritemark Native.exe` (Electron binary)
2. SDK spawns: `child_process.spawn('Ritemark Native.exe', ['cli.js', ...args])`
3. Electron binaries **cannot** execute standalone JS files like Node.js can when launched this way
4. Internally, `cli.js` (11MB, the full Claude Code CLI) uses `process.execPath` to spawn subprocesses (ripgrep, bash commands, etc.) — if it manages to start at all
5. The actual error `spawn node ENOENT` likely originates from **inside cli.js** when it tries to spawn Node.js subprocesses, finding no `node` in the system PATH

---

## Three Separate Issues Found

### Issue 1: Installer hangs on clean Windows

**File:** `extensions/ritemark/src/agent/installer.ts`

The installer runs:
```typescript
spawn('powershell.exe', [
  '-NoProfile', '-ExecutionPolicy', 'Bypass',
  '-Command', 'irm https://claude.ai/install.ps1 | iex',
]);
```

**Problem:** The Anthropic install script (`install.ps1`) likely requires Node.js or npm to be present. On a clean Windows machine, the script either hangs waiting for input or fails silently. Our installer only checks the exit code and stderr — but the script may not produce useful output before timing out.

**Missing:** No pre-flight dependency check. The installer should verify Node.js is available before attempting installation.

### Issue 2: No dependency validation before AI features

**File:** `extensions/ritemark/src/agent/setup.ts`

The `getSetupStatus()` function checks:
- ✅ Is Claude Code CLI installed? (`where claude`)
- ✅ Is authentication configured? (Windows Credential Manager)
- ❌ Is Node.js available in PATH?
- ❌ Is Git available?
- ❌ Are other required tools present?

The guard in `UnifiedViewProvider.ts` (line 380-388) only gates on CLI + auth:
```typescript
if (!status.cliInstalled || !status.authenticated) {
  // Show error
  return;
}
```

Even when CLI is installed and auth works, the system can still fail at spawn time because Node.js isn't in PATH.

### Issue 3: `executable` option mismatch

**File:** `extensions/ritemark/src/agent/AgentRunner.ts` (lines 227, 579)

We pass `process.execPath` (Electron binary path) as `executable`, but the SDK expects a runtime name like `'node'`. The SDK's internal logic:

```javascript
// SDK (deminified):
let isNativeBinary = !path.endsWith('.js') && !path.endsWith('.mjs') ...;
let command = isNativeBinary ? pathToClaudeCodeExecutable : executable;
let args = isNativeBinary ? [...execArgs, ...cliArgs] : [...execArgs, pathToClaudeCodeExecutable, ...cliArgs];
```

When `pathToClaudeCodeExecutable` is the SDK's bundled `cli.js`:
- `isNativeBinary = false`
- `command = executable` (our `process.execPath` = Electron binary)
- `args = [cli.js, ...cliArgs]`

This effectively tries to run the Electron app as a Node.js runtime with cli.js as a script — which doesn't work reliably across platforms.

---

## SDK Options Available (but unused)

The SDK provides two mechanisms that could solve this:

### Option A: `pathToClaudeCodeExecutable`

```typescript
pathToClaudeCodeExecutable?: string;
// "Path to the Claude Code executable. Uses the built-in executable if not specified."
```

If we could find the Claude Code native binary (which bundles its own Node), we could pass its path directly. The SDK would spawn it as a standalone executable without needing Node in PATH.

### Option B: `spawnClaudeCodeProcess` (custom spawn callback)

```typescript
spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess;
// "Custom function to spawn the Claude Code process."
// "options contains: command, args, cwd, env, signal"
```

This gives us full control over process spawning. We could:
- Resolve the correct Node.js binary (Electron's bundled one, or system)
- Set proper PATH and environment variables
- Handle platform-specific quirks

---

## Proposed Fix Strategy

### Phase 1: Dependency Validation (Quick Win)

Add Node.js and Git checks to `setup.ts`:

```typescript
export function checkNodeInstalled(): { installed: boolean; version?: string; path?: string } {
  const platform = getCurrentPlatform();
  const whichCmd = platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(whichCmd, ['node'], {
    timeout: 5000,
    encoding: 'utf-8',
    shell: true,
  });
  if (result.status === 0 && result.stdout?.trim()) {
    const versionResult = spawnSync('node', ['--version'], {
      timeout: 5000,
      encoding: 'utf-8',
      shell: true,
    });
    return {
      installed: true,
      version: versionResult.stdout?.trim(),
      path: result.stdout.trim(),
    };
  }
  return { installed: false };
}

export function checkGitInstalled(): { installed: boolean; version?: string } {
  const whichCmd = getCurrentPlatform() === 'win32' ? 'where' : 'which';
  const result = spawnSync(whichCmd, ['git'], {
    timeout: 5000,
    encoding: 'utf-8',
    shell: true,
  });
  if (result.status === 0) {
    const versionResult = spawnSync('git', ['--version'], {
      timeout: 5000,
      encoding: 'utf-8',
      shell: true,
    });
    return { installed: true, version: versionResult.stdout?.trim() };
  }
  return { installed: false };
}
```

Extend `SetupStatus`:
```typescript
interface SetupStatus {
  cliInstalled: boolean;
  cliVersion?: string;
  authenticated: boolean;
  nodeInstalled: boolean;    // NEW
  nodeVersion?: string;      // NEW
  gitInstalled: boolean;     // NEW
}
```

Update Setup Wizard UI to show dependency status and installation links.

### Phase 2: Fix `executable` Option

Change `AgentRunner.ts` to not pass `process.execPath`:

```typescript
// BEFORE (broken):
executable: process.execPath,

// AFTER (let SDK auto-detect):
// Don't pass executable at all, OR:
executable: 'node',
```

This lets the SDK use its default `'node'` value, which it will look up from PATH. Combined with Phase 1 dependency checks, we ensure `node` exists before attempting to spawn.

### Phase 3: Custom Spawn (Best Long-term Solution)

Use `spawnClaudeCodeProcess` to gain full control:

```typescript
import { spawn as cpSpawn } from 'child_process';

const queryOptions = {
  // ... other options ...
  spawnClaudeCodeProcess: (options) => {
    const nodePath = resolveNodePath(); // Find best Node.js binary
    const proc = cpSpawn(nodePath, options.args, {
      cwd: options.cwd,
      env: {
        ...options.env,
        // Ensure PATH includes Node.js location
        PATH: buildPathWithNode(options.env?.PATH),
      },
      signal: options.signal,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return {
      stdin: proc.stdin,
      stdout: proc.stdout,
      get killed() { return proc.killed; },
      get exitCode() { return proc.exitCode; },
      kill: proc.kill.bind(proc),
      on: proc.on.bind(proc),
      once: proc.once.bind(proc),
      off: proc.off.bind(proc),
    };
  },
};
```

Where `resolveNodePath()` tries in order:
1. System `node` from PATH
2. Node.js bundled with Claude Code CLI (if installed via native installer)
3. Electron's own Node binary (as last resort)

### Phase 4: Installer Pre-flight (Prevent the hang)

Update `installer.ts` to check dependencies before running the install script:

```typescript
export async function installClaude(onProgress): Promise<Result> {
  // Pre-flight checks
  const node = checkNodeInstalled();
  if (!node.installed) {
    onProgress({ stage: 'error', message: 'Node.js is required' });
    return {
      success: false,
      error: 'Node.js is required to install Claude Code. Please install Node.js from https://nodejs.org first.',
      missingDependency: 'node',
    };
  }

  // Proceed with installation...
}
```

---

## User-Facing Error Messages

Current cryptic errors should be replaced with actionable messages:

| Current Error | Proposed Replacement |
|---|---|
| `Failed to spawn Claude Code process: spawn node ENOENT` | `Node.js is not installed. Ritemark AI requires Node.js to run. [Install Node.js](https://nodejs.org)` |
| Installer hangs silently | `Prerequisites missing: Node.js is required to install Claude Code. [Install Node.js](https://nodejs.org)` |
| No Git → Claude Code agent fails | `Git is not installed. AI features need Git to track file changes. [Install Git](https://git-scm.com)` |

---

## Impact Assessment

| User Type | Current Experience | After Fix |
|---|---|---|
| Developer (Node+Git installed) | Works fine | No change |
| Power user (some tools) | Random failures, cryptic errors | Clear guidance on what to install |
| Regular user (clean OS) | Complete failure, no explanation | Friendly setup wizard with dependency links |

---

## Files to Modify

| File | Change |
|---|---|
| `extensions/ritemark/src/agent/setup.ts` | Add `checkNodeInstalled()`, `checkGitInstalled()`, extend `SetupStatus` |
| `extensions/ritemark/src/agent/installer.ts` | Add pre-flight checks before running install script |
| `extensions/ritemark/src/agent/AgentRunner.ts` | Fix `executable` option, consider `spawnClaudeCodeProcess` |
| `extensions/ritemark/src/agent/types.ts` | Extend `SetupStatus` interface |
| `extensions/ritemark/src/views/UnifiedViewProvider.ts` | Update guard to check Node.js + Git |
| `extensions/ritemark/webview/src/components/ai-sidebar/SetupWizard.tsx` | Show dependency status + install links |

---

## Related

- Anthropic Claude Agent SDK docs: `executable`, `pathToClaudeCodeExecutable`, `spawnClaudeCodeProcess` options
- SDK version: 0.2.31
- Ritemark issue context: Windows 1.4.0 beta testing by Martin Kõiv
