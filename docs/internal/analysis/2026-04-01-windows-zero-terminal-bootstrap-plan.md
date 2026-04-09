# Desktop Dependency Bootstrap Audit + Zero-Terminal Strategy (Windows + macOS)

**Date:** 2026-04-01  
**Priority:** P0 (requested by product owner)  
**Scope:** New desktop users (Windows and macOS) failing AI dependency setup, especially when install paths fall back to terminal-oriented guidance.

---

## 1) Why this is now the most important gap

The prior follow-up correctly focused on Windows, but onboarding risk is cross-platform for non-technical users. macOS users can also hit CLI/auth/bootstrap friction (install scripts, PATH/reload states, shell assumptions). The product requirement should therefore be **desktop-wide zero-terminal onboarding** with OS-specific recovery actions.

---

## 2) Areas previously under-covered (ranked by importance)

## P0 — First-run dependency funnel for non-technical desktop users

Missing depth in earlier docs:
- no unified Windows + macOS setup funnel model
- no explicit “no-terminal-first” contract for either OS
- no shared blocker taxonomy spanning CLI missing, binary unrunnable, reload needed, auth needed

## P1 — Runtime policy consistency between sidebar and flow automation

- insufficient migration sequencing for replacing implicit flow auto-approval
- missing rollout guardrails for existing user workflows

## P2 — Provider lifecycle contract test matrix

- no explicit fixture strategy for Codex JSON-RPC evolution + Claude SDK event evolution
- no CI gate spec for compatibility drift checks

## P3 — Operational telemetry and onboarding analytics

- no baseline event schema for setup drop-offs by OS/provider
- no measurable SLOs for install-success latency

---

## 3) Start covering P0 now: Zero-Terminal Desktop Bootstrap architecture

## 3.1 Product requirement (new)

For non-technical Windows **and** macOS users, setup should satisfy:

- **No copy-paste terminal commands required** for normal install/recovery.
- **Single primary CTA per blocker** (“Install Git”, “Install Claude”, “Reload app”, “Sign in”).
- **Deterministic status model** with plain-language cause + next action.
- **OS-aware recovery UX** while preserving one shared mental model.

## 3.2 Current-state constraints in codebase

The codebase already has building blocks:
- Windows prerequisite checks (`git`, `powershell.exe`) and Claude installer outcomes.
- Codex binary compatibility diagnostics and repair guidance.
- Setup UI surfaces (`SetupWizard`, `CodexSetupView`) that can render richer blocker-driven actions.

Gap: recovery is still too diagnostics/CLI-oriented for non-technical onboarding.

## 3.3 Target shared model

```ts
type BootstrapBlocker =
  | 'missing-git'
  | 'missing-powershell'
  | 'missing-xcode-cli'
  | 'missing-claude-cli'
  | 'missing-codex-cli'
  | 'binary-unrunnable'
  | 'reload-required'
  | 'auth-required'
  | 'unknown';

interface BootstrapStatus {
  os: 'windows' | 'macos';
  provider: 'claude' | 'codex';
  ready: boolean;
  blocker: BootstrapBlocker | null;
  userMessage: string;
  actionLabel: string | null;
  actionId: 'install-git' | 'install-xcode-cli' | 'repair-cli' | 'reload' | 'login' | 'open-help' | null;
  diagnostics: string[];
}
```

## 3.4 OS-specific action resolver

Introduce `BootstrapActionService` in extension host:

- Windows actions
  - `install-git` → open Git for Windows installer page + recheck loop
  - `repair-cli` → provider-specific guided install/login
- macOS actions
  - `install-git` / `install-xcode-cli` → guided install flow with plain-language prompts
  - `repair-cli` → guided provider install/login
- Shared actions
  - `reload`, `login`, `open-help`

Rule: hide raw shell commands by default; allow optional advanced disclosure.

## 3.5 UI contract (single-CTA recovery)

Both setup surfaces should render from the same DTO:
- one blocker headline
- one primary action
- “Show technical details” disclosure for advanced users
- automatic recheck after action completion

---

## 4) Implementation plan (repo-specific)

## Phase 1 (fastest impact)

1. Add shared `BootstrapStatus` mapper from existing Claude/Codex/environment status.
2. Publish bootstrap status to webview regardless of selected provider.
3. Update `SetupWizard` + `CodexSetupView` to single-CTA blocker rendering.
4. Add telemetry:
   - `bootstrap.blocker_detected`
   - `bootstrap.action_clicked`
   - `bootstrap.ready`
   - with `os` and `provider` dimensions.

