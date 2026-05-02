# Sprint 57: Windows Onboarding Fix + Architecture Decision

## Goal

Make the first-run Windows path reliable for a non-technical Ritemark user, then choose the next architecture path for Codex/agent support before any Phase 3 implementation starts.

The target user flow is:

```text
download Ritemark -> open a .md file -> sign in -> run AI without terminal/admin setup
```

## Current Status

```text
Current phase: Phase 2 preparation
Selected Phase 3 path: Path A — bundled runtimes in the extension/app package.
Next gate: bundled runtime artifact source/checksum selection.
Implementation status: started.
```

Preparation is intentionally ahead of implementation. The research pass found that the initial "Codex cannot work on Windows" premise was wrong: OpenAI ships native Windows Codex binaries, but Ritemark's current dependency on a globally installed external CLI still creates a fragile onboarding path.

## Feature Flag Check

- Phase 1 bug fixes do not need a feature flag.
- Phase 3 feature flag decision is required before bundled runtime rollout.

Feature flag rationale:

- Workspace Trust off, Claude auth truthfulness, and existing login flow validation are bug fixes.
- Bundled Claude/Codex runtimes introduce platform-specific behavior and should have a kill switch or runtime-selection flag while being validated.
- Use the `feature-flags` skill before implementation if both system-installed and bundled runtime paths remain available.

## User-Visible Problems

Jarmo's clean Windows test exposed four blockers:

1. **Workspace Trust Restricted Mode**: extension functionality is blocked or delayed by a VS Code security prompt.
2. **False "Connected" state**: Settings can show Claude Account as connected even after `claude logout`.
3. **Codex install requires terminal/admin literacy**: global npm install and PowerShell execution policy are not acceptable for the target user.
4. **Git and Node are missing on clean Windows**: the UI reports missing dependencies but does not complete the setup for the user.

## Repo Reality Check

These points correct the initial prep notes against the current codebase:

- The Settings UI already has a Claude sign-in button in `needs-auth` state and a `claude:login` message path.
- `RitemarkSettingsProvider` already starts Claude login by opening the terminal flow.
- The remaining Phase 1C work is therefore validation and UX hardening, not adding the flow from scratch.
- `deriveClaudeSetupStatus()` still treats any non-null auth method as ready.
- `detectClaudeAuthMethod()` still checks credential presence, not token validity.
- `branding/product.json` still does not disable Workspace Trust.
- The official Anthropic Claude Code VSIX was inspected and bundles `resources/native-binary/claude.exe`; Ritemark should not use `install.ps1` or global npm for the happy path.
- Phase 2 deliverables now live as explicit analysis docs:
  - `docs/development/analysis/cli-bundling-research.md`
  - `docs/development/analysis/vscode-fork-vs-separation.md`

## Prior Windows Work To Reuse

Sprint 57 should not re-discover these from scratch:

- `docs/development/analysis/2026-03-06-windows-node-dependency-analysis.md`
- `docs/development/sprints/sprint-44-windows-node-deps/`
- `docs/development/sprints/sprint-49-windows-node-install-ux/`
- `docs/development/sprints/sprint-50-windows-build-emfile/`
- `docs/development/building-windows-installer.md`

Use these as baseline context when planning installer or bundled dependency work.

## Success Criteria

### Phase 1: Immediate Windows Onboarding Fixes

- Clean Windows install can open a `.md` file without showing the Workspace Trust Restricted Mode prompt.
- After `claude logout`, Settings shows sign-in required, not `Connected`.
- Claude sign-in launched from Settings is validated on Windows and macOS.
- Existing macOS behavior is not regressed.

### Phase 2: Decision Preparation

- Current code audit captured in sprint research.
- Codex Windows reality check captured in sprint research.
- CLI bundling analysis exists at `docs/development/analysis/cli-bundling-research.md`.
- VS Code fork vs separation analysis exists at `docs/development/analysis/vscode-fork-vs-separation.md`.
- Official Claude Code VSIX inspection captured in `research/03-official-claude-vsix-inspection.md`.
- Jarmo selected Path A.
- Engineering assumption accepted: redistribute bundled runtimes during implementation spike.
- Legal/redistribution review remains a release gate, not an implementation blocker.

### Phase 3: Implementation

