# Sprint 111 Runtime Version Audit

**Status:** Planning snapshot; live artifact audit pending<br>
**Snapshot date:** 2026-08-22

## Objective

Prove that the proposed runtime/SDK versions can replace the current pins without breaking Ritemark’s platform packaging, runtime adapters, conversation isolation, or Sprint 110 continuation contract.

## Planning Snapshot

| Component | Current pin | Proposed pin | Official evidence | Key audit question |
|---|---:|---:|---|---|
| Codex app-server | 0.144.4 | 0.149.0 | [GitHub release](https://github.com/openai/codex/releases/tag/rust-v0.149.0) | Do standalone app-server artifacts and current JSON-RPC contracts remain compatible? |
| Claude Code | 2.1.217 | 2.1.239 | [GitHub release](https://github.com/anthropics/claude-code/releases/tag/v2.1.239) | Do platform packages, license terms, and binary behavior remain compatible? |
| Claude Agent SDK | 0.3.217 | 0.3.239 | [npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk/v/0.3.239) | Does the package declare `claudeCodeVersion: 2.1.239`, and do peer/stub requirements still bundle? |
| OpenCode | 1.18.4 | 1.18.21 | [GitHub release](https://github.com/anomalyco/opencode/releases/tag/v1.18.21) | Are ACP config, thought level, cancellation, and multi-session behavior stable? |
| ACP TypeScript SDK | 0.22.1 | 1.4.0 | [npm](https://www.npmjs.com/package/@agentclientprotocol/sdk/v/1.4.0) | What migration is required across the 1.0 boundary? |

Official registries reported these versions as latest stable on 2026-08-22. This table is evidence for the proposed pin, not permission to resolve `latest` during builds.

## Artifact Matrix

Fill before the Phase 0 decision:

| Runtime | Platform | Upstream asset/package | SHA-256 | Archive path | Version output | Architecture/signature | Result |
|---|---|---|---|---|---|---|---|
| Codex 0.149.0 | darwin-arm64 | — | — | — | — | — | Pending |
| Codex 0.149.0 | darwin-x64 | — | — | — | — | — | Pending |
| Codex 0.149.0 | win32-x64 | — | — | — | — | — | Pending |
| Claude 2.1.239 | darwin-arm64 | — | — | — | — | — | Pending |
| Claude 2.1.239 | darwin-x64 | — | — | — | — | — | Pending |
| Claude 2.1.239 | win32-x64 | — | — | — | — | — | Pending |
| OpenCode 1.18.21 | darwin-arm64 | — | — | — | — | — | Pending |
| OpenCode 1.18.21 | darwin-x64 | — | — | — | — | — | Pending |
| OpenCode 1.18.21 | win32-x64 | — | — | — | — | — | Pending |

## Protocol Matrix

### Codex

- initialize and capabilities
- model list and reasoning-effort metadata
- thread start/read/resume and process restart
- turn start, collaboration mode, cancellation
- approval, user questions, plan updates, dynamic tools
- two-thread event routing and unknown optional fields

### Claude

- SDK/binary patch parity and startup
- auth methods, model discovery, adaptive thinking/effort type surface
- permissions, plan mode, browser MCP, approvals/questions
- callbacks, two sessions, cancellation, resume

### OpenCode/ACP

- SDK 1.4.0 compile/API migration
- initialize, session creation, config option updates
- semantic `model` and `thought_level` discovery
- prompt stream, file operations, approvals, cancellation
- two sessions, process shutdown/restart, provider/model errors

## License and Distribution Checklist

- [ ] Codex Apache-2.0 URL and artifact provenance rechecked.
- [ ] Anthropic proprietary license/redistribution paper trail rechecked.
- [ ] OpenCode repository/vendor identity and MIT notice updated from legacy `sst` URLs where needed.
- [ ] ACP SDK Apache-2.0 dependency notice checked.
- [ ] Platform packages contain no unrecorded bundled licenses requiring notice changes.

## Decision

Choose one after live audit:

- **Ship exact snapshot:** all required contracts and artifacts pass.
- **Revise exact snapshot:** name the replacement pins and rerun every affected row.
- **Block:** name the failing contract, last verified compatible version, and smallest safe next action.

**Jarmo decision:** Pending.
