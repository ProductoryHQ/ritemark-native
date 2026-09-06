# Sprint 111 Technical Plan

## Architecture Overview

Sprint 111 changes the host↔binary and dependency/bundling edges without introducing a new runtime. The three adapters remain behind `AgentRuntime`; binary resolution stays in `src/utils/bundledAgentRuntime.ts`; platform bytes remain described by `binaries/agents/manifest.json` and materialized by project scripts.

The binary manifest changes trigger the Sprint Architecture Gate. `docs/development/architecture.md` must be updated during closeout.

## Workstream 0: Pinned upstream audit (R1–R4)

- Freeze and record the 2026-08-22 source snapshot:
  - Codex `rust-v0.149.0` from [openai/codex releases](https://github.com/openai/codex/releases/tag/rust-v0.149.0).
  - Claude Code `v2.1.239` from [anthropics/claude-code releases](https://github.com/anthropics/claude-code/releases/tag/v2.1.239).
  - Claude Agent SDK `0.3.239` from the [official npm package](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk/v/0.3.239).
  - OpenCode `v1.18.21` from [anomalyco/opencode releases](https://github.com/anomalyco/opencode/releases/tag/v1.18.21).
  - ACP TypeScript SDK `1.4.0` from the [official npm package](https://www.npmjs.com/package/@agentclientprotocol/sdk/v/1.4.0).
- Download into a temporary audit directory; inspect archive layout, executable names, architecture, version output, signing metadata, checksums, and license files.
- Diff Codex protocol/schema behavior against `src/codex/codexProtocol.ts` and recorded fixtures.
- Compile and exercise current ACP client/manager against SDK 1.4.0 and OpenCode 1.18.21 without changing production pins.
- Verify Claude SDK peer requirements, npm stubs, binary version coupling, effort types, and redistribution notice.
- End with a Jarmo decision: approve exact pins, revise them with a dated reason, or block the sprint. No Workstream 1 starts first.

## Workstream 1: Manifest and supply-chain pins (R1, R2, R5)

Primary files:
- `extensions/ritemark/binaries/agents/manifest.json`
- `extensions/ritemark/binaries/agents/README.md`
- `scripts/fetch-agent-runtimes.sh`
- `scripts/verify-agent-runtimes.sh`
- `scripts/lib/verify-opencode.mjs`

Implementation:
- Update all nine then-modeled runtime×platform records with exact versioned URLs, archive paths, SHA-256 values, architecture patterns, validation args, vendor/repository identity, and license notices. RC correction 2026-08-31 supersedes this cardinality with twelve required runtime-component rows after Codex's separate file-tools host was discovered.
- Keep `schemaVersion` stable unless the actual manifest shape changes; always update `generated`.
- Inspect Codex artifacts before retaining `direct-app-server`.
- Add/extend a Claude SDK↔binary parity assertion and ensure failure output names expected and actual values.
- Make verification report platform, source, runtime, and version without secrets.

## Workstream 2: SDK dependency and bundle compatibility (R2, R4)

Primary files:
- `extensions/ritemark/package.json`
- `extensions/ritemark/package-lock.json`
- `extensions/ritemark/npm-stubs/`
- `extensions/ritemark/esbuild.config.mjs`

Implementation:
- Pin Claude Agent SDK exactly to `0.3.239` and ACP SDK exactly to `1.4.0` after Phase 0 approval.
- Regenerate the extension lockfile through npm; do not hand-edit integrity values.
- Update peer stubs only where the new SDK metadata requires it, preserving the documented ESM external-loading arrangement.
- Verify `tsc --noEmit`, esbuild externals, production dependency retention, and app packaging.
- Record material dependency-tree or bundle-size change.

## Workstream 3: Adapter protocol conformance (R3, R4, R6)

### Codex
- Update `src/codex/codexProtocol.ts`, `codexAppServer.ts`, and `CodexRuntime.ts` only for measured `0.149.0` differences.
- Preserve per-conversation thread routing, unified approvals, dynamic browser tools, plan-mode truth, cancellation, and diagnostics.
- Capture model reasoning-effort capability metadata for Sprint 112 without yet adding Composer behavior.

### Claude
- Update `src/agent/AgentRunner.ts`, `AgentSession.ts`, or `ClaudeCodeRuntime.ts` only where the SDK audit proves an API change.
- Preserve permission/plan behavior, callbacks, browser MCP injection, multi-session isolation, and bundled-binary selection.
- Record the final `effort`/adaptive-thinking type surface for Sprint 112.

### OpenCode/ACP
- Contain ACP 1.x migration inside `src/acp/acpClient.ts`, `acpManager.ts`, and `AcpRuntime.ts`.
- Preserve semantic config-option discovery, model choice, approvals, cancel, file operations, and one shared process with isolated sessions.
- Capture `thought_level` options by semantic category for Sprint 112; do not hardcode vendor labels into shared UI.

## Workstream 4: Regression and platform verification (R5–R7)

- Extend focused runtime unit/contract tests and recorded protocol fixtures.
- Run local darwin-arm64 behavioral probes against fetched binaries.
- Use CI artifacts for darwin-x64 and win32-x64; never claim those platforms from an arm64 cross-build.
- Rerun the Sprint 103 policy-truth matrix, Sprint 110 continuation matrix, concurrent-session tests, binary resolver tests, and packaging/preflight hard checks.
- Prove one runtime failure does not dispose siblings or hide durable history.
- Record rollback instructions to the previous exact manifest and package pins.

## Workstream 5: Documentation and release closeout (R8)

- Update architecture runtime baseline and binary-manifest contract.
- Update README, licenses/notices, changelog, release notes, test checklist, release tracker, and issue #207.
- Record target and observed version outputs for all platform artifacts.
- Run `./scripts/verify-agent-runtimes.sh`, focused tests, `./scripts/release-preflight.sh`, and `./scripts/validate-qa.sh` before ready handoff.

## Test Strategy

- Unit: manifest parsing, binary resolution, parity checks, protocol parsers, ACP config mapping, failure isolation.
- Contract: recorded Codex JSON-RPC and ACP message fixtures for required/optional fields.
- Live: first/second turn, modes, tools, approval/question, cancellation, two conversations, restart/continuation.
- Platform: local arm64 plus x64/Windows CI artifact verification.
- Packaging: extension bundle, retained runtime dependencies, fetched payload placement, release preflight.

## Rollback

Revert manifest, runtime README, dependency pins/lockfile, stubs, and any measured adapter compatibility changes as one unit. Binary payloads are re-materialized from the restored manifest. Conversation schemas and webview state are unchanged, so no user-data rollback is required.
