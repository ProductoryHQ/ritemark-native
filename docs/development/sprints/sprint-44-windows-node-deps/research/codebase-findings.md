# Sprint 44 Research: Windows AI Bootstrap Hardening

**Date:** 2026-03-13
**Scope anchor:** current extension + webview bootstrap architecture

## Summary

The core Windows setup problem is not safely modeled as "Node.js is missing".

What we actually know from the current codebase is:

1. Some prerequisites are checked, but only surfaced as diagnostics.
2. Claude and Codex setup surfaces are separate and do not share one dependency state model.
3. Runtime launch behavior can still fail even after install/discovery appears successful.
4. Recovery guidance is currently inconsistent across Claude and Codex.

The sprint should therefore optimize for:

- detection of the actual blocker
- separation of install state from runtime state
- blocker-specific recovery guidance

---

## Key Architectural Findings

### 1. The existing setup path is Claude-centric

`UnifiedViewProvider._sendAgentConfig()` only populates `setupStatus` when the selected agent is `claude-code`.

**Implication:** Claude-only `SetupStatus` cannot act as the universal dependency model for all AI bootstrap states.

### 2. The AI sidebar already has separate setup surfaces

- Claude uses `SetupWizard`
- Codex uses `CodexSetupView`

**Implication:** the safest short-term path is shared prerequisite status plus agent-specific recovery UI, not a forced full unification.

### 3. Some dependency checks already exist

- `setup.ts` has a reusable `checkCommandAvailable(command)` helper
- `setup.ts` checks Git and PowerShell on Windows in `checkWindowsPrereqs()`
- `installer.ts` already blocks Claude install when Git is missing on Windows
- settings code already computes some system-health facts separately

**Implication:** the sprint should consolidate and expose dependency facts, not invent a second parallel status model.

### 4. Runtime launch paths are a bigger risk than raw install state

- `AgentRunner.ts` still passes `executable: process.execPath`
- `pathToClaudeCodeExecutable` is already supported but depends on being wired through
- `CodexManager` resolves a binary path, but verification and spawn still rely on `codex` from PATH

**Implication:** a machine can look "installed" while still being broken at runtime. Runtime verification must be part of the status model.

### 5. Windows blockers are likely to vary by machine

A clean Windows machine may be missing any combination of:

- Git
- Node.js
- PATH freshness after install
- a working Claude binary
- a working Codex binary
- PowerShell access

**Implication:** the product should not assume one primary blocker in advance.

---

## File-by-File Findings

### `extensions/ritemark/src/agent/setup.ts`

**Current state**

- `checkCommandAvailable()` is already generic and reusable for dependency probing.
- `checkWindowsPrereqs()` checks `git` and `powershell.exe`, but only adds diagnostics.
- `inspectClaudeBinary()` tries candidate Claude paths and verifies them through `--version`.
- `SetupStatus` derivation is Claude-specific and does not carry a shared environment/dependency view.

**What this means**

- Good base for detection exists.
- Missing piece is not "a Node.js check" by itself.
- Missing piece is a shared bootstrap/environment status model that can explain why setup is blocked.

### `extensions/ritemark/src/agent/installer.ts`

**Current state**

- Windows Claude install already fails fast when Git is missing.
- The install path is native PowerShell-based, not npm-based.
- Post-install verification depends on `getSetupStatus({ refresh: true })`.

**What this means**

- The code already contradicts a pure "Node.js prerequisite fix" framing.
- A stronger sprint should extend fail-fast behavior to whatever blocker is actually detected, not just Git.
- If Node is relevant for a particular runtime path, the UI can say so after detection proves it.

### `extensions/ritemark/src/agent/AgentRunner.ts`

**Current state**

- `runAgent()` and session startup still pass `executable: process.execPath`.
- `pathToClaudeCodeExecutable` is already a supported option in the call chain.

**What this means**

- Claude runtime hardening should focus on correct executable-path behavior.
- The immediate question is not "set executable to node" but "what launch contract is correct for the discovered install shape?"

### `extensions/ritemark/src/codex/codexManager.ts`

**Current state**

- `findBinaryPath()` resolves a Codex path.
- `getBinaryStatus()` still uses `spawn('codex', ['--version'])`.
- `spawn()` still launches `spawn('codex', ['app-server'])`.
- Repair text still assumes npm/brew style recovery.

**What this means**

- Codex currently has a detection/runtime mismatch.
- Any future binary installer will remain unreliable until resolved binary paths are used consistently for verify and spawn.

### `extensions/ritemark/src/views/UnifiedViewProvider.ts`

**Current state**

- Sends Claude `setupStatus` only when Claude is the selected agent.
- Always sends Codex sidebar status separately.

**What this means**

- Shared dependency state must be sent independently of Claude-only setup state.
- Otherwise Windows prerequisite guidance remains fragmented.

### `extensions/ritemark/webview/src/components/ai-sidebar/SetupWizard.tsx`

**Current state**

- Renders Claude-specific install/auth states.
- Does not have a generalized blocker model beyond Claude setup state.

**What this means**

- The component should consume shared prerequisite facts and display blocker-specific guidance.
- It should not become the only global dependency authority.

### `extensions/ritemark/webview/src/components/ai-sidebar/CodexSetupView.tsx`

**Current state**

- Already acts as a dedicated Codex recovery surface.
- Can display error, diagnostics, and repair guidance.

**What this means**

- It is the correct place to reuse shared prerequisite guidance for Codex.
- We do not need a full UI rewrite to improve Windows bootstrap behavior.

### `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts`

**Current state**

- Already computes health/dependency information, including Git state, in a separate flow.

**What this means**

- There is already pressure toward duplicated truth.
- The sprint should consolidate dependency facts instead of expanding only Claude `SetupStatus`.

---

## Recommended Problem Classification

The system should classify setup blockers into at least these buckets:

### Missing prerequisite

Examples:

- Git missing
- PowerShell unavailable
- Node missing, if the active runtime path actually requires it

### Installed but not runnable

Examples:

- Claude path discovered but launch contract is wrong
- Codex binary discovered but `app-server` still launches from PATH and fails

### Installed but reload required

Examples:

- PATH-sensitive install completed
- binary exists but current Electron process needs restart/reload

### Ready

Examples:

- binary exists
- runtime verification passes
- required auth step is either complete or can be presented normally

---

## Recommended Sprint Focus

The safest order is:

1. Normalize dependency detection and status derivation
2. Fix runtime launch behavior for Claude and Codex
3. Expose shared dependency state to the UI
4. Add blocker-specific recovery actions
5. Add automation only where detection proves it is appropriate

This order protects against the biggest failure mode: adding nicer install UI on top of runtime behavior that is still wrong.

---

## Open Questions

- Does the current Windows Claude path still require Node.js in the failing repro, or was the observed issue caused by the wrong launch contract after install discovery?
- Which blockers should become first-class UI actions in v1.5.1 versus diagnostics-only?
- Should restart-required be modeled globally for the bootstrap flow, or separately per tool?

---

## Conclusion

The repo is already closer to a native-Windows bootstrap story than the old "Windows Node dependency fix" framing suggests.

The real gap is not a single missing dependency. It is the absence of a shared bootstrap model that can:

- detect the actual blocker
- verify runtime launch behavior
- drive the correct recovery action

That is the basis for the sprint plan.
