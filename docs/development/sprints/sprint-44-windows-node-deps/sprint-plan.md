# Sprint 44: Windows AI Bootstrap Hardening

## Goal

Make Windows AI setup resilient on unknown user machines by detecting missing prerequisites, distinguishing install-state from runtime-state, and guiding the user to the smallest safe next action.

This sprint is intentionally dependency-agnostic. We do not assume in advance whether the primary blocker is Git, Node.js, PATH freshness, a broken Claude install, a broken Codex install, or incorrect runtime launch behavior.

After this sprint, a Windows user should see:

- a clear explanation of what is missing or broken
- a recovery action that matches the actual blocker
- no silent hangs during install/setup flows
- no false "installed" state when runtime launch is still broken

## Current Status

As of 2026-03-13, this branch has completed the first shared bootstrap hardening pass:

- shared `AgentEnvironmentStatus` exists in extension and webview code
- Claude and Codex both receive the shared environment status in the AI sidebar
- Claude runtime launch no longer forces the wrong `executable` override
- Codex verify/spawn now reuse the resolved binary path instead of falling back to `codex` from PATH
- Claude setup now blocks misleading install/sign-in actions when Git or PowerShell is missing on Windows
- Codex setup now exposes reload when the shared environment state requires it

Remaining work is primarily real Windows verification, broader recovery-action coverage, and doc/checklist cleanup as gaps are closed.

---

## Problem Statement

Today the Windows setup path is too assumption-driven:

- some missing prerequisites are only emitted as diagnostics
- setup UI is mostly Claude-centric
- Codex runtime is still PATH-sensitive
- runtime launch failures and install failures are not modeled separately

That makes clean-machine behavior unpredictable. When we do not know what a specific machine is missing, the system must detect and classify the blocker instead of guessing it.

---

## Feature Flag Check

- [x] Does this sprint need a feature flag? NO.
  - This is setup/runtime hardening for broken bootstrap paths.
  - The new behavior should replace ambiguous failure states, not introduce an experimental feature path.

---

## Scope Model

This sprint is organized around three layers.

### Layer 1: Detection

Determine what is present, missing, or stale:

- Git available
- Node available if relevant to the current runtime path
- PowerShell available
- Claude installed
- Claude runnable
- Codex installed
- Codex runnable
- restart required after install

### Layer 2: Runtime Hardening

Ensure that "installed" means "can actually launch from Ritemark":

- launch code must use the correct executable path
- native installs must not be forced through the wrong runtime
- PATH fallback logic must be consistent between detection and spawn

### Layer 3: Guided Recovery

For each detected blocker, provide the smallest safe next action:

- install missing dependency
- retry/reload after PATH-sensitive change
- repair broken install
- open manual download when automation is not safe or not available

---

## Success Criteria

### A. Detection and Classification

- [ ] Windows setup logic distinguishes at least:
  - missing prerequisite
  - installed but not runnable
  - installed and runnable
  - restart required
- [ ] Dependency checks do not assume a single root cause
- [ ] Git, PowerShell, Claude install state, and Codex install state are surfaced explicitly
- [ ] Node.js is treated as detected context, not as the default root cause

### B. Runtime Hardening

- [ ] Claude runtime launch path is validated and no longer depends on the wrong `executable`
- [ ] Codex runtime launch uses the resolved binary path consistently
- [ ] A binary outside system PATH can still be verified and launched correctly
- [ ] "Installed" is never reported if runtime verification still fails

### C. Guided Recovery UX

- [ ] Setup UI shows the actual blocker and next action
- [ ] Install flows fail fast with a user-visible error instead of hanging silently
- [ ] Restart-required state is explicit after installs that depend on PATH refresh
- [ ] Windows users are never told to fix the wrong dependency based on assumption alone

### D. Cross-Surface Consistency

- [ ] AI sidebar and settings use the same source of truth for dependency state
- [ ] Webview mirrored types stay aligned with extension types
- [ ] Claude setup and Codex setup can each render shared prerequisite guidance

### E. Cross-Platform Safety

- [ ] macOS behavior is unchanged unless directly required for shared code paths
- [ ] Existing working Windows setups are not regressed
- [ ] `npx tsc --noEmit` passes after each major phase

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Shared dependency model | New environment/bootstrap status independent of Claude-only `SetupStatus` |
| Runtime-hardening update | Fix executable-path handling for Claude and Codex launch paths |
| Shared prerequisite guidance | Reusable UI for missing/stale prerequisites |
| Claude recovery flow updates | Claude setup distinguishes missing prereqs vs broken runtime |
| Codex recovery flow updates | Codex setup distinguishes missing install vs broken runtime vs path fallback |
| Installer fail-fast behavior | Install actions report the actual blocker immediately |
| Restart-required UX | Explicit state after PATH-sensitive installs |

---

## Recommended Status Model

Keep agent-specific state separate from shared environment state.

### Shared environment/bootstrap state

```typescript
interface AgentEnvironmentStatus {
  platform: NodeJS.Platform;
  gitInstalled: boolean;
  nodeInstalled?: boolean;
  powershellAvailable?: boolean;
  restartRequired: boolean;
  recommendedAction:
    | 'install-git'
    | 'install-node'
    | 'reload'
    | 'repair-claude'
    | 'repair-codex'
    | null;
}
```

