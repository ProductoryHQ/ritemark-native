# Sprint 111 Tasks

## Phase 0: Version and protocol audit (R1–R4)
- [ ] Record current/target versions, official URLs, publish times, artifacts, licenses, and checksums in `research/runtime-version-audit.md`.
- [ ] Inspect all Codex 0.149.0 platform archives and diff the app-server lifecycle/protocol against Ritemark fixtures.
- [ ] Verify Claude Code 2.1.239 ↔ Agent SDK 0.3.239 parity, peer requirements, stubs, effort types, and redistribution notice.
- [ ] Exercise OpenCode 1.18.21 through a temporary ACP SDK 1.4.0 audit harness, including `thought_level` discovery.
- [ ] Record platform gaps, protocol adaptations, dependency/bundle impact, and rollback path.
- [ ] Obtain Jarmo’s explicit Phase 0 pin/protocol decision before Phase 1.

## Phase 1: Manifest and dependencies (R1, R2, R4, R5)
- [ ] Update all runtime/platform entries in `binaries/agents/manifest.json` with exact URLs, SHA-256 values, archive paths, version checks, architecture patterns, and licenses.
- [ ] Update runtime README and any third-party notices with the approved vendor/version baseline.
- [ ] Pin Claude Agent SDK 0.3.239 and ACP SDK 1.4.0; regenerate the extension lockfile.
- [ ] Update npm peer stubs/esbuild externals only as required by the approved audit.
- [ ] Add a hard Claude SDK↔binary parity check.

## Phase 2: Protocol adapters (R3, R4)
- [ ] Implement measured Codex 0.149.0 protocol changes and update focused fixtures/tests.
- [ ] Implement measured Claude 0.3.239 SDK changes without leaking SDK types into shared/webview contracts.
- [ ] Contain ACP 1.x migrations inside `src/acp/` and update config/model/cancel/approval tests.
- [ ] Capture runtime/model effort capability evidence for Sprint 112 without adding its UI.

## Phase 3: Runtime regression floor (R6, R7)
- [ ] Run auth/setup, first/second turn, model, Auto/Ask/Plan, tools, approvals/questions, browser, cancel, and disposal matrices.
- [ ] Run two-conversation isolation tests for each runtime.
- [ ] Rerun Sprint 110 continuation tests against the final pins and update changed decisions/evidence.
- [ ] Test bundled/system preference, missing/corrupt binary, checksum mismatch, cross-version Claude pair, and one-runtime failure isolation.

## Phase 4: Platform and packaging evidence (R5, R8)
- [ ] Fetch and verify darwin-arm64 locally with `scripts/fetch-agent-runtimes.sh` and `scripts/verify-agent-runtimes.sh`.
- [ ] Verify darwin-x64 and win32-x64 artifacts from their native CI paths.
- [ ] Verify extension build, retained production dependencies, binary placement, architecture, version output, and signing inputs.
- [ ] Run release preflight and record any release-only blockers separately from sprint correctness.

## Phase 5: QA and closeout (R8)
- [ ] Execute every scenario in `scenarios.md`; attach automated/live evidence for ★ cases.
- [ ] Run focused runtime suites and `./scripts/validate-qa.sh`.
- [ ] Update `docs/development/architecture.md` with a Last updated date on/after branch creation.
- [ ] Update `docs/CHANGELOG.md`, v1.10.0 release notes/test checklist, release tracker, and issue #207.
- [ ] Obtain QA validation before commit/push/PR or ready handoff.
