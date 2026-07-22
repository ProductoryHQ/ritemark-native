# Sprint 100: Claude + OpenCode Runtime Bumps with Compatibility Matrix

Track: Plain full track (not SDD — see Track Decision note below)
Release tier: shell
Branch: `sprint-100-runtime-bumps-matrix` (create immediately after Jarmo approves this plan — no code before that)

## Track Decision

This sprint touches a Signal-2 SDD trigger (security boundaries — the OpenCode permission-enforcement regression gate below), but is NOT structured as SDD: its deliverable is a **verification matrix over EXISTING behavior across a version bump**, not new user-facing requirements with acceptance criteria. There is no R1/R2 behavior contract to write — the "spec" here is simply "the bumped binaries must behave identically (or document exactly how they differ) to the pinned versions they replace." The audit-first pre-flight (Phase 1) and the compatibility matrix itself serve the same evidentiary purpose SDD's `spec.md`/`scenarios.md` would, without the ceremony of numbered requirements for behavior that already exists. Structured after the Sprint 96 Codex-bump precedent (`docs/development/sprints/sprint-96-codex-runtime-bump/tasks.md`), scaled up for two runtimes plus the formal matrix issue #146 now requires.

## Release Context

**Decided (Jarmo, 2026-07-21):** v1.8.5 is a full shell-tier DMG release bundling four sprints in this order: **Sprint 98 (safe ext lane) → Sprint 99 (parallel chats) → Sprint 100 (this sprint, runtime bumps) → Sprint 101 (agent capability context)**. (1.9.0 stays reserved for potential cloud capabilities.) This sprint ships deliberately AFTER Sprint 99 (with only Sprint 101 behind it): Sprint 99 introduces multi-session/parallel-chat capability across all three runtimes, and this sprint's compatibility matrix must validate that parallelism against the NEW bumped binaries rather than bumping blind and leaving parallel-session behavior unverified against the versions actually shipping. See "Coordination with Sprint 99" below.

## Goal

Finish issue #146: bump the two remaining bundled agent runtimes (Codex was already bumped Sprint 96, shipped v1.8.3) —

- **Claude Code binary** 2.1.156 → 2.1.210, paired with an `@anthropic-ai/claude-agent-sdk` bump — pin SDK+binary as ONE resolved tuple for this release, not independently.
- **OpenCode** 1.15.13 → 1.18.1 — spans a Desktop-v2 migration; verify the ACP surface is unchanged for Ritemark's usage.

Produce a **per-runtime compatibility matrix** (not a single pass/fail note) as the sprint's primary evidentiary artifact, recorded on issue #146 per its acceptance criteria.

### Target versions — DECIDED (Jarmo, 2026-07-22): take the latest

The plan was written against issue #146 (2026-07-15) and both targets had already moved on:

| runtime | bundled now | plan's target | **shipping** |
|---|---|---|---|
| Claude Code | 2.1.156 | 2.1.210 | **2.1.217** (+ SDK pinned `0.3.217`) |
| OpenCode | 1.15.13 | 1.18.1 | **1.18.4** |
| Codex | 0.144.4 | unchanged | unchanged (Sprint 96 reference baseline) |

Rationale: building the matrix costs the same whichever version is chosen, and a shell-tier release
needs notarization and days of lead time — shipping a binary that is already two weeks stale wastes
that. The wider spans (61 Claude patches, a minor-version jump for OpenCode) make the Phase-1
protocol diff MORE important, not less.

## Linked Issues

- #146 — bundled runtime version bumps (Codex portion already closed by Sprint 96; this sprint finishes Claude + OpenCode)
- Reference comment: github.com/ProductoryHQ/ritemark-native/issues/146#issuecomment-5023681760 (source of the compatibility-matrix requirement and the two hard gates below)

## Coordination with Sprint 99

Sprint 99 (parallel agent chats) ships immediately before this sprint in the same v1.8.5 release, and introduces multi-session/parallel-chat capability to all three runtime adapters. This sprint's compatibility matrix therefore must NOT stop at "does the bumped binary still work for a single session" — it must explicitly re-verify parallelism against the NEW binaries, since Sprint 99 built and tested that parallelism against the OLD (pre-bump) versions. See the new "Parallel Sessions Matrix" below.

