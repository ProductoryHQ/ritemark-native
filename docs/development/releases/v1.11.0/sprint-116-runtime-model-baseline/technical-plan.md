# Sprint 116 Technical Plan

Architecture and execution plan for [spec.md](./spec.md), grounded in [research/current-state-audit.md](./research/current-state-audit.md).

## Architecture Overview

Sprint 116 keeps the three-runtime architecture intact and refreshes inputs at existing authority points:

```text
official version/artifact sources
        ↓ Phase 0 audit + checksums + native probes
binaries/agents/manifest.json ─ package.json/package-lock.json
        ↓ fetch + validate + package
RuntimeRegistry → AgentRuntime implementations
        ↘ BrowserToolsInjector + UnifiedApprovalGate

official/live provider discovery
        ↓ normalize against canonical IDs
src/ai/modelConfig.ts → bundledCatalog.ts → resolver/cache → UI projections
```

No fourth runtime, runtime-specific approval type, runtime-specific browser tools, or second model-ID registry is introduced.

## Expected Files

Runtime inputs and validation:

```text
extensions/ritemark/binaries/agents/manifest.json
extensions/ritemark/binaries/agents/README.md
extensions/ritemark/package.json
extensions/ritemark/package-lock.json
scripts/validate-agent-runtime-manifest.mjs
scripts/validate-agent-runtime-manifest.test.mjs
scripts/fetch-agent-runtimes.sh
scripts/verify-agent-runtimes.sh
```

Measured compatibility changes, only if Phase 0 requires them:

```text
extensions/ritemark/src/agent/**
extensions/ritemark/src/codex/**
extensions/ritemark/src/acp/**
extensions/ritemark/src/runtime/**
```

Model authority and projections:

```text
extensions/ritemark/src/ai/modelConfig.ts
extensions/ritemark/src/ai/modelCatalog/bundledCatalog.ts
extensions/ritemark/src/ai/modelCatalog/schema.ts
extensions/ritemark/src/ai/modelCatalog/resolver.ts
extensions/ritemark/src/ai/modelCatalog/providerDiscovery.ts
extensions/ritemark/webview/src/components/ai-sidebar/modelPresentation.ts
```

## Workstream 0: Audit and freeze recommendation (R1–R7)

- Record current exact manifest/SDK/model snapshot and its known-good evidence.
- Query official release/package metadata for every runtime and SDK; enumerate all platform assets before recommending versions.
- Download candidates into an isolated audit temp directory, verify hashes/archive layouts/architectures, and never mutate the checked-in manifest during discovery.
- Run candidate SDK compiles and captured protocol probes through temporary harnesses.
- Run authenticated canaries for runtime startup, model discovery, continuation, effort, approvals, file tools, and provider isolation.
- Produce `research/runtime-model-audit.md` with a candidate matrix, failures, recommendation, rollback snapshot, and proposed measured code changes.
- Stop for Jarmo's explicit pin/protocol/catalog decision.

## Workstream 1: Exact runtime supply chain (R1, R2, R7)

- Update the manifest as one coherent snapshot after approval.
- Update approved versions embedded in the manifest validator and extend component/target rules only for official required assets.
- Update exact SDK dependencies and lockfile; preserve Claude optional-package parity and ACP exactness.
- Verify fetch-before-extract, archive traversal protection, executable naming/modes, target architecture, and old-output cleanup semantics.
- Update runtime README and notices with exact sources/licenses.
- Keep the prior manifest/dependency/model snapshot in the audit as the rollback authority.

## Workstream 2: Measured adapter compatibility (R3)

- Apply the smallest adapter changes required by Phase 0 captures.
- Keep Claude changes in `src/agent/`, Codex in `src/codex/`, ACP/OpenCode in `src/acp/`, and shared semantics behind `AgentRuntime`/`src/runtime/`.
- Add protocol fixtures for changed required fields and tolerant parsing tests for optional fields.
- Preserve `UnifiedApprovalGate`, `BrowserToolsInjector`, canonical conversation scoping, cancellation, and error presentation.
- Reject vendor-specific behavior leaks into shared UI unless the capability model explicitly represents them.

## Workstream 3: Canonical model catalog (R4)

- Inventory all literal model IDs and fail the sprint if a new authority outside `modelConfig.ts` remains.
- Update canonical IDs and default policy from approved evidence.
- Project canonical Codex IDs into `bundledCatalog.ts`; deduplicate provider aliases with stable persisted-selection resolution.
- Refresh labels, descriptions, order, tier, deprecation, and thinking-effort capabilities.
- Preserve remote discovery/cache precedence and a truthful bundled offline floor.
- Add fixtures for duplicates, deprecated defaults, stale cache, offline startup, and provider discovery disagreement.

## Workstream 4: Behavior matrices (R5)

- Extend existing runtime tests instead of adding a parallel test framework.
- Re-run start/stream/tool/approval/question/plan/cancel/auth/failure/completion for all applicable runtimes.
- Re-run Sprint 110 continuation cases and Sprint 112 effort cases against final pins.
- Verify runtime availability isolation and sidebar bootstrap/model presentation.
- Exercise browser tools through the shared injector on each runtime.

## Workstream 5: Native and packaging evidence (R2, R6, R7)

- Local darwin-arm64: fetch, manifest validation, `file`, startup, and authenticated behavior.
- Native matrix: darwin-x64 and win32-x64 fetch, architecture, invocable startup, protocol smoke, and artifact digest.
- Verify platform-only helpers by completeness/checksum/architecture and through the parent runtime path.
- Verify staged extension/package output contains the exact target subset and no stale prior-version executable.
- Record that full signed app/installer validation remains part of v1.11 release gates.

## Workstream 6: QA and closeout (R8)

- Run manifest validator tests, runtime suites, model catalog/resolver/presentation tests, continuation, thinking effort, bootstrap, provider isolation, extension compile/build, and repository QA.
- Update architecture if component or catalog contracts changed, with a compliant date.
- Update changelog, v1.11 release notes, runtime notices, release tracker, issue, PR, and exact version table.
- Review the checked task list against branch diff and evidence; unsupported checks remain open.

## Implementation Order

W0 audit → decision gate → W1 supply chain → W2 measured compatibility → W3 catalog → W4 behavior → W5 native/package evidence → W6 QA/docs. W2 may be empty when candidates are protocol-compatible; the audit must say so explicitly.

## Architecture Gate

Triggered when required runtime components, shared capabilities, model-catalog authority/projection, or adapter contracts change. Update `docs/development/architecture.md` before close. The three `AgentRuntime` implementations, `UnifiedApprovalGate`, `BrowserToolsInjector`, and `modelConfig.ts` single-source invariant remain locked.
