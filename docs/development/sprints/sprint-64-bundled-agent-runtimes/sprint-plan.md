# Sprint 64: Bundled Agent Runtimes

## Goal

Ship Codex and Claude runtimes inside the Ritemark app bundle so that a clean install has working app-owned agent runtimes with no terminal, npm, Node, PATH, or architecture knowledge required from the user. Settings should show `Ready` only after auth/account checks pass; otherwise it should show `Runtime installed — sign in required`.

---

## Locked Decisions (Jarmo, 2026-05-06)

| Question | Decision |
|---|---|
| Q1 — Feature flag | **On by default. No new flag.** Bundled-runtime preference is installation architecture, not a user-visible experiment. |
| Q2 — Artifact source | **Build-time fetch.** Codex from GitHub Releases tarballs; Claude from npm optional packages. Pinned by version + sha256 in `manifest.json`. Binaries `.gitignore`d. |
| Q3 — Platform scope | **macOS arm64, macOS x64, Windows x64 — all three in Sprint 64.** Windows arm64 deferred. |
| Q4 — Update story | **Manual.** Runtime versions ship with Ritemark releases. Settings exposes a "Check for updates" button that triggers the existing Ritemark app-update check. Background auto-update deferred to a future sprint. |
| Q5 — Repair UI | **Check + Repair only.** Defer "Use system runtime" override (needs separate UX work). |

---

## Success Criteria

- [ ] A clean Ritemark install on each in-scope platform (macOS arm64, macOS x64, Windows x64) — no system Codex, no system Claude, fresh user-data dir — contains and selects bundled runtimes for the host architecture without any Node/npm/PATH/manual install step.
- [ ] The production `.app` / installer for each platform contains the manifest-defined Codex and Claude artifacts under `…/extensions/ritemark/binaries/agents/<platform>-<arch>/`.
- [ ] `build-prod.sh` and `build-prod-windows.sh` (and any other production build entrypoints) fail with a non-zero exit if required runtime artifacts are absent or wrong architecture for the build target.
- [ ] `validate-build-output.sh` includes architecture-specific binary checks that pass the above condition for every in-scope platform.
- [ ] Settings separates runtime health from auth state: `Runtime installed — sign in required` when bundled runtime is healthy but auth is missing; `Ready` only when runtime and auth/account checks pass.
- [ ] Settings surfaces a "Check for updates" button that invokes the existing Ritemark app-update check (no separate runtime update channel in this sprint).
- [ ] Settings exposes "Check agent installation" and "Repair bundled runtime" actions per Q5; the "use system runtime" override is intentionally not shipped.
- [ ] `thread/start` timeout surfaces a progress message after ~10 s, not a bare `RPC call ... timed out after 30000ms` error after 30 s.
- [ ] Runtime artifact payloads are not committed to the repo — only `manifest.json` and the README.
- [ ] No regression on existing macOS auth/login flow.

---

## Deliverables

| Deliverable | Description |
|---|---|
| Artifact manifest (`manifest.json`) | Machine-readable source-of-truth: vendor, upstream version, sha256, platform/arch, source URL, archive entry, installed name, invocation mode, validation command, license metadata. Lives at `extensions/ritemark/binaries/agents/`. |
| Per-platform runtime artifacts (built locally / in CI, not committed) | `darwin-arm64/`, `darwin-x64/`, `win32-x64/` populated by `fetch-agent-runtimes.sh` from manifest. Payloads `.gitignore`d. |
| `scripts/fetch-agent-runtimes.sh` | Reads manifest, downloads from GitHub Releases (Codex) or npm optional packages (Claude), verifies sha256 before extraction, installs to `binaries/agents/<platform>-<arch>/<installName>`. Idempotent; usable in CI and locally. |
| Build gates in production build scripts | Pre-gulp step in `build-prod.sh` and `build-prod-windows.sh` (and any other production build entrypoints) verifies artifacts exist and match target arch. Exits non-zero if missing/wrong. |
| Build gate in `validate-build-output.sh` | Post-build `file` / PE-header checks for binary arch on each in-scope platform. |
| Runtime/auth status model + Settings UI | Separate runtime and auth states: `Runtime missing`, `Architecture mismatch`, `Runtime installed — sign in required`, `Ready`, with `bundled` / `system` source labels. |
| Settings actions (Q5 scope) | "Check agent installation" (health check) and "Repair bundled runtime" (re-run fetch) for both Codex and Claude. "Use system runtime" override deferred. |
| Settings "Check for updates" button (Q4 scope) | Wires Settings to the existing Ritemark app-update check. No separate runtime update channel in this sprint. |
| `thread/start` timeout UX improvement | Progress message at ~10 s, extended timeout to 60 s for thread creation, diagnostics snapshot on failure. |
| `manifest.json` + `README.md` | `binaries/agents/README.md` documents the manifest schema, fetch workflow, and which payload paths are gitignored. |
| Bonus track: selected-text docked context tab | Move selected-text context from the global Agent Chat Panel banner into the composer area using Sprint 62 option S5. Details: `notes/bonus-track-selected-text-docked-context-tab.md`. |