Specific carry-overs from Sprint 99 to re-check here, per its `technical-plan.md`/code markers (`grep -rn "Sprint 100: re-check"` across the codebase as a starting checklist):

- OpenCode `session/cancel` — Sprint 99 built the ACP cancel path around 1.15.13's `-32601` (not implemented) response, falling back to a process kill. If 1.18.1 implements `session/cancel` natively, re-test whether the fallback is now redundant or actively conflicts with a real cancel response.
- `setSessionConfigOption` (model selection) behavior under multi-session ACP — re-verify against 1.18.1.
- Whichever ACP concurrency model Sprint 99 chose (multi-session-in-subprocess vs. one-subprocess-per-chat) — re-test specifically against 1.18.1's Desktop-v2 migration, since process/session lifecycle is exactly the kind of thing a major migration can change.
- Claude's `Map<conversationId, AgentSession>` design (Sprint 99) — re-verify end-to-end against the 2.1.210 + bumped-SDK pinned tuple this sprint locks in.

## Background (from Sprint 96 precedent)

Sprint 96 bumped `codex-app-server` 0.135.0 → 0.144.4 alone, deferring Claude/OpenCode because they're higher-risk (Claude SDK pairing; OpenCode Desktop-v2 migration). That sprint's structure — manifest updates, tarball/sha256 re-verification, protocol diff research, unit tests, and a manual live-turn smoke deferred to Gate 1 re-test — is the template this sprint scales up, with the compatibility matrix as the new formal deliverable the issue comment demands.

## Feature Flag Check

Does this sprint need a `features/flags.ts` feature flag? **NO.** This is a runtime binary version bump with no new user-visible feature, no platform gating, no kill-switch semantics beyond "don't ship a rolled-back version" (handled by the manifest itself, not a flag).

## The Compatibility Matrix (primary deliverable)

Rows = runtime (Claude Code, OpenCode, and Codex as an already-validated reference baseline). Columns = functional surface areas. Each cell = **pass / fail / changed-behavior**, with evidence (log excerpt, screenshot, or test output reference) — not a bare checkmark.

| Runtime | Startup / version discovery | Model listing + default model | Streaming event taxonomy | Approval request/response round-trip | Cancel / interrupt | Restart-reconnect after partial turn | Permission-mode enforcement (fs + shell) |
|---|---|---|---|---|---|---|---|
| Codex (reference, already bumped Sprint 96) | | | | | | | |
| Claude Code (2.1.156 → 2.1.210) | | | | | | | |
| OpenCode (1.15.13 → 1.18.1) | | | | | | | |

This table is filled in during Phase 2/3 (below) and the completed version is pasted into issue #146 as the closing evidence, per the issue's acceptance criteria.

## Parallel Sessions Matrix (new — required because Sprint 99 lands first)

Sprint 99 makes all three runtimes multi-session-capable. This sprint must verify that capability survives the version bump, not just single-session behavior. Rows = runtime. Columns = the four parallel-session behaviors Sprint 99 introduces. Each cell = pass/fail/changed-behavior with evidence, same discipline as the main matrix.

