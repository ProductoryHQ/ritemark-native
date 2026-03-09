# Sprint 42: Unified Update Platform

## Goal

Turn Ritemark's fragmented update-related flows into one compatibility-aware, user-visible update platform without introducing a native silent updater yet.

This sprint is the foundation sprint for update robustness. It focuses on:

- correct update resolution
- better user control and visibility
- consistent release metadata
- a single product-level story across app updates, extension updates, voice model downloads, and external tool setup

## Feature Flag Check

- [x] Does this sprint need a feature flag? NO.
  - This sprint hardens existing behavior and adds visibility for already-shipping features.
  - It does not introduce a new experimental end-user capability.
  - Update safety and clarity should improve for all users, not a gated subset.

## Success Criteria

- [ ] Ritemark resolves the **correct** next update action for the current installation instead of relying on `releases/latest` alone
- [ ] If the newest release is extension-only but the user's base app is outdated, Ritemark still offers the correct full app update
- [ ] `minimumAppVersion` is enforced for extension updates
- [ ] Users can manually trigger `Check for updates now` from Settings
- [ ] Settings show current app version, current extension version, last successful check time, and current update state
- [ ] Users can distinguish `Skip this version`, `Pause notifications`, and `Disable checks`
- [ ] The invisible global `Don't Show Again forever` behavior is removed or replaced with explicit controls
- [ ] Full app update notifications and extension update notifications both include version and action context
- [ ] Voice dictation model status is visible in Settings
- [ ] Claude Code / Codex status is visible in Settings as external-tool status, not as a hidden failure mode
- [ ] Release automation outputs canonical update metadata and asset references for the client
- [ ] Version-resolution logic is covered by automated tests for the main upgrade paths

## Deliverables

| Deliverable | Description |
| --- | --- |
| Update feed contract | Canonical schema describing full app updates, extension-only updates, compatibility, and release metadata |
| Compatibility-aware resolver | Client logic that selects the correct next action for the current app/platform/arch/version |
| Update Center | Settings UI showing version state, last check, manual check, notification preferences, and pending actions |
| Notification preference model | Replace coarse global opt-out with explicit skip/snooze/disable behavior |
| Component status cards | Settings visibility for voice model and external tool readiness |
| Release metadata standard | One naming and manifest strategy across full and extension releases |
| Test matrix | Automated validation for version path resolution and preference behavior |
| Documentation updates | Release workflow and troubleshooting documentation aligned with the new model |

## Problem Statement

Ritemark currently has multiple update-like flows that users experience as one product problem:

- app updates
- extension-only hotfixes
- voice model downloads
- external AI tool installation/setup

The current implementation works in isolated cases, but it does not reliably answer the user's core question:

> "Is my Ritemark install up to date, complete, and ready to use?"

The biggest current architecture gap is that the update logic is based on the latest release rather than the best next action for the current install.

## Scope

### In Scope

- update feed / metadata design and client consumption
- resolver logic for full vs extension updates
- Settings UI for update state and actions
- manual update check
- better update preference semantics
- voice model visibility in Settings
- external CLI visibility in Settings
- release script and release docs changes needed to support the new contract
- automated tests for resolution logic

### Out of Scope

- native silent updater
- phased rollout infrastructure
- forced security update policy
- automatic background updates for third-party CLIs
- cloud account or entitlement system

## User Experience Target

At the end of this sprint, the user should be able to open Settings and immediately understand:

- what version of Ritemark they are running
- whether anything newer is available
- whether action is needed now
- whether optional components are installed
- what is managed by Ritemark vs by the user

The system should also behave correctly when the "latest release" is not the correct release for the current install.

## Implementation Checklist

### Phase 1: Define the update contract

- [ ] Finalize the `update-feed` schema from [research/update-feed-contract.md](./research/update-feed-contract.md)
- [ ] Decide the v1 host for the canonical feed
  - Recommended for this sprint: a static JSON endpoint outside `releases/latest`
  - Long-term worker/service can come later
- [ ] Define canonical asset naming for:
  - macOS Apple Silicon installer
  - macOS Intel installer
  - Windows installer
  - extension-only release assets
  - update metadata files
- [ ] Define release metadata fields:
  - version
  - component type
  - compatibility range
  - platform / arch
  - size
  - checksum
  - summary release notes