---

## Implementation Checklist

### Phase A — Artifact contract and manifest (blocks packaging)

Phase A defines the exact runtime contract before any build script or UI work begins. The sprint no longer treats `codex` vs `codex-app-server` as an informal option: the manifest must say exactly how Ritemark invokes each artifact.

- [ ] Create `extensions/ritemark/binaries/agents/manifest.json`.
- [ ] Manifest schema includes: `agent`, `vendor`, `version`, `platform`, `arch`, `sourceType` (`github-release` | `npm-optional-package`), `sourceUrl` / `npmPackage`, `sha256`, `archivePath`, `installName`, `invocationMode`, `validationCommand`, `expectedFileArch`, `license`.
- [ ] Codex entry explicitly chooses one invocation mode:
  - `cli-subcommand`: Ritemark runs `<path>/codex app-server`; or
  - `direct-app-server`: Ritemark runs `<path>/codex-app-server`.
- [ ] Claude entry explicitly identifies the runnable `claude` binary path inside the npm optional package after extraction.
- [ ] Populate manifest with all three in-scope targets: `darwin-arm64`, `darwin-x64`, `win32-x64`.
- [ ] Update `extensions/ritemark/binaries/agents/README.md` with the schema, invocation contract, and local fetch workflow.
- [ ] Add `.gitignore` rules for `binaries/agents/<platform>-<arch>/` payloads, while keeping `manifest.json` and `README.md` tracked.

**Files touched:** `extensions/ritemark/binaries/agents/manifest.json`, `extensions/ritemark/binaries/agents/README.md`, `.gitignore`.
**Blocked by:** Nothing — Q2/Q3 are locked.
**Success:** Manifest defines exact source, hash, extraction path, installed executable name, invocation mode, and validation command for every in-scope runtime on every in-scope platform.
**Agent:** sprint-manager owns contract wording; vscode-expert owns schema practicality.

---

### Phase B — Fetch/extract/verify script

Create the deterministic materialization step. This may download artifacts, but production success depends on manifest-pinned sha256 verification, not on trusting latest vendor output.

- [ ] Write `scripts/fetch-agent-runtimes.sh`: reads manifest, downloads archive/package per `sourceType`, verifies sha256 before extraction, extracts `archivePath`, installs to `binaries/agents/<platform>-<arch>/<installName>`.
- [ ] Script supports `--platform`, `--arch`, `--agent`, `--verify-only`, and default current host detection.
- [ ] Script handles both `github-release` (tarball/zip) and `npm-optional-package` (Claude) source types.
- [ ] Script handles POSIX (`darwin-*`) and Windows (`win32-x64`) extraction; Windows artifacts are `.exe` payloads inside `.tar.gz`.
- [ ] **Single-file extraction case for Codex:** Codex tarballs extract a single platform-suffixed binary at archive root (e.g. `codex-app-server-aarch64-apple-darwin`) — `archivePath` contains no `/`. The fetch script must detect this case (no `/` in `archivePath`), extract to a temp dir, then `mv` the file to `binaries/agents/<platform>-<arch>/<installName>`. Claude entries use `package/<binary>` (npm tarball convention) and follow the standard nested-extraction path.
- [ ] Script sets executable bit on POSIX runtimes and verifies it; on Windows verifies PE header.
- [ ] Script runs each manifest `validationArgs` after install (e.g. `--version` or Codex app-server `--help` smoke test).
- [ ] Script never fetches unpinned `latest`; version and sha256 must come from manifest.

**Files touched:** `scripts/fetch-agent-runtimes.sh` (new).
**Blocked by:** Phase A.
**Success:** Fresh checkout can materialize the in-scope runtimes from manifest on macOS arm64, macOS x64, and Windows x64 hosts (or via cross-platform fetch on a single host); corrupt download/hash mismatch fails before extraction.
**Agent:** vscode-expert for shell script work.

---

### Phase C — macOS packaging gate (arm64 + x64)

Wire the manifest/runtime artifacts into the macOS production app for both arm64 and x64. The build must fail visibly if artifacts are absent, wrong-architecture, non-executable, or fail their validation command.

