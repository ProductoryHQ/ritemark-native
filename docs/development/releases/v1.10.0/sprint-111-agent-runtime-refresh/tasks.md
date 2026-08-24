# Sprint 111 Tasks

## Phase 0: Version and protocol audit (R1–R4)
- [x] Record current/target versions, official URLs, publish times, artifacts, licenses, and checksums in `research/runtime-version-audit.md`.
- [x] Inspect all Codex 0.149.0 platform archives and diff the app-server lifecycle/protocol against Ritemark fixtures.
- [x] Verify Claude Code 2.1.239 ↔ Agent SDK 0.3.239 parity, peer requirements, stubs, effort types, and redistribution notice.
- [x] Exercise OpenCode 1.18.21 through a temporary ACP SDK 1.4.0 audit harness, including `thought_level` discovery.
- [x] Record platform gaps, protocol adaptations, dependency/bundle impact, and rollback path.
- [x] Obtain Jarmo’s explicit Phase 0 pin/protocol decision before Phase 1 (2026-08-24).

## Phase 1: Manifest and dependencies (R1, R2, R4, R5)
- [x] Update all runtime/platform entries in `binaries/agents/manifest.json` with exact URLs, SHA-256 values, archive paths, version checks, architecture patterns, and licenses.
- [x] Update runtime README and any third-party notices with the approved vendor/version baseline.
- [x] Pin Claude Agent SDK 0.3.239 and ACP SDK 1.4.0; regenerate the extension lockfile.
- [x] Update npm peer stubs/esbuild externals only as required by the approved audit (none required beyond the exact dependency pins).
- [x] Add a hard Claude SDK↔binary parity check.

## Phase 2: Protocol adapters (R3, R4)
- [x] Implement measured Codex 0.149.0 protocol changes and update focused fixtures/tests.
- [x] Implement measured Claude 0.3.239 SDK changes without leaking SDK types into shared/webview contracts (no adapter code change required).
- [x] Contain ACP 1.x migrations inside `src/acp/` and update config/model/cancel/approval tests (the existing adapter contract compiled unchanged).
- [x] Capture runtime/model effort capability evidence for Sprint 112 without adding its UI.

## Phase 3: Runtime regression floor (R6, R7)
- [x] Run auth/setup, first/second turn, model, Auto/Ask/Plan, tools, approvals/questions, browser, cancel, and disposal matrices.
- [x] Run two-conversation isolation tests for each runtime.
- [x] Rerun Sprint 110 continuation tests against the final pins and update changed decisions/evidence.
- [x] Test bundled/system preference, missing/corrupt binary, checksum mismatch, cross-version Claude pair, and one-runtime failure isolation.

## Phase 4: Platform and packaging evidence (R5, R8)
- [x] Fetch and verify darwin-arm64 locally with `scripts/fetch-agent-runtimes.sh` and `scripts/verify-agent-runtimes.sh`.
- [ ] Verify darwin-x64 and win32-x64 artifacts from their native CI paths.
- [x] Verify extension build, retained production dependencies, binary placement, architecture, version output, and signing inputs locally; native CI rows remain above.
- [x] Run release preflight and record any release-only blockers separately from sprint correctness (passed 2026-08-24; only expected pre-commit branch/dirty warnings).

## Phase 5: QA and closeout (R8)
- [x] Execute every locally applicable scenario in `scenarios.md`; attach automated/live evidence for ★ cases. Native CI scenarios remain in Phase 4.
- [x] Run focused runtime suites and `./scripts/validate-qa.sh`.
- [x] Update `docs/development/architecture.md` with a Last updated date on/after branch creation.
- [x] Update `docs/CHANGELOG.md`, v1.10.0 release notes/test checklist, and release tracker; issue #207 closeout follows native CI.
- [x] Obtain QA validation before commit/push/PR or ready handoff (local QA passed 2026-08-24).