## Phase 2 (stability)

1. Add debounced post-action health recheck.
2. Add blocker-specific copy for common Windows and macOS signatures.
3. Add provider availability gating in selector with clear “why unavailable” copy.

## Phase 3 (hardening)

1. Add signed helper flows where legal/security permits.
2. Add dashboard + cohorts for onboarding blockers by OS/provider.

---

## 5) Online references informing this plan

- Microsoft WinGet docs (`install`, `settings`, configurations):
  - https://learn.microsoft.com/windows/package-manager/winget/install
  - https://learn.microsoft.com/windows/package-manager/winget/settings
  - https://learn.microsoft.com/windows/package-manager/configuration/create
- Apple developer docs for command line tools distribution paths (Xcode CLT):
  - https://developer.apple.com/xcode/resources/
- Electron/electron-builder packaging and updater guidance:
  - https://www.electron.build/nsis.html
  - https://www.electron.build/squirrel-windows.html
  - https://www.electron.build/auto-update.html

---

## 6) Decisions to make tomorrow

1. Should zero-terminal mode be default on both Windows and macOS?
2. Should unavailable providers be disabled in selector or shown with blocked-state cards?
3. Are external installer handoffs acceptable as first-class CTA actions?
4. Should advanced “copy command” mode be opt-in only?

---

## 7) Immediate next coding tasks

1. Extract bootstrap-state mapper from `setupStatus` + `environmentStatus` + Codex status.
2. Add extension→webview message for normalized bootstrap status.
3. Refactor setup components to blocker/action rendering (Windows + macOS copy variants).
4. Add tests for blocker mapping and CTA rendering behavior.


---

## 8) Deep edge-case coverage (expanded from your feedback)

Your specific example (Node environment mismatch between VS Code runtime and external terminal runtime) is a real P0/P1 failure mode and is already partially visible in current diagnostics. We should treat it as a first-class blocker family, not as generic “broken install”.

### 8.1 Edge-case taxonomy for non-technical onboarding

## Tier A — Prevents setup completion (must be single-CTA recoverable)

1. **Runtime Node mismatch (inside app vs terminal)**
   - Symptom: Codex/Claude installed under one Node runtime (e.g., nvm-managed v20 in terminal), while Ritemark uses another runtime path/version.
   - Existing signal in code: mismatch diagnostics and install-node-version extraction exist for Codex.
   - Risk: user sees “installed but broken” loops and does not understand version manager context.

2. **Architecture mismatch on Apple Silicon**
   - Symptom: x64 install under Rosetta, arm64 runtime in app (or inverse).
   - Existing signal in code: Apple Silicon + x64 install diagnostic line already exists.
   - Risk: wrong native package variant, repeated repair prompts.

3. **Windows shell wrapper path ambiguity**
   - Symptom: `.cmd` wrapper selected where raw JS/exe path is needed (or extensionless shim is selected first).
   - Existing signal in code: explicit comments and logic around `where` returning extensionless shims, and `.cmd` execution behavior.
   - Risk: binary “exists” but fails to execute correctly.

4. **PATH refresh/reload stale state**
   - Symptom: install succeeds but app process PATH is stale until reload.
   - Existing signal in code: `repairAction === 'reload'`, environment `restartRequired` diagnostics.
   - Risk: users think install failed.

## Tier B — Allows completion but causes high confusion/drop-off

5. **Provider auth state drift**
   - Symptom: login opened in browser but callback/session not recognized in app yet.
   - Risk: users re-run login repeatedly.

6. **Offline/filtered network during auth**
   - Symptom: auth-required UI shown but internet/corporate network blocks callback endpoints.
   - Risk: silent looping between sign-in and error.

7. **Multi-version manager shadowing (nvm/fnm/volta/choco/homebrew)**
   - Symptom: “node -v” differs by shell/profile; app process has different PATH order than user terminal.
   - Risk: repair command fixes one shell but not app runtime assumptions.

## Tier C — Secondary, but important for support burden

8. **Restricted PowerShell execution policy / enterprise lock-down (Windows)**
9. **Command Line Tools not present or partial install (macOS)**
10. **Security tools quarantining fresh CLI binary**

### 8.2 Concrete blocker model extension

Extend blocker set to represent these edge cases explicitly:

- `node-runtime-mismatch`
- `arch-mismatch`
- `path-shadowing`
- `shell-wrapper-mismatch`
- `network-auth-blocked`

And include a machine-readable evidence payload:

