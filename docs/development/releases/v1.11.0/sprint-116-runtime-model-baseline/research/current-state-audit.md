# Sprint 116 Research — Current Runtime and Model Baseline Audit

**Date:** 2026-09-13<br>
**Decision:** Use the current v1.10 snapshot only as the known-good starting point. Re-audit official candidates at Sprint 116 kickoff; do not copy the 2026-09-07 “latest” values into product pins without new evidence.

## What Was Inspected

- `extensions/ritemark/binaries/agents/manifest.json`
- `extensions/ritemark/package.json` and `package-lock.json`
- `scripts/validate-agent-runtime-manifest.mjs` and tests
- `scripts/fetch-agent-runtimes.sh`, `verify-agent-runtimes.sh`, build/package validators
- `src/agent/`, `src/codex/`, `src/acp/`, `src/runtime/`
- `src/ai/modelConfig.ts` and `src/ai/modelCatalog/`
- Sprint 110 continuation and Sprint 112 effort contracts

## Current Known-Good Snapshot

| Boundary | Current checked-in value | Current invariant |
|---|---:|---|
| Claude Code binary | 2.1.239 | Three native target rows |
| Claude Agent SDK | 0.3.239 | Exact dependency; binary/SDK patch lockstep and optional packages validated |
| Codex app-server | 0.153.0 | Three native target rows |
| Codex code-mode-host | 0.153.0 | Required beside app-server for file tools |
| Codex Windows sandbox helpers | 0.153.0 | Windows-only setup + command-runner completeness |
| OpenCode | 1.18.21 | Three native target rows |
| ACP SDK | 1.4.0 | Exact dependency |
| Manifest schema | 2 | Component/target-aware validation |
| Bundled catalog timestamp | 2026-07-25 | Offline curated floor; live/remote layers may be newer |

## Findings

| ID | Finding | Consequence for Sprint 116 |
|---|---|---|
| F1 | The manifest is now component-aware and includes 14 rows (8 Codex + 3 Claude + 3 OpenCode), not the older one-binary-per-runtime assumption. | The audit must compare complete component sets and preserve platform-only Codex helpers. |
| F2 | Approved versions are duplicated deliberately in `validate-agent-runtime-manifest.mjs`. | A pin update must change manifest, validator fixtures, dependencies, and lockfile coherently. |
| F3 | Claude lockstep includes SDK optional packages for more platforms than the three shipped targets. | Package-lock verification must remain broader than the binary manifest target matrix. |
| F4 | Some Codex Windows helpers are IPC endpoints with no meaningful CLI smoke command. | Native proof must distinguish invocable binaries from checksum/architecture/completeness-only helpers. |
| F5 | Build scripts fetch target runtimes and validate staged output. | Sprint evidence must include both source manifest checks and packaged target subset checks. |
| F6 | `modelConfig.ts` is the canonical ID registry, but `bundledCatalog.ts` carries detailed provider projections and defaults. | Refresh must prevent identity drift while allowing richer projection metadata. |
| F7 | OpenAI/Gemini comments in `modelConfig.ts` still say January 2026, and the bundled catalog date is older than the release. | Every curated entry/default needs a dated provider audit. |
| F8 | Codex IDs include the current GPT-5.6 family plus earlier fallbacks. | Candidate app-server acceptance, labels, effort ranges, and default ordering must be tested together. |
| F9 | OpenCode model IDs are composite provider/model strings and include direct-provider and OpenRouter projections. | Deduplication must preserve provider route while avoiding false same-model aliases within one route. |
| F10 | Remote discovery/cache and bundled floor already form layered availability. | Sprint 116 should refresh inputs, not replace the resolver architecture without measured need. |
| F11 | Continuation and effort are shared contracts above adapters. | New runtime versions must re-run these matrices; a startup/version check alone is insufficient. |
| F12 | Provider availability is normalized independently after v1.10 RC fixes. | One signed-out provider must stay isolated throughout the refresh. |

## Existing Validation Worth Preserving

- Exact manifest/component/target/version/license/install-name checks.
- Checksum-before-extract and target architecture verification.
- Claude binary/SDK patch parity plus exact lockfile optional packages.
- ACP exact dependency validation.
- Runtime-specific protocol fixtures behind the shared `AgentRuntime` boundary.
- Shared `UnifiedApprovalGate`, `BrowserToolsInjector`, continuation, effort, error-presentation, and conversation-scoping tests.
- Bundled/remote/live model resolver tests and sidebar bootstrap/model presentation tests.

## Phase 0 Evidence

The dated candidate snapshot, measured findings, completed probes and remaining gaps are now recorded in [runtime-model-audit.md](./runtime-model-audit.md). The checklist below describes the full audit requirement; it does not imply that all items remain unstarted.

- Official candidate versions and all native artifacts as of kickoff date.
- Checksums/archive layouts/licenses for the complete component set.
- Candidate SDK compile and captured protocol diffs.
- Authenticated behavioral canaries on each runtime.
- Native darwin-x64 and win32-x64 startup/behavior evidence.
- Provider-backed model availability, aliases, deprecations, capabilities, and default recommendation.
- Exact rollback snapshot and decision record.

No manifest, dependency, lockfile, catalog, default, or adapter change is authorized by this audit alone.
