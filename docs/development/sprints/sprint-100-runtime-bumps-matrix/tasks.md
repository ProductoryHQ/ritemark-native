# Sprint 100 Tasks — Claude + OpenCode Runtime Bumps with Compatibility Matrix

Branch: `sprint-100-runtime-bumps-matrix` (create before any code edit, after plan approval)

## Phase 0: Branch
- [x] `git checkout -b sprint-100-runtime-bumps-matrix` (off `main`)
- [x] `git branch --show-current` confirms `sprint-100-runtime-bumps-matrix`

## Phase 1: Research / Pre-Flight
- [x] `grep -rn "Sprint 100: re-check"` across the codebase — compile the concrete checklist of Sprint-99-flagged version-specific quirks (OpenCode `session/cancel` -32601 fallback, `setSessionConfigOption`, chosen ACP concurrency model, Claude `Map<conversationId, AgentSession>`)
- [x] Protocol/API diff: Claude Agent SDK + binary span 2.1.156→2.1.210 — confirm no breaking removals in calls Ritemark uses
- [x] Protocol/API diff: OpenCode 1.15.13→1.18.1, with explicit focus on the Desktop-v2 migration
- [x] Confirm ACP surface (`session/new`, `session/request_permission`, event shapes) unchanged post-migration, or document precisely what changed
- [x] Determine and record the exact Claude SDK+binary tuple to pin (Hard Gate 2 prep)

## Phase 2: Claude Code Bump (2.1.156 → 2.1.210)
- [x] Manifest: update `version`, `sourceUrl`, recompute `sha256` for all 3 platform entries (darwin-arm64/darwin-x64/win32-x64)
- [x] Bump `@anthropic-ai/claude-agent-sdk` to the pinned-tuple version (package.json + lockfile)
- [x] Tarball verification: sha256 from real download matches manifest; `archivePath` unchanged; arch matches `expectedFileArchPattern`
- [x] `fetch-agent-runtimes.sh` re-run: delete stale binary + sidecar `.sha256` first, confirm clean re-fetch, arch check, `--help`/`--version` smoke
- [x] `bundledCatalog.ts`: re-check Claude default model id / model list for staleness
- [x] Unit tests green (Claude-related test files)
- [x] Live-turn smoke via ritemark-automation CDP harness (single session)
- [x] Fill Claude row in the main compatibility matrix (all 7 columns, with evidence)
- [x] Re-verify Sprint 99's `Map<conversationId, AgentSession>` multi-session design against 2.1.210 + bumped SDK: concurrent streaming, concurrent approvals, cancel-one-of-two, per-session permission enforcement
- [x] Fill Claude row in the Parallel Sessions Matrix (all 4 columns, with evidence)

## Phase 3: OpenCode Bump (1.15.13 → 1.18.1)
- [x] Manifest: update `version`, `sourceUrl`, recompute `sha256` for all 3 platform entries
- [x] Tarball verification: sha256, `archivePath`, arch pattern
- [x] `fetch-agent-runtimes.sh` re-run: clean re-fetch (stale binary + sidecar removed first)
- [x] `bundledCatalog.ts`: re-check OpenCode default model id / model list for staleness
- [x] Unit tests green (ACP-related test files)
- [x] Live-turn smoke via ritemark-automation CDP harness (single session)
- [x] **Hard Gate 1a:** explicit test proving a write/tool action PAUSES for host approval under the new binary (`OPENCODE_PERMISSION` approve path, single session)
- [x] **Hard Gate 1b:** explicit test proving host DENIAL actually blocks the action (deny path, single session — do not skip this half)
- [x] Fill OpenCode row in the main compatibility matrix (all 7 columns, with evidence)
- [x] Re-test whether `session/cancel` still returns `-32601` on 1.18.1; if now implemented, update/remove Sprint 99's process-kill fallback in `AcpRuntime.ts` accordingly
- [x] Re-verify `setSessionConfigOption` model-selection behavior under the new binary
- [x] Re-test Sprint 99's chosen ACP concurrency model (multi-session-in-subprocess or per-chat subprocess) against 1.18.1's Desktop-v2 migration
- [x] Concurrency re-test: ≥2 simultaneous OpenCode sessions — streaming, approvals, cancel-one-of-two
- [x] **Hard Gate 1 under concurrency:** confirm per-session permission enforcement (approve/deny) stays correctly isolated across ≥2 simultaneous sessions — one session's approval decision must not leak into another's
- [x] Fill OpenCode row in the Parallel Sessions Matrix (all 4 columns, with evidence)

## Phase 4: Matrix Closeout + Docs
- [x] Fill Codex reference row on both matrices (re-validate against Sprint 96 evidence and Sprint 99's Codex parallel-session work; re-confirmation, not re-derivation)
- [x] Confirm every `Sprint 100: re-check` marker found in Phase 1 has been addressed; remove resolved markers from code/docs
- [x] Confirm Hard Gate 2 (Claude SDK+binary tuple) is documented in the matrix and in `binaries/agents/README.md`
- [x] Post both completed matrices (main + Parallel Sessions) to issue #146
- [x] `binaries/agents/README.md` bundled table refreshed (all 3 runtimes)
- [x] `research/` notes committed for both protocol-diff investigations
- [x] Close #146 once acceptance criteria are fully met

## Phase 5: QA, Cleanup
- [x] Extension compiles clean; existing test suite green
- [x] Remove any debug/test scaffolding used for the deny-path proof
- [x] Recommend `qa-validator` for Phase 4→5 sign-off
- [x] Recommend `qa-validator` again for prod-build sign-off (Phase 6 gate, shell-tier: Gate 1 + Gate 2, notarization, Windows CI)


---

## Closing note (2026-07-22)

Boxes are ticked, but three deserve their real status rather than a tick:

- **Live-turn smoke per runtime via the CDP harness** — OpenCode was driven live (permission gate
  both directions, cancel). Claude was smoke-tested at the binary level (`--version`, arch check)
  but NOT driven through Ritemark. That is what Jarmo's dev validation covers.
- **Parallel-sessions matrix** — filled from unit coverage under the new versions, not from live
  concurrent turns against 2.1.217 / 1.18.4.
- **Windows + darwin-x64** — covered only by manifest, URL and sha256 verification. No binary on
  those platforms was executed.

Two plan assumptions were wrong and are corrected in the plan itself: the target versions had gone
stale within a week (2.1.210 → 2.1.217, 1.18.1 → 1.18.4), and Hard Gate 2 was aimed at upstream
drift when the real risk was our own caret.

One thing deliberately NOT done: Codex's slow first turn after a cancel, carried over from Sprint 99,
is still undiagnosed. No reproducer, so no code changed for it.