| Runtime | Concurrent streaming (N≥2 sessions) | Concurrent approvals (2 simultaneous approval prompts, correctly attributed) | Cancel-one-of-two (cancelling session A doesn't affect session B) | Per-session permission enforcement (Ask/Auto/Plan mode isolated per session) |
|---|---|---|---|---|
| Codex (reference — already multi-thread native pre-bump) | | | | |
| Claude Code (2.1.210 + bumped SDK) | | | | |
| OpenCode (1.18.1) | | | | |

This table is filled in during Phase 2/3 alongside the main matrix and posted to #146 together with it. This is IN ADDITION TO Hard Gate 1 below (deny-path proof), not a replacement — Hard Gate 1 covers single-session permission enforcement under the new OpenCode binary; this matrix's last column covers whether that enforcement stays correctly ISOLATED when multiple sessions run concurrently.

## Hard Gates (from the issue comment — non-negotiable)

1. **OpenCode `OPENCODE_PERMISSION` env contract — SECURITY regression gate.** Must PROVE, with evidence in the matrix, that (a) a write/tool action pauses for host approval under the NEW binary, AND (b) host denial actually blocks the action. This is not covered by "it still runs" smoke-testing — it needs an explicit deny-path test, not just an approve-path test. Ship-blocking if either direction fails.
2. **Claude SDK + binary pinned as one resolved tuple.** ~~The versions must be chosen and locked together — no independent drift.~~

   **Phase-1 finding (2026-07-22): the gate was aiming at the wrong risk.** Anthropic publishes the
   SDK and the CLI in lockstep — same patch number, same day:

   | SDK | CLI | published |
   |---|---|---|
   | 0.3.156 | 2.1.156 | 2026-05-28 |
   | 0.3.210 | 2.1.210 | 2026-07-14 |
   | 0.3.217 | 2.1.217 | 2026-07-21 |

   So the tuple is not something we have to *construct*; it is upstream's release shape. The real
   drift risk is entirely on our side: `extensions/ritemark/package.json` declares
   `"@anthropic-ai/claude-agent-sdk": "^0.3.156"`, and that caret lets the SDK float to any 0.3.x
   independently of the binary the manifest pins. A fresh `npm install` on a build machine could
   therefore pair SDK 0.3.217 with binary 2.1.156 today.

   **The gate in practice: pin the SDK to an exact version matching the bundled binary's patch
   number** (`0.3.217` for binary `2.1.217`), and drop the caret. Document the pair in the matrix and
   in `binaries/agents/README.md`.

## Pre-Flight Checklist (from issue #146 body, reused/extended from Sprint 96 shape)

- [ ] Tarball inspection for both runtimes (all platform entries: darwin-arm64, darwin-x64, win32-x64)
- [ ] sha256 recompute for all platform entries; manifest `sourceUrl`/`version`/`sha256` updated
- [ ] `fetch-agent-runtimes.sh` end-to-end re-run for both runtimes (clean re-fetch — delete stale binary + sidecar `.sha256` first, per Sprint 96 lesson)
- [ ] Unit suite green (existing Claude + OpenCode/ACP test files, plus any Codex regression tests as the reference baseline)
- [ ] Live-turn smoke per runtime via the ritemark-automation CDP harness (per #146) — not just unit mocks
- [ ] Hardcoded default model ID re-check in `bundledCatalog.ts` for both Claude and OpenCode entries (same class of bug Sprint 96 fixed for Codex's `gpt-5.3-codex` → `gpt-5.6-sol`)
- [ ] `invocationMode` / binary invocation shape re-verified unchanged for both (standalone binary vs. re-merged CLI, same check Sprint 96 did for Codex)
- [ ] `--version` output regex still matches whatever version-detection regex each manager uses
- [ ] `binaries/agents/README.md` bundled table refreshed (Claude 2.1.210, OpenCode 1.18.1, Codex 0.144.4 unchanged)
- [ ] Protocol/API diff research for BOTH runtimes across their respective version spans (same rigor as Sprint 96's Codex 0.135.0→0.144.4 RPC surface diff) — document any removed/renamed calls Ritemark actually uses (grep-verified, not assumed)

## Success Criteria

- [ ] Compatibility matrix fully filled (no blank cells) for Claude Code, OpenCode, and the Codex reference row, with evidence links/excerpts per cell
- [ ] Parallel Sessions Matrix fully filled (no blank cells) for all three runtimes, with evidence
- [ ] Hard Gate 1 (OpenCode permission approve AND deny, single-session) passes with explicit evidence
- [ ] Hard Gate 1 also verified under concurrency: per-session permission enforcement stays correctly isolated across ≥2 simultaneous OpenCode sessions
- [ ] Hard Gate 2 (Claude SDK+binary pinned tuple) documented and locked in the manifest + README
- [ ] Every `Sprint 100: re-check` marker left by Sprint 99 (`grep -rn "Sprint 100: re-check"`) has been addressed and removed or resolved into a documented follow-up
- [ ] All pre-flight checklist items complete
- [ ] `manifest.json` updated for Claude (2.1.210) and OpenCode (1.18.1); Codex entry untouched
- [ ] `binaries/agents/README.md` bundled table current for all three runtimes
- [ ] Matrix results (both tables) posted to issue #146; #146 closed per its acceptance criteria once both bumps are verified
- [ ] No hardcoded stale default model IDs remain in `bundledCatalog.ts` for either bumped runtime

## Deliverables

| Deliverable | Description |
|-------------|--------------|
| `manifest.json` update | Claude 2.1.156→2.1.210 + SDK pin, OpenCode 1.15.13→1.18.1 — version/sourceUrl/sha256 for all platform entries |
| Compatibility matrix | Filled table (see above), posted to issue #146 |
| Parallel Sessions Matrix | Filled table verifying Sprint 99's multi-session capability against the bumped binaries, posted alongside the main matrix |
| Hard Gate 1 evidence | OpenCode `OPENCODE_PERMISSION` approve-path + deny-path proof, single-session AND under concurrency |
| Hard Gate 2 evidence | Claude SDK+binary pinned tuple documented |
| `Sprint 100: re-check` marker resolution | Every marker Sprint 99 left in code/docs addressed, resolved, or explicitly deferred with rationale |
| `bundledCatalog.ts` updates | Any stale hardcoded default model IDs corrected for Claude/OpenCode |
| `binaries/agents/README.md` update | Refreshed bundled-versions table |
| Protocol diff research notes | `research/` notes per runtime documenting the version-span diff |

## Implementation Checklist (phases — see `tasks.md` for the granular tracker)

### Phase 1: Research / Pre-Flight
- [ ] `grep -rn "Sprint 100: re-check"` across the codebase — build the concrete checklist of Sprint-99-flagged version-specific quirks to re-verify (starting list: OpenCode `session/cancel` -32601 fallback, `setSessionConfigOption`, chosen ACP concurrency model, Claude `Map<conversationId, AgentSession>`)
- [ ] Protocol/API diff research for Claude SDK+binary span
- [ ] Protocol/API diff research for OpenCode 1.15.13→1.18.1 (Desktop-v2 migration specifics)
- [ ] Confirm ACP surface unaffected by Desktop-v2 migration (or document what changed)
- [ ] Confirm exact SDK+binary tuple to pin for Claude

### Phase 2: Claude Code Bump
- [ ] Manifest update (all platform entries) + tarball/sha256 re-verification
- [ ] `@anthropic-ai/claude-agent-sdk` bump to the pinned-tuple version
- [ ] `fetch-agent-runtimes.sh` re-run, clean re-fetch
- [ ] `bundledCatalog.ts` default-model re-check for Claude
- [ ] Unit tests green
- [ ] Live-turn smoke via ritemark-automation CDP harness (single session)
- [ ] Fill Claude row of the main compatibility matrix
- [ ] Re-verify Sprint 99's `Map<conversationId, AgentSession>` multi-session design against 2.1.210 + bumped SDK; fill Claude row of the Parallel Sessions Matrix

### Phase 3: OpenCode Bump
- [ ] Manifest update (all platform entries) + tarball/sha256 re-verification
- [ ] `fetch-agent-runtimes.sh` re-run, clean re-fetch
- [ ] `bundledCatalog.ts` default-model re-check for OpenCode
- [ ] Unit tests green
- [ ] Live-turn smoke via ritemark-automation CDP harness (single session)
- [ ] **Hard Gate 1**: explicit approve-path AND deny-path test for `OPENCODE_PERMISSION` (single session)
- [ ] Re-test whether `session/cancel` still returns `-32601` on 1.18.1; if it's now implemented, update/remove Sprint 99's process-kill fallback accordingly
- [ ] Re-verify `setSessionConfigOption` model-selection behavior
- [ ] Re-test Sprint 99's chosen ACP concurrency model (multi-session-in-subprocess or per-chat subprocess) against 1.18.1's Desktop-v2 migration
- [ ] Fill OpenCode row of the main compatibility matrix
- [ ] Concurrency re-test: ≥2 simultaneous OpenCode sessions — streaming, approvals (incl. Hard Gate 1 deny-path under concurrency), cancel-one-of-two, per-session permission isolation; fill OpenCode row of the Parallel Sessions Matrix

### Phase 4: Matrix Closeout + Docs
- [ ] Fill Codex reference row on both matrices (re-validate against Sprint 96's existing evidence and Sprint 99's Codex parallel-session work, don't re-derive from scratch)
- [ ] Confirm every `Sprint 100: re-check` marker found in Phase 1 has been addressed; remove resolved markers
- [ ] Post both completed matrices to issue #146
- [ ] `binaries/agents/README.md` refreshed
- [ ] Close #146 once acceptance criteria met

### Phase 5: QA, Cleanup
- [ ] Recommend `qa-validator` for Phase 4→5 sign-off
- [ ] Recommend `qa-validator` again for prod-build sign-off (Phase 6 gate)
- [ ] Remove any debug/test scaffolding used for the deny-path proof

## Sprint Exit: Dev-Mode Self-Validation (MANDATORY — before any handoff to Jarmo)

**Standing rule (Jarmo 2026-07-21):** Claude runs dev mode and validates the sprint's results HIMSELF before telling Jarmo anything is ready. Jarmo must never be the first person to find out the work doesn't run.

1. Launch dev mode: `/rundev` (`./vscode/scripts/code.sh` from project root — serves from `out/`; remember CSS/static assets do not auto-copy from `src/` to `out/`).
2. Drive the running instance and verify a live turn per bumped runtime (Claude, OpenCode) — streaming, model listing, approval round-trip, cancel, and parallel sessions under the new binaries. Use the `ritemark-automation` CDP harness for scripted UI verification and screenshots; check the console for errors.
3. Fix whatever fails and re-verify — do not hand over a known-broken build.
4. Only then notify Jarmo: state what was verified, attach/describe evidence (screenshots for UI work), and name exactly what he should look at.

This step sits BEFORE `qa-validator` sign-off and before any release gate. It is not optional and not delegable to Jarmo.

## Risks

- OpenCode Desktop-v2 migration is the single highest-uncertainty item — if the ACP surface changed in ways Ritemark depends on, this could expand scope significantly beyond a version bump. Surface any such finding to Jarmo immediately rather than absorbing it silently into Phase 3.
- The `ReviewDecision` enum discrepancy noted in Sprint 96 (`'accept'/'decline'` in our code vs. `'approved'/'denied'` upstream, pre-existing, not a regression) should be re-checked for both Claude and OpenCode's own approval vocabularies while this sprint already has approval-plumbing under the microscope for Hard Gate 1.
- Live-turn smoke requires real auth (Claude OAuth/API key, OpenCode BYOK) — same dependency Sprint 96 had on Jarmo's Codex auth; plan for Jarmo's involvement at the live-smoke step for both runtimes.
- Shell-tier release process (Gate 1 technical + Gate 2 Jarmo-tested, notarization, Windows CI) applies regardless of how small the code diff is — don't let "it's just a manifest bump" understate the release-process weight.
- Parallel-session re-verification (new, because Sprint 99 lands first) roughly doubles the QA surface per runtime — single-session AND concurrent-session behavior both need evidence. Don't let time pressure collapse the Parallel Sessions Matrix into "well, single-session passed, it's probably fine concurrently" — concurrency bugs (races, shared state) are exactly the class of bug that a version bump can silently introduce or fix.

## Status

**Track:** Plain full track
**Current Phase:** 2 (PLAN) — awaiting Jarmo approval
**Approval Required:** Yes

## Approval

- [ ] Jarmo approved this sprint plan

**Awaiting Jarmo approval — no code until approved.**