```ts
interface BootstrapEvidence {
  runtimeNodeVersion?: string;
  installNodeVersion?: string;
  runtimeArch?: string;
  installArch?: string;
  machineArch?: string;
  binaryPath?: string;
  pathSource?: 'where' | 'which' | 'manual';
  stalePathLikely?: boolean;
  networkReachable?: boolean;
  authEndpointReachable?: boolean;
}
```

### 8.3 Single-CTA actions for hard edge cases

For non-technical users, each advanced blocker still maps to one plain action:

- `node-runtime-mismatch` → **“Repair with Ritemark runtime”**
  - Runs managed repair path that aligns install with app runtime, then auto-rechecks.
- `arch-mismatch` → **“Reinstall correct architecture”**
  - Runs architecture-safe repair flow (especially macOS arm64).
- `path-shadowing` / `shell-wrapper-mismatch` → **“Fix CLI path”**
  - Guides/automates preferred binary selection and records chosen path.
- `network-auth-blocked` → **“Open connection help”**
  - Opens targeted help and retry flow with endpoint diagnostics.

Advanced details remain behind disclosure, but primary flow stays single-choice and reversible.

### 8.4 Detection reliability requirements

To avoid false positives/false negatives on these blockers:

1. Evaluate status from a **single extension-host health probe** (not mixed ad hoc probes from webview + extension).
2. Persist last successful runtime fingerprint to compare against newly detected install context.
3. Add confidence grading (`high | medium | low`) when diagnosing mismatch from partial evidence.
4. If confidence is low, default CTA should be **safe diagnostic collection**, not destructive reinstall.

### 8.5 Tests to add immediately (high value)

1. **Node mismatch matrix tests**
   - runtime v20/install v22; runtime v22/install v20; same versions; missing install version.
2. **Arch matrix tests**
   - macOS arm64 machine + x64 install; arm64 install; Intel machine cases.
3. **PATH/shim precedence tests**
   - Windows `where` returns extensionless shim + `.cmd`; ensure expected path chosen.
4. **Reload transition tests**
   - install success -> reload-required -> ready after simulated restart.
5. **UI mapping tests**
   - each new blocker maps to exactly one primary CTA and one user-facing explanation.

---

## 9) “Start covering now” execution plan (next pass)

### 9.1 What to implement first (smallest safe sequence)

1. Add `BootstrapEvidence` + blocker extensions in shared setup typing.
2. Normalize existing Codex diagnostics into structured evidence (node/arch/path).
3. Add a provider-neutral mapper:
   - inputs: setup status + codex status + env status + health probe
   - outputs: `BootstrapStatus` + `BootstrapEvidence`
4. Update setup views to consume blocker+action first, technical details second.
5. Add matrix tests for node/arch/path and UI CTA mapping.

### 9.2 Success criteria (must be measured)

- First-run completion rate for Windows and macOS (new users) increases.
- “Installed but broken” repeat loop rate decreases.
- Median time-to-ready drops.
- Support tickets mentioning `node`, `PATH`, `nvm`, `PowerShell`, or `Rosetta` reduce over 2 releases.

### 9.3 Rollout guardrails

- Feature-flag blocker-driven setup mapper.
- Keep old setup rendering fallback for one release.
- Emit side-by-side telemetry (`legacy_state`, `new_blocker`) during migration.


---

## 10) Update scenarios in onboarding (Codex + Claude)

To prevent regressions after provider updates, onboarding should classify update-related failures separately from fresh-install failures.

### 10.1 New blocker candidates for update transitions

- `provider-update-incompatible`
- `provider-update-auth-reset`
- `provider-update-reload-required`
- `provider-update-repair-required`

### 10.2 Minimal DTO extension

```ts
interface BootstrapStatus {
  // existing fields...
  updateState?: 'none' | 'detected' | 'degraded' | 'blocked';
  providerVersion?: string;
  compatibilityVerdict?: 'supported' | 'degraded' | 'unsupported';
}
```

### 10.3 Non-technical user CTA mapping for updates

- `provider-update-reload-required` → **Reload Ritemark**
- `provider-update-auth-reset` → **Sign in again**
- `provider-update-repair-required` → **Repair provider**
- `provider-update-incompatible` → **Use compatible mode** (temporary degraded mode until app/provider alignment)

### 10.4 Guardrails

1. Never silently downgrade trust/safety settings during update fallback.
2. If compatibility is `degraded`, disable only unsupported capabilities (not full provider) when safe.
3. Emit telemetry separating `first_install` vs `post_update` failures.

