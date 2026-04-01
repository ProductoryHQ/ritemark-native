# Codex CLI: nvm + Architecture Mismatch Root Cause Analysis

**Date:** 2026-04-01
**Affected:** macOS users with nvm and mixed Node architectures
**Symptom:** "Codex CLI needs repair — Missing optional dependency @openai/codex-darwin-arm64"

## The Environment

Jarmo's MacBook (Apple Silicon M-series) had multiple Node versions via nvm:

| Node Version | Architecture | Source |
|---|---|---|
| v23.0.0 | **x86_64** (Rosetta) | nvm default |
| v22.21.1 | arm64 (native) | nvm |
| v20.20.0 | arm64 (native) | nvm |

Key fact: **Node v23 was x64, running under Rosetta translation.** This was proven with:
```
$ file ~/.nvm/versions/node/v23.0.0/bin/node
Mach-O 64-bit executable x86_64

$ file ~/.nvm/versions/node/v22.21.1/bin/node
Mach-O 64-bit executable arm64
```

Ritemark Native's Electron bundles its own Node v22.21.1 (arm64) for the extension host.

## The Problem Chain

### 1. Codex installed under wrong Node arch

User ran `npm install -g @openai/codex` with nvm default (v23 x64). npm saw `cpu: x64` and installed `@openai/codex-darwin-x64` as the optional native dependency. `@openai/codex-darwin-arm64` was NOT installed (wrong platform).

### 2. Ritemark runs arm64 Node

When Ritemark's extension host spawns `codex app-server`, it uses Electron's arm64 Node. Codex's JS code tries to `require('@openai/codex-darwin-arm64')` — which doesn't exist because the package was installed under x64 Node. Result: "Missing optional dependency @openai/codex-darwin-arm64."

### 3. `which codex` didn't find the binary

`CodexManager.findBinaryPath()` used `which codex`. But `which` only searches the active PATH. Dev mode launched with `nvm use 20`, so PATH contained v20's bin directory — where codex wasn't installed. Even after installing codex under v22, `which` couldn't find it because v22 wasn't the active nvm version.

### 4. Repair command used wrong arch and wrong Node version

`buildRepairCommand()` had two bugs:
- Used `machineArch` (arm64 from `uname -m`) for the npm platform tag. This is correct for the TARGET but the install ran under x64 Node which refused it (`EBADPLATFORM`).
- `getBinaryArchitecture()` ran `/usr/bin/file` on the codex binary — but codex is a `#!/usr/bin/env node` text script, not a Mach-O binary. Always returned `null`, falling back to `machineArch`.

### 5. `@openai/codex@latest` tarball was 404 on npm

The generic `@latest` tag (0.118.0) had a broken tarball on the npm registry. Platform-specific tags like `@darwin-arm64` worked fine.

## The Fixes

### Fix 1: `findBinaryPath()` — nvm fallback scanning

`which codex` fails when codex is installed under a different nvm version than what's active. Added fallback: scan `~/.nvm/versions/node/*/bin/codex` (newest first), plus common locations (`/opt/homebrew/bin`, etc.).

This is the same pattern already used by `getCandidateClaudePaths()` for Claude CLI.

### Fix 2: `getBinaryArchitecture()` — check Node binary, not codex script

The codex binary is a text script. `file` returns "ASCII text", not architecture info. Changed to derive the Node binary path from the nvm path (`~/.nvm/versions/node/v23.0.0/bin/codex` → `~/.nvm/versions/node/v23.0.0/bin/node`) and check that binary's architecture instead.

### Fix 3: `buildRepairCommandFor()` — use runtime arch, uninstall from install Node

The platform tag must match the **runtime** arch (what Electron uses), not the install Node's arch. The repair command must:
1. `nvm use <installVersion>` — switch to where codex is installed
2. `npm uninstall -g ...` — remove the broken install
3. `nvm use <runtimeVersion>` — switch to the runtime Node (arm64)
4. `npm install -g @openai/codex@darwin-arm64` — install with correct native deps

### Fix 4: Platform-specific npm tags

Replaced all `@openai/codex@latest` references with platform-specific tags (`@darwin-arm64`, `@darwin-x64`, `@win32-x64`) because the generic tarball was 404 on npm.

## What Actually Fixed It

**The critical fix was #1 — nvm fallback scanning in `findBinaryPath()`.**

Without it, Ritemark couldn't even FIND codex after it was installed under the correct Node version. The repair command fixes were important for correctness, but the binary discovery was the blocker.

## Lesson Learned

On macOS with nvm, you cannot rely on `which <tool>` to find globally-installed npm packages. The user's default nvm version, the version active when the app launched, and the version the tool was installed under can all be different. Always scan nvm's version directories as a fallback.

Also: Apple Silicon Macs can have x64 Node installed via Rosetta. `uname -m` returns `arm64` (the machine arch), but the Node binary is `x86_64`. These are different things and must be handled separately.
