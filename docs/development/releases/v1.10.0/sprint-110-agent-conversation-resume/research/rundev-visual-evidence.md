# Sprint 110 Rundev Visual Evidence

**Date:** 2026-08-23
**Workspace:** `ritemark-demo`
**Host:** macOS Ritemark extension-development window
**Profile:** fresh isolated user-data directory
**Runtimes exercised:** Claude Sonnet 5 → Codex GPT-5.5

## Verified Paths

1. A fresh profile completed the empty legacy-inventory handshake, wrote `migration.json` with host authority, and persisted the first prompt in the host-owned conversation record before runtime dispatch.
2. A non-empty Claude → Codex change applied immediately with zero dialogs, preserved an existing composer draft exactly, and started no runtime work before Send.
3. On Send, the UI immediately inserted exactly one compact durable line — **Continuing with Codex. Previous messages were included as context.** — before the new user turn. The old transcript-restored banner was absent. Codex GPT-5.5 then completed the request in the same canonical conversation.
4. Codex also received bounded transcript context from Claude. Given the probe phrase `BLUE ORBIT`, Codex returned both the phrase and Claude's exact earlier question.
5. After a full desktop restart, Ritemark automatically reopened the same canonical transcript and its durable handoff boundary.
6. The host record contained ordered `not-sent → ambiguous → accepted` receipts, the context-restored boundary, both runtime IDs, and completed assistant finals. Provider IDs remained outside the webview projection.

The original confirmation-dialog evidence was superseded after live user smoke found that interaction too heavy. Its release screenshot was replaced by [`1-10-0-agent-switch-boundary.png`](../../../../releases/v1.10.0/screenshots/1-10-0-agent-switch-boundary.png), captured from a clean two-turn Claude → Codex conversation. The two earlier large-banner screenshots were also replaced with final-state [`transcript-context-restored`](../../../../releases/v1.10.0/screenshots/1-10-0-transcript-context-restored.png) and [`conversation-reopened`](../../../../releases/v1.10.0/screenshots/1-10-0-conversation-reopened.png) evidence after a real window reload.

## Defects Found And Fixed During The Run

- Fresh profiles remained in legacy mode because the webview waited for host authority before sending an empty legacy inventory, while the host waited for an imported record before establishing authority. The startup handshake now inventories first and establishes monotonic host authority after the import succeeds, including an empty inventory.
- Legacy inventories above the 100-record bridge limit previously sent only the first batch. Migration now drains every bounded batch in order (covered with a 205-record `100 / 100 / 5` regression), while an entirely invalid non-empty inventory retains legacy authority for recovery.
- A cross-runtime fallback checkpoint was rejected when Codex's coverage watermark pointed to Claude's last completed canonical answer. Coverage is transcript-level, so validation now accepts a completed assistant event from any runtime while retaining exact runtime/scope/model/policy descriptor compatibility.

## External Runtime Finding

The currently bundled Codex CLI rejects `gpt-5.6-sol` with HTTP 400 and asks for a newer CLI. Sprint 110 was rerun successfully with GPT-5.5. The binary/model mismatch belongs to Sprint 111's approved runtime-refresh scope and is not hidden or treated as a continuation success.

## Not Exercised Live

- Auth loss and recovery for each runtime.
- Ambiguous process crash after provider acceptance but before final checkpoint.
- OpenCode/ACP authenticated production-UI restart.
- Reduced-motion visual pass.

These remain explicit release-matrix work; focused adapter/controller tests cover their deterministic policy paths meanwhile.