- [ ] Document the rule that `minimumAppVersion` is authoritative for extension updates

### Phase 2: Replace latest-only resolution with compatibility-aware resolution

- [ ] Add a new client resolver module under `extensions/ritemark/src/update/`
- [ ] Resolve update actions from a feed, not only from `GitHub Releases latest`
- [ ] Support these outcomes:
  - `none`
  - `extension`
  - `full`
  - `blocked_requires_newer_app`
  - `error`
- [ ] Implement the core rule:
  - if an extension-only release is newer but incompatible with the current app base, surface the correct full app update instead of returning nothing
- [ ] Enforce `minimumAppVersion` during extension resolution
- [ ] Keep a safe fallback path for older releases without the new feed
- [ ] Add unit tests for main resolution paths:
  - current app behind latest full release
  - current app matches base, extension build behind
  - current app behind while newest tag is extension-only
  - no update needed
  - downgrade attempt

### Phase 3: Rework update state and preferences

- [ ] Replace the current single global "Don't Show Again" semantics with explicit stored preferences
- [ ] Add storage keys for:
  - skipped version
  - snooze until timestamp
  - updates enabled
  - last successful check timestamp
  - last failed check timestamp
- [ ] Preserve backward compatibility with existing storage where reasonable
- [ ] Use `lastCheckTimestamp` to avoid redundant checks during the same time window
- [ ] Support manual checks that bypass the normal interval
- [ ] Define exact behavior for:
  - `Later`
  - `Skip this version`
  - `Pause for 7 days`
  - `Disable checks`

### Phase 4: Build Update Center in Settings

- [ ] Extend `RitemarkSettingsProvider.ts` to send update status payloads to the webview
- [ ] Extend `RitemarkSettings.tsx` with an `Update Center` section
- [ ] Show:
  - current app version
  - current extension version
  - last checked time
  - current update state
  - available update summary
  - pending restart indicator
- [ ] Add actions:
  - `Check now`
  - `Install update`
  - `Restart to apply`
  - `Skip this version`
  - `Pause notifications`
  - `Re-enable notifications`
- [ ] Make full update vs extension update copy clearly different
- [ ] Show short release-note summary where available

### Phase 5: Expose component readiness beyond app/extension

- [ ] Add read-only voice model status to Settings
  - installed / not installed
  - model name
  - size on disk if available
- [ ] Add read-only external tool status to Settings
  - Claude Code: installed / needs login / not installed
  - Codex: installed / not installed
- [ ] Keep these statuses clearly labeled as external dependencies, not Ritemark self-update actions
- [ ] Do not add auto-update for external tools in this sprint

### Phase 6: Update notification UX

- [ ] Rewrite notification copy in `updateNotification.ts` so it always names the target version
- [ ] Distinguish the notification CTA based on action type:
  - full app update
  - extension update
- [ ] Add explicit "skip" behavior instead of a vague permanent dismissal
- [ ] Ensure a successful extension install moves the state to `ready_to_restart`
- [ ] Ensure a full app update selection does not suppress all future update visibility

### Phase 7: Release automation and documentation

- [ ] Update release scripts to emit canonical metadata expected by the client
- [ ] Ensure extension release automation and full release automation follow the same metadata model
- [ ] Standardize asset names in scripts and docs
- [ ] Update release documentation to explain:
  - what gets published
  - where the feed lives
  - how compatibility is declared
  - how manual checks and update preferences behave
- [ ] Update troubleshooting docs for common update states and recovery paths

### Phase 8: Validation

- [ ] Add automated tests for update resolution logic
- [ ] Add automated tests for notification preference behavior
- [ ] Test manual `Check now` flow
- [ ] Test extension update flow with compatible base version
- [ ] Test extension-only latest release while current install requires full app update
- [ ] Test full app update flow on macOS and Windows asset resolution logic
- [ ] Test Settings UI rendering when:
  - no update is available
  - extension update is available
  - full update is available
  - last check failed
- [ ] Verify old persisted preferences do not leave users permanently stranded without update visibility

### Phase 9: Claude bootstrap hardening and UX parity

