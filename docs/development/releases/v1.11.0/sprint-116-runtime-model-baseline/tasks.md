# Sprint 116 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only when the named artifact or evidence exists on the approved sprint branch.

> **Gate passed 2026-09-13:** Jarmo approved the exact package, protocol fixes, and catalog/default changes in the Phase 0 recommendation.

## Phase 0: Audit and freeze recommendation (W0 — R1–R7)

- [x] Capture the current manifest, SDK pins, lockfile identity, model catalog/defaults, and last known-good test/release evidence in `research/runtime-model-audit.md`.
- [x] Enumerate official candidate releases and every required darwin-arm64, darwin-x64, and win32-x64 component; record sources, licenses, layouts, and candidate checksums.
- [x] Replace the initial 14 single-artifact view with the complete package model: 12 source rows, 25 installed files, Codex official tree preserved, OpenCode ripgrep 15.1.0 owned under `opencode-path`, and clean-PATH probes captured.
- [x] Run isolated candidate fetch/architecture probes for all 14 components and startup probes for the four invocable Apple Silicon binaries without editing product inputs.
- [ ] Complete native Intel/Windows startup probes; cross-inspection is not native execution.
- [x] Compile candidate Claude/ACP SDKs against current adapters and capture observed protocol differences/limits in the audit.
- [ ] Run authenticated Claude, Codex, and OpenCode canaries including file tools, approval/question, cancellation, auth failure, and provider isolation.
- [ ] Verify live model discovery and identify stale, duplicate, deprecated, unsupported, or missing curated entries/defaults.
- [ ] Re-run continuation and thinking-effort audit matrices against candidates.
- [x] Write one coherent pin/catalog recommendation and exact rollback snapshot, explicitly retaining incomplete verification and approval gates.
- [x] **Jarmo Phase 0 gate:** exact pins, measured protocol work, and catalog/default changes approved on 2026-09-13.

**2026-09-13 evidence:** [audit](./research/runtime-model-audit.md), [approved recommendation](./research/phase-0-recommendation.md). The pre-change focused suite, baseline/candidate compile, Claude/Codex canaries, and all three continuation probes pass within their recorded limits. The approved implementation adds final runtime, catalog, and Codex cancellation fixtures; OpenCode authenticated BYOK remains release evidence rather than a claim.

**Resolved audit interruption:** Jarmo confirmed that he denied the unexpected macOS Keychain prompt raised by the separately launched audit runtime. A fresh candidate 0.154.0 direct file-tool canary then passed `thread/start`, code-mode-host editing and terminal completion. The timeouts were audit-auth interruptions, not a candidate or product regression. Immediate cancellation/resend remains a separate behavior-matrix item.

## Phase 1: Runtime supply-chain update (W1 — R1, R2, R7)

- [x] Update all approved runtime source rows in schema-v3 `manifest.json` as one snapshot.
- [x] Update manifest validator approved versions/package-member rules and negative fixtures.
- [x] Update exact Claude SDK dependency and lockfile; retain ACP 1.4.0 and verify all eight Claude optional packages in lockstep.
- [x] Run fetch verification for all targets and confirm archive safety, exact members, install paths, modes, hashes, and architectures.
- [x] Update runtime README/notices and rollback record.

## Phase 2: Measured compatibility work (W2 — R3)

- [x] Record no Claude adapter change required; SDK 0.3.270 compiles and the existing persistent-session cancellation path passed.
- [x] Implement the approved Codex cache, explicit-thread routing, and immediate-Stop fixes with fixtures.
- [x] Prepend OpenCode's packaged `opencode-path` dependency directory in the ACP subprocess only; keep ACP protocol behavior unchanged.
- [x] Prove shared approval, browser injection, conversation scoping, cancellation, and error contracts remain intact in focused contract/lifecycle tests; native UI coverage remains in Phase 4.

## Phase 3: Canonical model refresh (W3 — R4)

- [x] Inventory literal model IDs and keep canonical provider IDs in `modelConfig.ts`; compose OpenCode routes from those IDs.
- [x] Update `modelConfig.ts` canonical IDs and defaults from approved evidence.
- [x] Update bundled catalog projections, labels, order, tiers, deprecations, and effort capabilities.
- [x] Add alias/deduplication, deprecated-default, offline-floor, cache, and discovery-disagreement tests.
- [x] Verify Agent Chat, Flow, Settings, and BYOK/OpenCode projections consume canonical identities; static validation rejects production model-ID duplication outside `modelConfig.ts`.

## Phase 4: Behavior regression (W4 — R5)

- [ ] Run per-runtime start/stream/tool/approval/question/plan/cancel/failure/completion matrices.
- [x] Verify provider availability/auth isolation and sidebar bootstrap/picker behavior in a fresh RUNDEV profile; the signed-out recovery state, authenticated Claude/Codex/OpenCode choices, and three-runtime document handoff all behaved independently.
- [ ] Re-run Sprint 110 continuation matrix on final pins.
- [ ] Re-run Sprint 112 thinking-effort matrix on final pins.
- [x] Verify browser tools enter each runtime only through `BrowserToolsInjector`; code review and lifecycle tests found no new runtime-specific injection path.

## Phase 5: Native and package evidence (W5 — R2, R6, R7)

- [x] Record darwin-arm64 fetch, architecture, startup, and authenticated Codex cancellation/resend evidence.
- [ ] Record native darwin-x64 matrix evidence with exact commit/manifest/artifact digests (deferred to the v1.11 release gates by the release owner on 2026-09-14).
- [ ] Record native win32-x64 matrix evidence including platform helper completeness (deferred to the v1.11 release gates by the release owner on 2026-09-14).
- [x] Verify staged target copies and installed runtime trees contain only the approved platform component set; signed application validation remains a release gate.
- [x] Record full signed artifact verification as a remaining release gate, not a sprint claim.

## Phase 6: QA and closeout (W6 — R8)

- [x] Run all focused runtime/manifest/model/continuation/effort/bootstrap tests and extension compile/build.
- [x] Walk every ★ scenario and link its pass, partial, or pending evidence in [research/rundev-smoke.md](./research/rundev-smoke.md).
- [x] Run `./scripts/validate-qa.sh` through the repository QA gate; see [qa-validation.md](./research/qa-validation.md).
- [x] Update architecture, runtime notices, user-visible docs, changelog, v1.11 release notes, and parent tracker.
- [ ] Update milestone issue and PR; verify every checked task against the diff/evidence before readiness handoff.
