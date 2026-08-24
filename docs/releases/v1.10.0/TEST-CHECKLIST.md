# Ritemark 1.10.0 Test Checklist

This checklist accumulates release evidence across Sprints 109–112.

## Durable conversations (Sprint 109)

- [x] New, Pinned, automatic active/recent/current, and All conversations rail order is stable.
- [x] Selecting a conversation does not reorder Recents.
- [x] Pin/Unpin, Rename, Delete, confirmation, and Undo preserve canonical identity.
- [x] Host-backed history remains current-project-only and survives reload.

## Conversation continuation (Sprint 110)

- [x] Opening/selecting a saved conversation performs no runtime resume or send.
- [x] Claude compatible descriptor selects SDK native resume; rejected native resume retries once with transcript fallback only before provider evidence.
- [x] Codex compatible descriptor selects `thread/resume`; successful `turn/start` is the acceptance receipt.
- [x] OpenCode checks ACP `sessionCapabilities.resume`, uses `session/resume`, and never calls `session/load`.
- [x] Runtime/project/version/model/policy/auth mismatch rejects native binding and keeps the transcript readable.
- [x] Fallback stays within 32,000 UTF-8 bytes, truncates deterministically, and discloses omitted messages.
- [x] Fallback excludes the newly accepted prompt, tools, approvals, partial/failed assistant text, hidden prompts, and attachment binary/content.
- [x] A previous unanswered prompt crosses Codex → Claude (and equivalent handoffs) as labelled context; only the new instruction is dispatched.
- [x] `not-sent → ambiguous → accepted` receipts are ordered, idempotent, and absent from webview projections.
- [x] Coverage advances only with a saved completed assistant final; failed/no-final paths invalidate only that runtime descriptor.
- [x] Choosing another runtime applies without a dialog, preserves draft text, stops an active prior run, starts nothing before Send, and keeps one canonical conversation ID.
- [x] Late callbacks from the superseded runtime cannot append output, change lifecycle, or advance a watermark.
- [x] Transcript-restored, truncated, context-unavailable, and runtime-unavailable copy is truthful and accessible; native restore is quiet.
- [x] Fresh-profile canary: empty legacy inventory establishes host authority before the first durable prompt is accepted.
- [x] Legacy cutover drains every bounded import batch; 205 records preserve `100 / 100 / 5` order, while an all-invalid non-empty inventory retains legacy authority.
- [x] Live dev R9: immediate runtime selection preserved the draft, opened no dialog, started nothing before Send, and rendered exactly one compact durable boundary without the old banner in the Ritemark demo workspace (Claude Sonnet 5 → Codex GPT-5.5, 2026-08-23).
- [x] Live cross-runtime semantic recall: Codex GPT-5.5 recovered Claude's synthetic probe phrase and exact prior question from bounded transcript context.
- [x] Live restart: the same canonical Claude + Codex transcript and context-restored boundary reappeared after a full desktop restart.
- [ ] Live authenticated restart: verify native semantic recall through the production UI for each available runtime.
- [ ] Failure injection: auth loss/runtime unavailable and ambiguous crash after transport but before final checkpoint.

These two live rows are intentionally retained for the post-Sprint 111/final release matrix because Sprint 111 changes the exact runtime binaries. Sprint 110 covers their deterministic adapter/controller policy paths and does not claim unrun production-UI evidence.

## Runtime refresh (Sprint 111)

- [x] Exact Codex 0.149.0, Claude Code 2.1.239, Claude Agent SDK 0.3.239, OpenCode 1.18.21, and ACP SDK 1.4.0 pins are recorded with official sources and licenses.
- [x] All nine darwin-arm64, darwin-x64, and win32-x64 runtime archives pass URL, SHA-256, archive-layout, and architecture validation.
- [x] Claude binary/SDK drift and an incomplete platform matrix fail the hard manifest validator.
- [x] Native darwin-arm64 fetch, version discovery, OpenCode permission gates, cancellation, and shared-process survival pass on the shipping pins.
- [x] Codex, Claude, and OpenCode continuation/restart plus two-conversation isolation probes pass on the shipping pins.
- [x] Codex optional `isBlocking` input metadata routes through the existing input contract; ACP 1.4.0 preserves the contained adapter boundary.
- [x] Native darwin-x64 and win32-x64 exact SDK compile, runtime fetch/checksum/architecture, and three-binary version smoke pass on final commit `3ef9e0c` ([matrix run](https://github.com/ProductoryHQ/ritemark-native/actions/runs/32701706388)).

## Automated gates

- [x] Extension TypeScript compile and bundle.
- [x] Webview TypeScript typecheck and production bundle.
- [x] Focused continuation, context-pack, controller/store, three-adapter, projection, presentation, and runtime-switch tests.
- [x] Complete conversation regression suite.
- [x] `./scripts/validate-qa.sh` on the final Sprint 110 branch (2026-08-23).
- [x] Sprint 110 fresh-profile migration+resume canary.
- [x] Sprint 111 exact-manifest validator, validator mutation tests, extension compile, focused runtime suites, and deterministic extension suite.
- [ ] Release preflight and final migration+resume canary after all v1.10.0 sprints merge.

## Remaining release scope

- [ ] Sprint 112 Composer thinking-effort behavior and visual matrix.
- [ ] Final macOS arm64/x64 and Windows candidate gates.
