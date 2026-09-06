# Sprint 111 Runtime Version Audit

**Status:** Phase 0 evidence complete; exact-pin/protocol decision pending<br>
**Snapshot date:** 2026-08-23

## RC completeness correction — 2026-08-31

The original audit treated each agent/platform as one runnable artifact. A real
signed-candidate Codex file-tool turn disproved that assumption: Codex 0.149.0
starts through `codex-app-server`, then launches a version-matched sibling
`codex-code-mode-host` for Code Mode. The first candidate omitted the sibling
and failed with `No such file or directory` at its expected packaged path.

OpenAI's same official release contains these additional required artifacts:

| Component | Platform | Upstream asset | SHA-256 | Archive path | Evidence |
|---|---|---|---|---|---|
| Codex code-mode host 0.149.0 | darwin-arm64 | `codex-code-mode-host-aarch64-apple-darwin.tar.gz` | `ed6a6a089c50e727ef1f0642ee7c0611ba611d76d72029316a0513be91bfb244` | `codex-code-mode-host-aarch64-apple-darwin` | Mach-O arm64; `--help` starts successfully |
| Codex code-mode host 0.149.0 | darwin-x64 | `codex-code-mode-host-x86_64-apple-darwin.tar.gz` | `1e9c8695fcd280d1ea039c662bd0f6393a202a7c583ffe9cc97d135e075d61fd` | `codex-code-mode-host-x86_64-apple-darwin` | Mach-O x86_64; native CI required |
| Codex code-mode host 0.149.0 | win32-x64 | `codex-code-mode-host-x86_64-pc-windows-msvc.exe.tar.gz` | `0d49e410c48fdd4bd1b132055dc9a35e634afd17564617c8716a35c361a2f60d` | `codex-code-mode-host-x86_64-pc-windows-msvc.exe` | PE32+ console x86-64; native CI required |

Manifest schema 2 supersedes the nine-artifact completeness claim below. It
requires twelve component rows: two Codex components and one component for
each other runtime across all three targets. A packaged Codex file-tool canary
is now mandatory before Gate 1 human testing.

## Objective

Prove that the proposed runtime/SDK versions can replace the current pins without breaking Ritemark’s platform packaging, runtime adapters, conversation isolation, or Sprint 110 continuation contract. This audit uses exact upstream versions; it does not authorize floating `latest` resolution.

## Exact Source Snapshot

