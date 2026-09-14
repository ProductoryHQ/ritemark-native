# GitHub issue draft — Sprint 117

**Published 2026-09-14 as [#292](https://github.com/ProductoryHQ/ritemark-native/issues/292)** under milestone `v1.11.0`, label `enhancement`. Done at the same time: #281 moved to `v1.11.0` and retitled without "Sprint 121"; #156 moved to `v1.11.0`; both commented with how Sprint 117 absorbs them. This file is kept as the source text.

---

**Title:** Sprint 117: Comment-to-agent honesty and comfortable comment handoff

## Goal

Every comment-to-agent assignment is truthful from click to completion — one dispatch contract, the correct document and conversation, reliable status, and a visible reply on the source comment — and the comment itself is comfortable to write and hand over.

## Scope

- One typed dispatch contract and one prompt builder for the margin rail and the Comments menu; no entry point sends `the active document` as the file name.
- Stable IDs for anchored and standalone comments; no dispatch with an empty ID list.
- Every task is bound at acceptance to the canonical document, comment IDs, runtime, and destination conversation; switching tabs cannot retarget queued work.
- Runtime availability is checked before acceptance; queue-full and per-runtime failures are reported per group, never as a blanket "Queued N tasks".
- Host-owned task ledger: status survives editor and sidebar reloads; one terminal turn finishes only its own task; cancelled turns never report done.
- Completion posts one concise reply on the source comment with an Open conversation link (#156); needs-input, failed, cancelled, and interrupted states are distinct.
- A comment task goes to the conversation open in the AI sidebar; both surfaces show its title, with no confirmation step (#281).
- Comment composer with bounded vertical resize; `@` opens the agent picker immediately with keyboard and pointer selection; collapsed comments never cover document text (#281).
- The existing `comment-callouts` flag stays the only flag and stays default-on.

## Definition of done

- Single and bulk dispatch produce the same normalized task records and prompts.
- Every dispatched comment has a stable ID; switching tabs after enqueue cannot change the task's document context.
- Unavailable runtimes fail before queue acceptance with actionable recovery.
- Working, needs-input, completed, failed, and cancelled states are truthful and isolated to the source document and comments.
- Completion writes one concise reply to the source comment and links to the canonical conversation.
- The task lands in the open conversation and both surfaces name it; `@` picker works by keyboard and pointer; collapsed comments never overlap text; the composer resizes within bounds with controls reachable.
- Comment Markdown round-trip and export stripping are unchanged; three-runtime matrix, webview and extension builds, architecture gate, and repository QA pass.

## Relationships

- Absorbs #156 (reply on the source comment) and #281 (v1.12.0 Sprint 121, comment ergonomics and visible handoff).
- Milestone: v1.11.0. Branch: `sprint-117-comment-agent-honesty`. Package: `docs/development/releases/v1.11.0/sprint-117-comment-agent-honesty/`.
- Depends on Sprint 116 (merged, #287). v1.12.0 Sprint 122 depends on this sprint's interaction vocabulary and resizable composer primitive.

## Out of scope

- Multi-turn comment threads or a new persisted comment schema.
- Agent conversation header, agent composer resize, destination-aware chat links (v1.12.0 Sprint 122).
- New runtime kinds or runtime-specific approval message types.
- Deleting or resolving comments automatically after completion.
