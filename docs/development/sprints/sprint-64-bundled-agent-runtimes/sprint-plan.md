# Sprint 64: Bundled Agent Runtimes

## Goal

Ship Codex and Claude runtimes inside the Ritemark app bundle so that a clean macOS install shows "Codex: Ready / Claude: Ready" with no terminal, npm, Node, PATH, or architecture knowledge required from the user.

---

## Feature Flag Check

The `codex-integration` flag already exists in `flags.ts` with status `experimental`. The bundled-runtime resolution path is orthogonal to that flag — it is an implementation detail of how the runtime is found, not whether the feature is enabled.

**Open question for Jarmo (Q1):** Should the bundled-runtime resolver preference be independently flag-gated (`bundled-agent-runtime` flag, status `experimental`) so it can be disabled per-user during staged rollout, or is it on by default once artifacts land? See the Feature Flag section in Open Questions below.

---

## Success Criteria

- [ ] A clean macOS arm64 Ritemark install (no system Codex, no system Claude, fresh user-data dir) shows both agents as Ready in Settings without any manual step.
- [ ] The production `.app` bundle contains `darwin-arm64/codex` (or `codex-app-server`) and `darwin-arm64/claude` under `Contents/Resources/app/extensions/ritemark/binaries/agents/darwin-arm64/`.
- [ ] `build-prod.sh` fails (non-zero exit) if required runtime artifacts are absent or wrong architecture for the build target.
- [ ] `validate-build-output.sh` includes architecture-specific binary checks that pass the above condition.
- [ ] Settings shows human-readable status ("Ready", "Auth required", "Not installed") — not raw process errors.
- [ ] `thread/start` timeout surfaces a progress message after ~10 s, not a bare `RPC call ... timed out after 30000ms` error after 30 s.
- [ ] No regression on existing macOS auth/login flow.

---

## Deliverables

| Deliverable | Description |
|---|---|
| Artifact manifest (`manifest.json`) | Machine-readable source-of-truth: vendor, upstream version, sha256, platform/arch, expected executable name, license metadata. Lives at `extensions/ritemark/binaries/agents/`. |
| macOS arm64 artifacts | `darwin-arm64/codex` (or `codex-app-server`) and `darwin-arm64/claude` — placed in the repo after Jarmo decides the artifact source strategy (Q2). |
| `scripts/fetch-agent-runtimes.sh` | Script to download, verify sha256, and populate `binaries/agents/<platform>/` from the chosen artifact source. Idempotent; usable in CI and locally. |
| Build gate in `build-prod.sh` | Step that verifies artifacts exist and match target arch before gulping. Exits non-zero if missing/wrong. |
| Build gate in `validate-build-output.sh` | Post-build `file` checks for binary arch (e.g., `arm64` for `darwin-arm64` builds). |
| Settings readiness UI repair | Replace raw error strings in the AI sidebar and Settings panel with human-readable "Ready / Auth required / Not installed / Architecture mismatch" states derived from bundled vs system runtime source. |
| `thread/start` timeout UX improvement | Progress message at ~10 s, extended timeout to 60 s for thread creation, diagnostics snapshot on failure. |
| `manifest.json` + `README.md` update | Updated `binaries/agents/README.md` to document the manifest schema and fetch workflow. |

---

## Implementation Checklist

### Phase A — Artifact source decision and manifest (blocks everything else)

Jarmo must answer Q2–Q5 before this phase can begin. Sprint 64 cannot proceed to Phase 3 until those decisions are recorded.

- [ ] Jarmo decides artifact source strategy (Q2): vendor repo / npm extract / build-time fetch / CI artifact store.
- [ ] Create `extensions/ritemark/binaries/agents/manifest.json` with schema covering vendor, version, sha256, platform, arch, executable name, license.
- [ ] Populate manifest with macOS arm64 entries for Codex and Claude at the pinned versions.
- [ ] Add manifest entries for additional platforms once scope decisions (Q3) are made.

**Files touched:** `extensions/ritemark/binaries/agents/manifest.json`, `extensions/ritemark/binaries/agents/README.md`.
**Blocked by:** Q2, Q3.
**Success:** Manifest exists, is machine-readable, and records the exact artifact source and hash for each platform/agent combination in scope.
**Agent:** vscode-expert owns the shell script; sprint-manager owns manifest schema.

---

### Phase B — macOS arm64 packaging gate

Wire the manifest into `build-prod.sh` and `validate-build-output.sh` so the build fails visibly if artifacts are absent rather than silently shipping an empty `binaries/agents/darwin-arm64/`.