- [x] Add pre-gulp step to `scripts/build-prod.sh` that calls `scripts/fetch-agent-runtimes.sh --platform darwin --arch <arch>` (build steps renumbered to /8; new Step 2 sits between validate-env and gulp, before extension copy in Step 4 picks up the binaries).
- [x] Add post-build check to `scripts/validate-build-output.sh` (Check 5): manifest-driven loop verifying each expected artifact exists in the built `.app`.
- [x] Post-build check verifies `file` output matches `expectedFileArchPattern` from manifest.
- [x] Post-build check verifies POSIX executable bit.
- [x] **Post-build smoke-test of `validationArgs` from inside the built `.app` — INTENTIONALLY DROPPED.** The .app is codesigned later in the release flow (with hardened runtime); modifying any byte under `Contents/Resources/` would invalidate the embedded signature, and Gatekeeper SIGKILLs binaries launched from a tampered bundle. Discovered the hard way during Phase C verification — manually copying the runtimes into a previously-signed `.app` produced "Ritemark.app is damaged and can't be opened" via Gatekeeper. Recovered with `codesign --force --deep --sign -`. The fetch script already runs `validationArgs` against the source binary at fetch time (Phase B), and the post-copy bytes are byte-identical, so re-running adds no value while introducing signing-stage fragility. Rationale captured as a comment in `validate-build-output.sh`.
- [ ] Run one full production build for arm64 and confirm the gate passes with artifacts present and fails without. (Gate logic verified with manual file copy + revert against existing `.app`; full prod build pending.)
- [ ] Run one full production build for x64 (if a build host is available). Gate logic is parameterised by `${TARGET#darwin-}` so x64 should work without changes.

**Note:** "Verify bundled runtime wins over system `which codex` / `which claude` when healthy" — moved to Phase E, since this is runtime-resolver behaviour in `setup.ts`/`codexManager.ts`, not a packaging-stage concern.

**Files touched:** `scripts/build-prod.sh`, `scripts/validate-build-output.sh`.
**Blocked by:** Phases A and B.
**Success:** macOS production builds (arm64 and x64) cannot ship an empty or wrong-architecture `binaries/agents/darwin-<arch>/` tree.
**Agent:** vscode-expert for build script work.

---

### Phase D — Windows x64 packaging gate

Equivalent wiring for the actual Windows release path. This phase must audit both local and production Windows scripts because the repo contains multiple entrypoints.

- [ ] Audit and wire the real release path: `scripts/build-prod-windows.sh`, `scripts/build-windows.sh`, `scripts/create-windows-installer.sh`, and `installer/windows/ritemark.iss`.
- [ ] Add a pre-build/pre-package step that calls `scripts/fetch-agent-runtimes.sh --platform win32 --arch x64 --verify-only` and exits non-zero on failure.
- [ ] Verify installer includes `resources/app/extensions/ritemark/binaries/agents/win32-x64/`.
- [ ] Add PE architecture validation via `file` magic or a small scripted PE header check (shared with `validate-build-output.sh`).
- [ ] Confirm the bundled-runtime resolver picks `win32-x64/codex.exe` and `win32-x64/claude.exe` (or whatever names the manifest specifies) on Windows.

**Files touched:** `scripts/build-prod-windows.sh`, `scripts/build-windows.sh`, `scripts/create-windows-installer.sh`, `installer/windows/ritemark.iss`, `scripts/validate-build-output.sh` if shared.
**Blocked by:** Phases A/B.
**Success:** Windows release build/installer cannot ship without `win32-x64` runtime artifacts.
**Agent:** vscode-expert.

---

### Phase E — Runtime/auth status model and Settings/sidebar UI

Once bundled artifacts exist, Settings and the AI sidebar should reflect runtime health and auth state separately with human-readable status strings, not raw process errors.

- [ ] Audit `agent/setup.ts` and `codexManager.ts` status return paths — identify where `runtimeSource: 'bundled' | 'system'` is already available and where it is not surfaced to the UI.
- [ ] Add "Architecture mismatch" state to `ClaudeBinaryInspection` and `CodexBinaryStatus` when the resolved binary arch does not match the host arch.
- [ ] Map runtime + auth into separate fields:
  - runtime: `missing`, `installed`, `architecture_mismatch`, `launch_failed`;
  - source: `bundled`, `system`, `unknown`;
  - auth: `ready`, `sign_in_required`, `unknown`, `error`.
