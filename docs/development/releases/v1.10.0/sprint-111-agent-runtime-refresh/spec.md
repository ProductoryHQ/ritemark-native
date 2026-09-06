# Sprint 111 Spec — Agent Runtime Refresh

## Purpose

Refresh every bundled autonomous agent runtime and its protocol SDK to one verified v1.10.0 baseline. The sprint updates supply-chain pins and compatibility evidence without changing the Agent Chat product contract.

## Principles

- Pin exact versions and checksums; never resolve `latest` during a build.
- Audit external protocol changes before adapting production code.
- Keep Claude Code binary and Claude Agent SDK patches in lockstep.
- Prove macOS arm64, macOS x64, and Windows x64 artifacts independently.
- Prefer a loud, reversible failure over a partially upgraded runtime set.

## Requirements

### R1: Reproducible upstream snapshot

As the release team, we want one dated source-of-truth snapshot, so every v1.10.0 build ships the same runtime bytes.

Acceptance criteria:
- Phase 0 records the current pin, target pin, upstream release URL, publication time, artifact names, checksums, license, and observed protocol delta for every runtime and SDK.
- The 2026-08-22 target snapshot is Codex `0.149.0`, Claude Code `2.1.239`, Claude Agent SDK `0.3.239`, OpenCode `1.18.21`, and ACP TypeScript SDK `1.4.0`.
- Targets are exact pins. If a later version is proposed before implementation, the sprint owner records a new dated decision and reruns Phase 0; no task says only “upgrade to latest.”
- All three platform entries for one runtime use the same upstream version.

### R2: Claude binary and SDK parity

As a Claude user, I want the bundled binary and SDK to be compatible, so Agent Chat does not fail because two Anthropic patches drifted.

Acceptance criteria:
- Claude Code `2.1.239` and `@anthropic-ai/claude-agent-sdk` `0.3.239` move in the same change.
- `extensions/ritemark/package.json`, its lockfile, npm peer stubs, binary manifest, and runtime README agree on the pair.
- The installed SDK reports `claudeCodeVersion: 2.1.239`, and the fetched executable reports `2.1.239` on every supported platform.
- A parity check fails CI/preflight when the binary and SDK patch numbers differ.

### R3: Codex protocol compatibility

As a Codex user, I want the updated app-server to preserve Ritemark’s runtime behavior, so an upstream protocol change cannot silently break chat.

Acceptance criteria:
- Codex `rust-v0.149.0` is audited against Ritemark’s hand-written JSON-RPC types before production pins change.
- The audit covers initialize, model listing, thread start/read/resume, turn start, collaboration mode, approvals, questions, dynamic tools, cancellation, event routing, auth, and reasoning-effort metadata.
- `invocationMode` is derived from the downloaded artifacts, not copied from the previous manifest.
- Unknown optional fields are tolerated; missing or changed required fields fail a focused contract test with actionable diagnostics.

### R4: OpenCode and ACP compatibility

As an OpenCode user, I want the runtime and ACP client upgraded together safely, so model selection, thought-level configuration, approvals, and cancellation remain reliable.

Acceptance criteria:
- OpenCode `1.18.21` is tested with `@agentclientprotocol/sdk` `1.4.0` before the production dependency is changed from `0.22.1`.
- The audit covers initialize, session creation, `configOptions`, model selection, `thought_level`, prompt streaming, file operations, approval, cancellation, multi-session routing, and shutdown.
- Any ACP 1.x API migration is isolated inside `src/acp/`; no runtime-specific ACP shapes leak into the webview.
- If the major SDK upgrade cannot satisfy the existing contract, Sprint 111 stops at the Phase 0 decision gate rather than silently shipping OpenCode on an unreviewed mixed version.

### R5: Verified platform artifacts

As a Ritemark installer user, I want the correct executable for my machine, so the app never ships a missing, wrong-architecture, or tampered runtime.

Acceptance criteria:
- `manifest.json` contains the exact upstream URL, SHA-256, archive layout, install name, validation arguments, architecture pattern, and current license notice for each runtime on darwin-arm64, darwin-x64, and win32-x64.
- `scripts/fetch-agent-runtimes.sh` verifies the archive checksum before extraction and never falls back to an unverified download.
- `scripts/verify-agent-runtimes.sh` validates version, architecture, executability/PE header, startup behavior, and runtime-specific behavioral probes.
- Binary payloads remain gitignored and are materialized by the established build pipeline.

### R6: Behavioral regression floor

As an Agent Chat user, I want the upgraded runtimes to behave like the release plans promise, so a version bump does not regress existing features.

Acceptance criteria:
- Claude, Codex, and OpenCode pass focused smoke matrices for auth/setup, first turn, second turn, model selection, Auto/Ask/Plan capability truth, tools, approvals/questions, browser injection where supported, cancellation, two simultaneous conversations, process restart, and clean disposal.
- Sprint 110 continuation tests are rerun against the refreshed versions; prior native-resume conclusions are not assumed to survive the upgrade.
- Runtime version and source appear in existing diagnostics without exposing tokens, provider session IDs, or local secrets.
- System-runtime preference remains supported, but v1.10.0 release evidence is produced against the bundled pins.

### R7: Rollback and failure isolation

As the release team, we want a safe rollback path, so one bad upstream runtime cannot force an unverifiable release.

Acceptance criteria:
- The old manifest and package pins can be restored without changing stored conversation records or webview state.
- A runtime-specific startup failure marks only that runtime unavailable and preserves other runtimes and durable history.
- Partial manifest updates, cross-version Claude pairs, checksum mismatches, and missing platform artifacts are hard failures.
- No automatic in-app runtime update channel or mutable remote binary source is introduced.

### R8: Architecture, license, and release evidence

As the team, we want the shipped runtime baseline documented, so maintenance and release verification start from known facts.

Acceptance criteria:
- `extensions/ritemark/binaries/agents/README.md` and all relevant third-party notices match the final pins, vendors, repositories, and license URLs.
- `docs/development/architecture.md` records the final runtime/SDK baseline and has `Last updated` on or after the Sprint 111 branch creation date.
- The release tracker, changelog, v1.10.0 release notes, test checklist, and linked issue #207 record the upgrade and evidence.
- `./scripts/release-preflight.sh`, `./scripts/verify-agent-runtimes.sh`, focused runtime suites, and `./scripts/validate-qa.sh` pass before the sprint is handed off as ready.

## Non-Requirements

- Composer thinking-effort UI or runtime effort mapping; that is Sprint 112.
- Adding a fourth runtime or changing `AgentRuntimeKind`.
- A runtime marketplace, background updater, or runtime-only release channel.
- Model catalog redesign or hardcoding model IDs outside `src/ai/modelConfig.ts` and the model-catalog subsystem.
- Resuming an executing turn after process exit.

## Resolved Questions

- **2026-08-22 — Refresh precedes effort UI.** Sprint 112 must design against the final runtime protocols rather than the older pins.
- **2026-08-22 — ACP SDK is part of the refresh.** OpenCode’s executable and Ritemark’s ACP client form one compatibility surface; `0.22.1` → `1.4.0` receives an explicit major-version audit.
- **2026-08-22 — Exact snapshot, not floating latest.** Reproducibility outweighs picking up a patch during packaging.

## Open Questions

- Phase 0 must confirm whether Codex `0.149.0` retains direct `codex-app-server` artifacts and whether any required JSON-RPC field changed.
- Phase 0 must confirm OpenCode `1.18.21`’s ACP `thought_level` option shape under SDK `1.4.0`.
- Phase 0 must revalidate Anthropic redistribution terms and peer-stub compatibility for `0.3.239`.
