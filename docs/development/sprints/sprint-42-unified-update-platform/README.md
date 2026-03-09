# Sprint 42: Unified Update Platform

## Status

In progress

## Summary

This sprint turns Ritemark's fragmented update-related flows into one coherent platform from the user's point of view.

The sprint does **not** attempt to build a native silent app updater yet. Instead, it fixes the highest-leverage problems first:

- update eligibility and version resolution
- visibility and user control
- release metadata consistency
- clearer distinction between Ritemark-managed components and external tools

## Goal

Make updates feel deterministic, trustworthy, and easy to act on without changing Ritemark's local-first product model.

## Documents

| Document | Purpose |
| --- | --- |
| [sprint-plan.md](./sprint-plan.md) | Main sprint plan with scope, success criteria, phases, and validation |
| [research/update-feed-contract.md](./research/update-feed-contract.md) | Proposed update feed schema, component policy, and resolver rules |
| [2026-03-07-automatic-updates-strategy.md](../../../../docs-internal/analysis/2026-03-07-automatic-updates-strategy.md) | Source strategy document that this sprint operationalizes |

## Scope Boundary

Included in this sprint:

- compatibility-aware update resolution
- Update Center in settings
- manual update check
- better notification preferences
- release metadata standardization
- visibility for voice model and external tool status

Explicitly not included in this sprint:

- native silent app auto-updater
- background third-party CLI auto-updates
- account-based update delivery
- phased rollouts

## Intended Outcome

After this sprint:

- users can see update state in one place
- the app can recommend the correct next action instead of blindly following `latest`
- extension-only releases no longer hide required full app updates
- update notifications become less fragile and less annoying
- release automation produces metadata that the client can actually trust

## Progress Log

### 2026-03-08

Implemented in product code:

- canonical update feed generation and resolver-based update selection
- Settings `Update Center` with manual check, install/download, skip, pause, resume, and restart-required handling
- component readiness cards for voice model, Claude Code, and Codex CLI
- Codex CLI diagnostics and repair UX in Settings, including repair terminal, reload action, Node/arch mismatch diagnostics, and broken-install handling
- Codex account auth migrated to the current app-server account API (`account/read`, `account/login/start`, `account/logout`)
- AI sidebar Codex state machine with explicit `broken-install`, `needs-auth`, `auth-in-progress`, and `ready` flows
- AI sidebar Codex setup card simplified for average users: primary action first, diagnostics hidden under technical details, and offline sign-in blocked with clearer copy
- fixed a follow-up runtime crash in the simplified Codex sidebar card caused by a missing `disabled` prop binding
- simplified the sidebar card further by removing low-signal secondary actions (`Refresh Status`, `Open Settings`) and turning `Technical details` into a lightweight text disclosure
- logout/login state propagation between Settings and the AI sidebar so sidebar no longer waits for the next failed prompt to notice auth changes
- Claude bootstrap hardening on macOS and Windows 11: explicit `not-installed / broken-install / needs-auth / auth-in-progress / ready` state model
- Claude health checks now require a runnable binary, not just a discovered path, and runtime execution uses the resolved absolute Claude executable path
- Claude install flow now distinguishes `installed`, `installed_needs_reload`, `verification_failed`, and `install_failed`
- Claude install/login state now auto-refreshes in both Settings and the AI sidebar without relying on a manual `Recheck status` loop
- Claude sidebar setup UX replaced with a simpler action-first card covering install, repair, sign-in, reload, and technical details
- Settings component readiness now shows Claude as `Ready`, `Signing in`, `Needs login`, `Broken`, or `Not installed`, with recovery actions and collapsed diagnostics
- Settings now also has a dedicated `Claude Account` box, parallel to the ChatGPT/Codex account box, so Claude auth/setup state is visible in the same API/account surface where users expect it
- Claude Account box now supports `Sign Out` for active Claude.ai auth, using the official Claude CLI logout command and immediately propagating the signed-out state back to Settings and the sidebar
- user-facing Claude naming cleaned up across selector, prompts, settings copy, and feature descriptions to avoid presenting the embedded experience as `Claude Code`
- added targeted automated tests for Claude setup-state derivation and install outcome classification
- fixed Codex image attachments so pasted screenshots/images are serialized in the app-server format Codex actually expects (`url` data-URI payload on `type: "image"` inputs), which restores screenshot delivery to the Codex agent
- removed image token estimation/warning UI from the Codex chat input so image attachments no longer show guessed per-image token counts
- removed low-signal Codex debug logging from the sidebar runtime so normal agent use no longer floods the extension host/dev console with item/notification chatter

Current emphasis:

- validating the refreshed Claude and Codex sidebar flows in the dev host
- keeping sprint docs aligned with shipped implementation rather than leaving them as planning-only artifacts