- [ ] User-facing labels include `Runtime installed — sign in required`, `Ready`, `Architecture mismatch`, `Runtime missing`, `Launch failed`.
- [ ] Update Settings webview component to display the mapped state — no raw error strings visible to users.
- [ ] Add Settings actions per Q5: "Check agent installation" (health check on demand) and "Repair bundled runtime" (re-runs the fetch script for the affected agent). Do **not** ship the "use system runtime" override.
- [ ] Add Settings "Check for updates" button (Q4) wired to the existing Ritemark app-update check. No separate runtime update channel.
- [ ] Validate on a fresh user-data directory with bundled artifacts present and no auth: status should not claim full `Ready` until auth is valid.
- [ ] Validate that "Repair bundled runtime" recovers from a corrupted/deleted artifact directory without re-installing Ritemark.
- [ ] **Remove obsolete "audited Codex range" disclaimer.** Bundled Codex is pinned to a specific version (currently `0.128.0`), which is outside the existing `MIN_AUDITED_VERSION='0.111.0'` / `MAX_AUDITED_VERSION_EXCLUSIVE='0.125.0'` window in `codexManager.ts:71-73`. With bundled runtimes the version is no longer unknown, so the "Codex version not yet audited" notice (`getCompatibilityNotice` in `CodexView.tsx:102-135` returning the title from line 130) is logically obsolete and would fire on every bundled-runtime user. Action: delete `MIN_AUDITED_VERSION`, `MAX_AUDITED_VERSION_EXCLUSIVE`, `AUDITED_RANGE_LABEL`, `isInAuditedRange()` (line 764-765), the `'untested'` branch of `compatibility.state` (line 53 type, line 717), and the corresponding UI notice path. Keep the actual capability-detection logic (approvals/requestUserInput/planUpdates) — that is independently useful. Audit Settings/RitemarkSettings.tsx for any sibling references and remove them too.

**Files touched:** `extensions/ritemark/src/agent/setup.ts`, `extensions/ritemark/src/codex/codexManager.ts`, `extensions/ritemark/webview/src/components/ai-sidebar/CodexView.tsx`, `extensions/ritemark/webview/src/components/ai-sidebar/types.ts`, `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx`, Settings webview component(s).
**Blocked by:** Phases A–C for reliable happy-path testing.
**Success:** Fresh install selects bundled runtimes; UI accurately distinguishes runtime installed from auth readiness; Check / Repair / Check-for-updates actions all work.
**Agent:** ux-expert for Settings UI component design; vscode-expert for TS logic; webview-expert if Settings webview changes are substantial.

---

### Phase F — `thread/start` timeout UX improvement

Secondary to artifact delivery but needed before the sprint is releasable. The current 30 s flat timeout produces a developer-facing error string.

- [ ] In `codexAppServer.ts`, give `thread/start` a method-specific timeout of 60 s.
- [ ] Emit a progress event or log message after ~10 s during `thread/start` ("Starting Codex session, this may take a moment…").
- [ ] On timeout, include a diagnostics snapshot in the error: runtime path, runtime source (bundled vs system), binary arch, last stderr line.
- [ ] Validate that the progress message surfaces in the AI sidebar (not buried in extension host logs).

**Files touched:** `extensions/ritemark/src/codex/codexAppServer.ts`, AI sidebar webview (if progress event needs a new message type).
**Blocked by:** Nothing — can be done independently, but test with bundled runtime once Phase B is complete.
**Success:** No user sees `RPC call 'thread/start' timed out after 30000ms`. Progress feedback visible. Diagnostics are actionable.
**Agent:** vscode-expert for TS; webview-expert if AI sidebar needs a new progress message type.

---

### Phase G — App-server process lifecycle (deferred)

Multiple `CodexAppServer` owners (AI sidebar, Settings, Flow execution) can contend on auth-sensitive startup. This is secondary and should be its own sprint after Phase A–E are shipped.

- [ ] Open a follow-up sprint ticket for app-server singleton/serialization.

**Not in Phase 3 scope for Sprint 64.**

---

### Bonus Track — Selected-text docked context tab

This track is approved as the preferred UX direction but should not block the bundled-runtime work. It uses Sprint 62 option **S5 — Docked context tab**.

Tracking doc: `docs/development/sprints/sprint-64-bundled-agent-runtimes/notes/bonus-track-selected-text-docked-context-tab.md`

- [ ] Move selected-text display from the global `Selected:` banner to a docked tab immediately above the chat input card.
- [ ] Keep the input card internals stable: textarea, runtime/model controls, active-file chip, attach, and send remain in the same places.
- [ ] Add a clear/detach selected-context affordance.
- [ ] Preserve existing selected-text behavior when sending turns to Codex/Claude/Chat.
- [ ] Validate light/dark and narrow sidebar layouts.