- [ ] Write `scripts/fetch-agent-runtimes.sh`: reads manifest, downloads to `binaries/agents/<platform>/`, verifies sha256, sets executable bit, errors on mismatch.
- [ ] Add pre-gulp step to `build-prod.sh` that calls the fetch script (or verifies artifacts already present) for the target platform.
- [ ] Add post-build check to `validate-build-output.sh`: run `file` on each expected binary, assert arch matches target (e.g., `aarch64` for `darwin-arm64`).
- [ ] Verify executable bit is preserved through `cp -R` in Step 3 of `build-prod.sh`.
- [ ] Run one full production build and confirm gate passes with artifacts present and fails without.

**Files touched:** `scripts/fetch-agent-runtimes.sh` (new), `scripts/build-prod.sh`, `scripts/validate-build-output.sh`.
**Blocked by:** Phase A (manifest must exist).
**Success:** `build-prod.sh` exits non-zero when `darwin-arm64/codex` or `darwin-arm64/claude` is absent; exits 0 with correct artifacts.
**Agent:** vscode-expert for build script work.

---

### Phase C — Windows packaging gate

Equivalent wiring for `build-windows.sh` and `create-windows-installer.sh`. Depends on Jarmo's scope decision (Q3).

- [ ] Add `win32-x64` entries to manifest (after Q3 approval).
- [ ] Extend `fetch-agent-runtimes.sh` to handle Windows executables (`.exe`, no executable-bit logic needed).
- [ ] Add artifact presence check to `build-windows.sh`; run `file` check in CI (cross-arch detection for `.exe` requires `file` magic or PE header check).
- [ ] Verify Windows installer (`ritemark.iss`) includes the `resources/app/extensions/ritemark/binaries/agents/win32-x64/` tree.

**Files touched:** `scripts/build-windows.sh`, `scripts/create-windows-installer.sh`, `installer/windows/ritemark.iss`, `scripts/fetch-agent-runtimes.sh`.
**Blocked by:** Phase A, Q3 scope decision.
**Success:** Windows build fails if `win32-x64` artifacts are absent; installer includes them when present.
**Agent:** vscode-expert.

---

### Phase D — Settings and sidebar readiness UI repair

Once bundled artifacts exist, Settings and the AI sidebar should reflect the bundled-first resolver state with human-readable status strings, not raw process errors.

- [ ] Audit `agent/setup.ts` and `codexManager.ts` status return paths — identify where `runtimeSource: 'bundled' | 'system'` is already available and where it is not surfaced to the UI.
- [ ] Add "Architecture mismatch" state to `ClaudeBinaryInspection` and `CodexBinaryStatus` when the resolved binary arch does not match the host arch.
- [ ] Map `runtimeSource` + health-check result → one of: `Ready (bundled)`, `Ready (system)`, `Auth required`, `Architecture mismatch`, `Not installed`.
- [ ] Update Settings webview component to display the mapped state — no raw error strings visible to users.
- [ ] Add Settings "Check agent installation" and "Repair bundled runtime" actions (Q5 scope decision needed for exact UX).
- [ ] Validate on a fresh user-data directory with bundled artifacts present.

**Files touched:** `extensions/ritemark/src/agent/setup.ts`, `extensions/ritemark/src/codex/codexManager.ts`, Settings webview component(s).
**Blocked by:** Phases A and B (needs artifacts present to test the happy path).
**Success:** Fresh install shows "Ready" for both agents without user intervention. Settings repair actions work for corrupted installs.
**Agent:** ux-expert for Settings UI component design; vscode-expert for TS logic; webview-expert if Settings webview changes are substantial.

---

### Phase E — `thread/start` timeout UX improvement

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

### Phase F — App-server process lifecycle (deferred)

Multiple `CodexAppServer` owners (AI sidebar, Settings, Flow execution) can contend on auth-sensitive startup. This is secondary and should be its own sprint after Phase A–E are shipped.

- [ ] Open a follow-up sprint ticket for app-server singleton/serialization.

**Not in Phase 3 scope for Sprint 64.**

---

## Open Questions for Jarmo

These must be answered before Phase 3 can begin. Phase 3 is blocked until Jarmo responds.

**Q1 — Feature flag for bundled-runtime preference**
Should the bundled-runtime resolver path be independently flag-gated (new `bundled-agent-runtime` flag, `experimental`) for staged rollout, or is it on unconditionally once artifacts land?

Recommended position: ship on by default (no new flag). The resolver already prefers bundled over system, and the flag already exists on `codex-integration`. Adding a second layer of flags for an implementation detail creates maintenance overhead without user-visible benefit. But if Jarmo wants a kill switch, the feature-flags skill has a pattern for it.

---

**Q2 — Artifact source strategy (BLOCKS Phase A)**
How should Ritemark acquire the agent runtime binaries? Three main options:

| Option | Description | Tradeoff |
|---|---|---|
| A. Vendor into repo | Commit binaries to `binaries/agents/` under `.gitignore` or Git LFS | Simple local dev, no network on build; binaries in repo history; update requires commit |
| B. Build-time fetch (download on `build-prod.sh`) | `fetch-agent-runtimes.sh` downloads from GitHub Releases or npm at build time | No binaries in repo; requires network on build; pinned version in manifest |
| C. CI artifact store | Binaries stored in a private artifact store (S3, GitHub Packages); fetch on CI | Best for secrets/large files; more infra to own |

Recommended position: Option B (build-time fetch from GitHub Releases). Codex publishes platform tarballs at `https://github.com/openai/codex/releases`; Claude publishes via npm optional deps. Manifest records the pinned version and sha256. Local dev: run `fetch-agent-runtimes.sh` once; CI: run it as a build step. Binaries go in `.gitignore`.

---

**Q3 — Platform scope for Sprint 64**
Which platforms should be in scope?

| Platform | Recommended | Reason |
|---|---|---|
| macOS arm64 | YES (primary) | Current dev/test machine; production target |
| macOS x64 | Optional | Intel Mac users exist; `build-prod.sh` already supports `darwin-x64`; low extra effort if fetch script is parameterized |
| Windows x64 | YES (secondary) | Windows installer pipeline exists; Sprint 57 identified this as a requirement |
| Windows arm64 | No (defer) | No current build target; emulation via x64 is acceptable for now |

Recommended position: macOS arm64 + Windows x64 in Sprint 64; macOS x64 as a stretch goal if the fetch script handles it for free; Windows arm64 deferred.

---

**Q4 — Update story for bundled runtimes**
When Codex or Claude release a new version, how should Ritemark update the bundled runtimes?

| Option | Description |
|---|---|
| Manual + new Ritemark release | Update manifest, re-run fetch, ship new Ritemark version |
| Auto-update on launch | Ritemark checks for newer runtime on launch and downloads in background |
| User-triggered repair | Settings "Check for runtime updates" button |

Recommended position: Manual + new Ritemark release for now. Auto-update adds significant complexity and update-channel questions. Revisit in a follow-up sprint once bundled runtimes are proven.

---

**Q5 — Settings repair UI scope**
The audit recommends four repair actions in Settings:
1. "Check agent installation" (health check on demand)
2. "Repair bundled Codex runtime" (re-fetch from manifest)
3. "Repair bundled Claude runtime" (re-fetch from manifest)
4. "Use system Codex/Claude instead" (advanced override toggle)

Which of these should be in Sprint 64 vs deferred?

Recommended position: Ship (1) Check and a basic (2)/(3) that re-runs the fetch script. Defer (4) system override toggle — it requires UX design for the Settings page that ux-expert should own in a separate sprint. Existing system fallback in the resolver is sufficient until then.

---

## Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Exact Codex artifact for pinned version is not available on GitHub Releases | Medium | High | Verify artifact availability before starting Phase A. Fallback: extract from npm optional package `@openai/codex-darwin-arm64`. |
| Bundled binary fails arch check after `cp -R` (executable bit lost) | Low | Medium | Add `chmod +x` in fetch script and verify in Phase B gate. |
| Claude native binary not redistributable via this path | Low | High | Redistribution licensing already confirmed by Jarmo; noted in audit. If a specific artifact path requires different handling, surface it during Phase A. |
| Build-time network fetch fails in CI | Medium | Medium | Pin exact version + sha256 in manifest; add retry logic; fallback to cached artifact. |
| Settings repair UX scope expands | Medium | Medium | Hard-scope to Q5 answer; defer system override toggle. |
| Phase E (timeout) conflicts with active AI sidebar changes | Low | Low | Keep the change surgical (codexAppServer.ts only unless webview-expert needed). |
| macOS x64 artifact differs from arm64 fetch path | Low | Low | Parameterize fetch script by platform/arch from the start. |

---

## Expert Agent Assignments

| Phase | Agent |
|---|---|
| A — Manifest + fetch script | sprint-manager (schema); vscode-expert (shell script) |
| B — macOS build gate | vscode-expert |
| C — Windows build gate | vscode-expert |
| D — Settings/sidebar UI | vscode-expert (TS logic); ux-expert (Settings component design); webview-expert (if substantial webview changes) |
| E — Timeout UX | vscode-expert; webview-expert (if new sidebar progress message type needed) |
| QA sign-off | qa-validator (Phase 4→5 gate) |
| Release | release-manager (Phase 6 gate) |

---

## Status

**Track:** Full 6-phase
**Current Phase:** 2 (Plan)
**Approval Required:** Yes — Phase 2 → 3 gate

## Approval

- [ ] Jarmo approved this sprint plan
- [ ] Q2 (artifact source) answered
- [ ] Q3 (platform scope) answered
- [ ] Q1 (feature flag) answered
- [ ] Q4 (update story) answered (can be deferred)
- [ ] Q5 (Settings repair scope) answered (can be deferred, default above applies)