- Path chosen by Jarmo: Path A.
- Feature flag decision recorded if the path introduces platform-specific or parallel-runtime behavior.
- Implementation plan updated with exact files, tests, and rollback path.

## Deliverables


| Deliverable                   | Status                            | Notes                                                                                                                                                                                                                                                                  |
| ----------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace Trust fix           | Implemented, needs clean install validation | Added `security.workspace.trust.enabled: false` in `branding/product.json`; validate with clean user data. Do not blindly copy Anthropic here: their official extension declares untrusted workspaces unsupported. |
| Claude auth validation fix    | Implemented, needs Windows validation       | `ready` now uses `claude auth status --json` when a runnable Claude binary is available instead of only checking credential-store presence.                                                                 |
| Claude in-app login hardening | Re-scoped                         | Existing button and provider path exist; validate and improve UX/reload behavior.                                                                                                                                                                                      |
| Bundled Claude runtime        | Resolver implemented, artifact pending      | Ritemark now looks for platform runtimes under `extensions/ritemark/binaries/agents/<platform>-<arch>/` before PATH/global installs. Do not use `install.ps1` or global npm in the happy path.             |
| Bundled Codex runtime         | Resolver implemented, artifact pending      | Ritemark now prefers bundled `codex-app-server` or full `codex` runtime before PATH/global installs. Exact redistributed artifact still needs source/checksum selection.                                  |
| CLI bundling research         | Drafted                           | See `docs/development/analysis/cli-bundling-research.md`.                                                                                                                                                                                                              |
| Architecture analysis         | Drafted                           | See `docs/development/analysis/vscode-fork-vs-separation.md`.                                                                                                                                                                                                          |
| Phase 3 plan                  | Path chosen                       | Implement Path A using redistributed bundled runtimes. Legal review is deferred to release readiness.                                                                                                                                                                  |


## Phase 1 Checklist

### 1A: Workspace Trust

- [x] Decide Workspace Trust strategy for Ritemark's document-first product.
- [x] Candidate fix: add `"security.workspace.trust.enabled": false` to `branding/product.json` under `configurationDefaults`.
- Alternative: mark only the Ritemark extension as supporting untrusted workspaces if startup behavior is safe without trust.
- Note: official Anthropic Claude Code VSIX declares `untrustedWorkspaces.supported: false`, so its pattern is to require trust for agentic code operations.
- [ ] Verify this is early enough to prevent the first-run trust prompt.
- [ ] Validate with a clean Windows user-data directory.
- [ ] Check that existing patches do not override the setting.

### 1B: Claude Auth Truthfulness

- [x] Replace credential-presence auth status with a validity check.
- [x] Decide the validation command or API path: `claude auth status --json`.
- [ ] Cache validation to avoid slow Settings refresh if Settings refresh proves slow.
- [x] Update setup detection so `ready` requires confirmed auth when a runnable Claude binary is available.
- [x] Add or update tests for logged-out stale credentials.
- [ ] Validate `claude logout` on macOS and Windows.

### 1C: Existing Claude Login Flow Validation

- Confirm `claude:login` from Settings works on clean Windows.
- Confirm login-in-progress state clears after success and after timeout.
- Confirm Settings refreshes to `Connected` only after auth validation passes.
- Improve copy only if validation reveals a confusing terminal/browser handoff.

## Phase 2 Decision Checklist

- Correct the Codex Windows premise: native Windows binaries exist.
- Separate npm/PowerShell shim failure from Codex runtime capability.
- Identify Path A: bundle a native Codex binary/app-server dependency.
- Identify Path B: replace external Codex CLI with in-process OpenAI Responses agent loop.
- Capture Path B supportability risk around ChatGPT OAuth and `chatgpt.com/backend-api/codex`.
- Capture Path A artifact verification risk around exact `codex-app-server` release assets.
- Verify official Anthropic Claude Code VSIX runtime packaging pattern.
- Jarmo chooses Phase 3 path: Path A.
- Engineering assumption: redistribute bundled runtimes for the implementation spike.
- Legal review before release/distribution.

## Phase 3 Candidate Paths

### Path A: Bundle Agent Runtimes

Selected. Use known runtime artifacts and spawn bundled executables rather than relying on globally installed npm packages.

Initial implementation is in place:

