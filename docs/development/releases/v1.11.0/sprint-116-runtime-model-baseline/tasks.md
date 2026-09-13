# Sprint 116 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only when the named artifact or evidence exists on the approved sprint branch.

> **Gate:** Phase 0 is audit/documentation only. Product pins, dependencies, lockfiles, manifests, model config, and adapters may change only after Jarmo approves the Phase 0 recommendation.

## Phase 0: Audit and freeze recommendation (W0 — R1–R7)

- [ ] Capture the current manifest, SDK pins, lockfile identity, model catalog/defaults, and last known-good test/release evidence in `research/runtime-model-audit.md`.
- [ ] Enumerate official candidate releases and every required darwin-arm64, darwin-x64, and win32-x64 component; record sources, licenses, layouts, and candidate checksums.
- [ ] Run isolated candidate fetch/architecture/startup probes without editing product inputs.
- [ ] Compile candidate Claude/ACP SDKs against current adapters and capture protocol diffs.
- [ ] Run authenticated Claude, Codex, and OpenCode canaries including file tools, approval/question, cancellation, auth failure, and provider isolation.
- [ ] Verify live model discovery and identify stale, duplicate, deprecated, unsupported, or missing curated entries/defaults.
- [ ] Re-run continuation and thinking-effort audit matrices against candidates.
- [ ] Write one coherent pin/catalog recommendation and exact rollback snapshot.
- [ ] **Jarmo Phase 0 gate:** approve exact pins, measured protocol work, and catalog/default changes.

## Phase 1: Runtime supply-chain update (W1 — R1, R2, R7)

- [ ] Update all approved runtime component rows in `manifest.json` as one snapshot.
- [ ] Update manifest validator approved versions/component rules and negative fixtures.
- [ ] Update exact Claude/ACP SDK dependencies and lockfile; verify Claude binary/SDK/optional-package lockstep.
- [ ] Run fetch verification for all available targets and confirm archive safety/install names/modes.
- [ ] Update runtime README/notices and rollback record.

## Phase 2: Measured compatibility work (W2 — R3)

- [ ] Implement only Phase 0-approved Claude adapter changes and fixtures, or record no change required.
- [ ] Implement only Phase 0-approved Codex adapter changes and fixtures, or record no change required.
- [ ] Implement only Phase 0-approved ACP/OpenCode adapter changes and fixtures, or record no change required.
- [ ] Prove shared approval, browser injection, conversation scoping, cancellation, and error contracts remain intact.

## Phase 3: Canonical model refresh (W3 — R4)

- [ ] Inventory literal model IDs and remove any competing authority.
- [ ] Update `modelConfig.ts` canonical IDs and defaults from approved evidence.
- [ ] Update bundled catalog projections, labels, order, tiers, deprecations, and effort capabilities.
- [ ] Add alias/deduplication, deprecated-default, offline-floor, cache, and discovery-disagreement tests.
- [ ] Verify all Agent Chat, Flow, Settings, and BYOK/OpenCode projections consume the same identities.

## Phase 4: Behavior regression (W4 — R5)

- [ ] Run per-runtime start/stream/tool/approval/question/plan/cancel/failure/completion matrices.
- [ ] Verify provider availability/auth isolation and sidebar bootstrap/picker behavior.
- [ ] Re-run Sprint 110 continuation matrix on final pins.
- [ ] Re-run Sprint 112 thinking-effort matrix on final pins.
- [ ] Verify browser tools enter each runtime only through `BrowserToolsInjector`.

## Phase 5: Native and package evidence (W5 — R2, R6, R7)

- [ ] Record darwin-arm64 fetch, architecture, startup, and authenticated behavior evidence.
- [ ] Record native darwin-x64 matrix evidence with exact commit/manifest/artifact digests.
- [ ] Record native win32-x64 matrix evidence including platform helper completeness.
- [ ] Verify staged extension/build output contains only the approved target component set.
- [ ] Record full signed artifact verification as a remaining release gate, not a sprint claim.

## Phase 6: QA and closeout (W6 — R8)

- [ ] Run all focused runtime/manifest/model/continuation/effort/bootstrap tests and extension compile/build.
- [ ] Walk every ★ scenario and link evidence.
- [ ] Run `./scripts/validate-qa.sh` through the repository QA gate.
- [ ] Update architecture, runtime notices, user-visible docs, changelog, v1.11 release notes, and parent tracker.
- [ ] Update milestone issue and PR; verify every checked task against the diff/evidence before readiness handoff.