- [x] Replace Claude’s boolean setup model with explicit states: `not-installed`, `broken-install`, `needs-auth`, `auth-in-progress`, `ready`
- [x] Add runnable-binary verification so Claude is not marked usable when the binary exists but cannot start
- [x] Resolve and reuse Claude’s absolute command path for login and runtime actions
- [x] Keep Claude install vendor-managed, but classify install outcomes as `installed`, `installed_needs_reload`, `verification_failed`, or `install_failed`
- [x] Add Windows 11 prerequisite diagnostics for Git for Windows / shell availability
- [x] Remove manual `Recheck status` dependency and refresh Claude state automatically after install/login/logout
- [x] Extend Settings Claude card to support broken-install diagnostics and recovery actions
- [x] Replace the sidebar checklist wizard with the same action-first recovery pattern now used for Codex
- [x] Re-verify Anthropic setup/auth requirements against official docs and align user-facing behavior with supported `Claude.ai` and `Anthropic API key` auth modes
- [x] Add targeted tests for Claude setup-state derivation and install outcome classification

## Technical Notes

### Current files expected to change

Core update logic:

- `extensions/ritemark/src/update/updateService.ts`
- `extensions/ritemark/src/update/githubClient.ts`
- `extensions/ritemark/src/update/updateStorage.ts`
- `extensions/ritemark/src/update/updateScheduler.ts`
- `extensions/ritemark/src/update/updateNotification.ts`
- new resolver / feed parsing files under `extensions/ritemark/src/update/`

Settings and UI:

- `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts`
- `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx`

Component visibility:

- `extensions/ritemark/src/voiceDictation/modelManager.ts`
- existing Claude / Codex setup status utilities

Release pipeline:

- `scripts/create-extension-release.sh`
- `scripts/release-dmg.sh`
- possibly a new feed-generation script if needed

### Key architecture decision for this sprint

This sprint should **not** build a backend-heavy update service.

Recommended v1 approach:

- publish one stable update feed
- let release automation regenerate it
- let the app resolve from that feed

This is enough to remove the most serious correctness issues without adding a full cloud dependency.

## Risks & Mitigation

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Resolver scope creeps into a full updater rewrite | Medium | Keep this sprint focused on metadata, resolution, UI, and preference model |
| Static feed becomes stale if release automation skips it | Medium | Make feed generation part of the release checklist and scripts |
| Existing users carry old `dontShowAgain` state forward | High | Add migration logic and explicit re-enable controls in Settings |
| Asset naming cleanup touches too many docs at once | Medium | Standardize scripts first, then update the most user-facing docs in this sprint |
| External tool status adds noise to Settings | Low | Keep it read-only and clearly separated from Ritemark-managed updates |

## Definition of Done

- [ ] Sprint success criteria met
- [ ] Resolver tests cover the main compatibility paths
- [ ] Settings expose a usable Update Center
- [ ] Release metadata contract is documented and implemented in release docs/scripts
- [ ] User-facing update behavior is clearer than today in both notification and settings surfaces

## Status

**Current Phase:** Implementation and stabilization  
**Implementation:** In progress

## Progress Update

### 2026-03-08

Completed since planning:

- added canonical update-feed generation to release scripts and client-side feed parsing/resolution
- replaced latest-only update selection with compatibility-aware resolver logic
- shipped Settings `Update Center` with manual checks, skip/pause/resume controls, current versions, last check timestamps, and restart-required state
- exposed component readiness for voice dictation model, Claude Code, and Codex CLI
- hardened Codex setup UX in Settings with binary health checks, repair command generation, reload action, and Apple Silicon / Node-version diagnostics
- migrated Codex auth from legacy `loginChatGpt` RPC usage to current account APIs
- fixed `initialize` / `initialized` handshake handling for Codex app-server auth requests
- added AI sidebar Codex gating so users now see:
  - broken install state with repair actions
  - sign-in state when CLI is ready but account is not authenticated
  - in-progress login state while browser auth is underway
  - chat UI only when Codex is actually ready
- simplified the sidebar Codex setup card so the default view is task-oriented, while version/path diagnostics are moved behind a technical-details disclosure
- added logout/login propagation between Settings and AI sidebar so auth changes are reflected immediately instead of only after a failed prompt

Still being validated:

- end-to-end sidebar logout -> sign-in -> ready transitions in dev host
- final polish of sidebar copy and any remaining edge-case recovery UX

## Approval

- [ ] Jarmo approved this sprint plan
