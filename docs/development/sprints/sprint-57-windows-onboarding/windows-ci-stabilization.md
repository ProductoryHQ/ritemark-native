# Sprint 57 Addendum 3 — Windows CI win32-x64 Build Stabilization

Date: 2026-05-03
Status: Active blocker for v1.6.1 Gate 2 (Windows artifact)

## Problem

Windows CI build fails at the gulp `vscode-win32-x64-min` packaging step. Pattern of failures:

| Iteration | Failure | Root commit |
|---|---|---|
| 1 | Node v22.22.0 used; VS Code 1.117 .nvmrc requires v22.22.1 | bumped Node in workflow |
| 2 | rcedit.exe chokes on `extensions/copilot/node_modules/@anthropic-ai/claude-agent-sdk/vendor/audio-capture/arm64-darwin/audio-capture.node` | tried deleting `extensions/copilot` entirely |
| 3 | gulp's `prepareBuiltInCopilotExtensionShims` throws because copilot SDK dir missing | tried stripping only ripgrep+audio-capture vendor subdirs |
| 4 | rcedit.exe chokes on `extensions/copilot/node_modules/@github/copilot/sdk/prebuilds/linux-x64/computer.node` | this addendum |

## Root cause

1. VS Code 1.117 ships `extensions/copilot/` (GitHub Copilot Chat) as a built-in extension.
2. Copilot's nested SDK (`@github/copilot`) and its dependencies (`@anthropic-ai/claude-agent-sdk`) bundle **native `.node` binaries for ALL platforms** under directories like:
   - `extensions/copilot/node_modules/@github/copilot/sdk/prebuilds/{platform-arch}/`
   - `extensions/copilot/node_modules/@github/copilot/sdk/ripgrep/bin/{platform-arch}/`
   - `extensions/copilot/node_modules/@anthropic-ai/claude-agent-sdk/vendor/{audio-capture,ripgrep}/{arch-platform}/`
3. During the win32-x64 packaging, `gulp` calls **rcedit.exe** on every file in the built `.app/resources/app/` to set Windows version metadata. rcedit cannot parse non-Windows native binaries → exit code 1 → build fails.
4. VS Code's existing `.moduleignore` strips SOME copilot binaries (`@github/copilot/prebuilds/**`) but misses **the deeper paths** where the actual problematic binaries live.

The previous fixes were "whack-a-mole" — each one fixed the surface failure and revealed the next one. This addendum is the comprehensive fix.

## Comprehensive plan

### Single commit, single push, single CI retest

**File:** `vscode/build/.moduleignore` (change captured as a Ritemark patch).

Add strip rules covering ALL non-target-platform binary trees in copilot's nested deps. Plus a re-include for what we actually need on win32-x64:

```ignore
# Ritemark: comprehensive strip of non-target binaries inside built-in copilot
@github/copilot/sdk/prebuilds/**
@github/copilot/sdk/ripgrep/**
@github/copilot/clipboard/**

# Ritemark: nested claude-agent-sdk under copilot — strip all platform binaries
@anthropic-ai/claude-agent-sdk/vendor/audio-capture/**
@anthropic-ai/claude-agent-sdk/vendor/ripgrep/**
@anthropic-ai/claude-agent-sdk/vendor/tree-sitter/**
```

The win32-x64 binaries that gulp's `prepareBuiltInCopilotExtensionShims` actually needs are **created fresh** by that function (line 146 in `vscode/build/lib/copilot.ts`: `mkdirSync(nodePtyDest, { recursive: true })` then `cpSync(nodePtySource, ...)`). So stripping the entire `prebuilds/**` is safe — the shim setup will recreate `prebuilds/win32-x64/` from scratch using VS Code's bundled `node-pty`.

The `@anthropic-ai/claude-agent-sdk/vendor/` dirs are dead weight inside copilot's bundle. Ritemark's own claude-agent-sdk lives at `extensions/ritemark/node_modules/@anthropic-ai/claude-agent-sdk/` (separate, not subject to the same stripping) and is loaded directly by the AI sidebar via dynamic import — independent of copilot's nested copy.

### Plan B (if .moduleignore alone isn't enough)

The Windows workflow already has a "Strip non-Windows binaries from built-in copilot extension" step. Replace its contents with:

```bash
find extensions/copilot/node_modules \
  -type d \( \
    -name "arm64-darwin" -o -name "x64-darwin" -o \
    -name "arm64-linux"  -o -name "x64-linux"  -o \
    -name "darwin-arm64" -o -name "darwin-x64" -o \
    -name "linux-arm64"  -o -name "linux-x64" \
  \) -prune -exec rm -rf {} +
```

This belt-and-suspenders approach handles BOTH naming conventions (`{arch}-{platform}` and `{platform}-{arch}`) which different packages use, and runs immediately after `npm install` in CI. Even if a future copilot release introduces a new binary path the .moduleignore doesn't cover, this find pattern catches it.

### Decision

Apply **Plan A only** in this iteration — `.moduleignore` is the canonical VS Code build infrastructure for this, and a one-line ritemark patch is much cleaner than a workflow shell script. If the next Windows CI run fails again, **stop**, audit what specific path is missing, and decide whether to extend `.moduleignore` further or fall back to Plan B's exhaustive `find`.

## Out of scope

- macOS x64 build is fine (no rcedit equivalent that chokes on cross-platform binaries; gulp handles macOS native binaries gracefully).
- We are NOT reverting the existing Windows workflow steps:
  - "Remove non-Windows binaries from claude-agent-sdk" (Ritemark's own SDK ripgrep cleanup) — keeps working as-is.
  - "Strip non-Windows binaries from built-in copilot extension" (the partial cleanup we added in iteration 3) — leave it as a defense in depth even though .moduleignore should make it unnecessary.

## Implementation steps

1. Edit `vscode/build/.moduleignore` to add the strip rules (block above).
2. Regenerate patch `001-ritemark-branding.patch` with the new hunks. Or, since this is build infrastructure not branding, create a new patch `008-windows-ci-binary-strip.patch` for clean separation.
3. Verify locally: `./scripts/apply-patches.sh --dry-run` reports all patches applied.
4. Commit on `main`, push, delete + re-push tag `v1.6.1` from new HEAD.
5. CI runs once. If Windows succeeds → continue Gate 2 with release-manager. If fails again → STOP, audit, do not re-iterate without diagnosis.

## Acceptance criteria

- Windows CI build completes through the entire `vscode-win32-x64-min` task without an rcedit error.
- A signed Windows installer artifact is uploaded.
- macOS x64 CI build continues to succeed (regression check).
- All 7 (or 8) ritemark patches apply cleanly against vanilla VS Code 1.117.0 in `release-preflight.sh`.