### Claude-specific state

Keep `SetupStatus` focused on Claude installation/auth/runnability rather than turning it into a universal dependency bag.

### Codex-specific state

Keep Codex state separate, but require it to report:

- resolved binary path
- available vs runnable
- repair guidance that matches the active install path

---

## Implementation Checklist

### Phase 1: Audit and Normalize Detection

- [ ] Extract or centralize reusable checks for `git`, `node`, `powershell.exe`, Claude presence, and Codex presence
- [x] Define shared environment/bootstrap status type in extension code
- [x] Mirror the shared type in webview types
- [x] Ensure settings and AI sidebar can consume the same dependency facts
- [ ] Identify which checks are Windows-only and which are cross-platform
- [ ] Run `npx tsc --noEmit`

### Phase 2: Runtime Hardening

- [x] Validate Claude `AgentRunner` executable handling against native and non-native install paths
- [x] Fix Claude path wiring so discovered binary paths are reused automatically where appropriate
- [x] Fix Codex runtime to verify and spawn using the resolved executable path, not only `codex` from PATH
- [ ] Update any misleading repair text that assumes npm-first recovery on Windows
- [ ] Add/update targeted tests around executable path handling
- [ ] Run `npx tsc --noEmit`

### Phase 3: Shared Recovery States

- [ ] Add environment-aware recovery classification:
  - missing prerequisite
  - broken install
  - installed but reload required
  - ready
- [ ] Keep Claude-specific auth/install states intact where possible
- [x] Ensure Codex setup can surface the same dependency status without abusing Claude-only state
- [ ] Run `npx tsc --noEmit`

### Phase 4: Setup UI Hardening

- [x] Add shared prerequisite/status UI block or equivalent reusable pattern
- [x] Show actual blocker and recommended next action in Claude setup UI
- [ ] Show actual blocker and recommended next action in Codex setup UI
- [ ] Add install / repair / reload / manual-download actions as needed
- [x] Ensure install actions fail visibly and quickly when prerequisites are absent
- [ ] Run `npx tsc --noEmit`

### Phase 5: Optional Automation

- [ ] Add safe automation only for blockers we can confidently resolve
- [ ] Prefer Git automation on Windows when available
- [ ] Keep manual download fallback when automation is unavailable or risky
- [ ] Do not add automation that hardcodes a dependency assumption without detection proving it
- [ ] Run `npx tsc --noEmit`

### Phase 6: Verification

- [ ] Test fresh Windows setup with multiple missing-dependency combinations
- [ ] Test broken-install path where CLI exists but launch fails
- [ ] Test restart-required flow after PATH-sensitive install
- [ ] Test a machine where nothing is missing to confirm no regressions
- [ ] Test macOS for shared-code regressions

---

## Key Files

All paths below are relative to `extensions/ritemark/`.

| File | Change Type | Description |
|------|-------------|-------------|
| `src/agent/setup.ts` | Modify | Centralize dependency detection and status derivation |
| `src/agent/types.ts` | Modify | Keep Claude setup state focused and introduce shared bootstrap types where needed |
| `src/agent/installer.ts` | Modify | Fail fast with actionable blocker-specific errors |
| `src/agent/AgentRunner.ts` | Modify | Harden Claude runtime launch path handling |
| `src/codex/codexManager.ts` | Modify | Harden Codex binary resolution, verification, and spawn behavior |
| `src/views/UnifiedViewProvider.ts` | Modify | Send shared environment/bootstrap status to webview |
| `src/settings/RitemarkSettingsProvider.ts` | Modify | Reuse the same dependency source of truth |
| `webview/src/components/ai-sidebar/types.ts` | Modify | Mirror shared bootstrap status |
| `webview/src/components/ai-sidebar/AISidebar.tsx` | Modify | Route dependency-aware setup surfaces correctly |
| `webview/src/components/ai-sidebar/SetupWizard.tsx` | Modify | Show blocker-specific Claude recovery UI |
| `webview/src/components/ai-sidebar/CodexSetupView.tsx` | Modify | Show blocker-specific Codex recovery UI |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| We optimize for the wrong dependency | High | Keep detection-first architecture; do not anchor sprint on a single prerequisite |
| Runtime still broken after install succeeds | High | Make runtime verification part of install classification |
| Shared status drifts between settings and sidebar | High | Use one source of truth and mirrored types |
| Full UI rewrite expands scope too early | Medium | Reuse shared prerequisite blocks inside existing setup surfaces |
| Windows PATH behavior remains inconsistent after install | Medium | Model explicit `restartRequired` instead of guessing live refresh |
| Claude and Codex need different recovery actions | Medium | Keep shared environment state separate from agent-specific setup state |

---

## Non-Goals

- Solving every Windows packaging or distribution issue
- Forcing all setup flows into one global wizard in this sprint
- Assuming Node.js, Git, or any single dependency is always the primary blocker
- Replacing the current Codex CLI/app-server integration model in this sprint

---

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** Yes

## Approval

- [ ] Jarmo approved this sprint plan