- `extensions/ritemark/src/utils/bundledAgentRuntime.ts` resolves extension-owned runtime artifacts.
- `extensions/ritemark/src/agent/setup.ts` prefers bundled Claude before system-installed Claude.
- `extensions/ritemark/src/codex/codexManager.ts` prefers bundled `codex-app-server` or bundled `codex` before system-installed Codex.
- `extensions/ritemark/binaries/agents/README.md` documents the expected per-platform artifact layout.

Claude implementation direction:

- Follow the official Anthropic VSIX packaging pattern verified in `research/03-official-claude-vsix-inspection.md`.
- Bundle a platform-specific Claude runtime under an extension/app-owned resources directory.
- Spawn the bundled runtime directly for the happy path.
- Keep system-installed Claude as an advanced override, not as a first-run requirement.
- Do not run `install.ps1`, `curl | bash`, or `npm install -g` during normal onboarding.

Codex implementation direction:

- Prefer a bundled `codex-app-server` if a public, redistributable artifact is available for the pinned release.
- Otherwise evaluate full `codex.exe`, npm platform package binary extraction, or an internally mirrored runtime.
- Remove global npm/PowerShell/PATH dependency from the happy path.

This is the lower-change path if runtime source, checksums, and update story are verified. Legal review is deferred until the implementation proves the bundled-runtime path works.

### Path B: In-Process OpenAI Agent

Replace `extensions/ritemark/src/codex/` with a TypeScript agent loop using OpenAI Responses API plus Ritemark-owned tools and approval handling.

This is the higher-change path, but it removes external binary management and aligns better with Windows onboarding.

### Path C: Defer Codex Architecture, Ship Phase 1 Only

Fix Workspace Trust and Claude auth/login truthfulness now, then create a separate sprint for Codex architecture after product/legal supportability is settled.

This is the safest short-term release path if Phase 3 decision risk is still too high.

## Remaining Open Questions

1. What exact Codex artifact do we bundle: full `codex.exe`, npm platform package binary, or `codex-app-server` if available for the selected release?
2. Do we need Windows Git/Node bundling in the same Phase 3, or does bundled runtime remove Node from the happy path and leave Git as optional/feature-specific?
3. What is the rollback path if bundled Claude/Codex behavior diverges from current macOS behavior?
4. What legal/redistribution approval is required before public release if the spike works?

## Risks


| Risk                                                     | Probability | Impact | Mitigation                                                                                                                             |
| -------------------------------------------------------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Auth validation is slow                                  | Medium      | Medium | Cache result, use timeout, expose refresh.                                                                                             |
| Workspace Trust default is applied too late              | Medium      | High   | Validate with clean user data; patch core startup if product defaults are insufficient.                                                |
| ChatGPT OAuth backend tightens                           | Medium      | High   | Treat Path B as product/legal decision; keep API-key fallback.                                                                         |
| Exact Codex app-server release artifact is not available | Medium      | Medium | Verify artifact before Path A; consider full `codex.exe` or npm platform package.                                                      |
| Bundled runtime redistribution is not permitted          | Unknown     | High   | Not an implementation blocker. Treat as release gate after proving the technical path; fallback is official extension/runtime channel. |
| Bundled runtime size increases release footprint         | High        | Medium | Use per-platform packages; avoid bundling all platforms into one installer.                                                            |
| Mac regression                                           | Low         | High   | Run setup/auth tests and manual macOS login/logout validation.                                                                         |
| Phase 3 grows into installer + architecture migration    | High        | High   | Choose one Phase 3 path; split Git/Node bundling if needed.                                                                            |


## Timeline

```text
Phase 1: Immediate fixes             1-2 days
Phase 2: Research + decision prep    complete enough for decision
Phase 3A: Bundled runtime path       about 2 weeks after artifact verification
Phase 3B: In-process agent path      about 4 weeks after product/API decision
Phase 3C: Defer architecture         ship Phase 1, create follow-up sprint
```

## Gates

**Sprint approval:** required before implementation starts.

**Phase 2 -> Phase 3:** Path A has been selected. Legal redistribution review is deferred to release readiness.

**Before commit / ready handoff:** use the `qa-validation` skill and run `./scripts/validate-qa.sh`.

## Approval

- Jarmo approved Sprint 57 implementation scope.
- Jarmo selected Phase 3 path: Path A.
