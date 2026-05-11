# Sprint 66: Codex Runtime Hardening

## Goal

Fix the false-negative compatibility probe that shows spurious "limited features" banners for system-installed Codex (#60); bundle the latest stable Codex release (#54); add a power-user toggle to prefer system vs bundled agent runtimes (#58); document upstream Codex skill-manager crash as a known issue (#40).

---

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - **#58 runtime preference toggle:** This is a power-user configuration setting exposed via a VS Code config key, not a feature flag. The setting is present and functional by default (just set to `'bundled'`). No kill-switch scenario applies because the user opts in explicitly by changing the setting. No feature flag needed.
  - All other issues (#54, #60, #40) are bug fixes, version bumps, or documentation — explicitly excluded from feature-flag scope per the skill guide.

---

## Success Criteria

- [ ] System-installed new Rust `codex` binary does not trigger the "Some agent features are unavailable" banner.
- [ ] Bundled Codex version in `manifest.json` matches latest stable upstream release (version TBD by Jarmo at gate — see D1 below).
- [ ] `ritemark.agentRuntime.preference: 'bundled' | 'system'` config key works end-to-end for Codex and Claude.
- [ ] Settings page shows the preference toggle and reflects the active selection.
- [ ] A known-issues doc entry (or Settings diagnostics copy) describes the upstream `codex_core_skills::manager` error and the workaround.
- [ ] `npm run compile` and `./scripts/validate-qa.sh` pass.

---

## Scope

**In scope:**
- Compatibility probe fix for system-installed Codex: try-both-argv in `buildGenerateTypesArgs` + fail-safe optimistic default in `inspectCompatibility` (#60, D2)
- `manifest.json` version bump (Codex only; Claude version unchanged) — target version pinned at Phase 3 start via `gh api` (#54, D1)
- `ritemark.agentRuntime.preference` config key wired through `findBinary` (Codex) and `getCandidateClaudePaths` (Claude) — single global preference key (#58, D5)
- New "Agent Runtime" section in Settings page with two-option dropdown and "Currently active:" chip readout (#58, D5)
- `docs/user/known-issues.md` entry for upstream Codex skill-manager crash (#40, D3)
- Close GitHub issue #40 via `gh issue close` with explanatory comment (no upstream filing) (#40, D4)

**Out of scope:**
- Per-agent (separate codex vs claude) preference keys — locked as single global key (D5)
- Claude binary version bump (not in scope for this sprint)
- Any new network or update-channel code
- Filing upstream issue against openai/codex (D4: close our issue #40 instead)
- Windows-specific testing beyond compile verification

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Probe fix (#60) | `inferCodexRuntimeLaunchMode` or `inspectCompatibility` updated so system Rust Codex app-server binary does not collapse to `false` capability flags |
| Manifest bump (#54) | `manifest.json` `version`, `sourceUrl`, `sha256` fields updated for all three Codex platform entries to latest stable release |
| `README.md` bump (#54) | Version table in `extensions/ritemark/binaries/agents/README.md` updated to match |
| Runtime preference (#58) | `ritemark.agentRuntime.preference` VS Code config key; `findBinary` + `getCandidateClaudePaths` preference-aware; Settings page toggle |
| Known-issue entry (#40) | Entry added to `docs/user/known-issues.md` (created if absent) explaining upstream Codex Rust bug and manual skill-dir deletion workaround |
| Issue #40 close (#40) | `gh issue close 40 --repo ProductoryHQ/ritemark-native --comment "..."` with explanation linking to known-issues.md |

---

## Implementation Checklist

### Issue #54 — Bump bundled Codex to latest stable

- [ ] At Phase 3 start, run `gh api repos/openai/codex/releases/latest --jq '.tag_name'` (or `gh release list --repo openai/codex --limit 5`) to determine the latest stable tag; pin to that version (D1: deferred to Phase 3 start, no version chosen now)
- [ ] Update `version`, `sourceUrl`, `sha256`, `archivePath` for all three Codex entries in `manifest.json` (darwin-arm64, darwin-x64, win32-x64)
- [ ] Update `generated` date in `manifest.json`
- [ ] Update version table row in `extensions/ritemark/binaries/agents/README.md`
- [ ] Verify `invocationMode` has not changed in the new release (inspect tarball or release notes)
- [ ] Update informational comment in `codex/codexApproval.ts` line 8 and `codex/codexProtocol.ts` line 6 if they reference the old version

### Issue #60 — Fix false-negative compatibility probe

**Locked approach (D2): combined (b)+(a) — try-both-argv + optimistic fail-safe.**

- [ ] In `buildGenerateTypesArgs`: instead of branching on `launchMode`, try the form matching `launchMode` first; on non-zero exit, try the other form; accept whichever returns status 0 (primary fix — handles launchMode misdetection)
- [ ] In `inspectCompatibility`: if BOTH argv forms fail (probe returns non-zero for both), default all capability flags to `true` — do NOT collapse to `false` (secondary safety net — handles future Codex binary shape changes)
- [ ] The banner fires only on positive evidence of incompatibility, never on probe failure
- [ ] Leave `buildAppServerArgs` unchanged — only `buildGenerateTypesArgs` and its caller `inspectCompatibility` receive the try-both logic
- [ ] Verify `buildCompatibilityStatus` returns `'compatible'` when all three capability flags are `true`
- [ ] Verify `getCompatibilityNotice` in `CodexView.tsx` returns `null` for a `'compatible'` status (no banner shown)
- [ ] Confirm bundled path continues to work (regression guard)

### Issue #40 — Upstream crash documentation

**Locked approach (D3 + D4): known-issues.md doc entry + close our issue #40, no upstream filing.**

- [ ] Create `docs/user/known-issues.md` if it does not exist
- [ ] Add entry explaining: the crash originates in `codex_core_skills::manager` (upstream OpenAI Codex Rust binary), not the Ritemark extension layer; workaround is to manually delete the Codex skills directory; Ritemark cannot fix this in our layer
- [ ] Close GitHub issue #40 via `gh issue close 40 --repo ProductoryHQ/ritemark-native --comment "..."` with a comment that: (a) explains the bug is in upstream `codex_core_skills::manager`, (b) links to `docs/user/known-issues.md`, and (c) notes a Codex version bump (issue #54) may pick up an upstream fix if/when OpenAI ships one
- [ ] No upstream issue filing against openai/codex (D4)

### Issue #58 — Runtime preference toggle

- [ ] Add `ritemark.agentRuntime.preference` to `extensions/ritemark/package.json` `contributes.configuration` (`enum: ['bundled', 'system']`, default `'bundled'`, markdownDescription explaining both values)
- [ ] In `codexManager.ts` `findBinary`: read preference; if `'system'` skip bundled lookup and go straight to `findBinaryInPath`; if `'bundled'` keep existing order (bundled first, system fallback)
- [ ] In `agent/setup.ts` `getCandidateClaudePaths`: read preference; if `'system'` move bundled path to end of candidate list (or omit); if `'bundled'` keep bundled path first
- [ ] Add message handler in `RitemarkSettingsProvider.ts` to read and update the preference value
- [ ] Add new "Agent Runtime" section to `RitemarkSettings.tsx` with: a two-option dropdown ("Bundled (recommended)" / "Use system install") and a "Currently active:" readout using the existing `runtimeSource` chip below the dropdown (D5: separate labelled section, single global preference key for both Claude and Codex)
- [ ] Rebuild webview bundle after settings UI change
- [ ] Confirm `npm run compile` passes

---

## Test Plan

### #54 (version bump)
- Run `scripts/fetch-agent-runtimes.sh` locally to pull the new archives; SHA-256 verification must pass without modification.
- Confirm extension compiles cleanly after the comment-only source file touches.

### #60 (probe fix)
- With a system-installed new Rust `codex` binary on PATH: launch Ritemark in dev mode, open Codex panel. Compatibility banner must **not** appear (try-both-argv succeeds on first or second form).
- With no system Codex and bundled binary present: banner must **not** appear (regression guard — `buildAppServerArgs` unchanged).
- Simulate a probe failure for both argv forms (e.g., via unit test or temporary stub): verify all capability flags default to `true` and banner does not appear (optimistic fail-safe).

### #40 (documentation)
- No runtime behaviour change — no execution test required. Verify the workaround note renders correctly in the chosen UI surface.

### #58 (preference toggle)
- Set `ritemark.agentRuntime.preference: 'system'` via Settings page; restart extension; confirm `runtimeSource` chip shows `system`.
- Set to `'bundled'`; confirm bundled path is selected even when system Codex is on PATH.
- Verify Settings page renders without blank screen or console errors after the new toggle is added.

---

## Pre-Commit Invariants to Watch

The pre-commit hook validates:
1. `vscode/extensions/ritemark` symlink intact — not affected by this sprint.
2. `media/webview.js` > 500 KB — **watch**: issue #58 adds UI to `RitemarkSettings.tsx`; rebuild webview before staging.
3. `postcss.config.js` not empty — not affected.
4. No raw `@tailwind` in bundle — not affected, but rebuild ensures processed CSS.
5. Webview source staged → bundle must also be staged — **watch**: whenever `RitemarkSettings.tsx` or any webview file is staged, `media/webview.js` must be rebuilt and staged too.
6. `ai-sidebar` sentinel in bundle — not affected.
7. Extension TypeScript compiles — **watch**: all four issues touch `.ts` files; run `npm run compile` before each commit.
8. Settings page integrity (400+ line guard) — not affected; we are adding to `RitemarkSettings.tsx`, not removing.

---

## Phase 3→4 Handoff Criteria

- All checklist items above checked off.
- `npm run compile` exits 0.
- `./scripts/validate-qa.sh` exits 0.
- Dev instance smoke: Codex panel opens without compatibility banner using system Rust binary.
- Dev instance smoke: Settings page shows preference toggle and reflects selection changes.
- Manifest SHA-256 values verified by `fetch-agent-runtimes.sh` download.

---

## Locked Decisions

### D1 — Latest stable Codex version (#54)
**Locked:** Defer version pinning to Phase 3 start. Claude will run `gh api repos/openai/codex/releases/latest --jq '.tag_name'` (or `gh release list --repo openai/codex --limit 5`) and pin to whatever latest stable tag is returned. No version chosen at plan time.

### D2 — Probe fix candidate (#60)
**Locked:** Combined approach (b)+(a).
1. Primary: in `buildGenerateTypesArgs`, try both argv forms sequentially (form matching `launchMode` first, then the other); accept whichever returns status 0.
2. Secondary safety net: if BOTH forms fail, default all capability flags to `true` (optimistic) — do NOT collapse to `false`. Banner fires only on positive evidence of incompatibility.
`buildAppServerArgs` is not changed.

### D3 — Surface for #40 workaround copy
**Locked:** `docs/user/known-issues.md`. Create if absent. Brief entry explaining the upstream Codex Rust bug in `codex_core_skills::manager`, how to manually delete the skills directory as a workaround, and noting that Ritemark cannot fix this in our layer.

### D4 — Upstream issue filing for #40
**Locked:** Do not file upstream. Close our issue #40 via `gh issue close 40 --repo ProductoryHQ/ritemark-native --comment "..."` with a comment that explains the bug is in upstream `codex_core_skills::manager`, links to `docs/user/known-issues.md`, and notes the Codex version bump (#54) may pick up an upstream fix if/when OpenAI ships one.

### D5 — Preference toggle UI placement (#58)
**Locked:** New "Agent Runtime" section in the Settings page. Two-option dropdown ("Bundled (recommended)" / "Use system install"). Existing `runtimeSource` chip becomes a "Currently active:" readout below the dropdown. Single global preference key applies to both Claude and Codex (not per-agent).

---

## Status

**Track:** Full 6-phase
**Current Phase:** 4 (Test + Validate) — complete; ready for commit
**Approval Required:** Yes (granted)

## Approval

- [x] Jarmo approved this sprint plan (Phase 2→3 gate opened 2026-05-11)
- [x] Phase 4 smoke tests pass (Codex 0.130.0 bundled = `compatible` via fail-safe; preference toggle switches resolver bundled↔system end-to-end)