---

## Open Questions for Jarmo — RESOLVED 2026-05-06

All five questions are answered. See **Locked Decisions** at the top of this document for the authoritative summary. The original question text is preserved below for traceability.

**Q1 — Feature flag for bundled-runtime preference** → **No new flag. On by default.**

**Q2 — Artifact source strategy** → **Build-time fetch.** Codex from GitHub Releases tarballs; Claude from npm optional packages. Pinned by version + sha256 in manifest. Binaries `.gitignore`d.

**Q3 — Platform scope** → **macOS arm64, macOS x64, Windows x64.** Windows arm64 deferred.

**Q4 — Update story** → **Manual.** Runtime versions ship inside Ritemark releases. Settings "Check for updates" button invokes the existing Ritemark app-update check. Background auto-update deferred.

**Q5 — Settings repair UI scope** → **Check + Repair only.** "Use system runtime" override deferred to a future sprint.

---

## Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Exact Codex artifact for pinned version is not available on GitHub Releases | Medium | High | Verify artifact availability before starting Phase A. Fallback: extract from npm optional package `@openai/codex-darwin-arm64`. |
| Bundled binary fails arch check after `cp -R` (executable bit lost) | Low | Medium | Add `chmod +x` in fetch script and verify in Phase B gate. |
| Claude native binary not redistributable via this path | Low | High | Redistribution licensing already confirmed by Jarmo; noted in audit. If a specific artifact path requires different handling, surface it during Phase A. |
| Build-time network fetch fails in CI | Medium | Medium | Pin exact version + sha256 in manifest; add retry logic; fallback to cached artifact. |
| Settings repair UX scope expands | Medium | Medium | Hard-scope to Q5 answer; defer system override toggle. |
| Phase F (timeout) conflicts with active AI sidebar changes | Low | Low | Keep the change surgical (codexAppServer.ts only unless webview-expert needed). |
| macOS x64 artifact differs from arm64 fetch path | Low | Low | Parameterize fetch script by platform/arch from the start. |

---

## Expert Agent Assignments

| Phase | Agent |
|---|---|
| A — Artifact contract + manifest | sprint-manager (contract wording); vscode-expert (schema practicality) |
| B — Fetch/extract/verify script | vscode-expert |
| C — macOS build gate | vscode-expert |
| D — Windows build gate | vscode-expert |
| E — Runtime/auth status + Settings/sidebar UI | vscode-expert (TS logic); ux-expert (Settings component design); webview-expert (if substantial webview changes) |
| F — Timeout UX | vscode-expert; webview-expert (if new sidebar progress message type needed) |
| QA sign-off | qa-validator (Phase 4→5 gate) |
| Release | release-manager (Phase 6 gate) |

---

## Status

**Track:** Full 6-phase
**Current Phase:** 3 (Implementation)
**Approval Required:** Next gate is Phase 3 → 4 (qa-validator, invoked via main session)

## Approval

- [x] Jarmo approved this sprint plan (Phase 2 → 3 gate) — 2026-05-06
- [x] Q1 answered (2026-05-06): on by default, no new flag
- [x] Q2 answered (2026-05-06): build-time fetch (GitHub Releases + npm optional pkg), pinned by version + sha256, gitignored
- [x] Q3 answered (2026-05-06): macOS arm64, macOS x64, Windows x64
- [x] Q4 answered (2026-05-06): manual via "Check for updates" button; auto-update deferred
- [x] Q5 answered (2026-05-06): Check + Repair only; "use system runtime" override deferred

---

## Plan Revision Notes — 2026-05-06

**Round 1 — Codex independent review incorporated:**

- runtime installation and auth readiness are now separate acceptance states;
- Phase A now requires an explicit artifact/invocation contract before packaging work;
- fetch/extract/verify is its own phase;
- macOS and Windows packaging gates are separate phases;
- Windows scope now includes `build-prod-windows.sh` as well as local/installer scripts.

**Round 2 — Jarmo decisions locked, all five questions resolved:**

- Q1 = on by default, no flag;
- Q2 = build-time fetch from GitHub Releases (Codex) + npm optional packages (Claude), pinned by version + sha256, payloads gitignored;
- Q3 = macOS arm64 + macOS x64 + Windows x64 all in this sprint (was: macOS x64 stretch);
- Q4 = manual updates via Settings "Check for updates" button wired to existing app-update check (was: just manual via Ritemark release);
- Q5 = Check + Repair only; "use system runtime" override deferred.

Phase A is no longer blocked. Implementation can begin once Jarmo gives Phase 2→3 approval.