| Component | Current pin | Proposed pin | Official evidence | Published |
|---|---:|---:|---|---|
| Codex app-server | 0.144.4 | 0.149.0 | [GitHub release](https://github.com/openai/codex/releases/tag/rust-v0.149.0) | 2026-08-20 21:04:55Z |
| Claude Code | 2.1.217 | 2.1.239 | [GitHub release](https://github.com/anthropics/claude-code/releases/tag/v2.1.239) and official npm optional packages | GitHub 2026-08-21 19:54:23Z; npm darwin-arm64 17:24:35Z |
| Claude Agent SDK | 0.3.217 | 0.3.239 | [npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk/v/0.3.239) | 2026-08-21 17:23:55Z |
| OpenCode | 1.18.4 | 1.18.21 | [GitHub release](https://github.com/anomalyco/opencode/releases/tag/v1.18.21) and official npm optional packages | GitHub 2026-08-21 14:51:11Z; npm darwin-arm64 14:49:11Z |
| ACP TypeScript SDK | 0.22.1 | 1.4.0 | [npm](https://www.npmjs.com/package/@agentclientprotocol/sdk/v/1.4.0) | 2026-08-20 23:00:39Z |

The registries and release pages were queried directly on the snapshot date. The Claude SDK declares `claudeCodeVersion: 2.1.239`, so the proposed binary/SDK pair is exact.

## Artifact Matrix

The nine primary target archives below were downloaded from the upstream release/npm URLs into a temporary directory. SHA-256 is over the downloaded archive, before extraction. The RC addendum above adds the three Codex sidecar archives required for the complete shipping set.

| Runtime | Platform | Upstream asset/package | SHA-256 | Archive path | Version/architecture/signature evidence | Result |
|---|---|---|---|---|---|---|
| Codex 0.149.0 | darwin-arm64 | `codex-app-server-aarch64-apple-darwin.tar.gz` | `35892a576ec29edbbb766cfba002c57c7beea479c6c21715a134cab4a7352032` | `codex-app-server-aarch64-apple-darwin` | `codex-app-server 0.149.0`; Mach-O arm64; hardened signature, Team `2DC432GLL2` | Pass |
| Codex 0.149.0 | darwin-x64 | `codex-app-server-x86_64-apple-darwin.tar.gz` | `12c4951f6e9c1acfb6c726a7cf59b3c9f152dd16e5b7475cfc2f435396fc3d1a` | `codex-app-server-x86_64-apple-darwin` | `0.149.0` under Rosetta; Mach-O x86_64; hardened signature, same Team | Artifact pass; native CI still required |
| Codex 0.149.0 | win32-x64 | `codex-app-server-x86_64-pc-windows-msvc.exe.tar.gz` | `a44add5edeef9cb074e51ec3583d4a368638ac789ff61717e1e855fe83fd5b6a` | `codex-app-server-x86_64-pc-windows-msvc.exe` | PE32+ x86-64 inspected on macOS | Artifact pass; native version/signature CI required |
| Claude 2.1.239 | darwin-arm64 | `@anthropic-ai/claude-code-darwin-arm64@2.1.239` | `bd79fcb60c33caa45fb5ba32e1b25ec002fe3ea1bcff6a0948cd4be0f14a94ad` | `package/claude` | `2.1.239 (Claude Code)`; Mach-O arm64; hardened signature, Team `Q6L2SF6YDW` | Pass |
| Claude 2.1.239 | darwin-x64 | `@anthropic-ai/claude-code-darwin-x64@2.1.239` | `180656a7c819d61725ca6d3b0f97e73bb39638758b31b1fbf96284115dea1a09` | `package/claude` | `2.1.239` under Rosetta; Mach-O x86_64; hardened signature, same Team | Artifact pass; native CI still required |
| Claude 2.1.239 | win32-x64 | `@anthropic-ai/claude-code-win32-x64@2.1.239` | `12d45ab5d71b72406e94ff0959b9ac6cf8d1682c2c3f3f5750747f9a375573f5` | `package/claude.exe` | PE32+ x86-64 inspected on macOS | Artifact pass; native version/signature CI required |
| OpenCode 1.18.21 | darwin-arm64 | `opencode-darwin-arm64@1.18.21` | `d29f9bb2e0a67d7d484d5a8262af99e34f58d747f3d1ce500dc81e38b4dba85f` | `package/bin/opencode` | `1.18.21`; Mach-O arm64; ad-hoc/linker signature | Pass |
| OpenCode 1.18.21 | darwin-x64 | `opencode-darwin-x64@1.18.21` | `637661eed055dcd57bbe12693c1dc380b54884e1d0089d74b884d09a9d096886` | `package/bin/opencode` | `1.18.21` under Rosetta; Mach-O x86_64; upstream warns this CPU path lacks AVX | Artifact pass; native x64 CI required |
| OpenCode 1.18.21 | win32-x64 | `opencode-windows-x64@1.18.21` | `6947a935fe0c62b8a072bd06626a0c8a7629eaeb85ff3012dc9236077711e9cf` | `package/bin/opencode.exe` | PE32+ x86-64 inspected on macOS | Artifact pass; native version/signature CI required |

Archive layouts preserve every current manifest source type and install name. Codex remains a direct standalone app-server; no CLI-wrapper migration is required.

## SDK and Protocol Evidence

### Codex 0.149.0

- Current core methods and fields used by Ritemark (`initialize`, `thread/start`, `thread/read`, `thread/resume`, `turn/start`, approval mode) remain available.
- The release-note ambiguity around `untrusted` was tested live: `thread/start` still accepts `approvalPolicy: "untrusted"` with the current read-only contract.
- `model/list` succeeds and advertises `low`, `medium`, `high`, `xhigh`, `max`, and `ultra`; Ritemark must keep this capability-driven rather than hardcode the list for Sprint 112.
- Upstream `ToolRequestUserInputParams` now includes required `isBlocking`; `autoResolutionMs` is deprecated. Ritemark currently ignores unknown fields, so the wire path remains compatible. The local protocol subset/fixture should add `isBlocking` as a tolerated field during implementation so the measured contract is explicit while system-runtime backward compatibility is preserved.
- Source schema diff also adds optional model metadata (`modelSpecialty`, `multiAgentVersion`). No current parser depends on it.
- The read-only [protocol probe](./codex-protocol-probe.mjs) passed. Sprint 110 semantic resume/process restart, invalid-descriptor rejection, and two-thread isolation all passed on the target binary.

### Claude 2.1.239 / Agent SDK 0.3.239

- Target SDK peer requirements are Node `>=18`, `zod ^4`, `@anthropic-ai/sdk >=0.93`, and `@modelcontextprotocol/sdk ^1.29`.
- The current non-test extension TypeScript source compiles unchanged when module paths are replaced with SDK `0.3.239` and ACP SDK `1.4.0` declarations.
- Effort remains typed as `low | medium | high | xhigh | max`; query options retain `thinking?: ThinkingConfig` and `effort?: EffortLevel`, and model metadata retains support/allowed-level discovery.
- The target binary and SDK passed startup, semantic resume across new subprocesses, invalid-session rejection, and two-session isolation with tools denied.
- No production adapter change is justified by Phase 0 evidence; dependency/parity/fixture changes are still required after approval.

### OpenCode 1.18.21 / ACP SDK 1.4.0

- ACP 1.4.0 retains the `ClientSideConnection` API used by Ritemark; current non-test extension TypeScript compiles unchanged against it.
- Live initialize reports protocol version 1 plus load/resume/list/fork/close session capabilities and HTTP/SSE MCP support.
- Thought effort is model-dependent. The default `opencode/big-pickle` session exposed no thought-level option. After selecting an effort-capable model, ACP exposed a select option with semantic category `thought_level`, values `low | medium | high`, and acknowledged an update to `high` before the next prompt. The observed option ID happened to be `effort`; Sprint 112 must key off the semantic category, not that vendor ID.
- Semantic resume, transcript replay through `loadSession`, invalid-session rejection, and two-session isolation passed on the exact binary/SDK pair using a free model with edit, shell, and web tools denied.
- The isolated audit harness required a writable `XDG_STATE_HOME`; this is normal OpenCode state behavior, not a Ritemark adapter regression.

## License and Distribution Evidence

- [x] Codex remains Apache-2.0 with official OpenAI GitHub release provenance.
- [x] Claude binary and SDK packages still contain the Anthropic notice pointing to the same public legal/compliance terms. Existing `LicenseRef-Anthropic-Proprietary` and the documented product-owner redistribution decision remain the applicable paper trail; this audit is not a new legal interpretation.
- [x] OpenCode remains MIT, but the manifest’s legacy `github.com/sst/opencode` notice URLs are stale and must change to `github.com/anomalyco/opencode` with the approved pin.
- [x] ACP SDK 1.4.0 contains Apache-2.0 and requires no new custom license reference.
- [x] Claude archives include `LICENSE.md`; no additional license file appeared in the target OpenCode platform package. Native package/notices verification remains part of release packaging QA.

## Platform Gaps and Rollback

- The local host proves darwin-arm64 behavior and inspects/runs macOS x64 artifacts under Rosetta. It cannot replace native darwin-x64 or win32-x64 CI evidence. Those rows stay mandatory in Phase 4.
- OpenCode x64 emitted an AVX warning under this Apple Silicon Rosetta host; validate the selected upstream x64 package on the native Intel runner before release readiness.
- Windows Authenticode/version output, app packaging, cancellation, approval, browser, and failure-injection matrices are intentionally not claimed by Phase 0; they belong to Phases 3–4 after pins are approved.
- Rollback is atomic: restore Codex `0.144.4`, Claude binary `2.1.217` plus SDK `0.3.217`, OpenCode `1.18.4` plus ACP SDK `0.22.1`, their old lockfile/manifest/checksums, and only the protocol fixtures/adaptations introduced by this sprint. Conversation storage and webview state do not change.

## Recommendation

**Ship the exact proposed snapshot**, subject to Jarmo’s decision and the later native-platform/release gates.

Approved implementation plan:

1. Preserve current artifact source types and install paths; write the nine measured SHA-256 values into the manifest.
2. Pin Claude binary/SDK and OpenCode/ACP as atomic pairs and add the Claude parity failure check.
3. Make only measured protocol changes: tolerate/fixture Codex `isBlocking`, retain open capability discovery, and contain any ACP dependency adjustments inside `src/acp/`.
4. Update OpenCode vendor/license URLs; preserve the existing Claude proprietary paper trail.
5. Do not add Composer effort UI in Sprint 111; pass the measured capability matrix to Sprint 112.

**Jarmo decision:** Approved 2026-08-24 (“jätka”).
